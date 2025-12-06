
import React, { useMemo } from 'react';
import { Order, OrderStatus } from '../../types';
import { DollarSign, ShoppingBag, Clock, TrendingUp, AlertCircle, CheckCircle, Package, Activity } from 'lucide-react';
import StatusBadge from '../StatusBadge';

interface AdminViewProps {
  orders: Order[];
}

const AdminView: React.FC<AdminViewProps> = ({ orders }) => {

  // --- CALCULATE METRICS ---
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    const completedOrders = orders.filter(o => o.status === OrderStatus.DISPATCHED).length;
    
    // Average Order Value (AOV)
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Item Breakdown
    const itemCounts: Record<string, number> = {};
    const itemRevenue: Record<string, number> = {};
    
    orders.forEach(o => {
        o.items.forEach(i => {
            if (i.sku === 'extra-manga') return; // Skip extras for main product count
            const type = i.sku.split('-')[0].toUpperCase(); // Simple heuristic from SKU
            itemCounts[type] = (itemCounts[type] || 0) + i.quantity;
            itemRevenue[type] = (itemRevenue[type] || 0) + (i.price || 0);
        });
    });

    // Status Distribution
    const statusCounts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return { totalOrders, totalRevenue, completedOrders, aov, itemCounts, itemRevenue, statusCounts };
  }, [orders]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h2>
        <p className="text-gray-500">Resumen financiero y métricas de producción en tiempo real.</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* REVENUE */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Ventas Totales</p>
                  <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</h3>
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm text-green-600 font-bold bg-green-50 px-2 py-1 rounded w-fit">
                  <TrendingUp className="w-4 h-4" />
                  +12% vs mes anterior
              </div>
              <div className="absolute top-6 right-6 p-2 bg-brand-50 rounded-lg text-brand-600">
                  <DollarSign className="w-6 h-6" />
              </div>
          </div>

          {/* TOTAL ORDERS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Pedidos</p>
                  <h3 className="text-3xl font-bold text-gray-900">{metrics.totalOrders}</h3>
              </div>
              <p className="text-xs text-gray-400 mt-4">Ticket Promedio: {formatCurrency(metrics.aov)}</p>
              <div className="absolute top-6 right-6 p-2 bg-blue-50 rounded-lg text-blue-600">
                  <ShoppingBag className="w-6 h-6" />
              </div>
          </div>

          {/* EFFICIENCY (MOCKED) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Tiempo Promedio</p>
                  <h3 className="text-3xl font-bold text-gray-900">3.2 Días</h3>
              </div>
              <p className="text-xs text-gray-400 mt-4">Desde compra a despacho</p>
              <div className="absolute top-6 right-6 p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Clock className="w-6 h-6" />
              </div>
          </div>

          {/* PENDING ACTIONS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Atención Requerida</p>
                  <h3 className="text-3xl font-bold text-gray-900">
                      {(metrics.statusCounts[OrderStatus.ACTION_REQUIRED] || 0) + (metrics.statusCounts[OrderStatus.ON_HOLD] || 0)}
                  </h3>
              </div>
               <div className="flex flex-col gap-1 mt-4">
                   {(metrics.statusCounts[OrderStatus.ON_HOLD] || 0) > 0 && (
                       <span className="text-xs text-red-600 flex items-center gap-1 font-bold"><AlertCircle className="w-3 h-3"/> {metrics.statusCounts[OrderStatus.ON_HOLD]} Incidencias</span>
                   )}
                   {(metrics.statusCounts[OrderStatus.PENDING_UPLOAD] || 0) > 0 && (
                       <span className="text-xs text-orange-600 flex items-center gap-1"><Clock className="w-3 h-3"/> {metrics.statusCounts[OrderStatus.PENDING_UPLOAD]} Esperando Cliente</span>
                   )}
               </div>
              <div className="absolute top-6 right-6 p-2 bg-orange-50 rounded-lg text-orange-600">
                  <Activity className="w-6 h-6" />
              </div>
          </div>
      </div>

      {/* DETAILED ANALYSIS SECTIONS */}
      <div className="grid lg:grid-cols-2 gap-8">
          
          {/* PRODUCT BREAKDOWN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  Rendimiento por Producto
              </h4>
              <div className="space-y-4">
                  {Object.entries(metrics.itemCounts as Record<string, number>).map(([type, count]) => {
                      const values = Object.values(metrics.itemCounts as Record<string, number>);
                      const max = Math.max(...values);
                      const percent = (count / max) * 100;
                      const revenue = metrics.itemRevenue[type] || 0;

                      return (
                          <div key={type}>
                              <div className="flex justify-between text-sm mb-1">
                                  <span className="font-bold text-gray-700">{type}</span>
                                  <span className="text-gray-500">{count} unds. ({formatCurrency(revenue)})</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                  <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* STATUS FUNNEL */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-gray-400" />
                  Estado del Pipeline
              </h4>
              <div className="space-y-3">
                  {[
                      OrderStatus.PENDING_UPLOAD,
                      OrderStatus.WAITING_FOR_DESIGN,
                      OrderStatus.READY_TO_EMBROIDER,
                      OrderStatus.IN_PROGRESS,
                      OrderStatus.DISPATCHED
                  ].map(status => {
                      const count = metrics.statusCounts[status] || 0;
                      return (
                          <div key={status} className="flex items-center justify-between p-3 rounded-lg border border-gray-50 bg-gray-50/50">
                               <StatusBadge status={status} />
                               <span className="font-bold text-gray-900">{count}</span>
                          </div>
                      )
                  })}
              </div>
          </div>
      </div>

      {/* RECENT ORDERS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
              <h4 className="font-bold text-gray-900">Órdenes Recientes</h4>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                      <tr>
                          <th className="px-6 py-3">ID</th>
                          <th className="px-6 py-3">Cliente</th>
                          <th className="px-6 py-3">Monto</th>
                          <th className="px-6 py-3">Fecha</th>
                          <th className="px-6 py-3">Estado</th>
                      </tr>
                  </thead>
                  <tbody>
                      {orders.slice(0, 5).map(order => (
                          <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900">#{order.id}</td>
                              <td className="px-6 py-4">{order.customerName}</td>
                              <td className="px-6 py-4 font-mono">{formatCurrency(order.totalAmount || 0)}</td>
                              <td className="px-6 py-4 text-gray-500">{new Date(order.orderDate).toLocaleDateString()}</td>
                              <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default AdminView;
