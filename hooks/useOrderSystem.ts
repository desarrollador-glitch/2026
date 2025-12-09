import { useState } from 'react';
import { Order, OrderStatus, UserRole, EmbroiderySlot, SleeveConfig, OrderItem, DesignVersion } from '../types';
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
        const [ordersRes, itemsRes, slotsRes, versionsRes] = await Promise.all([
            // 1. Orders: Newest first
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            
            // 2. Items: Stable sort by SKU then ID (Deterministic)
            supabase.from('order_items').select('*')
                .order('sku', { ascending: true })
                .order('id', { ascending: true }),
            
            // 3. Slots: Stable sort by creation time (Pet 1, Pet 2...), ID as tiebreaker
            supabase.from('embroidery_slots').select('*')
                .order('created_at', { ascending: true })
                .order('id', { ascending: true }),
            
            // 4. Design Versions (History)
            supabase.from('design_versions').select('*').order('created_at', { ascending: false })
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (itemsRes.error) throw itemsRes.error;
        if (slotsRes.error) throw slotsRes.error;
        if (versionsRes.error) throw versionsRes.error;

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
                
                // Mapped Attributes
                garmentType: i.prenda,
                color: i.color,
                size: i.talla,

                customizationType: i.customization_type, // MAPPED FROM DB
                sleeve: i.sleeve_config as SleeveConfig,
                customizations: slotsByItem[i.id] || []
            });
        });

        // --- CLIENT-SIDE DETERMINISTIC SORTING (SAFETY LAYER) ---
        Object.keys(itemsByOrder).forEach(orderId => {
            itemsByOrder[orderId].sort((a, b) => {
                const skuA = a.sku || '';
                const skuB = b.sku || '';
                const skuComparison = skuA.localeCompare(skuB);
                if (skuComparison !== 0) return skuComparison;
                return a.id.localeCompare(b.id);
            });
        });

        const versionsByOrder: Record<string, DesignVersion[]> = {};
        versionsRes.data.forEach((v: any) => {
            if (!versionsByOrder[v.order_id]) versionsByOrder[v.order_id] = [];
            versionsByOrder[v.order_id].push({
                imageUrl: v.image_url,
                technicalSheet: v.technical_sheet_url,
                machineFile: v.machine_file_url,
                feedback: v.feedback,
                createdAt: v.created_at
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
            designHistory: versionsByOrder[o.id] || [], // Asignar historial

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
    onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Cambios guardados');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`)
  });

  const handleImageUploadMutation = useMutation({
    mutationFn: async ({ file, orderId, itemId, slotId }: { file: File, orderId: string, itemId: string, slotId: string }) => {
        setIsProcessingAI(true);
        try {
            const path = `orders/${orderId}/${slotId}/${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile(file, path);
            
            if (!publicUrl) return;

            const { error: initialDbError } = await supabase
                .from('embroidery_slots')
                .update({
                    photo_url: publicUrl,
                    status: 'ANALYZING',
                    ai_reason: null
                })
                .eq('id', slotId);

            if (initialDbError) throw initialDbError;

            queryClient.invalidateQueries({ queryKey: ['orders'] });

            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
            const base64 = await base64Promise;

            try {
                const aiResult = await analyzeImageQuality(base64);

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
             throw err;
        } finally {
            setIsProcessingAI(false);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
        setIsProcessingAI(false);
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
    mutationFn: async ({ orderId, assets }: { orderId: string, assets: { imageFile: File, technicalSheetFile: File, machineFileFile: File } }) => {
        
        // 1. ARCHIVING STRATEGY: 
        // Before uploading new files, we check if there's an existing design that was rejected.
        // We fetch the CURRENT state of the order from DB to get the URLs of the rejected design.
        const { data: currentOrder, error: fetchError } = await supabase
            .from('orders')
            .select('design_image, technical_sheet, machine_file, client_feedback, status')
            .eq('id', orderId)
            .single();

        if (fetchError) throw fetchError;

        // If a design exists (e.g. status was DESIGN_REJECTED), we archive it.
        if (currentOrder && currentOrder.design_image) {
            console.log("Archivando versión anterior...");
            const { error: archiveError } = await supabase.from('design_versions').insert({
                order_id: orderId,
                image_url: currentOrder.design_image,
                technical_sheet_url: currentOrder.technical_sheet,
                machine_file_url: currentOrder.machine_file,
                feedback: currentOrder.client_feedback || 'Versión anterior archivada'
            });

            if (archiveError) {
                console.error("Error archiving version:", archiveError);
                // We proceed anyway to not block the workflow, but ideally we should handle this.
            }
        }

        // 2. Upload NEW files
        const imagePath = `designs/${orderId}/visual_${Date.now()}_${assets.imageFile.name}`;
        const imageUrl = await uploadFile(assets.imageFile, imagePath);
        if (!imageUrl) throw new Error("Error al subir la imagen visual.");

        const techPath = `designs/${orderId}/tech_${Date.now()}_${assets.technicalSheetFile.name}`;
        const techUrl = await uploadFile(assets.technicalSheetFile, techPath);
        if (!techUrl) throw new Error("Error al subir la ficha técnica.");

        const machinePath = `designs/${orderId}/machine_${Date.now()}_${assets.machineFileFile.name}`;
        const machineUrl = await uploadFile(assets.machineFileFile, machinePath);
        if (!machineUrl) throw new Error("Error al subir el archivo de máquina.");

        // 3. Update Order with NEW files and RESET feedback
        const MOCK_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        const currentUserId = session?.user?.id;
        const designerIdToSave = (currentUserId === MOCK_USER_ID) ? null : currentUserId;

        const { error } = await supabase.from('orders').update({
                design_image: imageUrl,
                technical_sheet: techUrl,
                machine_file: machineUrl,
                client_feedback: null, // Clear feedback for the new version
                status: 'DESIGN_REVIEW',
                assigned_designer_id: designerIdToSave
            }).eq('id', orderId);
        
        if (error) throw error;
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['orders'] }); 
        toast.success('Diseño enviado a revisión correctamente'); 
    },
    onError: (err: any) => {
        console.error(err);
        toast.error(`Error al enviar diseño: ${err.message}`);
    }
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
    updateSlot: updateSlotMutation.mutateAsync,
    updateSleeve: updateSleeveMutation.mutateAsync,
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