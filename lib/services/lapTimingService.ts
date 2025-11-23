
import { LapData, TelemetryStateObject, LapSummary } from '../types';

type Position = { lat: number; long: number };

export class LapTimingService {
  private startFinishLine: { p1: Position, p2: Position } | null = null;
  private previousPosition: Position | null = null;
  private onLapComplete: (lapSummary: LapSummary) => void;

  private lapData: LapData = {
    lap: 0,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
  };
  private currentLapStartTime: number | null = null;

  constructor(onLapComplete: (lapSummary: LapSummary) => void) {
    this.onLapComplete = onLapComplete;
  }
  
  public setStartFinishLine(point: Position, heading: number) {
    const lineLength = 0.0001; // Approx 10 meters
    const angleRad = heading * (Math.PI / 180);
    // Create a line perpendicular to the current heading
    const p1 = {
        lat: point.lat + (lineLength / 2) * Math.cos(angleRad + Math.PI / 2),
        long: point.long + (lineLength / 2) * Math.sin(angleRad + Math.PI / 2)
    };
    const p2 = {
        lat: point.lat - (lineLength / 2) * Math.cos(angleRad + Math.PI / 2),
        long: point.long - (lineLength / 2) * Math.sin(angleRad + Math.PI / 2)
    };
    this.startFinishLine = { p1, p2 };
    this.startLap(Date.now());
  }

  public updatePosition(telemetry: TelemetryStateObject): LapData {
    const { position, timestamp } = telemetry;
    if (!this.startFinishLine || !this.currentLapStartTime) {
      this.previousPosition = position;
      return this.lapData;
    }
    
    if (this.previousPosition) {
        // Line intersection check
        const p3 = this.previousPosition;
        const p4 = position;
        
        if (this.intersects(this.startFinishLine.p1, this.startFinishLine.p2, p3, p4)) {
          this.completeLap(timestamp);
        }
    }
    
    this.lapData.currentLapTime = timestamp - this.currentLapStartTime;
    this.previousPosition = position;
    return {...this.lapData};
  }
  
  private startLap(timestamp: number) {
    this.lapData.lap = 1;
    this.lapData.currentLapTime = 0;
    this.currentLapStartTime = timestamp;
  }

  private completeLap(timestamp: number) {
    const lapTime = timestamp - this.currentLapStartTime!;
    
    // Ignore unrealistically short laps (e.g., < 5 seconds) to prevent false triggers on start
    if (lapTime < 5000) return;
    
    this.onLapComplete({ lapNumber: this.lapData.lap, time: lapTime });

    this.lapData.lap += 1;
    this.lapData.lastLapTime = lapTime;
    
    if (this.lapData.bestLapTime === null || lapTime < this.lapData.bestLapTime) {
      this.lapData.bestLapTime = lapTime;
    }
    
    this.currentLapStartTime = timestamp;
    this.lapData.currentLapTime = 0;
  }
  
  public getLapData(): LapData {
      return this.lapData;
  }
  
  public getStartFinishLine() {
      return this.startFinishLine;
  }

  public reset() {
    this.startFinishLine = null;
    this.previousPosition = null;
    this.currentLapStartTime = null;
    this.lapData = {
      lap: 0,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
    };
  }

  // Check if line segment p1-p2 intersects with p3-p4
  private intersects(p1: Position, p2: Position, p3: Position, p4: Position): boolean {
    const det = (p2.long - p1.long) * (p4.lat - p3.lat) - (p2.lat - p1.lat) * (p4.long - p3.long);
    if (det === 0) return false;
    const lambda = ((p4.lat - p3.lat) * (p4.long - p1.long) + (p3.long - p4.long) * (p4.lat - p1.lat)) / det;
    const gamma = ((p1.lat - p2.lat) * (p4.long - p1.long) + (p2.long - p1.long) * (p4.lat - p1.lat)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
}
