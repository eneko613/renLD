import JSZip from 'jszip';
import Papa from 'papaparse';
import { GTFSData, Stop, Route, Trip, StopTime, Calendar, ExtendedGTFSData, CalendarDate } from '../types';

// Helper to parse HH:MM:SS to seconds from midnight
export const timeToSeconds = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  return h * 3600 + m * 60 + s;
};

// Renforce CORS proxy URL
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

export const fetchRemoteGTFS = async (url: string, onProgress: (msg: string) => void): Promise<ExtendedGTFSData> => {
    onProgress("Downloading GTFS data (this may take a few seconds)...");
    const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    
    const response = await fetch(proxiedUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch GTFS data: ${response.statusText}`);
    }
    const blob = await response.blob();
    const file = new File([blob], "google_transit.zip");
    return parseGTFSZip(file, onProgress);
}

export const parseGTFSZip = async (file: File, onProgress: (msg: string) => void): Promise<ExtendedGTFSData> => {
  onProgress("Unzipping archive...");
  const zip = await JSZip.loadAsync(file);

  const readCSV = async <T>(filename: string): Promise<T[]> => {
    // Some zips might have folders, so we search for the file
    const fileMatch = Object.keys(zip.files).find(path => path.endsWith(filename));
    
    if (!fileMatch) {
        console.warn(`${filename} not found in zip`);
        return [];
    }
    const text = await zip.file(fileMatch)!.async('string');
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as T[]),
      });
    });
  };

  onProgress("Parsing Calendar...");
  const calendarRaw = await readCSV<any>('calendar.txt');
  const calendar = new Map<string, Calendar>();
  calendarRaw.forEach(c => calendar.set(c.service_id, c));

  onProgress("Parsing Calendar Dates (Exceptions)...");
  const calendarDatesRaw = await readCSV<CalendarDate>('calendar_dates.txt');
  const calendarDates = new Map<string, CalendarDate[]>();
  calendarDatesRaw.forEach(cd => {
      if (!calendarDates.has(cd.service_id)) {
          calendarDates.set(cd.service_id, []);
      }
      calendarDates.get(cd.service_id)!.push(cd);
  });

  onProgress("Parsing Routes...");
  const routesRaw = await readCSV<any>('routes.txt');
  const routes = new Map<string, Route>();
  routesRaw.forEach(r => routes.set(r.route_id, r));

  onProgress("Parsing Stops...");
  const stopsRaw = await readCSV<any>('stops.txt');
  const stops = new Map<string, Stop>();
  stopsRaw.forEach(s => {
    stops.set(s.stop_id, {
      ...s,
      stop_lat: parseFloat(s.stop_lat),
      stop_lon: parseFloat(s.stop_lon)
    });
  });

  onProgress("Parsing Trips...");
  const tripsRaw = await readCSV<any>('trips.txt');
  const trips = new Map<string, Trip>();
  tripsRaw.forEach(t => trips.set(t.trip_id, t));

  onProgress("Parsing Stop Times (this may take a moment)...");
  const stopTimesRaw = await readCSV<any>('stop_times.txt');
  const stopTimes = new Map<string, StopTime[]>();
  
  // Group stop_times by trip_id
  stopTimesRaw.forEach(st => {
    if (!trips.has(st.trip_id)) return; // Skip orphan stop times
    
    const processed: StopTime = {
      ...st,
      stop_sequence: parseInt(st.stop_sequence),
      arrival_seconds: timeToSeconds(st.arrival_time),
      departure_seconds: timeToSeconds(st.departure_time),
    };

    if (!stopTimes.has(st.trip_id)) {
      stopTimes.set(st.trip_id, []);
    }
    stopTimes.get(st.trip_id)!.push(processed);
  });

  // Sort sequences
  for (const [tripId, times] of stopTimes.entries()) {
    times.sort((a, b) => a.stop_sequence - b.stop_sequence);
  }

  onProgress("Data ready!");
  
  return {
    calendar,
    calendarDates,
    routes,
    stops,
    trips,
    stopTimes
  };
};

export const getActiveTripsForToday = (gtfs: ExtendedGTFSData, date: Date): string[] => {
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayStr = days[dayOfWeek];
  
  // Format date as YYYYMMDD
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const dateInt = parseInt(`${yyyy}${mm}${dd}`);
  const dateStr = `${yyyy}${mm}${dd}`;

  const activeServiceIds = new Set<string>();

  // 1. Check Standard Calendar
  gtfs.calendar.forEach((cal) => {
    const start = parseInt(cal.start_date);
    const end = parseInt(cal.end_date);
    
    if (dateInt >= start && dateInt <= end) {
      if ((cal as any)[todayStr] === '1') {
        activeServiceIds.add(cal.service_id);
      }
    }
  });

  // 2. Check Exceptions (calendar_dates.txt)
  if (gtfs.calendarDates) {
      gtfs.calendarDates.forEach((dates, serviceId) => {
          dates.forEach(d => {
              if (d.date === dateStr) {
                  if (d.exception_type === '1') {
                      activeServiceIds.add(serviceId); // Add service
                  } else if (d.exception_type === '2') {
                      activeServiceIds.delete(serviceId); // Remove service
                  }
              }
          });
      });
  }

  const activeTripIds: string[] = [];
  gtfs.trips.forEach((trip) => {
    if (activeServiceIds.has(trip.service_id)) {
      activeTripIds.push(trip.trip_id);
    }
  });

  return activeTripIds;
};

// Re-export interface type
export type { ExtendedGTFSData };