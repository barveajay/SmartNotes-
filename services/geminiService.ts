
import { GoogleGenAI, Type } from "@google/genai";
import { SmartNotes, GroundingSource } from "../types";

export const processLectureMedia = async (
  base64Data: string,
  mimeType: string,
  deepAnalysis: boolean = false
): Promise<SmartNotes> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use pro for deep analysis if requested, otherwise flash
  const modelName = deepAnalysis ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

  const isDocument = mimeType === 'application/pdf';

  const prompt = `
    You are an expert academic research assistant. 
    Analyze the provided lecture ${isDocument ? 'document (PDF)' : 'media (audio/video)'} and generate structured study notes.
    
    1. Title: A professional academic title.
    2. Summary: 2-3 detailed paragraphs highlighting the main thesis or lesson goals.
    3. Key Concepts: Detailed list of terms, definitions, and core formulas or theories.
    4. Action Items: List any deadlines, homework, assignments, or specific follow-up tasks mentioned.
    5. Transcription/Content Extract: ${isDocument ? 'A clean, structured extraction of the document text' : 'A clean, word-for-word transcription of the audio'}.
    6. Search: Use Google Search to find 3-5 high-quality external web resources (academic papers, educational videos, or tutorials) that provide deeper context on the topics discussed.
    
    The response must be in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyConcepts: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            actionItems: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            transcription: { type: Type.STRING }
          },
          required: ["title", "summary", "keyConcepts", "actionItems", "transcription"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);

    // Extract grounding chunks if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title || "External Resource",
        uri: chunk.web.uri
      }));

    return {
      ...parsed,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sources
    } as SmartNotes;
  } catch (error) {
    console.error("Gemini Processing Error:", error);
    throw new Error("Failed to process lecture material. Ensure your file is valid and the API key is active.");
  }
};
