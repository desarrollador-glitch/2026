import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY se inyectarán automáticamente
        // si están definidas en Vercel con el prefijo VITE_.
        // Eliminamos las definiciones explícitas para evitar posibles conflictos.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Añadir alias explícitos para React y ReactDOM
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        }
      }
    };
});