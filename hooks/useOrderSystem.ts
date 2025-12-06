import { useState, useEffect } from 'react';
import { Order, OrderStatus, UserRole, EmbroiderySlot, SleeveConfig, OrderItem } from '../types';
import { STAFF_MEMBERS } from '../constants'; // Aún se usa para la lógica de asignación, pero se actualizará para consultar Supabase
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

  // --- STATE LOCAL PARA PROCESAMIENTO DE IA ---
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // --- HELPERS ---
  const assignOptimalStaff = async (role: UserRole, currentOrders: Order[]): Promise<string | undefined> => {
    // Fetch actual staff members from profiles table
    const { data: staffProfiles, error: staffError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('role', role);

    if (staffError) {
      console.error('Error fetching staff profiles:', staffError);
      return undefined;
    }

    const candidates = staffProfiles || [];
    if (candidates.length === 0) return undefined;

    const loads = candidates.map(c => {
      const count = currentOrders.filter(o =>
        (role === UserRole.DESIGNER ? o.assignedDesignerId === c.id : o.assignedEmbroidererId === c.id) &&
        o.status !== OrderStatus.DISPATCHED && o.status !== OrderStatus.DESIGN_REJECTED
      ).length;
      return { id: c.id, count };
    });

    loads.sort((a, b) => a.count - b.count);
    return loads[0]?.id;
  };

  // --- FETCH ORDERS (READ OPERATION) ---
  const fetchOrders = async (): Promise<Order[]> => {
    if (!userId || !userEmail) return [];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw profileError;
    }

    const userRole = profile?.role as UserRole;

    let query = supabase
      .from('orders')
      .select('*, items:order_items(*, customizations:embroidery_slots(*))')
      .order('order_date', { ascending: false });

    // Apply RLS filtering based on role (though Supabase RLS policies should handle most of this)
    if (userRole === UserRole.CLIENT) {
      // Filter by client_user_id first, then fallback to email for older orders or if client_user_id is not set by n8n
      query = query.or(`client_user_id.eq.${userId},email.eq.${userEmail}`);
    }
    // For staff roles, RLS policies are set to allow them to see relevant orders.
    // No explicit filter here, relying on RLS.

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    // Map Supabase data to frontend types
    const orders: Order[] = data.map(dbOrder => ({
      id: dbOrder.id,
      customerName: dbOrder.customer_name,
      email: dbOrder.email,
      phone: dbOrder.phone || '',
      shippingAddress: dbOrder.shipping_address || '',
      orderDate: dbOrder.order_date,
      status: dbOrder.status as OrderStatus,
      totalAmount: dbOrder.total_amount || 0,
      assignedDesignerId: dbOrder.assigned_designer_id || undefined,
      assignedEmbroidererId: dbOrder.assigned_embroiderer_id || undefined,
      designImage: dbOrder.design_image || undefined,
      technicalSheet: dbOrder.technical_sheet || undefined,
      machineFile: dbOrder.machine_file || undefined,
      clientFeedback: dbOrder.client_feedback || undefined,
      productionIssue: dbOrder.production_issue || undefined,
      finishedProductPhoto: dbOrder.finished_product_photo || undefined,
      packedProductPhoto: dbOrder.packed_product_photo || undefined,
      generatedMockup: dbOrder.generated_mockup || undefined,
      designHistory: [], // Design history is not fetched in this query for simplicity, can be added if needed
      items: dbOrder.items.map((dbItem: any) => ({
        id: dbItem.id,
        groupId: dbItem.pack || undefined, // Map 'pack' to 'groupId'
        sku: dbItem.sku,
        productName: dbItem.product_name,
        quantity: dbItem.quantity,
        price: dbItem.unit_price || 0,
        sleeve: dbItem.sleeve_config ? (dbItem.sleeve_config as SleeveConfig) : undefined,
        customizations: dbItem.customizations.map((dbSlot: any) => ({
          id: dbSlot.id,
          petName: dbSlot.pet_name || undefined,
          photoUrl: dbSlot.photo_url || undefined,
          position: dbSlot.position || undefined,
          includeHalo: dbSlot.include_halo,
          status: dbSlot.status as 'EMPTY' | 'ANALYZING' | 'APPROVED' | 'REJECTED',
          aiReason: dbSlot.ai_reason || undefined,
        })),
      })),
    }));

    return orders;
  };

  const { data: orders, isLoading: isLoadingOrders, error: ordersError } = useQuery<Order[], Error>({
    queryKey: ['orders', userId, userEmail],
    queryFn: fetchOrders,
    enabled: !!userId && !!userEmail, // Only fetch if user is logged in
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // --- MUTATIONS (WRITE OPERATIONS) ---

  // 1. Update Specific Slot (Client/AI actions)
  const updateSlotMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; updates: Partial<EmbroiderySlot> }>({
    mutationFn: async ({ orderId, itemId, slotId, updates }) => {
      const { error } = await supabase
        .from('embroidery_slots')
        .update(updates)
        .eq('id', slotId);

      if (error) throw error;

      // After updating the slot, re-evaluate the order status
      const currentOrder = orders?.find(o => o.id === orderId);
      if (currentOrder) {
        const updatedItems = currentOrder.items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              customizations: item.customizations.map(slot =>
                slot.id === slotId ? { ...slot, ...updates } : slot
              ),
            };
          }
          return item;
        });

        let allApproved = true;
        let anyRejected = false;
        let anyPending = false;
        let anyAnalyzing = false;

        updatedItems.forEach(i => i.customizations.forEach(c => {
          if (c.status === 'REJECTED') anyRejected = true;
          if (c.status === 'ANALYZING') anyAnalyzing = true;
          if (c.status === 'APPROVED') { /* noop */ }
          else { allApproved = false; anyPending = true; }
        }));

        let newStatus = currentOrder.status;
        let updatesOrder: Partial<Order> = {};

        if ([OrderStatus.PENDING_UPLOAD, OrderStatus.ACTION_REQUIRED, OrderStatus.ANALYZING_IMAGE, OrderStatus.WAITING_FOR_DESIGN].includes(currentOrder.status)) {
          if (anyAnalyzing) newStatus = OrderStatus.ANALYZING_IMAGE;
          else if (anyRejected) newStatus = OrderStatus.ACTION_REQUIRED;
          else if (allApproved) {
            newStatus = OrderStatus.WAITING_FOR_DESIGN;
            if (!currentOrder.assignedDesignerId) {
              updatesOrder.assignedDesignerId = await assignOptimalStaff(UserRole.DESIGNER, orders || []);
            }
          }
          else if (anyPending) newStatus = OrderStatus.PENDING_UPLOAD;
        }

        if (newStatus !== currentOrder.status || Object.keys(updatesOrder).length > 0) {
          await supabase.from('orders').update({ status: newStatus, assigned_designer_id: updatesOrder.assignedDesignerId, assigned_embroiderer_id: updatesOrder.assignedEmbroidererId }).eq('id', orderId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Bordado actualizado correctamente.');
    },
    onError: (err) => {
      toast.error(`Error al actualizar bordado: ${err.message}`);
    },
  });

  // 1b. Update Sleeve Configuration
  const updateSleeveMutation = useMutation<void, Error, { orderId: string; itemId: string; config: SleeveConfig | undefined }>({
    mutationFn: async ({ orderId, itemId, config }) => {
      const { error } = await supabase
        .from('order_items')
        .update({ sleeve_config: config })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Configuración de manga actualizada.');
    },
    onError: (err) => {
      toast.error(`Error al actualizar manga: ${err.message}`);
    },
  });

  // 2. Process Image Upload with AI
  const handleImageUploadMutation = useMutation<void, Error, { file: File; orderId: string; itemId: string; slotId: string }>({
    mutationFn: async ({ file, orderId, itemId, slotId }) => {
      setIsProcessingAI(true);
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
      });
      const base64 = await base64Promise;

      const filePath = `${orderId}/${itemId}/${slotId}-${Date.now()}.jpeg`;
      const photoUrl = await uploadFile(file, filePath);

      if (!photoUrl) {
        throw new Error('No se pudo subir la imagen.');
      }

      // Optimistic update (Will sync across pack thanks to DB trigger)
      await updateSlotMutation.mutateAsync({ orderId, itemId, slotId, updates: { photoUrl, status: 'ANALYZING' } });

      const analysis = await analyzeImageQuality(base64);
      await updateSlotMutation.mutateAsync({
        orderId,
        itemId,
        slotId,
        updates: {
          status: analysis.approved ? 'APPROVED' : 'REJECTED',
          aiReason: analysis.reason,
        },
      });
    },
    onSuccess: () => {
      toast.success('Imagen subida y analizada por IA.');
    },
    onError: (err) => {
      toast.error(`Error al procesar imagen: ${err.message}`);
    },
    onSettled: () => {
      setIsProcessingAI(false);
    },
  });

  // 3. AI Image Editing
  const handleEditImageMutation = useMutation<void, Error, { orderId: string; itemId: string; slotId: string; currentImage: string; prompt: string }>({
    mutationFn: async ({ orderId, itemId, slotId, currentImage, prompt }) => {
      if (!currentImage || !prompt) throw new Error('Imagen o prompt no proporcionados.');
      setIsProcessingAI(true);

      await updateSlotMutation.mutateAsync({ orderId, itemId, slotId, updates: { status: 'ANALYZING' } });

      const newImageBase64 = await editImageWithPrompt(currentImage, prompt);
      const filePath = `${orderId}/${itemId}/${slotId}-edited-${Date.now()}.jpeg`;
      const photoUrl = await uploadBase64(newImageBase64, filePath, 'image/jpeg');

      if (!photoUrl) {
        throw new Error('No se pudo subir la imagen editada.');
      }

      const analysis = await analyzeImageQuality(newImageBase64);

      await updateSlotMutation.mutateAsync({
        orderId,
        itemId,
        slotId,
        updates: {
          photoUrl: photoUrl,
          status: analysis.approved ? 'APPROVED' : 'REJECTED',
          aiReason: analysis.approved ? 'Imagen mejorada y aprobada por IA.' : `Imagen editada pero aún rechazada: ${analysis.reason}`,
        },
      });
    },
    onSuccess: () => {
      toast.success('Imagen editada y re-analizada por IA.');
    },
    onError: (err) => {
      toast.error(`Error al editar imagen: ${err.message}`);
    },
    onSettled: () => {
      setIsProcessingAI(false);
    },
  });

  // 4. Designer Submission
  const submitDesignMutation = useMutation<void, Error, { orderId: string; assets: { image: string; technicalSheet: string; machineFile: string } }>({
    mutationFn: async ({ orderId, assets }) => {
      const currentOrder = orders?.find(o => o.id === orderId);
      if (!currentOrder) throw new Error('Orden no encontrada.');

      const uploadPromises = [];
      const uploadedUrls: Partial<{ designImage: string; technicalSheet: string; machineFile: string }> = {};

      if (assets.image) {
        const path = `designs/${orderId}/design-${Date.now()}.jpeg`;
        uploadPromises.push(uploadBase64(assets.image, path, 'image/jpeg').then(url => uploadedUrls.designImage = url || undefined));
      }
      if (assets.technicalSheet) {
        const path = `designs/${orderId}/technical-sheet-${Date.now()}.pdf`; // Assuming PDF or image
        const mimeType = assets.technicalSheet.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
        uploadPromises.push(uploadBase64(assets.technicalSheet, path, mimeType).then(url => uploadedUrls.technicalSheet = url || undefined));
      }
      if (assets.machineFile) {
        const path = `designs/${orderId}/machine-file-${Date.now()}.dst`; // Assuming DST/EMB
        uploadPromises.push(uploadBase64(assets.machineFile, path, 'application/octet-stream').then(url => uploadedUrls.machineFile = url || undefined));
      }

      await Promise.all(uploadPromises);

      // Prepare design history (not currently stored in DB, but could be)
      // For now, we just update the current design fields
      const updates: Partial<Order> = {
        status: OrderStatus.DESIGN_REVIEW,
        design_image: uploadedUrls.designImage,
        technical_sheet: uploadedUrls.technicalSheet,
        machine_file: uploadedUrls.machineFile,
        client_feedback: null, // Clear previous feedback
      };

      const { error } = await supabase
        .from('orders')
        .update({
          status: updates.status,
          design_image: updates.design_image,
          technical_sheet: updates.technical_sheet,
          machine_file: updates.machine_file,
          client_feedback: updates.client_feedback
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Diseño enviado a revisión del cliente.');
    },
    onError: (err) => {
      toast.error(`Error al enviar diseño: ${err.message}`);
    },
  });

  // 5. Client Review
  const handleClientReviewMutation = useMutation<void, Error, { orderId: string; approved: boolean; feedback?: string }>({
    mutationFn: async ({ orderId, approved, feedback }) => {
      const currentOrder = orders?.find(o => o.id === orderId);
      if (!currentOrder) throw new Error('Orden no encontrada.');

      const updates: Partial<Order> = {
        status: approved ? OrderStatus.READY_TO_EMBROIDER : OrderStatus.DESIGN_REJECTED,
        client_feedback: feedback || null,
      };

      if (approved && !currentOrder.assignedEmbroidererId) {
        updates.assignedEmbroidererId = await assignOptimalStaff(UserRole.EMBROIDERER, orders || []);
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: updates.status,
          client_feedback: updates.client_feedback,
          assigned_embroiderer_id: updates.assignedEmbroidererId
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Revisión de diseño registrada.');
    },
    onError: (err) => {
      toast.error(`Error al registrar revisión: ${err.message}`);
    },
  });

  // 6. Production Status Updates
  const updateOrderStatusMutation = useMutation<void, Error, { orderId: string; newStatus: OrderStatus }>({
    mutationFn: async ({ orderId, newStatus }) => {
      const currentOrder = orders?.find(o => o.id === orderId);
      if (!currentOrder) throw new Error('Orden no encontrada.');

      let updates: Partial<Order> = { status: newStatus };

      if (newStatus === OrderStatus.WAITING_FOR_DESIGN && !currentOrder.assignedDesignerId) {
        updates.assignedDesignerId = await assignOptimalStaff(UserRole.DESIGNER, orders || []);
      }
      if (newStatus === OrderStatus.READY_TO_EMBROIDER && !currentOrder.assignedEmbroidererId) {
        updates.assignedEmbroidererId = await assignOptimalStaff(UserRole.EMBROIDERER, orders || []);
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: updates.status,
          assigned_designer_id: updates.assignedDesignerId,
          assigned_embroiderer_id: updates.assignedEmbroidererId
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Estado de la orden actualizado.');
    },
    onError: (err) => {
      toast.error(`Error al actualizar estado: ${err.message}`);
    },
  });

  // 7. Issue Reporting
  const reportIssueMutation = useMutation<void, Error, { orderId: string; reason: string }>({
    mutationFn: async ({ orderId, reason }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: OrderStatus.ON_HOLD, production_issue: reason })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.warn('Incidencia reportada. Orden en espera.');
    },
    onError: (err) => {
      toast.error(`Error al reportar incidencia: ${err.message}`);
    },
  });

  const resolveIssueMutation = useMutation<void, Error, { orderId: string }>({
    mutationFn: async ({ orderId }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: OrderStatus.IN_PROGRESS, production_issue: null })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Incidencia resuelta. Orden reanudada.');
    },
    onError: (err) => {
      toast.error(`Error al resolver incidencia: ${err.message}`);
    },
  });

  // 8. Evidence Upload
  const handleEvidenceUploadMutation = useMutation<void, Error, { file: File; orderId: string; field: 'finishedProductPhoto' | 'packedProductPhoto' }>({
    mutationFn: async ({ file, orderId, field }) => {
      const filePath = `evidence/${orderId}/${field}-${Date.now()}.jpeg`;
      const photoUrl = await uploadFile(file, filePath);

      if (!photoUrl) {
        throw new Error('No se pudo subir la evidencia.');
      }

      const updateField = field === 'finishedProductPhoto' ? 'finished_product_photo' : 'packed_product_photo';

      const { error } = await supabase
        .from('orders')
        .update({ [updateField]: photoUrl })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Evidencia de producción subida.');
    },
    onError: (err) => {
      toast.error(`Error al subir evidencia: ${err.message}`);
    },
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`Error al cerrar sesión: ${error.message}`);
    } else {
      queryClient.clear(); // Limpiar caché de React Query
      toast.success('Sesión cerrada correctamente.');
    }
  };

  return {
    orders: orders || [],
    isLoading: isLoadingOrders || isProcessingAI || updateSlotMutation.isPending || handleImageUploadMutation.isPending || handleEditImageMutation.isPending || submitDesignMutation.isPending || handleClientReviewMutation.isPending || updateOrderStatusMutation.isPending || reportIssueMutation.isPending || resolveIssueMutation.isPending || handleEvidenceUploadMutation.isPending || updateSleeveMutation.isPending,
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