import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Cliente, ItemEstoque } from '../types';
import { Users, Clock, CalendarCheck, DollarSign, Plus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewType } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function Dashboard({ onNavigate }: { onNavigate?: (view: ViewType) => void }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientesTotais, setClientesTotais] = useState<number>(0);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [despesasDb, setDespesasDb] = useState<any[]>([]);
  const [configGerais, setConfigGerais] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile } = useAuth(); 

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

    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (snapshot) => {
      const docs: ItemEstoque[] = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() } as ItemEstoque);
      });
      setEstoque(docs);
    });

    const unsubDespesas = onSnapshot(collection(db, 'despesas'), (snapshot) => {
      const docs: any[] = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setDespesasDb(docs);
    });

    const unsubConfig = onSnapshot(doc(db, 'configuracoes', 'gerais'), (docSnap) => {
      if (docSnap.exists()) {
        setConfigGerais(docSnap.data());
      }
    });

    return () => {
      unsubClientes();
      unsubOrcamentos();
      unsubEstoque();
      unsubDespesas();
      unsubConfig();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex w-full h-full items-center justify-center">
        <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  // KPIs
  const orcamentosPendentes = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'rascunho' || s === 'enviado' || s === 'pendente';
  }).length;

  const eventosConfirmados = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'aprovado' || s === 'entregue' || s === 'concluido';
  });

  const receitaConfirmada = eventosConfirmados.reduce((acc, o) => acc + (Number(o.valorVenda) || 0), 0);

  const orcamentosEnviados = orcamentos.filter(o => o.status?.toLowerCase() === 'enviado').length;
  const taxaConversao = (orcamentosEnviados + eventosConfirmados.length) > 0 
    ? (eventosConfirmados.length / (orcamentosEnviados + eventosConfirmados.length)) * 100 
    : 0;

  // Próximos Eventos
  const proximosEventos = orcamentos
    .filter(o => o.status?.toLowerCase() === 'enviado' || o.status?.toLowerCase() === 'aprovado')
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
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green uppercase">RASCUNHO</span>;
        case 'enviado': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#bce8ea] text-mesaninas-green uppercase">ENVIADO</span>;
        case 'aprovado': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#e7e873] text-mesaninas-green uppercase">APROVADO</span>;
        case 'entregue': 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-green text-white uppercase">ENTREGUE</span>;
        default: 
           return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green uppercase">{status || 'N/A'}</span>;
     }
  };

  const firstName = userProfile?.nome ? userProfile.nome.split(' ')[0] : 'Admin';

  // Chart Data
  const getChartData = () => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthYear = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
        
        let receitas = 0;
        let despesas = 0;
        
        orcamentos.forEach(o => {
            if (!o.dataEvento) return;
            const [year, month] = o.dataEvento.split('-');
            if (parseInt(month) === d.getMonth() + 1 && parseInt(year) === d.getFullYear()) {
            if (['aprovado', 'entregue', 'concluido'].includes(o.status?.toLowerCase() || '')) {
                receitas += Number(o.valorVenda) || 0;
                despesas += Number(o.custoTotal) || 0; 
            }
            }
        });
        
        data.push({
            name: monthYear.charAt(0).toUpperCase() + monthYear.slice(1),
            Receitas: receitas,
            Despesas: despesas
        });
    }
    return data;
  };

  // Alert Logic
  const getAlerts = () => {
    const alerts = [];
    
    // Estoque
    estoque.forEach(item => {
      const min = item.estoqueMinimo || 10;
      if (item.quantidade <= min) {
        alerts.push({ type: 'warning', title: 'Atenção ao Estoque', desc: `${item.nome} está baixo (${item.quantidade} ${item.unidadeMedida}). Mínimo seguro é ${min}.` });
      }
    });

    // Orçamentos Pendentes
    const diasOrcamento = configGerais.alertaOrcamentoDias || 5;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - diasOrcamento);
    orcamentos.forEach(o => {
       if (o.status?.toLowerCase() === 'enviado' && o.createdAt) {
          const createdAt = new Date(o.createdAt);
          if (createdAt < limitDate) {
             alerts.push({ type: 'critical', title: 'Orçamento Pendente', desc: `Proposta para "${o.clienteNome || 'Cliente'}" enviada há mais de ${diasOrcamento} dias sem resposta.` });
          }
       }
    });

    // Despesas Vencendo nos próximos dias
    const diasDespesa = configGerais.alertaDespesaDias || 2;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDespesaDate = new Date(today);
    limitDespesaDate.setDate(limitDespesaDate.getDate() + diasDespesa);
    
    despesasDb.forEach(d => {
       if (d.dataVencimento && d.status !== 'Pago') {
           const [year, month, day] = d.dataVencimento.split('-');
           const valDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
           if (valDate >= today && valDate <= limitDespesaDate) {
              alerts.push({ type: 'critical', title: 'Vencimento Próximo', desc: `Despesa "${d.descricao}" no valor de ${formatCurrency(d.valor)} vence no dia ${d.dataVencimento.split('-').reverse().join('/')}.` });
           } else if (valDate < today) {
              alerts.push({ type: 'critical', title: 'Despesa Atrasada', desc: `Despesa "${d.descricao}" no valor de ${formatCurrency(d.valor)} está vencida desde ${d.dataVencimento.split('-').reverse().join('/')}.` });
           }
       }
    });

    return alerts;
  };

  const alertas = getAlerts();

  return (
    <div className="flex flex-col h-full gap-6 pb-6">
      
      {/* Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-mesaninas-creme/50 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-mesaninas-green">Olá, {firstName}!</h1>
          <p className="text-sm text-mesaninas-green/70 mt-1">Aqui está o resumo estratégico da sua operação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onNavigate && onNavigate('orcamentos')} className="bg-mesaninas-green text-mesaninas-yellow px-4 py-2 rounded-md hover:bg-[#002a20] transition-colors font-bold text-sm shadow-sm flex items-center gap-2">
            <Plus size={18} /> Novo Orçamento
          </button>
          <button onClick={() => onNavigate && onNavigate('financeiro')} className="bg-mesaninas-green text-mesaninas-yellow px-4 py-2 rounded-md hover:bg-[#002a20] transition-colors font-bold text-sm shadow-sm flex items-center gap-2">
            <Plus size={18} /> Lançar Despesa
          </button>
          <button onClick={() => onNavigate && onNavigate('clientes')} className="bg-mesaninas-green text-mesaninas-yellow px-4 py-2 rounded-md hover:bg-[#002a20] transition-colors font-bold text-sm shadow-sm flex items-center gap-2">
            <Plus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Side: 70% */}
        <div className="flex-1 lg:w-[70%] flex flex-col gap-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60">Total Clientes</span>
                <Users className="w-4 h-4 text-mesaninas-yellow" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">{clientesTotais}</div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60">Pedidos Pendentes</span>
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">{orcamentosPendentes}</div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60">Eventos Aprovados</span>
                <CalendarCheck className="w-4 h-4 text-[#bce8ea]" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">{eventosConfirmados.length}</div>
            </div>

            <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60">Conversão de Vendas</span>
                <DollarSign className="w-4 h-4 text-[#00382b]" />
              </div>
              <div className="mt-1 text-2xl font-bold text-mesaninas-green">{taxaConversao.toFixed(1)}%</div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 h-80 flex flex-col">
             <h3 className="font-serif font-bold text-lg text-mesaninas-green mb-4">Saúde Financeira (Últimos 6 Meses)</h3>
             <div className="flex-1 w-full min-h-0 relative">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={6}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#00382b' }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#00382b' }} tickFormatter={(val) => `R$${val/1000}k`} />
                   <Tooltip cursor={{ fill: '#f4efdc', opacity: 0.3 }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }} />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                   <Bar dataKey="Receitas" fill="#00382b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                   <Bar dataKey="Despesas" fill="#c2410c" radius={[4, 4, 0, 0]} maxBarSize={40} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

        </div>

        {/* Right Side: 30% */}
        <div className="lg:w-[30%] flex flex-col">
           <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 flex flex-col h-full min-h-[400px]">
             <h3 className="font-serif font-bold text-lg text-mesaninas-green mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#c2410c]" /> Avisos
             </h3>
             <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                {alertas.length === 0 ? (
                   <div className="text-sm text-mesaninas-green/50 text-center py-8">Tudo certo por aqui! Nenhum alerta pendente.</div>
                ) : (
                   alertas.map((alerta, idx) => (
                      <div key={idx} className={`p-4 rounded-xl shadow-sm border-l-4 ${alerta.type === 'critical' ? 'bg-red-50/50 border-l-[#c2410c]' : 'bg-amber-50/50 border-l-[#e7e873]'} border border-y-mesaninas-creme border-r-mesaninas-creme`}>
                         <div className="font-bold text-mesaninas-green text-xs uppercase tracking-wider mb-1">{alerta.title}</div>
                         <div className="text-xs text-mesaninas-green/80 font-medium">{alerta.desc}</div>
                      </div>
                   ))
                )}
             </div>
           </div>
        </div>

      </div>

      {/* Próximos Eventos */}
      <div className="flex flex-col overflow-hidden bg-white border shadow-sm rounded-xl border-mesaninas-creme mt-2">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10">
          <h3 className="font-serif font-bold text-lg text-mesaninas-green">Próximos Eventos</h3>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[700px]">
            <thead className="bg-[#f4efdc]/30 text-[10px] uppercase tracking-wider font-bold text-[#00382b]/60">
              <tr className="border-b border-[#f4efdc]/50">
                <th className="px-6 py-3 font-semibold text-center w-32">Data</th>
                <th className="px-6 py-3 font-semibold">Cliente</th>
                <th className="px-6 py-3 font-semibold">Evento</th>
                <th className="px-6 py-3 font-semibold text-center w-28">Convidados</th>
                <th className="px-6 py-3 font-semibold text-center w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mesaninas-creme">
              {proximosEventos.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum evento próximo agendado.</td>
                </tr>
              ) : (
                 proximosEventos.map((orc) => (
                    <tr key={orc.id} className="hover:bg-mesaninas-creme/10 transition-colors group">
                       <td className="px-6 py-4 text-center font-bold text-[#00382b]">
                         {formatDate(orc.dataEvento)}
                       </td>
                       <td className="px-6 py-4">
                         <div className="font-bold text-mesaninas-green">{orc.clienteNome || 'Cliente Desconhecido'}</div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="text-sm font-medium text-mesaninas-green/80">
                            {orc.nomeEvento || 'Evento não nomeado'}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                             {orc.numConvidados} pessoas
                          </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                         {getProjectStatusBadge(orc.status)}
                       </td>
                    </tr>
                 ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
