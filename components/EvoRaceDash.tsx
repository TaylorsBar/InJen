
import React, { useRef, useEffect } from 'react';
import { TelemetryStateObject, FusionTier } from '../types';
import { MAX_RPM, SHIFT_RPM } from '../constants';

interface EvoRaceDashProps {
  telemetryData: TelemetryStateObject;
}

export const EvoRaceDash: React.FC<EvoRaceDashProps> = ({ telemetryData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // --- Drawing Logic ---
    ctx.clearRect(0, 0, width, height);

    // 1. Background Grid (Subtle)
    ctx.strokeStyle = '#121212';
    ctx.lineWidth = 1;
    const gridSize = 40;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();

    // 2. Central Tach Arc
    const radius = Math.min(width, height) * 0.35;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const maxAngle = endAngle - startAngle;
    
    // Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#1E1E1E';
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Active RPM Arc
    const rpmRatio = Math.min(telemetryData.rpm / MAX_RPM, 1);
    const activeEndAngle = startAngle + (maxAngle * rpmRatio);
    
    let arcColor = '#00E5FF'; // Cyan
    if (telemetryData.rpm > SHIFT_RPM) arcColor = '#FF2A2A'; // Red alert
    else if (telemetryData.rpm > SHIFT_RPM * 0.85) arcColor = '#CCA43B'; // Gold warning

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, activeEndAngle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = arcColor;
    ctx.shadowBlur = 20;
    ctx.shadowColor = arcColor;
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // 3. Drift "Ghost Ring" (Outer Arc based on Lateral G)
    // Simulating Sideslip visualization: Lateral G expands a ring
    const latG = Math.abs(telemetryData.acceleration_g.lateral);
    const driftRatio = Math.min(latG / 1.5, 1); // Max out at 1.5G
    if (driftRatio > 0.1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 25, startAngle, startAngle + (maxAngle * driftRatio));
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#CCA43B'; // Gold
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        
        // Label
        ctx.fillStyle = '#CCA43B';
        ctx.font = '10px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('SLIP', centerX, centerY - radius - 35);
    }

    // 4. Center Text (RPM & Gear)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // RPM
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px Orbitron';
    ctx.fillText(Math.floor(telemetryData.rpm).toString(), centerX, centerY - 10);
    
    ctx.fillStyle = '#888888';
    ctx.font = '14px Orbitron';
    ctx.fillText('RPM', centerX, centerY + 30);

    // Gear (Bottom Center)
    ctx.fillStyle = '#00E5FF';
    ctx.font = 'bold 40px Orbitron';
    ctx.fillText(telemetryData.inferred_gear.toString(), centerX, centerY + 80);
    
    // Branding
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Orbitron';
    ctx.fillText('CARTELWORX', centerX, centerY - radius + 40);
    
    // AI Status Icon
    ctx.fillStyle = telemetryData.fusionTier === FusionTier.TIER_1_FULL_FIDELITY ? '#00E5FF' : '#CCA43B';
    ctx.beginPath();
    ctx.arc(centerX, centerY - radius + 20, 4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Contextual Widgets (Corners)
    const drawWidget = (label: string, value: string, x: number, y: number, align: 'left' | 'right') => {
        ctx.textAlign = align;
        ctx.fillStyle = '#888888';
        ctx.font = '10px Orbitron';
        ctx.fillText(label, x, y);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Orbitron';
        ctx.fillText(value, x, y + 25);
    };

    const marginX = width * 0.1;
    const marginY = height * 0.4;

    // Left Side
    const driftScore = (Math.abs(telemetryData.acceleration_g.lateral) * (telemetryData.speed_mps)).toFixed(0);
    drawWidget('NEURAL CONF', `${(100 - telemetryData.uncertainty_m).toFixed(0)}%`, marginX, centerY - 50, 'left');
    drawWidget('DRIFT SCORE', driftScore, marginX, centerY + 50, 'left');

    // Right Side
    // Simulated Tire Temp (Base + load factor)
    const tireTemp = (80 + (telemetryData.tire_loads.fl * 20)).toFixed(0); 
    // Simulated Boost (Vacuum to Boost based on throttle/RPM)
    const boost = telemetryData.obd_info?.throttle_pos ? ((telemetryData.obd_info.throttle_pos / 100) * 1.5 - 0.5).toFixed(1) : '-0.5';
    
    drawWidget('TIRE TEMP', `${tireTemp}°C`, width - marginX, centerY - 50, 'right');
    drawWidget('BOOST', `${boost} Bar`, width - marginX, centerY + 50, 'right');

  }, [telemetryData]);

  return <canvas ref={canvasRef} className="w-full h-full bg-[#050505] rounded-lg shadow-inner shadow-black" />;
};
