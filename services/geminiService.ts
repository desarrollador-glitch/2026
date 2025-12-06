import { GoogleGenAI, Type } from "@google/genai";

// Helper to ensure we have an API key context
const getAIClient = async () => {
  // Intentamos leer la key de varias fuentes posibles en Vite
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ FALTA API KEY: No se encontró VITE_GEMINI_API_KEY ni process.env.API_KEY");
    throw new Error("Configuración IA incompleta: Falta la API Key.");
  }

  return new GoogleGenAI({ apiKey });
};

// 1. Analyze Image Quality (Flash)
export const analyzeImageQuality = async (base64Image: string): Promise<{ approved: boolean; reason: string }> => {
  try {
    const ai = await getAIClient();
    
    // Remove header if present
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `Actúa como un experto en digitalización de bordados. Analiza esta imagen de una mascota para determinar si es apta para ser bordada.
            
            Criterios de Aceptación (Estrictos):
            1. NITIDEZ: La cara de la mascota debe estar perfectamente enfocada. Si está borrosa, RECHAZAR.
            2. ILUMINACIÓN: Debe tener buen contraste. Evitar sombras duras que oculten rasgos.
            3. OBSTRUCCIONES: La cara no debe estar cubierta por objetos.
            4. RESOLUCIÓN: La imagen no debe estar pixelada.

            Responde EXCLUSIVAMENTE con este esquema JSON:
            {
              "approved": boolean, // true solo si cumple TODOS los criterios
              "reason": string // Explicación breve y amigable en Español para el cliente. Si es rechazado, sugiere cómo mejorar la foto (ej: "Acércate más", "Mejora la luz").
            }`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            approved: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("La IA no devolvió texto.");
    }

    // Clean markdown code blocks just in case the model returns them
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);

  } catch (error: any) {
    console.error("Analysis Error Details:", error);
    throw new Error(`Fallo en IA: ${error.message || 'Error desconocido'}`);
  }
};

// 2. Edit Image (Flash Image - Nano Banana)
export const editImageWithPrompt = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const ai = await getAIClient();
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: `Instruction: ${prompt}`
          },
        ],
      },
    });

    // Parse output for image
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No se generó ninguna imagen.");
  } catch (error: any) {
    console.error("Edit Error:", error);
    throw new Error(`Fallo en Edición IA: ${error.message}`);
  }
};