import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Esta es la línea clave para el despliegue.
      // Le dice a Vite que la aplicación vivirá en un subdirectorio.
      base: '/malcriados---embroidery-manager/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [dyadComponentTagger(), react()],
      // Se ha eliminado el bloque 'define'.
      // Vite expone automáticamente las variables de entorno con prefijo VITE_
      // a través de import.meta.env si están definidas en el entorno de construcción.
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