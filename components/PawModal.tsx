import React from 'react';
import { PawPrint, Check, X } from 'lucide-react';

interface PawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

const PawModal: React.FC<PawModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "¿Es esta la mejor foto?", 
  message = "Asegúrate de que la carita de tu mascota se vea nítida y sin sombras. ¡Así el bordado quedará perfecto!" 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container - Organic Shape */}
      <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200 border-4 border-brand-100">
        
        {/* Decorative Paw Header Background */}
        <div className="bg-brand-50 h-32 flex items-center justify-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-100 rounded-full opacity-50 blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-brand-200 rounded-full opacity-50 blur-2xl"></div>
            
            {/* Main Icon */}
            <div className="relative z-10 bg-white p-4 rounded-full shadow-lg ring-4 ring-brand-100/50">
                <PawPrint className="w-12 h-12 text-brand-600 fill-brand-100" />
            </div>
        </div>

        {/* Content */}
        <div className="px-8 pt-4 pb-8 text-center">
          <h3 className="text-xl font-extrabold text-gray-800 mb-2 font-sans tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Check className="w-5 h-5" />
              ¡Sí, subir foto!
            </button>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              Esperar, buscaré otra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PawModal;