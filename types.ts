export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
  route_color?: string;
  route_text_color?: string;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  trip_short_name?: string; // Train number (e.g. 03202)
  direction_id?: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string; // "HH:MM:SS"
  departure_time: string; // "HH:MM:SS"
  stop_id: string;
  stop_sequence: number;
  arrival_seconds?: number; // Parsed seconds from midnight
  departure_seconds?: number; // Parsed seconds from midnight
}

export interface Calendar {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}

export interface CalendarDate {
  service_id: string;
  date: string;
  exception_type: string;
}

export interface Agency {
    agency_id: string;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
}

export interface GTFSData {
  stops: Map<string, Stop>;
  routes: Map<string, Route>;
  trips: Map<string, Trip>;
  stopTimes: Map<string, StopTime[]>; // Keyed by trip_id, sorted by sequence
  calendar: Map<string, Calendar>;
}

export interface ExtendedGTFSData extends GTFSData {
  calendarDates: Map<string, CalendarDate[]>;
}

export interface TrainPosition {
  trip_id: string;
  lat: number;
  lng: number;
  bearing: number;
  nextStop?: Stop;
  prevStop?: Stop;
  route?: Route;
  trip?: Trip;
  status: 'MOVING' | 'AT_STOP' | 'SCHEDULED' | 'ENDED';
  speedEstimate?: number; // km/h (rough estimate)
}