import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';

interface SessionContextType {
  session: Session | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// MOCK SESSION PARA DESARROLLO
// Importante: El ID debe ser un UUID válido para que Postgres no rechace las inserciones
const MOCK_SESSION: Session = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // UUID válido generado aleatoriamente
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@malcriados.app',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
};

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // INICIALIZAMOS CON LA SESIÓN MOCK DIRECTAMENTE
  const [session, setSession] = useState<Session | null>(MOCK_SESSION);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Intentamos obtener sesión real, pero no bloqueamos si falla
    supabase.auth.getSession().then(({ data: { session: realSession } }) => {
      if (realSession) {
          setSession(realSession);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
          setSession(session);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession debe ser usado dentro de un SessionContextProvider');
  }
  return context;
};