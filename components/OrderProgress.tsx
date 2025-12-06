import React from 'react';
import { OrderStatus } from '../types';
import { FileText, Camera, PenTool, Scissors, Truck, Check, AlertTriangle, Eye } from 'lucide-react';

const OrderProgress: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const steps = [
    { label: 'Solicitud', icon: FileText, states: [] }, 
    { label: 'Fotos & IA', icon: Camera, states: [OrderStatus.PENDING_UPLOAD, OrderStatus.ANALYZING_IMAGE, OrderStatus.ACTION_REQUIRED] },
    { label: 'Diseño', icon: PenTool, states: [OrderStatus.WAITING_FOR_DESIGN, OrderStatus.DESIGN_REVIEW, OrderStatus.DESIGN_REJECTED] },
    { label: 'Producción', icon: Scissors, states: [OrderStatus.READY_TO_EMBROIDER, OrderStatus.IN_PROGRESS, OrderStatus.ON_HOLD, OrderStatus.READY_FOR_DISPATCH] },
    { label: 'Despacho', icon: Truck, states: [OrderStatus.DISPATCHED] }
  ];

  const getStepStatus = (stepIndex: number) => {
    // 1. Critical Errors (On Hold)
    if (status === OrderStatus.ON_HOLD && stepIndex === 3) return 'error';
    
    // 2. Client Review Phase (Distinct Visual State)
    if (status === OrderStatus.DESIGN_REVIEW && stepIndex === 2) return 'review';

    const currentStatusIndex = steps.findIndex(s => s.states.includes(status));
    
    // Default logic
    let activeIndex = currentStatusIndex === -1 ? 0 : currentStatusIndex;
    
    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connector Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
        
        {/* Active Progress Bar */}
        <div 
            className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 -z-10 rounded-full transition-all duration-500 ${
                status === OrderStatus.ON_HOLD ? 'bg-red-500' : 
                status === OrderStatus.DESIGN_REVIEW ? 'bg-amber-500' :
                'bg-brand-500'
            }`}
            style={{ width: `${(steps.findIndex(s => s.states.includes(status)) === -1 ? 0 : steps.findIndex(s => s.states.includes(status))) / (steps.length - 1) * 100}%` }}
        ></div>

        {steps.map((step, index) => {
          const stepStatus = getStepStatus(index);
          const Icon = stepStatus === 'review' ? Eye : step.icon;
          
          return (
            <div key={index} className="flex flex-col items-center group">
              <div 
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                  stepStatus === 'completed' ? 'bg-brand-500 border-brand-500 text-white' : 
                  stepStatus === 'review' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200 ring-4 ring-amber-100 animate-pulse' :
                  stepStatus === 'current' ? 'bg-white border-brand-500 text-brand-600 shadow-lg shadow-brand-200 scale-110' : 
                  stepStatus === 'error' ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-200 scale-110' :
                  'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {stepStatus === 'completed' ? <Check className="w-5 h-5" /> : 
                 stepStatus === 'error' ? <AlertTriangle className="w-5 h-5 animate-pulse" /> :
                 <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <span 
                className={`text-[10px] sm:text-xs font-bold mt-2 transition-colors duration-300 ${
                  stepStatus === 'current' ? 'text-brand-700' : 
                  stepStatus === 'review' ? 'text-amber-600 font-extrabold' :
                  stepStatus === 'completed' ? 'text-brand-600' : 
                  stepStatus === 'error' ? 'text-red-600' :
                  'text-gray-400'
                }`}
              >
                {stepStatus === 'review' ? 'Revisión' : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderProgress;