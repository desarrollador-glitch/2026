import { supabase } from './client';
import toast from 'react-hot-toast';

const BUCKET_NAME = 'client-uploads';

export const uploadFile = async (file: File, path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true, // Sobrescribir si el archivo ya existe
      });

    if (error) {
      throw error;
    }

    // Obtener la URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;

  } catch (error: any) {
    console.error('Error al subir archivo a Supabase Storage:', error.message);
    toast.error(`Error al subir archivo: ${error.message}`);
    return null;
  }
};

export const uploadBase64 = async (base64: string, path: string, mimeType: string): Promise<string | null> => {
  try {
    // Convertir base64 a Blob
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
    console.error('Error al subir base64 a Supabase Storage:', error.message);
    toast.error(`Error al subir imagen: ${error.message}`);
    return null;
  }
};