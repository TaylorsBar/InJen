
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Map, { Source, Layer, Marker, MapRef } from 'react-map-gl';
import type { FeatureCollection } from 'geojson';
import { TelemetryStateObject } from '../types';
import { MPS_PER_MPH } from '../constants';
import { FollowIcon, FlagIcon, CompassIcon, NavigationIcon } from './icons';
import { MAPBOX_ACCESS_TOKEN } from '../config';

type Position = { lat: number; long: number };
interface RaceMapProps {
  data: TelemetryStateObject[];
  currentPosition?: Position;
  className?: string;
  showControls?: boolean;
  onSetStartFinish?: () => void;
  startFinishLine?: { p1: Position, p2: Position } | null;
}

type MapStyle = 'telemetry' | 'street' | 'satellite';
type ViewMode = 'free' | 'follow' | 'cockpit';

const styleConfig: Record<MapStyle, { bg: string; name: string; textColor: string; roadColor?: string; gridColor: string, mapboxStyle?: string }> = {
    telemetry: { bg: 'bg-slate-800/50', name: 'Telemetry', textColor: 'text-gray-500', gridColor: 'rgba(56, 189, 248, 0.1)' },
    street: { bg: 'bg-slate-300', name: 'Street', textColor: 'text-slate-600', roadColor: '#a1a1aa', gridColor: 'rgba(0, 0, 0, 0.1)', mapboxStyle: 'mapbox://styles/mapbox/dark-v11'},
    satellite: { bg: 'bg-emerald-900', name: 'Satellite', textColor: 'text-emerald-300', gridColor: 'rgba(255, 255, 255, 0.1)', mapboxStyle: 'mapbox://styles/mapbox/satellite-streets-v12'},
};

// --- Sub-components for clarity ---

