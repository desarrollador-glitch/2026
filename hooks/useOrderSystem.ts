import { useState } from 'react';
import { Order, OrderStatus, UserRole, EmbroiderySlot, SleeveConfig } from '../types';
import { INITIAL_ORDERS } from '../constants'; // Importamos datos Mock
import { analyzeImageQuality, editImageWithPrompt } from '../services/geminiService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../src/integrations/supabase/client';
import { useSession } from '../src/components/SessionContextProvider';
import { uploadFile, uploadBase64 } from '../src/integrations/supabase/storage';
import toast from 'react-hot-toast';

export const useOrderSystem = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // --- MOCK FETCH ORDERS ---
  // En lugar de ir a Supabase, devolvemos INITIAL_ORDERS directamente
  const fetchOrders = async (): Promise<Order[]> => {
    // Simulamos un delay de red
    await new Promise(resolve => setTimeout(resolve, 500));
    return INITIAL_ORDERS;
  };

  const { data: orders, isLoading: isLoadingOrders, error: ordersError } = useQuery<Order[], Error>({
    queryKey: ['orders', 'dev-mode'], // Clave fija para dev
    queryFn: fetchOrders,
    staleTime: Infinity, // No refrescar automáticamente en dev
  });

  // --- MUTACIONES (Ahora solo simulan éxito para no romper la UI) ---

  const updateSlotMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; updates: Partial<EmbroiderySlot> }>({
    mutationFn: async ({ orderId, itemId, slotId, updates }) => {
      console.log('DEV MODE: Actualizando Slot', { orderId, itemId, slotId, updates });
      await new Promise(resolve => setTimeout(resolve, 500));
      // Aquí podríamos actualizar el caché localmente si quisiéramos persistencia temporal
    },
    onSuccess: () => {
        toast.success('Bordado actualizado (Simulación)');
    },
  });

  const updateSleeveMutation = useMutation<void, Error, { orderId: string; itemId: string; config: SleeveConfig | undefined }>({
    mutationFn: async ({ orderId, itemId, config }) => {
       console.log('DEV MODE: Actualizando Manga', { orderId, itemId, config });
    },
    onSuccess: () => {
      toast.success('Manga actualizada (Simulación)');
    },
  });

  const handleImageUploadMutation = useMutation<void, Error, { file: File; orderId: string; itemId: string; slotId: string }>({
    mutationFn: async ({ file }) => {
      setIsProcessingAI(true);
      // Simulamos subida y análisis
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Retornamos éxito falso
    },
    onSuccess: () => {
      toast.success('Imagen subida (Simulación)');
    },
    onSettled: () => {
      setIsProcessingAI(false);
    },
  });

  const handleEditImageMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; currentImage: string; prompt: string }>({
    mutationFn: async ({ prompt }) => {
      setIsProcessingAI(true);
      console.log('DEV MODE: Editando con prompt:', prompt);
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      toast.success('Imagen editada (Simulación)');
    },
    onSettled: () => {
      setIsProcessingAI(false);
    },
  });

  // Designer Submission Mock
  const submitDesignMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Submit Design', data); },
    onSuccess: () => toast.success('Diseño enviado (Simulación)'),
  });

  // Client Review Mock
  const handleClientReviewMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Client Review', data); },
    onSuccess: () => toast.success('Revisión registrada (Simulación)'),
  });

  // Status Update Mock
  const updateOrderStatusMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Update Status', data); },
    onSuccess: () => toast.success('Estado actualizado (Simulación)'),
  });

  // Issue Reporting Mock
  const reportIssueMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Report Issue', data); },
    onSuccess: () => toast.warn('Incidencia reportada (Simulación)'),
  });

  const resolveIssueMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Resolve Issue', data); },
    onSuccess: () => toast.success('Incidencia resuelta (Simulación)'),
  });

  // Evidence Upload Mock
  const handleEvidenceUploadMutation = useMutation<void, Error, any>({
    mutationFn: async (data) => { console.log('DEV MODE: Evidence Upload', data); },
    onSuccess: () => toast.success('Evidencia subida (Simulación)'),
  });

  const handleLogout = async () => {
     console.log('DEV MODE: Logout click');
     toast.success('Sesión cerrada (Simulación)');
  };

  return {
    orders: orders || [],
    isLoading: isLoadingOrders || isProcessingAI,
    error: ordersError,
    updateSlot: updateSlotMutation.mutate,
    updateSleeve: updateSleeveMutation.mutate,
    onInitiateUpload: handleImageUploadMutation.mutate,
    onEditImage: handleEditImageMutation.mutate,
    onSubmitDesign: submitDesignMutation.mutate,
    onReviewDesign: handleClientReviewMutation.mutate,
    onUpdateStatus: updateOrderStatusMutation.mutate,
    onReportIssue: reportIssueMutation.mutate,
    onResolveIssue: resolveIssueMutation.mutate,
    onUploadEvidence: handleEvidenceUploadMutation.mutate,
    handleLogout,
  };
};