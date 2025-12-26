import React, { useState } from 'react';
import { Order, OrderStatus, UserRole, OrderItem } from '../../types';
import { STAFF_MEMBERS, SLEEVE_FONTS, SLEEVE_ICONS } from '../../constants';
import GarmentVisualizer from '../GarmentVisualizer';
import { Search, Eye, Download, MessageSquare, Upload, ImageIcon, FileCode, FileText, CheckCircle, Trash2, Send, Sparkles, Tag, Loader2, AlertCircle, ChevronDown, User, Box, Palette } from 'lucide-react';

interface DesignerViewProps {
    orders: Order[];
    onSubmitDesign: (orderId: string, itemId: string, assets: { image?: File, machineFile?: File, technicalSheet?: File }) => Promise<void>;
}

const DesignerView: React.FC<DesignerViewProps> = ({ orders, onSubmitDesign }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [designerDrafts, setDesignerDrafts] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

    const handleDraftFile = (file: File, itemId: string, type: 'image' | 'machineFile' | 'technicalSheet') => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setDesignerDrafts(prev => ({
                ...prev,
                [itemId]: {
                    ...prev[itemId],
                    [`${type}File`]: file,
                    [`${type}Preview`]: reader.result
                }
            }));
        };
        reader.readAsDataURL(file);
    };

    const clearDraftFile = (itemId: string, type: 'image' | 'machineFile' | 'technicalSheet') => {
        setDesignerDrafts(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [`${type}File`]: undefined,
                [`${type}Preview`]: undefined
            }
        }));
    };

    const handleSubmit = async (orderId: string, itemId: string, draft: any) => {
        setIsSubmitting(prev => ({ ...prev, [itemId]: true }));
        try {
            await onSubmitDesign(orderId, itemId, {
                image: draft.imageFile,
                machineFile: draft.machineFileFile,
                technicalSheet: draft.technicalSheetFile
            });
            setDesignerDrafts(prev => {
                const NewDrafts = { ...prev };
                delete NewDrafts[itemId];
                return NewDrafts;
            });
        } catch (error) {
            console.error('Error submitting design:', error);
        } finally {
            setIsSubmitting(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const activeDrafts = orders.filter(o =>
        (o.status === OrderStatus.DESIGN_REVIEW || o.status === OrderStatus.DESIGN_REJECTED || o.status === OrderStatus.WAITING_FOR_DESIGN) &&
        (searchTerm === '' || o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm)) &&
        (selectedStatus === 'ALL' || o.status === selectedStatus)
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Palette className="w-8 h-8 text-brand-600" />
                        Estudio de Diseño
                    </h2>
                    <p className="text-gray-500 font-medium">Gestiona y carga las matrices para cada prenda.</p>
                </div>

                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar pedido..."
                            className="pl-10 pr-4 py-2 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                {activeDrafts.map(order => {
                    const isExpanded = expandedOrderId === order.id;
                    const isRejected = order.status === OrderStatus.DESIGN_REJECTED;

                    return (
                        <div key={order.id} className={`bg-white rounded-[2.5rem] border-2 transition-all ${isExpanded ? 'border-brand-500 shadow-2xl shadow-brand-100 ring-4 ring-brand-50' : 'border-gray-100 shadow-sm hover:border-brand-200'}`}>
                            <div
                                className="p-6 md:p-8 cursor-pointer group"
                                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isRejected ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'}`}>
                                            <Palette className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-xl font-bold text-gray-800">{order.customerName}</h3>
                                                <span className="text-[10px] font-mono text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded border border-gray-100">#{order.id.slice(0, 8)}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isRejected ? 'bg-red-50 text-red-700' :
                                                        order.status === OrderStatus.DESIGN_REVIEW ? 'bg-blue-50 text-blue-700' :
                                                            'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {isRejected ? 'Corrección Pendiente' :
                                                        order.status === OrderStatus.DESIGN_REVIEW ? 'En Revisión (Cliente)' :
                                                            'Nuevo Diseño'}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">• {order.items.length} Prendas</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right mr-4 hidden md:block">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Fecha Pedido</p>
                                            <p className="text-sm font-bold text-gray-700">{new Date(order.orderDate).toLocaleDateString()}</p>
                                        </div>
                                        <button className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 rotate-180' : 'bg-gray-50 text-gray-400 group-hover:bg-brand-50'}`}>
                                            <ChevronDown className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="border-t border-gray-100">
                                    {isRejected && (
                                        <div className="bg-red-50 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start border-b border-red-100">
                                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <AlertCircle className="w-6 h-6 text-red-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-red-900 font-black mb-1">COMENTARIOS DEL CLIENTE:</h4>
                                                <p className="text-red-700 font-medium leading-relaxed italic bg-white/50 p-4 rounded-2xl border border-red-100 border-dashed">
                                                    "{order.clientFeedback || 'Sin comentarios específicos de nivel de pedido.'}"
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 md:p-8 space-y-12 bg-gray-50/30">
                                        {/* ORDER ITEMS CONTEXT - Grouped by Pack */}
                                        {(() => {
                                            const itemGroups: Record<string, OrderItem[]> = {};
                                            order.items.forEach(item => {
                                                if (item.sku === 'extra-manga') return;
                                                const key = item.groupId || `item-${item.id}`;
                                                if (!itemGroups[key]) itemGroups[key] = [];
                                                itemGroups[key].push(item);
                                            });

                                            return Object.entries(itemGroups).map(([groupId, groupItems]) => {
                                                const item = groupItems[0];
                                                const isPack = groupItems.length > 1;
                                                const draft = designerDrafts[item.id] || {};
                                                const isReadyToSubmit = draft.imageFile && draft.machineFileFile && draft.technicalSheetFile;
                                                const submitting = isSubmitting[item.id];

                                                const groupRejected = groupItems.some(gi => gi.designStatus === 'REJECTED');
                                                const groupApproved = groupItems.some(gi => gi.designStatus === 'APPROVED');
                                                const rejectionFeedback = groupItems.find(gi => gi.designFeedback)?.designFeedback;

                                                return (
                                                    <div key={groupId} className={`bg-white border rounded-3xl p-4 md:p-8 shadow-sm space-y-6 ${groupRejected ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-200'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-bold text-gray-800 text-xl">{isPack ? `Pack: ${item.productName}` : item.productName}</h4>
                                                                    {isPack && <span className="bg-brand-100 text-brand-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Pack</span>}
                                                                </div>
                                                                <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">SKU: {item.sku}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {groupApproved && (
                                                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                        <CheckCircle className="w-3 h-3" /> Aprobado
                                                                    </span>
                                                                )}
                                                                {groupRejected && (
                                                                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                                                                        <AlertCircle className="w-3 h-3" /> Corregir
                                                                    </span>
                                                                )}
                                                                {!groupApproved && !groupRejected && item.designImage && (
                                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                        <Loader2 className="w-3 h-3" /> En Revisión
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {groupRejected && rejectionFeedback && (
                                                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                                                <p className="text-xs font-bold text-red-800 flex items-center gap-1 mb-1"><MessageSquare className="w-3 h-3" /> Nota del Cliente:</p>
                                                                <p className="text-sm text-red-900">"{rejectionFeedback}"</p>
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col lg:flex-row gap-8">
                                                            <div className="lg:w-1/3 space-y-4">
                                                                <div className="flex flex-col items-center">
                                                                    <GarmentVisualizer
                                                                        productName={item.productName}
                                                                        sku={item.sku}
                                                                        readOnly={true}
                                                                        slotCount={item.customizations.length}
                                                                        placements={item.customizations.filter(c => c.position).map(c => ({ position: c.position!, label: c.petName || 'Mascota' }))}
                                                                    />
                                                                </div>

                                                                {isPack && (
                                                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Prendas en este pack:</p>
                                                                        <div className="space-y-1">
                                                                            {groupItems.map(gi => (
                                                                                <div key={gi.id} className="text-[10px] text-gray-600 flex justify-between">
                                                                                    <span>• {gi.productName} ({gi.size})</span>
                                                                                    <span className="text-gray-400">{gi.color}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {item.sleeve && (
                                                                    <div className="mt-4 bg-gray-900 text-white p-3 rounded-xl w-full">
                                                                        <div className="flex items-center gap-2 mb-2 border-b border-gray-700 pb-2">
                                                                            <Tag className="w-4 h-4" />
                                                                            <span className="text-xs font-bold uppercase">Manga Derecha</span>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                                            <div>
                                                                                <span className="text-gray-400 block text-[10px]">Texto</span>
                                                                                <span className="font-bold text-sm">{item.sleeve.text}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-gray-400 block text-[10px]">Fuente</span>
                                                                                <span className="font-bold text-brand-400">{item.sleeve.font}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="lg:w-2/3 space-y-6">
                                                                <div className="grid sm:grid-cols-2 gap-4">
                                                                    {item.customizations.map((slot) => (
                                                                        <div key={slot.id} className="border border-gray-200 rounded-xl p-3 flex gap-3 bg-white">
                                                                            <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden group">
                                                                                {slot.photoUrl ? (
                                                                                    <img src={slot.photoUrl} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Sin Foto</div>
                                                                                )}
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                                    <a href={slot.photoUrl} download={`Ref-${slot.petName}-${order.id}.png`} className="p-1.5 bg-brand-600 rounded-full text-white hover:scale-110"><Download className="w-4 h-4" /></a>
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

                                                                <div className={`mt-6 border-2 border-dashed rounded-3xl p-6 ${groupRejected ? 'bg-red-50/30 border-red-200' : 'bg-brand-50/20 border-brand-100'}`}>
                                                                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                                                        <Upload className="w-4 h-4" />
                                                                        {item.designImage ? 'Actualizar Diseño' : 'Subir Diseño'}
                                                                    </h4>

                                                                    <div className="grid md:grid-cols-3 gap-4">
                                                                        <div className={`border rounded-xl p-4 transition-all ${draft.imagePreview || item.designImage ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300 bg-white'}`}>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="text-xs font-bold text-gray-500 uppercase">1. Visual</span>
                                                                                {(draft.imagePreview || item.designImage) && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                                            </div>
                                                                            {draft.imagePreview ? (
                                                                                <div className="relative group">
                                                                                    <img src={draft.imagePreview} className="w-full h-32 object-contain rounded bg-white border border-gray-100" />
                                                                                    <button onClick={() => clearDraftFile(item.id, 'image')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                                                                                </div>
                                                                            ) : item.designImage ? (
                                                                                <div className="relative group">
                                                                                    <img src={item.designImage} className="w-full h-32 object-contain rounded bg-white border border-gray-100 opacity-60" />
                                                                                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span className="bg-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">Cambiar</span>
                                                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'image')} />
                                                                                    </label>
                                                                                </div>
                                                                            ) : (
                                                                                <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                                                                    <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                                                                                    <span className="text-xs text-brand-600 font-bold">Subir Imagen</span>
                                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'image')} />
                                                                                </label>
                                                                            )}
                                                                        </div>

                                                                        <div className={`border rounded-xl p-4 transition-all ${draft.machineFilePreview || item.machineFile ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300 bg-white'}`}>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="text-xs font-bold text-gray-500 uppercase">2. Máquina</span>
                                                                                {(draft.machineFilePreview || item.machineFile) && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                                            </div>
                                                                            {draft.machineFilePreview ? (
                                                                                <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative">
                                                                                    <FileCode className="w-8 h-8 text-gray-700 mb-2" />
                                                                                    <span className="text-xs font-mono text-gray-500">Nuevo Archivo</span>
                                                                                    <button onClick={() => clearDraftFile(item.id, 'machineFile')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                                                                                </div>
                                                                            ) : item.machineFile ? (
                                                                                <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative group opacity-60">
                                                                                    <FileCode className="w-8 h-8 text-gray-400 mb-2" />
                                                                                    <span className="text-[10px] font-mono text-gray-500">Existente</span>
                                                                                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span className="bg-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">Cambiar</span>
                                                                                        <input type="file" className="hidden" accept=".dst,.emb,.pes" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'machineFile')} />
                                                                                    </label>
                                                                                </div>
                                                                            ) : (
                                                                                <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                                                                    <FileCode className="w-6 h-6 text-gray-400 mb-1" />
                                                                                    <span className="text-xs text-brand-600 font-bold">Subir .DST/.EMB</span>
                                                                                    <input type="file" className="hidden" accept=".dst,.emb,.pes" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'machineFile')} />
                                                                                </label>
                                                                            )}
                                                                        </div>

                                                                        <div className={`border rounded-xl p-4 transition-all ${draft.technicalSheetPreview || item.technicalSheet ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-brand-300 bg-white'}`}>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="text-xs font-bold text-gray-500 uppercase">3. Ficha</span>
                                                                                {(draft.technicalSheetPreview || item.technicalSheet) && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                                            </div>
                                                                            {draft.technicalSheetPreview ? (
                                                                                <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative">
                                                                                    <FileText className="w-8 h-8 text-gray-700 mb-2" />
                                                                                    <span className="text-xs font-mono text-gray-500">Nuevo Archivo</span>
                                                                                    <button onClick={() => clearDraftFile(item.id, 'technicalSheet')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                                                                                </div>
                                                                            ) : item.technicalSheet ? (
                                                                                <div className="h-32 flex flex-col items-center justify-center bg-white border border-gray-100 rounded relative group opacity-60">
                                                                                    <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                                                                    <span className="text-[10px] font-mono text-gray-500">Existente</span>
                                                                                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span className="bg-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">Cambiar</span>
                                                                                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'technicalSheet')} />
                                                                                    </label>
                                                                                </div>
                                                                            ) : (
                                                                                <label className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300 cursor-pointer hover:bg-white">
                                                                                    <FileText className="w-6 h-6 text-gray-400 mb-1" />
                                                                                    <span className="text-xs text-brand-600 font-bold">Subir PDF/IMG</span>
                                                                                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && handleDraftFile(e.target.files[0], item.id, 'technicalSheet')} />
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-6 flex justify-end">
                                                                        <button
                                                                            onClick={() => handleSubmit(order.id, item.id, draft)}
                                                                            disabled={!isReadyToSubmit || submitting}
                                                                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all micro-hover ${isReadyToSubmit
                                                                                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-100'
                                                                                : 'bg-gray-300 text-white cursor-not-allowed'
                                                                                }`}
                                                                        >
                                                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                                            {item.designImage ? 'Actualizar Diseño' : 'Cargar Diseño'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
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