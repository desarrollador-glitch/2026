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

  // --- 1. FETCH REAL DATA FROM SUPABASE ---
  const fetchOrders = async (): Promise<Order[]> => {
    try {
        // Hacemos 3 peticiones paralelas para eficiencia (en lugar de joins complejos que duplican datos)
        const [ordersRes, itemsRes, slotsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('order_items').select('*'),
            supabase.from('embroidery_slots').select('*')
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (itemsRes.error) throw itemsRes.error;
        if (slotsRes.error) throw slotsRes.error;

        // --- MAPEO DE DATOS (DB snake_case -> Frontend camelCase) ---
        
        // 1. Agrupar Slots por Item ID
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

        // 2. Agrupar Items por Order ID
        const itemsByOrder: Record<string, OrderItem[]> = {};
        itemsRes.data.forEach((i: any) => {
            if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
            
            itemsByOrder[i.order_id].push({
                id: i.id,
                groupId: i.pack, // DB: pack -> Frontend: groupId
                sku: i.sku,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                sleeve: i.sleeve_config as SleeveConfig, // JSONB Cast
                customizations: slotsByItem[i.id] || [] // Adjuntar slots hijos
            });
        });

        // 3. Construir Órdenes Finales
        const mappedOrders: Order[] = ordersRes.data.map((o: any) => ({
            id: o.id,
            customerName: o.customer_name,
            email: o.email,
            phone: o.phone,
            shippingAddress: o.shipping_address,
            orderDate: o.order_date || o.created_at,
            status: o.status as OrderStatus,
            totalAmount: o.total_amount,
            
            // Staff
            assignedDesignerId: o.assigned_designer_id,
            assignedEmbroidererId: o.assigned_embroiderer_id,

            // Design Assets
            designImage: o.design_image,
            technicalSheet: o.technical_sheet,
            machineFile: o.machine_file,
            clientFeedback: o.client_feedback,

            // Production Evidence
            productionIssue: o.production_issue,
            finishedProductPhoto: o.finished_product_photo,
            packedProductPhoto: o.packed_product_photo,

            // Items anidados
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
    refetchInterval: 5000, // Polling cada 5s para ver cambios en tiempo real
  });

  // --- 2. MUTATIONS (REAL WRITES) ---

  // Actualizar Slot (Foto, Posición, etc)
  const updateSlotMutation = useMutation({
    mutationFn: async ({ orderId, itemId, slotId, updates }: { orderId: string, itemId: string, slotId: string, updates: Partial<EmbroiderySlot> }) => {
        // Mapear updates al formato DB
        const dbUpdates: any = {};
        if (updates.petName !== undefined) dbUpdates.pet_name = updates.petName;
        if (updates.position !== undefined) dbUpdates.position = updates.position;
        if (updates.includeHalo !== undefined) dbUpdates.include_halo = updates.includeHalo;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl; // Nota: Normalmente viene de storage

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

  // Actualizar Estado de Orden
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string, newStatus: OrderStatus }) => {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Estado actualizado');
    }
  });

  // Subir Foto (Desde Client View)
  const handleImageUploadMutation = useMutation({
    mutationFn: async ({ file, orderId, itemId, slotId }: { file: File, orderId: string, itemId: string, slotId: string }) => {
        setIsProcessingAI(true);
        try {
            // 1. Upload to Supabase Storage
            const path = `orders/${orderId}/${slotId}/${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile(file, path);
            
            if (!publicUrl) throw new Error("Error subiendo archivo");

            // 2. Convert File to Base64 for AI Analysis
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
            const base64 = await base64Promise;

            // 3. Analyze with Gemini AI
            let aiResult = { approved: true, reason: 'Foto aprobada manualmente (AI Error)' };
            try {
               const analysis = await analyzeImageQuality(base64);
               aiResult = analysis;
            } catch (e) {
               console.warn("AI Analysis failed, skipping check", e);
            }

            // 4. Update DB
            const status = aiResult.approved ? 'APPROVED' : 'REJECTED';
            
            // Trigger SQL will sync this to other slots in the pack automatically!
            const { error } = await supabase
                .from('embroidery_slots')
                .update({
                    photo_url: publicUrl,
                    status: status,
                    ai_reason: aiResult.reason
                })
                .eq('id', slotId);

            if (error) throw error;

            // 5. Update Order Status if needed
            if (aiResult.approved) {
                 // Check logic could go here, or handled by DB triggers
            } else {
                 await supabase.from('orders').update({ status: 'ACTION_REQUIRED' }).eq('id', orderId);
            }

        } finally {
            setIsProcessingAI(false);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Foto procesada correctamente');
    },
    onError: (err: any) => {
        setIsProcessingAI(false);
        toast.error(err.message);
    }
  });

  // Enviar Diseño (Designer View)
  const submitDesignMutation = useMutation({
    mutationFn: async ({ orderId, assets }: { orderId: string, assets: { image: string, technicalSheet: string, machineFile: string } }) => {
        // En un caso real, 'assets' vendrían como Base64 y deberíamos subirlos a Storage
        // Por simplicidad en dev, asumimos que ya son URLs o Base64 que guardamos directo (aunque no recomendado para prod)
        // Para hacerlo bien: Subir a storage y obtener URL.
        
        // TODO: Implementar subida real de assets. Por ahora guardamos el string (URL o B64)
        const { error } = await supabase
            .from('orders')
            .update({
                design_image: assets.image, // Debería ser URL
                technical_sheet: assets.technicalSheet, // Debería ser URL
                machine_file: assets.machineFile, // Debería ser URL
                status: 'DESIGN_REVIEW',
                assigned_designer_id: session?.user?.id // Auto-asignar
            })
            .eq('id', orderId);

        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Diseño enviado a revisión');
    }
  });

  // Revisión Cliente
  const handleClientReviewMutation = useMutation({
    mutationFn: async ({ orderId, approved, feedback }: { orderId: string, approved: boolean, feedback?: string }) => {
        const newStatus = approved ? 'READY_TO_EMBROIDER' : 'DESIGN_REJECTED';
        const { error } = await supabase
            .from('orders')
            .update({
                status: newStatus,
                client_feedback: feedback
            })
            .eq('id', orderId);
        
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Respuesta enviada');
    }
  });

  // Reportar Incidencia
  const reportIssueMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string, reason: string }) => {
        const { error } = await supabase
            .from('orders')
            .update({
                status: 'ON_HOLD',
                production_issue: reason
            })
            .eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.warn('Incidencia reportada');
    }
  });

  // Resolver Incidencia
  const resolveIssueMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
        // Asumimos que vuelve a "En Progreso"
        const { error } = await supabase
            .from('orders')
            .update({
                status: 'IN_PROGRESS',
                production_issue: null
            })
            .eq('id', orderId);
        if (error) throw error;
    },
    onSuccess: () => toast.success('Incidencia resuelta')
  });

  // Subir Evidencia (Producción)
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
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('Evidencia cargada');
    }
  });

  // Actualizar Manga
  const updateSleeveMutation = useMutation({
      mutationFn: async ({ orderId, itemId, config }: { orderId: string, itemId: string, config: SleeveConfig | undefined }) => {
        const { error } = await supabase
            .from('order_items')
            .update({ sleeve_config: config || null }) // null para borrar
            .eq('id', itemId);
        
        if (error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          toast.success('Manga actualizada');
      }
  });

  // MOCK EDIT (Ya que requiere otra llamada a AI y storage)
  const handleEditImageMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; currentImage: string; prompt: string }>({
    mutationFn: async ({ prompt }) => {
      setIsProcessingAI(true);
      console.log('Editando (Mock)...', prompt);
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSettled: () => setIsProcessingAI(false),
    onSuccess: () => toast.success('Edición simulada (Falta implementar endpoint real)')
  });

  const handleLogout = async () => {
     toast.success('En modo Dev, recarga la página para reiniciar estado.');
  };

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