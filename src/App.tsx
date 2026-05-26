import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Financeiro from './views/Financeiro';
import Estoque from './views/Estoque';
import Pratos from './views/Pratos';
import Clientes from './views/Clientes';
import Orcamentos from './views/Orcamentos';
import Fornecedores from './views/Fornecedores';
import Configuracoes from './views/Configuracoes';
import Usuarios from './views/Usuarios';
import Login from './views/Login';
import BottomNav from './components/BottomNav';
import { useAuth } from './contexts/AuthContext';

export type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes' | 'usuarios';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-mesaninas-creme">
        <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="flex w-full h-screen overflow-hidden font-sans bg-mesaninas-creme bg-grid-pattern text-mesaninas-green">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex flex-col flex-1 min-w-0 relative h-full">
        <Header activeView={activeView} />
        <div className="flex flex-col flex-1 p-4 lg:p-6 lg:space-y-6 overflow-auto lg:overflow-hidden pb-24 lg:pb-6">
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'estoque' && <Estoque />}
          {activeView === 'pratos' && <Pratos />}
          {activeView === 'orcamentos' && <Orcamentos />}
          {activeView === 'financeiro' && <Financeiro />}
          {activeView === 'clientes' && <Clientes />}
          {activeView === 'fornecedores' && <Fornecedores />}
          {activeView === 'configuracoes' && <Configuracoes />}
          {activeView === 'usuarios' && <Usuarios />}
        </div>
        <BottomNav activeView={activeView} onNavigate={setActiveView} />
      </main>
    </div>
  );
}

