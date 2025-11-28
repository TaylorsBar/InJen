
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
  
  const model = 'gemini-2.5-pro';
  
  const { zeroToSixty, quarterMileTime, quarterMileSpeed, maxGForce, fullData, laps } = runSummary;

  const speedProfile = fullData.slice(0, 50).map(d => (d.speed_mps / MPS_PER_MPH).toFixed(1)).join(', ');
  
  const lapSummary = laps.length > 0 
    ? `Lap Data:\n${laps.map(l => `- Lap ${l.lapNumber}: ${formatTime(l.time)}`).join('\n')}`
    : 'This was a point-to-point run (no laps).';

  const prompt = `
You are an expert AI driving coach for performance car enthusiasts. Your tone is knowledgeable, concise, and encouraging.
Analyze the following performance run data and provide 2-3 actionable tips for improvement.
Focus on launch technique, shift efficiency, maintaining traction, and lap consistency if lap data is available.

Run Data:
- 0-60 mph time: ${zeroToSixty ? `${zeroToSixty.toFixed(2)} seconds` : 'N/A'}
- 1/4 mile time: ${quarterMileTime ? `${quarterMileTime.toFixed(2)} seconds` : 'N/A'}
- 1/4 mile trap speed: ${quarterMileSpeed ? `${(quarterMileSpeed / MPS_PER_MPH).toFixed(1)} mph` : 'N/A'}
- Max Longitudinal G-Force: ${maxGForce.longitudinal.toFixed(2)}g
- Initial Speed Profile (first ~2.5s in MPH): ${speedProfile}
- ${lapSummary}

Based on this data, provide specific, data-driven feedback.
- If lap times are inconsistent, comment on what could cause this (e.g., different braking points, inconsistent cornering lines).
- If it's a drag run (no laps), focus on the launch and acceleration curve.
- For example: "Your best lap was over a second faster than your others. This indicates you have the pace, but need to improve consistency. Looking at the map, on your fastest lap, you took a wider entry into the hairpin which allowed for a better exit speed. Try to replicate that line on every lap."
- Or for a drag run: "Your initial launch shows a rapid jump to ${speedProfile.split(',')[5] || 'X'} mph but then the acceleration curve flattens slightly. This, combined with a max G-force of ${maxGForce.longitudinal.toFixed(2)}g, suggests some wheelspin. Try modulating the throttle more gently in the first second to maximize grip."

Provide the feedback in plain text, without using markdown formatting like headers or lists.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "There was an error analyzing your run data. Please try again later.";
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
You are a world-class AI race driving coach providing real-time, ultra-low-latency feedback.
Your response MUST be a single, short, actionable phrase, no more than 8 words.
The user is actively driving. Be concise and clear. Do not use punctuation. Do not explain yourself.
Analyze this JSON data representing the last 2 seconds of telemetry from a cornering maneuver. The driver just exited the corner.

- telemetry_snapshot: ${JSON.stringify(simplifiedSnapshot)}
- corner_apex: ${JSON.stringify(apexInfo)}

Based on the data, provide ONE of the following types of feedback:
1.  If lateral Gs dropped suddenly after the apex while speed was increasing, suggest smoother throttle application. Example: "Smoother on the throttle out of corners"
2.  If the speed at the apex was very low, suggest carrying more speed. Example: "Carry more speed into the apex"
3.  If braking Gs were very high but short, followed by coasting into the apex, suggest trail braking. Example: "Ease off the brakes more slowly"
4.  If the telemetry looks good, provide encouragement. Example: "Good exit speed nice and smooth"

Provide only the spoken phrase.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error calling Gemini API for real-time tip:", error);
    return ""; // Return empty on error to not interrupt driver
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

    const model = 'gemini-1.5-pro'; // Use 1.5 Pro for complex reasoning

    const prompt = `
      You are the 'CartelWorx' Master Diagnostic AI.
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
            config: { temperature: 0.4 }
        });
        return response.text;
    } catch (e) {
        console.error("Diagnosis failed", e);
        return "Failed to generate diagnosis. Please try again.";
    }
}
