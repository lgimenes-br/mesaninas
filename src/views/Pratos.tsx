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
  const [rendimento, setRendimento] = useState<number | ''>(1);
  const [fornecedoresCustos, setFornecedoresCustos] = useState<{fornecedorId: string, nome: string, custo: string}[]>([]);
  const [imagemUrl, setImagemUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPrato, setEditingPrato] = useState<Prato | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingPrato(null);
    setNome('');
    setTipoVenda('Por Unidade');
    setRendimento(1);
    setFornecedoresCustos([]);
    setImagemUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (prato: Prato) => {
    setEditingPrato(prato);
    setNome(prato.nome);
    setTipoVenda(prato.tipoVenda);
    setRendimento(prato.rendimento || 1);
    setImagemUrl(prato.imagemUrl || '');
    setFornecedoresCustos((prato.fornecedoresCustos || []).map(fc => ({
      ...fc,
      custo: formatCurrencyInput(fc.custo)
    })));
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
    if (!nome) return;

    // Validate fornecedoresCustos
    const parsedCustos = fornecedoresCustos
      .filter(fc => fc.fornecedorId && fc.custo)
      .map(fc => ({
        fornecedorId: fc.fornecedorId,
        nome: fc.nome,
        custo: parseCurrency(fc.custo)
      }));

    setIsSubmitting(true);
    try {
      if (editingPrato) {
        await updateDoc(doc(db, 'pratos', editingPrato.id), {
          nome,
          tipoVenda,
          rendimento: Number(rendimento) || 1,
          fornecedoresCustos: parsedCustos,
          imagemUrl
        });
      } else {
        await addDoc(collection(db, 'pratos'), {
          nome,
          tipoVenda,
          rendimento: Number(rendimento) || 1,
          fornecedoresCustos: parsedCustos,
          imagemUrl
        });
      }
      setIsModalOpen(false);
      setNome('');
      setTipoVenda('Por Unidade');
      setRendimento(1);
      setFornecedoresCustos([]);
      setImagemUrl('');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar no Firestore: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFornecedorCusto = () => {
    setFornecedoresCustos([...fornecedoresCustos, { fornecedorId: '', nome: '', custo: '' }]);
  };

  const updateFornecedorCusto = (index: number, field: string, value: string) => {
    const newItems = [...fornecedoresCustos];
    if (field === 'fornecedorId') {
      const f = fornecedores.find(f => f.id === value);
      newItems[index].fornecedorId = value;
      newItems[index].nome = f?.nome || '';
    } else if (field === 'custo') {
       newItems[index].custo = formatCurrencyInput(value);
    }
    setFornecedoresCustos(newItems);
  };

  const removeFornecedorCusto = (index: number) => {
    const newItems = [...fornecedoresCustos];
    newItems.splice(index, 1);
    setFornecedoresCustos(newItems);
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
              <th className="w-16 px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Foto</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Prato / Item</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Tipo de Venda</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Fornecedores</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mesaninas-creme/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
              </tr>
            ) : pratos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum prato cadastrado.</td>
              </tr>
            ) : (
              pratos.map((prato) => (
                <tr key={prato.id} className="hover:bg-mesaninas-creme/30 group">
                  <td className="px-6 py-4">
                    {prato.imagemUrl ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-mesaninas-creme shadow-sm bg-white shrink-0">
                        <img src={prato.imagemUrl} alt={prato.nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-mesaninas-creme bg-mesaninas-creme/20 flex flex-col items-center justify-center text-mesaninas-green/30 shrink-0">
                        <span className="text-[10px] uppercase font-bold leading-none">Sem</span>
                        <span className="text-[10px] uppercase font-bold leading-none mt-0.5">Foto</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                     <div className="font-medium text-mesaninas-green group-hover:text-mesaninas-green/80 transition-colors">{prato.nome}</div>
                     <div className="text-[10px] text-mesaninas-green/60 mt-1 uppercase tracking-wider font-bold">Serve {prato.rendimento || 1} pessoas</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                      {prato.tipoVenda}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-mesaninas-green/80 text-sm">
                    {prato.fornecedoresCustos?.length || 0} fornecedor(es)
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
                  <div className="flex gap-4">
                    {prato.imagemUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-mesaninas-creme shadow-sm shrink-0">
                        <img src={prato.imagemUrl} alt={prato.nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 flex justify-between items-start gap-4">
                      <div>
                        <div className="font-bold text-mesaninas-green text-base leading-tight">{prato.nome}</div>
                        <div className="text-[10px] text-mesaninas-green/60 mt-1 uppercase tracking-wider font-bold">Serve {prato.rendimento || 1} pessoas</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                         <button onClick={() => openEditModal(prato)} className="p-1.5 text-mesaninas-green/50 hover:text-[#e7e873]">
                           <Pencil className="w-4 h-4" />
                         </button>
                         <button onClick={() => requestDelete(prato.id)} className="p-1.5 text-mesaninas-green/50 hover:text-red-500">
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="px-2 py-1 bg-mesaninas-creme/50 text-mesaninas-green/80 rounded-md text-[11px] font-bold">
                      {prato.tipoVenda}
                    </span>
                    <span className="text-mesaninas-green/80 font-bold text-xs uppercase">
                      {prato.fornecedoresCustos?.length || 0} fornecedor(es)
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
              <div>
                 <h3 className="font-bold text-mesaninas-green tracking-tight font-serif text-lg">{editingPrato ? 'Editar Item do Cardápio' : 'Novo Item do Cardápio'}</h3>
                 <p className="text-xs text-mesaninas-green/70">Adicione ao menu de vendas</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-mesaninas-green/50 hover:text-mesaninas-green text-xl font-bold p-2 transition-colors"
                title="Fechar"
              >×</button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <form onSubmit={handleCadastrar} className="grid grid-cols-1 md:grid-cols-[30%_70%] h-full w-full">
                
                {/* COLUNA ESQUERDA - Imagem (30%) */}
                <div className="relative h-[30vh] md:h-full border-b md:border-b-0 md:border-r border-mesaninas-creme/50 bg-mesaninas-creme/20 overflow-hidden flex flex-col">
                  {imagemUrl ? (
                    <img src={imagemUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-mesaninas-green/40">
                       <div className="w-16 h-16 border border-dashed border-mesaninas-green/30 bg-white/50 shadow-sm rounded-full flex items-center justify-center mb-3">
                         <span className="text-2xl font-serif">?</span>
                       </div>
                       <p className="text-sm font-medium">Sem imagem</p>
                     </div>
                  )}
                  {/* Overlay URL Input */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <label className="block text-xs font-semibold text-white/90 mb-1 drop-shadow-md">URL da Imagem do Prato</label>
                      <input
                        type="url"
                        value={imagemUrl}
                        onChange={e => setImagemUrl(e.target.value)}
                        className="w-full px-3 h-10 bg-white/90 border-0 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/80 text-mesaninas-green placeholder-gray-400"
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                  </div>
                </div>

                {/* COLUNA DIREITA - Formulário (70%) */}
                <div className="overflow-y-auto h-full p-6 md:p-8 lg:p-10 flex flex-col bg-white">
                  <div className="flex-1 space-y-6 max-w-3xl">
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
                          <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">Tipo de Venda</label>
                          <select
                            value={tipoVenda}
                            onChange={e => setTipoVenda(e.target.value as any)}
                            className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                          >
                            <option value="Por Unidade">Por Unidade</option>
                            <option value="Por Quilo">Por Quilo (Kg)</option>
                          </select>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-mesaninas-green/70 mb-1">
                             {tipoVenda === 'Por Unidade' ? 'Quantidade por Pessoa' : 'Rendimento (Pessoas)'}
                           </label>
                           <input
                             type="number"
                             min="1"
                             step="1"
                             value={rendimento}
                             onChange={e => setRendimento(Number(e.target.value) || 1)}
                             className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                             placeholder={tipoVenda === 'Por Unidade' ? 'Ex: 4 (Significa que 1 pessoa consome 4 unidades)' : 'Ex: 10 (Significa que 1 unidade/kg serve 10 pessoas)'}
                             title={tipoVenda === 'Por Unidade' ? 'Ex: 4 (Significa que 1 pessoa consome 4 unidades)' : 'Ex: 10 (Significa que 1 unidade/kg serve 10 pessoas)'}
                           />
                        </div>

                        <div className="pt-4 border-t border-mesaninas-creme/50 mt-6">
                          <div className="flex justify-between items-center mb-3">
                            <label className="block text-xs font-semibold text-mesaninas-green/70">
                              Fornecedores e Custos
                            </label>
                            <button
                              type="button"
                              onClick={addFornecedorCusto}
                              className="px-3 py-1.5 bg-mesaninas-creme/30 hover:bg-mesaninas-creme text-mesaninas-green font-bold text-xs rounded-md transition-colors"
                            >
                              + Adicionar Fornecedor
                            </button>
                          </div>
                          {fornecedoresCustos.length === 0 ? (
                            <div className="text-sm text-mesaninas-green/50 p-6 text-center border border-dashed border-mesaninas-creme rounded-lg bg-mesaninas-creme/10">
                              Nenhum fornecedor adicionado. Adicione pelo menos um para salvar o custo.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {fornecedoresCustos.map((fc, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <select
                                    value={fc.fornecedorId}
                                    onChange={(e) => updateFornecedorCusto(idx, 'fornecedorId', e.target.value)}
                                    className="flex-1 px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                                  >
                                    <option value="">Selecione o Fornecedor...</option>
                                    {fornecedores.map(f => (
                                      <option key={f.id} value={f.id}>{f.nome}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={fc.custo}
                                    onChange={(e) => updateFornecedorCusto(idx, 'custo', e.target.value)}
                                    className="w-32 px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                                    placeholder="R$ 0,00"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeFornecedorCusto(idx)}
                                    className="p-2 h-12 lg:h-10 text-red-500 hover:bg-red-50 rounded-md transition-colors w-10 flex items-center justify-center shrink-0 border border-mesaninas-creme/0 hover:border-red-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-mesaninas-creme/50 flex justify-end gap-3 shrink-0">
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
                      disabled={isSubmitting || !nome}
                      className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm disabled:opacity-50"
                    >
                      {isSubmitting ? 'Salvando...' : (editingPrato ? 'Atualizar Prato' : 'Salvar Prato')}
                    </button>
                  </div>
                </div>

              </form>
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
