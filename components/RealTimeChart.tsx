
import React, { useEffect, useRef, memo } from 'react';
import { TelemetryCharts } from '../lib/TelemetryCharts';
import { TelemetryStateObject } from '../types';

interface RealTimeChartProps {
  dataHistory: TelemetryStateObject[];
  metrics: { key: string; name: string; color: string; path: (d: TelemetryStateObject) => number, yaxis?: string }[];
  title: string;
}

const CHART_ID_PREFIX = 'real-time-chart-';

// Using memo to prevent re-renders if props haven't changed.
export const RealTimeChart: React.FC<RealTimeChartProps> = memo(({ dataHistory, metrics, title }) => {
  const chartManagerRef = useRef<TelemetryCharts | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // Create a unique ID for each chart instance to avoid conflicts if multiple charts are on the page.
  const chartId = useRef(`${CHART_ID_PREFIX}${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    if (chartContainerRef.current) {
      chartManagerRef.current = new TelemetryCharts({ realTime: false });
      
      const plotlyMetrics = metrics.map(m => ({
        key: m.key,
        name: m.name,
        color: m.color,
        yaxis: m.yaxis,
      }));

      chartManagerRef.current.createRealTimeChart(chartId, plotlyMetrics, {
        title: {
          text: title,
          font: {
            size: 12,
            color: '#9ca3af'
          },
          y: 0.98
        },
        layout: {
            margin: { t: 25, b: 30, l: 45, r: 20 },
            height: 150, // Adjusted height
            showlegend: true,
            legend: { x: 0.05, y: 1.2, orientation: 'h', bgcolor: 'transparent' },
        }
      });
    }

    return () => {
      chartManagerRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    if (chartManagerRef.current && (dataHistory.length > 0 || chartContainerRef.current?.querySelector('.plot-container'))) {
      chartManagerRef.current.updateRealTimeChartData(chartId, dataHistory, metrics);
    }
  }, [dataHistory, metrics, chartId]);

  return <div id={chartId} ref={chartContainerRef} className="w-full h-[150px] glass-pane rounded-lg" />;
});