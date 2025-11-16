/**
 * Telemetry Charts Module
 * Advanced data visualization for telemetry analysis using Plotly.js
 */

// Declare Plotly to inform TypeScript that it exists as a global variable.
declare const Plotly: any;

export class TelemetryCharts {
    private charts: { [key: string]: any } = {};

    constructor(options: { realTime?: boolean } = {}) {
        // Constructor is now much simpler.
        // realTime option is kept for conceptual compatibility but isn't used in the new logic.
    }

    createRealTimeChart(containerId: string, metrics: any[], options: any = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const traces = metrics.map((metric, index) => ({
            x: [], y: [], type: 'scatter', mode: 'lines', name: metric.name,
            line: { color: metric.color || this.getDefaultColor(index), width: 2 },
            yaxis: metric.yaxis || 'y'
        }));

        const layout = this.getDefaultLayout(options, metrics);
        const config = { responsive: true, displayModeBar: false };

        Plotly.newPlot(container, traces, layout, config);
        
        this.charts[containerId] = { container, metrics, options, traces, layout, config };
    }

    updateRealTimeChartData(containerId: string, dataHistory: any[], metrics: any[]) {
        const chart = this.charts[containerId];
        if (!chart || !document.getElementById(containerId)) return;

        const recentData = dataHistory.slice(-300); // approx 30 seconds at 10Hz
        
        const tracesUpdate = metrics.map((metric, index) => {
            return {
                ...chart.traces[index],
                x: recentData.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })),
                y: recentData.map(metric.path),
            };
        });

        Plotly.react(containerId, tracesUpdate, chart.layout, chart.config);
    }
    
    createGGDiagram(containerId: string, data: { lateralG: number, longitudinalG: number, speed: number }[] | null = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">No G-Force data available for this run.</div>`;
            return;
        }

        const trace = {
            x: data.map(d => d.lateralG), y: data.map(d => d.longitudinalG),
            mode: 'markers', type: 'scatter',
            marker: {
                size: 5, color: data.map(d => d.speed),
                colorscale: 'Cividis', showscale: true,
                colorbar: { title: 'Speed (MPH)', titleside: 'right', tickfont: { color: '#9ca3af' } }
            },
            name: 'G-Force Data'
        };
        const layout = {
            title: { text: 'G-G Diagram', font: { color: '#e5e7eb' } },
            xaxis: { title: 'Lateral G-Force', range: [-2, 2], gridcolor: '#475569', zerolinecolor: '#64748b', color: '#9ca3af' },
            yaxis: { title: 'Longitudinal G-Force', range: [-2, 2], gridcolor: '#475569', zerolinecolor: '#64748b', color: '#9ca3af' },
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#9ca3af' },
            margin: { t: 40, b: 40, l: 40, r: 20 }
        };
        Plotly.newPlot(container, [trace], layout, { responsive: true, displayModeBar: false });
        this.charts[containerId] = { type: 'gg-diagram', data: data };
    }

    private getDefaultLayout(options: any = {}, metrics: any[] = []) {
        const baseLayout: any = {
            title: options.title || '',
            xaxis: { title: options.xaxis?.title || 'Time', gridcolor: '#374151', color: '#9ca3af', autorange: true, ...options.xaxis },
            yaxis: { title: 'Value', gridcolor: '#374151', color: '#9ca3af', autorange: true, ...options.yaxis },
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#9ca3af' },
            legend: { x: 0, y: 1, bgcolor: 'rgba(0,0,0,0.5)', font: { color: '#9ca3af' } },
            margin: { t: 20, b: 40, l: 40, r: 20 },
            ...options.layout
        };

        // Find all unique y-axes used by metrics
        const yAxesIds = [...new Set(metrics.map(m => m.yaxis || 'y'))];
        let rightAxisCount = 0;

        yAxesIds.forEach(axisId => {
            const metricForAxis = metrics.find(m => (m.yaxis || 'y') === axisId);
            if (!metricForAxis) return;

            const axisConfig: any = {
                title: { text: metricForAxis.name, font: { color: metricForAxis.color } },
                autorange: true,
                tickfont: { color: metricForAxis.color },
            };
            
            if (axisId === 'y') {
                axisConfig.gridcolor = '#374151';
            } else {
                axisConfig.overlaying = 'y';
                axisConfig.side = 'right';
                axisConfig.showgrid = false;
                axisConfig.zeroline = false;
                rightAxisCount++;
            }
            
            baseLayout[axisId] = { ...(baseLayout[axisId] || {}), ...axisConfig };
        });

        if (rightAxisCount > 0) {
            baseLayout.margin.r = 45 + ((rightAxisCount -1) * 40);
        }

        return baseLayout;
    }

    private getDefaultColor(index: number) {
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];
        return colors[index % colors.length];
    }
    
    dispose() {
        Object.keys(this.charts).forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                try {
                    Plotly.purge(container);
                } catch(e) {
                    console.error(`Error purging plotly chart ${containerId}`, e);
                }
            }
        });
        this.charts = {};
    }
}