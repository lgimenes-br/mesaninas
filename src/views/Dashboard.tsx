import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Cliente, ItemEstoque, Transacao } from '../types';
import { Users, Clock, CalendarCheck, DollarSign, Plus, AlertTriangle, ChefHat, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewType } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import Button from '../components/Button';

export default function Dashboard({ onNavigate }: { onNavigate?: (view: ViewType) => void }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientesTotais, setClientesTotais] = useState<number>(0);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [despesasDb, setDespesasDb] = useState<any[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
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

    const unsubTrans = onSnapshot(collection(db, 'transacoes'), (snapshot) => {
      const docs: Transacao[] = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() } as Transacao);
      });
      setTransacoes(docs);
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
      unsubTrans();
      unsubConfig();
    };
  }, []);

  // KPIs
  const orcamentosPendentes = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'rascunho' || s === 'enviado' || s === 'pendente';
  }).length;

  const eventosConfirmados = orcamentos.filter(o => {
    const s = o.status?.toLowerCase();
    return s === 'aprovado' || s === 'entregue' || s === 'concluido' || s === 'recusado';
  });

  const receitaConfirmada = eventosConfirmados.reduce((acc, o) => acc + (Number(o.valorVenda) || 0), 0);

  const orcamentosEnviados = orcamentos.filter(o => o.status?.toLowerCase() === 'enviado').length;
  const taxaConversao = (orcamentosEnviados + eventosConfirmados.length) > 0 
    ? (eventosConfirmados.length / (orcamentosEnviados + eventosConfirmados.length)) * 100 
    : 0;

  // Próximos Eventos
  const proximosEventos = orcamentos
    .filter(o => o.status?.toLowerCase() === 'enviado' || o.status?.toLowerCase() === 'aprovado' || o.status?.toLowerCase() === 'recusado')
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

  // Sales Funnel Data
  const funnelData = useMemo(() => {
    const counts = {
      'Rascunho': 0,
      'Enviado': 0,
      'Em Negociação': 0,
      'Aprovado': 0
    };

    orcamentos.forEach(o => {
      const s = o.status?.toLowerCase();
      if (s === 'rascunho') {
        counts['Rascunho']++;
      } else if (s === 'enviado') {
        counts['Enviado']++;
      } else if (s === 'em negociação' || s === 'em aberto' || s === 'pendente') {
        counts['Em Negociação']++;
      } else if (s === 'aprovado' || s === 'entregue' || s === 'concluido' || s === 'recusado') {
        counts['Aprovado']++;
      }
    });

    return Object.keys(counts).map(key => ({
      name: key,
      Quantidade: counts[key as keyof typeof counts]
    }));
  }, [orcamentos]);

  const isFunnelEmpty = useMemo(() => {
    return funnelData.every(item => item.Quantidade === 0);
  }, [funnelData]);

  // Expenses Donut Data
  const despesasPorCategoria = useMemo(() => {
    const totals: { [key: string]: number } = {};
    let totalValue = 0;
    
    transacoes.forEach(t => {
      if (t.tipo === 'Despesa') {
        const cat = t.categoria || 'Outros';
        totals[cat] = (totals[cat] || 0) + Number(t.valor);
        totalValue += Number(t.valor);
      }
    });

    return {
      data: Object.keys(totals).map(name => ({
        name: name,
        value: totals[name]
      })),
      total: totalValue
    };
  }, [transacoes]);

  const isDonutEmpty = useMemo(() => {
    return despesasPorCategoria.data.length === 0;
  }, [despesasPorCategoria]);

  // Top 5 Dishes
  const pratosCounts = useMemo(() => {
    const counts: { [key: string]: { nome: string; quantidade: number } } = {};
    eventosConfirmados.forEach(orc => {
      if (orc.pratosSelecionados && Array.isArray(orc.pratosSelecionados)) {
        orc.pratosSelecionados.forEach(p => {
          if (p) {
            if (typeof p === 'string') {
              const nome = p.trim();
              if (nome) {
                if (!counts[nome]) {
                  counts[nome] = { nome, quantidade: 0 };
                }
                counts[nome].quantidade += 1;
              }
            } else if (p && typeof p === 'object' && p.nome) {
              const nome = p.nome.trim();
              const id = p.pratoId || nome;
              if (nome) {
                if (!counts[id]) {
                  counts[id] = { nome, quantidade: 0 };
                }
                counts[id].quantidade += 1;
              }
            }
          }
        });
      }
    });

    return Object.values(counts)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, [eventosConfirmados]);

  const DONUT_COLORS = ['#00382b', '#86C29C', '#e7e873', '#bce8ea', '#f4bbab', '#e2b49a', '#5a9e87', '#b0cfc8'];

  const isTopDishesEmpty = useMemo(() => {
    return pratosCounts.length === 0;
  }, [pratosCounts]);

  if (isLoading) {
    return (
      <div className="flex w-full h-full items-center justify-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 pb-6">
      
      {/* Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-mesaninas-creme/50 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-mesaninas-green">Olá, {firstName}!</h1>
          <p className="text-sm text-mesaninas-green/70 mt-1">Aqui está o resumo estratégico da sua operação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => onNavigate && onNavigate('orcamentos')}>
            <Plus size={18} /> Novo Orçamento
          </Button>
          <Button onClick={() => onNavigate && onNavigate('financeiro')}>
            <Plus size={18} /> Lançar Despesa
          </Button>
          <Button onClick={() => onNavigate && onNavigate('clientes')}>
            <Plus size={18} /> Novo Cliente
          </Button>
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

      {/* Novos Widgets Estratégicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Funil de Vendas */}
        <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 h-81 flex flex-col">
          <div>
            <h3 className="font-serif font-bold text-lg text-mesaninas-green">Funil de Vendas</h3>
            <p className="text-[10px] text-mesaninas-green/60 mb-4 font-medium uppercase tracking-wider">Quantidade de orçamentos por status</p>
          </div>
          {isFunnelEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs text-mesaninas-green/50">Aguardando dados de orçamentos...</p>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-0 relative text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={funnelData}
                  margin={{ top: 10, right: 20, left: 25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4efdc" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#00382b' }} />
                  <Tooltip cursor={{ fill: '#f4efdc', opacity: 0.3 }} />
                  <Bar dataKey="Quantidade" fill="#00382b" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => {
                      const colors = ['#f4bbab', '#bce8ea', '#e7e873', '#86C29C'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Raio-X de Custos */}
        <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 h-81 flex flex-col">
          <div>
            <h3 className="font-serif font-bold text-lg text-mesaninas-green">Raio-X de Custos</h3>
            <p className="text-[10px] text-mesaninas-green/60 mb-4 font-medium uppercase tracking-wider">Distribuição de despesas por categoria</p>
          </div>
          {isDonutEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs text-mesaninas-green/50">Aguardando dados de despesas...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="w-full h-[140px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {despesasPorCategoria.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] uppercase font-bold text-mesaninas-green/60">Custos</span>
                  <span className="text-xs font-bold text-mesaninas-green">{formatCurrency(despesasPorCategoria.total)}</span>
                </div>
              </div>

              {/* Custom Legend */}
              <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-[80px] overflow-y-auto text-[9px] text-mesaninas-green/80">
                {despesasPorCategoria.data.map((item, index) => {
                  const percent = despesasPorCategoria.total > 0 ? (item.value / despesasPorCategoria.total) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-1 truncate" title={item.name}>
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      />
                      <span className="truncate font-medium">{item.name?.toUpperCase()}:</span>
                      <span className="font-bold shrink-0">{percent.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top 5 Pratos */}
        <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 h-81 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-serif font-bold text-lg text-mesaninas-green flex items-center gap-2">
                 <ChefHat className="w-5 h-5 text-mesaninas-yellow shrink-0" />
                 <span>Top 5 Pratos</span>
              </h3>
              <p className="text-[10px] text-mesaninas-green/60 font-medium uppercase tracking-wider">Pratos mais requisitados em eventos aprovados</p>
            </div>
          </div>
          {isTopDishesEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs text-mesaninas-green/50">Aguardando dados de pratos em eventos...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
              {pratosCounts.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-mesaninas-creme/25 rounded-lg border border-mesaninas-creme/30 hover:border-mesaninas-yellow/40 transition-all">
                   <div className="flex items-center gap-2 max-w-[70%]">
                      <div className="w-6 h-6 flex items-center justify-center bg-mesaninas-green text-white text-[10px] font-bold rounded-full shrink-0">
                         #{idx + 1}
                      </div>
                      <span className="text-xs font-bold text-mesaninas-green truncate uppercase tracking-wider">{item.nome}</span>
                   </div>
                   <span className="px-2.5 py-1 bg-mesaninas-green/10 text-mesaninas-green rounded-full text-[9px] font-bold shrink-0 uppercase">
                      {item.quantidade}x em eventos
                   </span>
                </div>
              ))}
            </div>
          )}
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
                         <div className="font-bold uppercase tracking-wider text-xs text-mesaninas-green">{orc.clienteNome || 'Cliente Desconhecido'}</div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="font-bold uppercase tracking-wider text-xs text-mesaninas-green/80">
                            {orc.nomeEvento || 'Evento não nomeado'}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[10px] font-bold uppercase tracking-wider">
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
