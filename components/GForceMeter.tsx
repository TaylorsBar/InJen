
import React, { useState, useEffect, memo } from 'react';
import { GForceData } from '../types';

interface GForceMeterProps {
  gForce: GForceData;
}

const MAX_G = 1.5;
const SIZE = 150; // Reduced size
const CENTER = SIZE / 2;
const PLOT_RADIUS = SIZE * 0.4;
const HISTORY_LENGTH = 15;

const GForceMeterComponent: React.FC<GForceMeterProps> = ({ gForce }) => {
  const [history, setHistory] = useState<GForceData[]>([]);

  useEffect(() => {
    setHistory(prev => [gForce, ...prev].slice(0, HISTORY_LENGTH));
  }, [gForce]);

  const mapGToCoords = (g: GForceData) => {
    const x = CENTER + (g.lateral / MAX_G) * PLOT_RADIUS;
    const y = CENTER - (g.longitudinal / MAX_G) * PLOT_RADIUS; // Y is inverted in SVG
    return { x, y };
  };

  const currentPos = mapGToCoords(gForce);

  return (
    <div className="relative flex items-center justify-center glass-pane p-1 rounded-lg aspect-square">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        {/* Grid and labels */}
        <circle cx={CENTER} cy={CENTER} r={PLOT_RADIUS * (0.5 / MAX_G)} stroke="#374151" strokeWidth="0.5" fill="none" />
        <circle cx={CENTER} cy={CENTER} r={PLOT_RADIUS * (1.0 / MAX_G)} stroke="#374151" strokeWidth="0.5" fill="none" />
        <circle cx={CENTER} cy={CENTER} r={PLOT_RADIUS * (1.5 / MAX_G)} stroke="#475569" strokeWidth="0.5" fill="none" />
        <line x1={CENTER} y1={CENTER - PLOT_RADIUS} x2={CENTER} y2={CENTER + PLOT_RADIUS} stroke="#374151" strokeWidth="0.5" />
        <line x1={CENTER - PLOT_RADIUS} y1={CENTER} x2={CENTER + PLOT_RADIUS} y2={CENTER} stroke="#374151" strokeWidth="0.5" />

        <text x={CENTER} y={CENTER - PLOT_RADIUS - 4} textAnchor="middle" fontSize="6" fill="#9ca3af">ACCEL</text>
        <text x={CENTER} y={CENTER + PLOT_RADIUS + 8} textAnchor="middle" fontSize="6" fill="#9ca3af">BRAKE</text>
        <text x={CENTER - PLOT_RADIUS - 4} y={CENTER + 2} textAnchor="end" fontSize="6" fill="#9ca3af">LEFT</text>
        <text x={CENTER + PLOT_RADIUS + 4} y={CENTER + 2} textAnchor="start" fontSize="6" fill="#9ca3af">RIGHT</text>

        {/* Trail */}
        {history.map((h, i) => {
          const { x, y } = mapGToCoords(h);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.5}
              fill="#22d3ee"
              opacity={0.5 * (1 - i / HISTORY_LENGTH)}
            />
          );
        })}

        {/* Current G-force dot */}
        <circle
          cx={currentPos.x}
          cy={currentPos.y}
          r={4}
          fill="#22d3ee"
          stroke="#0f172a"
          strokeWidth="1"
          style={{ filter: 'drop-shadow(0 0 2px #22d3ee)' }}
        />
      </svg>
    </div>
  );
};

export const GForceMeter = memo(GForceMeterComponent);