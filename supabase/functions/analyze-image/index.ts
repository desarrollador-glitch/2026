import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.12.0"

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
    // 2. Obtener y Validar API Key
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error("❌ ERROR: GEMINI_API_KEY no está definida en los secretos de Supabase.")
      return new Response(
        JSON.stringify({ error: "Configuration Error: API Key missing in server environment." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Obtener datos del Request
    const { image } = await req.json()
    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image data provided." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Limpiar Base64 (remover header data:image/...)
    // La librería espera el base64 limpio o la parte inline data
    const base64Data = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '')

    // 5. Inicializar Google AI
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json" // Forzar respuesta JSON nativa
      }
    })

    // 6. Preparar Prompt
    const prompt = `Actúa como experto en control de calidad de bordados. Analiza la imagen.
    
    CRITERIOS DE APROBACIÓN:
    1. Nitidez: Cara enfocada.
    2. Iluminación: Sin sombras duras que oculten rasgos.
    3. Integridad: Ninguna parte de la cara cortada u obstruida.
    
    Responde con este esquema JSON:
    {
      "approved": boolean, 
      "reason": "Explicación breve y amigable en español dirigida al cliente."
    }`

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg"
      }
    }

    console.log("📡 Enviando a Gemini (SDK)...")

    // 7. Ejecutar Análisis
    const result = await model.generateContent([prompt, imagePart])
    const responseText = result.response.text()
    
    console.log("✅ Respuesta IA:", responseText)

    // 8. Parsear y Devolver
    // Al usar responseMimeType: "application/json", el texto debería ser JSON válido directamente
    let parsedResult
    try {
        parsedResult = JSON.parse(responseText)
    } catch (e) {
        // Fallback por si acaso devuelve markdown
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
        parsedResult = JSON.parse(cleanJson)
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("🔥 Error en Edge Function:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})