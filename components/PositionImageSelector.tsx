import React from 'react';
import { EmbroideryPosition, GarmentType, Placement } from '../types';
import { Shirt, ChevronsUp, ChevronsDown, AlignCenter, ArrowLeft, ArrowRight } from 'lucide-react';

interface PositionImageSelectorProps {
    productName: string;
    sku: string;
    selected?: EmbroideryPosition;
    onSelect: (p: EmbroideryPosition) => void;
    readOnly?: boolean;
    slotCount?: number;
    placements?: Placement[];
}

const getGarmentType = (productName: string): GarmentType => {
    const lowerName = productName.toLowerCase();
    if (lowerName.includes('jockey') || lowerName.includes('gorro') || lowerName.includes('cap')) return 'CAP';
    if (lowerName.includes('polera') || lowerName.includes('t-shirt')) return 'TSHIRT';
    if (lowerName.includes('polo') || lowerName.includes('crewneck')) return 'CREWNECK';
    return 'HOODIE';
};

const PositionImageSelector: React.FC<PositionImageSelectorProps> = ({
    productName, selected, onSelect, readOnly = false, placements
}) => {
    const type = getGarmentType(productName);
    const isCap = type === 'CAP';

    // Same logic as GarmentVisualizer for valid positions
    const POSITIONS: { id: EmbroideryPosition; label: string; description: string; icon: React.ReactNode }[] = isCap ? [
        { id: 'CENTER', label: 'Centro Frente', description: 'Posición clásica para Jockeys', icon: <AlignCenter className="w-8 h-8" /> },
    ] : placements?.some(p => p.position === 'BACK_NECK') ? [
        { id: 'BACK_NECK', label: 'Espalda Superior', description: 'Justo debajo del cuello', icon: <ChevronsUp className="w-8 h-8" /> }
    ] : [
        { id: 'FAR_LEFT', label: 'Extremo Izquierdo', description: 'Sobre el hombro derecho', icon: <ArrowLeft className="w-8 h-8" /> },
        { id: 'CENTER_LEFT', label: 'Pecho Izquierdo', description: 'Posición del corazón', icon: <ArrowLeft className="w-8 h-8" /> },
        { id: 'CENTER', label: 'Centro', description: 'Centrado en el pecho', icon: <AlignCenter className="w-8 h-8" /> },
        { id: 'CENTER_RIGHT', label: 'Pecho Derecho', description: 'Lado opuesto al corazón', icon: <ArrowRight className="w-8 h-8" /> },
        { id: 'FAR_RIGHT', label: 'Extremo Derecho', description: 'Sobre el hombro izquierdo', icon: <ArrowRight className="w-8 h-8" /> },
    ];

    return (
        <div className="w-full">
            <h5 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-brand-500" />
                Selecciona la Ubicación:
            </h5>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {POSITIONS.map((pos) => {
                    const isSelected = selected === pos.id;
                    const occupant = placements?.find(p => p.position === pos.id);
                    const isOccupied = !!occupant && !isSelected; // Occupied by someone else

                    return (
                        <button
                            key={pos.id}
                            onClick={() => !readOnly && !isOccupied && onSelect(pos.id)}
                            disabled={readOnly || isOccupied}
                            className={`
                                relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 text-center
                                ${isSelected
                                    ? 'border-brand-500 bg-brand-50 shadow-md scale-[1.02]'
                                    : isOccupied
                                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                        : 'border-gray-100 bg-white hover:border-brand-200 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className={`
                                mb-3 p-3 rounded-full 
                                ${isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'}
                            `}>
                                {pos.icon}
                            </div>

                            <span className={`text-xs font-bold mb-1 ${isSelected ? 'text-brand-700' : 'text-gray-700'}`}>
                                {pos.label}
                            </span>

                            <span className="text-[10px] text-gray-400 leading-tight">
                                {pos.description}
                            </span>

                            {isOccupied && (
                                <div className="absolute top-2 right-2">
                                    <span className="bg-gray-200 text-gray-600 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                        OCUPADO
                                    </span>
                                </div>
                            )}

                            {isSelected && (
                                <div className="absolute top-2 right-2">
                                    <span className="bg-brand-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                        SELECCIONADO
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PositionImageSelector;
