import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Orcamento, Prato, Cliente, CustoOperacionalCategoria, ItemEstoque } from '../types';
import { ChevronDown, Check, Pencil, Trash2, Search, UploadCloud, FileText } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';

const defaultCostCategories: CustoOperacionalCategoria[] = [
  { id: 'combustivel', nome: 'Combustível' },
  { id: 'pedagio', nome: 'Pedágio' },
  { id: 'ajudantes', nome: 'Ajudantes / Diárias' },
  { id: 'equipamentos', nome: 'Aluguel de Equipamento' },
  { id: 'logistica', nome: 'Logística / Frete' }
];

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  userId?: string | null,
  email?: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId || null,
      email: email || null,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Orcamentos() {
  const { userProfile, currentUser } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [pratosDB, setPratosDB] = useState<Prato[]>([]);
  const [clientesDB, setClientesDB] = useState<Cliente[]>([]);
  const [estoqueDB, setEstoqueDB] = useState<ItemEstoque[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sales Funnel CRM and Print states
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
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
      const orc = orcamentos.find(o => o.id === orcamentoId);
      if (!orc) return;

      const batch = writeBatch(db);
      const orcRef = doc(db, 'orcamentos', orcamentoId);

      const dataToUpdate: any = { status: newStatus };
      if (newStatus === 'Aprovado' || newStatus === 'Entregue' || newStatus === 'Recusado') {
        if (!orc.statusPagamento) {
          dataToUpdate.statusPagamento = 'Aguardando';
        }
      }
      if (userProfile?.nome) {
        dataToUpdate.ultimoEditor = userProfile.nome;
      }

      // Handle stock
      const willBeBaixado = ['Aprovado', 'Entregue'].includes(newStatus);
      const isCurrentlyBaixado = orc.estoqueBaixado || false;
      const orcMateriais = orc.materiaisEstoque || [];

      if (!isCurrentlyBaixado && willBeBaixado) {
        // Deduct items
        orcMateriais.forEach(mat => {
           if (mat.materialId) {
             const estRef = doc(db, 'estoque', mat.materialId);
             const estAtual = estoqueDB.find(e => e.id === mat.materialId);
             batch.update(estRef, { 
               utilizados: (estAtual?.utilizados || 0) + (Number(mat.quantidade) || 0)
             });
           }
        });
        dataToUpdate.estoqueBaixado = true;
      } else if (isCurrentlyBaixado && !willBeBaixado) {
        // Restore items
        orcMateriais.forEach(mat => {
           if (mat.materialId) {
             const estRef = doc(db, 'estoque', mat.materialId);
             const estAtual = estoqueDB.find(e => e.id === mat.materialId);
             batch.update(estRef, { 
               utilizados: Math.max(0, (estAtual?.utilizados || 0) - (Number(mat.quantidade) || 0))
             });
           }
        });
        dataToUpdate.estoqueBaixado = false;
      }

      batch.update(orcRef, dataToUpdate);
      await batch.commit();
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
  const [pratosSelecionados, setPratosSelecionados] = useState<import('../types').PratoOrcamento[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [materiaisEstoque, setMateriaisEstoque] = useState<{ materialId: string; nome: string; quantidade: string | number }[]>([]);
  const [estoqueBaixado, setEstoqueBaixado] = useState(false);

  // Finance states
  const [custosExtras, setCustosExtras] = useState<{ descricao: string; valor: string | number }[]>([]);
  const [margemLucro, setMargemLucro] = useState<number | ''>(20);
  const [aliquotaNF, setAliquotaNF] = useState<number | ''>(0);
  const [margemPadrao, setMargemPadrao] = useState<number>(20);

  // Status workflow
  const [status, setStatus] = useState<string>('Em Aberto');
  const [statusPagamento, setStatusPagamento] = useState<'Aguardando' | 'Pago'>('Aguardando');
  const [imagemUrl, setImagemUrl] = useState('');
  const [linkNotaFiscal, setLinkNotaFiscal] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrcamentoId, setEditingOrcamentoId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'Aprovado' || status === 'Entregue' || status === 'Recusado') {
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
        handleFirestoreError(err, OperationType.LIST, 'orcamentos', currentUser?.uid, currentUser?.email);
      }
    );

    const unsubPratos = onSnapshot(collection(db, 'pratos'), (snapshot) => {
      const data: Prato[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Prato));
      setPratosDB(data);
    }, () => {
         setPratosDB([
            { id: '1', nome: 'Salgados Finos', tipoVenda: 'Por Unidade', rendimento: 1, fornecedoresCustos: [{ fornecedorId: 'f1', nome: 'Cozinha Padrão', custo: 35.00 }] },
            { id: '2', nome: 'Mesa de Frios (Kg)', tipoVenda: 'Por Quilo', rendimento: 10, fornecedoresCustos: [{ fornecedorId: 'f1', nome: 'Cozinha Padrão', custo: 120.00 }] },
         ]);
    });

    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (snapshot) => {
      const data: ItemEstoque[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ItemEstoque));
      setEstoqueDB(data);
    }, () => {
         setEstoqueDB([]);
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
        if (data.aliquotaNF !== undefined) {
           if (!isModalOpen && !editingOrcamentoId) {
              setAliquotaNF(Number(data.aliquotaNF));
           }
        }
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
      unsubEstoque();
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
    setImagemUrl(orcamento.imagemUrl || '');
    setLinkNotaFiscal(orcamento.linkNotaFiscal || '');
    
    if (orcamento.pratosSelecionados && pratosDB.length > 0) {
       if (orcamento.pratosSelecionados.length > 0 && typeof orcamento.pratosSelecionados[0] === 'string') {
         const legacyPratos = (orcamento.pratosSelecionados as any as string[]).map(nome => {
            const p = pratosDB.find(dbP => dbP.nome === nome);
            if (!p) return null;
            const f = p.fornecedoresCustos?.[0];
            return {
               pratoId: p.id,
               nome: p.nome,
               fornecedorId: f?.fornecedorId || '',
               fornecedorNome: f?.nome || 'Fornecedor',
               custo: f?.custo || (p as any).precoBase || 0,
               tipoVenda: p.tipoVenda,
               rendimento: p.rendimento || 1,
               imagemUrl: p.imagemUrl
            };
         }).filter(Boolean) as import('../types').PratoOrcamento[];
         setPratosSelecionados(legacyPratos);
       } else {
         setPratosSelecionados(orcamento.pratosSelecionados as import('../types').PratoOrcamento[]);
       }
    } else {
       setPratosSelecionados([]);
    }
    
    setMateriaisEstoque(orcamento.materiaisEstoque || []);
    setEstoqueBaixado(orcamento.estoqueBaixado || false);
    
    // Migrating legacy custoLogistica to custosExtras if needed
    if (orcamento.custosExtras) {
       setCustosExtras(orcamento.custosExtras.map(ce => ({ ...ce, valor: formatCurrencyInput(ce.valor) })));
    } else if (orcamento.custoLogistica !== undefined) {
       setCustosExtras([{ descricao: 'Logística', valor: formatCurrencyInput(orcamento.custoLogistica) }]);
    } else {
       setCustosExtras([]);
    }

    setMargemLucro(orcamento.margemLucro !== undefined ? orcamento.margemLucro : 20);
    setAliquotaNF(orcamento.aliquotaNF !== undefined ? orcamento.aliquotaNF : Number(configGerais?.aliquotaNF || 0));
    
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
      const orcToDelete = orcamentos.find(o => o.id === itemToDelete);
      if (orcToDelete?.estoqueBaixado && orcToDelete.materiaisEstoque) {
        const batch = writeBatch(db);
        orcToDelete.materiaisEstoque.forEach(mat => {
          if (mat.materialId) {
            const estRef = doc(db, 'estoque', mat.materialId);
            const estAtual = estoqueDB.find(e => e.id === mat.materialId);
            batch.update(estRef, { 
              utilizados: Math.max(0, (estAtual?.utilizados || 0) - (Number(mat.quantidade) || 0))
            });
          }
        });
        batch.delete(doc(db, 'orcamentos', itemToDelete));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'orcamentos', itemToDelete));
      }
    } catch (err: any) {
      alert('Erro ao apagar orçamento: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const togglePratoSelection = (prato: Prato) => {
    const exists = pratosSelecionados.find(p => p.pratoId === prato.id);
    if (exists) {
       setPratosSelecionados(pratosSelecionados.filter(p => p.pratoId !== prato.id));
    } else {
       const initialFornecedor = prato.fornecedoresCustos?.[0];
       setPratosSelecionados([...pratosSelecionados, {
         pratoId: prato.id,
         nome: prato.nome,
         fornecedorId: initialFornecedor?.fornecedorId || '',
         fornecedorNome: initialFornecedor?.nome || 'Fornecedor',
         custo: initialFornecedor?.custo || (prato as any).precoBase || 0,
         tipoVenda: prato.tipoVenda,
         rendimento: prato.rendimento || 1,
         imagemUrl: prato.imagemUrl
       }]);
    }
  };

  const updatePratoFornecedor = (pratoId: string, fornecedorId: string) => {
     const pratoBase = pratosDB.find(p => p.id === pratoId);
     const fornecedorSelecionado = pratoBase?.fornecedoresCustos?.find(fc => fc.fornecedorId === fornecedorId);
     if (!fornecedorSelecionado) return;
     setPratosSelecionados(prev => prev.map(p => 
       p.pratoId === pratoId 
         ? { ...p, fornecedorId, fornecedorNome: fornecedorSelecionado.nome, custo: fornecedorSelecionado.custo }
         : p
     ));
  };

  const updatePratoQuantidade = (pratoId: string, quantidadeStr: string) => {
     setPratosSelecionados(prev => prev.map(p => 
       p.pratoId === pratoId 
         ? { ...p, quantidadeOverride: quantidadeStr ? Number(quantidadeStr) : undefined }
         : p
     ));
  };

  const convidados = Number(numConvidados) || 0;
  
  const custoAlimentos = pratosSelecionados.reduce((acc, prato) => {
     const rendimento = Number(prato.rendimento) || 1;
     const custo = Number(prato.custo) || 0;
     const tipoVenda = prato.tipoVenda || 'Por Quilo';
     
     let fatorDeMultiplicacao = tipoVenda === 'Por Unidade' ? convidados * rendimento : convidados / rendimento;
     if (prato.quantidadeOverride !== undefined && prato.quantidadeOverride > 0) {
        fatorDeMultiplicacao = prato.quantidadeOverride;
     }

     const custoDoItem = fatorDeMultiplicacao * custo;
     return acc + custoDoItem;
  }, 0);

  const totalCustosExtras = custosExtras.reduce((acc, curr) => acc + (parseCurrency(String(curr.valor)) || 0), 0);
  const totalCustosEstoque = materiaisEstoque.reduce((acc, currentMat) => {
     const estItem = estoqueDB.find(e => e.id === currentMat.materialId);
     const valor = estItem?.valorUnitario || 0;
     const quantidade = Number(currentMat.quantidade) || 0;
     return acc + (valor * quantidade);
  }, 0);
  const margem = Number(margemLucro) || 0;

  const custoOperacionalTotal = custoAlimentos + totalCustosExtras + totalCustosEstoque;

  const margemFormatada = margem / 100;
  const aliquotaDecimal = (aliquotaNF || 0) / 100;

  const lucroEstimado = custoOperacionalTotal * margemFormatada;
  const valorSemImposto = custoOperacionalTotal + lucroEstimado;
  
  const valorImposto = valorSemImposto * aliquotaDecimal;
  const valorVendaSugerido = valorSemImposto + valorImposto;

  const handleUploadNota = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('notaFiscal', file);

      const response = await fetch('/api/upload-nota', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Erro do servidor (Status ${response.status})`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText && errorText.trim().startsWith('<')) {
              errorMessage = `Erro ${response.status}: Página não encontrada (404) ou HTML retornado.`;
            } else if (errorText && errorText.length < 150) {
              errorMessage = errorText;
            }
          }
        } catch (_) {
          // Fallback to initial status string
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta do servidor inválida (Não é JSON).');
      }

      const data = await response.json();
      if (!data || !data.link) {
        throw new Error('Resposta do servidor não retornou o link do arquivo.');
      }

      setLinkNotaFiscal(data.link);
    } catch (error: any) {
      console.error(error);
      alert('Falha no upload: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteNota = async () => {
    if (!linkNotaFiscal) return;

    if (!window.confirm('Tem certeza que deseja remover esta nota fiscal? Esta ação apagará o arquivo do sistema.')) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/delete-nota', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl: linkNotaFiscal }),
      });

      if (!response.ok) {
        let errorMessage = `Erro do servidor (Status ${response.status})`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText && errorText.trim().startsWith('<')) {
              errorMessage = `Erro ${response.status}: Página não encontrada (404) ou HTML retornado.`;
            } else if (errorText && errorText.length < 150) {
              errorMessage = errorText;
            }
          }
        } catch (_) {
          // Fallback
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta do servidor inválida (Não é JSON).');
      }

      setLinkNotaFiscal('');
    } catch (error: any) {
      console.error(error);
      alert('Falha ao remover nota: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEvento) return;

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
          pratosSelecionados: pratosSelecionados,
          custosExtras: custosExtras.map(ce => ({ descricao: ce.descricao, valor: parseCurrency(String(ce.valor)) || 0 })),
          custoAlimentos,
          custoTotal: custoOperacionalTotal,
          margemLucro: margem,
          aliquotaNF: Number(aliquotaNF) || 0,
          valorVenda: valorVendaSugerido,
          status: status,
          statusPagamento: statusPagamento,
          imagemUrl: imagemUrl,
          linkNotaFiscal: linkNotaFiscal || '',
          materiaisEstoque: materiaisEstoque.map(m => ({ materialId: m.materialId, nome: m.nome, quantidade: Number(m.quantidade) || 0 })),
          ultimoEditor: userProfile?.nome || '',
        };

        let willBeBaixado = status === 'Aprovado' || status === 'Entregue';
        orcamentoData.estoqueBaixado = willBeBaixado;

        if (willBeBaixado) {
           orcamentoData.statusPagamento = statusPagamento;
        } else {
           orcamentoData.statusPagamento = null as any;
        }
        
        if (!editingOrcamentoId) {
           orcamentoData.createdAt = serverTimestamp() as any;
           orcamentoData.numero = Math.max(0, ...orcamentos.map(o => o.numero || 0)) + 1;
        }

      try {
         const batch = writeBatch(db);
         const orcRef = editingOrcamentoId ? doc(db, 'orcamentos', editingOrcamentoId) : doc(collection(db, 'orcamentos'));
         
         const deltas: Record<string, number> = {};

         if (editingOrcamentoId && estoqueBaixado) {
           const orcAntigo = orcamentos.find(o => o.id === editingOrcamentoId);
           orcAntigo?.materiaisEstoque?.forEach(mat => {
             if (mat.materialId) {
               deltas[mat.materialId] = (deltas[mat.materialId] || 0) + mat.quantidade;
             }
           });
         }

         if (willBeBaixado) {
           materiaisEstoque.forEach(mat => {
             if (mat.materialId) {
               deltas[mat.materialId] = (deltas[mat.materialId] || 0) - (Number(mat.quantidade) || 0);
             }
           });
         }

         Object.keys(deltas).forEach(matId => {
           const delta = deltas[matId];
           if (delta !== 0) {
             const estRef = doc(db, 'estoque', matId);
             const estAtual = estoqueDB.find(e => e.id === matId);
             batch.update(estRef, { 
               utilizados: Math.max(0, (estAtual?.utilizados || 0) - delta)
             });
           }
         });

         if (editingOrcamentoId) {
            batch.update(orcRef, orcamentoData);
         } else {
            batch.set(orcRef, orcamentoData);
         }
         
         await batch.commit();

      } catch (err: any) {
         console.error("Save failed, using local fallback: ", err); handleFirestoreError(err, editingOrcamentoId ? OperationType.UPDATE : OperationType.CREATE, 'orcamentos', currentUser?.uid, currentUser?.email);
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
     setAliquotaNF(Number(configGerais?.aliquotaNF || 0));
     setStatus('Em Aberto');
     setStatusPagamento('Aguardando');
     setImagemUrl('');
     setLinkNotaFiscal('');
     setMateriaisEstoque([]);
     setEstoqueBaixado(false);
  };

  const addMaterialEstoque = () => {
    setMateriaisEstoque([...materiaisEstoque, { materialId: '', nome: '', quantidade: '' }]);
  };

  const updateMaterialEstoque = (index: number, field: string, value: string) => {
    const newItems = [...materiaisEstoque];
    if (field === 'materialId') {
      const e = estoqueDB.find(item => item.id === value);
      newItems[index].materialId = value;
      newItems[index].nome = e?.nome || '';
    } else if (field === 'quantidade') {
      newItems[index].quantidade = value;
    }
    setMateriaisEstoque(newItems);
  };

  const removeMaterialEstoque = (index: number) => {
    const newItems = [...materiaisEstoque];
    newItems.splice(index, 1);
    setMateriaisEstoque(newItems);
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
    if (s !== 'aprovado' && s !== 'entregue' && s !== 'recusado') {
      return <span className="text-mesaninas-green/40 font-bold">-</span>;
    }
    if (statusPagamento?.toLowerCase() === 'pago') {
       return <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-emerald-500 text-white">PAGO</span>;
    }
    return <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-red-500 text-white">NÃO</span>;
  };

  const filteredOrcamentos = orcamentos.filter(orc => {
    const term = searchTerm.toLowerCase();
    const cliente = orc.clienteNome?.toLowerCase() || '';
    const evento = orc.nomeEvento?.toLowerCase() || '';
    return cliente.includes(term) || evento.includes(term);
  });

  return (
    <div className="flex flex-col h-full relative gap-6">
      {error && (
        <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2 shadow-sm shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          {error}
        </div>
      )}

      {/* Header Actions & Switcher */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 w-full">
        
        {/* View Mode Pill Switcher & Search */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-4">
          <div className="flex items-center bg-white rounded-md border border-mesaninas-creme/60 max-w-max shadow-sm relative h-12 lg:h-10 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`relative z-10 px-6 h-full flex items-center justify-center text-xs font-bold rounded-md transition-all duration-300 ${
                viewMode === 'list'
                  ? 'bg-mesaninas-green text-mesaninas-creme shadow-sm'
                  : 'bg-white text-mesaninas-green hover:bg-[#00382b]/5'
              }`}
            >
              Visualização em Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`relative z-10 px-6 h-full flex items-center justify-center text-xs font-bold rounded-md transition-all duration-300 ${
                viewMode === 'kanban'
                  ? 'bg-mesaninas-green text-mesaninas-creme shadow-sm'
                  : 'bg-white text-mesaninas-green hover:bg-[#00382b]/5'
              }`}
            >
              Funil de Vendas (Kanban)
            </button>
          </div>
          
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Buscar orçamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 lg:h-10 pl-10 pr-4 bg-white border border-mesaninas-creme rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <span className="text-lg leading-none">+</span> <span>Novo Orçamento</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === 'list' ? (
           <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm flex-1 w-full flex flex-col overflow-hidden">
             <div className="flex-1 w-full bg-mesaninas-creme/5 overflow-auto">
               {/* DESKTOP TABLE */}
               <table className="hidden lg:table w-full text-left border-collapse text-sm">
                 <thead className="bg-[#f4efdc]/30 text-[10px] uppercase tracking-wider font-bold text-[#00382b]/60 sticky top-0 z-10 shadow-sm">
                   <tr className="border-b border-[#f4efdc]/50">
                     <th className="px-6 py-3 font-semibold">Cliente / Evento</th>
                     <th className="px-6 py-3 font-semibold text-center">Data</th>
                     <th className="px-6 py-3 font-semibold text-center">Convidados</th>
                     <th className="px-6 py-3 font-semibold text-right">Valor Venda</th>
                     <th className="px-6 py-3 font-semibold text-center">Status</th>
                     <th className="px-6 py-3 font-semibold text-center">Pagamento</th>
                     <th className="px-6 py-3 font-semibold text-center w-24">Auditoria</th>
                     <th className="px-6 py-3 font-semibold text-right">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-mesaninas-creme/50">
                   {loading ? (
                     <tr>
                       <td colSpan={8} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
                     </tr>
                   ) : filteredOrcamentos.length === 0 ? (
                     <tr>
                       <td colSpan={8} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum orçamento gerado.</td>
                     </tr>
                   ) : (
                     filteredOrcamentos.map((orc) => (
                       <tr key={orc.id} className="hover:bg-mesaninas-creme/30 group">
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-2 mb-0.5">
                               {orc.numero && <span className="bg-[#00382b]/10 text-[#00382b] text-[9px] font-black px-1.5 py-0.5 rounded-md">#{orc.numero}</span>}
                               <div className="font-bold uppercase tracking-wider text-xs text-mesaninas-green group-hover:text-mesaninas-green/80 transition-colors">{orc.clienteNome}</div>
                            </div>
                            <div className="text-[10px] text-mesaninas-green/60 mt-1 line-clamp-1 max-w-sm normal-case tracking-normal font-normal">
                               {orc.nomeEvento || 'Evento não nomeado'}
                            </div>
                         </td>
                         <td className="px-6 py-4 text-center text-mesaninas-green/80">
                           {formatDate(orc.dataEvento)}
                         </td>
                         <td className="px-6 py-4 text-center">
                           <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                              {orc.numConvidados} pessoas
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
                         <td className="px-6 py-4 text-center text-xs text-mesaninas-green/50">
                            {orc.ultimoEditor ? `por ${orc.ultimoEditor.split(' ')[0]}` : '-'}
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
                   ) : filteredOrcamentos.length === 0 ? (
                     <div className="text-center text-mesaninas-green/50 text-sm py-8">Nenhum orçamento encontrado.</div>
                   ) : (
                     filteredOrcamentos.map((orc) => (
                       <div key={orc.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                         <div className="flex justify-between items-start gap-2 border-b border-mesaninas-creme/50 pb-3 mb-1">
                           <div>
                             <div className="flex items-center gap-2 mb-0.5">
                               <div className="text-[10px] uppercase font-bold text-mesaninas-green/50">Cliente</div>
                               {orc.numero && <span className="bg-[#00382b]/10 text-[#00382b] text-[9px] font-black px-1.5 py-0.5 rounded-md">#{orc.numero}</span>}
                             </div>
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
                           {formatDate(orc.dataEvento)} • {orc.numConvidados} pessoas
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
            </div>
          ) : (
             /* KANBAN CRM VIEW */
             <div className="flex-1 w-full flex flex-col pt-2">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full flex-1 items-start pb-4">
                 {KANBAN_COLUMNS.map((col) => {
                    const colOrcamentos = filteredOrcamentos.filter(orc => {
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
                          <div className="flex-1 p-3 flex flex-col gap-3.5 overflow-y-auto">
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
                                    className="w-full bg-white border border-mesaninas-creme/80 hover:border-mesaninas-green/50 hover:shadow-md transition-all rounded-xl text-xs flex flex-col cursor-grab active:cursor-grabbing group shadow-sm overflow-hidden"
                                  >
                                     {/* Novo Cabeçalho do Card (Top Bar) */}
                                     <div className="flex items-center justify-between px-4 py-3 bg-mesaninas-green/10 border-b border-mesaninas-green/20">
                                        <div className="flex-1 truncate overflow-hidden pr-2 flex items-center gap-2">
                                           <h4 className="font-bold text-mesaninas-green text-xs truncate" title={orc.nomeEvento || 'Serviço de Buffet'}>
                                              {orc.nomeEvento || 'Serviço de Buffet'}
                                           </h4>
                                        </div>
                                        <div className="flex gap-3 shrink-0 opacity-60 group-hover:opacity-100 transition-all items-center">
                                           <button 
                                             onClick={() => openEditModal(orc)}
                                             className="hover:text-mesaninas-yellow transition-colors"
                                             title="Editar"
                                           >
                                              <Pencil className="w-3.5 h-3.5" />
                                           </button>
                                           <button 
                                             onClick={() => requestDelete(orc.id)}
                                             className="hover:text-red-500 transition-colors"
                                             title="Excluir"
                                           >
                                              <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                           <button 
                                             onClick={() => setPrintOrcamento(orc)}
                                             className="hover:text-emerald-600 transition-colors"
                                             title="Gerar Proposta"
                                           >
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                                              </svg>
                                           </button>
                                        </div>
                                     </div>
                                     
                                     {/* Corpo do Card (Conteúdo Branco) */}
                                     <div className="p-4 flex flex-col gap-2 bg-white">
                                        <div className="flex justify-between items-start">
                                           <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                              {orc.numero && <span className="shrink-0 bg-[#00382b]/10 text-[#00382b] text-[9px] font-black px-1.5 py-0.5 rounded-md">#{orc.numero}</span>}
                                              <span className="font-semibold text-xs text-mesaninas-green/80 truncate pr-2" title={orc.clienteNome}>{orc.clienteNome}</span>
                                           </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mesaninas-green/70">
                                           <span className="flex items-center gap-1">📅 {formatDate(orc.dataEvento)}</span>
                                           <span className="flex items-center gap-1">👥 {orc.numConvidados} pessoas</span>
                                        </div>

                                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-mesaninas-creme/65">
                                           <div className="flex flex-col flex-1 pr-2">
                                              {orc.statusPagamento?.toLowerCase() === 'pago' && (
                                                 <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md shrink-0 uppercase w-fit">Pago</span>
                                              )}
                                           </div>
                                           
                                           <div className="flex flex-col items-end gap-1.5 shrink-0">
                                              <span className="font-extrabold text-[#748e72] text-[14px]">
                                                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.valorVenda)}
                                              </span>
                                           </div>
                                        </div>
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
      {/* </div> removed */}

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
              <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight flex items-center gap-3">
                   <span>{editingOrcamentoId ? 'Editar Orçamento' : 'Novo Orçamento'}</span>
                   {editingOrcamentoId && (
                     <span className="bg-[#00382b]/10 text-[#00382b] text-xs font-black px-2 py-1 rounded-md">
                       #{orcamentos.find(o => o.id === editingOrcamentoId)?.numero || 'S/N'}
                     </span>
                   )}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">Configuração de evento comercial</p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-2xl font-bold p-2 h-12 w-12 flex items-center justify-center -mr-2 transition-colors"
                title="Fechar"
              >×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 bg-white">
              <div className="w-full max-w-7xl mx-auto">
              
              {/* Infos Básicas */}
              <div className="mb-6 space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Informações do Evento</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Select de Cliente */}
                  <div className="col-span-1 lg:col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Cliente</label>
                    <select
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
                  <div className="col-span-1 md:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Nome do Evento*</label>
                    <input
                      type="text"
                      required
                      value={nomeEvento}
                      onChange={e => setNomeEvento(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="Ex: Reunião de Diretoria, Festa de Fim de Ano..."
                    />
                  </div>
                </div>
                  
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Datas e Horários */}
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Data do Evento</label>
                    <input
                      type="date"
                      value={dataEvento}
                      onChange={e => setDataEvento(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Convidados</label>
                    <input
                      type="number"
                      min="1"
                      value={numConvidados}
                      onChange={e => setNumConvidados(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="Ex: 50"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Hora Início</label>
                    <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Hora Fim</label>
                    <input type="time" value={horaTermino} onChange={e=>setHoraTermino(e.target.value)} className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" />
                  </div>
                </div>

                <div className="w-full space-y-2 mt-2">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-mesaninas-creme/50 mt-4">
                     <div className="col-span-1">
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
                     {(status === 'Aprovado' || status === 'Entregue' || status === 'Recusado') && (
                        <div className="col-span-1 lg:col-span-2">
                           <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Status de Pagamento</label>
                           <div className="flex gap-4 mt-2 h-10 items-center">
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
              <div className="mb-6 space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl overflow-visible">
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
                              const isSelected = !!pratosSelecionados.find(p => p.pratoId === prato.id);
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
                                       <span className="text-[10px] opacity-70">
                                          R$ {prato.fornecedoresCustos?.[0]?.custo?.toFixed(2) || '0.00'} / {prato.tipoVenda}
                                       </span>
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
                   <ul className="mt-4 space-y-3">
                      {pratosSelecionados.map((prato) => {
                         const pratoRef = pratosDB.find(p => p.id === prato.pratoId);
                         
                         const convidados = Number(numConvidados) || 0;
                         const rendimento = Number(prato.rendimento) || 1;
                         const tipoVenda = prato.tipoVenda || 'Por Quilo';
                         let fatorDeMultiplicacao = tipoVenda === 'Por Unidade' ? convidados * rendimento : convidados / rendimento;
                         if (prato.quantidadeOverride !== undefined && prato.quantidadeOverride > 0) {
                            fatorDeMultiplicacao = prato.quantidadeOverride;
                         }
                         const custoTotalPrato = fatorDeMultiplicacao * (prato.custo || 0);

                         return (
                         <li key={prato.pratoId} className="flex flex-col gap-2 text-sm bg-mesaninas-creme/20 px-3 py-3 rounded-lg border border-mesaninas-creme/50 mt-1">
                            <div className="flex items-center justify-between border-b border-mesaninas-creme/30 pb-2 mb-1 gap-3">
                              <div className="flex items-center gap-3">
                                {prato.imagemUrl && (
                                  <div className="w-10 h-10 rounded-md overflow-hidden border border-mesaninas-creme shrink-0 shadow-sm">
                                    <img src={prato.imagemUrl} alt={prato.nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <span className="font-bold text-mesaninas-green">{prato.nome}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-bold text-mesaninas-green">{custoTotalPrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                <button type="button" onClick={() => setPratosSelecionados(prev => prev.filter(p => p.pratoId !== prato.pratoId))} className="text-mesaninas-peach hover:text-red-500 font-bold p-1 rounded transition-colors w-8 h-8 flex items-center justify-center bg-white shadow-sm border border-mesaninas-creme/50 hover:border-red-200">×</button>
                              </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-4 mt-1">
                               {pratoRef && pratoRef.fornecedoresCustos && pratoRef.fornecedoresCustos.length > 0 && (
                                 <div className="flex flex-col gap-1 flex-1">
                                   <label className="text-[10px] font-bold text-mesaninas-green/60 uppercase tracking-wider">Fornecedor Selecionado</label>
                                   <select 
                                     value={prato.fornecedorId || ''}
                                     onChange={(e) => updatePratoFornecedor(prato.pratoId, e.target.value)}
                                     className="text-xs bg-white border border-mesaninas-creme/80 rounded px-2 h-8 text-mesaninas-green font-medium focus:outline-none focus:ring-1 focus:ring-mesaninas-yellow"
                                   >
                                     <option value="" disabled>Escolha um fornecedor...</option>
                                     {pratoRef.fornecedoresCustos.map(fc => (
                                       <option key={fc.fornecedorId} value={fc.fornecedorId}>
                                         {fc.nome?.toUpperCase()} - R$ {fc.custo.toFixed(2)}
                                       </option>
                                     ))}
                                   </select>
                                 </div>
                               )}
                               
                               <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-bold text-mesaninas-green/60 uppercase tracking-wider">Quant. do Prato/Produto</label>
                                 <div className="flex items-center gap-2">
                                   <input 
                                     type="number" 
                                     min="0" 
                                     step="any"
                                     value={prato.quantidadeOverride !== undefined ? prato.quantidadeOverride : ''}
                                     onChange={(e) => updatePratoQuantidade(prato.pratoId, e.target.value)}
                                     placeholder={(()=>{
                                         const c = Number(numConvidados) || 0;
                                         const r = Number(prato.rendimento) || 1;
                                         const calculated = prato.tipoVenda === 'Por Unidade' ? c * r : c / r;
                                         return String(calculated);
                                     })()}
                                     className="w-24 text-center text-xs bg-white border border-mesaninas-creme/80 rounded h-8 text-mesaninas-green font-medium focus:outline-none focus:ring-1 focus:ring-mesaninas-yellow placeholder:text-mesaninas-green/40"
                                   />
                                   <span className="text-[10px] text-mesaninas-green/60">
                                     {prato.tipoVenda === 'Por Unidade' ? 'un' : 'kg'} <span className="opacity-60">(auto se vazio)</span>
                                   </span>
                                 </div>
                               </div>
                            </div>
                         </li>
                         );
                      })}
                   </ul>
                )}
              </div>
              
              {/* Materiais e Insumos de Estoque */}
              <div className="mb-6 flex flex-col gap-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-mesaninas-green/80">Materiais e Insumos de Estoque</h4>
                  <button type="button" onClick={addMaterialEstoque} className="text-xs font-bold bg-mesaninas-creme/50 hover:bg-mesaninas-creme text-mesaninas-green px-3 py-1.5 rounded-md transition-colors">
                    + Adicionar Material
                  </button>
                </div>
                {materiaisEstoque.length === 0 ? (
                  <div className="text-xs text-mesaninas-green/50 text-center py-4 border border-dashed border-mesaninas-creme rounded-lg">Nenhum material selecionado.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden lg:grid grid-cols-[1fr_100px_100px_40px] gap-2 mb-1 px-1">
                       <span className="text-[10px] font-bold text-mesaninas-green/60 uppercase">Item do Estoque</span>
                       <span className="text-[10px] font-bold text-mesaninas-green/60 uppercase text-center">Quant. Necessária</span>
                       <span className="text-[10px] font-bold text-mesaninas-green/60 uppercase text-right">Qtd. Disponível</span>
                       <span></span>
                    </div>
                    {materiaisEstoque.map((mat, idx) => {
                       const estItem = estoqueDB.find(e => e.id === mat.materialId);
                       const qtdDisp = estItem ? (estItem.quantidade - (estItem.utilizados || 0)) : 0;
                       const matQtd = Number(mat.quantidade) || 0;
                       const isWarning = matQtd > qtdDisp;
                       return (
                       <div key={idx} className="flex flex-col lg:grid lg:grid-cols-[1fr_100px_100px_40px] gap-2 items-start lg:items-center p-3 lg:p-0 border border-mesaninas-creme/50 lg:border-transparent rounded-md lg:rounded-none bg-mesaninas-creme/10 lg:bg-transparent">
                          <select value={mat.materialId} onChange={e => updateMaterialEstoque(idx, 'materialId', e.target.value)} className="w-full lg:w-auto px-3 h-10 border border-mesaninas-creme rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-mesaninas-yellow">
                             <option value="" disabled>Selecione...</option>
                             {estoqueDB.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                          </select>
                          <div className="w-full lg:w-auto relative focus-within:z-10 mt-1 lg:mt-0">
                            <label className="lg:hidden text-[10px] text-mesaninas-green/60 font-bold uppercase mb-1 block">Quant. Necessária</label>
                            <input type="number" min="1" step="1" value={mat.quantidade} onChange={e => updateMaterialEstoque(idx, 'quantidade', e.target.value)} className={`w-full px-3 h-10 border rounded bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-mesaninas-yellow ${isWarning ? 'border-red-400 text-red-600 font-bold bg-red-50/50' : 'border-mesaninas-creme'}`} placeholder="Qtd" />
                          </div>
                          <div className="w-full lg:w-auto text-center lg:text-right text-xs font-bold text-mesaninas-green flex justify-between lg:block mt-1 lg:mt-0">
                            <span className="lg:hidden text-[10px] uppercase text-mesaninas-green/60">Disponível:</span>
                            {qtdDisp} {estItem?.unidadeMedida || ''}
                          </div>
                          <button type="button" onClick={() => removeMaterialEstoque(idx)} className="mt-2 lg:mt-0 p-2 w-full lg:w-10 h-10 text-red-500 hover:bg-red-50 rounded transition-colors flex items-center justify-center shrink-0 border border-red-100 lg:border-transparent bg-white lg:bg-transparent">
                             <Trash2 className="w-4 h-4" />
                          </button>
                          {isWarning && (
                            <div className="col-span-full text-[10px] text-red-500 font-bold mt-1">Alerta: Quantidade superior ao estoque atual.</div>
                          )}
                       </div>
                    )})}
                  </div>
                )}
              </div>
              
              {/* Custos Operacionais & Margem */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                 {/* Custos Operacionais */}
                 <div className="flex flex-col gap-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl h-full">
                    <div>
                       <h4 className="text-xs font-bold uppercase tracking-wider text-mesaninas-green/80 mb-3 block">Custos Operacionais e Logística</h4>
                       {(() => {
                         const custosCategorias = configGerais?.custosCategorias || defaultCostCategories;
                         return custosExtras.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center mb-2">
                                <select 
                                  value={item.descricao} 
                                  onChange={(e) => updateCustoExtraDesc(index, e.target.value)} 
                                  className="flex-1 px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" 
                                >
                                  <option value="">Selecione categoria...</option>
                                  {custosCategorias.map(cat => (
                                    <option key={cat.id} value={cat.nome}>
                                      {cat.nome}
                                    </option>
                                  ))}
                                  {item.descricao && !custosCategorias.some((c: any) => c.nome === item.descricao) && (
                                    <option value={item.descricao}>{item.descricao}</option>
                                  )}
                                </select>
                                <input 
                                  type="text" 
                                  inputMode="numeric"
                                  value={item.valor} 
                                  onChange={(e) => updateCustoExtraValor(index, e.target.value)} 
                                  className="w-28 sm:w-32 px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green" 
                                  placeholder="R$ 0,00" 
                                />
                                <button type="button" onClick={() => removeCustoExtra(index)} className="p-2 text-mesaninas-green/50 hover:text-red-500 transition-colors shrink-0">
                                   <Trash2 className="w-5 h-5 lg:w-4 lg:h-4" />
                                </button>
                            </div>
                         ));
                       })()}
                       <Button 
                         type="button" 
                         onClick={addCustoExtra} 
                         variant="outline"
                         size="sm"
                         className="mt-2 h-9 text-xs"
                       >
                         + Adicionar Custo Extra
                       </Button>
                    </div>
                    
                    <div className="pt-4 border-t border-mesaninas-creme/50 mt-auto grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Margem de Lucro (%)</label>
                          <div className="relative w-full">
                             <input
                               type="number"
                               min="0"
                               max="100"
                               value={margemLucro}
                               onChange={e => setMargemLucro(e.target.value ? Number(e.target.value) : '')}
                               className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green pr-8"
                             />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mesaninas-green/50 font-bold">%</span>
                          </div>
                       </div>
                       <div>
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Impostos NF (%)</label>
                          <div className="relative w-full">
                             <input
                               type="number"
                               min="0"
                               max="100"
                               value={aliquotaNF}
                               onChange={e => setAliquotaNF(e.target.value ? Number(e.target.value) : '')}
                               className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green pr-8"
                             />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mesaninas-green/50 font-bold">%</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Reactive Live Calculator */}
                 <div className="bg-mesaninas-green rounded-xl p-5 md:p-6 text-mesaninas-creme shadow-xl h-full flex flex-col justify-center">
                 <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-yellow mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-mesaninas-yellow animate-pulse"></div>
                    Cálculo
                 </h4>
                 
                 <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-creme/70">Cardápio</span>
                       <span className="text-mesaninas-creme font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoAlimentos)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-creme/70">Custos Operacionais e Logística</span>
                       <span className="text-mesaninas-creme font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCustosExtras)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-creme/70">Materiais do Estoque</span>
                       <span className="text-mesaninas-creme font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCustosEstoque)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="font-medium text-mesaninas-creme">Custo Operacional Total</span>
                       <span className="text-mesaninas-peach font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoOperacionalTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="text-mesaninas-yellow font-medium">+ Lucro Estimado ({margem}%)</span>
                       <span className="text-mesaninas-yellow font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroEstimado)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                       <span className="font-bold text-mesaninas-creme">Subtotal (Sem imposto)</span>
                       <span className="text-white font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorSemImposto)}</span>
                    </div>
                    
                    {aliquotaNF > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-mesaninas-creme/10">
                         <span className="text-orange-300 font-medium">+ Impostos NF ({aliquotaNF}%)</span>
                         <span className="text-orange-300 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorImposto)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-end pt-4 mt-2">
                       <span className="text-xs font-bold uppercase tracking-wider text-mesaninas-creme/70">Valor Total</span>
                       <span className="text-2xl font-bold text-mesaninas-green bg-mesaninas-yellow px-3 py-1 rounded-lg border border-mesaninas-yellow/50">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorVendaSugerido)}
                       </span>
                    </div>
                 </div>
              </div>
              
              </div>
              
              {/* Anexos e Notas Fiscais */}
              <div className="mb-6 space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl overflow-visible">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Anexos e Notas Fiscais</h4>
                <div className="space-y-4">
                  {linkNotaFiscal ? (
                    <div className="flex flex-col gap-2">
                       <p className="text-sm text-mesaninas-green/80">Nota fiscal já anexada:</p>
                       <div className="flex flex-wrap items-center gap-3">
                          <a href={linkNotaFiscal} target="_blank" rel="noreferrer" className="inline-block">
                             <Button type="button" variant="primary" size="sm">
                                <FileText className="w-4 h-4 mr-1.5 inline-block" /> Visualizar Nota
                             </Button>
                          </a>
                          <Button 
                             type="button" 
                             variant="outline" 
                             size="sm" 
                             onClick={handleDeleteNota}
                             disabled={isDeleting}
                             className="text-red-500 hover:text-red-700 border-red-200 hover:bg-red-50"
                          >
                             {isDeleting ? (
                                <>
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin mr-1.5 inline-block"></div>
                                  Excluindo...
                                </>
                             ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1.5 inline-block text-red-500" />
                                  Remover
                                </>
                             )}
                          </Button>
                       </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploading ? 'bg-gray-50 border-gray-300' : 'bg-white border-mesaninas-creme hover:bg-mesaninas-creme/20'}`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploading ? (
                              <>
                                <div className="w-8 h-8 rounded-full border-2 border-mesaninas-yellow border-t-transparent animate-spin mb-2"></div>
                                <p className="text-sm font-medium text-mesaninas-green/70">Enviando para o servidor...</p>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-8 h-8 text-mesaninas-green/50 mb-2" />
                                <p className="text-sm font-medium text-mesaninas-green/70">Clique ou arraste a Nota Fiscal aqui (PDF)</p>
                              </>
                            )}
                        </div>
                        <input type="file" className="hidden" accept="application/pdf" disabled={isUploading} onChange={handleUploadNota} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-mesaninas-creme/80 bg-white flex justify-end gap-3 shrink-0 rounded-b-2xl">
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
                disabled={isSubmitting || isUploading || isDeleting || !nomeEvento || materiaisEstoque.some(m => { const e = estoqueDB.find(x => x.id === m.materialId); return e && Number(m.quantidade) > (e.quantidade - (e.utilizados || 0)); })}
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
                     {printOrcamento.imagemUrl && (
                        <div className="w-full aspect-[21/9] rounded-xl overflow-hidden mb-6 border border-gray-200">
                           <img src={printOrcamento.imagemUrl} alt="Moodboard" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </div>
                     )}
                     <div className="space-y-4">
                        <div className="flex items-end justify-between border-b border-gray-100 pb-1.5 matches-print-text-dark">
                           <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-mesaninas-green">
                              Dados da Proposta Comercial e Evento
                           </h2>
                           {printOrcamento.numero && (
                              <span className="text-xs font-sans font-bold uppercase tracking-widest text-gray-400">
                                 Ordem de Serviço #{printOrcamento.numero}
                              </span>
                           )}
                        </div>
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
                              <span className="text-[10px] uppercase font-bold text-gray-400">Número de Convidados</span>
                              <span className="font-bold text-mesaninas-green text-base">{printOrcamento.numConvidados} Convidados</span>
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
                                 const pratoImg = pratoObj.imagemUrl;
                                 return (
                                    <li key={index} className="flex gap-4 items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                       <span className="w-1.5 h-1.5 rounded-full bg-mesaninas-yellow mt-2 shrink-0"></span>
                                       {pratoImg && (
                                          <div className="w-16 h-16 rounded overflow-hidden border border-gray-200 shrink-0 shadow-sm print:shadow-none">
                                             <img src={pratoImg} alt={pratoNome} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                          </div>
                                       )}
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
