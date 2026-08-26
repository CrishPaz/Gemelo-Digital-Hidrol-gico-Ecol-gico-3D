/**
 * RBACUserModal - Selector y Gestor de Roles y Permisos (RBAC)
 * Permite cambiar entre roles de la cuenca (Administrador, Gestor, Analista, Operador de Campo, Invitado)
 * y visualizar los permisos asignados según matriz de seguridad.
 */

import React from 'react';
import { UserProfile, UserRole } from '../types';
import { INITIAL_USERS } from '../data/mocheBasinData';
import { Shield, Check, X, User, Key, Lock } from 'lucide-react';

interface RBACUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
}

export const RBACUserModal: React.FC<RBACUserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">Control de Acceso Basado en Roles (RBAC)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Seleccione un perfil institucional para simular la experiencia con los permisos granulares correspondientes:
        </p>

        {/* Lista de Usuarios y Roles */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {INITIAL_USERS.map(user => {
            const isCurrent = user.id === currentUser.id;
            return (
              <div
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isCurrent
                    ? 'bg-blue-950/60 border-blue-500 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-200">{user.name}</div>
                    <div className="text-[11px] text-slate-400">{user.email}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      user.role === 'admin'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : user.role === 'basin_manager'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : user.role === 'analyst'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : user.role === 'field_operator'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {user.role.replace('_', ' ')}
                  </span>
                  {isCurrent && (
                    <span className="block text-[10px] text-emerald-400 font-bold mt-1">Activo</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Matriz de Permisos del Usuario Activo */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
            Permisos Activos de {currentUser.name}:
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              {currentUser.permissions.canRunSimulations ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={currentUser.permissions.canRunSimulations ? 'text-slate-300' : 'text-slate-500'}>
                Simulaciones GR4J
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {currentUser.permissions.canRunAssimilation ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={currentUser.permissions.canRunAssimilation ? 'text-slate-300' : 'text-slate-500'}>
                Asimilación EnKF
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {currentUser.permissions.canTriggerScenarios ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={currentUser.permissions.canTriggerScenarios ? 'text-slate-300' : 'text-slate-500'}>
                Escenarios What-If
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {currentUser.permissions.canGenerateReports ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={currentUser.permissions.canGenerateReports ? 'text-slate-300' : 'text-slate-500'}>
                Generación de Reportes
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
