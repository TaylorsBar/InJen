
import React from 'react';

interface GaugeProps {
  value: number;
  maxValue: number;
  label: string;
  unit: string;
  accentColor: 'cyan' | 'red' | 'yellow';
}

const colorMap = {
  cyan: {
    text: 'text-cyan-300',
    track: 'stroke-cyan-500/20',
    progress: 'stroke-cyan-400',
    shadow: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]',
  },
  red: {
    text: 'text-red-400',
    track: 'stroke-red-500/20',
    progress: 'stroke-red-400',
    shadow: 'drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]',
  },
  yellow: {
    text: 'text-yellow-400',
    track: 'stroke-yellow-500/20',
    progress: 'stroke-yellow-400',
    shadow: 'drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]',
  },
};

export const Gauge: React.FC<GaugeProps> = ({ value, maxValue, label, unit, accentColor }) => {
  const size = 150;
  const strokeWidth = 10;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const offset = circumference - percentage * circumference;

  const colors = colorMap[accentColor];

  return (
    <div className={`relative flex items-center justify-center glass-pane p-1 rounded-lg aspect-square`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
            <linearGradient id="cyan-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
        </defs>
         <circle
          className="stroke-slate-700/50"
          strokeWidth={1}
          fill="transparent"
          r={center - 2}
          cx={center}
          cy={center}
        />
        <circle
          className={colors.track}
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={center}
          cy={center}
        />
        <circle
          className={`${colors.shadow} transition-all duration-300 ease-out`}
          stroke="url(#cyan-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={center}
          cy={center}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-xs tracking-widest uppercase ${colors.text}`}>{label}</span>
        <span className={`text-4xl font-bold font-orbitron ${colors.text}`}>
          {Math.round(value)}
        </span>
        <span className={`text-base ${colors.text}`}>{unit}</span>
      </div>
    </div>
  );
};