const SvgMap: React.FC<Omit<RaceMapProps, 'className' | 'onSetStartFinish'> & { heading?: number }> = ({ data, currentPosition, showControls, startFinishLine, heading = 0 }) => {
    const [selectedPoint, setSelectedPoint] = useState<TelemetryStateObject | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
  
    const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || !data.every(d => d.acceleration_g)) return;

        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        
        let closestPoint: TelemetryStateObject | null = null;
        let minDistance = Infinity;

        data.forEach(p => {
            const dx = p.position.long - cursorpt.x;
            const dy = -p.position.lat - cursorpt.y;
            const distance = dx * dx + dy * dy;
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = p;
            }
        });

        const clickThreshold = (svg.viewBox.baseVal.width / 100) ** 2;
        if (closestPoint && minDistance < clickThreshold) {
            setSelectedPoint(closestPoint);
            const clientRect = svg.getBoundingClientRect();
            setTooltipPosition({ x: e.clientX - clientRect.left, y: e.clientY - clientRect.top });
        } else {
            setSelectedPoint(null);
        }
    };

    const points = data.length > 0 ? data.map(d => d.position) : (startFinishLine ? [startFinishLine.p1, startFinishLine.p2] : []);
    if (points.length === 0) return null;

    const lats = points.map(p => p.lat);
    const longs = points.map(p => p.long);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLong = Math.min(...longs), maxLong = Math.max(...longs);
    const latRange = maxLat - minLat, longRange = maxLong - minLong;
    const maxRange = Math.max(latRange, longRange);
    const padding = maxRange > 0 ? maxRange * 0.1 : 0.0002;
    
    // Auto-center (simplified for SVG)
    const centerLat = (minLat + maxLat) / 2;
    const centerLong = (minLong + maxLong) / 2;
    
    const zoomLevel = padding + maxRange;
    
    const viewBox = {
        x: centerLong - zoomLevel / 2,
        y: -(centerLat + zoomLevel / 2),
        width: zoomLevel,
        height: zoomLevel,
    };

    const maxSpeed = Math.max(...data.map(p => p.speed_mps || 0));
    const polylinePoints = data.map(p => `${p.position.long},${-p.position.lat}`).join(' ');
    const selectedCoords = selectedPoint ? { x: selectedPoint.position.long, y: -selectedPoint.position.lat } : null;
    const hasLaps = data.some(d => (d as any).lapNumber);
    const lapColors = ['#f97316', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#eab308'];

    const getSpeedColor = (speed: number) => {
        if (maxSpeed === 0) return 'hsl(120, 100%, 50%)';
        const percentage = Math.min(speed / maxSpeed, 1);
        const hue = 120 * (1 - percentage); // Hue from green (120) to red (0)
        return `hsl(${hue}, 100%, 50%)`;
    };

    return (
        <div className="w-full h-full relative">
            <svg ref={svgRef} onClick={handleMapClick} className="w-full h-full cursor-pointer" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <pattern id="grid" width={viewBox.width / 20} height={viewBox.width / 20} patternUnits="userSpaceOnUse">
                        <path d={`M ${viewBox.width / 20} 0 L 0 0 0 ${viewBox.width / 20}`} fill="none" stroke={styleConfig.telemetry.gridColor} strokeWidth="0.5"/>
                    </pattern>
                    <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        {data.map((p, i) => <stop key={i} offset={`${data.length > 1 ? (i / (data.length - 1)) * 100 : 0}%`} stopColor={getSpeedColor(p.speed_mps || 0)} />)}
                    </linearGradient>
                </defs>
                
                <rect width="100%" height="100%" x={viewBox.x} y={viewBox.y} fill="url(#grid)" />
                <polyline points={polylinePoints} fill="none" stroke="transparent" strokeWidth={viewBox.width / 50} />

                {!hasLaps && <polyline points={polylinePoints} fill="none" stroke="url(#pathGradient)" strokeWidth={viewBox.width / 200} strokeLinecap="round" strokeLinejoin="round" />}
                {hasLaps && data.map((p, i) => {
                    if (i === 0) return null;
                    const prev = data[i - 1];
                    const lapNumber = (p as any).lapNumber || 1;
                    return <line key={i} x1={prev.position.long} y1={-prev.position.lat} x2={p.position.long} y2={-p.position.lat} stroke={lapColors[(lapNumber - 1) % lapColors.length]} strokeWidth={viewBox.width / 200} strokeLinecap="round" />
                })}

                {startFinishLine && <line x1={startFinishLine.p1.long} y1={-startFinishLine.p1.lat} x2={startFinishLine.p2.long} y2={-startFinishLine.p2.lat} stroke="white" strokeDasharray="4, 4" strokeWidth={viewBox.width / 250} />}
                
                {selectedCoords && <circle cx={selectedCoords.x} cy={selectedCoords.y} r={viewBox.width / 150} fill="white" />}

                {currentPosition && (
                    <g transform={`translate(${currentPosition.long}, ${-currentPosition.lat}) rotate(${heading - 90})`}>
                       {/* Arrow Marker */}
                       <path d={`M ${-viewBox.width/150} ${-viewBox.width/150} L ${viewBox.width/80} 0 L ${-viewBox.width/150} ${viewBox.width/150} Z`} fill="#22d3ee" stroke="#111827" strokeWidth={viewBox.width / 500} />
                    </g>
                )}
            </svg>
            {selectedPoint && (
                <div className="absolute p-2 bg-slate-900/80 backdrop-blur-sm rounded-md text-xs text-white border border-cyan-500/50 pointer-events-none" style={{ left: tooltipPosition.x, top: tooltipPosition.y, transform: 'translate(10px, -100%)' }}>
                    <div><span className="font-bold text-cyan-400">Speed:</span> {(selectedPoint.speed_mps / MPS_PER_MPH).toFixed(1)} MPH</div>
                    <div><span className="font-bold text-cyan-400">Gear:</span> {selectedPoint.inferred_gear}</div>
                    <div><span className="font-bold text-cyan-400">G-Force:</span> {selectedPoint.acceleration_g.longitudinal.toFixed(2)} long, {selectedPoint.acceleration_g.lateral.toFixed(2)} lat</div>
                </div>
            )}
        </div>
    );
};

