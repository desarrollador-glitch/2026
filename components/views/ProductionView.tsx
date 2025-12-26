import React, { useState } from 'react';
import { Order, OrderStatus, UserRole } from '../../types';
import StatusBadge from '../StatusBadge';
import { Search, CheckCircle, Eye, FileText, FileCode, PlayCircle, Check, AlertTriangle, Camera, Package, Send, Tag, ShoppingBag, ChevronDown, Box, User, Clock } from 'lucide-react';
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
    const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

    const toggleOrderExpansion = (orderId: string) => {
        setExpandedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const filteredOrders = orders.filter(order => {
        // Role Filtering
        if (currentRole === UserRole.EMBROIDERER) {
            if (![OrderStatus.READY_TO_EMBROIDER, OrderStatus.IN_PROGRESS, OrderStatus.ON_HOLD].includes(order.status)) {
                return false;
            }
        }
        if (currentRole === UserRole.PACKER) {
            if (order.status !== OrderStatus.READY_FOR_DISPATCH) {
                return false;
            }
        }
        // Text Search
        return order.id.includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleReport = (orderId: string) => {
        const reason = prompt("Describe el problema (Máquina averiada, Prenda defectuosa, Falta insumos):");
        if (reason) onReportIssue(orderId, reason);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 sticky top-16 z-30 bg-gray-50/95 backdrop-blur py-2">
                <h2 className="text-2xl font-bold text-gray-900">
                    {currentRole === UserRole.EMBROIDERER ? 'Panel de Bordado' : currentRole === UserRole.PACKER ? 'Panel de Empaque' : 'Administración'}
                </h2>
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar pedido..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 bg-white focus:ring-2 focus:ring-brand-500 text-gray-900 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {filteredOrders.map(order => {
                    const isExpanded = expandedOrderIds.has(order.id);
                    const hasIssue = order.status === OrderStatus.ON_HOLD;

                    return (
                        <div
                            key={order.id}
                            className={`bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ring-1 ring-black/5 transition-all duration-300 animate-soft-fade ${isExpanded ? 'shadow-xl ring-brand-200' : 'hover:shadow-md'} ${hasIssue ? 'border-red-200' : ''}`}
                        >
                            {/* Header / Trigger */}
                            <div
                                onClick={() => toggleOrderExpansion(order.id)}
                                className={`cursor-pointer transition-colors duration-300 px-4 py-4 md:px-6 md:py-5 flex items-center justify-between ${isExpanded ? 'bg-gray-50/80 border-b border-gray-100' : 'bg-white hover:bg-gray-50/50'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl transition-all duration-300 ${isExpanded ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' : 'bg-gray-100 text-gray-400'} ${hasIssue ? 'bg-red-600 text-white' : ''}`}>
                                        {currentRole === UserRole.EMBROIDERER ? <ShoppingBag className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-base md:text-lg text-gray-900 flex items-center gap-2">
                                            Orden #{order.id}
                                            {hasIssue && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200 animate-pulse">INCIDENCIA</span>}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 font-medium tracking-wide uppercase">
                                            <User className="w-3 h-3" />
                                            <span>{order.customerName}</span>
                                            {!isExpanded && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-brand-600">{order.items.length} items</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {!isExpanded && (
                                        <div className="hidden sm:block">
                                            <StatusBadge status={order.status} />
                                        </div>
                                    )}
                                    <div className={`transition-transform duration-400 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                        <ChevronDown className={`w-5 h-5 ${isExpanded ? 'text-brand-600' : 'text-gray-400'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Content Area */}
                            <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                                <div className="expandable-inner">
                                    <div className="p-4 md:p-8 space-y-8 bg-gray-50/30">
                                        {/* INCIDENCIA PANEL */}
                                        {hasIssue && (
                                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 animate-in slide-in-from-top-2">
                                                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                                                <div>
                                                    <h4 className="font-bold text-red-900 mb-1 tracking-tight">Producción Detenida</h4>
                                                    <p className="text-sm text-red-700 leading-relaxed font-medium">"{order.productionIssue}"</p>
                                                    <button onClick={() => onResolveIssue(order.id)} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100">Resolver y Continuar</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid lg:grid-cols-2 gap-8">
                                            {/* LEFT COLUMN: ITEMS & SPECS */}
                                            <div className="space-y-6">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Box className="w-4 h-4" /> Detalle de Prendas
                                                </h4>
                                                <div className="space-y-4">
                                                    {order.items.filter(i => i.sku !== 'extra-manga').map(item => (
                                                        <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm relative group overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div>
                                                                    <p className="font-extrabold text-gray-900">{item.productName}</p>
                                                                    <p className="text-[10px] font-mono text-gray-400 uppercase">{item.sku}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 flex-wrap mb-4">
                                                                {item.customizations.map(c => (
                                                                    <div key={c.id} className="flex flex-col bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Mascota</span>
                                                                        <span className="text-xs font-extrabold text-gray-800">{c.petName || 'S/N'}</span>
                                                                        <span className="text-[10px] text-brand-600 font-bold mt-0.5">{c.position}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* ITEM SPECIFIC DESIGN */}
                                                            {(item.designImage || item.technicalSheet || item.machineFile) && (
                                                                <div className="mt-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 space-y-4">
                                                                    {item.designImage && (
                                                                        <div className="relative group">
                                                                            <p className="text-[9px] font-bold text-brand-600 uppercase mb-2 flex items-center gap-1">
                                                                                <Eye className="w-3 h-3" /> Guía de Bordado
                                                                            </p>
                                                                            <img src={item.designImage} className="w-full h-auto max-h-48 object-contain rounded-lg bg-white border border-brand-100 shadow-sm" alt="Diseño" />
                                                                        </div>
                                                                    )}
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {item.technicalSheet && (
                                                                            <a href={item.technicalSheet} download className="flex items-center justify-center gap-2 py-2 bg-white text-green-700 rounded-xl border border-green-200 text-[10px] font-bold uppercase hover:bg-green-50 transition-colors">
                                                                                <FileText className="w-3.5 h-3.5" /> Ficha
                                                                            </a>
                                                                        )}
                                                                        {item.machineFile && (
                                                                            <a href={item.machineFile} download className="flex items-center justify-center gap-2 py-2 bg-white text-blue-700 rounded-xl border border-blue-200 text-[10px] font-bold uppercase hover:bg-blue-50 transition-colors">
                                                                                <FileCode className="w-3.5 h-3.5" /> Archivo
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.sleeve && (
                                                                <div className="bg-gray-900 text-white p-4 rounded-xl mt-4">
                                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2">
                                                                        <Tag className="w-3.5 h-3.5" /> Extra Manga
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                                        <div>
                                                                            <span className="text-gray-500 block text-[9px]">TEXTO</span>
                                                                            <span className="font-bold text-sm tracking-tight">{item.sleeve.text}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-gray-500 block text-[9px]">FUENTE</span>
                                                                            <span className="font-bold truncate">{SLEEVE_FONTS.find(f => f.id === item.sleeve?.font)?.label}</span>
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <span className="text-gray-500 block text-[9px]">ICONO</span>
                                                                            <span className="font-bold">{SLEEVE_ICONS.find(ic => ic.id === item.sleeve?.icon)?.label} {SLEEVE_ICONS.find(ic => ic.id === item.sleeve?.icon)?.icon}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* RIGHT COLUMN: ACTIONS */}
                                            <div className="space-y-6">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Clock className="w-4 h-4" /> Control de Producción
                                                </h4>

                                                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
                                                    <div className="pt-4 border-t border-gray-50">
                                                        {order.status === OrderStatus.READY_TO_EMBROIDER && (
                                                            <button
                                                                onClick={() => onUpdateStatus(order.id, OrderStatus.IN_PROGRESS)}
                                                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg micro-hover"
                                                            >
                                                                <PlayCircle className="w-5 h-5" /> COMENZAR TRABAJO
                                                            </button>
                                                        )}

                                                        {order.status === OrderStatus.IN_PROGRESS && (
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={() => onUpdateStatus(order.id, OrderStatus.READY_FOR_DISPATCH)}
                                                                    className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg micro-hover"
                                                                >
                                                                    <Check className="w-5 h-5" /> COMPLETAR
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReport(order.id)}
                                                                    className="p-4 bg-red-100 text-red-600 rounded-2xl hover:bg-red-200 transition-colors"
                                                                    title="Reportar Incidencia"
                                                                >
                                                                    <AlertTriangle className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {order.status === OrderStatus.READY_FOR_DISPATCH && (currentRole === UserRole.PACKER || currentRole === UserRole.ADMIN) && (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <label className={`flex flex-col items-center justify-center gap-2 p-4 border border-dashed rounded-2xl cursor-pointer transition-all ${order.finishedProductPhoto ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'}`}>
                                                                        <Camera className="w-5 h-5" />
                                                                        <span className="text-[10px] font-bold text-center leading-tight uppercase">Evidencia Prenda</span>
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0], order.id, 'finishedProductPhoto')} />
                                                                        {order.finishedProductPhoto && <CheckCircle className="w-4 h-4 text-green-500 absolute top-2 right-2" />}
                                                                    </label>
                                                                    <label className={`flex flex-col items-center justify-center gap-2 p-4 border border-dashed rounded-2xl cursor-pointer transition-all ${order.packedProductPhoto ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'}`}>
                                                                        <Package className="w-5 h-5" />
                                                                        <span className="text-[10px] font-bold text-center leading-tight uppercase">Evidencia Empaque</span>
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0], order.id, 'packedProductPhoto')} />
                                                                        {order.packedProductPhoto && <CheckCircle className="w-4 h-4 text-green-500 absolute top-2 right-2" />}
                                                                    </label>
                                                                </div>

                                                                <button
                                                                    onClick={() => onUpdateStatus(order.id, OrderStatus.DISPATCHED)}
                                                                    disabled={!order.finishedProductPhoto || !order.packedProductPhoto}
                                                                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed transition-all shadow-lg micro-hover"
                                                                >
                                                                    <Send className="w-5 h-5" /> DESPACHAR AHORA
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredOrders.length === 0 && (
                    <div className="text-center py-24 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Bandeja Vacía</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionView;