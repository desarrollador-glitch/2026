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
      
      if (error.message.includes("row-level security")) {
        throw new Error("Permiso denegado (RLS). El bucket no permite escrituras públicas.");
      }
      if (error.message.includes("The resource was not found")) {
         throw new Error(`El bucket '${BUCKET_NAME}' no existe en Supabase.`);
      }

      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log("✅ Archivo subido:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;

  } catch (error: any) {
    console.error('Error detallado en uploadFile:', error);
    toast.error(`Error subida: ${error.message}`);
    return null; 
  }
};

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
    console.error('Error preparing base64:', error);
    return null;
  }
};