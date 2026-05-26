import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Prato, Cliente } from '../types';
import { ChevronDown, Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const formatCurrencyInput = (value: string | number) => {
  if (value === undefined || value === null) return '';
  let strVal = typeof value === 'number' ? (value * 100).toFixed(0) : String(value);
  const onlyDigits = strVal.replace(/\D/g, '');
  if (!onlyDigits) return '';
  const num = parseInt(onlyDigits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const parseCurrency = (value: string) => {
  const onlyDigits = String(value).replace(/\D/g, '');
  return parseInt(onlyDigits, 10) / 100;
};

export default function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [pratosDB, setPratosDB] = useState<Prato[]>([]);
  const [clientesDB, setClientesDB] = useState<Cliente[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sales Funnel CRM and Print states
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [printOrcamento, setPrintOrcamento] = useState<Orcamento | null>(null);
  const [configGerais, setConfigGerais] = useState<any>({
    nomeFantasia: 'Mesaninas Buffet & Eventos',
    cnpj: '',
    email: '',
    telefone: '',
    pix: '',
    politicasCancelamento: '',
    regrasQuebra: ''
  });

  // Drag and Drop CRM Funnel handlers
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, orcamentoId: string) => {
    e.dataTransfer.setData('text/plain', orcamentoId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    const orcamentoId = e.dataTransfer.getData('text/plain');
    if (orcamentoId) {
      await handleUpdateStatus(orcamentoId, columnId);
    }
  };

  const handleUpdateStatus = async (orcamentoId: string, newStatus: string) => {
    try {
      const orcRef = doc(db, 'orcamentos', orcamentoId);
      const dataToUpdate: any = { status: newStatus };
      if (newStatus === 'Aprovado' || newStatus === 'Entregue') {
        dataToUpdate.statusPagamento = 'Aguardando';
      }
      await updateDoc(orcRef, dataToUpdate);
    } catch (err: any) {
      console.error("Error updating status:", err);
    }
  };

  const KANBAN_COLUMNS = [
    { id: 'Em Aberto', label: 'Rascunho', color: 'border-t-amber-400 bg-amber-500/5', iconColor: 'text-amber-500', dbStatuses: ['Em Aberto', 'Rascunho'] },
    { id: 'Enviado', label: 'Orçamento Enviado', color: 'border-t-sky-400 bg-sky-500/5', iconColor: 'text-sky-500', dbStatuses: ['Enviado'] },
    { id: 'Aprovado', label: 'Aprovado', color: 'border-t-emerald-400 bg-emerald-500/5', iconColor: 'text-emerald-500', dbStatuses: ['Aprovado', 'Entregue'] },
    { id: 'Recusado', label: 'Concluído', color: 'border-t-zinc-950 bg-zinc-950/5', iconColor: 'text-zinc-900', dbStatuses: ['Recusado'] }
  ];

  // Form states
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [nomeEvento, setNomeEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaTermino, setHoraTermino] = useState('');
  const [enderecoEvento, setEnderecoEvento] = useState('');
  const [usarEnderecoCadastro, setUsarEnderecoCadastro] = useState(false);
  const [numConvidados, setNumConvidados] = useState<number | ''>('');
  
  // Custom multi-select state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pratosSelecionados, setPratosSelecionados] = useState<Prato[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Finance states
  const [custosExtras, setCustosExtras] = useState<{ descricao: string; valor: string | number }[]>([]);
  const [margemLucro, setMargemLucro] = useState<number | ''>(20);
  const [aliquotaNF, setAliquotaNF] = useState<number>(0);
  const [margemPadrao, setMargemPadrao] = useState<number>(20);

  // Status workflow
  const [status, setStatus] = useState<string>('Em Aberto');
  const [statusPagamento, setStatusPagamento] = useState<'Aguardando' | 'Pago'>('Aguardando');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrcamentoId, setEditingOrcamentoId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'Aprovado' || status === 'Entregue') {
      if (!statusPagamento) setStatusPagamento('Aguardando');
    }
  }, [status, statusPagamento]);

  useEffect(() => {
    // FECHA O DROPDOWN SE CLICAR FORA
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Sync address if checkbox is checked
  useEffect(() => {
    if (usarEnderecoCadastro && selectedClienteId) {
      const c = clientesDB.find(c => c.id === selectedClienteId);
      if (c && c.endereco) {
        setEnderecoEvento(c.endereco);
      }
    }
  }, [usarEnderecoCadastro, selectedClienteId, clientesDB]);

  useEffect(() => {
    const unsubOrcamentos = onSnapshot(
      collection(db, 'orcamentos'),
      (snapshot) => {
        const data: Orcamento[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Orcamento);
        });
        setOrcamentos(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao buscar orçamentos:", err);
        setError('Ocorreu um erro ao conectar no Firebase (ou permissão negada). Exibindo dados locais para demonstração de interface.');
        setLoading(false);
      }
    );

    const unsubPratos = onSnapshot(collection(db, 'pratos'), (snapshot) => {
      const data: Prato[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Prato));
      setPratosDB(data);
    }, () => {
         setPratosDB([
            { id: '1', nome: 'Salgados Finos', tipoVenda: 'Por Unidade', precoBase: 35.00, rendimento: 1 },
            { id: '2', nome: 'Mesa de Frios (Kg)', tipoVenda: 'Por Quilo', precoBase: 120.00, rendimento: 10 },
         ]);
    });

    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const data: Cliente[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Cliente));
      setClientesDB(data);
    }, () => {
       setClientesDB([
         { id: 'cli_1', nome: 'Cliente Exemplo 1', cpf_cnpj: '000', email: 'email@email.com', telefone: '123', endereco: 'Rua Principal, 10' }
       ]);
    });

    const unsubConfig = onSnapshot(doc(db, 'configuracoes', 'gerais'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfigGerais(data);
        if (data.aliquotaNF !== undefined) setAliquotaNF(Number(data.aliquotaNF));
        if (data.margemLucro !== undefined) {
           setMargemPadrao(Number(data.margemLucro));
           if (!isModalOpen && !editingOrcamentoId) {
              setMargemLucro(Number(data.margemLucro));
           }
        }
      }
    });

    return () => {
      unsubOrcamentos();
      unsubPratos();
      unsubClientes();
      unsubConfig();
    };
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  const openEditModal = (orcamento: Orcamento) => {
    setEditingOrcamentoId(orcamento.id);
    setSelectedClienteId(orcamento.clienteId);
    setNomeEvento(orcamento.nomeEvento || '');
    setDataEvento(orcamento.dataEvento || '');
    setHoraInicio(orcamento.horaInicio || '');
    setHoraTermino(orcamento.horaTermino || '');
    setEnderecoEvento(orcamento.enderecoEvento || '');
    setUsarEnderecoCadastro(false);
    setNumConvidados(orcamento.numConvidados || '');
    
    if (orcamento.pratosSelecionados && pratosDB.length > 0) {
       const pratosObjects = pratosDB.filter(p => orcamento.pratosSelecionados?.includes(p.nome));
       setPratosSelecionados(pratosObjects);
    } else {
       setPratosSelecionados([]);
    }
    
    // Migrating legacy custoLogistica to custosExtras if needed
    if (orcamento.custosExtras) {
       setCustosExtras(orcamento.custosExtras.map(ce => ({ ...ce, valor: formatCurrencyInput(ce.valor) })));
    } else if (orcamento.custoLogistica !== undefined) {
       setCustosExtras([{ descricao: 'Logística', valor: formatCurrencyInput(orcamento.custoLogistica) }]);
    } else {
       setCustosExtras([]);
    }

    setMargemLucro(orcamento.margemLucro !== undefined ? orcamento.margemLucro : 20);
    
    // Map legacy status if needed to exact kanban column IDs
    const s = orcamento.status as string;
    if (s === 'Aprovado' || s === 'aprovado' || s === 'Entregue') setStatus('Aprovado');
    else if (s === 'Enviado') setStatus('Enviado');
    else if (s === 'Recusado' || s === 'concluido') setStatus('Recusado');
    else setStatus('Em Aberto');

    setStatusPagamento(orcamento.statusPagamento || 'Aguardando');
    
    setIsModalOpen(true);
  };

  const requestDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'orcamentos', itemToDelete));
    } catch (err: any) {
      alert('Erro ao apagar orçamento: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const togglePratoSelection = (prato: Prato) => {
    const exists = pratosSelecionados.find(p => p.id === prato.id);
    if (exists) {
       setPratosSelecionados(pratosSelecionados.filter(p => p.id !== prato.id));
    } else {
       setPratosSelecionados([...pratosSelecionados, prato]);
    }
  };

  const convidados = Number(numConvidados) || 0;
  
  const custoAlimentos = pratosSelecionados.reduce((acc, prato) => {
     const rendimento = Number(prato.rendimento) || 1;
     const precoBase = Number(prato.precoBase) || 0;
     const fatorDeMultiplicacao = convidados / rendimento;
     const custoDoItem = fatorDeMultiplicacao * precoBase;
     return acc + custoDoItem;
  }, 0);

  const totalCustosExtras = custosExtras.reduce((acc, curr) => acc + (parseCurrency(String(curr.valor)) || 0), 0);
  const margem = Number(margemLucro) || 0;

  const custoOperacionalTotal = custoAlimentos + totalCustosExtras;
  const subtotalComMargem = custoOperacionalTotal * (1 + margem / 100);
  const valorImposto = subtotalComMargem * ((aliquotaNF || 0) / 100);
  const valorVendaSugerido = subtotalComMargem + valorImposto;
  const lucroEstimado = subtotalComMargem - custoOperacionalTotal;

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !nomeEvento || !dataEvento || !numConvidados) return;

    const clienteAtivo = clientesDB.find(c => c.id === selectedClienteId);

    setIsSubmitting(true);
    try {
       const orcamentoData: Partial<Orcamento> = {
          clienteId: selectedClienteId,
          clienteNome: clienteAtivo?.nome || 'Cliente Desconhecido',
          nomeEvento,
          dataEvento,
          horaInicio,
          horaTermino,
          enderecoEvento,
          numConvidados: convidados,
          pratosSelecionados: pratosSelecionados.map(p => p.nome),
          custosExtras: custosExtras.map(ce => ({ descricao: ce.descricao, valor: parseCurrency(String(ce.valor)) || 0 })),
          custoAlimentos,
          custoTotal: custoOperacionalTotal,
          margemLucro: margem,
          valorVenda: valorVendaSugerido,
          status: status,
        };

        if (status === 'Aprovado' || status === 'Entregue') {
           orcamentoData.statusPagamento = statusPagamento;
        } else {
           orcamentoData.statusPagamento = null as any;
        }
        
        if (!editingOrcamentoId) {
           orcamentoData.createdAt = serverTimestamp() as any;
        }

      try {
         if (editingOrcamentoId) {
            await updateDoc(doc(db, 'orcamentos', editingOrcamentoId), orcamentoData);
         } else {
            await addDoc(collection(db, 'orcamentos'), orcamentoData);
         }
      } catch (err: any) {
         console.warn("Save failed, using local local fallback: ", err);
         if (editingOrcamentoId) {
             setOrcamentos(prev => prev.map(o => o.id === editingOrcamentoId ? { ...o, ...orcamentoData } as Orcamento : o));
         } else {
             setOrcamentos(prev => [{ id: Math.random().toString(), ...orcamentoData } as Orcamento, ...prev]);
         }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
     setEditingOrcamentoId(null);
     setSelectedClienteId('');
     setNomeEvento('');
     setDataEvento('');
     setHoraInicio('');
     setHoraTermino('');
     setEnderecoEvento('');
     setUsarEnderecoCadastro(false);
     setNumConvidados('');
     setPratosSelecionados([]);
     setCustosExtras([]);
     setMargemLucro(margemPadrao);
     setStatus('Em Aberto');
     setStatusPagamento('Aguardando');
  };

  const addCustoExtra = () => {
    setCustosExtras([...custosExtras, { descricao: '', valor: '' }]);
  };

  const updateCustoExtraDesc = (index: number, desc: string) => {
    const newItems = [...custosExtras];
    newItems[index].descricao = desc;
    setCustosExtras(newItems);
  };

  const updateCustoExtraValor = (index: number, val: string) => {
    const newItems = [...custosExtras];
    newItems[index].valor = formatCurrencyInput(val);
    setCustosExtras(newItems);
  };

  const removeCustoExtra = (index: number) => {
    const newItems = [...custosExtras];
    newItems.splice(index, 1);
    setCustosExtras(newItems);
  };

  const getProjectStatusBadge = (status: string) => {
     let projectBadge = null;
     switch (status?.toLowerCase()) {
        case 'rascunho': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">RASCUNHO</span>;
           break;
        case 'em aberto': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">RASCUNHO</span>;
           break;
        case 'enviado': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#bce8ea] text-mesaninas-green">ENVIADO</span>;
           break;
        case 'em negociação': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 text-violet-800">NEGOCIAÇÃO</span>;
           break;
        case 'aprovado': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#e7e873] text-mesaninas-green">APROVADO</span>;
           break;
        case 'entregue': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-green text-white">ENTREGUE</span>;
           break;
        case 'recusado': 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-900 text-white">CONCLUÍDO</span>;
           break;
        case 'pendente': // legacy map
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">RASCUNHO</span>;
           break;
        default: 
           projectBadge = <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mesaninas-creme/60 text-mesaninas-green">{status}</span>;
     }
     return projectBadge;
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
    <div className="flex flex-col h-full relative gap-6">
      {error && (
        <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2 shadow-sm shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10 gap-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h3 className="font-serif font-bold text-lg text-mesaninas-green">Nossos Orçamentos</h3>
            
            {/* View Mode Switcher */}
            <div className="flex bg-mesaninas-creme/60 p-1 rounded-lg border border-mesaninas-creme max-w-max">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-mesaninas-green text-mesaninas-creme shadow-sm'
                    : 'text-mesaninas-green/75 hover:text-mesaninas-green'
                }`}
              >
                Visualização em Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-mesaninas-green text-mesaninas-creme shadow-sm'
                    : 'text-mesaninas-green/75 hover:text-mesaninas-green'
                }`}
              >
                Funil de Vendas (Kanban)
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span> <span>Novo Orçamento</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-mesaninas-creme/5 flex flex-col">
          {viewMode === 'list' ? (
             <div className="flex-1 w-full">
               {/* DESKTOP TABLE */}
               <table className="hidden lg:table w-full text-left border-collapse text-sm">
                 <thead className="bg-mesaninas-creme/50 sticky top-0 border-b border-mesaninas-creme/50 z-10 shadow-sm">
                   <tr>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Cliente / Evento</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Data</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Convidados</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Valor Venda</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Status</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Pagamento</th>
                     <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-mesaninas-creme/50">
                   {loading ? (
                     <tr>
                       <td colSpan={7} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
                     </tr>
                   ) : orcamentos.length === 0 ? (
                     <tr>
                       <td colSpan={7} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum orçamento gerado.</td>
                     </tr>
                   ) : (
                     orcamentos.map((orc) => (
                       <tr key={orc.id} className="hover:bg-mesaninas-creme/30 group">
                         <td className="px-6 py-4">
                            <div className="font-medium text-mesaninas-green group-hover:text-mesaninas-green/80 transition-colors">{orc.clienteNome}</div>
                            <div className="text-xs text-mesaninas-green/60 mt-1 line-clamp-1 max-w-sm">
                               {orc.nomeEvento || 'Evento não nomeado'}
                            </div>
                         </td>
                         <td className="px-6 py-4 text-center text-mesaninas-green/80">
                           {formatDate(orc.dataEvento)}
                         </td>
                         <td className="px-6 py-4 text-center">
                           <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                              {orc.numConvidados} pax
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right text-mesaninas-green font-bold">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.valorVenda)}
                         </td>
                         <td className="px-6 py-4 text-center">
                            {getProjectStatusBadge(orc.status)}
                         </td>
                         <td className="px-6 py-4 text-center">
                            {getPaymentBadge(orc.status, orc.statusPagamento)}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-1.5">
                              <button 
                                onClick={() => setPrintOrcamento(orc)}
                                className="text-mesaninas-green/60 hover:text-emerald-500 hover:bg-emerald-50 transition-all p-1.5 rounded-md"
                                title="Gerar Proposta PDF"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                                </svg>
                              </button>
                              <button 
                                onClick={() => openEditModal(orc)}
                                className="text-mesaninas-green/60 hover:text-[#e7e873] hover:bg-yellow-50/50 transition-all p-1.5 rounded-md"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => requestDelete(orc.id)}
                                className="text-mesaninas-green/60 hover:text-red-500 hover:bg-red-50 transition-all p-1.5 rounded-md"
                                title="Apagar"
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

               {/* MOBILE LIST CARDS */}
               <div className="lg:hidden flex flex-col p-4 gap-4">
                  {loading ? (
                     <div className="text-center text-mesaninas-green/50 text-sm py-8">Carregando dados...</div>
                   ) : orcamentos.length === 0 ? (
                     <div className="text-center text-mesaninas-green/50 text-sm py-8">Nenhum orçamento encontrado.</div>
                   ) : (
                     orcamentos.map((orc) => (
                       <div key={orc.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                         <div className="flex justify-between items-start gap-2 border-b border-mesaninas-creme/50 pb-3 mb-1">
                           <div>
                             <div className="text-[10px] uppercase font-bold text-mesaninas-green/50 mb-0.5">Cliente</div>
                             <div className="font-bold text-mesaninas-green text-base leading-tight">{orc.clienteNome}</div>
                             <div className="text-xs text-mesaninas-green/80 mt-1">{orc.nomeEvento || 'Evento não nomeado'}</div>
                           </div>
                           <div className="flex flex-col items-end gap-2 shrink-0">
                             {getProjectStatusBadge(orc.status)}
                             {getPaymentBadge(orc.status, orc.statusPagamento)}
                           </div>
                         </div>
                         <div className="flex items-center gap-2 text-sm text-mesaninas-green/70">
                           <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                           {formatDate(orc.dataEvento)} • {orc.numConvidados} pax
                         </div>
                         <div className="mt-1 pt-2 border-t border-mesaninas-creme/50 flex justify-between items-center">
                           <span className="text-xs uppercase font-bold text-mesaninas-green/50 tracking-wide">Valor Venda</span>
                           <span className="text-mesaninas-green font-bold text-lg">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.valorVenda)}
                           </span>
                         </div>
                         <div className="flex flex-col gap-2 mt-2">
                           <div className="grid grid-cols-2 gap-2">
                              <button 
                                 onClick={() => openEditModal(orc)}
                                 className="h-10 bg-white hover:bg-mesaninas-creme/20 border border-mesaninas-creme text-mesaninas-green font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 group"
                              >
                                <Pencil className="w-4 h-4 text-mesaninas-green/50 group-hover:text-[#e7e873]" />
                                <span>Editar</span>
                              </button>
                              <button 
                                 onClick={() => requestDelete(orc.id)}
                                 className="h-10 bg-white hover:bg-red-50/50 border border-mesaninas-creme text-mesaninas-green font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 group"
                              >
                                <Trash2 className="w-4 h-4 text-mesaninas-green/50 group-hover:text-red-500" />
                                <span>Apagar</span>
                              </button>
                           </div>
                           <button 
                              onClick={() => setPrintOrcamento(orc)}
                              className="w-full h-11 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                           >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                              </svg>
                              <span>Gerar Proposta Comercial PDF</span>
                           </button>
                         </div>
                       </div>
                     ))
                   )}
               </div>
             </div>
          ) : (
             /* KANBAN CRM VIEW */
             <div className="flex-1 w-full p-6 bg-[#f4efdc]/20">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-5 w-full h-full items-stretch pb-2">
                 {KANBAN_COLUMNS.map((col) => {
                    const colOrcamentos = orcamentos.filter(orc => {
                       const statusLower = (orc.status || 'Em Aberto').toLowerCase();
                       return col.dbStatuses.some(ds => ds.toLowerCase() === statusLower);
                    });
                    
                    const colTotal = colOrcamentos.reduce((sum, orc) => sum + (orc.valorVenda || 0), 0);
                    const isOver = draggedOverColumn === col.id;
                    
                    return (
                       <div 
                         key={col.id}
                         onDragOver={(e) => handleDragOver(e, col.id)}
                         onDragLeave={handleDragLeave}
                         onDrop={(e) => handleDrop(e, col.id)}
                         className={`w-full min-w-0 bg-white/80 rounded-xl border flex flex-col transition-all duration-200 ${
                           isOver 
                             ? 'border-2 border-dashed border-mesaninas-green bg-mesaninas-creme/30 shadow-md ring-4 ring-mesaninas-green/5' 
                             : 'border-mesaninas-creme shadow-sm'
                         }`}
                       >
                          {/* Column Header */}
                          <div className={`p-4 border-b border-mesaninas-creme/60 rounded-t-xl shrink-0 border-t-4 ${col.color} flex flex-col gap-1.5`}>
                             <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-mesaninas-green/80 uppercase tracking-wider">{col.label}</span>
                                <span className="text-[11px] font-extrabold bg-mesaninas-green/10 text-mesaninas-green px-2.5 py-0.5 rounded-full shrink-0">
                                   {colOrcamentos.length}
                                </span>
                             </div>
                             <div className="text-sm font-bold text-mesaninas-green">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(colTotal)}
                             </div>
                          </div>
                          
                          {/* Column Body - Cards List */}
                          <div className="flex-1 p-3 flex flex-col gap-3.5 overflow-y-auto max-h-[650px] min-h-[450px]">
                             {colOrcamentos.length === 0 ? (
                                <div className="text-center py-10 text-xs text-mesaninas-green/35 border border-dashed border-mesaninas-creme/60 rounded-xl bg-mesaninas-creme/5 flex flex-col items-center justify-center p-4">
                                   Nenhum orçamento
                                </div>
                             ) : (
                               colOrcamentos.map((orc) => (
                                  <div
                                    key={orc.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, orc.id)}
                                    className="bg-white border border-mesaninas-creme/80 hover:border-mesaninas-green/50 hover:shadow-md transition-all p-3.5 rounded-xl text-xs flex flex-col gap-2.5 cursor-grab active:cursor-grabbing group shadow-sm"
                                  >
                                     {/* Card Header Title */}
                                     <div className="flex justify-between items-start gap-1">
                                        <h4 className="font-bold text-mesaninas-green text-xs line-clamp-2 leading-snug group-hover:text-mesaninas-green/80 flex-1">{orc.clienteNome}</h4>
                                        <div className="shrink-0 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-all">
                                           <button 
                                             onClick={() => openEditModal(orc)}
                                             className="p-1 hover:bg-mesaninas-creme/50 rounded-md text-mesaninas-green/75 hover:text-mesaninas-yellow"
                                             title="Editar"
                                           >
                                              <Pencil className="w-3.5 h-3.5" />
                                           </button>
                                           <button 
                                             onClick={() => setPrintOrcamento(orc)}
                                             className="p-1 hover:bg-mesaninas-creme/50 rounded-md text-mesaninas-green/75 hover:text-emerald-600"
                                             title="Gerar Proposta"
                                           >
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                                              </svg>
                                           </button>
                                        </div>
                                     </div>
                                     
                                     {/* Event details block */}
                                     <div className="text-mesaninas-green/75 font-sans leading-relaxed">
                                        <div className="font-semibold text-[11px] truncate">{orc.nomeEvento || 'Serviço de Buffet'}</div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] opacity-75 mt-0.5">
                                           <span>📅 {formatDate(orc.dataEvento)}</span>
                                           <span>• 👥 {orc.numConvidados} pax</span>
                                        </div>
                                     </div>
                                     
                                     {/* Card footer: Pricing / Switch Status */}
                                     <div className="pt-2.5 border-t border-mesaninas-creme/65 flex justify-between items-center mt-0.5">
                                        <span className="font-extrabold text-[#748e72] text-[13px]">
                                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.valorVenda)}
                                        </span>
                                        
                                        {/* Status Switcher touch compatible selector screen */}
                                        <select
                                          value={
                                            (orc.status === 'Rascunho' ? 'Em Aberto' : 
                                             orc.status === 'Entregue' ? 'Aprovado' : 
                                             orc.status) || 'Em Aberto'
                                          }
                                          onChange={(e) => handleUpdateStatus(orc.id, e.target.value)}
                                          className="px-2 py-0.5 border border-mesaninas-creme/80 rounded bg-mesaninas-creme/20 text-[10px] text-mesaninas-green font-bold focus:outline-none focus:ring-1 focus:ring-mesaninas-yellow hover:bg-white cursor-pointer"
                                        >
                                           <option value="Em Aberto">Rascunho</option>
                                           <option value="Enviado">Orçamento Enviado</option>
                                           <option value="Aprovado">Aprovado</option>
                                           <option value="Recusado">Concluído</option>
                                        </select>
                                     </div>
                                  </div>
                               ))
                             )}
                          </div>
                       </div>
                    );
                 })}
               </div>
             </div>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      {/* Drawer Novo Orçamento */}
      {isModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-end z-[60]">
          <div className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-1/4 duration-200">
            <div className="px-4 lg:px-6 py-4 border-b border-mesaninas-creme flex justify-between items-center bg-mesaninas-creme/30 shrink-0 mt-safe">
              <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight">
                   {editingOrcamentoId ? 'Editar Orçamento' : 'Novo Orçamento'}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">Configuração de evento comercial</p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-2xl font-bold p-2 h-12 w-12 flex items-center justify-center -mr-2"
              >×</button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 bg-mesaninas-creme/10 pb-24">
              
              {/* Infos Básicas */}
              <div className="space-y-4 p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Informações do Evento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select de Cliente */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Cliente*</label>
                    <select
                      required
                      value={selectedClienteId}
                      onChange={e => setSelectedClienteId(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green font-medium"
                    >
                      <option value="">Selecione um cliente...</option>
                      {clientesDB.map(c => (
                        <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                      ))}
                    </select>
                  </div>

                  {/* Nome do Evento */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Nome do Evento*</label>
                    <input
                      type="text"
                      required
                      value={nomeEvento}
                      onChange={e => setNomeEvento(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="Ex: Reunião de Diretoria, Festa de Fim de Ano..."
                    />
                  </div>
                  
                  {/* Datas e Horários */}
                  <div>
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Data do Evento*</label>
                    <input
                      type="date"
                      required
                      value={dataEvento}
                      onChange={e => setDataEvento(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Convidados (Pax)*</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={numConvidados}
                      onChange={e => setNumConvidados(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="Ex: 50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 col-span-1 md:col-span-2">
                     <div>
                       <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Hora Início</label>
                       <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Hora Fim</label>
                       <input type="time" value={horaTermino} onChange={e=>setHoraTermino(e.target.value)} className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" />
                     </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-2 mt-2">
                     <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-mesaninas-green/80">Endereço do Evento</label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-mesaninas-green/60 hover:text-mesaninas-green">
                           <input type="checkbox" checked={usarEnderecoCadastro} onChange={e=>setUsarEnderecoCadastro(e.target.checked)} disabled={!selectedClienteId} className="rounded text-mesaninas-yellow focus:ring-mesaninas-yellow h-4 w-4 border-mesaninas-creme" />
                           Mesmo do cadastro
                        </label>
                     </div>
                     <textarea
                        rows={2}
                        value={enderecoEvento}
                        onChange={e => setEnderecoEvento(e.target.value)}
                        disabled={usarEnderecoCadastro}
                        className="w-full px-3 py-2 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green disabled:bg-mesaninas-creme/50 disabled:text-mesaninas-green/50"
                        placeholder="Av. Paulista, 1000 - Salão de Festas..."
                     />
                  </div>
                  
                  {/* Status / Pagamento */}
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-mesaninas-creme/50 mt-2">
                     <div>
                        <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Status do Projeto</label>
                        <select
                          value={status}
                          onChange={e => setStatus(e.target.value as any)}
                          className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green font-medium"
                        >
                          <option value="Em Aberto">Rascunho</option>
                          <option value="Enviado">Orçamento Enviado</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Recusado">Concluído</option>
                        </select>
                     </div>
                     {(status === 'Aprovado' || status === 'Entregue') && (
                        <div>
                           <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Status de Pagamento</label>
                           <div className="flex gap-4 mt-2">
                              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-mesaninas-green">
                                 <input 
                                    type="radio" 
                                    name="statusPagamento" 
                                    value="Aguardando" 
                                    checked={statusPagamento === 'Aguardando'} 
                                    onChange={() => setStatusPagamento('Aguardando')}
                                    className="text-mesaninas-yellow focus:ring-mesaninas-yellow" 
                                 />
                                 Aguardando PGTO
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-mesaninas-green">
                                 <input 
                                    type="radio" 
                                    name="statusPagamento" 
                                    value="Pago" 
                                    checked={statusPagamento === 'Pago'} 
                                    onChange={() => setStatusPagamento('Pago')}
                                    className="text-mesaninas-yellow focus:ring-mesaninas-yellow" 
                                 />
                                 Pago
                              </label>
                           </div>
                        </div>
                     )}
                  </div>

                </div>
              </div>

              {/* Custom Multi-select Cardápio */}
              <div className="space-y-4 p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-visible">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Cardápio (Multi-Select)</h4>
                
                <div className="relative" ref={dropdownRef}>
                  <button 
                     type="button" 
                     onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                     className="flex items-center justify-between w-full px-4 min-h-12 border border-mesaninas-creme rounded-md bg-white text-left text-sm text-mesaninas-green focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50"
                  >
                     <span className="truncate">
                        {pratosSelecionados.length === 0 
                           ? "Selecione um ou mais pratos do menu..." 
                           : `${pratosSelecionados.length} ite${pratosSelecionados.length > 1 ? 'ns' : 'm'} selecionado${pratosSelecionados.length > 1 ? 's' : ''}`}
                     </span>
                     <ChevronDown className={`w-4 h-4 text-mesaninas-green/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                     <div className="absolute z-10 w-full mt-2 bg-white border border-mesaninas-creme/80 rounded-md shadow-xl max-h-60 overflow-auto">
                        <div className="p-1">
                           {pratosDB.length === 0 && <div className="p-3 text-sm text-mesaninas-green/50 text-center">Nenhum prato disponível</div>}
                           {pratosDB.map((prato) => {
                              const isSelected = !!pratosSelecionados.find(p => p.id === prato.id);
                              return (
                                 <button
                                    key={prato.id}
                                    type="button"
                                    onClick={() => togglePratoSelection(prato)}
                                    className={`w-full flex items-center justify-between px-3 py-3 text-sm text-left rounded-sm transition-colors ${
                                       isSelected ? 'bg-mesaninas-yellow/20 text-mesaninas-green font-medium' : 'hover:bg-mesaninas-creme/30 text-mesaninas-green/80'
                                    }`}
                                 >
                                    <div className="flex flex-col">
                                       <span>{prato.nome}</span>
                                       <span className="text-[10px] opacity-70">R$ {prato.precoBase.toFixed(2)} / {prato.tipoVenda}</span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-mesaninas-green" />}
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  )}
                </div>
                
                {pratosSelecionados.length > 0 && (
                   <ul className="mt-4 space-y-2">
                      {pratosSelecionados.map((prato) => (
                         <li key={prato.id} className="flex items-center justify-between text-sm bg-mesaninas-creme/20 px-3 py-2 rounded-lg border border-mesaninas-creme/50">
                            <span className="font-medium text-mesaninas-green">{prato.nome}</span>
                            <div className="flex items-center gap-3">
                               <span className="text-xs text-mesaninas-green/60">R$ {prato.precoBase.toFixed(2)}</span>
                               <button type="button" onClick={() => togglePratoSelection(prato)} className="text-mesaninas-peach hover:text-red-500 font-bold p-1 rounded transition-colors w-8 h-8 flex items-center justify-center">×</button>
                            </div>
                         </li>
                      ))}
                   </ul>
                )}
              </div>
              
              {/* Custos Operacionais & Margem */}
              <div className="flex flex-col gap-4 p-5 bg-white border border-mesaninas-creme rounded-xl shadow-sm">
                 <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-mesaninas-green/80 mb-3 block">Custos Operacionais e Logística</h4>
                    {custosExtras.map((item, index) => (
                       <div key={index} className="flex gap-2 items-center mb-2">
                           <input 
                             type="text" 
                             value={item.descricao} 
                             onChange={(e) => updateCustoExtraDesc(index, e.target.value)} 
                             className="flex-1 px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" 
                             placeholder="Descrição (Ex: Gasolina, Garçom)" 
                           />
                           <input 
                             type="text" 
                             inputMode="numeric"
                             value={item.valor} 
                             onChange={(e) => updateCustoExtraValor(index, e.target.value)} 
                             className="w-32 px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" 
                             placeholder="R$ 0,00" 
                           />
                           <button type="button" onClick={() => removeCustoExtra(index)} className="p-2 text-mesaninas-green/50 hover:text-red-500 transition-colors">
                              <Trash2 className="w-5 h-5 lg:w-4 lg:h-4" />
                           </button>
                       </div>
                    ))}
                    <button type="button" onClick={addCustoExtra} className="mt-2 text-xs font-bold text-mesaninas-green bg-mesaninas-creme/30 hover:bg-mesaninas-creme/60 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1">
                       + Adicionar Custo Extra
                    </button>
                 </div>
                 
                 <div className="pt-4 border-t border-mesaninas-creme/50 mt-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Margem de Lucro Desejada (%)</label>
                    <div className="relative w-full md:w-1/2">
                       <input
                         type="number"
                         min="0"
                         max="100"
                         value={margemLucro}
                         onChange={e => setMargemLucro(e.target.value ? Number(e.target.value) : '')}
                         className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green pr-8"
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mesaninas-green/50 font-bold">%</span>
                    </div>
                 </div>
              </div>

              {/* Reactive Live Calculator */}
              <div className="bg-mesaninas-green rounded-xl p-5 text-mesaninas-creme shadow-xl">
                 <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-yellow mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-mesaninas-yellow animate-pulse"></div>
                    Motor de Cálculo (Live)
                 </h4>
                 
                 <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-creme/70">Custo Total (Cardápio)</span>
                       <span className="text-mesaninas-creme font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoAlimentos)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-creme/70">Equipe & Logística</span>
                       <span className="text-mesaninas-creme font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCustosExtras)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="font-medium text-mesaninas-creme">Custo Operacional Total</span>
                       <span className="text-mesaninas-peach font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoOperacionalTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-yellow font-medium">+ Lucro Estimado ({margem}%)</span>
                       <span className="text-mesaninas-yellow font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroEstimado)}</span>
                    </div>
                    {aliquotaNF > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                         <span className="text-orange-300 font-medium">+ Impostos NF ({aliquotaNF}%)</span>
                         <span className="text-orange-300 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorImposto)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-end pt-4 mt-2">
                       <span className="text-xs font-bold uppercase tracking-wider text-mesaninas-creme/70">Sugerido para Venda</span>
                       <span className="text-2xl font-bold text-mesaninas-green bg-mesaninas-yellow px-3 py-1 rounded-lg border border-mesaninas-yellow/50">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorVendaSugerido)}
                       </span>
                    </div>
                 </div>
              </div>

            </div>
            
            <div className="px-4 lg:px-6 py-4 border-t border-mesaninas-creme bg-white flex justify-end gap-3 shrink-0 pb-safe z-10 w-full rounded-b-xl lg:rounded-none">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="px-4 h-12 lg:h-10 text-sm font-medium text-mesaninas-green/70 hover:text-mesaninas-green transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleCadastrar}
                disabled={isSubmitting || !selectedClienteId || !nomeEvento || !dataEvento || !convidados || pratosSelecionados.length === 0}
                className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Gerando...' : (editingOrcamentoId ? 'Atualizar Orçamento' : 'Salvar Proposta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Print Preview Modal */}
      {printOrcamento && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
            {/* Inject Custom Media Print Spacing Style */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body {
                  background-color: white !important;
                  color: black !important;
                  font-family: Georgia, Cambria, "Times New Roman", Times, serif !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #print-proposal-area, #print-proposal-area * {
                  visibility: visible !important;
                }
                #print-proposal-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 1.5cm !important;
                  background-color: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                /* Hide close buttons and headers on paper print */
                .no-print {
                  display: none !important;
                  visibility: hidden !important;
                }
              }
            `}} />
            
            <div className="bg-mesaninas-creme/20 border border-mesaninas-creme/50 rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
               {/* Controls Header */}
               <div className="px-6 py-4 bg-white border-b border-mesaninas-creme flex items-center justify-between no-print shrink-0">
                  <div className="flex items-center gap-2">
                     <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                     <h3 className="font-serif font-bold text-mesaninas-green text-base">Gerador de Proposta Comercial</h3>
                  </div>
                  <div className="flex items-center gap-3">
                     <button
                       onClick={() => window.print()}
                       className="px-4 h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-xs font-bold rounded-lg shadow-md flex items-center gap-2 transition-all cursor-pointer"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        Imprimir / Salvar PDF
                     </button>
                     <button
                       onClick={() => setPrintOrcamento(null)}
                       className="px-3 h-10 border border-mesaninas-creme text-mesaninas-green/70 hover:text-mesaninas-green text-xs font-semibold rounded-lg hover:bg-white transition-all cursor-pointer"
                     >
                        Fechar
                     </button>
                  </div>
               </div>
               
               {/* Paper Document Wrapper */}
               <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-zinc-800/10">
                  <div 
                     id="print-proposal-area" 
                     className="w-full max-w-[21cm] bg-white border border-gray-200/60 shadow-lg p-10 md:p-14 font-serif text-gray-800 flex flex-col gap-8 rounded-lg relative min-h-[29.7cm] text-left"
                  >
                     {/* Decorative subtle border line in gold */}
                     <div className="absolute top-0 left-0 right-0 h-2 bg-mesaninas-yellow rounded-t-lg"></div>

                     {/* 1. BRAND HEADER */}
                     <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-100 pb-6 gap-6">
                        <div className="space-y-1">
                           <h1 className="text-3.5xl font-serif font-semibold tracking-tight text-mesaninas-green leading-none">
                              {configGerais.nomeFantasia || 'Mesaninas Buffet & Eventos'}
                           </h1>
                           <div className="text-xs font-mono tracking-widest uppercase text-mesaninas-yellow font-bold pt-1">
                              Alta Gastronomia & Experiência
                           </div>
                        </div>
                        <div className="text-left sm:text-right text-xs space-y-1 text-gray-500 font-sans">
                           {configGerais.cnpj && <div className="font-semibold text-gray-700">CNPJ: {configGerais.cnpj}</div>}
                           {configGerais.email && <div>E-mail: {configGerais.email}</div>}
                           {configGerais.telefone && <div>Contatos: {configGerais.telefone}</div>}
                           <div>São Paulo, SP</div>
                        </div>
                     </div>

                     {/* 2. CUSTOMER & EVENT DETAILS */}
                     <div className="space-y-4">
                        <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-mesaninas-green border-b border-gray-100 pb-1.5 matches-print-text-dark">
                           Dados da Proposta Comercial e Evento
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm font-sans">
                           <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Contratante / Cliente</span>
                              <span className="font-bold text-gray-800 text-base">{printOrcamento.clienteNome}</span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Serviço / Título</span>
                              <span className="font-medium text-gray-800 text-sm">{printOrcamento.nomeEvento || 'Serviço de Recepção & Buffet'}</span>
                           </div>
                           <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Data, Horário e Local</span>
                              <span className="font-medium text-gray-800 text-sm">
                                 {formatDate(printOrcamento.dataEvento)}
                                 {printOrcamento.horaInicio ? ` das ${printOrcamento.horaInicio} às ${printOrcamento.horaTermino || 'Fim'}` : ''}
                                 {printOrcamento.enderecoEvento ? ` • Endereço: ${printOrcamento.enderecoEvento}` : ''}
                              </span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Número de Convidados (Pax)</span>
                              <span className="font-bold text-mesaninas-green text-base">{printOrcamento.numConvidados} Convidados (Pax)</span>
                           </div>
                        </div>
                     </div>

                     {/* 3. MENU SELECTION CONTAINER */}
                     <div className="space-y-4 flex-1">
                        <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-mesaninas-green border-b border-gray-100 pb-1.5 matches-print-text-dark">
                           Experiência Gastronômica Selecionada (Menu)
                        </h2>
                        <p className="text-xs text-gray-500 italic font-serif leading-relaxed">
                           Cada item do menu foi customizado para surpreender e agradar os paladares mais exigentes. Apresentamos abaixo os itens que compõem o serviço contratado de alimentação.
                        </p>
                        
                        <div className="mt-3 bg-zinc-50 border border-gray-200/50 rounded-xl p-6">
                           <ul className="space-y-4">
                              {printOrcamento.pratosSelecionados && printOrcamento.pratosSelecionados.map((pratoObj: any, index: number) => {
                                 // Handle both string and structure arrays beautifully
                                 const pratoNome = typeof pratoObj === 'string' ? pratoObj : (pratoObj.nome || pratoObj.id);
                                 const pratoDesc = pratoObj.descricao || '';
                                 return (
                                    <li key={index} className="flex gap-4 items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                       <span className="w-1.5 h-1.5 rounded-full bg-mesaninas-yellow mt-2 shrink-0"></span>
                                       <div className="space-y-1">
                                          <h4 className="font-serif font-bold text-gray-800 text-[15px] leading-snug">{pratoNome}</h4>
                                          {pratoDesc && <p className="text-xs text-gray-500 font-sans leading-relaxed">{pratoDesc}</p>}
                                       </div>
                                    </li>
                                 );
                              })}
                           </ul>
                        </div>
                     </div>

                     {/* 4. FINANCIAL SUMMARY */}
                     <div className="mt-4 pt-6 border-t border-gray-200/80 grid grid-cols-1 md:grid-cols-2 gap-6 items-end shrink-0">
                        <div className="space-y-2 font-sans text-xs text-gray-600 text-left">
                           <h3 className="font-sans font-bold text-xs text-mesaninas-green uppercase tracking-wide">Meios e Reserva de Data</h3>
                           {configGerais.pix ? (
                              <p className="leading-relaxed bg-mesaninas-creme/10 border border-mesaninas-creme/30 rounded-lg p-3">
                                 Para reserva, consulte as regras de sinal detalhadas em contrato.<br />
                                 <span className="font-semibold text-gray-800">Chave PIX Comercial:</span> <span className="font-mono text-[11px] text-mesaninas-green font-bold select-all bg-mesaninas-creme/20 px-1 py-0.5 rounded">{configGerais.pix}</span>
                              </p>
                           ) : (
                              <p className="italic text-gray-500">Chave PIX e formas de sinal sob consulta comercial direta.</p>
                           )}
                        </div>
                        <div className="text-left md:text-right space-y-1 sm:self-center md:self-end">
                           <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-sans">Valor Comercial Consolidado</span>
                           <div className="text-2.5xl font-serif font-extrabold text-[#5c7a59] bg-mesaninas-green/5 px-4 py-2.5 rounded-lg border border-mesaninas-green/15 leading-none">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(printOrcamento.valorVenda)}
                           </div>
                        </div>
                     </div>

                     {/* 5. LEGAL POLICIES & TERMS FOOTER */}
                     <div className="border-t border-gray-150 pt-6 mt-4 space-y-5 text-[10px] text-gray-500 leading-normal font-sans shrink-0">
                        {configGerais.politicasCancelamento || configGerais.regrasQuebra ? (
                           <>
                              {configGerais.politicasCancelamento && (
                                 <div className="space-y-1">
                                    <h4 className="font-bold uppercase tracking-wider text-gray-700 text-[10px] font-mono">Políticas de Cancelamento e Reembolso</h4>
                                    <p className="whitespace-pre-line text-gray-500 leading-relaxed">{configGerais.politicasCancelamento}</p>
                                 </div>
                              )}
                              {configGerais.regrasQuebra && (
                                 <div className="space-y-1">
                                    <h4 className="font-bold uppercase tracking-wider text-gray-700 text-[10px] font-mono font-bold">Regras de Quebra de Materiais e Logística</h4>
                                    <p className="whitespace-pre-line text-gray-500 leading-relaxed">{configGerais.regrasQuebra}</p>
                                 </div>
                              )}
                           </>
                        ) : (
                           <div className="space-y-2">
                              <h4 className="font-bold uppercase tracking-wider text-gray-700 text-[10px] font-mono">Cláusulas Importantes e Logística</h4>
                              <p>1. O cancelamento solicitado com antecedência de até 30 dias receberá reembolso de 50% do valor de sinal depositado.</p>
                              <p>2. Danos e quebras de louças, talheres ou taças decorridas durante o evento serão repassados pelo valor nominal de reposição de itens.</p>
                           </div>
                        )}
                        <div className="text-center pt-4 border-t border-gray-100 text-[9px] text-gray-400">
                           Esta proposta possui validade padrão de {configGerais.validadeProposta || 10} dias a partir de sua geração. • Gerado automaticamente por {configGerais.nomeFantasia || 'Mesaninas Buffet'}.
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
