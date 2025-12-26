import { supabase } from '../integrations/supabase/client';
import { Customer, Order } from '../../types';

export const customerService = {
    /**
     * Registers or updates a customer based on order data.
     */
    async registerCustomer(email: string, name: string, phone?: string): Promise<Customer | null> {
        // NOTE: This logic is now mostly handled by the DB Trigger and RPC, 
        // but kept for client-side usages if needed.
        try {
            const { data: existingUser, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('email', email)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking customer:', fetchError);
                return null;
            }

            if (existingUser) {
                return {
                    id: existingUser.id,
                    email: existingUser.email,
                    customerName: existingUser.customer_name,
                    phone: existingUser.phone,
                    createdAt: existingUser.created_at,
                    updatedAt: existingUser.updated_at
                };
            }

            const { data: newUser, error: createError } = await supabase
                .from('customers')
                .insert({
                    email,
                    customer_name: name,
                    phone
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating customer:', createError);
                return null;
            }

            return {
                id: newUser.id,
                email: newUser.email,
                customerName: newUser.customer_name,
                phone: newUser.phone,
                createdAt: newUser.created_at,
                updatedAt: newUser.updated_at
            };
        } catch (err) {
            console.error('Unexpected error in registerCustomer:', err);
            return null;
        }
    },

    /**
     * Links an order to a customer.
     */
    async linkOrderToCustomer(orderId: string, customerId: string): Promise<boolean> {
        const { error } = await supabase
            .from('orders')
            .update({ customer_id: customerId })
            .eq('id', orderId);

        if (error) {
            console.error('Error linking order to customer:', error);
            return false;
        }
        return true;
    },

    /**
     * Authenticates a customer using Email + Order ID via Secure RPC
     */
    async authenticateCustomer(email: string, orderNumber: string): Promise<{ success: boolean; customer?: Customer; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('authenticate_customer', {
                p_email: email.trim(),
                p_order_id: orderNumber.trim()
            });

            if (error) {
                console.error(error);
                return { success: false, error: 'Error del servidor al autenticar.' };
            }

            // RPC returns { success: boolean, customer: object | null, error: string | null }
            if (data.success) {
                return {
                    success: true,
                    customer: data.customer
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Credenciales inválidas'
                };
            }

        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
};
