import { LayoutDashboard, Calculator, Users, Truck, Utensils, Package, LineChart, Settings, ShieldCheck, LogOut } from 'lucide-react';
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes' | 'usuarios';

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { userProfile } = useAuth();
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  const navItemClass = (view: ViewType) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
      activeView === view
        ? 'bg-mesaninas-yellow text-mesaninas-green font-bold'
        : 'hover:bg-mesaninas-yellow/10 hover:text-mesaninas-yellow border border-transparent text-mesaninas-creme/70'
    }`;

  const iconClass = (view: ViewType) =>
    `w-4 h-4 ${
      activeView === view ? 'text-mesaninas-green' : 'text-current'
    }`;

  return (
    <aside className="hidden lg:flex flex-col shrink-0 w-64 border-r bg-mesaninas-green text-mesaninas-creme/70 border-mesaninas-green/80">
      <div className="p-6 border-b border-mesaninas-creme/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 font-serif font-bold text-mesaninas-green bg-mesaninas-yellow rounded">
            M
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-mesaninas-creme">
            Mesaninas
          </span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <div className={navItemClass('dashboard')} onClick={() => onNavigate('dashboard')}>
          <LayoutDashboard className={iconClass('dashboard')} />
          <span className="text-sm">Dashboard</span>
        </div>
        
        <div className={navItemClass('orcamentos')} onClick={() => onNavigate('orcamentos')}>
          <Calculator className={iconClass('orcamentos')} />
          <span className="text-sm">Orçamentos</span>
        </div>

        <div className={navItemClass('financeiro')} onClick={() => onNavigate('financeiro')}>
          <LineChart className={iconClass('financeiro')} />
          <span className="text-sm">Financeiro</span>
        </div>

        <div className={navItemClass('clientes')} onClick={() => onNavigate('clientes')}>
          <Users className={iconClass('clientes')} />
          <span className="text-sm">Clientes</span>
        </div>

        <div className={navItemClass('fornecedores')} onClick={() => onNavigate('fornecedores')}>
          <Truck className={iconClass('fornecedores')} />
          <span className="text-sm">Fornecedores</span>
        </div>
        
        <div className={navItemClass('pratos')} onClick={() => onNavigate('pratos')}>
          <Utensils className={iconClass('pratos')} />
          <span className="text-sm">Cardápio</span>
        </div>

        <div className={navItemClass('estoque')} onClick={() => onNavigate('estoque')}>
          <Package className={iconClass('estoque')} />
          <span className="text-sm">Estoque</span>
        </div>
        
        {userProfile?.perfil === 'Admin' && (
          <div className={navItemClass('usuarios')} onClick={() => onNavigate('usuarios')}>
            <ShieldCheck className={iconClass('usuarios')} />
            <span className="text-sm">Usuários</span>
          </div>
        )}
        
        <div className={navItemClass('configuracoes')} onClick={() => onNavigate('configuracoes')}>
          <Settings className={iconClass('configuracoes')} />
          <span className="text-sm">Configurações</span>
        </div>
        
      </nav>
      <div className="p-4 border-t border-mesaninas-creme/10 flex items-center justify-between">
        <div className="text-[10px] text-mesaninas-creme/50 tracking-wider uppercase">
          CATERING MANAGEMENT
        </div>
        <button 
          onClick={handleLogout}
          className="p-1.5 text-mesaninas-creme/50 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
