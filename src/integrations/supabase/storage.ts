import { supabase } from './client';
import toast from 'react-hot-toast';

const BUCKET_NAME = 'client-uploads';

export const uploadFile = async (file: File, path: string): Promise<string | null> => {
  try {
    console.log(`📤 Iniciando subida: ${path} (${file.size} bytes)`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error("❌ Error Supabase Storage:", error);
      
      // Manejo específico de errores comunes
      if (error.message.includes("row-level security")) {
        throw new Error("Permiso denegado. Revisa las políticas RLS del Bucket.");
      }
      if (error.message.includes("The resource was not found")) {
         throw new Error(`El bucket '${BUCKET_NAME}' no existe.`);
      }

      throw error;
    }

    // Obtener la URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log("✅ Archivo subido:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;

  } catch (error: any) {
    console.error('Error detallado en uploadFile:', error);
    toast.error(`Error al subir archivo: ${error.message}`);
    // Retornamos null para que el flujo se detenga aquí y no intente llamar a la IA
    return null; 
  }
};

// ... (El resto de funciones como uploadBase64 se mantienen, o puedes reusar uploadFile)
export const uploadBase64 = async (base64: string, path: string, mimeType: string): Promise<string | null> => {
  try {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], path.split('/').pop() || 'upload', { type: mimeType });

    return await uploadFile(file, path);
  } catch (error: any) {
    console.error('Error al preparar base64:', error.message);
    toast.error(`Error imagen: ${error.message}`);
    return null;
  }
};