import React, { useState } from 'react';
import { Order, OrderStatus, UserRole } from '../../types';
import { STAFF_MEMBERS, SLEEVE_FONTS, SLEEVE_ICONS } from '../../constants';
import GarmentVisualizer from '../GarmentVisualizer';
import { Search, Eye, Download, MessageSquare, Upload, ImageIcon, FileCode, FileText, CheckCircle, Trash2, Send, Sparkles, Tag } from 'lucide-react';

interface DesignerViewProps {
  orders: Order[];
  onSubmitDesign: (orderId: string, assets: { image: string, technicalSheet: string, machineFile: string }) => void;
}

const DesignerView: React.FC<DesignerViewProps> = ({ orders, onSubmitDesign }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Local state for drafts
  const [designerDrafts, setDesignerDrafts] = useState<Record<string, {
      image?: string;
      technicalSheet?: string;
      machineFile?: string;
  }>>({});

  const handleDraftFile = (file: File, orderId: string, field: 'image' | 'technicalSheet' | 'machineFile') => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
          const base64 = reader.result as string;
          setDesignerDrafts(prev => ({
              ...prev,
              [orderId]: { ...prev[orderId], [field]: base64 }
          }));
      };
  };

  const clearDraftFile = (orderId: string, field: 'image' | 'technicalSheet' | 'machineFile') => {
      setDesignerDrafts(prev => ({
          ...prev,
          [orderId]: { ...prev[orderId], [field]: undefined }
      }));
  };

  const activeDrafts = orders.filter(o => [
      OrderStatus.WAITING_FOR_DESIGN, 
      OrderStatus.DESIGN_REVIEW, 
      OrderStatus.DESIGN_REJECTED
  ].includes(o.status) && (
      o.id.includes(searchTerm) || 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Estudio de Diseño & Digitalización</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">Asignado a:</span>
                {STAFF_MEMBERS.filter(s => s.role === UserRole.DESIGNER).map(s => (
                    <img key={s.id} src={s.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm" title={s.name} />
                ))}
            </div>
          </div>
          <div className="relative">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
                type="text" 
                placeholder="Buscar por ID o Cliente..." 
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 bg-white focus:ring-2 focus:ring-brand-500 text-gray-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
        </div>
       </div>

       <div className="grid gap-8">
           {activeDrafts.map(order => {
               const draft = designerDrafts[order.id] || {};
               const isReadyToSubmit = draft.image && draft.machineFile && draft.technicalSheet;

               return (
               <div key={order.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                   <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex justify-between items-center">
                       <div>
                           <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                               Orden #{order.id}
                               {order.status === OrderStatus.DESIGN_REJECTED && (
                                   <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">Rechazado - Ver Feedback</span>
                               )}
                               {order.status === OrderStatus.DESIGN_REVIEW && (
                                   <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold border border-amber-200 flex items-center gap-1">
                                       <Eye className="w-3 h-3"/> En Revisión Cliente
                                   </span>
                               )}
                           </h3>
                           <p className="text-sm text-gray-500">{order.customerName}</p>
                       </div>
                   </div>

                   <div className="p-8 space-y-8 bg-gray-50/30">
                       {/* ORDER ITEMS CONTEXT */}
                       {order.items.filter(i => i.sku !== 'extra-manga').map(item => (
                           <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                               <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-lg">{item.productName}</h4>
                                        <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">SKU: {item.sku}</p>
                                    </div>
                               </div>

                               <div className="flex flex-col lg:flex-row gap-8">
                                   <div className="lg:w-1/3 flex flex-col items-center">
                                       <GarmentVisualizer 
                                            productName={item.productName} 
                                            sku={item.sku} 
                                            readOnly={true} 
                                            slotCount={item.customizations.length}
                                            placements={item.customizations.filter(c => c.position).map(c => ({ position: c.position!, label: c.petName || 'Mascota' }))} 
                                       />
                                       
                                       {/* SLEEVE INDICATOR FOR DESIGNER */}
                                       {item.sleeve && (
                                            <div className="mt-4 bg-gray-900 text-white p-3 rounded-lg w-full">
                                                <div className="flex items-center gap-2 mb-2 border-b border-gray-700 pb-2">
                                                    <Tag className="w-4 h-4"/>
                                                    <span className="text-xs font-bold uppercase">Manga Derecha</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px]">Texto</span>
                                                        <span className="font-bold text-sm">{item.sleeve.text}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 block text-[10px]">Fuente</span>
                                                        <span className="font-bold">{SLEEVE_FONTS.find(f => f.id === item.sleeve?.font)?.label}</span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-gray-400 block text-[10px]">Icono</span>
                                                        <span className="font-bold">{SLEEVE_ICONS.find(i => i.id === item.sleeve?.icon)?.label} {SLEEVE_ICONS.find(i => i.id === item.sleeve?.icon)?.icon}</span>
                                                    </div>
                                                </div>
                                            </div>
                                       )}
                                   </div>

                                   <div className="lg:w-2/3 grid sm:grid-cols-2 gap-4">
                                        {item.customizations.map((slot) => (
                                            <div key={slot.id} className="border border-gray-200 rounded-xl p-3 flex gap-3 bg-white">
                                                <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden group">
                                                    {slot.photoUrl ? (
                                                        <img src={slot.photoUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Sin Foto</div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <a href={slot.photoUrl} download={`Ref-${slot.petName}-${order.id}.png`} className="p-1.5 bg-brand-600 rounded-full text-white hover:scale-110"><Download className="w-4 h-4"/></a>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <p className="font-bold text-gray-900 truncate">{slot.petName || 'Mascota'}</p>
                                                    <div className="mt-1 space-y-1">
                                                        <span className="block text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                                            {slot.position || 'Sin Posición'}
                                                        </span>
                                                        {slot.includeHalo && (
                                                            <span className="block text-[10px] font-bold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 w-fit">
                                                                Con Aureola 😇
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                   </div>
                               </div>
                           </div>
                       ))}
                       
                       {/* UPLOAD WORKSPACE (Unchanged) */}
                       {/* ... */}
                       <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6">
                           {/* ... */}
                           <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                               <Upload className="w-4 h-4"/> Centro de Carga de Producción
                           </h4>
                           
                           <div className="grid md:grid-cols-3 gap-4">
                               {/* 1. VISUAL DESIGN */}
                               <div className={`border rounded-xl p-4 transition-all ${draft.image ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300'}`}>
                                   <div className="flex justify-between items-start mb-2">
                                       <span className="text-xs font-bold text-gray-500 uppercase">1. Visual (Cliente)</span>
                                       {draft.image && <CheckCircle className="w-4 h-4 text-green-500"/>}
                                   </div>
                                   {draft.image ? (
                                       <div className="relative group">
                                           <img src={draft.image} className="w-full h-32 object-contain rounded bg-white border border-gray-100" />
                                           <button onClick={() => clearDraftFile(order.id, 'image')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3"/></button>
                                       </div>
                                   ) : (
                                       <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                           <ImageIcon className="w-6 h-6 text-gray-400 mb-1"/>
                                           <span className="text-xs text-brand-600 font-bold">Subir Imagen</span>
                                           <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], order.id, 'image')} />
                                       </label>
                                   )}
                               </div>

                               {/* 2. MACHINE FILE */}
                               <div className={`border rounded-xl p-4 transition-all ${draft.machineFile ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300'}`}>
                                   <div className="flex justify-between items-start mb-2">
                                       <span className="text-xs font-bold text-gray-500 uppercase">2. Archivo Máquina</span>
                                       {draft.machineFile && <CheckCircle className="w-4 h-4 text-green-500"/>}
                                   </div>
                                   {draft.machineFile ? (
                                       <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative">
                                            <FileCode className="w-8 h-8 text-gray-700 mb-2"/>
                                            <span className="text-xs font-mono text-gray-500">Cargado</span>
                                            <button onClick={() => clearDraftFile(order.id, 'machineFile')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3"/></button>
                                       </div>
                                   ) : (
                                       <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                           <FileCode className="w-6 h-6 text-gray-400 mb-1"/>
                                           <span className="text-xs text-brand-600 font-bold">Subir .DST/.EMB</span>
                                           <input type="file" className="hidden" accept=".dst,.emb,.pes" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], order.id, 'machineFile')} />
                                       </label>
                                   )}
                               </div>

                               {/* 3. TECHNICAL SHEET */}
                               <div className={`border rounded-xl p-4 transition-all ${draft.technicalSheet ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300'}`}>
                                   <div className="flex justify-between items-start mb-2">
                                       <span className="text-xs font-bold text-gray-500 uppercase">3. Ficha Colores</span>
                                       {draft.technicalSheet && <CheckCircle className="w-4 h-4 text-green-500"/>}
                                   </div>
                                   {draft.technicalSheet ? (
                                       <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative">
                                            <FileText className="w-8 h-8 text-gray-700 mb-2"/>
                                            <span className="text-xs font-mono text-gray-500">Cargado</span>
                                            <button onClick={() => clearDraftFile(order.id, 'technicalSheet')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3"/></button>
                                       </div>
                                   ) : (
                                       <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                           <FileText className="w-6 h-6 text-gray-400 mb-1"/>
                                           <span className="text-xs text-brand-600 font-bold">Subir PDF/IMG</span>
                                           <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], order.id, 'technicalSheet')} />
                                       </label>
                                   )}
                               </div>
                           </div>

                           <div className="mt-6 flex justify-end">
                               <button 
                                onClick={() => {
                                    onSubmitDesign(order.id, draft as any);
                                    setDesignerDrafts(prev => { const n = {...prev}; delete n[order.id]; return n; });
                                }}
                                disabled={!isReadyToSubmit}
                                className="px-6 py-3 bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-200 transition-all hover:scale-105"
                               >
                                   <Send className="w-4 h-4" />
                                   {order.status === OrderStatus.DESIGN_REVIEW ? 'Actualizar Versión' : 'Enviar a Revisión'}
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
               );
           })}

           {activeDrafts.length === 0 && (
               <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                   <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                   <p className="text-gray-500 font-medium">No tienes diseños pendientes.</p>
               </div>
           )}
       </div>
    </div>
  );
};

export default DesignerView;