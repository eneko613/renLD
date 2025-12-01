import { GTFSData, TrainPosition, StopTime, Stop } from '../types';
import { timeToSeconds } from './gtfsParser';

// Get current time in seconds from midnight (Europe/Madrid time)
export const getCurrentSeconds = (): number => {
  const now = new Date();
  // We use the Intl API to get the time in Madrid, handling DST automatically.
  const madridTime = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/Madrid', hour12: false });
  const [h, m, s] = madridTime.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

const interpolate = (start: number, end: number, fraction: number) => {
  return start + (end - start) * fraction;
};

// Calculate bearing between two points
const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;
    
    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return bearing;
};

export const calculateTrainPositions = (
  gtfs: GTFSData, 
  activeTripIds: string[], 
  currentSeconds: number
): TrainPosition[] => {
  const positions: TrainPosition[] = [];

  for (const tripId of activeTripIds) {
    const times = gtfs.stopTimes.get(tripId);
    if (!times || times.length < 2) continue;

    const firstStop = times[0];
    const lastStop = times[times.length - 1];

    // Check if train is currently running
    // Note: This simple check omits trains running past 24:00 (e.g. 25:00) if currentSeconds is small (e.g. 01:00)
    // For a robust production app, we would need to check "Yesterday's" trips that are still running.
    // For this demo, we assume the currentSeconds matches the schedule day window.
    if (currentSeconds < (firstStop.departure_seconds || 0)) continue; // Not started
    if (currentSeconds > (lastStop.arrival_seconds || 0)) continue; // Finished

    // Find the current segment
    for (let i = 0; i < times.length - 1; i++) {
      const current = times[i];
      const next = times[i + 1];

      // Case 1: Train is at a stop (between arrival and departure of the same stop, or just waiting)
      if (currentSeconds >= (current.arrival_seconds || 0) && currentSeconds <= (current.departure_seconds || 0)) {
         const stopInfo = gtfs.stops.get(current.stop_id);
         if (stopInfo) {
             positions.push({
                 trip_id: tripId,
                 lat: stopInfo.stop_lat,
                 lng: stopInfo.stop_lon,
                 bearing: 0,
                 status: 'AT_STOP',
                 nextStop: gtfs.stops.get(next.stop_id),
                 prevStop: gtfs.stops.get(current.stop_id),
                 route: gtfs.routes.get(gtfs.trips.get(tripId)?.route_id || ''),
                 trip: gtfs.trips.get(tripId)
             });
         }
         break;
      }

      // Case 2: Train is moving between stops
      if (currentSeconds > (current.departure_seconds || 0) && currentSeconds < (next.arrival_seconds || 0)) {
        const stopA = gtfs.stops.get(current.stop_id);
        const stopB = gtfs.stops.get(next.stop_id);

        if (stopA && stopB) {
            const duration = (next.arrival_seconds || 0) - (current.departure_seconds || 0);
            const elapsed = currentSeconds - (current.departure_seconds || 0);
            const fraction = elapsed / duration;

            const lat = interpolate(stopA.stop_lat, stopB.stop_lat, fraction);
            const lng = interpolate(stopA.stop_lon, stopB.stop_lon, fraction);
            const bearing = getBearing(stopA.stop_lat, stopA.stop_lon, stopB.stop_lat, stopB.stop_lon);

            positions.push({
                trip_id: tripId,
                lat,
                lng,
                bearing,
                status: 'MOVING',
                nextStop: stopB,
                prevStop: stopA,
                route: gtfs.routes.get(gtfs.trips.get(tripId)?.route_id || ''),
                trip: gtfs.trips.get(tripId)
            });
        }
        break;
      }
    }
  }

  return positions;
};