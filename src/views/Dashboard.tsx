import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Cliente } from '../types';
import { Users, Clock, CalendarCheck, DollarSign, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientesTotais, setClientesTotais] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      setClientesTotais(snapshot.size);
    });

    const unsubOrcamentos = onSnapshot(collection(db, 'orcamentos'), (snapshot) => {
      const docs: Orcamento[] = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() } as Orcamento);
      });
      setOrcamentos(docs);
      setIsLoading(false);
    });

    return () => {
      unsubClientes();
      unsubOrcamentos();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-mesaninas-creme/30 items-center justify-center">
         <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
         <p className="mt-4 text-mesaninas-green/70 font-medium">Carregando painel...</p>
      </div>
    );
  }

  // Cálculos de KPI
  const orcamentosPendentes = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'rascunho' || s === 'enviado' || s === 'pendente';
  }).length;

  const eventosConfirmados = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'aprovado' || s === 'entregue' || s === 'concluido';
  });

  const receitaConfirmada = eventosConfirmados.reduce((acc, o) => acc + (Number(o.valorVenda) || 0), 0);

  // Próximos Eventos (Enviados e Aprovados ordenados por data)
  const proximosEventos = orcamentos
    .filter(o => o.status?.toLowerCase() === 'enviado' || o.status?.toLowerCase() === 'aprovado')
    // Tentativa de ordenar considerando que o formato da data é YYYY-MM-DD.
    .sort((a, b) => {
       if (!a.dataEvento) return 1;
       if (!b.dataEvento) return -1;
       return a.dataEvento.localeCompare(b.dataEvento);
    })
    .slice(0, 5);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  const getProjectStatusBadge = (status?: string) => {
     switch (status?.toLowerCase()) {
        case 'rascunho': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">RASCUNHO</span>;
        case 'enviado': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#bce8ea] text-mesaninas-green">ENVIADO</span>;
        case 'aprovado': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#e7e873] text-mesaninas-green">APROVADO</span>;
        case 'entregue': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-green text-white">ENTREGUE</span>;
        case 'pendente': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">RASCUNHO</span>;
        default: 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">{status || 'N/A'}</span>;
     }
  };

  const getPaymentBadge = (statusProjeto?: string, statusPagamento?: string) => {
    const s = statusProjeto?.toLowerCase();
    if (s !== 'aprovado' && s !== 'entregue') {
      return <span className="text-mesaninas-green/40 font-bold">-</span>;
    }
    if (statusPagamento?.toLowerCase() === 'pago') {
       return <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-emerald-500 text-white">PAGO</span>;
    }
    return <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-red-500 text-white">NÃO</span>;
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <div className="p-5 bg-white border rounded-xl shadow-sm border-mesaninas-creme flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Total de Clientes</span>
            <Users className="w-5 h-5 text-mesaninas-yellow" />
          </div>
          <div className="mt-1 text-2xl font-bold text-mesaninas-green">
            {clientesTotais}
          </div>
        </div>

        {/* Orçamentos Pendentes */}
        <div className="p-5 bg-white border rounded-xl shadow-sm border-mesaninas-creme flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
               <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Orçamentos Pendentes</span>
               <Clock className="w-5 h-5 text-orange-400" />
            </div>
          <div className="mt-1 text-2xl font-bold text-mesaninas-green">
            {orcamentosPendentes}
          </div>
        </div>

        {/* Eventos Confirmados */}
        <div className="p-5 bg-white border rounded-xl shadow-sm border-mesaninas-creme flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
             <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Eventos Confirmados</span>
             <CalendarCheck className="w-5 h-5 text-[#bce8ea]" />
          </div>
          <div className="mt-1 text-2xl font-bold text-mesaninas-green">
            {eventosConfirmados.length}
          </div>
        </div>

        {/* Receita Confirmada */}
        <div className="p-5 bg-white border rounded-xl shadow-sm border-mesaninas-creme flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Receita AP/ENTR</span>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-mesaninas-green">
            {formatCurrency(receitaConfirmada)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col overflow-hidden bg-white border shadow-sm rounded-xl border-mesaninas-creme">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10">
          <h3 className="font-serif font-bold text-lg text-mesaninas-green">Próximos Eventos</h3>
        </div>
        <div className="flex-1 overflow-auto p-4 lg:p-0">
          {/* DESKTOP TABLE */}
          <table className="hidden lg:table w-full text-left border-collapse text-sm">
            <thead className="bg-mesaninas-creme/30 text-[11px] uppercase font-bold text-mesaninas-green/60">
              <tr className="border-b border-mesaninas-creme/50">
                <th className="px-6 py-3 font-semibold text-center w-24">Data</th>
                <th className="px-6 py-3 font-semibold">Cliente</th>
                <th className="px-6 py-3 font-semibold">Evento</th>
                <th className="px-6 py-3 font-semibold text-center w-24">Convidados</th>
                <th className="px-6 py-3 font-semibold text-center w-32">Status</th>
                <th className="px-6 py-3 font-semibold text-center w-32">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mesaninas-creme border-b border-mesaninas-creme/50">
              {proximosEventos.length === 0 ? (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum evento próximo agendado.</td>
                </tr>
              ) : (
                 proximosEventos.map((orc) => (
                    <tr key={orc.id} className="hover:bg-mesaninas-creme/10 transition-colors group">
                       <td className="px-6 py-4 text-center font-medium text-mesaninas-green/80">
                         {formatDate(orc.dataEvento)}
                       </td>
                       <td className="px-6 py-4">
                         <div className="font-medium text-mesaninas-green">{orc.clienteNome || 'Cliente Desconhecido'}</div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="text-sm text-mesaninas-green/80">
                            {orc.nomeEvento || 'Evento não nomeado'}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                             {orc.numConvidados} pax
                          </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                         {getProjectStatusBadge(orc.status)}
                       </td>
                       <td className="px-6 py-4 text-center">
                         {getPaymentBadge(orc.status, orc.statusPagamento)}
                       </td>
                    </tr>
                 ))
              )}
            </tbody>
          </table>

          {/* MOBILE CARDS */}
          <div className="lg:hidden flex flex-col gap-4">
             {proximosEventos.length === 0 ? (
                 <div className="p-8 text-center text-mesaninas-green/50 text-sm border border-mesaninas-creme rounded-xl">
                   Nenhum evento próximo agendado.
                 </div>
               ) : (
                 proximosEventos.map((orc) => (
                    <div key={orc.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                       <div className="flex justify-between items-start gap-2 border-b border-mesaninas-creme/50 pb-3 mb-1">
                         <div>
                            <div className="text-[10px] uppercase font-bold text-mesaninas-green/50 mb-0.5">Cliente</div>
                            <div className="font-bold text-mesaninas-green leading-tight">{orc.clienteNome || 'Cliente Desconhecido'}</div>
                            <div className="text-xs text-mesaninas-green/80 mt-1">{orc.nomeEvento || 'Evento não nomeado'}</div>
                         </div>
                         <div className="flex flex-col items-end gap-2 shrink-0">
                            {getProjectStatusBadge(orc.status)}
                            {getPaymentBadge(orc.status, orc.statusPagamento)}
                         </div>
                       </div>
                       <div className="flex items-center gap-2 text-sm text-mesaninas-green/70">
                         <CalendarCheck className="w-4 h-4 opacity-50" />
                         {formatDate(orc.dataEvento)} • {orc.numConvidados} pax
                       </div>
                    </div>
                 ))
               )}
          </div>
        </div>
      </div>
    </div>
  );
}
