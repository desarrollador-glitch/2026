import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, SleeveConfig, OrderItem, EmbroiderySlot } from '../../types';
import StatusBadge from '../StatusBadge';
import OrderProgress from '../OrderProgress';
import GarmentVisualizer from '../GarmentVisualizer';
import SleeveDesigner from '../SleeveDesigner';
import { Search, Lock, Palette, CheckCircle, XCircle, Sparkles, Check, Shirt, Info, Upload, Plus, Minus, Tag, Box, AlertTriangle, Send, Link, Save, RotateCcw, Loader2, ImageIcon } from 'lucide-react';
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
  orders, onUpdateSlot, onInitiateUpload, onReviewDesign, isProcessing, onUpdateSleeve, onFinalizeOrder 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- LOCAL STATE BUFFER ---
  const [pendingSlotChanges, setPendingSlotChanges] = useState<Record<string, PendingSlotChange>>({});
  const [pendingSleeveChanges, setPendingSleeveChanges] = useState<Record<string, PendingSleeveChange>>({});

  const hasUnsavedChanges = Object.keys(pendingSlotChanges).length > 0 || Object.keys(pendingSleeveChanges).length > 0;

  // --- HELPERS ---
  const handleLocalSlotChange = (orderId: string, itemId: string, slotId: string, change: Partial<EmbroiderySlot>) => {
      setPendingSlotChanges(prev => ({
          ...prev,
          [slotId]: {
              orderId,
              itemId,
              changes: { ...(prev[slotId]?.changes || {}), ...change }
          }
      }));
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
          const slotPromises = Object.entries(pendingSlotChanges).map(([slotId, data]) => {
             return onUpdateSlot(data.orderId, data.itemId, slotId, data.changes);
          });
          const sleevePromises = Object.entries(pendingSleeveChanges).map(([itemId, data]) => {
              return onUpdateSleeve?.(data.orderId, itemId, data.config);
          });

          await Promise.all([...slotPromises, ...sleevePromises]);
          
          setPendingSlotChanges({});
          setPendingSleeveChanges({});
          return true;
      } catch (e) {
          console.error(e);
          toast.error("Error al guardar cambios. Intenta nuevamente.");
          return false;
      } finally {
          setIsSaving(false);
      }
  };

  const discardChanges = () => {
      if(window.confirm("¿Descartar cambios no guardados?")) {
          setPendingSlotChanges({});
          setPendingSleeveChanges({});
      }
  };

  const handleFinalizeAndSend = async (orderId: string) => {
      if (hasUnsavedChanges) {
          const saved = await saveAllChanges();
          if (!saved) return; // Stop if save failed
      }
      
      if(window.confirm("¿Confirmar que toda la información es correcta? Pasaremos tu pedido a la etapa de diseño.")) {
          onFinalizeOrder(orderId);
          toast.success("¡Pedido enviado a diseño!");
      }
  };

  const filteredOrders = orders.filter(o => 
      o.id.includes(searchTerm) || 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isSleeveItem = (item: OrderItem) => item.sku && item.sku.toLowerCase() === 'extra-manga';

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

  // --- SUB-COMPONENTS ---
  const PetSlotCard: React.FC<{ 
      slot: EmbroiderySlot; 
      index: number; 
      item: OrderItem; 
      order: Order; 
      isLocked: boolean; 
      isPrimaryInBundle?: boolean; 
  }> = ({ slot, index, item, order, isLocked, isPrimaryInBundle = true }) => {
      
      const pending = pendingSlotChanges[slot.id]?.changes;
      
      const displayValues = {
          petName: pending?.petName !== undefined ? pending.petName : slot.petName,
          position: pending?.position !== undefined ? pending.position : slot.position,
          includeHalo: pending?.includeHalo !== undefined ? pending.includeHalo : slot.includeHalo,
      };
      
      const isModified = !!pending;

      return (
      <div key={slot.id} className={`border rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all relative ${isLocked ? 'bg-gray-50/50 border-gray-200' : 'bg-white border-gray-200'} ${isModified ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}>
         {isModified && <div className="absolute -top-3 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-20">Modificado</div>}

         <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
               <span className="bg-brand-100 text-brand-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">{index + 1}</span>
               Mascota #{index + 1}
            </span>
            {slot.status === 'APPROVED' && <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-green-100"><CheckCircle className="w-3 h-3"/> Aprobado</span>}
            {slot.status === 'REJECTED' && <span className="bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-red-100"><XCircle className="w-3 h-3"/> Revisa la foto</span>}
            {slot.status === 'ANALYZING' && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ring-1 ring-blue-100 animate-pulse"><Sparkles className="w-3 h-3"/> Analizando...</span>}
         </div>

         <div className="flex flex-col sm:flex-row gap-6">
            {isPrimaryInBundle && (
            <div className="w-full sm:w-40 flex-shrink-0 flex flex-col gap-2">
                <div className={`aspect-square rounded-xl overflow-hidden relative border group shadow-inner ${isLocked ? 'bg-gray-100' : 'bg-gray-100'}`}>
                  {slot.photoUrl ? (
                    <img src={slot.photoUrl} alt="Pet" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs text-center px-2">Subir Foto</span>
                    </div>
                  )}
                  
                  {(slot.status === 'EMPTY' || slot.status === 'REJECTED') && !isLocked && (
                     <label className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10">
                        <Upload className="w-8 h-8 text-white mb-2" />
                        <span className="text-xs text-white font-bold">SUBIR FOTO</span>
                        <input 
                            type="file" className="hidden" accept="image/*" 
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    if(hasUnsavedChanges) { alert("Guarda los cambios de texto antes de subir foto."); return; }
                                    onInitiateUpload(e.target.files[0], order.id, item.id, slot.id);
                                }
                            }} 
                        />
                     </label>
                  )}
                </div>
                {slot.status === 'REJECTED' && (
                  <div className="bg-red-50 p-2 rounded-lg border border-red-100"><p className="text-[10px] text-red-700 leading-tight">{slot.aiReason}</p></div>
                )}
            </div>
            )}

            <div className="flex-1 space-y-4 min-w-0">
               {isPrimaryInBundle && (
               <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre</label>
                  <input 
                    type="text" disabled={isLocked} placeholder="Ej: Rocky"
                    className={`w-full text-sm border-gray-200 rounded-lg py-2 px-3 ${isLocked ? 'bg-gray-100 font-bold' : 'focus:ring-2 focus:ring-brand-500'}`}
                    value={displayValues.petName || ''}
                    onChange={(e) => handleLocalSlotChange(order.id, item.id, slot.id, { petName: e.target.value })}
                  />
               </div>
               )}
               <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Ubicación</label>
                  <GarmentVisualizer 
                        productName={item.productName} sku={item.sku}
                        selected={displayValues.position} 
                        onSelect={(pos) => !isLocked && handleLocalSlotChange(order.id, item.id, slot.id, { position: pos })}
                        slotCount={item.customizations.length} readOnly={isLocked}
                  />
               </div>
               {isPrimaryInBundle && !isLocked && (
                   <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100" onClick={() => handleLocalSlotChange(order.id, item.id, slot.id, { includeHalo: !displayValues.includeHalo })}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${displayValues.includeHalo ? 'bg-brand-500 border-brand-600 text-white' : 'bg-white border-gray-300'}`}>
                        {displayValues.includeHalo && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-medium text-gray-700">Incluir Aureola 😇</span>
                  </div>
               )}
            </div>
         </div>
      </div>
  )};

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-900">Mis Pedidos</h2>
           <p className="text-gray-500 text-sm">Gestiona la personalización de tus productos Malcriados</p>
        </div>
        <div className="relative">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input type="text" placeholder="Buscar pedido..." className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-brand-500"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
             />
        </div>
      </div>

      <div className="grid gap-12">
        {filteredOrders.map(order => {
            const isLocked = ![OrderStatus.PENDING_UPLOAD, OrderStatus.ACTION_REQUIRED, OrderStatus.ANALYZING_IMAGE, OrderStatus.DESIGN_REJECTED].includes(order.status);
            const { bundles, singles } = groupItems(order.items);
            
            // --- VALIDATION LOGIC ---
            // 1. Sleeve Credits Logic
            const totalSleeveCredits = order.items.filter(isSleeveItem).reduce((acc, i) => acc + i.quantity, 0);
            const assignedSleeves = order.items.filter(i => {
                const pending = pendingSleeveChanges[i.id]?.config;
                return pending !== undefined ? pending !== null : i.sleeve !== null;
            }).length; // This counts items that have a sleeve (either in DB or pending)
            
            // Note: assignedSleeves could be wrong if pending is explicitly undefined (removed). 
            // Better logic:
            let calculatedUsedCredits = 0;
            order.items.forEach(i => {
                if(isSleeveItem(i)) return;
                const pending = pendingSleeveChanges[i.id];
                if (pending) {
                    if (pending.config) calculatedUsedCredits++; // Added locally
                } else if (i.sleeve) {
                    calculatedUsedCredits++; // Exists in DB and not modified
                }
            });
            const remainingSleeves = totalSleeveCredits - calculatedUsedCredits;
            const hasUnusedSleeves = remainingSleeves > 0;

            // 2. Data Completeness Logic
            const checkItemCompletion = (item: OrderItem) => {
                if (isSleeveItem(item)) return true;
                return item.customizations.every(slot => {
                    // Photo Check (DB only for now as uploads force save)
                    const hasPhoto = !!slot.photoUrl || slot.status === 'ANALYZING';
                    
                    // Text/Position Check (DB + Pending)
                    const pending = pendingSlotChanges[slot.id]?.changes;
                    const name = pending?.petName !== undefined ? pending.petName : slot.petName;
                    const pos = pending?.position !== undefined ? pending.position : slot.position;
                    
                    return hasPhoto && !!name && !!pos;
                });
            };

            const isDataComplete = order.items.every(checkItemCompletion);
            const canSend = isDataComplete && !hasUnusedSleeves && !isLocked;

            return (
          <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ring-1 ring-black/5">
            <div className="bg-gray-50/80 backdrop-blur px-6 pt-6 pb-2 border-b border-gray-100">
               <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                        Orden #{order.id}
                        {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{order.items.filter(i => !isSleeveItem(i)).length} productos</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <StatusBadge status={order.status} />
                     {!isLocked && (
                         <button 
                            onClick={() => handleFinalizeAndSend(order.id)}
                            disabled={!canSend}
                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
                                canSend 
                                ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:scale-105' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                         >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3" />}
                            {hasUnsavedChanges && canSend ? 'Guardar y Enviar' : 'Enviar a Diseño'}
                         </button>
                     )}
                  </div>
               </div>
               
               {/* VALIDATION WARNINGS */}
               {!isLocked && !canSend && (
                   <div className="mb-4 flex flex-col gap-2">
                       {!isDataComplete && (
                           <div className="bg-orange-50 text-orange-800 text-xs px-3 py-2 rounded-lg border border-orange-100 flex items-center gap-2">
                               <AlertTriangle className="w-4 h-4"/> 
                               <span>Falta información: Asegúrate de subir fotos, escribir nombres y elegir posiciones para todas las mascotas.</span>
                           </div>
                       )}
                       {hasUnusedSleeves && (
                           <div className="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg border border-blue-100 flex items-center gap-2">
                               <Tag className="w-4 h-4"/> 
                               <span>Tienes {remainingSleeves} bordados de manga disponibles. Asígnalos a tus prendas antes de enviar.</span>
                           </div>
                       )}
                   </div>
               )}

               <div className="px-2 pb-2"><OrderProgress status={order.status} /></div>
            </div>

            <div className="p-6 md:p-8 space-y-12">
              {/* STATUS BANNERS (Intact) */}
              {order.status === OrderStatus.WAITING_FOR_DESIGN && (
                 <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
                     <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3"><Palette className="w-6 h-6 text-purple-600" /></div>
                     <h3 className="text-xl font-bold text-purple-900 mb-2">¡Manos a la obra! 🎨</h3>
                     <p className="text-purple-800">Nuestros diseñadores están trabajando. Te notificaremos pronto.</p>
                 </div>
              )}
              
              {order.status === OrderStatus.DESIGN_REVIEW && (
                 <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
                    <h3 className="text-2xl font-extrabold text-amber-900 mb-2">✨ ¡Tu diseño está listo!</h3>
                    <div className="max-w-2xl mx-auto bg-white p-2 rounded-xl border border-amber-200 shadow-sm mb-8 mt-4">
                         {order.designImage ? <img src={order.designImage} className="w-full h-auto rounded-lg" /> : <div className="h-64 flex items-center justify-center text-gray-400">Sin Imagen</div>}
                    </div>
                    {rejectingOrderId === order.id ? (
                        <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-red-200 shadow-md">
                            <h4 className="font-bold text-red-700 mb-2">Solicitar Cambios</h4>
                            <textarea className="w-full border-gray-300 rounded-lg mb-4 text-sm" rows={3} placeholder="Describe los cambios..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                            <div className="flex gap-2">
                                <button onClick={() => setRejectingOrderId(null)} className="flex-1 py-2 text-gray-600 font-bold bg-gray-100 rounded-lg">Cancelar</button>
                                <button onClick={() => { onReviewDesign(order.id, false, rejectionReason); setRejectingOrderId(null); }} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg">Enviar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setRejectingOrderId(order.id)} className="px-6 py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50">Solicitar Cambios</button>
                            <button onClick={() => onReviewDesign(order.id, true)} className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg">¡Aprobar!</button>
                        </div>
                    )}
                 </div>
              )}

              {/* PRODUCTS LIST */}
              {Object.entries(bundles).map(([groupId, items]) => (
                  <div key={groupId} className="border-2 border-brand-100 bg-brand-50/10 rounded-3xl p-6">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-brand-100 rounded-lg text-brand-700"><Box className="w-6 h-6" /></div>
                          <div>
                              <h4 className="font-bold text-xl text-gray-900 flex items-center gap-2">{items[0].productName} <span className="bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">Pack</span></h4>
                          </div>
                      </div>
                      <div className="space-y-8">
                          {items[0].customizations.map((slot, idx) => (
                              <div key={slot.id} className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                  <h5 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-50">Mascota #{idx + 1} (Pack)</h5>
                                  <div className="grid lg:grid-cols-5 gap-8">
                                      <div className="lg:col-span-3"><PetSlotCard slot={slot} index={idx} item={items[0]} order={order} isLocked={isLocked} isPrimaryInBundle={true} /></div>
                                      <div className="lg:col-span-2 space-y-4">
                                          {items.slice(1).map(sibling => {
                                              const siblingSlot = sibling.customizations[idx];
                                              if (!siblingSlot) return null;
                                              const pendingSibling = pendingSlotChanges[siblingSlot.id]?.changes;
                                              const siblingDisplayPos = pendingSibling?.position !== undefined ? pendingSibling.position : siblingSlot.position;
                                              return (
                                              <div key={sibling.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                                  <div className="flex items-center gap-2 mb-2"><Link className="w-3 h-3 text-brand-500"/><span className="text-xs font-bold text-gray-500 uppercase">Sincronizado:</span><span className="text-sm font-bold">{sibling.productName}</span></div>
                                                  <GarmentVisualizer productName={sibling.productName} sku={sibling.sku} readOnly={isLocked} selected={siblingDisplayPos} onSelect={(pos) => !isLocked && handleLocalSlotChange(order.id, sibling.id, siblingSlot.id, { position: pos })} />
                                              </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      {/* SLEEVES FOR BUNDLES */}
                      {totalSleeveCredits > 0 && items.some(i => !['TSHIRT', 'CAP'].some(t => i.sku.includes(t))) && (
                        <div className="mt-8 pt-8 border-t border-brand-100">
                             <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Tag className="w-4 h-4 text-brand-500"/> Mangas (Pack)</h4>
                             <div className="grid md:grid-cols-2 gap-4">
                                {items.map(item => {
                                    if (['TSHIRT', 'CAP'].some(t => item.sku.includes(t))) return null;
                                    const pending = pendingSleeveChanges[item.id]?.config;
                                    const displaySleeve = pending !== undefined ? pending : item.sleeve;
                                    return (
                                        <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="text-xs font-bold text-gray-700">{item.productName}</p>
                                                {!displaySleeve && !isLocked && (
                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={remainingSleeves === 0} className="text-[10px] bg-gray-50 border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                                                        {remainingSleeves > 0 ? <Plus className="w-3 h-3"/> : <Lock className="w-3 h-3"/>} Agregar
                                                    </button>
                                                )}
                                                {displaySleeve && !isLocked && (
                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-1 rounded flex items-center gap-1"><Minus className="w-3 h-3"/> Quitar</button>
                                                )}
                                            </div>
                                            {displaySleeve ? <SleeveDesigner config={displaySleeve} readOnly={isLocked} onChange={(c) => handleLocalSleeveChange(order.id, item.id, c)} /> : <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg"><p className="text-[10px] text-gray-400">Sin manga</p></div>}
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                      )}
                  </div>
              ))}

              {/* SINGLES */}
              {singles.map(item => (
                <div key={item.id} className="border-b last:border-0 border-gray-100 pb-12 last:pb-0">
                  <div className="flex items-start gap-4 mb-8">
                     <div className="bg-brand-50 p-2 rounded-xl"><Shirt className="w-8 h-8 text-brand-600" /></div>
                     <div><h4 className="font-bold text-lg text-gray-900">{item.productName}</h4></div>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    {item.customizations.map((slot, index) => (
                      <PetSlotCard key={slot.id} slot={slot} index={index} item={item} order={order} isLocked={isLocked} />
                    ))}
                  </div>
                  {totalSleeveCredits > 0 && !['TSHIRT', 'CAP'].some(t => item.sku.includes(t)) && (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                          <div className="flex justify-between items-start mb-4">
                              <h5 className="font-bold text-gray-900 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-500"/> Manga Extra</h5>
                              {(() => {
                                  const pending = pendingSleeveChanges[item.id]?.config;
                                  const displaySleeve = pending !== undefined ? pending : item.sleeve;
                                  if (!displaySleeve && !isLocked) return <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={remainingSleeves === 0} className="text-xs bg-white border border-gray-200 text-brand-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">{remainingSleeves > 0 ? <Plus className="w-3 h-3"/> : <Lock className="w-3 h-3"/>} {remainingSleeves > 0 ? 'Agregar' : 'Sin créditos'}</button>;
                                  if (displaySleeve && !isLocked) return <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-xs bg-white border border-red-200 text-red-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Minus className="w-3 h-3"/> Quitar</button>;
                              })()}
                          </div>
                          {(() => {
                              const pending = pendingSleeveChanges[item.id]?.config;
                              const displaySleeve = pending !== undefined ? pending : item.sleeve;
                              return displaySleeve ? <SleeveDesigner config={displaySleeve} readOnly={isLocked} onChange={(c) => handleLocalSleeveChange(order.id, item.id, c)} /> : <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl"><p className="text-xs text-gray-400">Sin manga asignada</p></div>;
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

      {hasUnsavedChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300">
              <div className="bg-gray-900 text-white p-2 pl-4 pr-2 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700">
                  <div className="flex flex-col">
                      <span className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Cambios sin guardar</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <button onClick={discardChanges} className="px-3 py-2 text-xs font-bold text-gray-300 hover:text-white rounded-xl">Descartar</button>
                      <button onClick={saveAllChanges} disabled={isSaving} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2">
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-4 h-4" />} Guardar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ClientView;