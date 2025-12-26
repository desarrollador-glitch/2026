import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import RoleSwitcher from './components/RoleSwitcher';
import { useOrderSystem } from './hooks/useOrderSystem';
import { useSession } from './src/components/SessionContextProvider';
import { useCustomerSession } from './src/components/CustomerSessionContext';
import LoginPage from './src/pages/LoginPage';
import CustomerLoginPage from './src/pages/CustomerLoginPage';
import toast from 'react-hot-toast';

// Views
import ClientView from './components/views/ClientView';
import DesignerView from './components/views/DesignerView';
import ProductionView from './components/views/ProductionView';
import AdminView from './components/views/AdminView';

const App: React.FC = () => {
  const { session, userRole: realUserRole, loading: sessionLoading } = useSession();
  const { customerSession, logoutCustomer, loading: customerLoading } = useCustomerSession();
  const [isStaffLogin, setIsStaffLogin] = useState(false);

  // ESTADO LOCAL PARA EL ROL (Modo Dev/Admin)
  // Inicializamos con el rol real una vez que carga, o CLIENT por defecto
  const [userRole, setUserRole] = useState<UserRole>(UserRole.CLIENT);

  // Sincronizar el rol local con el rol real cuando este cambie (ej: login)
  useEffect(() => {
    if (realUserRole) {
      setUserRole(realUserRole);
    }
  }, [realUserRole]);

  const {
    orders,
    isLoading,
    error,
    updateSlot,
    updateSleeve,
    onInitiateUpload,
    onEditImage,
    onSubmitDesign,
    onReviewDesign,
    onUpdateStatus,
    onReportIssue,
    onResolveIssue,
    onUploadEvidence,
    handleLogout: handleStaffLogout,
  } = useOrderSystem();

  const handleLogout = () => {
    if (session) handleStaffLogout();
    if (customerSession) logoutCustomer();
  };

  if (sessionLoading || customerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mr-3"></div>
        Verificando sesión...
      </div>
    );
  }

  // NO SESSION
  if (!session && !customerSession) {
    return isStaffLogin
      ? <LoginPage onSwitchToCustomer={() => setIsStaffLogin(false)} />
      : <CustomerLoginPage onSwitchToStaff={() => setIsStaffLogin(true)} />;
  }

  // DETERMINAR ROL ACTIVO
  // Si hay sesión de staff, usa el rol real (o el simulado por RoleSwitcher).
  // Si es sesión de cliente, fuerza UserRole.CLIENT.
  const effectiveRole = session ? userRole : UserRole.CLIENT;
  const isRealAdmin = session && realUserRole === UserRole.ADMIN;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mr-3"></div>
        Cargando datos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700">
        Error al cargar órdenes: {error.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {isRealAdmin && (
        <RoleSwitcher
          currentRole={effectiveRole}
          onRoleChange={setUserRole}
          onReset={handleLogout}
        />
      )}

      {!isRealAdmin && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <span className="font-bold text-xl tracking-tight text-gray-900">
              MALCRIADOS<span className="text-brand-600">.APP</span>
            </span>
            <div className="flex items-center gap-4">
              {customerSession && (
                <span className="text-sm text-gray-500 hidden sm:block">
                  Hola, <span className="font-bold text-gray-700">{customerSession.customerName}</span>
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600 font-medium text-sm transition-colors flex items-center gap-2"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aumentado el padding vertical en móviles para mejor espaciado */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-8">

        {effectiveRole === UserRole.CLIENT && (
          <ClientView
            orders={orders}
            isProcessing={isLoading}
            onUpdateSlot={(orderId, itemId, slotId, updates) => updateSlot({ orderId, itemId, slotId, updates })}
            onUpdateSleeve={(orderId, itemId, config) => updateSleeve({ orderId, itemId, config })}
            onInitiateUpload={(file, orderId, itemId, slotId) => onInitiateUpload({ file, orderId, itemId, slotId })}
            onEditImage={(orderId, itemId, slotId, currentImage, prompt) => onEditImage({ orderId, itemId, slotId, currentImage, prompt })}
            onReviewDesign={(orderId, approved, feedback) => onReviewDesign({ orderId, approved, feedback })}
            onFinalizeOrder={(orderId) => onUpdateStatus({ orderId, newStatus: 'WAITING_FOR_DESIGN' as any })}
          />
        )}

        {effectiveRole === UserRole.DESIGNER && (
          <DesignerView
            orders={orders}
            onSubmitDesign={(orderId, itemId, assets) => onSubmitDesign({ orderId, itemId, assets })}
          />
        )}

        {(effectiveRole === UserRole.EMBROIDERER || effectiveRole === UserRole.PACKER) && (
          <ProductionView
            orders={orders}
            currentRole={effectiveRole}
            onUpdateStatus={(orderId, newStatus) => onUpdateStatus({ orderId, newStatus })}
            onReportIssue={(orderId, reason) => onReportIssue({ orderId, reason })}
            onResolveIssue={(orderId) => onResolveIssue({ orderId })}
            onUploadEvidence={(file, orderId, field) => onUploadEvidence({ file, orderId, field })}
          />
        )}

        {effectiveRole === UserRole.ADMIN && (
          <AdminView
            orders={orders}
          />
        )}

      </main>
    </div>
  );
};

export default App;