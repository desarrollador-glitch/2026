import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionContextProvider } from './src/components/SessionContextProvider';
import ToastProvider from './src/components/ToastProvider'; // Importar ToastProvider

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider>
        <ToastProvider /> {/* Añadir ToastProvider aquí */}
        <App />
      </SessionContextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);