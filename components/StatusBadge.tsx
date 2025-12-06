import React from 'react';
import { OrderStatus } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  [OrderStatus.PENDING_UPLOAD]: { label: 'Esperando Foto', color: 'bg-gray-100 text-gray-800' },
  [OrderStatus.ANALYZING_IMAGE]: { label: 'Analizando IA...', color: 'bg-blue-100 text-blue-800 animate-pulse' },
  [OrderStatus.ACTION_REQUIRED]: { label: 'Foto Rechazada', color: 'bg-red-100 text-red-800' },
  [OrderStatus.WAITING_FOR_DESIGN]: { label: 'En Diseño', color: 'bg-purple-100 text-purple-800' },
  [OrderStatus.DESIGN_REVIEW]: { label: 'Revisión Cliente', color: 'bg-yellow-100 text-yellow-800' },
  [OrderStatus.DESIGN_REJECTED]: { label: 'Diseño Rechazado', color: 'bg-red-100 text-red-800' },
  [OrderStatus.READY_TO_EMBROIDER]: { label: 'Listo para Bordar', color: 'bg-green-100 text-green-800' },
  [OrderStatus.IN_PROGRESS]: { label: 'Bordando', color: 'bg-indigo-100 text-indigo-800' },
  [OrderStatus.ON_HOLD]: { label: 'DETENIDO / INCIDENCIA', color: 'bg-red-600 text-white animate-pulse' },
  [OrderStatus.READY_FOR_DISPATCH]: { label: 'Listo para Despacho', color: 'bg-orange-100 text-orange-800' },
  [OrderStatus.DISPATCHED]: { label: 'Despachado', color: 'bg-green-100 text-green-800' },
};

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;