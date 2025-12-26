import React from 'react';
import { UserRole } from '../types';
import { Users, Palette, Scissors, ShieldCheck, LogOut, Package } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onReset: () => void;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, onRoleChange, onReset }) => {
  const roles = [
    { id: UserRole.CLIENT, label: 'Cliente', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { id: UserRole.DESIGNER, label: 'Diseñador', icon: Palette, color: 'text-purple-600 bg-purple-50' },
    { id: UserRole.EMBROIDERER, label: 'Bordador', icon: Scissors, color: 'text-orange-600 bg-orange-50' },
    { id: UserRole.PACKER, label: 'Empacador', icon: Package, color: 'text-green-600 bg-green-50' },
    { id: UserRole.ADMIN, label: 'Admin', icon: ShieldCheck, color: 'text-gray-600 bg-gray-50' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="font-bold text-xl tracking-tight text-gray-900 mr-8">
              MALCRIADOS<span className="text-brand-600">.APP</span>
              <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-200">MODO DEV</span>
            </span>
            <div className="hidden md:flex space-x-2">
              {roles.map((role) => {
                const Icon = role.icon;
                const isActive = currentRole === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => onRoleChange(role.id)} // HABILITADO
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                      ? 'bg-brand-100 text-brand-900 ring-1 ring-brand-300'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
                      }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <div className="md:hidden">
              <select
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as UserRole)} // HABILITADO
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm rounded-md bg-gray-50 text-gray-700"
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSwitcher;