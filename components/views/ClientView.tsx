import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, SleeveConfig, OrderItem, EmbroiderySlot } from '../../types';
import { QUICK_EDITS } from '../../constants';
import StatusBadge from '../StatusBadge';
import OrderProgress from '../OrderProgress';
import GarmentVisualizer from '../GarmentVisualizer';
import SleeveDesigner from '../SleeveDesigner';
import { Search, Lock, Palette, Sparkles, CheckCircle, XCircle, Wand2, Loader2, Image as ImageIcon, Check, Shirt, Info, Upload, Plus, Minus, Tag, Box, AlertTriangle, Send, Truck, ArrowRight, Layers, Link, Save, RotateCcw, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientViewProps {
  orders: Order[];
  onUpdateSlot: (orderId: string, itemId: string, slotId: string, updates: any) => void;
  onInitiateUpload: (file: File, orderId: string, itemId: string, slotId: string) => void;
  onEditImage: (orderId: string, itemId: string, slotId: string, currentImage: string, prompt: string) => void;
  onReviewDesign: (orderId: string, approved: boolean, feedback?: string) => void;
  isProcessing: boolean;
  onUpdateSleeve?: (orderId: string, itemId: string, config: SleeveConfig | undefined) => void;
  onFinalizeOrder: (orderId: string) => void;
}

// Helper Types for Local State
type PendingSlotChange = {
    orderId: string;
    itemId: string;
    changes: Partial<EmbroiderySlot>;
}

type PendingSleeveChange = {
    orderId: string;
    itemId: string;
    config: SleeveConfig | undefined;
}

const ClientView: React.FC<ClientViewProps> = ({ 
  orders, onUpdateSlot, onInitiateUpload, onEditImage, onReviewDesign, isProcessing, onUpdateSleeve, onFinalizeOrder 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- LOCAL STATE BUFFER (The solution to the lag issue) ---
  // We store changes here first, then commit them to DB in batch.
  const [pendingSlotChanges, setPendingSlotChanges] = useState<Record<string, PendingSlotChange>>({});
  const [pendingSleeveChanges, setPendingSleeveChanges] = useState<Record<string, PendingSleeveChange>>({});

  const hasUnsavedChanges = Object.keys(pendingSlotChanges).length > 0 || Object.keys(pendingSleeveChanges).length > 0;

  // --- FILTERING ---
  const filteredOrders = orders.filter(o => 
      o.id.includes(searchTerm) || 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // --- HELPERS FOR LOCAL STATE & SYNC ---
  
  // Helper to find all sibling slots in a bundle to update them visually in sync
  const handleLocalSlotChange = (order: Order, item: OrderItem, slotId: string, slotIndex: number, change: Partial<EmbroiderySlot>) => {
      const newPending = { ...pendingSlotChanges };

      // 1. Update the target slot
      newPending[slotId] = {
          orderId: order.id,
          itemId: item.id,
          changes: { ...(newPending[slotId]?.changes || {}), ...change }
      };

      // 2. MAGIC SYNC: If item is part of a pack, update siblings locally too so user sees it instant
      if (item.groupId) {
          const siblings = order.items.filter(i => i.groupId === item.groupId && i.id !== item.id);
          siblings.forEach(sibling => {
             const siblingSlot = sibling.customizations[slotIndex];
             if (siblingSlot) {
                 newPending[siblingSlot.id] = {
                     orderId: order.id,
                     itemId: sibling.id,
                     changes: { ...(newPending[siblingSlot.id]?.changes || {}), ...change }
                 };
             }
          });
      }

      setPendingSlotChanges(newPending);
  };

  const handleLocalSleeveChange = (orderId: string, itemId: string, config: SleeveConfig | undefined) => {
      setPendingSleeveChanges(prev => ({
          ...prev,
          [itemId]: { orderId, itemId, config }
      }));
  };

  const saveAllChanges = async () => {
      setIsSaving(true);
      try {
          // 1. Commit Slot Changes
          const slotPromises = Object.entries(pendingSlotChanges).map(([slotId, data]) => {
             return onUpdateSlot(data.orderId, data.itemId, slotId, data.changes);
          });

          // 2. Commit Sleeve Changes
          const sleevePromises = Object.entries(pendingSleeveChanges).map(([itemId, data]) => {
              return onUpdateSleeve?.(data.orderId, itemId, data.config);
          });

          await Promise.all([...slotPromises, ...sleevePromises]);
          
          setPendingSlotChanges({});
          setPendingSleeveChanges({});
          toast.success("¡Cambios guardados correctamente!");

      } catch (e) {
          toast.error("Hubo un error al guardar los cambios.");
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  const discardChanges = () => {
      if(window.confirm("¿Estás seguro de descartar los cambios no guardados?")) {
          setPendingSlotChanges({});
          setPendingSleeveChanges({});
      }
  };

  // HELPER: Detect sleeve item robustly
  const isSleeveItem = (item: OrderItem) => {
      if (item.customizationType === 'TEXT_ONLY') return true;
      return item.sku && item.sku.toLowerCase() === 'extra-manga';
  };

  // HELPER: GROUP ITEMS
  const groupItems = (items: OrderItem[]) => {
      const bundles: Record<string, OrderItem[]> = {};
      const singles: OrderItem[] = [];

      items.forEach(item => {
          if (isSleeveItem(item)) return; 
          if (item.groupId) {
              if (!bundles[item.groupId]) bundles[item.groupId] = [];
              bundles[item.groupId].push(item);
          } else {
              singles.push(item);
          }
      });
      return { bundles, singles };
  };

  // HELPER: Calculate Real-Time Credits (DB + Pending)
  const calculateSleeveStats = (order: Order) => {
      const totalSleeveCredits = order.items.filter(i => isSleeveItem(i)).reduce((acc, item) => acc + item.quantity, 0);
      
      // Count sleeves assigned in DB, adjusted by pending changes
      let assignedCount = 0;
      order.items.forEach(item => {
          if (isSleeveItem(item)) return;
          
          const pending = pendingSleeveChanges[item.id];
          if (pending !== undefined) {
              // If there is a pending change, use that state (if config exists, it counts)
              if (pending.config) assignedCount++;
          } else {
              // Fallback to DB
              if (item.sleeve) assignedCount++;
          }
      });

      return {
          total: totalSleeveCredits,
          assigned: assignedCount,
          remaining: totalSleeveCredits - assignedCount
      };
  };

  // SUB-COMPONENT: PET CARD
  const PetSlotCard: React.FC<{ 
      slot: EmbroiderySlot; 
      index: number; 
      item: OrderItem; 
      order: Order; 
      isLocked: boolean; 
      isPrimaryInBundle?: boolean; 
  }> = ({ 
      slot, index, item, order, isLocked, isPrimaryInBundle = true 
  }) => {
      // MERGE LOCAL STATE WITH PROPS
      // If there's a pending change, show that. Otherwise show DB value.
      const pending = pendingSlotChanges[slot.id]?.changes;
      
      const displayValues = {
          petName: pending?.petName !== undefined ? pending.petName : slot.petName,
          position: pending?.position !== undefined ? pending.position : slot.position,
          includeHalo: pending?.includeHalo !== undefined ? pending.includeHalo : slot.includeHalo,
      };

      const isModified = !!pending;

      return (
      <div key={slot.id} className={`border rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 relative ${isLocked ? 'bg-gray-50/50 border-gray-200' : 'bg-white border-gray-200 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)]'} ${isModified ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}>
         
         {isModified && (
             <div className="absolute -top-3 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-20 animate-in zoom-in">
                 Modificado
             </div>
         )}

         {/* SLOT HEADER */}
         <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
               <span className="bg-brand-100 text-brand-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">{index + 1}</span>
               Mascota #{index + 1}
            </span>
            {slot.status === 'APPROVED' && <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-green-100"><CheckCircle className="w-3 h-3"/> Aprobado</span>}
            {slot.status === 'REJECTED' && <span className="bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-red-100"><XCircle className="w-3 h-3"/> Acción Requerida</span>}
            {slot.status === 'ANALYZING' && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-blue-100 animate-pulse"><Sparkles className="w-3 h-3"/> Analizando...</span>}
         </div>

         <div className="flex flex-col sm:flex-row gap-6">
            {/* IMAGE UPLOAD & PREVIEW */}
            {isPrimaryInBundle && (
            <div className="w-full sm:w-40 flex-shrink-0 flex flex-col gap-2">
                <div className={`aspect-square rounded-xl overflow-hidden relative border group shadow-inner ${isLocked ? 'bg-gray-100 border-gray-200' : 'bg-gray-100 border-gray-200'}`}>
                  {slot.photoUrl ? (
                    <img src={slot.photoUrl} alt="Pet" className={`w-full h-full object-cover transition-transform duration-500 ${!isLocked && 'group-hover:scale-110'}`} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs text-center px-2">Subir Foto Mascota {index + 1}</span>
                    </div>
                  )}
                  
                  {/* Upload logic triggers IMMEDIATE save via React Query invaliation, so we don't use local state for files */}
                  {(slot.status === 'EMPTY' || slot.status === 'REJECTED') && !isLocked && (
                     <label className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer z-10">
                        <Upload className="w-8 h-8 text-white mb-2" />
                        <span className="text-xs text-white font-bold tracking-wide">SUBIR FOTO</span>
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    if(hasUnsavedChanges) {
                                        toast.error("Por favor guarda tus cambios de texto antes de subir una foto.");
                                        return;
                                    }
                                    onInitiateUpload(e.target.files[0], order.id, item.id, slot.id);
                                    e.target.value = '';
                                }
                            }} 
                        />
                     </label>
                  )}
                  
                  {slot.status === 'APPROVED' && (
                     <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-green-900/80 to-transparent p-2 flex justify-center">
                         <span className="text-[10px] font-bold text-white flex items-center gap-1"><Check className="w-3 h-3"/> Aprobada por IA</span>
                     </div>
                  )}
                </div>
                
                {slot.status === 'REJECTED' && (
                  <div className="bg-red-50 p-2 rounded-lg border border-red-100 animate-in slide-in-from-top-1 fade-in">
                    <p className="text-[10px] text-red-700 font-medium leading-tight flex gap-1">
                      <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {slot.aiReason}
                    </p>
                  </div>
                )}
            </div>
            )}

            {/* CONFIGURATION FORM */}
            <div className="flex-1 space-y-4 min-w-0">
               {isPrimaryInBundle && (
               <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nombre Mascota {index + 1}</label>
                  <input 
                    type="text" 
                    disabled={isLocked}
                    placeholder="Ej: Rocky"
                    className={`w-full text-sm border-gray-200 rounded-lg py-2.5 px-3 transition-shadow ${isLocked ? 'bg-gray-100 text-gray-900 font-bold' : 'bg-white focus:ring-2 focus:ring-brand-500'}`}
                    value={displayValues.petName || ''}
                    // HERE IS THE FIX: Update local state instead of calling API immediately
                    onChange={(e) => handleLocalSlotChange(order, item, slot.id, index, { petName: e.target.value })}
                  />
               </div>
               )}

               <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Ubicación en {item.productName.includes('Pack') ? (item.sku.includes('hood') ? 'Hoodie/Polerón' : item.sku.includes('cap') || item.sku.includes('jockey') ? 'Jockey' : 'Prenda Principal') : 'Prenda'}</span>
                      {isPrimaryInBundle === false && <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 rounded">Configuración Individual</span>}
                  </label>
                  <GarmentVisualizer 
                        productName={item.productName}
                        sku={item.sku}
                        selected={displayValues.position} 
                        // HERE IS THE FIX: Update local state
                        onSelect={(pos) => !isLocked && handleLocalSlotChange(order, item, slot.id, index, { position: pos })}
                        slotCount={item.customizations.length}
                        readOnly={isLocked}
                  />
               </div>

               {isPrimaryInBundle && (
               <div className="flex items-center gap-3">
                  {isLocked ? (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border w-full ${displayValues.includeHalo ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                        {displayValues.includeHalo ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span className="text-xs font-bold">{displayValues.includeHalo ? 'Con Aureola 😇' : 'Sin Aureola'}</span>
                      </div>
                  ) : (
                      <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100 w-full cursor-pointer hover:bg-gray-100" onClick={() => handleLocalSlotChange(order, item, slot.id, index, { includeHalo: !displayValues.includeHalo })}>
                          <button 
                            // Using div onClick parent instead for better hit area
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${displayValues.includeHalo ? 'bg-brand-500 border-brand-600 text-white shadow-sm' : 'bg-white border-gray-300'}`}
                          >
                            {displayValues.includeHalo && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-xs font-medium text-gray-700">Incluir Aureola 😇</span>
                      </div>
                  )}
               </div>
               )}
            </div>
         </div>
      </div>
  )};

  return (
    <div className="space-y-8 pb-24"> {/* Added padding bottom for floating bar */}
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-900">Mis Pedidos</h2>
           <p className="text-gray-500 text-sm">Gestiona la personalización de tus productos Malcriados</p>
        </div>
        <div className="relative">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
                type="text" 
                placeholder="Buscar pedido..." 
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 bg-white focus:ring-2 focus:ring-brand-500 text-gray-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="grid gap-12">
        {filteredOrders.map(order => {
            const isLocked = ![
                OrderStatus.PENDING_UPLOAD,
                OrderStatus.ACTION_REQUIRED,
                OrderStatus.ANALYZING_IMAGE,
                OrderStatus.DESIGN_REJECTED
            ].includes(order.status);

            const { bundles, singles } = groupItems(order.items);
            const sleeveStats = calculateSleeveStats(order);

            // Check if order is complete to allow sending
            const isOrderComplete = order.items.every(item => 
                isSleeveItem(item) || 
                item.customizations.every(slot => slot.status === 'APPROVED' || slot.status === 'ANALYZING' || (slot.photoUrl)) 
                // We check photoUrl because status might still be EMPTY locally before AI runs
            );
            
            const isReadyToSend = isOrderComplete && !hasUnsavedChanges && !isLocked;

            return (
          <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ring-1 ring-black/5">
            
            {/* ORDER HEADER */}
            <div className="bg-gray-50/80 backdrop-blur px-6 pt-6 pb-2 border-b border-gray-100">
               <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                        Orden #{order.id}
                        {isLocked && (
                          <span title="Orden Bloqueada por Estado Avanzado">
                            <Lock className="w-4 h-4 text-gray-400" />
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                        <span>•</span>
                        {/* Exclude sleeve items from count visually */}
                        <span>{order.items.filter(i => !isSleeveItem(i)).length} productos</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <StatusBadge status={order.status} />
                     {!isLocked && (
                         <button 
                            onClick={() => {
                                if(hasUnsavedChanges) {
                                    toast.error("Guarda tus cambios antes de enviar.");
                                    return;
                                }
                                if(!isOrderComplete) {
                                    toast.error("Faltan fotos por subir en algunos productos.");
                                    return;
                                }
                                if(window.confirm("¿Estás seguro de que terminaste? Una vez enviado, pasará a diseño.")) {
                                    onFinalizeOrder(order.id);
                                    toast.success("¡Pedido enviado a diseño!");
                                }
                            }}
                            disabled={!isReadyToSend}
                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${isReadyToSend ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:scale-105 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                         >
                            <Send className="w-3 h-3" />
                            {isReadyToSend ? 'Finalizar y Enviar a Diseño' : 'Completa fotos para enviar'}
                         </button>
                     )}
                  </div>
               </div>
               <div className="px-2 pb-2">
                 <OrderProgress status={order.status} />
               </div>
            </div>

            <div className="p-6 md:p-8 space-y-12">
              
              {/* --- BANNERS AND APPROVAL UI --- */}
              {/* (Existing Banners Kept Intact) */}
              
              {order.status === OrderStatus.WAITING_FOR_DESIGN && (
                 <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
                     <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                         <Palette className="w-6 h-6 text-purple-600" />
                     </div>
                     <h3 className="text-xl font-bold text-purple-900 mb-2">¡Manos a la obra! 🎨</h3>
                     <p className="text-purple-800 mb-4 max-w-lg mx-auto">
                         Nuestros diseñadores están trabajando en la propuesta digital. Te notificaremos cuando esté lista.
                     </p>
                 </div>
              )}

              {/* DESIGN REVIEW UI */}
              {order.status === OrderStatus.DESIGN_REVIEW && (
                 <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-hidden shadow-lg shadow-amber-100">
                    <div className="p-6 md:p-8 text-center border-b border-amber-100 bg-amber-50/50">
                        <h3 className="text-2xl font-extrabold text-amber-900 mb-2">✨ ¡Tu diseño está listo!</h3>
                        <p className="text-amber-800 mb-6">Revisa la propuesta de nuestro artista. Si te encanta, apruébala para iniciar el bordado.</p>
                        
                        <div className="max-w-2xl mx-auto bg-white p-2 rounded-xl border border-amber-200 shadow-sm mb-8">
                             {order.designImage ? (
                                <img src={order.designImage} className="w-full h-auto rounded-lg" alt="Propuesta de Diseño" />
                             ) : (
                                <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">Imagen no disponible</div>
                             )}
                        </div>

                        {/* REVIEW BUTTONS */}
                        {/* ... (Kept same logic for review) ... */}
                        {rejectingOrderId === order.id ? (
                            <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-red-200 shadow-md animate-in fade-in slide-in-from-bottom-4">
                                <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2 justify-center">
                                    <AlertTriangle className="w-5 h-5"/> Solicitar Cambios
                                </h4>
                                <textarea 
                                    className="w-full border-gray-300 rounded-lg mb-4 text-sm focus:ring-red-500 focus:border-red-500" 
                                    rows={3}
                                    placeholder="Ej: Me gustaría que la aureola fuera un poco más grande..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setRejectingOrderId(null)} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                                    <button onClick={() => { onReviewDesign(order.id, false, rejectionReason); setRejectingOrderId(null); setRejectionReason(''); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg">Enviar Solicitud</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <button onClick={() => setRejectingOrderId(order.id)} className="px-6 py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2"><XCircle className="w-5 h-5" /> Solicitar Cambios</button>
                                <button onClick={() => onReviewDesign(order.id, true)} className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 hover:scale-105 transition-all flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> ¡Me encanta, Aprobar!</button>
                            </div>
                        )}
                    </div>
                 </div>
              )}

              {/* RENDER BUNDLES (SUPER PACKS) */}
              {Object.entries(bundles).map(([groupId, items]) => (
                  <div key={groupId} className="border-2 border-brand-100 bg-brand-50/10 rounded-3xl p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="p-3 bg-brand-100 rounded-xl text-brand-700">
                              <Box className="w-6 h-6" />
                          </div>
                          <div>
                              <h4 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                                  {items[0].productName}
                                  <span className="bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Pack Sincronizado</span>
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">Configuración inteligente: Las fotos se replican automáticamente a todos los productos del pack.</p>
                          </div>
                      </div>

                      <div className="space-y-8">
                          {items[0].customizations.map((slot, idx) => (
                              <div key={slot.id} className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                  <h5 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-50 pb-2">
                                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-mono">{idx + 1}</span>
                                      Mascota #{idx + 1} (Aplica a todo el pack)
                                  </h5>

                                  <div className="grid lg:grid-cols-5 gap-8">
                                      <div className="lg:col-span-3">
                                          <PetSlotCard slot={slot} index={idx} item={items[0]} order={order} isLocked={isLocked} isPrimaryInBundle={true} />
                                      </div>

                                      <div className="lg:col-span-2 space-y-4">
                                          {items.slice(1).map(siblingItem => {
                                              const siblingSlot = siblingItem.customizations[idx];
                                              if (!siblingSlot) return null;
                                              const pendingSibling = pendingSlotChanges[siblingSlot.id]?.changes;
                                              const siblingDisplayPos = pendingSibling?.position !== undefined ? pendingSibling.position : siblingSlot.position;

                                              return (
                                              <div key={siblingItem.id} className={`bg-gray-50 rounded-xl p-4 border border-gray-200 relative overflow-hidden ${pendingSibling ? 'ring-2 ring-blue-400' : ''}`}>
                                                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-200"></div>
                                                  <div className="flex items-center gap-2 mb-3">
                                                      <div className="p-1.5 bg-white rounded border border-gray-200 shadow-sm"><Link className="w-3 h-3 text-brand-500" /></div>
                                                      <div className="flex-1 min-w-0">
                                                          <span className="text-xs font-bold text-gray-500 uppercase block tracking-wider">Sincronizado en:</span>
                                                          <span className="text-sm font-bold text-gray-800 truncate block">{siblingItem.productName}</span>
                                                      </div>
                                                  </div>
                                                  <label className="text-[10px] font-bold text-gray-400 mb-1 block uppercase">Ubicación</label>
                                                  <GarmentVisualizer 
                                                        productName={siblingItem.productName} sku={siblingItem.sku} readOnly={isLocked}
                                                        selected={siblingDisplayPos} 
                                                        onSelect={(pos) => !isLocked && handleLocalSlotChange(order, siblingItem, siblingSlot.id, idx, { position: pos })}
                                                  />
                                              </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* SLEEVE SECTION FOR BUNDLES */}
                      {sleeveStats.total > 0 && items.some(i => !isSleeveItem(i) && !['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => i.sku.toLowerCase().includes(t.toLowerCase()))) && (
                        <div className="mt-8 pt-8 border-t border-brand-100">
                             <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Tag className="w-4 h-4 text-brand-500"/> Configuración de Mangas (Pack)</h4>
                             <p className="text-xs text-gray-500 mb-4">Créditos disponibles: <strong>{sleeveStats.remaining}</strong> de {sleeveStats.total}</p>
                             <div className="grid md:grid-cols-2 gap-4">
                                {items.map(item => {
                                    if (['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => item.sku.toLowerCase().includes(t.toLowerCase()))) return null;
                                    
                                    const pendingSleeve = pendingSleeveChanges[item.id]?.config;
                                    const displaySleeve = pendingSleeve !== undefined ? pendingSleeve : item.sleeve;
                                    const isSleeveModified = pendingSleeve !== undefined;

                                    return (
                                        <div key={item.id} className={`bg-white rounded-xl p-4 border border-gray-200 relative ${isSleeveModified ? 'ring-2 ring-blue-400' : ''}`}>
                                            {isSleeveModified && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="text-xs font-bold text-gray-700">{item.productName}</p>
                                                {!displaySleeve && !isLocked && (
                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={sleeveStats.remaining <= 0} className="text-[10px] bg-gray-50 border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                                                        {sleeveStats.remaining > 0 ? <Plus className="w-3 h-3"/> : <Lock className="w-3 h-3"/>} Agregar
                                                    </button>
                                                )}
                                                {displaySleeve && !isLocked && (
                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-[10px] bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded flex items-center gap-1"><Minus className="w-3 h-3"/> Quitar</button>
                                                )}
                                            </div>
                                            {displaySleeve ? (
                                                <SleeveDesigner config={displaySleeve} readOnly={isLocked} onChange={(newConfig) => handleLocalSleeveChange(order.id, item.id, newConfig)} />
                                            ) : (
                                                <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg bg-gray-50"><p className="text-[10px] text-gray-400">Sin manga asignada</p></div>
                                            )}
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                      )}
                  </div>
              ))}

              {/* RENDER SINGLES */}
              {singles.map(item => (
                <div key={item.id} className="border-b last:border-0 border-gray-100 pb-12 last:pb-0">
                  <div className="flex items-start gap-4 mb-8">
                     <div className="bg-brand-50 p-3 rounded-xl ring-1 ring-brand-100"><Shirt className="w-8 h-8 text-brand-600" /></div>
                     <div className="flex-1">
                        <h4 className="font-bold text-lg text-gray-900 leading-tight">{item.productName}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                           <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 text-xs font-mono border border-gray-200">{item.sku}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    {item.customizations.map((slot, index) => (
                      <PetSlotCard key={slot.id} slot={slot} index={index} item={item} order={order} isLocked={isLocked} />
                    ))}
                  </div>

                  {/* SLEEVE FOR SINGLES */}
                  {sleeveStats.total > 0 && !['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => item.sku.toLowerCase().includes(t.toLowerCase())) && (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h5 className="font-bold text-gray-900 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-500"/> Bordado en Manga (Extra)</h5>
                                  <p className="text-xs text-gray-500 mt-1">Créditos disponibles: <strong>{sleeveStats.remaining}</strong> de {sleeveStats.total}</p>
                              </div>
                              
                              {/* Using local state logic here too */}
                              {(() => {
                                  const pendingSleeve = pendingSleeveChanges[item.id]?.config;
                                  const displaySleeve = pendingSleeve !== undefined ? pendingSleeve : item.sleeve;
                                  
                                  if (!displaySleeve && !isLocked) return (
                                      <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={sleeveStats.remaining <= 0} className="text-xs bg-white border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                          {sleeveStats.remaining > 0 ? <Plus className="w-3 h-3"/> : <Lock className="w-3 h-3"/>} {sleeveStats.remaining > 0 ? 'Agregar Manga' : 'Sin créditos'}
                                      </button>
                                  );
                                  if (displaySleeve && !isLocked) return (
                                      <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Minus className="w-3 h-3"/> Quitar</button>
                                  );
                                  return null;
                              })()}
                          </div>
                          
                          {(() => {
                              const pendingSleeve = pendingSleeveChanges[item.id]?.config;
                              const displaySleeve = pendingSleeve !== undefined ? pendingSleeve : item.sleeve;

                              return displaySleeve ? (
                                  <SleeveDesigner config={displaySleeve} readOnly={isLocked} onChange={(newConfig) => handleLocalSleeveChange(order.id, item.id, newConfig)} />
                              ) : (
                                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl"><p className="text-xs text-gray-400">Sin bordado en manga asignado</p></div>
                              );
                          })()}
                      </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      </div>

      {/* --- UNSAVED CHANGES FLOATING BAR --- */}
      {hasUnsavedChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300 w-full px-4 max-w-md">
              <div className="bg-gray-900 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-700 ring-2 ring-white/20">
                  <div className="flex flex-col pl-2">
                      <span className="text-sm font-bold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          Cambios sin guardar
                      </span>
                      <span className="text-[10px] text-gray-400">
                          {Object.keys(pendingSlotChanges).length + Object.keys(pendingSleeveChanges).length} modificaciones pendientes
                      </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={discardChanges}
                          className="px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-1"
                      >
                          <RotateCcw className="w-3 h-3" /> Descartar
                      </button>
                      <button 
                          onClick={saveAllChanges}
                          disabled={isSaving}
                          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-900/50 transition-all hover:scale-105 flex items-center gap-2"
                      >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-4 h-4" />}
                          Guardar Todo
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ClientView;