import { supabase } from '../integrations/supabase/client';

// 1. Analyze Image Quality (Via Edge Function)
export const analyzeImageQuality = async (base64Image: string): Promise<{ approved: boolean; reason: string }> => {
  try {
    console.log("📡 Enviando imagen a Edge Function (analyze-image)...");

    const { data, error } = await supabase.functions.invoke('analyze-image', {
      body: { image: base64Image }
    });

    if (error) {
      console.error("Edge Function Error:", error);
      throw new Error(error.message || "Error al conectar con el servidor de análisis.");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    console.log("✅ Respuesta IA recibida:", data);
    return data;

  } catch (error: any) {
    console.error("Analysis Failure:", error);
    // Propagamos el error para que el Toast lo muestre en ClientView
    throw new Error(`Fallo en IA: ${error.message || 'Error desconocido'}`);
  }
};

// 2. Edit Image (MOCK - Para implementar luego también en Edge Function)
export const editImageWithPrompt = async (base64Image: string, prompt: string): Promise<string> => {
  // Por ahora mantenemos esto simple o simulado hasta crear su propia Edge Function
  console.log("Funcionalidad de edición pendiente de migración a Edge Function");
  return base64Image; 
};