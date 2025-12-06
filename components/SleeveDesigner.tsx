import React from 'react';
import { SleeveConfig, SleeveFont, SleeveIcon } from '../types';
import { SLEEVE_FONTS, SLEEVE_ICONS } from '../constants';
import { Type } from 'lucide-react';

interface SleeveDesignerProps {
    config: SleeveConfig;
    onChange: (config: SleeveConfig) => void;
    readOnly?: boolean;
}

const SleeveDesigner: React.FC<SleeveDesignerProps> = ({ config, onChange, readOnly = false }) => {
  return (
    <div className={`p-4 rounded-xl border ${readOnly ? 'bg-gray-50 border-gray-200' : 'bg-white border-brand-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-lg">👕</span>
            </div>
            <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">CONFIGURACION MANGA</h4>
        </div>

        <div className="space-y-4">
            {/* 1. TEXT INPUT */}
            <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Nombre a Bordar</label>
                <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        value={config.text}
                        disabled={readOnly}
                        onChange={(e) => onChange({ ...config, text: e.target.value })}
                        maxLength={15}
                        placeholder="Ej: Firulais"
                        className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${readOnly ? 'bg-gray-100 border-transparent font-bold' : 'border-gray-200 focus:ring-2 focus:ring-brand-500'}`}
                    />
                </div>
            </div>

            {/* 2. FONT SELECTOR */}
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">Tipografía</label>
                <div className="grid grid-cols-2 gap-2">
                    {SLEEVE_FONTS.map(font => (
                        <button
                            key={font.id}
                            disabled={readOnly}
                            onClick={() => onChange({ ...config, font: font.id })}
                            className={`p-2 rounded-lg border text-center transition-all ${
                                config.font === font.id 
                                    ? 'bg-brand-50 border-brand-500 text-brand-800 ring-1 ring-brand-500' 
                                    : readOnly 
                                        ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-50' 
                                        : 'bg-white border-gray-200 hover:border-brand-300 text-gray-600'
                            }`}
                        >
                            <span className="block text-lg leading-none mb-1" style={{ fontFamily: font.family }}>Aa</span>
                            <span className="text-[10px] font-medium truncate w-full block">{font.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. ICON SELECTOR */}
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">Icono (Opcional)</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {SLEEVE_ICONS.map(icon => (
                        <button
                            key={icon.id}
                            disabled={readOnly}
                            onClick={() => onChange({ ...config, icon: icon.id })}
                            className={`flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center text-lg transition-all ${
                                config.icon === icon.id 
                                    ? 'bg-brand-50 border-brand-500 scale-110 shadow-sm' 
                                    : readOnly 
                                        ? 'bg-gray-50 border-gray-200 opacity-50' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            title={icon.label}
                        >
                            {icon.icon}
                        </button>
                    ))}
                </div>
            </div>

            {/* PREVIEW */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Vista Previa</p>
                <div className="bg-gray-900 text-white p-4 rounded-lg inline-flex items-center gap-2 shadow-inner min-w-[120px] justify-center">
                     <span className="text-xl" style={{ 
                         fontFamily: SLEEVE_FONTS.find(f => f.id === config.font)?.family 
                     }}>
                         {config.text || 'Nombre'}
                     </span>
                     {config.icon !== 'NONE' && (
                         <span className="text-xl">{SLEEVE_ICONS.find(i => i.id === config.icon)?.icon}</span>
                     )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SleeveDesigner;