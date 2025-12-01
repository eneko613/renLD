import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TrainPosition, Stop } from '../types';

// --- Custom Icons ---

const createTrainIcon = (color: string, bearing: number, isSelected: boolean) => {
    const scale = isSelected ? 1.2 : 1;
    const shadow = isSelected ? 'drop-shadow(0px 0px 8px rgba(0,0,0,0.5))' : 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))';
    
    // Train SVG shape
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" style="transform: rotate(${bearing}deg); filter: ${shadow};">
            <path fill="${color}" stroke="white" stroke-width="2" d="M16,2 L8,10 L8,24 C8,26.2 9.8,28 12,28 L20,28 C22.2,28 24,26.2 24,24 L24,10 L16,2 Z" />
            <rect x="11" y="12" width="10" height="6" rx="1" fill="white" fill-opacity="0.8" />
        </svg>
    `;

    return L.divIcon({
        className: 'custom-train-icon',
        html: svg,
        iconSize: [32 * scale, 32 * scale],
        iconAnchor: [16 * scale, 16 * scale],
    });
};

const createStationIcon = (isSelected: boolean) => {
    const color = isSelected ? '#ef4444' : '#64748b'; // Red if selected, Slate if not
    const size = isSelected ? 24 : 12;
    const zIndex = isSelected ? 1000 : 1;

    // Station SVG: Circle with a smaller inner circle (target style)
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="overflow: visible;">
            <circle cx="12" cy="12" r="10" fill="white" stroke="${color}" stroke-width="${isSelected ? 4 : 2}" />
            <circle cx="12" cy="12" r="4" fill="${color}" />
        </svg>
    `;

    return L.divIcon({
        className: `stop-icon ${isSelected ? 'z-[1000]' : ''}`,
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

interface TrainMapProps {
    positions: TrainPosition[];
    stops: Stop[];
    selectedTrain: TrainPosition | null;
    selectedStation: Stop | null;
    onSelectTrain: (train: TrainPosition) => void;
    onSelectStation: (stop: Stop) => void;
}

const MapController: React.FC<{ 
    selectedTrain: TrainPosition | null; 
    selectedStation: Stop | null; 
}> = ({ selectedTrain, selectedStation }) => {
    const map = useMap();
    
    useEffect(() => {
        if (selectedTrain) {
            map.flyTo([selectedTrain.lat, selectedTrain.lng], 10, {
                animate: true,
                duration: 1.5
            });
        }
    }, [selectedTrain, map]);

    useEffect(() => {
        if (selectedStation) {
            map.flyTo([selectedStation.stop_lat, selectedStation.stop_lon], 13, {
                animate: true,
                duration: 1.5
            });
        }
    }, [selectedStation, map]);

    return null;
}

export const TrainMap: React.FC<TrainMapProps> = ({ 
    positions, 
    stops, 
    selectedTrain, 
    selectedStation, 
    onSelectTrain,
    onSelectStation
}) => {
    return (
        <MapContainer 
            center={[40.4168, -3.7038]} // Madrid
            zoom={6} 
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            {/* Render Stops */}
            {stops.map(stop => {
                const isSelected = selectedStation?.stop_id === stop.stop_id;
                // Only render all stops if zoomed in, or if it's the selected one
                // Optimization: In a real app with thousands of stops, we'd use clustering or conditional rendering.
                // For Renfe AV/LD (limited stops), rendering all is usually fine.
                return (
                    <Marker 
                        key={stop.stop_id} 
                        position={[stop.stop_lat, stop.stop_lon]} 
                        icon={createStationIcon(isSelected)}
                        eventHandlers={{
                            click: () => onSelectStation(stop)
                        }}
                        zIndexOffset={isSelected ? 1000 : 0}
                    >
                        <Popup>{stop.stop_name}</Popup>
                    </Marker>
                );
            })}

            {/* Render Trains */}
            {positions.map(train => {
                const color = train.route?.route_color ? `#${train.route.route_color}` : '#7c3aed'; // Default purple
                const isSelected = selectedTrain?.trip_id === train.trip_id;
                
                // Don't render scheduled (non-moving) trains on the map unless they are selected
                if (train.status === 'SCHEDULED' && !isSelected) return null;
                if (train.status === 'ENDED' && !isSelected) return null;

                return (
                    <Marker
                        key={train.trip_id}
                        position={[train.lat, train.lng]}
                        icon={createTrainIcon(color, train.bearing, isSelected)}
                        eventHandlers={{
                            click: () => onSelectTrain(train)
                        }}
                        zIndexOffset={isSelected ? 1000 : 100}
                    >
                        <Popup>
                            <div className="font-sans">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-lg">{train.route?.route_short_name || 'Train'}</span>
                                    {train.status === 'SCHEDULED' && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200">SCHEDULED</span>}
                                </div>
                                <p className="text-sm text-gray-600">{train.trip?.trip_headsign}</p>
                            </div>
                        </Popup>
                    </Marker>
                )
            })}
            
            <MapController selectedTrain={selectedTrain} selectedStation={selectedStation} />
        </MapContainer>
    );
};