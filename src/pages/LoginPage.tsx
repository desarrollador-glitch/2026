import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';

const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Bienvenido a <span className="text-brand-600">MALCRIADOS.APP</span>
        </h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]} // Puedes añadir 'google', 'github', etc. si los configuras en Supabase
          redirectTo={window.location.origin} // Redirige a la URL actual después de la autenticación
          localization={{
            variables: {
              sign_in: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Iniciar sesión',
                social_provider_text: 'O inicia sesión con {{provider}}',
                link_text: '¿Ya tienes una cuenta? Inicia sesión',
              },
              sign_up: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                password_input_placeholder: 'Crea una contraseña',
                button_label: 'Registrarse',
                social_provider_text: 'O regístrate con {{provider}}',
                link_text: '¿No tienes una cuenta? Regístrate',
              },
              forgotten_password: {
                email_label: 'Correo electrónico',
                password_reset_button_label: 'Enviar instrucciones de recuperación',
                link_text: '¿Olvidaste tu contraseña?',
                email_input_placeholder: 'Tu correo electrónico',
              },
              update_password: {
                password_label: 'Nueva contraseña',
                password_input_placeholder: 'Tu nueva contraseña',
                button_label: 'Actualizar contraseña',
              },
              magic_link: {
                email_input_placeholder: 'Tu correo electrónico',
                button_label: 'Enviar enlace mágico',
                link_text: 'Enviar un enlace mágico',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default LoginPage;