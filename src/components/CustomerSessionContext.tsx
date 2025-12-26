import React, { createContext, useContext, useState, useEffect } from 'react';
import { CustomerSession } from '../../types';

interface CustomerSessionContextType {
    customerSession: CustomerSession | null;
    loginCustomer: (session: CustomerSession) => void;
    logoutCustomer: () => void;
    loading: boolean;
}

const CustomerSessionContext = createContext<CustomerSessionContextType | undefined>(undefined);

const CUSTOMER_STORAGE_KEY = 'malcriados_customer_session';

export const CustomerSessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Attempt to restore session from localStorage
        const stored = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setCustomerSession(parsed);
            } catch (e) {
                console.error("Failed to parse customer session", e);
                localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            }
        }
        setLoading(false);
    }, []);

    const loginCustomer = (session: CustomerSession) => {
        setCustomerSession(session);
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));

        // Set Postgres configuration for RLS if using Supabase directly from client for RLS
        // However, `current_setting` RLS usually requires a server-side setting or a specific RPC to set the claim.
        // Since we are using standard supabase-js client which uses JWT, we can't easily inject `app.customer_email` 
        // into the session variables without a custom auth provider or RPC wrapper.
        //
        // ALTERNATIVE RLS STRATEGY FOR THIS "LIGHT" AUTH:
        // We will rely on filters in `useOrderSystem` or client-side filtering for this MVP 
        // because we are not minting real JWTs for these customers yet.
        // 
        // OR: We can use an RPC function `set_claim` if we were admin, but we aren't.
        // 
        // SAFE APPROACH: 
        // The `customerService` will need to be the gatekeeper or we rely on the `orders` table RLS allowing 
        // public read if we had a password? No.
        //
        // REALISTIC MVP:
        // We will query orders filtering strictly by the email stored in this session.
        // Security relying on the "Login" screen validating the Order ID + Email combination.
    };

    const logoutCustomer = () => {
        setCustomerSession(null);
        localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    };

    return (
        <CustomerSessionContext.Provider value={{ customerSession, loginCustomer, logoutCustomer, loading }}>
            {children}
        </CustomerSessionContext.Provider>
    );
};

export const useCustomerSession = () => {
    const context = useContext(CustomerSessionContext);
    if (context === undefined) {
        throw new Error('useCustomerSession debe ser usado dentro de un CustomerSessionContextProvider');
    }
    return context;
};
