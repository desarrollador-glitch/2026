import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import RoleSwitcher from './components/RoleSwitcher';
import PawModal from './components/PawModal';
import { useOrderSystem } from './hooks/useOrderSystem';
import { useSession } from './src/components/SessionContextProvider'; // Importar useSession
import LoginPage from './src/pages/LoginPage'; // Importar LoginPage
import { useQuery } from '@tanstack/react-query';
import { supabase } from './src/integrations/supabase/client';

// Views
import ClientView from './components/views/ClientView';
import DesignerView from './components/views/DesignerView';
import ProductionView from './components/views/ProductionView';
import AdminView from './components/views/AdminView';

const App: React.FC = () => {
  const { session, loading: sessionLoading } = useSession();
  const [userRole, setUserRole] = useState<UserRole | null>(null); // Estado para el rol real del usuario

  // Fetch user profile and role from Supabase
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session && !sessionLoading, // Solo ejecutar si hay sesión y no está cargando
    staleTime: Infinity, // El rol no cambia a menudo
  });

  useEffect(() => {
    if (profile?.role) {
      setUserRole(profile.role as UserRole);
    } else if (!session && !sessionLoading) {
      setUserRole(null); // Si no hay sesión, no hay rol
    }
  }, [profile, session, sessionLoading]);

  // Encapsulated Business Logic (will be migrated to Supabase)
  const {
    orders,
    isProcessing,
    updateSlot,
    updateSleeve,
    handleImageUpload,
    handleEditImage,
    submitDesign,
    handleClientReview,
    updateOrderStatus,
    reportIssue,
    resolveIssue,
    handleEvidenceUpload,
    resetSystem // This will become a logout function
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole(null); // Limpiar el rol al cerrar sesión
    resetSystem(); // Esto también limpiará localStorage y recargará
  };

  if (sessionLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        Cargando aplicación...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // Si hay sesión y rol, renderizar la aplicación principal
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <RoleSwitcher 
        currentRole={userRole || UserRole.CLIENT} // Usar el rol real, o CLIENT como fallback
        onRoleChange={() => { /* No-op, el rol se determina por Supabase */ }} 
        onReset={handleLogout} // Ahora es un botón de cerrar sesión
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {userRole === UserRole.CLIENT && (
            <ClientView 
                orders={orders}
                isProcessing={isProcessing}
                onUpdateSlot={updateSlot}
                onUpdateSleeve={updateSleeve}
                onInitiateUpload={(file, orderId, itemId, slotId) => setPendingUpload({ file, orderId, itemId, slotId })}
                onEditImage={handleEditImage}
                onReviewDesign={handleClientReview}
            />
        )}

        {userRole === UserRole.DESIGNER && (
            <DesignerView 
                orders={orders}
                onSubmitDesign={submitDesign}
            />
        )}

        {userRole === UserRole.EMBROIDERER && (
            <ProductionView 
                orders={orders}
                currentRole={userRole}
                onUpdateStatus={updateOrderStatus}
                onReportIssue={reportIssue}
                onResolveIssue={resolveIssue}
                onUploadEvidence={handleEvidenceUpload}
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