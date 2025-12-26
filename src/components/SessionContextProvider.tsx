import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { UserRole } from '../../types';

interface SessionContextType {
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, we might want to create it or just fallback
        setUserRole(UserRole.CLIENT);
      } else if (data) {
        console.log('Profile found:', data.role);
        setUserRole(data.role as UserRole);
      } else {
        setUserRole(UserRole.CLIENT);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setUserRole(UserRole.CLIENT);
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (currentSession: Session | null) => {
      if (!mounted) return;

      console.log('Handling session change:', currentSession?.user?.email);
      setSession(currentSession);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setUserRole(null);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log('Auth event:', _event);
      handleSession(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, userRole, loading }}>
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