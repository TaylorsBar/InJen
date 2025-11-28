
import { defineFlow } from '@genkit-ai/flow';
import { gemini15Pro } from '@genkit-ai/vertexai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

// --- Schemas ---

const VehicleTelemetryInput = z.object({
  vehicle_vin: z.string(),
  dtc_list: z.array(z.string()).describe('List of OBD-II Diagnostic Trouble Codes'),
  freeze_frame: z.record(z.any()).describe('Sensor snapshot at moment of fault (JSON)'),
  user_symptom: z.string().describe('Driver\'s description of the issue'),
  conversation_history: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string() })).optional()
});

const DiagnosticOutput = z.object({
  diagnosis_confidence: z.number().min(0).max(1).describe('0.0 to 1.0 confidence score'),
  diagnostic_state: z.enum(['ANALYZING', 'NEED_MORE_INFO', 'CONCLUSION_REACHED']),
  reasoning: z.string().describe('Chain of thought explaining the hypothesis'),
  clarifying_questions: z.array(z.string()).optional().describe('Questions to ask user if confidence is low'),
  repair_plan: z.object({
    steps: z.array(z.string()),
    estimated_difficulty: z.enum(['DIY_EASY', 'INTERMEDIATE', 'PROFESSIONAL_ONLY'])
  }).optional(),
  parts_needed: z.array(z.object({
    part_name: z.string(),
    suggested_action: z.literal('TRIGGER_PART_SEARCH'),
    search_query: z.string()
  })).optional()
});

// --- RAG Tool Mock ---
// In production, replace with actual retriever from vector store
async function retrieveServiceDocs(dtcs: string[], make: string) {
  return `Found TSB-23-004 for ${make}: correlated to DTC ${dtcs[0]} indicating potential vacuum leak in intake manifold.`;
}

// --- The Flow ---

export const diagnoseVehicle = defineFlow(
  {
    name: 'diagnoseVehicle',
    inputSchema: VehicleTelemetryInput,
    outputSchema: DiagnosticOutput,
  },
  async (input) => {
    // 1. Context Retrieval (RAG)
    // Real implementation would extract Make/Model from VIN first
    const serviceContext = await retrieveServiceDocs(input.dtc_list, 'GenericVehicle');

    // 2. Construct System Prompt
    const systemPrompt = `
      You are the 'CartelWorx' Master Diagnostic AI.
      Your Goal: Identify the root cause of vehicle faults using telemetry and service manuals.
      
      Diagnostic State Machine Rules:
      1. ANALYZE: Correlate user symptoms with DTCs and Freeze Frame data (Fuel trims, Temps).
      2. HYPOTHESIZE: Use the provided Service Context to form a hypothesis.
      3. QUESTION: If confidence is < 0.8, do NOT guess. Set state to 'NEED_MORE_INFO' and ask clarifying questions (e.g., "Does this happen only at idle?").
      4. CONCLUDE: If confidence >= 0.8, set state to 'CONCLUSION_REACHED', outline the repair plan, and populate 'parts_needed'.
      
      Service Context: ${serviceContext}
    `;

    // 3. Call Gemini 1.5 Pro
    const response = await generate({
      model: gemini15Pro,
      config: { temperature: 0.2 }, // Low temp for analytical precision
      prompt: [
        { text: systemPrompt },
        ...input.conversation_history?.map(m => ({ text: m.text })) || [],
        { text: `Current Input: DTCs: ${JSON.stringify(input.dtc_list)}, Data: ${JSON.stringify(input.freeze_frame)}, Symptom: ${input.user_symptom}` }
      ],
      output: { schema: DiagnosticOutput },
    });

    return response.output();
  }
);
