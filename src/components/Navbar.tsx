import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calculator, 
  Users, 
  Truck, 
  Utensils, 
  Package, 
  LineChart, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes' | 'usuarios';

interface NavbarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export default function Navbar({ activeView, onNavigate }: NavbarProps) {
  const { userProfile } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  const isCadastrosActive = ['clientes', 'fornecedores', 'pratos', 'estoque'].includes(activeView);

  const getInitials = (nome?: string) => {
    if (!nome) return 'U';
    return nome.substring(0, 2).toUpperCase();
  };

  const mainNavItemClass = (isActive: boolean) =>
    `relative flex items-center gap-1.5 px-3 py-2 text-sm font-sans font-medium transition-all duration-200 cursor-pointer select-none rounded-md ${
      isActive
        ? 'text-white font-bold bg-white/10'
        : 'text-[#f4efdc]/80 hover:text-white hover:bg-white/5'
    }`;

  const dropdownItemClass = (view: ViewType) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
      activeView === view 
        ? 'bg-mesaninas-yellow/15 text-[#00382b] font-bold' 
        : 'text-gray-700 hover:bg-gray-50 hover:text-[#00382b]'
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#00382b] border-b border-white/10 text-[#f4efdc] shadow-md shrink-0">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* LEFT: LOGO */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onNavigate('dashboard')}>
            <div className="flex items-center justify-center w-8 h-8 font-serif font-bold text-[#00382b] bg-[#e7e873] rounded shadow-sm">
              M
            </div>
            <span className="text-xl font-serif font-bold tracking-tight text-white">
              Mesaninas
            </span>
          </div>

