import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const handleZoomIn = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleReset = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.stopPropagation(); // Prevent backdrop click logic if dragging start
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const onMouseUp = () => setIsDragging(false);

  // Close when clicking the backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
      // Si estamos arrastrando o el click fue en un control interno, ignoramos
      if (isDragging || scale > 1) return;
      
      // Solo cerrar si el click fue directamente en el contenedor (fondo), no en la imagen
      if (e.target === containerRef.current) {
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      
      {/* HEADER TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-4 md:px-6 bg-gray-900/80 border-b border-gray-800 text-white z-30 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-base md:text-lg truncate flex-1 mr-4">{title}</h3>
        <div className="flex items-center gap-3">
            <a 
                href={imageUrl} 
                download={`ficha-${title}.png`}
                className="p-2 bg-gray-800 hover:bg-brand-600 rounded-full transition-colors group"
                title="Descargar Original"
                onClick={(e) => e.stopPropagation()}
            >
                <Download className="w-5 h-5 text-gray-400 group-hover:text-white" />
            </a>
            <button 
                onClick={onClose}
                className="p-2 bg-gray-800 hover:bg-red-600 rounded-full transition-colors text-white ring-1 ring-gray-700 hover:ring-red-500"
                title="Cerrar (Esc)"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* IMAGE CONTAINER - Interactive Backdrop */}
      <div 
        className="flex-1 overflow-hidden flex items-center justify-center relative cursor-default"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={handleBackdropClick} // CLICK TO CLOSE
        ref={containerRef}
      >
        <img 
            src={imageUrl} 
            alt={title} 
            className="transition-transform duration-200 ease-out max-w-[95%] max-h-[90%] object-contain"
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
            }}
            draggable={false}
            onClick={(e) => {
                e.stopPropagation(); // Clicking image shouldn't close it immediately unless we want that logic
                if (scale === 1) handleZoomIn(); // Click to zoom in if not zoomed
            }}
        />
        
        {/* Helper Hint */}
        {scale === 1 && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-1.5 rounded-full text-xs pointer-events-none backdrop-blur border border-white/20 shadow-lg">
                Haz clic en la imagen para zoom o en el fondo para salir
            </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-xl border border-gray-700 p-2 rounded-2xl flex items-center gap-2 shadow-2xl z-30" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleZoomOut} className="p-3 hover:bg-gray-700 rounded-xl text-white transition-colors active:bg-gray-600" title="Reducir">
            <ZoomOut className="w-6 h-6" />
        </button>
        
        <div className="w-px h-8 bg-gray-700 mx-1"></div>
        
        <span className="font-mono text-white font-bold w-16 text-center select-none">{Math.round(scale * 100)}%</span>

        <div className="w-px h-8 bg-gray-700 mx-1"></div>

        <button onClick={handleZoomIn} className="p-3 hover:bg-gray-700 rounded-xl text-white transition-colors active:bg-gray-600" title="Aumentar">
            <ZoomIn className="w-6 h-6" />
        </button>

        <button onClick={handleReset} className="ml-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors border border-gray-700" title="Restablecer">
            <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default DocumentViewerModal;