const MapboxMap: React.FC<Omit<RaceMapProps, 'className' | 'onSetStartFinish'> & { mapStyleId: string, viewMode: ViewMode, setViewMode: (m: ViewMode) => void, heading: number, accessToken: string }> = ({ data, currentPosition, startFinishLine, mapStyleId, viewMode, setViewMode, heading, accessToken }) => {
    const mapRef = useRef<MapRef>(null);
    const [viewState, setViewState] = useState({ 
        latitude: currentPosition?.lat || 0, 
        longitude: currentPosition?.long || 0, 
        zoom: 16,
        bearing: 0,
        pitch: 0
    });

    const pathGeoJson: FeatureCollection = useMemo(() => ({
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: data.map(p => [p.position.long, p.position.lat]) },
            properties: {}
        }]
    }), [data]);

    const startFinishGeoJson: FeatureCollection | null = useMemo(() => {
        if (!startFinishLine) return null;
        return {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [[startFinishLine.p1.long, startFinishLine.p1.lat], [startFinishLine.p2.long, startFinishLine.p2.lat]] },
                properties: {}
            }]
        };
    }, [startFinishLine]);

    useEffect(() => {
        if (viewMode !== 'free' && currentPosition) {
            setViewState(v => ({
                ...v, 
                latitude: currentPosition.lat, 
                longitude: currentPosition.long,
                bearing: viewMode === 'cockpit' ? heading : 0,
                pitch: viewMode === 'cockpit' ? 60 : 0,
                zoom: viewMode === 'cockpit' ? 17 : 16,
                transitionDuration: 300 
            }));
        }
    }, [viewMode, currentPosition, heading]);

    // Initial bounds fit
    useEffect(() => {
        if (mapRef.current && data.length > 5 && viewMode === 'free') {
            const lats = data.map(p => p.position.lat);
            const longs = data.map(p => p.position.long);
            const bounds: [number, number, number, number] = [Math.min(...longs), Math.min(...lats), Math.max(...longs), Math.max(...lats)];
            try {
                mapRef.current.fitBounds(bounds, { padding: 40, duration: 1000 });
            } catch(e) { /* ignore initial fit error */ }
        }
    }, [data.length, viewMode]);


    return (
        <div className="w-full h-full relative group" onPointerDown={() => setViewMode('free')}>
            <Map
                ref={mapRef}
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapboxAccessToken={accessToken}
                mapStyle={mapStyleId}
                pitchWithRotate={true}
                dragRotate={true}
                attributionControl={false}
            >
                {/* Glow Layer */}
                <Source id="path" type="geojson" data={pathGeoJson}>
                    <Layer
                        id="path-glow"
                        type="line"
                        paint={{ 'line-color': '#00E5FF', 'line-width': 8, 'line-opacity': 0.4, 'line-blur': 4 }}
                        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                    />
                    <Layer
                        id="path-core"
                        type="line"
                        paint={{ 'line-color': '#ffffff', 'line-width': 3 }}
                        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                    />
                </Source>
                
                {startFinishGeoJson && (
                    <Source id="start-finish" type="geojson" data={startFinishGeoJson}>
                        <Layer
                            id="start-finish-layer"
                            type="line"
                            paint={{ 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [2, 2] }}
                        />
                    </Source>
                )}

                {/* Start/Finish Markers */}
                {startFinishLine && (
                    <>
                        <Marker longitude={startFinishLine.p1.long} latitude={startFinishLine.p1.lat} anchor="center">
                            <FlagIcon className="w-5 h-5 text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </Marker>
                        <Marker longitude={startFinishLine.p2.long} latitude={startFinishLine.p2.lat} anchor="center">
                            <FlagIcon className="w-5 h-5 text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </Marker>
                    </>
                )}
                
                {currentPosition && (
                    <Marker longitude={currentPosition.long} latitude={currentPosition.lat} anchor="center">
                        <div style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.1s linear' }}>
                            <NavigationIcon className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]" style={{ filter: 'drop-shadow(0 0 8px cyan)' }} />
                        </div>
                    </Marker>
                )}
            </Map>
            
            {/* View Mode Controls - Visible on Hover */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                    onClick={(e) => { e.stopPropagation(); setViewMode('follow'); }} 
                    className={`p-1.5 rounded transition-all shadow-lg backdrop-blur-sm ${viewMode === 'follow' ? 'bg-cyan-500 text-black' : 'bg-black/60 text-gray-400 hover:text-white'}`}
                    title="North Up"
                >
                    <CompassIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setViewMode('cockpit'); }} 
                    className={`p-1.5 rounded transition-all shadow-lg backdrop-blur-sm ${viewMode === 'cockpit' ? 'bg-cyan-500 text-black' : 'bg-black/60 text-gray-400 hover:text-white'}`}
                    title="Cockpit View"
                >
                    <NavigationIcon className="w-5 h-5" />
                </button>
                {viewMode === 'free' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewMode('follow'); }}
                        className="mt-1 bg-red-500/80 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg backdrop-blur-sm animate-in fade-in"
                    >
                        RECENTER
                    </button>
                )}
            </div>
        </div>
    );
}

