import React, { useState } from 'react';
import Navbar from './components/Navbar';
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
    <div className="flex flex-col w-full h-screen overflow-hidden font-sans bg-mesaninas-creme bg-grid-pattern text-mesaninas-green">
      <Navbar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex-1 flex flex-col min-w-0">
          <Header activeView={activeView} />
          <div className="flex-1 mt-2 pb-6 min-h-0">
            {activeView === 'dashboard' && <Dashboard onNavigate={setActiveView} />}
            {activeView === 'estoque' && <Estoque />}
            {activeView === 'pratos' && <Pratos />}
            {activeView === 'orcamentos' && <Orcamentos />}
            {activeView === 'financeiro' && <Financeiro />}
            {activeView === 'clientes' && <Clientes />}
            {activeView === 'fornecedores' && <Fornecedores />}
            {activeView === 'configuracoes' && <Configuracoes />}
            {activeView === 'usuarios' && <Usuarios />}
          </div>
        </div>
      </main>
    </div>
  );
}

