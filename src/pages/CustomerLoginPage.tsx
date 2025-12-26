import React, { useState } from 'react';
import { useCustomerSession } from '../components/CustomerSessionContext';
import { customerService } from '../services/customerService';
import toast from 'react-hot-toast';

interface CustomerLoginPageProps {
    onSwitchToStaff: () => void;
}

const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onSwitchToStaff }) => {
    const [email, setEmail] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { loginCustomer } = useCustomerSession();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !orderNumber) {
            toast.error('Por favor ingresa email y número de pedido');
            return;
        }

        setIsLoading(true);
        try {
            const result = await customerService.authenticateCustomer(email, orderNumber);

            if (result.success && result.customer) {
                loginCustomer({
                    customerId: result.customer.id,
                    email: result.customer.email,
                    customerName: result.customer.customerName
                });
                toast.success(`Bienvenido, ${result.customer.customerName}`);
            } else {
                toast.error(result.error || 'Credenciales inválidas');
            }
        } catch (error: any) {
            toast.error('Ocurrió un error al intentar ingresar');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
                    Seguimiento de Pedido
                </h2>
                <p className="text-center text-gray-500 mb-8">
                    Ingresa tus datos para ver el estado de tu compra en <span className="text-brand-600 font-semibold">Malcriados</span>
                </p>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                            placeholder="ejemplo@correo.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                            Número de Pedido (ID)
                        </label>
                        <input
                            id="orderNumber"
                            type="text"
                            required
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                            placeholder="Ingresa el ID de tu pedido"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Lo encuentras en tu correo de confirmación.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${isLoading
                                ? 'bg-brand-400 cursor-not-allowed'
                                : 'bg-brand-600 hover:bg-brand-700 shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Verificando...
                            </span>
                        ) : 'Ver mi Pedido'}
                    </button>
                </form>

                <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                    <p className="text-sm text-gray-500 mb-3">¿Eres parte del equipo?</p>
                    <button
                        onClick={onSwitchToStaff}
                        className="text-brand-600 hover:text-brand-800 font-medium text-sm transition-colors"
                    >
                        Ingreso Staff
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerLoginPage;
