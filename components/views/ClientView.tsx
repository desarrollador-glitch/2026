import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, SleeveConfig, OrderItem, EmbroiderySlot, EmbroideryPosition } from '../../types';
import StatusBadge from '../StatusBadge';
import OrderProgress from '../OrderProgress';
import GarmentVisualizer from '../GarmentVisualizer';
import SleeveDesigner from '../SleeveDesigner';
import { Search, Lock, Palette, CheckCircle, XCircle, Sparkles, Loader2, Image as ImageIcon, Check, Shirt, Info, Upload, Plus, Minus, Tag, Box, AlertTriangle, Send, Cloud, CloudOff, History, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import PawModal from '../PawModal';
import { SLEEVE_FONTS, SLEEVE_ICONS, PRODUCT_ILLUSTRATIONS } from '../../constants';
import PositionImageSelector from '../PositionImageSelector';

interface ClientViewProps {
    orders: Order[];
    onUpdateSlot: (orderId: string, itemId: string, slotId: string, updates: any) => Promise<void>;
    onInitiateUpload: (file: File, orderId: string, itemId: string, slotId: string) => void;
    onEditImage: (orderId: string, itemId: string, slotId: string, currentImage: string, prompt: string) => void;
    onReviewDesign: (orderId: string, approved: boolean, feedback?: string, itemId?: string) => void;
    isProcessing: boolean;
    onUpdateSleeve?: (orderId: string, itemId: string, config: SleeveConfig | undefined) => Promise<void>;
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

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const ClientView: React.FC<ClientViewProps> = ({
    orders, onUpdateSlot, onInitiateUpload, onEditImage, onReviewDesign, isProcessing, onUpdateSleeve, onFinalizeOrder
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
    const [removingItemDesignId, setRemovingItemDesignId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
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

    // AUTO-SAVE STATE
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [pendingSlotChanges, setPendingSlotChanges] = useState<Record<string, PendingSlotChange>>({});
    const [pendingSleeveChanges, setPendingSleeveChanges] = useState<Record<string, PendingSleeveChange>>({});

    // --- NEW STATE FOR UPLOAD FLOW ---
    const [uploadTarget, setUploadTarget] = useState<{ orderId: string; itemId: string; slotId: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const pendingSlotsRef = useRef(pendingSlotChanges);
    const pendingSleevesRef = useRef(pendingSleeveChanges);

    useEffect(() => {
        pendingSlotsRef.current = pendingSlotChanges;
        pendingSleevesRef.current = pendingSleeveChanges;
    }, [pendingSlotChanges, pendingSleeveChanges]);

    useEffect(() => {
        const hasChanges = Object.keys(pendingSlotChanges).length > 0 || Object.keys(pendingSleeveChanges).length > 0;

        if (!hasChanges) return;

        setSaveStatus('pending');

        const timer = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                const slotsToSave = { ...pendingSlotsRef.current };
                const sleevesToSave = { ...pendingSleevesRef.current };

                const slotPromises = Object.entries(slotsToSave).map(([slotId, data]) => {
                    const d = data as PendingSlotChange;
                    return onUpdateSlot(d.orderId, d.itemId, slotId, d.changes);
                });

                const sleevePromises = Object.entries(sleevesToSave).map(([itemId, data]) => {
                    const d = data as PendingSleeveChange;
                    return onUpdateSleeve?.(d.orderId, itemId, d.config);
                });

                await Promise.all([...slotPromises, ...sleevePromises]);

                setPendingSlotChanges({});
                setPendingSleeveChanges({});

                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 3000);

            } catch (e) {
                console.error(e);
                setSaveStatus('error');
                toast.error("Error al guardar cambios automáticos. Revisa tu conexión.");
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [pendingSlotChanges, pendingSleeveChanges, onUpdateSlot, onUpdateSleeve]);

    const filteredOrders = orders.filter(o =>
        o.id.includes(searchTerm) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleLocalSlotChange = (order: Order, item: OrderItem, slotId: string, slotIndex: number, change: Partial<EmbroiderySlot>) => {
        setPendingSlotChanges(prev => ({
            ...prev,
            [slotId]: {
                orderId: order.id,
                itemId: item.id,
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

    const handleConfirmAndTriggerUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && uploadTarget) {
            if (saveStatus === 'pending' || saveStatus === 'saving') {
                toast("Guardando cambios anteriores antes de subir foto...", { icon: '⏳' });
            }
            onInitiateUpload(file, uploadTarget.orderId, uploadTarget.itemId, uploadTarget.slotId);
        }
        setUploadTarget(null); // Cierra el modal y limpia el estado
        if (event.target) {
            event.target.value = ''; // Permite volver a seleccionar el mismo archivo
        }
    };

    const isSleeveItem = (item: OrderItem) => {
        if (item.customizationType === 'TEXT_ONLY') return true;
        return item.sku && item.sku.toLowerCase() === 'extra-manga';
    };

    const groupItems = (items: OrderItem[]) => {
        const bundles: Record<string, OrderItem[]> = {};
        const singles: OrderItem[] = [];
        const upgrades: OrderItem[] = [];

        items.forEach(item => {
            const skuLower = item.sku?.toLowerCase() || '';
            const isUpgrade = skuLower.includes('extra') || skuLower.includes('mejora') || skuLower.includes('grande');

            if (isUpgrade) {
                upgrades.push(item);
                return;
            }

            if (item.groupId) {
                if (!bundles[item.groupId]) bundles[item.groupId] = [];
                bundles[item.groupId].push(item);
            } else {
                singles.push(item);
            }
        });
        return { bundles, singles, upgrades };
    };

    const calculateSleeveStats = (order: Order) => {
        const totalSleeveCredits = order.items.filter(i => isSleeveItem(i)).reduce((acc, item) => acc + item.quantity, 0);

        let assignedCount = 0;
        order.items.forEach(item => {
            if (isSleeveItem(item)) return;

            const pending = pendingSleeveChanges[item.id];
            if (pending !== undefined) {
                if (pending.config) assignedCount++;
            } else {
                if (item.sleeve) assignedCount++;
            }
        });

        return {
            total: totalSleeveCredits,
            assigned: assignedCount,
            remaining: totalSleeveCredits - assignedCount
        };
    };

    const PetSlotCard: React.FC<{
        slot: EmbroiderySlot;
        index: number;
        item: OrderItem;
        order: Order;
        isLocked: boolean;
        isPrimaryInBundle?: boolean;
    }> = ({ slot, index, item, order, isLocked, isPrimaryInBundle = true }) => {
        const skuLower = item.sku?.toLowerCase() || '';
        const isGrande = skuLower.includes('grande') || item.customizationCategory === 'GRANDE';
        const isCollege = skuLower.includes('college') || item.customizationCategory === 'COLLEGE';
        const illustrationRef = PRODUCT_ILLUSTRATIONS[isGrande ? 'GRANDE' : 'COLOR'];

        const [localName, setLocalName] = useState(pendingSlotChanges[slot.id]?.changes?.petName ?? slot.petName ?? '');

        useEffect(() => {
            if (!pendingSlotChanges[slot.id]?.changes?.petName) {
                setLocalName(slot.petName || '');
            }
        }, [slot.petName, pendingSlotChanges[slot.id]]);

        const pending = pendingSlotChanges[slot.id]?.changes;
        const displayValues = {
            position: pending?.position !== undefined ? pending.position : slot.position,
            includeHalo: pending?.includeHalo !== undefined ? pending.includeHalo : slot.includeHalo,
            wizardStep: pending?.wizardStep !== undefined ? pending.wizardStep : (slot.wizardStep || 1),
            fontId: pending?.fontId !== undefined ? pending.fontId : slot.fontId,
            sleeveIconId: pending?.sleeveIconId !== undefined ? pending.sleeveIconId : slot.sleeveIconId,
            includeName: pending?.includeName !== undefined ? pending.includeName : (slot.includeName ?? false),
        };

        const multiPetPositions: Record<number, { pos: EmbroideryPosition; label: string }[]> = {
            5: [
                { pos: 'FAR_LEFT', label: 'Lado izquierdo' },
                { pos: 'CENTER_LEFT', label: 'Lado centro izquierdo' },
                { pos: 'CENTER', label: 'Lado centro' },
                { pos: 'CENTER_RIGHT', label: 'Lado centro derecho' },
                { pos: 'FAR_RIGHT', label: 'Lado derecho' },
            ]
        };

        const isFixedPositionProduct = item.customizations.length >= 2;
        const fixedPosInfo = isFixedPositionProduct ? (multiPetPositions[item.customizations.length]?.[index] || { label: `Posición ${index + 1}` }) : null;

        useEffect(() => {
            if (fixedPosInfo && !displayValues.position) {
                const pos = (fixedPosInfo as any).pos;
                if (pos) {
                    handleLocalSlotChange(order, item, slot.id, index, { position: pos });
                }
            }
            if (isGrande && !displayValues.position) {
                handleLocalSlotChange(order, item, slot.id, index, { position: 'BACK_NECK' });
            }
        }, [fixedPosInfo, isGrande, displayValues.position, handleLocalSlotChange, order, item, slot.id, index]);

        const handleBlur = () => {
            const currentSavedOrPending = pendingSlotChanges[slot.id]?.changes?.petName ?? slot.petName ?? '';
            if (localName !== currentSavedOrPending) {
                handleLocalSlotChange(order, item, slot.id, index, { petName: localName });
            }
        };

        const goToStep = (step: number) => {
            if (isLocked) return;
            handleLocalSlotChange(order, item, slot.id, index, { wizardStep: step });
        };

        const isPendingSave = !!pendingSlotChanges[slot.id];

        return (
            <div key={slot.id} className={`bg-white border-2 rounded-[2.5rem] p-6 sm:p-8 transition-all duration-500 shadow-sm hover:shadow-xl ${displayValues.wizardStep === 3 && slot.status === 'APPROVED' ? 'border-green-100 ring-2 ring-green-50' : 'border-gray-50'} ${isPendingSave ? 'ring-2 ring-brand-100' : ''}`}>
                {/* SLOT HEADER */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-900 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg">
                            {index + 1}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 leading-none">
                                {fixedPosInfo ? `Retrato ${index + 1}: ${fixedPosInfo.label}` : `Mascota #${index + 1}`}
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{isGrande ? 'Personalización Grande' : isCollege ? 'Estilo College' : 'Estilo Color'}</p>
                        </div>
                    </div>

                    <div className="flex gap-1.5">
                        {[1, 2, 3].map(s => (
                            <button
                                key={s}
                                onClick={() => !isLocked && displayValues.wizardStep >= s && goToStep(s)}
                                className={`h-1.5 rounded-full transition-all duration-500 ${displayValues.wizardStep === s ? 'w-8 bg-brand-600' : 'w-2 bg-gray-100 opacity-50'}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    {/* STEP 1: UBICACIÓN */}
                    {displayValues.wizardStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Paso 1: Ubicación</h5>

                            <div className="flex flex-col items-center gap-4">
                                {isFixedPositionProduct ? (
                                    <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-2">
                                            <img src="/refs/position-marker.png" className="w-full h-full object-contain opacity-40" alt="Pos" />
                                        </div>
                                        <p className="text-xs font-bold text-gray-700 uppercase">{fixedPosInfo?.label}</p>
                                    </div>
                                ) : (
                                    <PositionImageSelector
                                        productName={item.productName}
                                        sku={item.sku}
                                        selected={displayValues.position}
                                        onSelect={(pos) => {
                                            if (!isLocked) {
                                                handleLocalSlotChange(order, item, slot.id, index, { position: pos, wizardStep: 2 });
                                                toast.success("¡Ubicación guardada!", { icon: '📍', duration: 1500 });
                                            }
                                        }}
                                        slotCount={item.customizations.length}
                                        readOnly={isLocked}
                                    />
                                )}
                                {isGrande && <p className="text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1 rounded-full uppercase">Posición única centrada para bordado grande</p>}
                            </div>
                            <button
                                onClick={() => (displayValues.position || isGrande) && goToStep(2)}
                                disabled={!displayValues.position && !isGrande}
                                className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg disabled:opacity-30 transition-all hover:scale-[1.02]"
                            >
                                CONTINUAR AL PASO 2
                            </button>
                        </div>
                    )}

                    {/* STEP 2: PERSONALIZACIÓN DE NOMBRE */}
                    {displayValues.wizardStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Paso 2: ¿Deseas agregar el nombre?</h5>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 block text-center italic">¿Quieres agregar el nombre de tu mascota debajo del retrato?</label>
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => handleLocalSlotChange(order, item, slot.id, index, { includeName: true })}
                                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${displayValues.includeName ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400'}`}
                                        >
                                            SÍ
                                        </button>
                                        <button
                                            onClick={() => handleLocalSlotChange(order, item, slot.id, index, { includeName: false, wizardStep: 3 })}
                                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${!displayValues.includeName ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400'}`}
                                        >
                                            NO
                                        </button>
                                    </div>
                                </div>

                                {displayValues.includeName && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 block text-center italic">Selecciona la tipografía que debe tener el nombre</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {SLEEVE_FONTS.filter(f => ['TIMES', 'COMIC', 'COLLEGE'].includes(f.shorthand.toUpperCase()) || ['TIMES', 'COMIC', 'COLLEGE'].includes(f.id.toUpperCase())).map(font => (
                                                <button
                                                    key={font.id}
                                                    disabled={isLocked}
                                                    onClick={() => handleLocalSlotChange(order, item, slot.id, index, { fontId: font.id, wizardStep: 3 })}
                                                    className={`py-3 px-1 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${displayValues.fontId === font.id ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm ring-1 ring-brand-200' : 'bg-white border-gray-100 text-gray-300'}`}
                                                >
                                                    <span className="text-2xl leading-none" style={{ fontFamily: font.family }}>Aa</span>
                                                    <span className="text-[8px] font-black">{font.shorthand}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => goToStep(1)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-widest">VOLVER</button>
                                <button
                                    onClick={() => goToStep(3)}
                                    // Continuar si dice NO, o si dice SÍ y seleccionó tipografía
                                    disabled={displayValues.includeName && !displayValues.fontId}
                                    className="flex-[2] py-3 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg disabled:opacity-30"
                                >
                                    CONTINUAR AL PASO 3
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FOTO / NOMBRE / AUREOLA */}
                    {displayValues.wizardStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Paso 3: Foto, Nombre y Aureola</h5>

                            <div className="space-y-6">
                                <div className="flex flex-col items-center gap-6">
                                    <div className={`w-56 h-56 rounded-3xl overflow-hidden relative border-4 shadow-xl transition-all duration-500 group ${isLocked ? 'border-gray-100' : 'border-brand-100 hover:border-brand-300'}`}>
                                        {slot.photoUrl ? (
                                            <img src={slot.photoUrl} alt="Pet" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-300 gap-3 border-dashed border-4 border-gray-200 m-2 rounded-2xl">
                                                <ImageIcon className="w-12 h-12" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">SUBIR FOTO</span>
                                            </div>
                                        )}

                                        {slot.status === 'APPROVED' && (
                                            <div className="absolute inset-0 bg-green-500/10 flex flex-col items-center justify-end p-4">
                                                <div className="bg-green-600 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase flex items-center gap-1 shadow-lg mb-2">
                                                    <Check className="w-3 h-3" /> VALIDADA
                                                </div>
                                            </div>
                                        )}

                                        {!isLocked && (slot.status === 'EMPTY' || slot.status === 'REJECTED') && (
                                            <button
                                                onClick={() => setUploadTarget({ orderId: order.id, itemId: item.id, slotId: slot.id })}
                                                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                                            >
                                                <Upload className="w-10 h-10 text-white mb-2" />
                                                <span className="text-xs text-white font-black uppercase tracking-widest">SUBIR FOTO</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* AI LOGIC RESULT DISPLAY */}
                                    {slot.status !== 'EMPTY' && (
                                        <div className={`w-full p-4 rounded-2xl border ${slot.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-700' : slot.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                            <div className="flex items-center gap-3 mb-2">
                                                {slot.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : slot.status === 'REJECTED' ? <AlertTriangle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                                                <span className="font-bold text-sm uppercase">Resultado del análisis IA</span>
                                            </div>
                                            <p className="text-xs leading-relaxed">
                                                {slot.status === 'APPROVED' ? '¡La imagen es perfecta para el bordado! Nuestro sistema ha validado la nitidez y el enfoque.' : slot.status === 'REJECTED' ? (slot.aiReason || 'La imagen no cumple con los requisitos de calidad. Por favor intenta con una foto más nítida y enfocada.') : 'Analizando tu imagen... un momento por favor.'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className={`grid gap-4 ${displayValues.includeName ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                    {displayValues.includeName && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block italic text-center">Nombre que irá bajo el retrato</label>
                                            <input
                                                type="text"
                                                disabled={isLocked}
                                                placeholder="Nombre para el diseño..."
                                                className="w-full border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-brand-500 shadow-sm text-center font-bold"
                                                value={localName}
                                                onChange={(e) => setLocalName(e.target.value)}
                                                onBlur={handleBlur}
                                            />
                                        </div>
                                    )}

                                    <div className={`animate-in fade-in slide-in-from-top-2 duration-300 ${!displayValues.includeName ? 'max-w-xs mx-auto w-full' : ''}`}>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block text-center italic">¿Incluir aureola a mi mascota?</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleLocalSlotChange(order, item, slot.id, index, { includeHalo: true })}
                                                className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all text-xs ${displayValues.includeHalo ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                SÍ
                                            </button>
                                            <button
                                                onClick={() => handleLocalSlotChange(order, item, slot.id, index, { includeHalo: false })}
                                                className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all text-xs ${!displayValues.includeHalo ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                NO
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => goToStep(2)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-widest">VOLVER</button>
                                    <button
                                        disabled={!slot.photoUrl || slot.status === 'REJECTED' || (displayValues.includeName && !localName)}
                                        onClick={() => {
                                            toast.success("¡Información enviada con éxito!", { icon: '✨' });
                                            // Here would go the logic to mark as ready if needed, 
                                            // but the parent handles status changes based on slots.
                                        }}
                                        className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg disabled:opacity-30"
                                    >
                                        FINALIZAR MASCOTA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-12">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelected}
            />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 z-40 bg-gray-50/95 backdrop-blur py-2">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg md:text-2xl font-bold text-gray-900">Mis Pedidos</h2>

                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 ${saveStatus === 'saving' ? 'bg-blue-50 text-blue-600' :
                            saveStatus === 'saved' ? 'bg-green-50 text-green-600' :
                                saveStatus === 'pending' ? 'bg-gray-100 text-gray-500' :
                                    saveStatus === 'error' ? 'bg-red-50 text-red-600' :
                                        'opacity-0'
                            }`}>
                            {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>}
                            {saveStatus === 'saved' && <><Cloud className="w-3 h-3" /> Guardado</>}
                            {saveStatus === 'pending' && <><Cloud className="w-3 h-3" /> Cambios pendientes...</>}
                            {saveStatus === 'error' && <><CloudOff className="w-3 h-3" /> Error al guardar</>}
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm hidden md:block">Gestiona la personalización de tus productos Malcriados</p>
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

            <div className="grid gap-6">
                {filteredOrders.map(order => {
                    const isLocked = ![
                        OrderStatus.PENDING_UPLOAD,
                        OrderStatus.ACTION_REQUIRED,
                        OrderStatus.ANALYZING_IMAGE,
                        OrderStatus.DESIGN_REJECTED
                    ].includes(order.status);

                    const { bundles, singles, upgrades } = groupItems(order.items);
                    const sleeveStats = calculateSleeveStats(order);

                    const itemsByGroup: Record<string, OrderItem[]> = {};
                    order.items.forEach(item => {
                        if (isSleeveItem(item)) return;
                        const gId = item.groupId || `single-${item.id}`;
                        if (!itemsByGroup[gId]) itemsByGroup[gId] = [];
                        itemsByGroup[gId].push(item);
                    });

                    const isOrderComplete = Object.values(itemsByGroup).every(group => {
                        const numSlots = group[0]?.customizations.length || 0;
                        for (let idx = 0; idx < numSlots; idx++) {
                            // SHARED FIELDS VALIDATION (Photo, Status, Name) - Pack-aware
                            const hasPhoto = group.some(item => {
                                const slot = item.customizations[idx];
                                if (!slot) return false;
                                const pending = pendingSlotChanges[slot.id]?.changes;
                                return !!(pending?.photoUrl || slot.photoUrl);
                            });

                            const isApproved = group.some(item => {
                                const slot = item.customizations[idx];
                                if (!slot) return false;
                                const pending = pendingSlotChanges[slot.id]?.changes;
                                const status = pending?.status || slot.status;
                                return status !== 'REJECTED' && status !== 'EMPTY';
                            });

                            if (!hasPhoto || !isApproved) return false;

                            // POSITION (Always individual as per user request and trigger logic)
                            const everyoneHasPosition = group.every(item => {
                                const slot = item.customizations[idx];
                                if (!slot) return true;
                                const pending = pendingSlotChanges[slot.id]?.changes;
                                const pos = pending?.position !== undefined ? pending.position : slot.position;
                                return !!pos;
                            });

                            if (!everyoneHasPosition) return false;
                        }
                        return true;
                    });

                    const isSavingInProgress = saveStatus === 'pending' || saveStatus === 'saving';
                    const allSleevesAssigned = sleeveStats.remaining === 0;
                    const isReadyToSend = isOrderComplete && allSleevesAssigned && !isSavingInProgress && !isLocked;
                    const isExpanded = expandedOrderIds.has(order.id);

                    return (
                        <div key={order.id} className={`bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ring-1 ring-black/5 mb-2 transition-all duration-300 animate-soft-fade ${isExpanded ? 'shadow-xl ring-brand-200' : 'hover:shadow-md'}`}>

                            {/* Header / Trigger */}
                            <div
                                onClick={() => toggleOrderExpansion(order.id)}
                                className={`cursor-pointer transition-colors duration-300 px-4 py-4 md:px-6 md:py-5 flex items-center justify-between ${isExpanded ? 'bg-gray-50/80 border-b border-gray-100' : 'bg-white hover:bg-gray-50/50'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl transition-all duration-300 ${isExpanded ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' : 'bg-gray-100 text-gray-400'}`}>
                                        <Box className="w-5 h-5 md:w-6 md:h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-base md:text-lg text-gray-900 flex items-center gap-2">
                                            Orden #{order.id}
                                            {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 font-medium tracking-wide uppercase">
                                            <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                                            {!isExpanded && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-brand-600 truncate max-w-[150px] sm:max-w-none">
                                                        {order.items.filter(i => !isSleeveItem(i)).map(i => i.productName).join(', ')}
                                                    </span>
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
                                    <div className="bg-gray-50/30 px-4 pt-6 md:px-6 pb-2 border-b border-gray-100">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                                            <div className="sm:hidden">
                                                <StatusBadge status={order.status} />
                                            </div>
                                            <div className="hidden sm:block">
                                                <p className="text-gray-500 text-sm font-medium">Gestiona tu pedido Malcriados</p>
                                            </div>
                                        </div>
                                        <div className="px-2 pb-6">
                                            <OrderProgress status={order.status} />
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-6 md:p-8 space-y-8 md:space-y-12">

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

                                        {order.status === OrderStatus.DESIGN_REVIEW && (
                                            <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl overflow-hidden shadow-lg shadow-amber-100/50">
                                                <div className="p-6 sm:p-8 text-center bg-amber-50/50">
                                                    <h3 className="text-2xl font-extrabold text-amber-900 mb-2">✨ ¡Tus diseños están listos!</h3>
                                                    <p className="text-amber-800 mb-8 max-w-xl mx-auto">Revisa las propuestas de nuestros artistas para cada una de tus prendas.</p>

                                                    <div className="space-y-8 text-left">
                                                        {(() => {
                                                            const itemGroups: Record<string, OrderItem[]> = {};
                                                            order.items.forEach(item => {
                                                                if (item.sku === 'extra-manga' || !item.designImage) return;
                                                                const key = item.groupId || `item-${item.id}`;
                                                                if (!itemGroups[key]) itemGroups[key] = [];
                                                                itemGroups[key].push(item);
                                                            });

                                                            const groups = Object.entries(itemGroups);
                                                            const groupCount = groups.length;

                                                            return (
                                                                <>
                                                                    {groups.map(([groupId, groupItems]) => {
                                                                        const item = groupItems[0];
                                                                        const isPack = groupItems.length > 1;
                                                                        const isApproved = groupItems.every(gi => gi.designStatus === 'APPROVED');
                                                                        const isRejected = groupItems.some(gi => gi.designStatus === 'REJECTED');

                                                                        return (
                                                                            <div key={groupId} className={`bg-white rounded-2xl border p-4 md:p-6 shadow-sm transition-all ${isApproved ? 'border-green-200 bg-green-50/20' : isRejected ? 'border-red-200 bg-red-50/20' : 'border-amber-200'}`}>
                                                                                <div className="flex justify-between items-center mb-4">
                                                                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                                                                                        <Shirt className={`w-5 h-5 ${isApproved ? 'text-green-500' : isRejected ? 'text-red-500' : 'text-brand-500'}`} />
                                                                                        {isPack ? `Pack: ${item.productName}` : item.productName}
                                                                                    </h4>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {isApproved ? (
                                                                                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                                                <CheckCircle className="w-3 h-3" /> Aprobado
                                                                                            </span>
                                                                                        ) : isRejected ? (
                                                                                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                                                <AlertTriangle className="w-3 h-3" /> Requiere Cambios
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente Revisión</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid md:grid-cols-2 gap-8">
                                                                                    <div className="space-y-3">
                                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Propuesta Digital</p>
                                                                                        <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 aspect-square flex items-center justify-center relative group">
                                                                                            <img src={item.designImage} className="max-w-full max-h-full object-contain p-4" alt={`Diseño ${item.productName}`} />
                                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex flex-col justify-between h-full">
                                                                                        <div className="space-y-4">
                                                                                            {item.designHistory && item.designHistory.length > 0 ? (
                                                                                                <div className="space-y-3">
                                                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                                                                        <History className="w-3 h-3" /> Historial de Cambios
                                                                                                    </p>
                                                                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                                                                        {item.designHistory.map((version, vIdx) => (
                                                                                                            <div key={vIdx} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 group">
                                                                                                                <div className="w-12 h-12 flex-shrink-0 bg-white rounded border border-gray-200 overflow-hidden">
                                                                                                                    <img src={version.imageUrl} className="w-full h-full object-cover" />
                                                                                                                </div>
                                                                                                                <div className="min-w-0">
                                                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">V{item.designHistory!.length - vIdx}</span>
                                                                                                                        <span className="text-[9px] text-gray-400"><Clock className="w-2.5 h-2.5 inline" /> {new Date(version.createdAt).toLocaleDateString()}</span>
                                                                                                                    </div>
                                                                                                                    <p className="text-[10px] text-gray-600 italic line-clamp-2">"{version.feedback}"</p>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                                                                    <Sparkles className="w-8 h-8 text-amber-300 mb-2" />
                                                                                                    <p className="text-xs text-gray-400 font-medium leading-tight">Primera versión realizada por nuestro equipo de diseño.</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {removingItemDesignId === item.id ? (
                                                                                            <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 animate-in fade-in slide-in-from-bottom-4">
                                                                                                <p className="text-xs font-bold text-red-700 mb-2">¿Qué te gustaría cambiar?</p>
                                                                                                <textarea
                                                                                                    autoFocus
                                                                                                    className="w-full border-gray-200 rounded-lg text-sm mb-3 focus:ring-red-500 focus:border-red-500"
                                                                                                    rows={2}
                                                                                                    placeholder="Escribe tus observaciones..."
                                                                                                    value={rejectionReason}
                                                                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                                                                />
                                                                                                <div className="flex gap-2">
                                                                                                    <button onClick={() => setRemovingItemDesignId(null)} className="flex-1 py-1.5 text-xs text-gray-600 font-bold hover:bg-white rounded-lg border border-gray-200">Cancelar</button>
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            onReviewDesign(order.id, false, rejectionReason, item.id);
                                                                                                            setRemovingItemDesignId(null);
                                                                                                            setRejectionReason('');
                                                                                                        }}
                                                                                                        className="flex-1 py-1.5 text-xs bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                                                                                                    >
                                                                                                        Enviar Corrección
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="mt-6 flex flex-col gap-3">
                                                                                                {!isApproved && (
                                                                                                    <button
                                                                                                        onClick={() => onReviewDesign(order.id, true, undefined, item.id)}
                                                                                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all micro-hover"
                                                                                                    >
                                                                                                        <CheckCircle className="w-4 h-4" /> ¡Aprobar Diseño!
                                                                                                    </button>
                                                                                                )}
                                                                                                {!isApproved && !isRejected && (
                                                                                                    <button
                                                                                                        onClick={() => setRemovingItemDesignId(item.id)}
                                                                                                        className="text-sm text-gray-500 font-bold hover:text-red-600 transition-colors py-2 flex items-center justify-center gap-2"
                                                                                                    >
                                                                                                        <XCircle className="w-4 h-4" /> Solicitar Cambios
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    {groupCount > 1 && (
                                                                        <div className="mt-12 pt-8 border-t border-amber-200">
                                                                            {rejectingOrderId === order.id ? (
                                                                                <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-red-200 shadow-md animate-in fade-in slide-in-from-bottom-4">
                                                                                    <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2 justify-center">
                                                                                        <AlertTriangle className="w-5 h-5" /> Solicitar Cambios (Todo el Pedido)
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
                                                                                <div className="flex flex-col items-center justify-center gap-3">
                                                                                    <button
                                                                                        onClick={() => onReviewDesign(order.id, true)}
                                                                                        className="w-full max-w-sm px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 hover:scale-105 transition-all flex items-center justify-center gap-2"
                                                                                    >
                                                                                        <CheckCircle className="w-5 h-5" /> ¡Me encanta todo, Aprobar Pedido!
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setRejectingOrderId(order.id)}
                                                                                        className="text-sm text-gray-500 font-bold hover:text-red-600 transition-colors py-2 flex items-center justify-center gap-2"
                                                                                    >
                                                                                        <XCircle className="w-4 h-4" /> Solicitar Cambios (Todo el Pedido)
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {Object.entries(bundles).map(([groupId, items]) => (
                                            <div key={groupId} className="border-2 border-brand-100 bg-brand-50/10 rounded-3xl p-4 sm:p-6 md:p-8">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-3 bg-brand-100 rounded-xl text-brand-700">
                                                        <Box className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xl text-gray-900 flex items-center flex-wrap gap-2">
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
                                                                        const isSiblingPending = !!pendingSibling;

                                                                        return (
                                                                            <div key={siblingItem.id} className={`bg-gray-50 rounded-xl p-4 border border-gray-200 relative overflow-hidden ${isSiblingPending ? 'ring-1 ring-blue-300' : ''}`}>
                                                                                <div className="absolute top-0 left-0 w-1 h-full bg-brand-200"></div>
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <span className="text-xs font-bold text-gray-500 uppercase block tracking-wider">Sincronizado en:</span>
                                                                                    <span className="text-sm font-bold text-gray-800 truncate block">{siblingItem.productName}</span>
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

                                                {sleeveStats.total > 0 && items.some(i => !isSleeveItem(i) && !['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => i.sku.toLowerCase().includes(t.toLowerCase()))) && (
                                                    <div className="mt-8 pt-8 border-t border-brand-100">
                                                        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Tag className="w-4 h-4 text-brand-500" /> Configuración de Mangas (Pack)</h4>
                                                        <p className="text-xs text-gray-500 mb-4">Créditos disponibles: <strong>{sleeveStats.remaining}</strong> de {sleeveStats.total}</p>
                                                        <div className="grid md:grid-cols-2 gap-4">
                                                            {items.map(item => {
                                                                if (['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => item.sku.toLowerCase().includes(t.toLowerCase()))) return null;

                                                                const pendingSleeve = pendingSleeveChanges[item.id]?.config;
                                                                const displaySleeve = pendingSleeve !== undefined ? pendingSleeve : item.sleeve;
                                                                const isSleeveModified = pendingSleeve !== undefined;

                                                                return (
                                                                    <div key={item.id} className={`bg-white rounded-xl p-4 border border-gray-200 relative ${isSleeveModified ? 'ring-1 ring-blue-300' : ''}`}>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <p className="text-xs font-bold text-gray-700">{item.productName}</p>
                                                                            {!displaySleeve && !isLocked && (
                                                                                <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={sleeveStats.remaining <= 0} className="text-[10px] bg-gray-50 border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                                                                                    {sleeveStats.remaining > 0 ? <Plus className="w-3 h-3" /> : <Lock className="w-3 h-3" />} Agregar
                                                                                </button>
                                                                            )}
                                                                            {displaySleeve && !isLocked && (
                                                                                <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-[10px] bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded flex items-center gap-1"><Minus className="w-3 h-3" /> Quitar</button>
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

                                                {sleeveStats.total > 0 && !['TSHIRT', 'CAP', 'JOCKEY', 'GORRO'].some(t => item.sku.toLowerCase().includes(t.toLowerCase())) && (
                                                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <h5 className="font-bold text-gray-900 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-500" /> Bordado en Manga (Extra)</h5>
                                                                <p className="text-xs text-gray-500 mt-1">Créditos disponibles: <strong>{sleeveStats.remaining}</strong> de {sleeveStats.total}</p>
                                                            </div>

                                                            {(() => {
                                                                const pendingSleeve = pendingSleeveChanges[item.id]?.config;
                                                                const displaySleeve = pendingSleeve !== undefined ? pendingSleeve : item.sleeve;

                                                                if (!displaySleeve && !isLocked) return (
                                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })} disabled={sleeveStats.remaining <= 0} className="text-xs bg-white border border-gray-200 hover:border-brand-300 text-brand-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        {sleeveStats.remaining > 0 ? <Plus className="w-3 h-3" /> : <Lock className="w-3 h-3" />} {sleeveStats.remaining > 0 ? 'Agregar Manga' : 'Sin créditos'}
                                                                    </button>
                                                                );
                                                                if (displaySleeve && !isLocked) return (
                                                                    <button onClick={() => handleLocalSleeveChange(order.id, item.id, undefined)} className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Minus className="w-3 h-3" /> Quitar</button>
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

                                        {/* MEJORAS DE PRENDA SECTION */}
                                        {upgrades.length > 0 && (
                                            <div className="space-y-8 pt-12 border-t-4 border-yellow-400">
                                                <div className="bg-yellow-400 text-black py-4 px-8 -mx-8 sm:-mx-12 mb-8 shadow-md">
                                                    <h3 className="text-2xl font-black uppercase tracking-[0.2em] italic">MEJORAS DE PRENDA</h3>
                                                </div>

                                                <div className="grid gap-8">
                                                    {upgrades.map(item => {
                                                        const skuLower = item.sku?.toLowerCase() || '';
                                                        const isManga = skuLower.includes('manga');
                                                        const isGrande = skuLower.includes('grande');

                                                        return (
                                                            <div key={item.id} className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow duration-500">
                                                                <div className="flex items-start gap-6 mb-6">
                                                                    <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center p-3">
                                                                        <img
                                                                            src={isManga ? '/refs/manga-thumb.png' : isGrande ? '/refs/grande-thumb.png' : '/refs/upgrade-thumb.png'}
                                                                            className="w-full h-full object-contain opacity-50"
                                                                            alt="Icon"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-xl font-black text-gray-900 leading-tight uppercase tracking-tight">{item.productName}</h4>
                                                                        {isManga && <p className="text-[10px] text-gray-500 font-medium italic mt-1">Este item es parte de tu prenda principal</p>}
                                                                    </div>
                                                                </div>

                                                                {/* Custom content per upgrade type */}
                                                                <div className="space-y-8">
                                                                    {item.customizations.length > 0 ? (
                                                                        <div className="grid md:grid-cols-1 gap-8">
                                                                            {item.customizations.map((slot, index) => (
                                                                                <PetSlotCard key={slot.id} slot={slot} index={index} item={item} order={order} isLocked={isLocked} />
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                                                                            {isManga ? (
                                                                                <div className="space-y-6">
                                                                                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100">
                                                                                        <div>
                                                                                            <h5 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-1">Paso 1: Configura tu Manga</h5>
                                                                                            <p className="text-xs text-gray-600 font-medium italic">Configura el texto e icono</p>
                                                                                        </div>
                                                                                        {!item.sleeve && !isLocked && (
                                                                                            <button
                                                                                                onClick={() => handleLocalSleeveChange(order.id, item.id, { text: '', font: 'ARIAL_ROUNDED', icon: 'NONE' })}
                                                                                                className="bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:scale-105 transition-all"
                                                                                            >
                                                                                                EDITAR
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    {item.sleeve ? (
                                                                                        <SleeveDesigner config={item.sleeve} readOnly={isLocked} onChange={(newConfig) => handleLocalSleeveChange(order.id, item.id, newConfig)} />
                                                                                    ) : (
                                                                                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl">
                                                                                            <Tag className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sin configuración</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-6">
                                                                                    <p className="text-xs text-gray-400 uppercase font-black">Este item se detallará en el diseño final</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Botón de Envío al final */}
                                        {!isLocked && (
                                            <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col items-center gap-4">
                                                <div className="text-center max-w-md">
                                                    {!isReadyToSend && !isSavingInProgress && (
                                                        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3 text-left">
                                                            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-bold text-amber-800">Casi listo...</p>
                                                                <ul className="text-[10px] text-amber-700 list-disc list-inside space-y-0.5">
                                                                    {!isOrderComplete && <li>Asegúrate de subir todas las fotos y esperar la aprobación de la IA.</li>}
                                                                    {!allSleevesAssigned && <li>Aún tienes mangas por configurar.</li>}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isSavingInProgress && (
                                                        <p className="text-xs text-blue-600 font-medium mb-4 flex items-center justify-center gap-2">
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Guardando tus últimos cambios...
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isSavingInProgress) return;
                                                        if (!isReadyToSend) return;
                                                        if (window.confirm("¿Estás seguro de que terminaste? Una vez enviado, pasará a diseño.")) {
                                                            onFinalizeOrder(order.id);
                                                            toast.success("¡Pedido enviado a diseño!");
                                                        }
                                                    }}
                                                    disabled={!isReadyToSend}
                                                    className={`w-full max-w-md py-4 px-6 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-100/20 ${isReadyToSend ? 'bg-brand-600 text-white hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    <Send className={`w-5 h-5 ${isReadyToSend ? 'animate-pulse' : ''}`} />
                                                    {isReadyToSend ? 'FINALIZAR Y ENVIAR A DISEÑO' : 'COMPLETA LA INFORMACIÓN PARA ENVIAR'}
                                                </button>
                                                <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Paso Final</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <PawModal
                isOpen={!!uploadTarget}
                onClose={() => setUploadTarget(null)}
                onConfirm={handleConfirmAndTriggerUpload}
            />
        </div >
    );
};

export default ClientView;