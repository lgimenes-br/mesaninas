import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento } from '../types';

export default function Financeiro() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Usando query para simplificar, mas podemos trazer tudo e filtrar localmente também.
    // Vamos trazer tudo ou adicionar índices? Vamos puxar os orçamentos e filtrar localmente
    // se for simples ou pela query se tivermos certeza. Filtrar tudo localmente é mais
    // seguro para não depender de índices criados do Firebase para esse preview.
    const unsub = onSnapshot(collection(db, 'orcamentos'), (snapshot) => {
      const orcs: Orcamento[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const s = data.status?.toLowerCase();
        if (s === 'aprovado' || s === 'entregue' || s === 'concluido') {
           orcs.push({ id: doc.id, ...data } as Orcamento);
        }
      });
      setOrcamentos(orcs);
      setIsLoading(false);
    }, (error) => {
      console.error('Erro ao carregar dados financeiros', error);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    // dateString generally comes in the YYYY-MM-DD format from standard inputs
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  const faturamentoTotal = orcamentos.reduce((acc, orc) => acc + (Number(orc.valorVenda) || 0), 0);
  const custosTotais = orcamentos.reduce((acc, orc) => acc + (Number(orc.custoTotal) || 0), 0);
  const lucroBruto = faturamentoTotal - custosTotais;
  const margemMedia = faturamentoTotal > 0 ? (lucroBruto / faturamentoTotal) * 100 : 0;
  const contasAReceber = orcamentos.filter(o => o.statusPagamento === 'Aguardando' || !o.statusPagamento).reduce((acc, orc) => acc + (Number(orc.valorVenda) || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
           <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Faturamento Total</span>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">
                {formatCurrency(faturamentoTotal)}
              </div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Custos Totais</span>
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">
                {formatCurrency(custosTotais)}
              </div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Lucro Bruto</span>
                <DollarSign className="w-5 h-5 text-mesaninas-yellow" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">
                {formatCurrency(lucroBruto)}
              </div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Margem Média</span>
                <Percent className="w-5 h-5 text-mesaninas-green/60" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">
                {margemMedia.toFixed(2)}%
              </div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">A Receber</span>
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">
                {formatCurrency(contasAReceber)}
              </div>
            </div>
          </div>

          {/* Extrato de Eventos */}
          <div className="bg-white border text-mesaninas-green border-mesaninas-creme rounded-xl shadow-sm flex flex-col overflow-hidden">
             <div className="px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10">
                <h3 className="font-serif font-bold text-lg text-mesaninas-green">Extrato de Projetos</h3>
             </div>
             
             {/* Desktop Table (hidden on mobile) */}
             <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-mesaninas-creme/50 border-b border-mesaninas-creme/50 text-[11px] uppercase tracking-wider text-mesaninas-green/60">
                      <th className="px-6 py-3 font-bold">Data do Evento</th>
                      <th className="px-6 py-3 font-bold">Cliente</th>
                      <th className="px-6 py-3 font-bold text-right">Faturamento</th>
                      <th className="px-6 py-3 font-bold text-right">Custo</th>
                      <th className="px-6 py-3 font-bold text-right">Lucro do Evento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mesaninas-creme/40">
                    {orcamentos.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum evento aprovado ou concluído.</td>
                       </tr>
                    ) : (
                      orcamentos.map((orc) => (
                        <tr key={orc.id} className="hover:bg-mesaninas-creme/30 transition-colors group">
                          <td className="px-6 py-4 font-medium">{formatDate(orc.dataEvento)}</td>
                          <td className="px-6 py-4">{orc.clienteNome || 'Cliente não informado'}</td>
                          <td className="px-6 py-4 text-right font-medium text-mesaninas-green">
                            {formatCurrency(Number(orc.valorVenda) || 0)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-red-500/80">
                            {formatCurrency(Number(orc.custoTotal) || 0)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-mesaninas-green">
                            {formatCurrency((Number(orc.valorVenda) || 0) - (Number(orc.custoTotal) || 0))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>

             {/* Mobile Cards (hidden on desktop) */}
             <div className="flex flex-col md:hidden divide-y divide-mesaninas-creme/40 bg-white">
                {orcamentos.length === 0 ? (
                  <div className="p-8 text-center text-mesaninas-green/50 text-sm">
                    Nenhum evento aprovado ou concluído.
                  </div>
                ) : (
                  orcamentos.map((orc) => {
                    const faturamento = Number(orc.valorVenda) || 0;
                    const custo = Number(orc.custoTotal) || 0;
                    const lucro = faturamento - custo;
 
                    return (
                      <div key={orc.id} className="p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-mesaninas-green text-sm">{orc.clienteNome || 'Cliente'}</span>
                           <span className="text-xs text-mesaninas-green/70">{formatDate(orc.dataEvento)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-mesaninas-green/80">Faturamento</span>
                          <span className="font-medium text-mesaninas-green">{formatCurrency(faturamento)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-mesaninas-green/80">Custos</span>
                          <span className="font-medium text-red-500/80">{formatCurrency(custo)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-mesaninas-creme/50 pt-2 mt-1">
                          <span className="font-semibold text-mesaninas-green">Lucro</span>
                          <span className="font-bold text-mesaninas-green">{formatCurrency(lucro)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
