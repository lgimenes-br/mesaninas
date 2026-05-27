import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Plus, Filter, 
  ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Transacao } from '../types';

export default function Financeiro() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
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
  const categoriasDespesa = ['Fornecedor', 'Custo Fixo', 'Impostos', 'Marketing', 'Logística', 'Folha de Pagamento', 'Outros'];

  useEffect(() => {
    setIsLoading(true);
    let loadedOrc = false;
    let loadedTrans = false;

    const checkLoaded = () => {
      if (loadedOrc && loadedTrans) setIsLoading(false);
    };

    const unsubOrc = onSnapshot(collection(db, 'orcamentos'), (snapshot) => {
      const orcs: Orcamento[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const s = data.status?.toLowerCase();
        // Apenas orçamentos aprovados/concluídos geram receitas
        if (s === 'aprovado' || s === 'entregue' || s === 'concluido' || s === 'em negociação' || s === 'enviado') {
           // We'll filter more carefully in useMemo if we want, but let's include approved/concluído for sure
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

    return () => { unsubOrc(); unsubTrans(); };
  }, []);

  const allTransacoes = useMemo(() => {
    const list: Transacao[] = [...transacoesManuais];

    // Integrar orçamentos como receitas
    orcamentos.forEach(orc => {
       list.push({
         id: `orc_${orc.id}`,
         data: orc.dataEvento || (orc.createdAt ? new Date(orc.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
         descricao: `Evento: ${orc.clienteNome || ''} ${orc.nomeEvento || ''}`.trim(),
         categoria: 'Evento',
         tipo: 'Receita',
         valor: orc.valorVenda || 0,
         status: orc.statusPagamento === 'Pago' ? 'Pago' : 'Pendente',
         createdAt: orc.createdAt
      });
    });

    // Filtra pelo mês e ano
    return list.filter(t => {
      if (!t.data) return false;
      const [year, month] = t.data.split('-');
      return parseInt(year) === selectedYear && parseInt(month) === selectedMonth + 1;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [orcamentos, transacoesManuais, selectedYear, selectedMonth]);

  // KPIs
  const receitasMes = allTransacoes.filter(t => t.tipo === 'Receita' && t.status === 'Pago').reduce((acc, t) => acc + Number(t.valor), 0);
  const despesasMes = allTransacoes.filter(t => t.tipo === 'Despesa' && t.status === 'Pago').reduce((acc, t) => acc + Number(t.valor), 0);
  const saldoAtual = receitasMes - despesasMes;

  const aReceber = allTransacoes.filter(t => t.tipo === 'Receita' && t.status === 'Pendente').reduce((acc, t) => acc + Number(t.valor), 0);
  const aPagar = allTransacoes.filter(t => t.tipo === 'Despesa' && t.status === 'Pendente').reduce((acc, t) => acc + Number(t.valor), 0);

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
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
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
        
        {/* CARDS DE RESUMO FINANCEIRO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-mesaninas-green/90 text-white rounded-xl shadow-lg border border-mesaninas-green flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2 opacity-90">
              <span className="text-xs font-bold tracking-wider uppercase">Saldo Atual</span>
              <Wallet className="w-5 h-5 text-mesaninas-creme" />
            </div>
            <div className="mt-1 text-3xl font-bold font-serif">
              {formatCurrency(saldoAtual)}
            </div>
          </div>

          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-[#86C29C] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Receitas do Mês</span>
              <div className="p-1.5 bg-green-100/50 rounded-md">
                 <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="mt-1 text-2xl font-bold text-mesaninas-green group-hover:text-green-700 transition-colors">
              {formatCurrency(receitasMes)}
            </div>
          </div>

          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-red-200 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">Despesas do Mês</span>
              <div className="p-1.5 bg-red-100/50 rounded-md">
                 <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="mt-1 text-2xl font-bold text-mesaninas-green group-hover:text-red-600 transition-colors">
              {formatCurrency(despesasMes)}
            </div>
          </div>

          <div className="p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm flex flex-col justify-between group hover:border-mesaninas-yellow/50 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-mesaninas-green/60">A Receber / A Pagar</span>
              <div className="p-1.5 bg-orange-100/50 rounded-md">
                 <Clock className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <div className="space-y-1">
               <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-mesaninas-green/60">A Receber:</span>
                  <span className="text-green-600">{formatCurrency(aReceber)}</span>
               </div>
               <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-mesaninas-green/60">A Pagar:</span>
                  <span className="text-red-500">{formatCurrency(aPagar)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES E FILTROS */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-2">
           <div className="flex items-center bg-white rounded-lg shadow-sm p-1 border border-mesaninas-creme/80 w-full sm:w-auto">
              <button 
                onClick={handlePrevMonth}
                className="p-2 hover:bg-mesaninas-creme/50 rounded-md transition-colors text-mesaninas-green"
              >
                 <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-6 py-1 min-w-[140px] text-center font-bold text-mesaninas-green whitespace-nowrap">
                 {getMonthName(selectedMonth)} {selectedYear}
              </div>
              <button 
                onClick={handleNextMonth}
                className="p-2 hover:bg-mesaninas-creme/50 rounded-md transition-colors text-mesaninas-green"
              >
                 <ChevronRight className="w-4 h-4" />
              </button>
           </div>
           
           <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                 onClick={() => handleOpenModal('Receita')}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#86C29C] hover:bg-[#72A684] text-white px-4 h-11 rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                 <Plus className="w-4 h-4" />
                 <span>Nova Receita</span>
              </button>
              <button 
                 onClick={() => handleOpenModal('Despesa')}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-600 border border-mesaninas-creme/50 px-4 h-11 rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                 <Plus className="w-4 h-4 shrink-0" />
                 <span>Nova Despesa</span>
              </button>
           </div>
        </div>

        {/* TABELA DE TRANSAÇÕES */}
        <div className="bg-white border text-mesaninas-green border-mesaninas-creme rounded-xl shadow-sm flex flex-col overflow-hidden w-full relative min-h-[400px]">
           {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                <div className="w-8 h-8 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
             </div>
           ) : null}

           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#f4efdc]/30 text-[10px] uppercase tracking-wider font-bold text-[#00382b]/60">
                  <tr className="border-b border-[#f4efdc]/50">
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
                    allTransacoes.map((t) => (
                      <tr key={t.id} className="hover:bg-mesaninas-creme/20 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-mesaninas-green/80">{formatDate(t.data)}</td>
                        <td className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-mesaninas-green max-w-[200px] truncate" title={t.descricao}>
                           <span className="group-hover:text-mesaninas-green/80 transition-colors">{t.descricao}</span>
                           {t.id.startsWith('orc_') && (
                             <span className="ml-2 inline-block px-1.5 py-0.5 bg-mesaninas-creme rounded text-[9px] uppercase tracking-wider text-mesaninas-green/60 tracking-normal normal-case font-normal">Automático</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-mesaninas-green/80 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">{t.categoria?.toUpperCase()}</td>
                        <td className="px-6 py-4 text-center">
                           {t.tipo === 'Receita' ? (
                             <span className="inline-flex p-1 bg-green-100 text-green-600 rounded-md" title="Receita">
                                <ArrowUpRight className="w-4 h-4" />
                             </span>
                           ) : (
                             <span className="inline-flex p-1 bg-red-100 text-red-500 rounded-md" title="Despesa">
                                <ArrowDownRight className="w-4 h-4" />
                             </span>
                           )}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${t.tipo === 'Receita' ? 'text-green-600' : 'text-red-500'}`}>
                          {t.tipo === 'Receita' ? '+ ' : '- '}
                          {formatCurrency(Number(t.valor))}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {t.status === 'Pago' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold leading-none bg-green-100 text-green-700">
                                Pago
                              </span>
                           ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold leading-none bg-orange-100 text-orange-600">
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
                    ))
                  )}
                </tbody>
              </table>
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
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 h-12 lg:h-10 text-sm font-medium text-mesaninas-green/70 hover:text-mesaninas-green transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="financeiroForm"
                disabled={isSubmitting}
                className={`px-6 h-12 lg:h-10 hover:bg-opacity-90 text-white transition-colors text-sm font-bold rounded-md shadow-sm disabled:opacity-50 ${tipo === 'Receita' ? 'bg-[#86C29C]' : 'bg-red-500'}`}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
