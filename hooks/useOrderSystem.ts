import { useState, useEffect } from 'react';
import { Order, OrderStatus, UserRole, EmbroiderySlot, SleeveConfig } from '../types';
import { INITIAL_ORDERS, STAFF_MEMBERS } from '../constants';
import { analyzeImageQuality, editImageWithPrompt } from '../services/geminiService';

export const useOrderSystem = () => {
  // --- STATE ---
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('malcriados_orders');
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch (e) {
      return INITIAL_ORDERS;
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('malcriados_orders', JSON.stringify(orders));
  }, [orders]);

  // --- HELPERS ---
  const assignOptimalStaff = (role: UserRole, currentOrders: Order[]): string | undefined => {
    const candidates = STAFF_MEMBERS.filter(s => s.role === role);
    if (candidates.length === 0) return undefined;

    const loads = candidates.map(c => {
      const count = currentOrders.filter(o =>
        (role === UserRole.DESIGNER ? o.assignedDesignerId === c.id : o.assignedEmbroidererId === c.id) &&
        o.status !== OrderStatus.DISPATCHED && o.status !== OrderStatus.DESIGN_REJECTED
      ).length;
      return { id: c.id, count };
    });

    loads.sort((a, b) => a.count - b.count);
    return loads[0].id;
  };

  // --- ACTIONS ---

  // 1. Update Specific Slot (Client/AI actions)
  // UPDATED: Supports Pack Synchronization. If item has groupId, syncs photo/name/status to siblings.
  const updateSlot = (orderId: string, itemId: string, slotId: string, updates: Partial<EmbroiderySlot>) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;

      // Find the target item to check for GroupID
      const targetItem = o.items.find(i => i.id === itemId);
      const groupId = targetItem?.groupId;
      
      // Find index of slot in the target item (to sync with siblings)
      const slotIndex = targetItem?.customizations.findIndex(c => c.id === slotId) ?? -1;

      const newItems = o.items.map(item => {
        // Condition A: It's the exact item we are editing
        // Condition B: It's a sibling in the same Pack/Group AND we are updating shared properties (Photo, Name, Status, Halo)
        // Note: Position is NOT shared.
        const shouldSync = (item.id === itemId) || (groupId && item.groupId === groupId && slotIndex !== -1);
        
        if (!shouldSync) return item;

        // If syncing to a sibling, we need to find the corresponding slot by Index, not ID
        const targetSlot = (item.id === itemId) 
            ? item.customizations.find(c => c.id === slotId)
            : item.customizations[slotIndex];
            
        if (!targetSlot) return item;

        // Filter updates: Position is unique per item, everything else (Art) is shared in a pack
        const filteredUpdates = (item.id === itemId) ? updates : { ...updates, position: undefined };
        
        // If we filtered out everything (e.g. only position changed), don't update sibling
        if (item.id !== itemId && Object.values(filteredUpdates).every(v => v === undefined)) return item;

        const newCustomizations = item.customizations.map(c => {
          if (c.id !== targetSlot.id) return c;
          return { ...c, ...filteredUpdates };
        });
        return { ...item, customizations: newCustomizations };
      });

      // Calculate aggregated status
      let allApproved = true;
      let anyRejected = false;
      let anyPending = false;
      let anyAnalyzing = false;

      newItems.forEach(i => i.customizations.forEach(c => {
        if (c.status === 'REJECTED') anyRejected = true;
        if (c.status === 'ANALYZING') anyAnalyzing = true;
        if (c.status === 'APPROVED') { /* noop */ }
        else { allApproved = false; anyPending = true; }
      }));

      let newStatus = o.status;
      let updatesOrder: Partial<Order> = {};

      if ([OrderStatus.PENDING_UPLOAD, OrderStatus.ACTION_REQUIRED, OrderStatus.ANALYZING_IMAGE, OrderStatus.WAITING_FOR_DESIGN].includes(o.status)) {
        if (anyAnalyzing) newStatus = OrderStatus.ANALYZING_IMAGE;
        else if (anyRejected) newStatus = OrderStatus.ACTION_REQUIRED;
        else if (allApproved) {
          newStatus = OrderStatus.WAITING_FOR_DESIGN;
          if (!o.assignedDesignerId) {
            updatesOrder.assignedDesignerId = assignOptimalStaff(UserRole.DESIGNER, prev) || undefined;
          }
        }
        else if (anyPending) newStatus = OrderStatus.PENDING_UPLOAD;
      }

      return { ...o, items: newItems, status: newStatus, ...updatesOrder };
    }));
  };

  // 1b. Update Sleeve Configuration
  const updateSleeve = (orderId: string, itemId: string, sleeveConfig: SleeveConfig | undefined) => {
      setOrders(prev => prev.map(o => {
          if (o.id !== orderId) return o;
          const newItems = o.items.map(item => {
              if (item.id !== itemId) return item;
              return { ...item, sleeve: sleeveConfig };
          });
          return { ...o, items: newItems };
      }));
  };

  // 2. Process Image Upload with AI
  const handleImageUpload = async (file: File, orderId: string, itemId: string, slotId: string) => {
    setIsProcessing(true);
    const reader = new FileReader();
    
    return new Promise<void>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = reader.result as string;
            // Optimistic update (Will sync across pack thanks to logic in updateSlot)
            updateSlot(orderId, itemId, slotId, { photoUrl: base64, status: 'ANALYZING' });
            
            try {
                const analysis = await analyzeImageQuality(base64);
                updateSlot(orderId, itemId, slotId, { 
                    status: analysis.approved ? 'APPROVED' : 'REJECTED', 
                    aiReason: analysis.reason 
                });
            } catch (err) {
                console.error(err);
                updateSlot(orderId, itemId, slotId, { status: 'REJECTED', aiReason: "Error al conectar con la IA." });
            } finally {
                setIsProcessing(false);
                resolve();
            }
        };
    });
  };

  // 3. AI Image Editing
  const handleEditImage = async (orderId: string, itemId: string, slotId: string, currentImage: string, prompt: string) => {
    if (!currentImage || !prompt) return;
    setIsProcessing(true);
    updateSlot(orderId, itemId, slotId, { status: 'ANALYZING' });

    try {
      const newImage = await editImageWithPrompt(currentImage, prompt);
      const analysis = await analyzeImageQuality(newImage);

      updateSlot(orderId, itemId, slotId, {
        photoUrl: newImage,
        status: analysis.approved ? 'APPROVED' : 'REJECTED',
        aiReason: analysis.approved ? 'Imagen mejorada y aprobada por IA.' : `Imagen editada pero aún rechazada: ${analysis.reason}`
      });
    } catch (e) {
      alert("Error editando imagen.");
      updateSlot(orderId, itemId, slotId, { status: 'REJECTED', aiReason: "Falló la edición de imagen." });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Designer Submission
  const submitDesign = (orderId: string, assets: { image: string, technicalSheet: string, machineFile: string }) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;

      const history = o.designHistory || [];
      if (o.designImage) {
        history.push({
          imageUrl: o.designImage,
          machineFile: o.machineFile,
          technicalSheet: o.technicalSheet,
          createdAt: new Date().toISOString(),
          feedback: o.clientFeedback || 'Versión Anterior'
        });
      }

      return {
        ...o,
        status: OrderStatus.DESIGN_REVIEW,
        designImage: assets.image,
        technicalSheet: assets.technicalSheet,
        machineFile: assets.machineFile,
        designHistory: history,
        clientFeedback: undefined
      };
    }));
  };

  // 5. Client Review
  const handleClientReview = (orderId: string, approved: boolean, feedback?: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updates: Partial<Order> = {
        status: approved ? OrderStatus.READY_TO_EMBROIDER : OrderStatus.DESIGN_REJECTED,
        clientFeedback: feedback
      };

      if (approved && !o.assignedEmbroidererId) {
        updates.assignedEmbroidererId = assignOptimalStaff(UserRole.EMBROIDERER, prev) || undefined;
      }

      return { ...o, ...updates };
    }));
  };

  // 6. Production Status Updates
  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      let updates: Partial<Order> = { status: newStatus };

      if (newStatus === OrderStatus.WAITING_FOR_DESIGN && !o.assignedDesignerId) {
        updates.assignedDesignerId = assignOptimalStaff(UserRole.DESIGNER, prev);
      }
      if (newStatus === OrderStatus.READY_TO_EMBROIDER && !o.assignedEmbroidererId) {
        updates.assignedEmbroidererId = assignOptimalStaff(UserRole.EMBROIDERER, prev);
      }
      return { ...o, ...updates };
    }));
  };

  // 7. Issue Reporting
  const reportIssue = (orderId: string, reason: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.ON_HOLD, productionIssue: reason } : o));
  };

  const resolveIssue = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.IN_PROGRESS, productionIssue: undefined } : o));
  };

  // 8. Evidence Upload
  const handleEvidenceUpload = (file: File, orderId: string, field: 'finishedProductPhoto' | 'packedProductPhoto') => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: base64 } : o));
    };
  };

  const resetSystem = () => {
      localStorage.removeItem('malcriados_orders');
      setOrders(INITIAL_ORDERS);
      window.location.reload();
  };

  return {
    orders,
    isProcessing,
    updateSlot,
    updateSleeve,
    handleImageUpload,
    handleEditImage,
    submitDesign,
    handleClientReview,
    updateOrderStatus,
    reportIssue,
    resolveIssue,
    handleEvidenceUpload,
    resetSystem
  };
};