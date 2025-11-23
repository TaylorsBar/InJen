import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Map, { Source, Layer, Marker, MapRef } from 'react-map-gl';
import type { FeatureCollection } from 'geojson';
import { TelemetryStateObject } from '../types';
import { MPS_PER_MPH } from '../constants';
import { FollowIcon, FlagIcon } from './icons';
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

const styleConfig: Record<MapStyle, { bg: string; name: string; textColor: string; roadColor?: string; gridColor: string, mapboxStyle?: string }> = {
    telemetry: { bg: 'bg-slate-800/50', name: 'Telemetry', textColor: 'text-gray-500', gridColor: 'rgba(56, 189, 248, 0.1)' },
    street: { bg: 'bg-slate-300', name: 'Street', textColor: 'text-slate-600', roadColor: '#a1a1aa', gridColor: 'rgba(0, 0, 0, 0.1)', mapboxStyle: 'mapbox://styles/mapbox/streets-v12'},
    satellite: { bg: 'bg-emerald-900', name: 'Satellite', textColor: 'text-emerald-300', gridColor: 'rgba(255, 255, 255, 0.1)', mapboxStyle: 'mapbox://styles/mapbox/satellite-streets-v12'},
};

// --- Sub-components for clarity ---

const SvgMap: React.FC<Omit<RaceMapProps, 'className' | 'onSetStartFinish'>> = ({ data, currentPosition, showControls, startFinishLine }) => {
    const [isFollowing, setIsFollowing] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState<TelemetryStateObject | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);

    const handlePointerDown = () => setIsFollowing(false);
  
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
    
    let centerLat = (minLat + maxLat) / 2;
    let centerLong = (minLong + maxLong) / 2;
    
    if (isFollowing && currentPosition) {
        centerLat = currentPosition.lat;
        centerLong = currentPosition.long;
    }
    
    const zoomLevel = isFollowing ? (padding + maxRange) * 0.5 : padding + maxRange;
    
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
        <div className="w-full h-full relative" onPointerDown={handlePointerDown}>
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
                    <circle cx={currentPosition.long} cy={-currentPosition.lat} r={viewBox.width / 100} fill="#22d3ee" stroke="#111827" strokeWidth={viewBox.width / 300} style={{ filter: 'drop-shadow(0 0 3px #22d3ee)'}}>
                        <animate attributeName="r" values={`${viewBox.width / 100};${viewBox.width / 80};${viewBox.width / 100}`} dur="1.5s" repeatCount="indefinite" />
                    </circle>
                )}
            </svg>
            <div className="absolute top-2 right-2 z-10">
                {showControls && (
                    <button onClick={() => setIsFollowing(!isFollowing)} className={`p-1.5 rounded transition-colors ${isFollowing ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`} aria-label="Follow current position">
                        <FollowIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
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

const MapboxMap: React.FC<Omit<RaceMapProps, 'className' | 'onSetStartFinish'> & { mapStyleId: string, isFollowing: boolean, onFollowingChange: (isFollowing: boolean) => void }> = ({ data, currentPosition, startFinishLine, mapStyleId, isFollowing, onFollowingChange }) => {
    const mapRef = useRef<MapRef>(null);
    const [viewState, setViewState] = useState({ latitude: data[0]?.position.lat || 0, longitude: data[0]?.position.long || 0, zoom: 15 });

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
        if (isFollowing && currentPosition) {
            setViewState(v => ({...v, latitude: currentPosition.lat, longitude: currentPosition.long, transitionDuration: 100 }));
        }
    }, [isFollowing, currentPosition]);

    useEffect(() => {
        if (mapRef.current && data.length > 1 && !isFollowing) {
            const lats = data.map(p => p.position.lat);
            const longs = data.map(p => p.position.long);
            const bounds: [number, number, number, number] = [Math.min(...longs), Math.min(...lats), Math.max(...longs), Math.max(...lats)];
            mapRef.current.fitBounds(bounds, { padding: 40, duration: 1000 });
        }
    }, [data, isFollowing]);


    return (
        <div className="w-full h-full" onPointerDown={() => onFollowingChange(false)}>
            <Map
                ref={mapRef}
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
                mapStyle={mapStyleId}
            >
                <Source id="path" type="geojson" data={pathGeoJson}>
                    <Layer
                        id="path-layer"
                        type="line"
                        paint={{ 'line-color': '#0ea5e9', 'line-width': 3 }}
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
                {currentPosition && (
                    <Marker longitude={currentPosition.long} latitude={currentPosition.lat}>
                        <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-lg animate-pulse" />
                    </Marker>
                )}
            </Map>
        </div>
    );
}

// --- Main Component ---

export const RaceMap: React.FC<RaceMapProps> = ({ data, currentPosition, className = '', showControls = false, onSetStartFinish, startFinishLine }) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>('telemetry');
    const [isFollowing, setIsFollowing] = useState(true);

    const isMapboxEnabled = useMemo(() => MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN !== 'YOUR_MAPBOX_ACCESS_TOKEN', []);

    if (data.length < 2 && !startFinishLine) {
        const selectedStyle = styleConfig[mapStyle];
        return (
            <div className={`flex items-center justify-center w-full h-full rounded-lg ${selectedStyle.bg} ${className}`}>
                <p className={`${selectedStyle.textColor} text-sm`}>Awaiting path data...</p>
            </div>
        );
    }
  
    const selectedStyle = styleConfig[mapStyle];

    return (
        <div className={`relative w-full h-full rounded-lg overflow-hidden ${selectedStyle.bg} ${className}`}>
            <div className="absolute top-2 right-2 z-10 bg-slate-900/50 backdrop-blur-sm p-1 rounded-md flex items-center space-x-1">
                {showControls && (
                    <>
                        <button
                            onClick={onSetStartFinish}
                            className="p-1.5 rounded transition-colors bg-slate-700 text-gray-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Set Start/Finish Line"
                            title="Set Start/Finish Line"
                            disabled={!currentPosition || !data.length}
                        >
                            <FlagIcon className="w-4 h-4" />
                        </button>
                        {mapStyle !== 'telemetry' && (
                             <button
                                onClick={() => setIsFollowing(!isFollowing)}
                                className={`p-1.5 rounded transition-colors ${isFollowing ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
                                aria-label="Follow current position"
                             >
                                <FollowIcon className="w-4 h-4" />
                            </button>
                        )}
                    </>
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
                <SvgMap data={data} currentPosition={currentPosition} showControls={showControls} startFinishLine={startFinishLine} />
            ) : (
                isMapboxEnabled && <MapboxMap data={data} currentPosition={currentPosition} startFinishLine={startFinishLine} mapStyleId={selectedStyle.mapboxStyle!} isFollowing={isFollowing} onFollowingChange={setIsFollowing} showControls={showControls} />
            )}
        </div>
    );
};
