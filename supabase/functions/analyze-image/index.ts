import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("🚀 Edge Function iniciada: analyze-image");

    // 2. Validación de Configuración (CRÍTICO)
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    // Verificación de seguridad sin exponer la clave
    if (!GEMINI_API_KEY) {
      console.error("❌ ERROR CRÍTICO: La variable GEMINI_API_KEY no está definida en los Secretos de Supabase.");
      return new Response(
        JSON.stringify({ 
          error: "Server Error: Configuration missing. GEMINI_API_KEY not found in environment secrets." 
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ API Key detectada (Longitud: ${GEMINI_API_KEY.length} caracteres)`);

    // 3. Parsing del Request
    const { image } = await req.json();
    if (!image) {
      throw new Error('No se envió ninguna imagen en el cuerpo de la petición');
    }

    // 4. Preparar llamada a Google
    const cleanBase64 = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    const model = 'gemini-1.5-flash';
    
    // Construcción segura de URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    console.log("📡 Enviando petición a Google Gemini...");

    const requestBody = {
      contents: [{
        parts: [
          {
            text: `Actúa como un experto en digitalización de bordados. Analiza esta imagen de una mascota.
            
            Criterios de Aceptación (Estrictos):
            1. NITIDEZ: La cara debe estar perfectamente enfocada.
            2. ILUMINACIÓN: Buen contraste, sin sombras duras en la cara.
            3. OBSTRUCCIONES: La cara no debe estar tapada.
            4. RESOLUCIÓN: No pixelada.

            Responde EXCLUSIVAMENTE con este JSON sin markdown:
            { "approved": boolean, "reason": "Explicación breve en español" }`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: cleanBase64
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    // 5. Ejecución Fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google API Error (${response.status}):`, errorText);
      // Devolvemos el error de Google tal cual para depuración
      throw new Error(`Google API Error: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Respuesta recibida de Google");

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error('La IA no devolvió texto válido');

    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedResult = JSON.parse(cleanJson);

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("🔥 Excepción General:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, // Error interno, no de validación de usuario
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})