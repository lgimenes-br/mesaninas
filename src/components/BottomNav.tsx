import React from 'react';
import { Home, Users, BookOpen, ScrollText, Truck, LineChart } from 'lucide-react';

type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes';

interface BottomNavProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export default function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const navItemClass = (view: ViewType) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      activeView === view
        ? 'text-mesaninas-yellow'
        : 'text-mesaninas-creme/60 hover:text-mesaninas-creme'
    }`;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 bg-mesaninas-green border-t border-mesaninas-green/80 flex items-center justify-around z-50 pb-[env(safe-area-inset-bottom)]">
      <button className={navItemClass('dashboard')} onClick={() => onNavigate('dashboard')}>
        <Home size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Início</span>
      </button>
      
      <button className={navItemClass('clientes')} onClick={() => onNavigate('clientes')}>
        <Users size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Clientes</span>
      </button>

      <button className={navItemClass('fornecedores')} onClick={() => onNavigate('fornecedores')}>
        <Truck size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Forn.</span>
      </button>

      <button className={navItemClass('pratos')} onClick={() => onNavigate('pratos')}>
        <BookOpen size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Cardápio</span>
      </button>

      <button className={navItemClass('orcamentos')} onClick={() => onNavigate('orcamentos')}>
        <ScrollText size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Orçamento</span>
      </button>

      <button className={navItemClass('financeiro')} onClick={() => onNavigate('financeiro')}>
        <LineChart size={20} />
        <span className="text-[10px] font-semibold tracking-wide">Finanças</span>
      </button>
    </nav>
  );
}
