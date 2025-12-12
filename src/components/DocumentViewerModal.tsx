import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Move } from 'lucide-react';

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

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const onMouseUp = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* HEADER TOOLBAR */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 text-white z-20">
        <h3 className="font-bold text-lg truncate flex-1 mr-4">{title}</h3>
        <div className="flex items-center gap-2">
            <a 
                href={imageUrl} 
                download={`ficha-${title}.png`}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                title="Descargar Original"
            >
                <Download className="w-5 h-5 text-gray-400 hover:text-white" />
            </a>
            <button 
                onClick={onClose}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors text-white"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* IMAGE CONTAINER */}
      <div 
        className="flex-1 overflow-hidden flex items-center justify-center relative bg-black/50 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        ref={containerRef}
      >
        <img 
            src={imageUrl} 
            alt={title} 
            className="transition-transform duration-200 ease-out max-w-[90%] max-h-[90%] object-contain"
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
        />
        
        {/* Helper Hint */}
        {scale === 1 && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs pointer-events-none backdrop-blur-md border border-white/10">
                Usa el zoom para explorar detalles
            </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur border border-gray-700 p-2 rounded-2xl flex items-center gap-2 shadow-2xl z-20">
        <button onClick={handleZoomOut} className="p-3 hover:bg-gray-700 rounded-xl text-white transition-colors" title="Reducir">
            <ZoomOut className="w-6 h-6" />
        </button>
        
        <div className="w-px h-8 bg-gray-700 mx-1"></div>
        
        <span className="font-mono text-white font-bold w-16 text-center">{Math.round(scale * 100)}%</span>

        <div className="w-px h-8 bg-gray-700 mx-1"></div>

        <button onClick={handleZoomIn} className="p-3 hover:bg-gray-700 rounded-xl text-white transition-colors" title="Aumentar">
            <ZoomIn className="w-6 h-6" />
        </button>

        <button onClick={handleReset} className="ml-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors" title="Restablecer">
            <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default DocumentViewerModal;