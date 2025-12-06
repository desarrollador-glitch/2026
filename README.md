<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Malcriados - Embroidery Manager

Aplicación de gestión de pedidos de bordado con Inteligencia Artificial.

## 🚀 Configuración Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Variables de Entorno (CRÍTICO):**
   Crea un archivo `.env.local` en la raíz del proyecto y añade tus claves. Sin esto, la IA fallará.

   ```env
   # .env.local
   GEMINI_API_KEY=tu_api_key_de_google_ai_studio_aqui
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
   ```
   > Obtén tu API Key de Gemini aquí: https://aistudio.google.com/app/apikey

3. **Ejecutar la App:**
   ```bash
   npm run dev
   ```

## 🛠️ Solución de Problemas Comunes

*   **Error 400 (API Key not valid):** Verifica que `GEMINI_API_KEY` esté en `.env.local` y reinicia el servidor (`Ctrl+C` y `npm run dev`).
*   **Fotos no cargan:** Verifica que los buckets de Supabase tengan políticas públicas (RLS) correctas.