
import { TelemetryStateObject } from '../types';
import { getRealtimeCoachingTip } from './geminiService';
import { speak } from './ttsService';
import { MPS_PER_MPH } from '../constants';

interface CoachState {
  isEnabled: boolean;
  isSpeaking: boolean;
}

interface RealtimeCoachingServiceOptions {
  onStateChange: (state: CoachState) => void;
}

const TICK_RATE = 20; // 20 Hz

export class RealtimeCoachingService {
  private telemetryBuffer: TelemetryStateObject[] = [];
  private readonly BUFFER_SECONDS = 3;
  private isEnabled = false;
  private isAnalyzing = false;
  private isSpeaking = false;
  private cooldownUntil = 0;
  private readonly COOLDOWN_MS = 15000;
  private onStateChange: (state: CoachState) => void;

  constructor(options: RealtimeCoachingServiceOptions) {
    this.onStateChange = options.onStateChange;
  }

  public start() {
    console.log("Real-time coach started.");
    this.isEnabled = true;
    this.telemetryBuffer = [];
    this.updateState();
  }

  public stop() {
    console.log("Real-time coach stopped.");
    this.isEnabled = false;
    this.updateState();
  }

  public analyze(data: TelemetryStateObject) {
    if (!this.isEnabled || this.isAnalyzing || Date.now() < this.cooldownUntil) {
      return;
    }

    this.telemetryBuffer.push(data);
    if (this.telemetryBuffer.length > this.BUFFER_SECONDS * TICK_RATE) {
      this.telemetryBuffer.shift();
    }

    const cornerExitEvent = this.detectCornerExit();
    if (cornerExitEvent) {
      this.triggerCoaching(cornerExitEvent.snapshot, cornerExitEvent.apex);
    }
  }

  private detectCornerExit(): { snapshot: TelemetryStateObject[], apex: { speed_mph: number, lat_g: number } } | null {
    if (this.telemetryBuffer.length < 2 * TICK_RATE) return null; // Need at least 2s of data

    const latestPoint = this.telemetryBuffer[this.telemetryBuffer.length - 1];
    const historicalPoints = this.telemetryBuffer.slice(0, -10); // Look for apex in the history

    let apexIndex = -1;
    let maxLatG = 0;
    
    historicalPoints.forEach((p, i) => {
        const latG = Math.abs(p.acceleration_g.lateral);
        if (latG > maxLatG) {
            maxLatG = latG;
            apexIndex = i;
        }
    });
    
    // A cornering event is significant if lateral G > 0.4
    if (maxLatG < 0.4) return null;

    const apexPoint = this.telemetryBuffer[apexIndex];
    
    // Check if we are now exiting the corner
    const isExiting = Math.abs(latestPoint.acceleration_g.lateral) < maxLatG * 0.6;
    const isAccelerating = latestPoint.acceleration_g.longitudinal > 0.1;

    if (isExiting && isAccelerating) {
        // We found a corner exit, clear the buffer and trigger analysis
        const snapshot = this.telemetryBuffer.slice();
        const apexInfo = {
            speed_mph: apexPoint.speed_mps / MPS_PER_MPH,
            lat_g: apexPoint.acceleration_g.lateral
        };
        this.telemetryBuffer = []; // Clear buffer to prevent re-triggering for the same corner
        return { snapshot, apex: apexInfo };
    }

    return null;
  }

  private async triggerCoaching(
    snapshot: TelemetryStateObject[],
    apex: { speed_mph: number, lat_g: number }
  ) {
    this.isAnalyzing = true;
    try {
      const tip = await getRealtimeCoachingTip(snapshot, apex);
      if (tip) {
        this.isSpeaking = true;
        this.updateState();
        await speak(tip);
        this.isSpeaking = false;
        this.updateState();
      }
    } catch (e) {
      console.error("Real-time coaching error:", e);
    } finally {
      this.isAnalyzing = false;
      this.cooldownUntil = Date.now() + this.COOLDOWN_MS;
    }
  }
  
  private updateState() {
      this.onStateChange({
          isEnabled: this.isEnabled,
          isSpeaking: this.isSpeaking
      });
  }
}
