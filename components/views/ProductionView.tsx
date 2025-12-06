import React, { useState } from 'react';
import { Order, OrderStatus, UserRole } from '../../types';
import StatusBadge from '../StatusBadge';
import { Search, CheckCircle, Eye, FileText, FileCode, PlayCircle, Check, AlertTriangle, Camera, Package, Send, Tag } from 'lucide-react';
import { SLEEVE_FONTS, SLEEVE_ICONS } from '../../constants';

interface ProductionViewProps {
  orders: Order[];
  currentRole: UserRole;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onReportIssue: (orderId: string, reason: string) => void;
  onResolveIssue: (orderId: string) => void;
  onUploadEvidence: (file: File, orderId: string, field: 'finishedProductPhoto' | 'packedProductPhoto') => void;
}

const ProductionView: React.FC<ProductionViewProps> = ({ 
  orders, currentRole, onUpdateStatus, onReportIssue, onResolveIssue, onUploadEvidence 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredOrders = orders.filter(order => {
      // Role Filtering
      if (currentRole === UserRole.EMBROIDERER) {
          if (![OrderStatus.READY_TO_EMBROIDER, OrderStatus.IN_PROGRESS, OrderStatus.ON_HOLD, OrderStatus.READY_FOR_DISPATCH].includes(order.status)) {
              return false;
          }
      }
      // Text Search
      return order.id.includes(searchTerm) || 
             order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleReport = (orderId: string) => {
      const reason = prompt("Describe el problema (Máquina averiada, Prenda defectuosa, Falta insumos):");
      if(reason) onReportIssue(orderId, reason);
  };

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">
                {currentRole === UserRole.EMBROIDERER ? 'Panel de Bordado' : 'Administración'}
            </h2>
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
       
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
           {filteredOrders.map(order => {
               const isExpanded = expandedOrderId === order.id;

               return (
               <div 
                  key={order.id} 
                  className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col relative overflow-hidden transition-all duration-200 cursor-pointer ${isExpanded ? 'ring-2 ring-brand-500 shadow-md row-span-2' : 'hover:shadow-md'} ${order.status === OrderStatus.ON_HOLD ? 'border-red-200 bg-red-50' : ''}`}
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
               >
                   <div className={`absolute top-0 left-0 w-1 h-full ${
                       order.status === OrderStatus.READY_TO_EMBROIDER ? 'bg-green-500' :
                       order.status === OrderStatus.IN_PROGRESS ? 'bg-blue-500' : 
                       order.status === OrderStatus.ON_HOLD ? 'bg-red-600' :
                       order.status === OrderStatus.READY_FOR_DISPATCH ? 'bg-orange-500' : 'bg-gray-200'
                   }`} />

                   <div className="flex justify-between mb-4 pl-3">
                       <span className="font-mono text-xs text-gray-400">#{order.id}</span>
                       <StatusBadge status={order.status} />
                   </div>
                   
                   <div className="pl-3 mb-6 flex-1">
                        <div className="flex justify-between items-start">
                             <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">{order.customerName}</h3>
                                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                    {order.items.length} items
                                </p>
                             </div>
                        </div>
                        
                        {order.status === OrderStatus.ON_HOLD && (
                             <div className="mb-4 bg-red-100 border border-red-200 p-3 rounded-lg text-red-800 text-xs animate-pulse">
                                 <strong>⚠ INCIDENCIA:</strong> {order.productionIssue}
                             </div>
                        )}
                        
                        {!isExpanded ? (
                            <div className="space-y-2">
                                {order.items.filter(i => i.sku !== 'extra-manga').slice(0, 2).map(i => (
                                    <div key={i.id} className="bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center">
                                        <div>
                                            <span className="text-xs font-medium text-gray-700 truncate max-w-[150px] block">{i.productName}</span>
                                            {i.sleeve && <span className="text-[9px] text-brand-600 font-bold block">+ Manga Der.</span>}
                                        </div>
                                    </div>
                                ))}
                                {order.items.length > 2 && <div className="text-xs text-gray-400 text-center">+ {order.items.length - 2} más...</div>}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                {order.items.filter(i => i.sku !== 'extra-manga').map(i => (
                                    <div key={i.id} className="bg-gray-50 rounded-md border border-gray-200 p-3">
                                        <p className="text-xs font-bold text-gray-900">{i.productName}</p>
                                        <p className="text-[10px] font-mono text-gray-500 mb-2">SKU: {i.sku}</p>
                                        <div className="flex gap-2 flex-wrap mb-2">
                                            {i.customizations.map(c => (
                                                <div key={c.id} className="flex gap-1 items-center bg-white px-2 py-1 rounded border border-gray-100">
                                                    <span className="text-[10px] font-bold text-gray-700">{c.petName}</span>
                                                    <span className="text-[9px] text-gray-400">({c.position})</span>
                                                </div>
                                            ))}
                                        </div>
                                        {i.sleeve && (
                                            <div className="bg-white p-2 rounded border border-brand-100 mt-2">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-brand-700 uppercase mb-1">
                                                    <Tag className="w-3 h-3"/> Manga Derecha
                                                </div>
                                                <div className="text-[10px] grid grid-cols-2 gap-1">
                                                    <span>Texto: <strong>{i.sleeve.text}</strong></span>
                                                    <span>Fuente: <strong>{SLEEVE_FONTS.find(f => f.id === i.sleeve?.font)?.label}</strong></span>
                                                    <span className="col-span-2">Icono: <strong>{SLEEVE_ICONS.find(ic => ic.id === i.sleeve?.icon)?.label} {SLEEVE_ICONS.find(ic => ic.id === i.sleeve?.icon)?.icon}</strong></span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                   </div>

                   <div className="pl-3 pt-4 border-t border-gray-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                       {/* VISUAL REFERENCE & DOWNLOADS */}
                       {/* ... (Kept similar logic) */}
                       
                       {order.designImage && (
                           <div className="mb-3">
                               <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                   <Eye className="w-3 h-3" /> Referencia Visual
                               </p>
                               <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                                   <img 
                                       src={order.designImage} 
                                       className="w-full h-auto max-h-48 object-contain rounded bg-white" 
                                       alt="Referencia de Diseño"
                                   />
                               </div>
                           </div>
                       )}

                       {/* DOWNLOADS */}
                       {(order.technicalSheet || order.machineFile) && (
                           <div className="flex gap-2">
                               {order.technicalSheet && (
                                   <a href={order.technicalSheet} download={`ficha-${order.id}.png`} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm">
                                       <FileText className="w-3 h-3" /> Ficha
                                   </a>
                               )}
                               {order.machineFile && (
                                   <a href={order.machineFile} download={`bordado-${order.id}.dst`} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm">
                                       <FileCode className="w-3 h-3" /> Archivo
                                   </a>
                               )}
                           </div>
                       )}

                       <div className="grid grid-cols-1 gap-2">
                           {order.status === OrderStatus.READY_TO_EMBROIDER && (
                               <button 
                                   onClick={() => onUpdateStatus(order.id, OrderStatus.IN_PROGRESS)}
                                   className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-md flex items-center justify-center gap-2"
                               >
                                   <PlayCircle className="w-3 h-3" /> Iniciar Bordado
                               </button>
                           )}
                           
                           {/* ... rest of buttons ... */}
                           {order.status === OrderStatus.IN_PROGRESS && (
                               <div className="flex gap-2">
                                    <button 
                                        onClick={() => onUpdateStatus(order.id, OrderStatus.READY_FOR_DISPATCH)}
                                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-md flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-3 h-3" /> Terminar
                                    </button>
                                    <button 
                                        onClick={() => handleReport(order.id)}
                                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold rounded-md"
                                        title="Reportar Incidencia"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                               </div>
                           )}
                           
                           {order.status === OrderStatus.ON_HOLD && (
                               <button 
                                   onClick={() => onResolveIssue(order.id)}
                                   className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-md flex items-center justify-center gap-2"
                               >
                                   <CheckCircle className="w-3 h-3" /> Resolver Incidencia
                               </button>
                           )}

                           {order.status === OrderStatus.READY_FOR_DISPATCH && (
                             <div className="space-y-3 bg-orange-50 p-3 rounded-md border border-orange-100">
                                <p className="text-[10px] font-bold text-orange-800 text-center uppercase tracking-wide">Registro de Producción</p>
                                <div className="flex gap-2">
                                    <label className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 border border-dashed rounded cursor-pointer transition-colors ${order.finishedProductPhoto ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-orange-200 text-gray-500 hover:bg-orange-100'}`}>
                                        <Camera className="w-4 h-4" />
                                        <span className="text-[9px] font-bold text-center">Foto Producto</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0], order.id, 'finishedProductPhoto')} />
                                        {order.finishedProductPhoto && <CheckCircle className="w-3 h-3 text-green-500 absolute top-1 right-1" />}
                                    </label>
                                    <label className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 border border-dashed rounded cursor-pointer transition-colors ${order.packedProductPhoto ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-orange-200 text-gray-500 hover:bg-orange-100'}`}>
                                        <Package className="w-4 h-4" />
                                        <span className="text-[9px] font-bold text-center">Foto Empaque</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0], order.id, 'packedProductPhoto')} />
                                        {order.packedProductPhoto && <CheckCircle className="w-3 h-3 text-green-500 absolute top-1 right-1" />}
                                    </label>
                                </div>
                                
                                <button 
                                    onClick={() => onUpdateStatus(order.id, OrderStatus.DISPATCHED)}
                                    disabled={!order.finishedProductPhoto || !order.packedProductPhoto}
                                    className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Send className="w-3 h-3" /> Despachar Pedido
                                </button>
                             </div>
                           )}
                       </div>
                   </div>
               </div>
               );
           })}
       </div>
    </div>
  );
};

export default ProductionView;