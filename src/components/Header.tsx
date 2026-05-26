import React from 'react';

type ViewType = 'dashboard' | 'clientes' | 'fornecedores' | 'estoque' | 'pratos' | 'orcamentos' | 'financeiro' | 'configuracoes' | 'usuarios';

interface HeaderProps {
  activeView: ViewType;
}

export default function Header({ activeView }: HeaderProps) {
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

  return (
    <header className="flex items-start sm:items-center justify-between px-4 lg:px-6 pt-6 pb-2 bg-transparent shrink-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl lg:text-4xl font-serif font-bold text-mesaninas-green">
          {viewTitles[activeView]}
        </h2>
      </div>
    </header>
  );
}
