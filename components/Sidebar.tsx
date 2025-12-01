import React from 'react';
import { TrainPosition, GTFSData, StopTime, Stop } from '../types';
import { Train, MapPin, Navigation, Clock, Calendar, ArrowRight, Search, X, ChevronLeft, ChevronRight, Locate } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    
    selectedTrain: TrainPosition | null;
    selectedStation: Stop | null;
    
    searchTerm: string;
    onSearchChange: (v: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onCloseSelection: () => void;

    activeTrainsCount: number;
    currentTime: string;
    gtfsData: GTFSData | null;
}

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, setIsOpen,
    selectedTrain, selectedStation,
    searchTerm, onSearchChange, onSearchSubmit, onCloseSelection,
    activeTrainsCount, currentTime, gtfsData 
}) => {
    
    // Get full schedule for the selected train
    let schedule: StopTime[] = [];
    if (selectedTrain && gtfsData) {
        schedule = gtfsData.stopTimes.get(selectedTrain.trip_id) || [];
    }

    // Determine panel content state
    const isSelectionActive = !!selectedTrain || !!selectedStation;

    return (
        <>
            {/* Toggle Button (Visible when closed) */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="absolute top-4 left-4 z-[2000] bg-white text-slate-700 p-3 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <ChevronRight size={24} />
                </button>
            )}

            {/* Main Panel */}
            <div 
                className={`
                    absolute top-0 left-0 h-full bg-white/95 backdrop-blur shadow-2xl z-[2000] 
                    transition-all duration-300 flex flex-col border-r border-gray-200
                    ${isOpen ? 'w-96 translate-x-0' : 'w-96 -translate-x-full'}
                `}
            >
                {/* Header & Search */}
                <div className="p-4 border-b border-gray-100 bg-white/50 space-y-4">
                    <div className="flex justify-between items-center">
                        <h1 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            <Train className="text-purple-600" />
                            Renfe Live
                        </h1>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>

                    <form onSubmit={onSearchSubmit} className="relative">
                        <input 
                            type="text" 
                            placeholder="Search train # or station..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    </form>

                    {/* Stats Row */}
                    <div className="flex justify-between items-center text-xs text-slate-500 font-mono pt-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span>{activeTrainsCount} Active</span>
                        </div>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">{currentTime}</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    
                    {/* State: No Selection (Welcome / Dash) */}
                    {!isSelectionActive && (
                        <div className="p-6 text-center">
                            <div className="bg-purple-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="text-purple-400" size={32} />
                            </div>
                            <h3 className="text-slate-800 font-semibold mb-2">Explore the Network</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Search for a station name (e.g., "Atocha") or a train number (e.g., "03102") to see details.
                            </p>
                            
                            <div className="text-left bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Quick Stats</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Total Stations</span>
                                        <span className="font-mono">{gtfsData?.stops.size || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Routes</span>
                                        <span className="font-mono">{gtfsData?.routes.size || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* State: Station Selected */}
                    {selectedStation && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-white sticky top-0 z-10 p-4 border-b border-gray-100 flex justify-between items-start shadow-sm">
                                <div>
                                    <div className="flex items-center gap-1.5 text-red-500 mb-1">
                                        <MapPin size={16} />
                                        <span className="text-xs font-bold uppercase tracking-wide">Station</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                        {selectedStation.stop_name}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedStation.stop_id}</p>
                                </div>
                                <button onClick={onCloseSelection} className="p-1 hover:bg-slate-100 rounded-full">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="p-4">
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100 flex items-start gap-2">
                                    <Locate size={16} className="mt-0.5 shrink-0" />
                                    <p>Map centered on {selectedStation.stop_name}. Zoom in to see nearby tracks.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* State: Train Selected */}
                    {selectedTrain && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             {/* Train Info Header */}
                            <div className="sticky top-0 z-10 bg-white p-5 border-b border-gray-100 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span 
                                                className="text-white text-xs font-bold px-2 py-0.5 rounded"
                                                style={{ backgroundColor: selectedTrain.route?.route_color ? `#${selectedTrain.route.route_color}` : '#7c3aed' }}
                                            >
                                                {selectedTrain.route?.route_short_name}
                                            </span>
                                            {selectedTrain.trip?.trip_short_name && (
                                                <span className="text-xs font-mono text-gray-500 border border-gray-200 px-1.5 rounded">
                                                    #{selectedTrain.trip.trip_short_name}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-800 leading-tight">
                                            {selectedTrain.trip?.trip_headsign}
                                        </h2>
                                    </div>
                                    <button onClick={onCloseSelection} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                
                                <div className="mt-4 flex gap-4 text-sm">
                                    <div className={`flex items-center gap-1.5 ${
                                        selectedTrain.status === 'MOVING' ? 'text-green-600' : 
                                        selectedTrain.status === 'SCHEDULED' ? 'text-orange-600' : 'text-slate-500'
                                    }`}>
                                        <Navigation size={14} />
                                        <span className="font-bold">
                                            {selectedTrain.status === 'MOVING' ? 'Moving' : 
                                             selectedTrain.status === 'AT_STOP' ? 'At Station' : 
                                             selectedTrain.status === 'SCHEDULED' ? 'Scheduled' : 'Ended'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Clock size={14} />
                                        <span>
                                            {schedule.length > 0 ? 
                                                `${formatTime(schedule[0].departure_seconds || 0)} - ${formatTime(schedule[schedule.length-1].arrival_seconds || 0)}` 
                                                : '--:--'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Next Stop Highlight (Only if active) */}
                            {selectedTrain.nextStop && selectedTrain.status !== 'SCHEDULED' && selectedTrain.status !== 'ENDED' && (
                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Next Station</p>
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800">{selectedTrain.nextStop.stop_name}</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Inactive Warning */}
                            {(selectedTrain.status === 'SCHEDULED' || selectedTrain.status === 'ENDED') && (
                                <div className="bg-orange-50 p-3 text-xs text-orange-800 border-b border-orange-100">
                                    This train is not currently running. Showing scheduled route info.
                                </div>
                            )}

                            {/* Full Schedule Timeline */}
                            <div className="p-5">
                                <h3 className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-4">Route Schedule</h3>
                                <div className="relative border-l-2 border-slate-100 ml-2 space-y-0">
                                    {schedule.map((stop, idx) => {
                                        const stopInfo = gtfsData?.stops.get(stop.stop_id);
                                        const isNext = selectedTrain.nextStop?.stop_id === stop.stop_id;
                                        const isPrev = selectedTrain.prevStop?.stop_id === stop.stop_id;
                                        
                                        // Determine circle style
                                        let circleClass = "bg-white border-slate-300";
                                        if (isNext) circleClass = "bg-blue-500 border-blue-500 ring-4 ring-blue-100";
                                        if (isPrev) circleClass = "bg-green-500 border-green-500";
                                        if (selectedTrain.status === 'SCHEDULED' && idx === 0) circleClass = "bg-orange-500 border-orange-500";

                                        return (
                                            <div key={idx} className="mb-6 ml-4 relative group">
                                                {/* Timeline dot */}
                                                <div className={`absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border-2 ${circleClass} transition-all z-10`}></div>
                                                
                                                <div className={`flex justify-between items-start transition-opacity ${isNext ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
                                                    <div>
                                                        <p className={`text-sm font-medium ${isNext ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                                                            {stopInfo?.stop_name}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-mono text-slate-500">
                                                            {formatTime(stop.departure_seconds || stop.arrival_seconds || 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};