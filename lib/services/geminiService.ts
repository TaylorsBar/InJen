
import { GoogleGenAI } from "@google/genai";
import { RunSummary, TelemetryStateObject } from "../types";
import { MPS_PER_MPH } from '../constants';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // This is a fallback for development; in production, the key should be set.
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const formatTime = (timeMs: number): string => {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const milliseconds = Math.floor((timeMs % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

export async function getCoachingAdvice(runSummary: RunSummary): Promise<string> {
  if (!API_KEY) {
    return "AI coaching is disabled. Please configure your Gemini API key.";
  }
  
  const model = 'gemini-3-pro-preview';
  
  const { zeroToSixty, quarterMileTime, quarterMileSpeed, maxGForce, fullData, laps } = runSummary;

  // Downsample data for the prompt to fit context comfortably while keeping high fidelity
  const speedProfile = fullData.filter((_, i) => i % 5 === 0).slice(0, 100).map(d => (d.speed_mps / MPS_PER_MPH).toFixed(1)).join(', ');
  
  const lapSummary = laps.length > 0 
    ? `Lap Data (Total ${laps.length}):\n${laps.map(l => `- Lap ${l.lapNumber}: ${formatTime(l.time)}`).join('\n')}`
    : 'Session Type: Point-to-Point / Drag (No closed laps detected).';

  const prompt = `
    You are the 'Genesis' Chief Race Engineer. You are analyzing telemetry for a high-performance vehicle session.
    Your output must be a professional, commercial-grade "Session Debrief" suitable for a driver's post-run analysis.

    **Session Data:**
    - **Date:** ${new Date(runSummary.date).toLocaleString()}
    - **0-60 mph:** ${zeroToSixty ? `${zeroToSixty.toFixed(2)}s` : 'N/A'}
    - **1/4 Mile:** ${quarterMileTime ? `${quarterMileTime.toFixed(2)}s @ ${(quarterMileSpeed ? (quarterMileSpeed / MPS_PER_MPH).toFixed(1) : 0)} mph` : 'N/A'}
    - **Peak G-Force:** ${maxGForce.longitudinal.toFixed(2)}g Long / ${maxGForce.lateral.toFixed(2)}g Lat
    - **Launch Speed Profile (MPH):** [${speedProfile}]
    - **Laps:** 
    ${lapSummary}

    **Analysis Directives:**
    1.  **Launch & Acceleration:** Analyze the G-Force and 0-60 time. Identify if there was wheelspin (high G drop-off) or bogging.
    2.  **Cornering Performance:** Based on the peak lateral G (${maxGForce.lateral.toFixed(2)}g), evaluate the driver's commitment. (Reference: Street cars ~0.9g, Track cars >1.2g).
    3.  **Consistency:** If laps exist, analyze the variance between lap times. If point-to-point, analyze the smoothness of the speed trace.
    4.  **Actionable Feedback:** Provide 3 distinct, technical recommendations for the next run.

    **Format:**
    Return the response in a structured, professional format using Markdown headers (###).
    Start with an "Executive Summary".
    Use bullet points for the recommendations.
    Tone: Professional, Data-Driven, Encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 16384 } // Allocate thinking budget for deep analysis
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "## Analysis Unavailable\n\nUnable to generate the Race Engineer Report at this time. Please check your network connection.";
  }
}

export async function getRealtimeCoachingTip(
  telemetrySnapshot: TelemetryStateObject[],
  apexInfo: { speed_mph: number, lat_g: number }
): Promise<string> {
  if (!API_KEY) return "";

  const model = 'gemini-2.5-flash';

  const simplifiedSnapshot = telemetrySnapshot.map(d => ({
    speed_mph: +(d.speed_mps / MPS_PER_MPH).toFixed(1),
    long_g: +d.acceleration_g.longitudinal.toFixed(2),
    lat_g: +d.acceleration_g.lateral.toFixed(2),
  }));

  const prompt = `
    Role: Professional Racing Coach.
    Context: Driver just exited a corner.
    Data: 
    - Apex Speed: ${apexInfo.speed_mph} mph
    - Apex Lat G: ${apexInfo.lat_g}
    - Exit Telemetry (Last 2s): ${JSON.stringify(simplifiedSnapshot)}

    Task: Provide a SINGLE, short, spoken command (max 6 words) to improve the next corner.
    Examples: "Get on throttle earlier", "Brake later next time", "Smooth steering input", "Good exit speed".
    Output: Text string only. No punctuation.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: 20,
      }
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error calling Gemini API for real-time tip:", error);
    return "";
  }
}

export async function getGroundedResponse(question: string, position: { lat: number, long: number }): Promise<{ text: string, chunks: any[] }> {
  if (!API_KEY) {
    return {
      text: "Location-based search is disabled. Please configure your Gemini API key.",
      chunks: [],
    };
  }
  
  const model = 'gemini-2.5-flash';

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: question,
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: position.lat,
              longitude: position.long
            }
          }
        }
      },
    });

    const text = response.text;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, chunks };

  } catch (error) {
    console.error("Error calling Gemini API for grounded response:", error);
    return {
      text: "There was an error with your location-based search. Please try again later.",
      chunks: [],
    };
  }
}

// --- Diagnostic Agent ---

export async function diagnoseFaultCodes(dtcs: string[], vehicleContext: string = "Generic Performance Vehicle"): Promise<string> {
    if (!API_KEY) return "AI Diagnosis is disabled. Check API Key.";

    // Using Gemini 3 Pro for complex causal reasoning of mechanical faults
    const model = 'gemini-3-pro-preview'; 

    const prompt = `
      You are the 'Genesis' Master Diagnostic AI.
      Your Goal: Identify the root cause of vehicle faults using the provided DTCs and vehicle context.
      
      Input:
      - DTCs: ${JSON.stringify(dtcs)}
      - Vehicle Context: ${vehicleContext}
      
      Instructions:
      1. ANALYZE: Correlate the DTCs. Do they point to a single system (e.g., Intake, Ignition, Sensor Circuit)?
      2. EXPLAIN: Provide a clear, non-technical explanation of what the fault means.
      3. RECOMMEND: suggest the most likely fix or next diagnostic step.
      4. PARTS: If a specific part is likely failed (e.g. "O2 Sensor Bank 1"), mention it explicitly.
      
      Output Format:
      Provide the response in clean Markdown. Use bolding for key terms.
      Structure:
      ### 🛑 Diagnosis: [Short Summary]
      **Reasoning:** [Explanation]
      **Next Steps:** [Actionable steps]
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { 
                temperature: 0.4,
                thinkingConfig: { thinkingBudget: 16384 } 
            }
        });
        return response.text;
    } catch (e) {
        console.error("Diagnosis failed", e);
        return "Failed to generate diagnosis. Please try again.";
    }
}
