import React, { useState } from 'react';
import { Order, OrderStatus, SleeveConfig, OrderItem, EmbroiderySlot } from '../../types';
import { QUICK_EDITS } from '../../constants';
import StatusBadge from '../StatusBadge';
import OrderProgress from '../OrderProgress';
import GarmentVisualizer from '../GarmentVisualizer';
import SleeveDesigner from '../SleeveDesigner';
import { Search, Lock, Palette, Sparkles, CheckCircle, XCircle, Wand2, Loader2, Image as ImageIcon, Check, Shirt, Info, Upload, Plus, Minus, Tag, Box, AlertTriangle, Send, Truck } from 'lucide-react';

interface ClientViewProps {
  orders: Order[];
  onUpdateSlot: (orderId: string, itemId: string, slotId: string, updates: any) => void;
  onInitiateUpload: (file: File, orderId: string, itemId: string, slotId: string) => void;
  onEditImage: (orderId: string, itemId: string, slotId: string, currentImage: string, prompt: string) => void;
  onReviewDesign: (orderId: string, approved: boolean, feedback?: string) => void;
  isProcessing: boolean;
  onUpdateSleeve?: (orderId: string, itemId: string, config: SleeveConfig | undefined) => void;
}

const ClientView: React.FC<ClientViewProps> = ({ 
  orders, onUpdateSlot, onInitiateUpload, onEditImage, onReviewDesign, isProcessing, onUpdateSleeve 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  const filteredOrders = orders.filter(o => 
      o.id.includes(searchTerm) || 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // HELPER: GROUP ITEMS BY GROUP_ID
  const groupItems = (items: OrderItem[]) => {
      const bundles: Record<string, OrderItem[]> = {};
      const singles: OrderItem[] = [];

      items.forEach(item => {
          if (item.sku === 'extra-manga') return; // Skip logic items
          if (item.groupId) {
              if (!bundles[item.groupId]) bundles[item.groupId] = [];
              bundles[item.groupId].push(item);
          } else {
              singles.push(item);
          }
      });
      return { bundles, singles };
  };

  // SUB-COMPONENT: PET CARD (Used inside Item or Bundle)
  const PetSlotCard: React.FC<{ 
      slot: EmbroiderySlot; 
      index: number; 
      item: OrderItem; 
      order: Order; 
      isLocked: boolean; 
      isPrimaryInBundle?: boolean; 
  }> = ({ 
      slot, 
      index, 
      item, 
      order, 
      isLocked,
      isPrimaryInBundle = true // If false (secondary in bundle), hide photo upload to reduce clutter, as it syncs
  }) => (
      <div key={slot.id} className={`border rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 ${isLocked ? 'bg-gray-50/50 border-gray-200' : 'bg-white border-gray-200 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)]'}`}>
         {/* SLOT HEADER */}
         <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
               <span className="bg-brand-100 text-brand-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{index + 1}</span>
               Mascota / Bordado
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
                      <span className="text-xs">Sin Foto</span>
                    </div>
                  )}
                  
                  {/* Upload logic */}
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
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nombre Mascota</label>
                  <input 
                    type="text" 
                    disabled={isLocked}
                    placeholder="Ej: Rocky"
                    className={`w-full text-sm border-gray-200 rounded-lg py-2.5 px-3 transition-shadow ${isLocked ? 'bg-gray-100 text-gray-900 font-bold' : 'bg-white focus:ring-2 focus:ring-brand-500'}`}
                    value={slot.petName || ''}
                    onChange={(e) => onUpdateSlot(order.id, item.id, slot.id, { petName: e.target.value })}
                  />
               </div>
               )}

               <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Ubicación {item.productName.includes('Pack') ? item.sku.includes('hood') ? 'Hoodie' : 'Jockey' : ''}</span>
                      {isPrimaryInBundle === false && <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 rounded">Configuración Individual</span>}
                  </label>
                  <GarmentVisualizer 
                        productName={item.productName}
                        sku={item.sku}
                        selected={slot.position} 
                        onSelect={(pos) => !isLocked && onUpdateSlot(order.id, item.id, slot.id, { position: pos })}
                        slotCount={item.customizations.length}
                        readOnly={isLocked}
                  />
               </div>

               {isPrimaryInBundle && (
               <div className="flex items-center gap-3">
                  {isLocked ? (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border w-full ${slot.includeHalo ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                        {slot.includeHalo ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span className="text-xs font-bold">{slot.includeHalo ? 'Con Aureola 😇' : 'Sin Aureola'}</span>
                      </div>
                  ) : (
                      <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100 w-full">
                          <button 
                            onClick={() => onUpdateSlot(order.id, item.id, slot.id, { includeHalo: !slot.includeHalo })}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${slot.includeHalo ? 'bg-brand-500 border-brand-600 text-white shadow-sm' : 'bg-white border-gray-300 hover:border-brand-400'}`}
                          >
                            {slot.includeHalo && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-xs font-medium text-gray-700">Incluir Aureola 😇</span>
                      </div>
                  )}
               </div>
               )}
            </div>
         </div>
         
        {/* AI EDIT TOOLS */}
        {!isLocked && slot.photoUrl && isPrimaryInBundle && (
            <div className="mt-4 pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setSelectedSlotId(selectedSlotId === slot.id ? null : slot.id)}
                        className="text-xs flex items-center gap-1.5 text-brand-600 font-bold hover:text-brand-700"
                    >
                        <Wand2 className="w-3.5 h-3.5" />
                        Mejorar con IA
                    </button>
                </div>

                {selectedSlotId === slot.id && (
                    <div className="mt-3 bg-brand-50/50 p-3 rounded-xl border border-brand-100 animate-in slide-in-from-top-2">
                        <p className="text-xs font-bold text-gray-700 mb-2">Edición Rápida (Beta)</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {QUICK_EDITS.map(prompt => (
                                <button 
                                    key={prompt}
                                    onClick={() => setEditPrompt(prompt)}
                                    className="px-2 py-1 bg-white border border-brand-100 rounded-md text-[10px] font-medium text-brand-700 hover:bg-brand-50 hover:border-brand-200 transition-colors"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Describe cómo mejorar la foto..." 
                                className="flex-1 text-xs border-gray-200 rounded-lg focus:ring-brand-500"
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                            />
                            <button 
                                onClick={() => {
                                    onEditImage(order.id, item.id, slot.id, slot.photoUrl!, editPrompt);
                                    setSelectedSlotId(null);
                                    setEditPrompt('');
                                }}
                                disabled={isProcessing || !editPrompt}
                                className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50"
                            >
                                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : 'Aplicar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
  );

  return (
    <div className="space-y-8">
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
            // Read-only Logic
            const isLocked = ![
                OrderStatus.PENDING_UPLOAD,
                OrderStatus.ACTION_REQUIRED,
                OrderStatus.ANALYZING_IMAGE,
                OrderStatus.DESIGN_REJECTED
            ].includes(order.status);

            // Sleeve Credits Logic (GLOBAL FOR ORDER)
            const sleeveItems = order.items.filter(i => i.sku === 'extra-manga');
            const totalSleeveCredits = sleeveItems.reduce((acc, item) => acc + item.quantity, 0);
            const assignedSleeves = order.items.filter(i => i.sleeve).length;
            const remainingSleeves = totalSleeveCredits - assignedSleeves;

            const { bundles, singles } = groupItems(order.items);

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
                        <span>{order.items.filter(i=>i.sku!=='extra-manga').length} productos</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <StatusBadge status={order.status} />
                     {totalSleeveCredits > 0 && (
                         <span className={`text-xs font-bold px-2 py-1 rounded-full border ${remainingSleeves > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                             {remainingSleeves > 0 ? `✨ Tienes ${remainingSleeves} bordado(s) de manga disponible` : '✅ Todos los bordados de manga asignados'}
                         </span>
                     )}
                  </div>
               </div>
               <div className="px-2 pb-2">
                 <OrderProgress status={order.status} />
               </div>
            </div>

            <div className="p-6 md:p-8 space-y-12">
              
              {/* --- BANNERS AND APPROVAL UI --- */}
              
              {/* 1. WAITING FOR DESIGN */}
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

              {/* 2. DESIGN REVIEW - APPROVAL UI (CRITICAL RESTORED SECTION) */}
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

                        {rejectingOrderId === order.id ? (
                            <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-red-200 shadow-md animate-in fade-in slide-in-from-bottom-4">
                                <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2 justify-center">
                                    <AlertTriangle className="w-5 h-5"/> Solicitar Cambios
                                </h4>
                                <p className="text-sm text-gray-500 mb-4">Cuéntanos qué te gustaría modificar para que quede perfecto.</p>
                                <textarea 
                                    className="w-full border-gray-300 rounded-lg mb-4 text-sm focus:ring-red-500 focus:border-red-500" 
                                    rows={3}
                                    placeholder="Ej: Me gustaría que la aureola fuera un poco más grande..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setRejectingOrderId(null)}
                                        className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={() => {
                                            onReviewDesign(order.id, false, rejectionReason);
                                            setRejectingOrderId(null);
                                            setRejectionReason('');
                                        }}
                                        disabled={!rejectionReason.trim()}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50"
                                    >
                                        Enviar Solicitud
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <button 
                                    onClick={() => setRejectingOrderId(order.id)}
                                    className="px-6 py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Solicitar Cambios
                                </button>
                                <button 
                                    onClick={() => onReviewDesign(order.id, true)}
                                    className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 hover:scale-105 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    ¡Me encanta, Aprobar!
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
              )}

              {/* 3. DESIGN REJECTED (Feedback Loop) */}
              {order.status === OrderStatus.DESIGN_REJECTED && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center text-center">
                       <div className="bg-red-100 p-3 rounded-full mb-3 text-red-600">
                           <AlertTriangle className="w-6 h-6" />
                       </div>
                       <h3 className="text-xl font-bold text-red-800 mb-1">Diseño Rechazado</h3>
                       <p className="text-red-700 mb-2">Has solicitado cambios. El diseñador está trabajando en la nueva versión.</p>
                       <p className="text-sm bg-white px-3 py-1 rounded border border-red-100 text-gray-500 italic">"{order.clientFeedback}"</p>
                  </div>
              )}

              {/* 4. PRODUCTION STATUS */}
              {[OrderStatus.READY_TO_EMBROIDER, OrderStatus.IN_PROGRESS, OrderStatus.READY_FOR_DISPATCH].includes(order.status) && (
                   <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-center gap-4">
                       <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden sm:block">
                           <Shirt className="w-6 h-6" />
                       </div>
                       <div>
                           <h3 className="text-lg font-bold text-blue-900">En Producción 🪡</h3>
                           <p className="text-blue-800 text-sm">Tu diseño fue aprobado y ya está en cola de bordado. ¡Pronto estará listo!</p>
                       </div>
                   </div>
              )}

              {/* 5. DISPATCHED (SUCCESS & EVIDENCE) */}
              {order.status === OrderStatus.DISPATCHED && (
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 md:p-8 text-center mb-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 shadow-sm">
                        <Truck className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-green-900 mb-2">¡Tu pedido va en camino! 🚚</h3>
                    <p className="text-green-800 mb-8 max-w-lg mx-auto">
                        Hemos terminado la producción y tu paquete ha sido despachado. Aquí tienes la evidencia final.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        <div className="bg-white p-4 rounded-xl shadow-md border border-green-100 transform transition-transform hover:scale-[1.02]">
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                                {order.finishedProductPhoto ? (
                                    <img src={order.finishedProductPhoto} className="w-full h-full object-cover" alt="Bordado Terminado" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">Sin foto disponible</div>
                                )}
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    Resultado
                                </div>
                            </div>
                            <p className="font-bold text-gray-800 text-sm">Bordado Terminado ✨</p>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-md border border-green-100 transform transition-transform hover:scale-[1.02]">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                                {order.packedProductPhoto ? (
                                    <img src={order.packedProductPhoto} className="w-full h-full object-cover" alt="Paquete Listo" />
                                ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">Sin foto disponible</div>
                                )}
                                <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    Empaque
                                </div>
                            </div>
                            <p className="font-bold text-gray-800 text-sm">Paquete Listo 📦</p>
                        </div>
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
                              <h4 className="font-bold text-xl text-gray-900">Super Pack Malcriados</h4>
                              <p className="text-xs text-gray-500">Configuración unificada: La foto se aplica a todo el pack.</p>
                          </div>
                      </div>

                      {/* We take the first item as the "Master" for the photo slots, but render positions for all */}
                      <div className="grid lg:grid-cols-2 gap-8">
                          {items[0].customizations.map((slot, idx) => (
                              <div key={slot.id} className="col-span-1 lg:col-span-2 space-y-4">
                                  {/* MASTER SLOT (Photo applies to all) */}
                                  <PetSlotCard 
                                    slot={slot} 
                                    index={idx} 
                                    item={items[0]} 
                                    order={order} 
                                    isLocked={isLocked}
                                    isPrimaryInBundle={true}
                                  />

                                  {/* SECONDARY ITEM POSITIONS (No Photo upload, just position) */}
                                  {items.slice(1).map(siblingItem => (
                                      <div key={siblingItem.id} className="ml-8 md:ml-12 pl-6 border-l-2 border-brand-100">
                                          <div className="flex items-center gap-2 mb-2">
                                              <span className="text-xs font-bold text-gray-400 uppercase">Aplicar también en:</span>
                                              <span className="text-sm font-bold text-gray-800">{siblingItem.productName}</span>
                                          </div>
                                          {siblingItem.customizations[idx] && (
                                              <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                  <label className="text-xs font-bold text-gray-500 mb-2 block">Ubicación</label>
                                                  <GarmentVisualizer 
                                                        productName={siblingItem.productName}
                                                        sku={siblingItem.sku}
                                                        selected={siblingItem.customizations[idx].position} 
                                                        onSelect={(pos) => !isLocked && onUpdateSlot(order.id, siblingItem.id, siblingItem.customizations[idx].id, { position: pos })}
                                                        readOnly={isLocked}
                                                  />
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          ))}
                      </div>
                  </div>
              ))}

              {/* RENDER SINGLES */}
              {singles.map(item => (
                <div key={item.id} className="border-b last:border-0 border-gray-100 pb-12 last:pb-0">
                  <div className="flex items-start gap-4 mb-8">
                     <div className="bg-brand-50 p-3 rounded-xl ring-1 ring-brand-100">
                        <Shirt className="w-8 h-8 text-brand-600" />
                     </div>
                     <div className="flex-1">
                        <h4 className="font-bold text-lg text-gray-900 leading-tight">{item.productName}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 font-mono mt-1">
                           <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-semibold">{item.sku}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    {/* PET SLOTS */}
                    {item.customizations.map((slot, index) => (
                      <PetSlotCard 
                        key={slot.id}
                        slot={slot}
                        index={index}
                        item={item}
                        order={order}
                        isLocked={isLocked}
                      />
                    ))}
                  </div>

                  {/* SLEEVE CONFIGURATION SECTION (Shared Logic) */}
                  {totalSleeveCredits > 0 && !['TSHIRT', 'CAP'].some(t => item.sku.includes(t.toLowerCase())) && (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                      <Tag className="w-4 h-4 text-brand-500"/> Bordado en Manga (Extra)
                                  </h5>
                                  <p className="text-xs text-gray-500 mt-1">Personaliza la manga derecha de este producto.</p>
                              </div>
                              
                              {!item.sleeve && !isLocked && (
                                  <button
                                    onClick={() => onUpdateSleeve?.(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })}
                                    disabled={remainingSleeves === 0}
                                    className="text-xs bg-white border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                      {remainingSleeves > 0 ? <Plus className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                                      {remainingSleeves > 0 ? 'Agregar Manga' : 'Sin créditos'}
                                  </button>
                              )}

                              {item.sleeve && !isLocked && (
                                  <button
                                    onClick={() => onUpdateSleeve?.(order.id, item.id, undefined)}
                                    className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                                  >
                                      <Minus className="w-3 h-3"/> Quitar
                                  </button>
                              )}
                          </div>

                          {item.sleeve ? (
                              <SleeveDesigner 
                                  config={item.sleeve} 
                                  readOnly={isLocked}
                                  onChange={(newConfig) => onUpdateSleeve?.(order.id, item.id, newConfig)} 
                              />
                          ) : (
                              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                                  <p className="text-xs text-gray-400">Sin bordado en manga asignado</p>
                              </div>
                          )}
                      </div>
                  )}

                </div>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default ClientView;