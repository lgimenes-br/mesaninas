import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prato, Fornecedor } from '../types';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
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

export default function Pratos() {
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [tipoVenda, setTipoVenda] = useState<'Por Unidade' | 'Por Quilo'>('Por Unidade');
  const [precoBase, setPrecoBase] = useState('');
  const [rendimento, setRendimento] = useState<number | ''>(1);
  const [fornecedoresRelacionados, setFornecedoresRelacionados] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPrato, setEditingPrato] = useState<Prato | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingPrato(null);
    setNome('');
    setTipoVenda('Por Unidade');
    setPrecoBase('');
    setRendimento(1);
    setFornecedoresRelacionados([]);
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (prato: Prato) => {
    setEditingPrato(prato);
    setNome(prato.nome);
    setTipoVenda(prato.tipoVenda);
    setPrecoBase(formatCurrencyInput(prato.precoBase));
    setRendimento(prato.rendimento || 1);
    setFornecedoresRelacionados(prato.fornecedoresRelacionados || []);
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const requestDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'pratos', itemToDelete));
    } catch (err: any) {
      alert('Erro ao apagar: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  useEffect(() => {
    // 1. Fetch Pratos
    const unsubPratos = onSnapshot(
      collection(db, 'pratos'),
      (snapshot) => {
        const data: Prato[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Prato);
        });
        setPratos(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao buscar pratos:", err);
        setError('Não foi possível carregar os dados reais.');
        setLoading(false);
      }
    );

    const unsubFornecedores = onSnapshot(
      collection(db, 'fornecedores'),
      (snapshot) => {
        const data: Fornecedor[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Fornecedor);
        });
        setFornecedores(data);
      },
      (err) => {
        console.error("Erro ao buscar fornecedores:", err);
      }
    );

    return () => {
      unsubPratos();
      unsubFornecedores();
    };
  }, []);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !precoBase) return;

    setIsSubmitting(true);
    try {
      if (editingPrato) {
        await updateDoc(doc(db, 'pratos', editingPrato.id), {
          nome,
          tipoVenda,
          precoBase: parseCurrency(precoBase),
          rendimento: Number(rendimento) || 1,
          fornecedoresRelacionados
        });
      } else {
        await addDoc(collection(db, 'pratos'), {
          nome,
          tipoVenda,
          precoBase: parseCurrency(precoBase),
          rendimento: Number(rendimento) || 1,
          fornecedoresRelacionados
        });
      }
      setIsModalOpen(false);
      setNome('');
      setTipoVenda('Por Unidade');
      setPrecoBase('');
      setRendimento(1);
      setFornecedoresRelacionados([]);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar no Firestore: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFornecedor = (id: string) => {
    setFornecedoresRelacionados(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10">
          <h3 className="font-serif font-bold text-lg text-mesaninas-green">Nossos Pratos & Itens</h3>
          <button
            onClick={openNewModal}
            className="px-4 py-2 h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span> <span>Novo Prato</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-mesaninas-creme/10 lg:bg-transparent">
        <table className="hidden lg:table w-full text-left border-collapse text-sm">
          <thead className="bg-mesaninas-creme/50 sticky top-0 border-b border-mesaninas-creme/50 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Prato / Item</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Tipo de Venda</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Custo Base (Ideal)</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mesaninas-creme/50">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
              </tr>
            ) : pratos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum prato cadastrado.</td>
              </tr>
            ) : (
              pratos.map((prato) => (
                <tr key={prato.id} className="hover:bg-mesaninas-creme/30 group">
                  <td className="px-6 py-4">
                     <div className="font-medium text-mesaninas-green group-hover:text-mesaninas-green/80 transition-colors">{prato.nome}</div>
                     <div className="text-[10px] text-mesaninas-green/60 mt-1 uppercase tracking-wider font-bold">Rendimento: Serve {prato.rendimento || 1} pax</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                      {prato.tipoVenda}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-mesaninas-green font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prato.precoBase)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => openEditModal(prato)}
                         className="text-mesaninas-green/60 hover:text-[#e7e873] transition-colors p-1.5"
                         title="Editar"
                       >
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => requestDelete(prato.id)}
                         className="text-mesaninas-green/60 hover:text-red-500 transition-colors p-1.5"
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

        {/* MOBILE CARDS */}
        <div className="lg:hidden flex flex-col p-4 gap-4">
            {loading ? (
              <div className="text-center text-mesaninas-green/50 text-sm py-8">Carregando dados...</div>
            ) : pratos.length === 0 ? (
              <div className="text-center text-mesaninas-green/50 text-sm py-8">Nenhum prato encontrado.</div>
            ) : (
              pratos.map((prato) => (
                <div key={prato.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-bold text-mesaninas-green text-base leading-tight">{prato.nome}</div>
                      <div className="text-[10px] text-mesaninas-green/60 mt-1 uppercase tracking-wider font-bold">Rendimento: Serve {prato.rendimento || 1} pax</div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => openEditModal(prato)} className="p-1.5 text-mesaninas-green/50 hover:text-[#e7e873]">
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button onClick={() => requestDelete(prato.id)} className="p-1.5 text-mesaninas-green/50 hover:text-red-500">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                      {prato.tipoVenda}
                    </span>
                    <span className="text-mesaninas-green font-bold text-lg">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prato.precoBase)}
                    </span>
                  </div>
                </div>
              ))
            )}
        </div>
      </div>
    </div>

      {/* Modal / Drawer para Novo Prato */}
      {isModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-end z-50">
          <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-1/4 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme flex justify-between items-center bg-mesaninas-creme/30 shrink-0">
              <div>
                 <h3 className="font-bold text-mesaninas-green tracking-tight font-serif text-lg">{editingPrato ? 'Editar Item do Cardápio' : 'Novo Item do Cardápio'}</h3>
                 <p className="text-xs text-mesaninas-green/70">Adicione ao menu de vendas</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-xl font-bold p-2"
              >×</button>
            </div>
            
            <form onSubmit={handleCadastrar} className="flex-1 overflow-auto p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">Nome do Prato / Item*</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                    placeholder="Ex: Risoto de Funghi"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">Tipo de Venda*</label>
                  <select
                    value={tipoVenda}
                    onChange={e => setTipoVenda(e.target.value as any)}
                    className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                  >
                    <option value="Por Unidade">Por Unidade (Pax)</option>
                    <option value="Por Quilo">Por Quilo (Kg)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">Custo Base (R$)*</label>
                     <input
                       type="text"
                       inputMode="numeric"
                       required
                       value={precoBase}
                       onChange={e => setPrecoBase(formatCurrencyInput(e.target.value))}
                       className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                       placeholder="R$ 0,00"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">
                       {tipoVenda === 'Por Unidade' ? 'Quantidade por Pessoa*' : 'Rendimento (Pessoas)*'}
                     </label>
                     <input
                       type="number"
                       min="1"
                       step="1"
                       required
                       value={rendimento}
                       onChange={e => setRendimento(Number(e.target.value) || 1)}
                       className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                       placeholder={tipoVenda === 'Por Unidade' ? 'Ex: 4 (Significa que 1 pessoa consome 4 unidades)' : 'Ex: 10 (Significa que 1 unidade/kg serve 10 pessoas)'}
                       title={tipoVenda === 'Por Unidade' ? 'Ex: 4 (Significa que 1 pessoa consome 4 unidades)' : 'Ex: 10 (Significa que 1 unidade/kg serve 10 pessoas)'}
                     />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">
                    Fornecedores Homologados
                  </label>
                  <div className="relative">
                    <div
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow cursor-pointer flex justify-between items-center"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span className="truncate text-mesaninas-green">
                        {fornecedoresRelacionados.length > 0 
                          ? `${fornecedoresRelacionados.length} fornecedor(es) selecionado(s)` 
                          : 'Selecione fornecedores...'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-mesaninas-green/50" />
                    </div>
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-mesaninas-creme rounded-md shadow-lg z-10">
                        {fornecedores.length === 0 ? (
                          <div className="p-3 text-xs text-mesaninas-green/50">Nenhum fornecedor cadastrado.</div>
                        ) : (
                          fornecedores.map(forn => (
                            <label key={forn.id} className="flex items-center gap-2 p-3 hover:bg-mesaninas-creme/20 cursor-pointer border-b border-mesaninas-creme/30 last:border-0">
                              <input
                                type="checkbox"
                                checked={fornecedoresRelacionados.includes(forn.id)}
                                onChange={() => toggleFornecedor(forn.id)}
                                className="text-mesaninas-yellow focus:ring-mesaninas-yellow h-4 w-4 rounded border-mesaninas-creme"
                              />
                              <span className="text-sm text-mesaninas-green truncate">{forn.nome}</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>
            
            <div className="px-6 py-4 border-t border-mesaninas-creme bg-white flex justify-end gap-3 shrink-0 pb-safe">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 h-12 lg:h-10 text-sm font-medium text-mesaninas-green/70 hover:text-mesaninas-green transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleCadastrar}
                disabled={isSubmitting || !nome || !precoBase}
                className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : (editingPrato ? 'Atualizar Prato' : 'Salvar Prato')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDeleteModal
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
