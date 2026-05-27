import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Plus, 
  ChevronLeft, ChevronRight, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Transacao } from '../types';
import Button from '../components/Button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell
} from 'recharts';

export default function Financeiro() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | '30days' | 'year'>('month');
  
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [transacoesManuais, setTransacoesManuais] = useState<Transacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Options
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<Transacao | null>(null);

  // Form
  const [tipo, setTipo] = useState<'Receita' | 'Despesa'>('Receita');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState<'Pago' | 'Pendente'>('Pago');

  const categoriasReceita = ['Evento', 'Consultoria', 'Venda Direta', 'Rendimento', 'Outros'];
  const categoriasDespesa = [
    'Fornecedor', 
    'Combustível', 
    'Pedágio', 
    'Ajudantes / Diárias', 
    'Aluguel de Equipamento', 
    'Logística / Frete', 
    'Custo Fixo', 
    'Impostos', 
    'Marketing', 
    'Folha de Pagamento', 
    'Outros'
  ];

  const [configGerais, setConfigGerais] = useState<any>(null);

  useEffect(() => {
    setIsLoading(true);
    let loadedOrc = false;
    let loadedTrans = false;
    let loadedConfig = false;

    const checkLoaded = () => {
      if (loadedOrc && loadedTrans && loadedConfig) setIsLoading(false);
    };

    const unsubConfig = onSnapshot(doc(db, 'configuracoes', 'gerais'), (docSnap) => {
      if (docSnap.exists()) {
        setConfigGerais(docSnap.data());
      }
      loadedConfig = true;
      checkLoaded();
    }, (error) => {
      console.error('Erro ao carregar configurações', error);
      loadedConfig = true;
      checkLoaded();
    });

    const unsubOrc = onSnapshot(collection(db, 'orcamentos'), (snapshot) => {
      const orcs: Orcamento[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const s = data.status?.toLowerCase();
        // Apenas orçamentos aprovados/concluídos geram receitas
        if (s === 'aprovado' || s === 'entregue' || s === 'concluido' || s === 'em negociação' || s === 'enviado') {
            if (s === 'aprovado' || s === 'entregue' || s === 'concluido') {
              orcs.push({ id: doc.id, ...data } as Orcamento);
            }
        }
      });
      setOrcamentos(orcs);
      loadedOrc = true;
      checkLoaded();
    }, (error) => {
      console.error('Erro ao carregar orçamentos', error);
      loadedOrc = true;
      checkLoaded();
    });

    const unsubTrans = onSnapshot(collection(db, 'transacoes'), (snapshot) => {
      const trans: Transacao[] = [];
      snapshot.forEach((doc) => {
        trans.push({ id: doc.id, ...doc.data() } as Transacao);
      });
      setTransacoesManuais(trans);
      loadedTrans = true;
      checkLoaded();
    }, (error) => {
      console.error('Erro ao carregar transações', error);
      loadedTrans = true;
      checkLoaded();
    });

    return () => { unsubOrc(); unsubTrans(); unsubConfig(); };
  }, []);

  const baseTransacoes = useMemo(() => {
    const list: Transacao[] = [];
    orcamentos.forEach(orc => {
       const dataTransacao = orc.dataEvento || (orc.createdAt ? new Date(orc.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
       const statusTransacao = orc.statusPagamento === 'Pago' ? 'Pago' : 'Pendente';
       const eventoNome = `Evento: ${orc.clienteNome || ''} ${orc.nomeEvento || ''}`.trim();

       // 1. Receita (Valor de Venda)
       list.push({
         id: `orc_${orc.id}`,
         data: dataTransacao,
         descricao: eventoNome,
         categoria: 'Evento',
         tipo: 'Receita',
         valor: orc.valorVenda || 0,
         status: statusTransacao,
         createdAt: orc.createdAt
       });

       // 2. Despesa - Custo Alimentos / Insumos
       if (orc.custoAlimentos && orc.custoAlimentos > 0) {
          list.push({
             id: `orc_desp_alim_${orc.id}`,
             data: dataTransacao,
             descricao: `Insumos: ${eventoNome}`,
             categoria: 'Fornecedor',
             tipo: 'Despesa',
             valor: orc.custoAlimentos,
             status: statusTransacao,
             createdAt: orc.createdAt
          });
       }

       // 3. Despesa - Custos Extras
       if (orc.custosExtras && orc.custosExtras.length > 0) {
          orc.custosExtras.forEach((extra, idx) => {
             if (Number(extra.valor) > 0) {
                list.push({
                   id: `orc_desp_ext_${orc.id}_${idx}`,
                   data: dataTransacao,
                   descricao: `Custos Op. (${extra.descricao || 'Geral'}): ${eventoNome}`,
                   categoria: extra.descricao || 'Outros',
                   tipo: 'Despesa',
                   valor: Number(extra.valor),
                   status: statusTransacao,
                   createdAt: orc.createdAt
                });
             }
          });
       }

       // 4. Despesa - Impostos
       const currentAliquota = orc.aliquotaNF !== undefined ? orc.aliquotaNF : Number(configGerais?.aliquotaNF || 0);
       if (currentAliquota > 0) {
          const custoTotal = (orc.custoAlimentos || 0) + (orc.custosExtras?.reduce((sum, e) => sum + Number(e.valor || 0), 0) || 0);
          const margem = orc.margemLucro !== undefined ? orc.margemLucro : Number(configGerais?.margemLucro || 20);
          
          const somaPercentuais = (margem / 100) + (currentAliquota / 100);
          const fatorDivisor = somaPercentuais < 1 ? (1 - somaPercentuais) : 1;
          const valorVendaSugerido = custoTotal / fatorDivisor;
          const valorImposto = valorVendaSugerido * (currentAliquota / 100);

          if (valorImposto > 0) {
             list.push({
                id: `orc_imposto_${orc.id}`,
                data: dataTransacao,
                descricao: `Impostos NF (${currentAliquota}%): ${eventoNome}`,
                categoria: 'Impostos',
                tipo: 'Despesa',
                valor: valorImposto,
                status: statusTransacao,
                createdAt: orc.createdAt
             });
          }
       }
    });
    return [...transacoesManuais, ...list];
  }, [orcamentos, transacoesManuais, configGerais]);

  const allTransacoes = useMemo(() => {
    const list = baseTransacoes;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return list.filter(t => {
      if (!t.data) return false;
      const [yearStr, monthStr, dayStr] = t.data.split('-');
      const yearVal = parseInt(yearStr, 10);
      const monthVal = parseInt(monthStr, 10);
      const dayVal = parseInt(dayStr || '1', 10);
      
      const tDate = new Date(yearVal, monthVal - 1, dayVal);

      if (selectedPeriod === 'month') {
        return yearVal === selectedYear && monthVal === selectedMonth + 1;
      } else if (selectedPeriod === '30days') {
        const diffTime = startOfToday.getTime() - tDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      } else if (selectedPeriod === 'year') {
        return yearVal === now.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [orcamentos, transacoesManuais, selectedPeriod, selectedYear, selectedMonth]);

  // KPIs calculados sobre o período selecionado
  const receitasBruta = useMemo(() => {
    return allTransacoes
      .filter(t => t.tipo === 'Receita' && t.status === 'Pago')
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [allTransacoes]);

  const custoTotal = useMemo(() => {
    return allTransacoes
      .filter(t => t.tipo === 'Despesa' && t.status === 'Pago')
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [allTransacoes]);

  const lucroLiquido = receitasBruta - custoTotal;

  const margemLucroMedia = useMemo(() => {
    if (receitasBruta === 0) return 0;
    return (lucroLiquido / receitasBruta) * 100;
  }, [receitasBruta, lucroLiquido]);

  // Gráfico de Barras: Comparativo mensal de entradas vs saídas do ano
  const barChartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map((month) => ({
      name: month,
      Entradas: 0,
      Saídas: 0,
    }));

    const listForYear: Transacao[] = baseTransacoes;

    const targetYear = selectedPeriod === 'year' ? new Date().getFullYear() : selectedYear;

    listForYear.forEach(t => {
      if (!t.data || t.status !== 'Pago') return;
      const [yearStr, monthStr] = t.data.split('-');
      const yearVal = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      if (yearVal === targetYear && monthIdx >= 0 && monthIdx < 12) {
        if (t.tipo === 'Receita') {
          data[monthIdx].Entradas += Number(t.valor);
        } else {
          data[monthIdx].Saídas += Number(t.valor);
        }
      }
    });

    return data;
  }, [baseTransacoes, selectedYear, selectedPeriod]);

  // Gráfico de Rosca: Custos Operacionais
  const donutChartData = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};

    allTransacoes.forEach(t => {
      if (t.tipo === 'Despesa' && t.status === 'Pago') {
        let cat = t.categoria || 'Outros';
        if (cat === 'Ajudantes / Diárias') cat = 'Equipe';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.valor);
      }
    });

    return Object.keys(categoryTotals).map(name => ({
      name: name,
      value: categoryTotals[name]
    }));
  }, [allTransacoes]);

  const PIE_COLORS = ['#00382b', '#86C29C', '#F4A261', '#E76F51', '#2A9D8F', '#E6A15C', '#E9C46A', '#DDA15E', '#9B2226'];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  const renderTooltipFormatter = (value: number) => {
    return [formatCurrency(value), ''];
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const getMonthName = (month: number) => {
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return names[month];
  };

  const getBadgeType = (t: Transacao) => {
    if (t.tipo === 'Receita') {
      return { label: 'Receita', classes: 'bg-green-100 text-green-700 border border-green-200/50' };
    }
    if (t.categoria === 'Fornecedor') {
      return { label: 'Custo Insumo', classes: 'bg-blue-100 text-blue-700 border border-blue-200/50' };
    }
    return { label: 'Custo Extra', classes: 'bg-amber-100 text-amber-700 border border-amber-200/50' };
  };

  const resetForm = () => {
    setTipo('Receita');
    setDescricao('');
    setValor('');
    setData(new Date().toISOString().split('T')[0]);
    setCategoria('');
    setStatus('Pago');
    setEditingItem(null);
  };

  const handleOpenModal = (t: 'Receita' | 'Despesa') => {
    resetForm();
    setTipo(t);
    setIsModalOpen(true);
  };

  const handleEdit = (t: Transacao) => {
    if (t.id.startsWith('orc_')) {
       alert("Esta é uma transação vinculada a um evento. Altere-a através do módulo de Orçamentos.");
       return;
    }
    setEditingItem(t);
    setTipo(t.tipo);
    setDescricao(t.descricao);
    setValor(t.valor.toString());
    setData(t.data);
    setCategoria(t.categoria);
    setStatus(t.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (t: Transacao) => {
    if (t.id.startsWith('orc_')) {
       alert("Esta transação é vinculada a um Orçamento. Você não pode excluí-la por aqui.");
       return;
    }
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
       await deleteDoc(doc(db, 'transacoes', t.id));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        tipo,
        descricao,
        valor: Number(valor),
        data,
        categoria: categoria || 'Outros',
        status
      };

      if (editingItem) {
        await updateDoc(doc(db, 'transacoes', editingItem.id), {
          ...payload
        });
      } else {
        await addDoc(collection(db, 'transacoes'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar transação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f4efdc] lg:bg-transparent min-h-screen">
      
      <div className="flex flex-col gap-6 lg:p-0">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant={selectedPeriod === 'month' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => setSelectedPeriod('month')}
            >
              Este Mês
            </Button>
            <Button 
              variant={selectedPeriod === '30days' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => setSelectedPeriod('30days')}
            >
              Últimos 30 dias
            </Button>
            <Button 
              variant={selectedPeriod === 'year' ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => setSelectedPeriod('year')}
            >
              Este Ano
            </Button>
          </div>

          {selectedPeriod === 'month' && (
            <div className="flex items-center bg-white rounded-lg shadow-sm p-1 border border-mesaninas-creme/80 w-fit">
              <Button 
                variant="outline"
                size="sm"
                className="p-1 px-2 h-8 border-none hover:bg-mesaninas-creme/50"
                onClick={handlePrevMonth}
              >
                 <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-6 py-1 min-w-[140px] text-center font-bold text-mesaninas-green text-xs whitespace-nowrap">
                 {getMonthName(selectedMonth).toUpperCase()} {selectedYear}
              </div>
              <Button 
                variant="outline"
                size="sm"
                className="p-1 px-2 h-8 border-none hover:bg-mesaninas-creme/50"
                onClick={handleNextMonth}
              >
                 <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* GRID DE KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Receita Bruta */}
          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-[#86C29C] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60 uppercase">Receita Bruta</span>
              <div className="p-1.5 bg-green-100/50 rounded-md">
                 <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-serif text-mesaninas-green">
                {formatCurrency(receitasBruta)}
              </div>
              <p className="text-[9px] text-mesaninas-green/50 mt-1 uppercase font-semibold">Total de entradas confirmadas</p>
            </div>
          </div>

          {/* Card 2: Custo Total */}
          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-red-200 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60 uppercase">Custo Total</span>
              <div className="p-1.5 bg-red-100/50 rounded-md">
                 <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-serif text-mesaninas-green">
                {formatCurrency(custoTotal)}
              </div>
              <p className="text-[9px] text-mesaninas-green/50 mt-1 uppercase font-semibold">Insumos + Custos Operacionais</p>
            </div>
          </div>

          {/* Card 3: Lucro Líquido */}
          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-mesaninas-yellow/50 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60 uppercase">Lucro Líquido</span>
              <div className={`p-1.5 rounded-md ${lucroLiquido >= 0 ? 'bg-emerald-100/50' : 'bg-rose-100/50'}`}>
                 <DollarSign className={`w-4 h-4 ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-500'}`} />
              </div>
            </div>
            <div>
              <div className={`text-2xl font-bold font-serif ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(lucroLiquido)}
              </div>
              <p className="text-[9px] text-mesaninas-green/50 mt-1 uppercase font-semibold">Resultado operacional líquido</p>
            </div>
          </div>

          {/* Card 4: Margem de Lucro Média (%) */}
          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-mesaninas-green/60 uppercase">Margem de Lucro</span>
              <div className="p-1.5 bg-blue-100/50 rounded-md">
                 <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-serif text-mesaninas-green">
                {margemLucroMedia.toFixed(1)}%
              </div>
              <p className="text-[9px] text-mesaninas-green/50 mt-1 uppercase font-semibold">Eficiência lucrativa geral</p>
            </div>
          </div>
        </div>

        {/* GRÁFICOS PRINCIPAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico de Barras: Comparativo Receitas vs Despesas */}
          <div className="lg:col-span-2 bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 flex flex-col justify-between min-h-[350px]">
             <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00382b]/70 mb-1">Comparativo Mensal</h3>
                <p className="text-[10px] text-mesaninas-green/60 mb-4 font-medium">Entradas (Receitas Pagas) vs Saídas (Custos Pagos) por mês no ano de {selectedPeriod === 'year' ? new Date().getFullYear() : selectedYear}.</p>
             </div>
             <div className="w-full h-[260px] text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4efdc" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                    <Tooltip formatter={renderTooltipFormatter} cursor={{ fill: 'rgba(244, 239, 220, 0.4)' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="Entradas" fill="#86C29C" radius={[4, 4, 0, 0]} name="Receitas" />
                    <Bar dataKey="Saídas" fill="#EF4444" opacity={0.7} radius={[4, 4, 0, 0]} name="Custos" />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Gráfico de Rosca/Donut: Distribuição de Custos Operacionais */}
          <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm p-5 flex flex-col min-h-[350px]">
             <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00382b]/70 mb-1">Distribuição de Custos</h3>
                <p className="text-[10px] text-mesaninas-green/60 mb-4 font-medium">Classificação proporcional detalhada de custos pagos no período selecionado.</p>
             </div>
             
             {donutChartData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                   <p className="text-xs text-mesaninas-green/50">Nenhum custo registrado para o período.</p>
                </div>
             ) : (
                <div className="flex-1 flex flex-col justify-between">
                   <div className="w-full h-[180px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                               data={donutChartData}
                               cx="50%"
                               cy="50%"
                               innerRadius={55}
                               outerRadius={80}
                               paddingAngle={3}
                               dataKey="value"
                            >
                               {donutChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                               ))}
                            </Pie>
                            <Tooltip formatter={renderTooltipFormatter} />
                         </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-[10px] uppercase font-bold text-mesaninas-green/60">Custos</span>
                         <span className="text-sm font-bold text-mesaninas-green">{formatCurrency(custoTotal)}</span>
                      </div>
                   </div>

                   {/* Legenda do Donut */}
                   <div className="grid grid-cols-2 gap-2 mt-4 max-h-[100px] overflow-y-auto text-[10px] text-mesaninas-green/80">
                      {donutChartData.map((item, index) => {
                         const percent = custoTotal > 0 ? (item.value / custoTotal) * 100 : 0;
                         return (
                            <div key={item.name} className="flex items-center gap-1.5 truncate">
                               <span 
                                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
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
        </div>

        {/* TABELA DE LANÇAMENTOS RECENTES */}
        <div className="space-y-4">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
              <div>
                 <h3 className="text-sm font-bold uppercase tracking-wider text-[#00382b]/85">Lançamentos Recentes</h3>
                 <p className="text-xs text-mesaninas-green/70">Extrato detalhado das movimentações financeiras de caixa.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <Button 
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenModal('Receita')}
                    className="flex-1 sm:flex-none uppercase text-xs tracking-wider"
                 >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Receita</span>
                 </Button>
                 <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal('Despesa')}
                    className="flex-1 sm:flex-none uppercase text-xs tracking-wider font-bold"
                 >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Nova Despesa</span>
                 </Button>
              </div>
           </div>

           <div className="bg-white border text-mesaninas-green border-mesaninas-creme rounded-xl shadow-sm flex flex-col overflow-hidden w-full relative min-h-[400px]">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                   <div className="w-8 h-8 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse text-sm">
                   {/* Cabeçalho sticky com sombra */}
                   <thead className="bg-[#f4efdc]/30 text-[10px] uppercase tracking-wider font-bold text-[#00382b]/60 sticky top-0 z-10 shadow-sm border-b border-[#f4efdc]/50">
                     <tr>
                       <th className="px-6 py-3 font-semibold whitespace-nowrap">Data</th>
                       <th className="px-6 py-3 font-semibold">Descrição</th>
                       <th className="px-6 py-3 font-semibold">Categoria</th>
                       <th className="px-6 py-3 font-semibold text-center">Tipo</th>
                       <th className="px-6 py-3 font-semibold text-right">Valor (R$)</th>
                       <th className="px-6 py-3 font-semibold text-center">Status</th>
                       <th className="px-6 py-3 font-semibold text-center">Ações</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-mesaninas-creme/40">
                     {allTransacoes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center text-mesaninas-green/50 text-sm">
                            Nenhuma transação encontrada no período.
                          </td>
                        </tr>
                     ) : (
                       allTransacoes.map((t) => {
                         const badge = getBadgeType(t);
                         return (
                           <tr key={t.id} className="hover:bg-mesaninas-creme/20 transition-colors group">
                             <td className="px-6 py-4 whitespace-nowrap text-mesaninas-green/80">{formatDate(t.data)}</td>
                             <td className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-mesaninas-green max-w-[200px] truncate" title={t.descricao}>
                                <div className="flex items-center gap-2">
                                   <span className="group-hover:text-mesaninas-green/80 transition-colors">{t.descricao}</span>
                                   {t.id.startsWith('orc_') && (
                                     <span className="inline-block px-1.5 py-0.5 bg-mesaninas-creme rounded text-[9px] uppercase tracking-wider text-mesaninas-green/60 font-semibold">Automático</span>
                                   )}
                                </div>
                             </td>
                             <td className="px-6 py-4 text-mesaninas-green/80 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">
                                {t.categoria?.toUpperCase()}
                             </td>
                             <td className="px-6 py-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${badge.classes}`}>
                                   {badge.label}
                                </span>
                             </td>
                             <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${t.tipo === 'Receita' ? 'text-green-600' : 'text-red-500'}`}>
                               {t.tipo === 'Receita' ? '+ ' : '- '}
                               {formatCurrency(Number(t.valor))}
                             </td>
                             <td className="px-6 py-4 text-center">
                                {t.status === 'Pago' ? (
                                   <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider leading-none bg-green-100 text-green-700">
                                     Pago
                                   </span>
                                ) : (
                                   <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider leading-none bg-orange-100 text-orange-600">
                                     Pendente
                                   </span>
                                )}
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={() => handleEdit(t)}
                                     className="p-1.5 text-mesaninas-green/50 hover:text-mesaninas-yellow hover:bg-mesaninas-yellow/10 rounded-md transition-colors"
                                     title="Editar"
                                   >
                                      <Edit2 className="w-4 h-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleDelete(t)}
                                     className="p-1.5 text-mesaninas-green/50 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                     title="Excluir"
                                   >
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                </div>
                             </td>
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
              <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight">
                   {editingItem ? 'Editar Lançamento' : `Nova ${tipo}`}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">Registre as movimentações no caixa.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-2xl font-bold p-2 h-12 w-12 flex items-center justify-center -mr-2 transition-colors"
                title="Fechar"
              >×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 bg-white">
              <form onSubmit={handleSave} className="w-full max-w-5xl mx-auto space-y-6" id="financeiroForm">
                
                <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Detalhes da Transação</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="col-span-1 md:col-span-2">
                       <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Tipo de Lançamento</label>
                       <select
                         value={tipo}
                         onChange={e => setTipo(e.target.value as any)}
                         className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                       >
                         <option value="Receita">Receita (Entrada)</option>
                         <option value="Despesa">Despesa (Saída)</option>
                       </select>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Descrição*
                      </label>
                      <input
                        type="text"
                        required
                        value={descricao}
                        onChange={e => setDescricao(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                        placeholder="Ex: Pagamento Fornecedor X"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Valor (R$)*
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Data (Venc/Pagam)*
                      </label>
                      <input
                        type="date"
                        required
                        value={data}
                        onChange={e => setData(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                       <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Categoria</label>
                       <select
                         required
                         value={categoria}
                         onChange={e => setCategoria(e.target.value)}
                         className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                       >
                         <option value="">Selecione...</option>
                         {(tipo === 'Receita' ? categoriasReceita : categoriasDespesa).map(c => (
                            <option key={c} value={c}>{c}</option>
                         ))}
                       </select>
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                       <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Status</label>
                       <select
                         value={status}
                         onChange={e => setStatus(e.target.value as any)}
                         className={`w-full px-3 h-12 lg:h-10 border rounded-md text-sm font-bold focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 ${status === 'Pago' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 bg-opacity-50 text-orange-600 border-orange-200'}`}
                       >
                         <option value="Pendente">Pendente</option>
                         <option value="Pago">Pago</option>
                       </select>
                    </div>

                  </div>
                </div>

              </form>
            </div>
             
            <div className="px-6 py-4 border-t border-mesaninas-creme/80 bg-white flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="financeiroForm"
                disabled={isSubmitting}
                variant={tipo === 'Receita' ? 'primary' : 'outline'}
                size="sm"
                className={tipo === 'Receita' ? 'bg-[#86C29C] border-transparent text-white' : 'bg-red-500 hover:bg-red-600 text-white border-transparent'}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
