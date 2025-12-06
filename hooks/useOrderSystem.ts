import { useState } from 'react';
import { Order, OrderStatus, UserRole, EmbroiderySlot, SleeveConfig, OrderItem } from '../types';
import { analyzeImageQuality, editImageWithPrompt } from '../services/geminiService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../src/integrations/supabase/client';
import { useSession } from '../src/components/SessionContextProvider';
import { uploadFile } from '../src/integrations/supabase/storage';
import toast from 'react-hot-toast';

export const useOrderSystem = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // --- FETCH ORDERS ---
  const fetchOrders = async (): Promise<Order[]> => {
    try {
        const [ordersRes, itemsRes, slotsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('order_items').select('*'),
            supabase.from('embroidery_slots').select('*')
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (itemsRes.error) throw itemsRes.error;
        if (slotsRes.error) throw slotsRes.error;

        const slotsByItem: Record<string, EmbroiderySlot[]> = {};
        slotsRes.data.forEach((s: any) => {
            if (!slotsByItem[s.order_item_id]) slotsByItem[s.order_item_id] = [];
            slotsByItem[s.order_item_id].push({
                id: s.id,
                petName: s.pet_name,
                photoUrl: s.photo_url,
                position: s.position,
                includeHalo: s.include_halo,
                status: s.status as any,
                aiReason: s.ai_reason
            });
        });

        const itemsByOrder: Record<string, OrderItem[]> = {};
        itemsRes.data.forEach((i: any) => {
            if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
            itemsByOrder[i.order_id].push({
                id: i.id,
                groupId: i.pack,
                sku: i.sku,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                sleeve: i.sleeve_config as SleeveConfig,
                customizations: slotsByItem[i.id] || []
            });
        });

        const mappedOrders: Order[] = ordersRes.data.map((o: any) => ({
            id: o.id,
            customerName: o.customer_name,
            email: o.email,
            phone: o.phone,
            shippingAddress: o.shipping_address,
            orderDate: o.order_date || o.created_at,
            status: o.status as OrderStatus,
            totalAmount: o.total_amount,
            assignedDesignerId: o.assigned_designer_id,
            assignedEmbroidererId: o.assigned_embroiderer_id,
            designImage: o.design_image,
            technicalSheet: o.technical_sheet,
            machineFile: o.machine_file,
            clientFeedback: o.client_feedback,
            productionIssue: o.production_issue,
            finishedProductPhoto: o.finished_product_photo,
            packedProductPhoto: o.packed_product_photo,
            items: itemsByOrder[o.id] || []
        }));

        return mappedOrders;
    } catch (err: any) {
        console.error("Error fetching orders:", err);
        throw new Error(err.message);
    }
  };

  const { data: orders, isLoading, error } = useQuery<Order[], Error>({
    queryKey: ['orders', 'real-data'],
    queryFn: fetchOrders,
    refetchInterval: 5000,
  });

  // --- MUTATIONS ---
  const updateSlotMutation = useMutation({
    mutationFn: async ({ orderId, itemId, slotId, updates }: { orderId: string, itemId: string, slotId: string, updates: Partial<EmbroiderySlot> }) => {
        const dbUpdates: any = {};
        if (updates.petName !== undefined) dbUpdates.pet_name = updates.petName;
        if (updates.position !== undefined) dbUpdates.position = updates.position;
        if (updates.includeHalo !== undefined) dbUpdates.include_halo = updates.includeHalo;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;

        const { error } = await supabase
            .from('embroidery_slots')
            .update(dbUpdates)
            .eq('id', slotId);

        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Cambios guardados');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`)
  });

  const handleImageUploadMutation = useMutation({
    mutationFn: async ({ file, orderId, itemId, slotId }: { file: File, orderId: string, itemId: string, slotId: string }) => {
        setIsProcessingAI(true);
        try {
            // 1. Upload to Storage
            const path = `orders/${orderId}/${slotId}/${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile(file, path);
            
            // VALIDACIÓN CRÍTICA: Detener si la subida falló (publicUrl es null)
            if (!publicUrl) {
                return; // El toast de error ya se mostró en uploadFile
            }

            // --- PASO CRÍTICO: GUARDAR EN DB INMEDIATAMENTE ---
            // Esto asegura que la foto aparezca en el frontend aunque la IA falle después.
            const { error: initialDbError } = await supabase
                .from('embroidery_slots')
                .update({
                    photo_url: publicUrl,
                    status: 'ANALYZING',
                    ai_reason: null
                })
                .eq('id', slotId);

            if (initialDbError) throw initialDbError;

            // Refrescar UI inmediatamente para que el usuario vea la foto cargando
            queryClient.invalidateQueries({ queryKey: ['orders'] });

            // 2. Convert to Base64 for AI Analysis
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
            const base64 = await base64Promise;

            // 3. Analyze with Gemini (En un bloque try/catch aislado)
            try {
                const aiResult = await analyzeImageQuality(base64);

                // 4. Update DB with Result (Solo si la IA responde)
                const status = aiResult.approved ? 'APPROVED' : 'REJECTED';
                
                const { error: finalDbError } = await supabase
                    .from('embroidery_slots')
                    .update({
                        status: status,
                        ai_reason: aiResult.reason
                    })
                    .eq('id', slotId);

                if (finalDbError) throw finalDbError;

                if (!aiResult.approved) {
                     await supabase.from('orders').update({ status: 'ACTION_REQUIRED' }).eq('id', orderId);
                }
                
                toast.success(aiResult.approved ? 'Foto aprobada por IA' : 'Foto rechazada por IA');

            } catch (aiError: any) {
                console.error("AI Service Error (Non-blocking):", aiError);
                
                // Si la IA falla (ej: API Key inválida), marcamos para revisión manual
                // NO borramos la fotoUrl
                await supabase
                    .from('embroidery_slots')
                    .update({
                        status: 'REJECTED', 
                        ai_reason: "⚠️ IA no disponible. Se requiere revisión manual."
                    })
                    .eq('id', slotId);
                
                toast.error("Error de conexión con IA. Foto guardada para revisión manual.");
            }

        } catch (err: any) {
             throw err; // Re-lanzar errores fatales (subida o DB)
        } finally {
            setIsProcessingAI(false);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
        setIsProcessingAI(false);
        console.error("Upload/DB Fatal Error:", err);
        toast.error(`Error crítico: ${err.message}`);
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string, newStatus: OrderStatus }) => {
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Estado actualizado');
    }
  });

  const submitDesignMutation = useMutation({
    mutationFn: async ({ orderId, assets }: { orderId: string, assets: { image: string, technicalSheet: string, machineFile: string } }) => {
        const { error } = await supabase.from('orders').update({
                design_image: assets.image,
                technical_sheet: assets.technicalSheet,
                machine_file: assets.machineFile,
                status: 'DESIGN_REVIEW',
                assigned_designer_id: session?.user?.id 
            }).eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Diseño enviado a revisión'); }
  });

  const handleClientReviewMutation = useMutation({
    mutationFn: async ({ orderId, approved, feedback }: { orderId: string, approved: boolean, feedback?: string }) => {
        const newStatus = approved ? 'READY_TO_EMBROIDER' : 'DESIGN_REJECTED';
        const { error } = await supabase.from('orders').update({ status: newStatus, client_feedback: feedback }).eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Respuesta enviada'); }
  });

  const reportIssueMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string, reason: string }) => {
        const { error } = await supabase.from('orders').update({ status: 'ON_HOLD', production_issue: reason }).eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.warn('Incidencia reportada'); }
  });

  const resolveIssueMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
        const { error } = await supabase.from('orders').update({ status: 'IN_PROGRESS', production_issue: null }).eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => toast.success('Incidencia resuelta')
  });

  const handleEvidenceUploadMutation = useMutation({
    mutationFn: async ({ file, orderId, field }: { file: File, orderId: string, field: 'finishedProductPhoto' | 'packedProductPhoto' }) => {
         const path = `evidence/${orderId}/${field}_${Date.now()}`;
         const publicUrl = await uploadFile(file, path);
         if (!publicUrl) throw new Error("Falló subida");

         const updateObj: any = {};
         updateObj[field === 'finishedProductPhoto' ? 'finished_product_photo' : 'packed_product_photo'] = publicUrl;
         const { error } = await supabase.from('orders').update(updateObj).eq('id', orderId);
         if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Evidencia cargada'); }
  });

  const updateSleeveMutation = useMutation({
      mutationFn: async ({ orderId, itemId, config }: { orderId: string, itemId: string, config: SleeveConfig | undefined }) => {
        const { error } = await supabase.from('order_items').update({ sleeve_config: config || null }).eq('id', itemId);
        if (error) throw error;
      },
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Manga actualizada'); }
  });

  const handleEditImageMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; currentImage: string; prompt: string }>({
    mutationFn: async ({ prompt }) => {
      setIsProcessingAI(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSettled: () => setIsProcessingAI(false),
    onSuccess: () => toast.success('Edición simulada (Falta implementar endpoint real)')
  });

  const handleLogout = async () => { toast.success('En modo Dev, recarga la página.'); };

  return {
    orders: orders || [],
    isLoading,
    error: error as Error,
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