// --- Main Component ---

export const RaceMap: React.FC<RaceMapProps> = ({ data, currentPosition, className = '', showControls = false, onSetStartFinish, startFinishLine }) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>('street'); // Default to street for better visibility in cockpit
    const [viewMode, setViewMode] = useState<ViewMode>('follow');
    const [token, setToken] = useState(MAPBOX_ACCESS_TOKEN);

    useEffect(() => {
        const stored = localStorage.getItem('mapbox_token');
        if (stored) setToken(stored);
    }, []);

    const isMapboxEnabled = useMemo(() => token && token !== 'YOUR_MAPBOX_ACCESS_TOKEN', [token]);
    
    // Derived Heading
    const heading = data.length > 0 ? data[data.length - 1].heading : 0;

    if (data.length < 2 && !startFinishLine) {
        const selectedStyle = styleConfig[mapStyle];
        return (
            <div className={`flex items-center justify-center w-full h-full rounded-lg ${selectedStyle.bg} ${className}`}>
                <p className={`${selectedStyle.textColor} text-sm font-orbitron opacity-70`}>Awaiting telemetry...</p>
            </div>
        );
    }
  
    const selectedStyle = styleConfig[mapStyle];

    return (
        <div className={`relative w-full h-full rounded-lg overflow-hidden ${selectedStyle.bg} ${className} group`}>
            
            {/* Style Switcher & Actions */}
            <div className="absolute top-2 right-2 z-10 bg-slate-900/50 backdrop-blur-sm p-1 rounded-md flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {showControls && (
                    <button
                        onClick={onSetStartFinish}
                        className="p-1.5 rounded transition-colors bg-slate-700 text-gray-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Set Start/Finish Line"
                        title="Set Start/Finish Line"
                        disabled={!currentPosition || !data.length}
                    >
                        <FlagIcon className="w-4 h-4" />
                    </button>
                )}
                {(Object.keys(styleConfig) as MapStyle[]).map((style) => (
                    <button
                        key={style}
                        onClick={() => setMapStyle(style)}
                        disabled={style !== 'telemetry' && !isMapboxEnabled}
                        title={style !== 'telemetry' && !isMapboxEnabled ? "Mapbox API key required" : ""}
                        className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${mapStyle === style ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {styleConfig[style].name}
                    </button>
                ))}
            </div>
            
            {mapStyle === 'telemetry' ? (
                <SvgMap data={data} currentPosition={currentPosition} showControls={showControls} startFinishLine={startFinishLine} heading={heading} />
            ) : (
                isMapboxEnabled && <MapboxMap 
                    data={data} 
                    currentPosition={currentPosition} 
                    startFinishLine={startFinishLine} 
                    mapStyleId={selectedStyle.mapboxStyle!} 
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    heading={heading}
                    accessToken={token}
                />
            )}
        </div>
    );
};
