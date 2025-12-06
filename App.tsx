import React, { useState } from 'react';
import { UserRole } from './types';
import RoleSwitcher from './components/RoleSwitcher';
import PawModal from './components/PawModal';
import { useOrderSystem } from './hooks/useOrderSystem';
import { useSession } from './src/components/SessionContextProvider';
// import LoginPage from './src/pages/LoginPage'; // DESHABILITADO
import toast from 'react-hot-toast';

// Views
import ClientView from './components/views/ClientView';
import DesignerView from './components/views/DesignerView';
import ProductionView from './components/views/ProductionView';
import AdminView from './components/views/AdminView';

const App: React.FC = () => {
  const { loading: sessionLoading } = useSession();
  
  // ESTADO LOCAL PARA EL ROL (Modo Dev)
  const [userRole, setUserRole] = useState<UserRole>(UserRole.CLIENT); // Default a Cliente

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
    handleLogout,
  } = useOrderSystem();

  const [pendingUpload, setPendingUpload] = useState<{
      file: File;
      orderId: string;
      itemId: string;
      slotId: string;
  } | null>(null);

  const confirmUpload = async () => {
    if (pendingUpload) {
        await onInitiateUpload(
            { file: pendingUpload.file, orderId: pendingUpload.orderId, itemId: pendingUpload.itemId, slotId: pendingUpload.slotId }
        );
        setPendingUpload(null);
    }
  };

  if (sessionLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        Cargando aplicación (Modo Dev)...
      </div>
    );
  }

  // BYPASS LOGIN CHECK
  /* if (!session) {
    return <LoginPage />;
  } */

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700">
        Error al cargar órdenes: {error.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <RoleSwitcher
        currentRole={userRole}
        onRoleChange={setUserRole} // Permitir cambio manual
        onReset={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {userRole === UserRole.CLIENT && (
            <ClientView
                orders={orders}
                isProcessing={isLoading}
                onUpdateSlot={(orderId, itemId, slotId, updates) => updateSlot({ orderId, itemId, slotId, updates })}
                onUpdateSleeve={(orderId, itemId, config) => updateSleeve({ orderId, itemId, config })}
                onInitiateUpload={(file, orderId, itemId, slotId) => setPendingUpload({ file, orderId, itemId, slotId })}
                onEditImage={(orderId, itemId, slotId, currentImage, prompt) => onEditImage({ orderId, itemId, slotId, currentImage, prompt })}
                onReviewDesign={(orderId, approved, feedback) => onReviewDesign({ orderId, approved, feedback })}
            />
        )}

        {userRole === UserRole.DESIGNER && (
            <DesignerView
                orders={orders}
                onSubmitDesign={(orderId, assets) => onSubmitDesign({ orderId, assets })}
            />
        )}

        {userRole === UserRole.EMBROIDERER && (
            <ProductionView
                orders={orders}
                currentRole={userRole}
                onUpdateStatus={(orderId, newStatus) => onUpdateStatus({ orderId, newStatus })}
                onReportIssue={(orderId, reason) => onReportIssue({ orderId, reason })}
                onResolveIssue={(orderId) => onResolveIssue({ orderId })}
                onUploadEvidence={(file, orderId, field) => onUploadEvidence({ file, orderId, field })}
            />
        )}

        {userRole === UserRole.ADMIN && (
            <AdminView
                orders={orders}
            />
        )}

      </main>

      <PawModal
            isOpen={!!pendingUpload}
            onClose={() => setPendingUpload(null)}
            onConfirm={confirmUpload}
      />
    </div>
  );
};

export default App;