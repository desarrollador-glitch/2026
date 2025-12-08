import React from 'react';
import { EmbroideryPosition, GarmentType, Placement } from '../types';
import { Shirt } from 'lucide-react';

interface GarmentVisualizerProps {
  productName: string;
  sku: string;
  selected?: EmbroideryPosition;
  onSelect?: (p: EmbroideryPosition) => void;
  readOnly?: boolean;
  slotCount?: number;
  placements?: Placement[]; // Used for Designer/Read-only view to show ALL pets
}

const getGarmentType = (productName: string): GarmentType => {
  const lowerName = productName.toLowerCase();
  if (lowerName.includes('jockey') || lowerName.includes('gorro') || lowerName.includes('cap')) return 'CAP';
  if (lowerName.includes('polera') || lowerName.includes('t-shirt')) return 'TSHIRT';
  if (lowerName.includes('polo') || lowerName.includes('crewneck')) return 'CREWNECK';
  return 'HOODIE';
};

const PositionSelector: React.FC<GarmentVisualizerProps> = ({ 
  productName, selected, onSelect, readOnly = false, placements 
}) => {
  const type = getGarmentType(productName);
  const isCap = type === 'CAP';

  // --- CONFIGURATION ---
  // Jockeys: Solo posición Central Frente.
  // Hoodies/Poleras: 5 Posiciones horizontales.
  const POSITIONS: { id: EmbroideryPosition; label: string; short: string }[] = isCap ? [
      { id: 'CENTER', label: 'Centro Frente', short: 'FRENTE' },
  ] : [
      { id: 'FAR_LEFT', label: 'Extremo Izquierdo', short: 'EXT IZQ' },
      { id: 'CENTER_LEFT', label: 'Pecho Izquierdo', short: 'IZQ' },
      { id: 'CENTER', label: 'Centro', short: 'CENTRO' },
      { id: 'CENTER_RIGHT', label: 'Pecho Derecho', short: 'DER' },
      { id: 'FAR_RIGHT', label: 'Extremo Derecho', short: 'EXT DER' },
  ];

  // --- RENDER HELPERS ---
  const renderCell = (pos: { id: EmbroideryPosition; label: string; short: string }) => {
    const isSelected = selected === pos.id;
    
    // Check if this position is occupied by ANY pet (for read-only/designer view)
    const occupant = placements?.find(p => p.position === pos.id);
    const isOccupied = !!occupant;

    // Interaction Logic
    const clickable = !readOnly && !placements; // Can't click if readonly or in visualization mode
    
    // CHANGED: py-3 -> py-2 md:py-3 to make buttons shorter on mobile
    let baseClasses = "relative flex flex-col items-center justify-center py-2 md:py-3 px-1 rounded-lg border transition-all duration-200";
    
    // Style Logic
    if (isSelected) {
        baseClasses += " bg-brand-600 border-brand-600 text-white shadow-md z-10 scale-105 font-bold";
    } else if (isOccupied) {
        baseClasses += " bg-brand-50 border-brand-200 text-brand-800 opacity-100";
    } else if (clickable) {
        baseClasses += " bg-white border-gray-200 text-gray-500 hover:border-brand-300 hover:bg-gray-50 cursor-pointer";
    } else {
        baseClasses += " bg-gray-50 border-gray-100 text-gray-300 cursor-default";
    }

    return (
        <button
            key={pos.id}
            onClick={() => clickable && onSelect?.(pos.id)}
            disabled={!clickable}
            className={baseClasses}
            title={pos.label}
        >
            <span className="text-[9px] md:text-[10px] uppercase tracking-tighter leading-none mb-1">{pos.short}</span>
            
            {/* DOT INDICATOR */}
            <div className={`w-2 h-2 rounded-full ${isSelected || isOccupied ? 'bg-current' : 'bg-gray-200'}`} />

            {/* OCCUPANT LABEL (For Designer View) */}
            {isOccupied && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-20">
                    {occupant.label}
                </span>
            )}
        </button>
    );
  };

  return (
    <div className="w-full max-w-lg">
        {/* HEADER / VISUAL CONTEXT */}
        <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Shirt className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">
                {isCap ? 'Frente del Jockey' : 'Zona del Pecho (Vista Frontal)'}
            </span>
        </div>

        {/* MAIN GRID */}
        {/* CHANGED: gap-2 -> gap-1 md:gap-2 for tighter spacing on mobile */}
        <div className={`grid ${isCap ? 'grid-cols-1 max-w-[120px] mx-auto' : 'grid-cols-5'} gap-1 md:gap-2 mb-4`}>
            {POSITIONS.map(renderCell)}
        </div>
        
        {/* LEGEND FOR EDIT MODE */}
        {!readOnly && !placements && (
            <p className="text-[10px] text-gray-400 text-center mt-2">
                {isCap 
                    ? 'Posición única disponible para Jockeys.' 
                    : 'Selecciona la posición para este bordado específico.'}
            </p>
        )}
    </div>
  );
};

export default PositionSelector;