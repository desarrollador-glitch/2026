
import React, { useState } from 'react';
import { UserRole } from './types';
import RoleSwitcher from './components/RoleSwitcher';
import PawModal from './components/PawModal';
import { useOrderSystem } from './hooks/useOrderSystem';

// Views
import ClientView from './components/views/ClientView';
import DesignerView from './components/views/DesignerView';
import ProductionView from './components/views/ProductionView';
import AdminView from './components/views/AdminView';

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.CLIENT);
  
  // Encapsulated Business Logic
  const {
    orders,
    isProcessing,
    updateSlot,
    updateSleeve, // NEW
    handleImageUpload,
    handleEditImage,
    submitDesign,
    handleClientReview,
    updateOrderStatus,
    reportIssue,
    resolveIssue,
    handleEvidenceUpload,
    resetSystem
  } = useOrderSystem();

  // Local UI State for Modal
  const [pendingUpload, setPendingUpload] = useState<{
      file: File;
      orderId: string;
      itemId: string;
      slotId: string;
  } | null>(null);

  const confirmUpload = async () => {
    if (pendingUpload) {
        await handleImageUpload(
            pendingUpload.file, 
            pendingUpload.orderId, 
            pendingUpload.itemId, 
            pendingUpload.slotId
        );
        setPendingUpload(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} onReset={resetSystem} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {currentRole === UserRole.CLIENT && (
            <ClientView 
                orders={orders}
                isProcessing={isProcessing}
                onUpdateSlot={updateSlot}
                onUpdateSleeve={updateSleeve} // PASSED PROP
                onInitiateUpload={(file, orderId, itemId, slotId) => setPendingUpload({ file, orderId, itemId, slotId })}
                onEditImage={handleEditImage}
                onReviewDesign={handleClientReview}
            />
        )}

        {currentRole === UserRole.DESIGNER && (
            <DesignerView 
                orders={orders}
                onSubmitDesign={submitDesign}
            />
        )}

        {currentRole === UserRole.EMBROIDERER && (
            <ProductionView 
                orders={orders}
                currentRole={currentRole}
                onUpdateStatus={updateOrderStatus}
                onReportIssue={reportIssue}
                onResolveIssue={resolveIssue}
                onUploadEvidence={handleEvidenceUpload}
            />
        )}

        {currentRole === UserRole.ADMIN && (
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
