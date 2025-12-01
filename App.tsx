import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileDown, Loader2, AlertTriangle, Train, CloudDownload } from 'lucide-react';
import { parseGTFSZip, getActiveTripsForToday, fetchRemoteGTFS } from './services/gtfsParser';
import { calculateTrainPositions, getCurrentSeconds } from './services/trainSimulator';
import { TrainMap } from './components/TrainMap';
import { Sidebar } from './components/Sidebar';
import { GTFSData, TrainPosition, Trip, Stop } from './types';

// Constants
const RENFE_GTFS_URL = "https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip";
const SIMULATION_TICK_MS = 1000;

function App() {
  const [gtfsData, setGtfsData] = useState<GTFSData | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);
  const [positions, setPositions] = useState<TrainPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState("00:00:00");
  
  // Selection State
  const [selectedTrain, setSelectedTrain] = useState<TrainPosition | null>(null);
  const [selectedStation, setSelectedStation] = useState<Stop | null>(null);
  
  // Sidebar UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Simulation Loop
  useEffect(() => {
    if (!gtfsData) return;

    const tick = () => {
      // Force Madrid time display
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' }));

      // If no active trips, don't simulate
      if (activeTrips.length === 0) return;

      const seconds = getCurrentSeconds();
      const newPositions = calculateTrainPositions(gtfsData, activeTrips, seconds);
      setPositions(newPositions);

      // Update selected train object if it exists to keep position live
      if (selectedTrain && (selectedTrain.status === 'MOVING' || selectedTrain.status === 'AT_STOP')) {
          const updated = newPositions.find(p => p.trip_id === selectedTrain.trip_id);
          // If train finished its route, it disappears from newPositions. Keep old one or update status?
          if (updated) {
              setSelectedTrain(updated);
          } else {
             // If it disappeared but we had it selected, it might have just finished.
             // We can leave it as is, or mark as ENDED.
          }
      }
    };

    // Initial tick
    tick();

    const interval = setInterval(tick, SIMULATION_TICK_MS);
    return () => clearInterval(interval);
  }, [gtfsData, activeTrips, selectedTrain]);

  // Process Data Helper
  const processData = async (data: any) => {
    setLoadingMsg("Calculating active services for today...");
    await new Promise(r => setTimeout(r, 100)); // UI Yield
    
    // Ensure we are checking against Madrid date
    const now = new Date();
    const madridDateStr = now.toLocaleDateString('en-US', { timeZone: 'Europe/Madrid' });
    const madridDate = new Date(madridDateStr);

    const active = getActiveTripsForToday(data, madridDate);
    
    setGtfsData(data);
    setActiveTrips(active);
    setLoading(false);
  };

  // Handlers
  const handleFetchUrl = async () => {
      try {
          setLoading(true);
          setError(null);
          const data = await fetchRemoteGTFS(RENFE_GTFS_URL, (msg) => setLoadingMsg(msg));
          await processData(data);
      } catch (e: any) {
          console.error(e);
          setError("Failed to download from Renfe. " + e.message);
          setLoading(false);
      }
  };

  const handleFile = async (file: File) => {
    try {
        setLoading(true);
        setError(null);
        const data = await parseGTFSZip(file, (msg) => setLoadingMsg(msg));
        await processData(data);
    } catch (e: any) {
        console.error(e);
        setError("Failed to parse GTFS file. Please ensure it is a valid zip containing required txt files.");
        setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchTerm.trim() || !gtfsData) return;

      const term = searchTerm.toLowerCase();

      // 1. Search Stations
      // We convert values to array to search
      const foundStop = Array.from(gtfsData.stops.values()).find((s: Stop) => 
          s.stop_name.toLowerCase().includes(term) || s.stop_id.toLowerCase() === term
      );

      if (foundStop) {
          setSelectedStation(foundStop);
          setSelectedTrain(null);
          return;
      }

      // 2. Search Trains (Active & Inactive)
      // First check active positions (live trains)
      const foundLive = positions.find(p => 
          p.trip?.trip_short_name?.toLowerCase().includes(term) ||
          p.trip?.trip_headsign.toLowerCase().includes(term)
      );

      if (foundLive) {
          setSelectedTrain(foundLive);
          setSelectedStation(null);
          return;
      }

      // If not live, check ALL trips (scheduled)
      // We need to construct a "Dummy" TrainPosition for viewing purposes
      const foundTrip = Array.from(gtfsData.trips.values()).find((t: Trip) => 
          t.trip_short_name?.toLowerCase().includes(term) ||
          t.trip_headsign.toLowerCase().includes(term)
      );

      if (foundTrip) {
          const times = gtfsData.stopTimes.get(foundTrip.trip_id);
          const firstStop = times ? gtfsData.stops.get(times[0].stop_id) : null;
          
          if (firstStop) {
              const staticPosition: TrainPosition = {
                  trip_id: foundTrip.trip_id,
                  lat: firstStop.stop_lat,
                  lng: firstStop.stop_lon,
                  bearing: 0,
                  status: 'SCHEDULED', // New status for inactive
                  route: gtfsData.routes.get(foundTrip.route_id),
                  trip: foundTrip
              };
              setSelectedTrain(staticPosition);
              setSelectedStation(null);
          }
          return;
      }

      // Not found
      alert("No station or train found matching: " + searchTerm);
  };

  const handleCloseSelection = () => {
      setSelectedTrain(null);
      setSelectedStation(null);
  };

  // Drag & Drop
  const onDragEnter = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
          e.dataTransfer.clearData();
      }
  };

  // --- Render ---

  // 1. Loading
  if (loading) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
              <p className="text-slate-600 font-medium animate-pulse">{loadingMsg}</p>
          </div>
      );
  }

  // 2. Map View
  if (gtfsData) {
      const stopsList = Array.from(gtfsData.stops.values());
      return (
          <div className="relative h-screen w-screen overflow-hidden flex flex-col">
              <Sidebar 
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                selectedTrain={selectedTrain} 
                selectedStation={selectedStation}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSearchSubmit={handleSearch}
                onCloseSelection={handleCloseSelection}
                activeTrainsCount={positions.length}
                currentTime={currentTimeStr}
                gtfsData={gtfsData}
              />

              <div className="flex-1 w-full h-full">
                  <TrainMap 
                    positions={positions} 
                    stops={stopsList} 
                    selectedTrain={selectedTrain}
                    selectedStation={selectedStation}
                    onSelectTrain={(t) => {
                        setSelectedTrain(t);
                        setSelectedStation(null);
                        setIsSidebarOpen(true);
                    }}
                    onSelectStation={(s) => {
                        setSelectedStation(s);
                        setSelectedTrain(null);
                        setIsSidebarOpen(true);
                    }}
                  />
              </div>

              {/* No Trains Warning Overlay (only if not searching/inspecting static stuff) */}
              {positions.length === 0 && !selectedTrain && !selectedStation && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-6 py-4 rounded-xl shadow-xl border border-yellow-200 flex items-center gap-3 max-w-md pointer-events-none">
                      <AlertTriangle className="text-yellow-500 shrink-0" />
                      <div className="text-sm text-slate-700">
                          <p className="font-bold">No active trains found right now.</p>
                          <p>It might be night time in Spain ({currentTimeStr}). Use search to find scheduled trains.</p>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // 3. Initial Upload/Load
  return (
    <div 
        className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
    >
      <div className={`
        relative max-w-2xl w-full bg-white rounded-3xl shadow-xl border-2 transition-all duration-300 p-12 text-center
        ${isDragging ? 'border-purple-500 bg-purple-50 scale-105' : 'border-dashed border-slate-300'}
      `}>
        {isDragging && (
             <div className="absolute inset-0 bg-purple-100/80 backdrop-blur-sm z-10 rounded-3xl flex items-center justify-center">
                 <p className="text-2xl font-bold text-purple-700">Drop GTFS Zip Here</p>
             </div>
        )}

        <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
                <Train className="w-10 h-10 text-purple-600" />
            </div>
        </div>

        <h1 className="text-4xl font-bold text-slate-800 mb-4">Renfe AV/LD Tracker</h1>
        <p className="text-slate-600 text-lg mb-8 max-w-lg mx-auto">
            Real-time visualization of Spain's high-speed rail network.
        </p>

        {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center justify-center gap-2 text-sm text-left">
                <AlertTriangle size={20} className="shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 w-full">
            {/* Option A: Direct Load */}
            <button 
                onClick={handleFetchUrl}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-500/25 group"
            >
                <CloudDownload size={32} className="group-hover:scale-110 transition-transform" />
                <div className="text-left">
                    <span className="block font-bold text-lg">Auto Load Data</span>
                    <span className="text-purple-200 text-sm">Fetch directly from Renfe</span>
                </div>
            </button>

            {/* Option B: Manual Upload */}
            <label className="cursor-pointer flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white border-2 border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50 transition-all group">
                <Upload size={32} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                <div className="text-left">
                    <span className="block font-bold text-lg text-slate-800">Upload ZIP</span>
                    <span className="text-slate-400 text-sm">If you have the file</span>
                </div>
                <input 
                    type="file" 
                    accept=".zip" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
            </label>
        </div>

        <div className="mt-8 text-xs text-slate-400">
            <p>Data Source: <a href={RENFE_GTFS_URL} className="underline hover:text-purple-500">Renfe Open Data</a></p>
            <p className="mt-1 opacity-60">This app runs entirely in your browser.</p>
        </div>
      </div>
    </div>
  );
}

export default App;