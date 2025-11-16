
import { GoogleGenAI, Content, GenerateContentConfig } from "@google/genai";
import { RunSummary } from "../types";
import { MPS_PER_MPH } from "../constants";

const API_KEY = process.env.API_KEY;

const LOCATION_KEYWORDS = ['where', 'nearby', 'find', 'directions', 'gas', 'food', 'track', 'restaurant', 'map', 'closest', 'nearest'];

class ChatService {
  private ai: GoogleGenAI | null = null;
  private systemInstruction: string = '';
  private history: Content[] = [];

  initialize(runHistory: RunSummary[]) {
    if (!API_KEY) {
      console.warn("Gemini API key not found. Chat features will be disabled.");
      return;
    }

    this.ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const historySummary = runHistory.map((run, index) => {
        return `Run #${runHistory.length - index}: 0-60=${run.zeroToSixty?.toFixed(2)}s, 1/4 Mile=${run.quarterMileTime?.toFixed(2)}s @ ${(run.quarterMileSpeed ? (run.quarterMileSpeed / MPS_PER_MPH) : 0).toFixed(1)} mph`;
    }).join('\n');

    this.systemInstruction = `You are an expert AI driving coach and data analyst for the Genesis Telemetry app.
Your tone is helpful, knowledgeable, and slightly informal.
You have access to the user's performance run history and their current location for grounded search.
When asked a question, use the provided data to give a specific, insightful answer.
If asked to compare runs, be detailed.
For any location-based queries (e.g., finding places), use the provided tools.
Current run history summary:
${historySummary || "No runs recorded yet."}
`;
    this.history = [];
  }

  async sendMessage(message: string, position: { lat: number, long: number }): Promise<{ text: string, groundingChunks: any[] }> {
    if (!this.ai) {
        if (!API_KEY) return { text: "AI chat is disabled. Please configure your Gemini API key.", groundingChunks: [] };
        return { text: "Chat service is not initialized. Please wait a moment and try again.", groundingChunks: [] };
    }

    this.history.push({ role: 'user', parts: [{ text: message }] });

    try {
      const isLocationQuery = LOCATION_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));

      const config: GenerateContentConfig = {
        systemInstruction: this.systemInstruction,
      };

      if (isLocationQuery) {
        config.tools = [{googleMaps: {}}];
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: position.lat,
              longitude: position.long,
            }
          }
        }
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: this.history,
        config: config,
      });

      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      this.history.push({ role: 'model', parts: [{ text: text }] });

      return { text, groundingChunks };
    } catch (error) {
      // If there's an error, remove the user message from history to allow a retry
      this.history.pop();
      console.error("Error sending chat message:", error);
      throw new Error("Failed to get a response from the AI assistant.");
    }
  }
}

export const chatService = new ChatService();
