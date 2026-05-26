import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from 'lucide-react';

type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes' | 'usuarios';

interface HeaderProps {
  activeView: ViewType;
}

export default function Header({ activeView }: HeaderProps) {
  const { userProfile, loading: authLoading } = useAuth();

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    financeiro: 'Financeiro',
    clientes: 'Clientes',
    fornecedores: 'Fornecedores',
    estoque: 'Estoque',
    pratos: 'Cardápio',
    orcamentos: 'Orçamentos',
    configuracoes: 'Configurações',
    usuarios: 'Usuários'
  };

  const getProfileBadgeStyle = (perfil?: string) => {
    switch (perfil) {
      case 'Admin':
        return 'bg-mesaninas-yellow text-mesaninas-green';
      case 'Fornecedor':
        return 'bg-orange-100 text-orange-800';
      case 'Cliente':
        return 'bg-mesaninas-creme/60 text-mesaninas-green';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getInitials = (nome?: string) => {
    if (!nome) return 'U';
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <header className="flex items-start sm:items-center justify-between px-4 lg:px-6 pt-6 pb-4 bg-transparent z-10 shrink-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl lg:text-4xl font-serif font-bold text-mesaninas-green">
          {viewTitles[activeView]}
        </h2>
      </div>

      <div className="flex items-center gap-4 bg-white border border-mesaninas-creme rounded-full py-1.5 pl-5 pr-1.5 shadow-sm">
        {authLoading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-4 w-24 bg-mesaninas-creme/50 rounded hidden sm:block"></div>
            <div className="h-6 w-16 bg-mesaninas-creme/50 rounded-full hidden sm:block"></div>
            <div className="h-10 w-10 bg-mesaninas-creme/50 rounded-full"></div>
          </div>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm font-bold text-mesaninas-green">
                Olá, {userProfile?.nome ? userProfile.nome.split(' ')[0] : 'Usuário'}!
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border border-black/5 ${getProfileBadgeStyle(userProfile?.perfil)}`}>
                {userProfile?.perfil?.toUpperCase() || 'USUÁRIO'}
              </span>
            </div>
            { (userProfile as any)?.fotoPerfil ? (
              <img src={(userProfile as any).fotoPerfil} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-mesaninas-creme object-cover" />
            ) : (
              <div className="w-10 h-10 bg-mesaninas-green text-mesaninas-creme rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                {getInitials(userProfile?.nome)}
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