          {/* CENTER: DESKTOP NAVIGATION */}
          <div className="hidden lg:flex items-center gap-1 text-[#f4efdc]">
            <div className={mainNavItemClass(activeView === 'dashboard')} onClick={() => onNavigate('dashboard')}>
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
              {activeView === 'dashboard' && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#e7e873] rounded-full" />
              )}
            </div>

            <div className={mainNavItemClass(activeView === 'orcamentos')} onClick={() => onNavigate('orcamentos')}>
              <Calculator size={16} />
              <span>Orçamentos</span>
              {activeView === 'orcamentos' && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#e7e873] rounded-full" />
              )}
            </div>

            <div className={mainNavItemClass(activeView === 'financeiro')} onClick={() => onNavigate('financeiro')}>
              <LineChart size={16} />
              <span>Financeiro</span>
              {activeView === 'financeiro' && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#e7e873] rounded-full" />
              )}
            </div>

            {/* CADASTROS DROPDOWN */}
            <div 
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`${mainNavItemClass(isCadastrosActive)} flex items-center gap-1.5`}
              >
                <span>Cadastros</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                {isCadastrosActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#e7e873] rounded-full" />
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 pt-1 w-48 z-50">
                  <div className="bg-white text-gray-800 rounded-lg shadow-xl py-1 border border-gray-100">
                    <div className={dropdownItemClass('clientes')} onClick={() => { onNavigate('clientes'); setDropdownOpen(false); }}>
                      <Users size={16} className="opacity-70" />
                      <span>Clientes</span>
                    </div>
                    <div className={dropdownItemClass('fornecedores')} onClick={() => { onNavigate('fornecedores'); setDropdownOpen(false); }}>
                      <Truck size={16} className="opacity-70" />
                      <span>Fornecedores</span>
                    </div>
                    <div className={dropdownItemClass('pratos')} onClick={() => { onNavigate('pratos'); setDropdownOpen(false); }}>
                      <Utensils size={16} className="opacity-70" />
                      <span>Cardápio</span>
                    </div>
                    <div className={dropdownItemClass('estoque')} onClick={() => { onNavigate('estoque'); setDropdownOpen(false); }}>
                      <Package size={16} className="opacity-70" />
                      <span>Estoque</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {userProfile?.perfil === 'Admin' && (
              <div className={mainNavItemClass(activeView === 'usuarios')} onClick={() => onNavigate('usuarios')}>
                <ShieldCheck size={16} />
                <span>Usuários</span>
                {activeView === 'usuarios' && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#e7e873] rounded-full" />
                )}
              </div>
            )}
          </div>

          {/* RIGHT: USER INFO AND UTILITIES */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[10px] font-bold text-[#f4efdc]/50 tracking-wider leading-none uppercase">
                  {userProfile?.perfil || 'USUÁRIO'}
                </span>
                <span className="text-sm font-bold text-[#f4efdc] block mt-0.5">
                  Olá, {userProfile?.nome ? userProfile.nome.split(' ')[0] : 'Usuário'}!
                </span>
              </div>
              
              {userProfile?.fotoPerfil ? (
                <img referrerPolicy="no-referrer" src={userProfile.fotoPerfil} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-[#e7e873] object-cover shadow-sm bg-white" />
              ) : (
                <div className="w-10 h-10 bg-[#e7e873] text-[#00382b] rounded-full flex items-center justify-center text-sm font-black shadow-sm">
                  {getInitials(userProfile?.nome)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 border-l border-white/15 pl-3">
              <button 
                onClick={() => onNavigate('configuracoes')}
                className={`p-2 text-[#f4efdc]/75 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer ${activeView === 'configuracoes' ? 'bg-white/10 text-white' : ''}`}
                title="Configurações"
              >
                <Settings size={18} />
              </button>

              <button 
                onClick={handleLogout}
                className="p-2 text-[#f4efdc]/75 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* MOBILE BURGER BUTTON */}
          <div className="flex lg:hidden items-center gap-2">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#f4efdc] hover:text-white rounded-md hover:bg-white/10"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#00382b] flex flex-col px-4 py-3 space-y-1.5 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div 
            className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium ${activeView === 'dashboard' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium ${activeView === 'orcamentos' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('orcamentos'); setMobileMenuOpen(false); }}
          >
            <Calculator size={18} />
            <span>Orçamentos</span>
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium ${activeView === 'financeiro' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('financeiro'); setMobileMenuOpen(false); }}
          >
            <LineChart size={18} />
            <span>Financeiro</span>
          </div>

          <div className="pt-2 pb-1 px-2.5 text-[10px] font-bold tracking-widest text-[#f4efdc]/50 uppercase">
            Cadastros
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 pl-6 rounded-lg text-sm font-medium ${activeView === 'clientes' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('clientes'); setMobileMenuOpen(false); }}
          >
            <Users size={18} />
            <span>Clientes</span>
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 pl-6 rounded-lg text-sm font-medium ${activeView === 'fornecedores' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('fornecedores'); setMobileMenuOpen(false); }}
          >
            <Truck size={18} />
            <span>Fornecedores</span>
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 pl-6 rounded-lg text-sm font-medium ${activeView === 'pratos' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('pratos'); setMobileMenuOpen(false); }}
          >
            <Utensils size={18} />
            <span>Cardápio</span>
          </div>

          <div 
            className={`flex items-center gap-2.5 p-2.5 pl-6 rounded-lg text-sm font-medium ${activeView === 'estoque' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
            onClick={() => { onNavigate('estoque'); setMobileMenuOpen(false); }}
          >
            <Package size={18} />
            <span>Estoque</span>
          </div>

          <div className="border-t border-white/10 pt-2 space-y-1.5">
            {userProfile?.perfil === 'Admin' && (
              <div 
                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium ${activeView === 'usuarios' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
                onClick={() => { onNavigate('usuarios'); setMobileMenuOpen(false); }}
              >
                <ShieldCheck size={18} />
                <span>Usuários</span>
              </div>
            )}

            <div 
              className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium ${activeView === 'configuracoes' ? 'bg-[#e7e873] text-[#00382b] font-bold' : 'text-[#f4efdc]/85'}`}
              onClick={() => { onNavigate('configuracoes'); setMobileMenuOpen(false); }}
            >
              <Settings size={18} />
              <span>Configurações</span>
            </div>

            <div 
              className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-medium text-rose-300 hover:bg-rose-500/10 cursor-pointer"
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
            >
              <LogOut size={18} />
              <span>Sair</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
