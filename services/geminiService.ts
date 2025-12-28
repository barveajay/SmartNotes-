
import { GoogleGenAI, Type } from "@google/genai";
import { SmartNotes, GroundingSource } from "../types";

export const processLectureMedia = async (
  base64Data: string,
  mimeType: string,
  deepAnalysis: boolean = false
): Promise<SmartNotes> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const modelName = deepAnalysis ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  const isDocument = mimeType === 'application/pdf';

  const prompt = `
    You are an expert academic research assistant and educator. 
    Analyze the provided lecture ${isDocument ? 'document (PDF)' : 'media (audio/video)'} and generate comprehensive study materials.
    
    REQUIRED OUTPUT STRUCTURE (JSON):
    1. Title: Professional academic title.
    2. Summary: 2-3 detailed paragraphs.
    3. Key Concepts: Detailed list of terms and definitions.
    4. Action Items: Deadlines or homework mentioned.
    5. Transcription: Clean, punctuated text.
    6. Quiz: 5 multiple-choice questions (question, options[], answer).
    7. Flashcards: 5 high-impact conceptual flashcards (front, back).
    8. Search: Find 3-5 high-quality external web resources related to the topic.
    
    The response must be strict JSON.
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
            transcription: { type: Type.STRING },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING }
                },
                required: ["question", "options", "answer"]
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING },
                  back: { type: Type.STRING }
                },
                required: ["front", "back"]
              }
            }
          },
          required: ["title", "summary", "keyConcepts", "actionItems", "transcription", "quiz", "flashcards"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);

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
    throw new Error("Failed to generate smart notes. Ensure file content is readable.");
  }
};
