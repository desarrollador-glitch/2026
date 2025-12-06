import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS (Pre-flight request)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 2. Obtener API Key de las variables de entorno de Supabase (NO .env.local)
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('Falta la variable de entorno GEMINI_API_KEY en Supabase')
    }

    // 3. Obtener la imagen del cuerpo de la petición
    const { image } = await req.json()
    if (!image) {
      throw new Error('No se envió ninguna imagen')
    }

    // Limpiar base64 si viene con cabecera data:image...
    const cleanBase64 = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '')

    // 4. Preparar el Prompt para Gemini
    // Usamos el endpoint REST directo para mayor ligereza y control
    const model = 'gemini-1.5-flash' // Usamos 1.5-flash por estabilidad, puedes cambiar a 2.0 o lo que tengas disponible
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

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
    }

    // 5. Llamar a Google Gemini
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Error de Gemini API: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    
    // 6. Parsear la respuesta
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textResponse) throw new Error('La IA no devolvió texto válido')

    // Limpieza extra por si la IA devuelve bloques de código Markdown
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsedResult = JSON.parse(cleanJson)

    // 7. Responder al Frontend
    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Error en Edge Function:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})