import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ItemEstoque, Fornecedor } from '../types';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export default function Estoque() {
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('Unidade');
  const [quantidade, setQuantidade] = useState('');
  const [fornecedoresRelacionados, setFornecedoresRelacionados] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingItem(null);
    setNome('');
    setUnidade('Unidade');
    setQuantidade('');
    setFornecedoresRelacionados([]);
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ItemEstoque) => {
    setEditingItem(item);
    setNome(item.nome);
    setUnidade(item.unidadeMedida);
    setQuantidade(item.quantidade.toString());
    setFornecedoresRelacionados(item.fornecedoresRelacionados || []);
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
      await deleteDoc(doc(db, 'estoque', itemToDelete));
    } catch (err: any) {
      alert('Erro ao apagar: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  useEffect(() => {
    // Escuta em tempo real da coleção "estoque"
    const unsubscribeEstoque = onSnapshot(
      collection(db, 'estoque'),
      (snapshot) => {
        const data: ItemEstoque[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as ItemEstoque);
        });
        setEstoque(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao buscar estoque:", err);
        setError('Não foi possível carregar os dados.');
        setLoading(false);
      }
    );

    const unsubscribeFornecedores = onSnapshot(
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
      unsubscribeEstoque();
      unsubscribeFornecedores();
    };
  }, []);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !unidade || !quantidade) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'estoque', editingItem.id), {
          nome,
          unidadeMedida: unidade,
          quantidade: parseFloat(quantidade),
          fornecedoresRelacionados
        });
      } else {
        await addDoc(collection(db, 'estoque'), {
          nome,
          unidadeMedida: unidade,
          quantidade: parseFloat(quantidade),
          fornecedoresRelacionados
        });
      }
      setIsModalOpen(false);
      setNome('');
      setUnidade('Unidade');
      setQuantidade('');
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
          <h3 className="font-serif font-bold text-lg text-mesaninas-green">Controle de Estoque</h3>
          <button
            onClick={openNewModal}
            className="px-4 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span> <span>Novo Item</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-mesaninas-creme/10 lg:bg-transparent">
        <table className="hidden lg:table w-full text-left border-collapse text-sm">
          <thead className="bg-mesaninas-creme/50 sticky top-0 border-b border-mesaninas-creme/50 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Item</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Unidade</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Qtd Disponível</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mesaninas-creme/50">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
              </tr>
            ) : estoque.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum item cadastrado.</td>
              </tr>
            ) : (
              estoque.map((item) => (
                <tr key={item.id} className="hover:bg-mesaninas-creme/30 group">
                  <td className="px-6 py-4 font-medium text-mesaninas-green group-hover:text-mesaninas-green/80 transition-colors">
                    {item.nome}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                      {item.unidadeMedida}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-mesaninas-green">
                    {item.quantidade}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => openEditModal(item)}
                         className="text-mesaninas-green/60 hover:text-[#e7e873] transition-colors p-1.5"
                         title="Editar"
                       >
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => requestDelete(item.id)}
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
            ) : estoque.length === 0 ? (
              <div className="text-center text-mesaninas-green/50 text-sm py-8">Nenhum item encontrado.</div>
            ) : (
              estoque.map((item) => (
                <div key={item.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-4">
                    <div className="font-bold text-mesaninas-green text-base leading-tight">{item.nome}</div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => openEditModal(item)} className="p-1.5 text-mesaninas-green/50 hover:text-[#e7e873]">
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button onClick={() => requestDelete(item.id)} className="p-1.5 text-mesaninas-green/50 hover:text-red-500">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                     <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                        {item.unidadeMedida}
                     </span>
                     <span className="text-mesaninas-green font-bold text-lg">{item.quantidade}</span>
                  </div>
                </div>
              ))
            )}
        </div>
      </div>
    </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
              <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight">
                   {editingItem ? 'Editar Item' : 'Cadastrar Item'}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">Controle de insumos e materiais do estoque</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-2xl font-bold p-2 h-12 w-12 flex items-center justify-center -mr-2 transition-colors"
                title="Fechar"
              >×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 bg-white">
              <form onSubmit={handleCadastrar} className="w-full max-w-7xl mx-auto space-y-6" id="estoqueForm">
                
                <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Dados do Item</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Nome do Item*
                      </label>
                      <input
                        type="text"
                        required
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                        placeholder="Ex: Copos Descartáveis"
                      />
                    </div>
                    
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Unidade de Medida*
                      </label>
                      <select
                        value={unidade}
                        onChange={e => setUnidade(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      >
                        <option value="Unidade">Unidade (Un)</option>
                        <option value="Caixa">Caixa</option>
                        <option value="Pacote">Pacote</option>
                        <option value="Kg">Quilograma (Kg)</option>
                        <option value="L">Litro (L)</option>
                      </select>
                    </div>
                    
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Quantidade Incial*
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={quantidade}
                        onChange={e => setQuantidade(e.target.value)}
                        className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Fornecimento</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                        Fornecedores Homologados
                      </label>
                      <div className="relative">
                        <div
                          className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green cursor-pointer flex justify-between items-center"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                          <span className="truncate">
                            {fornecedoresRelacionados.length > 0 
                              ? `${fornecedoresRelacionados.length} fornecedor(es) selecionado(s)` 
                              : 'Selecione os fornecedores...'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-mesaninas-green/50" />
                        </div>
                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-mesaninas-creme rounded-md shadow-lg z-10">
                            {fornecedores.length === 0 ? (
                              <div className="p-4 text-sm text-mesaninas-green/50 text-center">Nenhum fornecedor cadastrado.</div>
                            ) : (
                              fornecedores.map(forn => (
                                <label key={forn.id} className="flex items-center gap-3 p-3 hover:bg-mesaninas-creme/20 cursor-pointer border-b border-mesaninas-creme/30 last:border-0">
                                  <input
                                    type="checkbox"
                                    checked={fornecedoresRelacionados.includes(forn.id)}
                                    onChange={() => toggleFornecedor(forn.id)}
                                    className="text-mesaninas-yellow focus:ring-mesaninas-yellow h-5 w-5 rounded border-mesaninas-creme cursor-pointer"
                                  />
                                  <span className="text-sm font-medium text-mesaninas-green truncate">{forn.nome}</span>
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>
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
                form="estoqueForm"
                disabled={isSubmitting}
                className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : (editingItem ? 'Atualizar Item' : 'Salvar Item')}
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
