import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS (Pre-flight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 2. Obtener API Key
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error("❌ ERROR: GEMINI_API_KEY no encontrada.")
      return new Response(
        JSON.stringify({ error: "Server Configuration Error: API Key missing." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Parsear Request
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { image } = body;
    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image data provided." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Limpieza robusta de Base64
    // Extrae lo que está después de la coma, o usa el string completo si no hay coma
    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // 5. Configurar Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    })

    // 6. Prompt Optimizado
    const prompt = `Analiza esta imagen de bordado de mascota para control de calidad.
    
    CRITERIOS DE APROBACIÓN (Debe cumplir TODOS):
    1. Nitidez: La imagen es clara y enfocada.
    2. Iluminación: No es demasiado oscura ni tiene sombras duras en la cara.
    3. Integridad: La cabeza/cara de la mascota está completa y visible.
    
    Si la imagen NO es una mascota (perro, gato, etc), recházala.

    Responde ESTRICTAMENTE con este JSON:
    {
      "approved": boolean, 
      "reason": "Si aprobado: 'Calidad excelente'. Si rechazado: Breve explicación amigable en español (ej: 'La foto está un poco borrosa')."
    }`

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg" 
      }
    }

    console.log("📡 Enviando a Gemini...")

    // 7. Generar respuesta
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ Respuesta Raw Gemini:", text);

    // 8. Parseo Seguro
    let parsedResult;
    try {
      // Intentar parseo directo
      parsedResult = JSON.parse(text);
    } catch (e) {
      console.warn("⚠️ JSON directo falló, intentando limpiar markdown...");
      // Limpiar bloques de código markdown si existen
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("🔥 Error crítico en Edge Function:", error);
    
    // Devolver error legible al cliente
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error desconocido en el análisis",
        details: error.toString() 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})