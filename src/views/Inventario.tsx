import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Archive, Plus, Search, Pencil, Trash2, AlertCircle } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export interface Equipamento {
  id: string;
  nome: string;
  categoria: string;
  quantidadeTotal: number;
  quantidadeEmUso: number;
  status: string; // "Operacional", "Em Manutenção", "Baixado"
  dataAquisicao: string;
  observacoes: string;
}

const categoriasExemplo = ["Servir", "Cozinha", "Transporte", "Decoração", "Mobiliário", "Outros"];
const statusOptions = ["Operacional", "Em Manutenção", "Baixado"];

export default function Inventario() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState(categoriasExemplo[0]);
  const [quantidadeTotal, setQuantidadeTotal] = useState<number | ''>('');
  const [status, setStatus] = useState(statusOptions[0]);
  const [dataAquisicao, setDataAquisicao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<{id: string, nome: string} | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'inventario'), orderBy('nome'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Equipamento[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Equipamento);
      });
      setEquipamentos(data);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar inventário:", err);
      setError("Não foi possível carregar os equipamentos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setNome('');
    setCategoria(categoriasExemplo[0]);
    setQuantidadeTotal('');
    setStatus(statusOptions[0]);
    setDataAquisicao('');
    setObservacoes('');
    setEditingId(null);
  };

  const handleOpenModal = (equipamento?: Equipamento) => {
    if (equipamento) {
      setEditingId(equipamento.id);
      setNome(equipamento.nome);
      setCategoria(equipamento.categoria);
      setQuantidadeTotal(equipamento.quantidadeTotal);
      setStatus(equipamento.status);
      setDataAquisicao(equipamento.dataAquisicao || '');
      setObservacoes(equipamento.observacoes || '');
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      setError("O nome do equipamento é obrigatório.");
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      const equipData = {
        nome: nome.trim(),
        categoria,
        quantidadeTotal: Number(quantidadeTotal) || 0,
        quantidadeEmUso: editingId ? equipamentos.find(e => e.id === editingId)?.quantidadeEmUso || 0 : 0,
        status,
        dataAquisicao,
        observacoes,
      };

      if (editingId) {
        await updateDoc(doc(db, 'inventario', editingId), equipData);
      } else {
        await addDoc(collection(db, 'inventario'), equipData);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Erro ao salvar equipamento:", err);
      setError("Erro ao salvar equipamento: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string, nome: string) => {
    setItemToDelete({ id, nome });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'inventario', itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      console.error("Erro ao apagar equipamento:", err);
      alert("Erro ao apagar: " + err.message);
    }
  };

  const filteredEquipamentos = equipamentos.filter(eq => 
    eq.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    eq.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Operacional': return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">OPERACIONAL</span>;
      case 'Em Manutenção': return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">MANUTENÇÃO</span>;
      case 'Baixado': return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-200 text-gray-700">BAIXADO</span>;
      default: return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">{s.toUpperCase()}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full relative gap-6">
      {error && (
        <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2 shadow-sm shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          {error}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 w-full">
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Buscar equipamento ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 lg:h-10 pl-10 pr-4 bg-white border border-mesaninas-creme rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <span className="text-lg leading-none">+</span> <span>Novo Equipamento</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
         <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm flex-1 w-full flex flex-col overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[700px]">
                 <thead>
                   <tr className="bg-[#f2eede] text-mesaninas-green font-bold text-xs uppercase tracking-wider border-b border-mesaninas-creme/60">
                     <th className="px-6 py-4 rounded-tl-xl w-[30%]">Nome do Equipamento</th>
                     <th className="px-6 py-4 w-[15%]">Categoria</th>
                     <th className="px-6 py-4 text-center w-[15%]">Quantidade Total</th>
                     <th className="px-6 py-4 text-center w-[15%]">Disponível<span className="block text-[9px] font-normal opacity-70 normal-case">(No Galpão)</span></th>
                     <th className="px-6 py-4 text-center w-[15%]">Status</th>
                     <th className="px-6 py-4 rounded-tr-xl text-center w-[10%]">Manejos</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm">
                   {loading ? (
                     <tr>
                       <td colSpan={6} className="px-6 py-12 text-center text-mesaninas-green/50">Carregando inventário...</td>
                     </tr>
                   ) : filteredEquipamentos.length === 0 ? (
                     <tr>
                       <td colSpan={6} className="px-6 py-12 text-center text-mesaninas-green/50">
                         {searchTerm ? 'Nenhum equipamento encontrado para a busca.' : 'Nenhum equipamento cadastrado.'}
                       </td>
                     </tr>
                   ) : (
                     filteredEquipamentos.map((eq) => {
                       const disponivel = eq.quantidadeTotal - (eq.quantidadeEmUso || 0);
                       return (
                         <tr key={eq.id} className="border-b border-mesaninas-creme/30 hover:bg-mesaninas-creme/5 transition-colors group">
                           <td className="px-6 py-4 font-bold text-mesaninas-green">
                              {eq.nome}
                              {eq.observacoes && <p className="text-xs text-gray-400 font-normal mt-0.5 line-clamp-1" title={eq.observacoes}>{eq.observacoes}</p>}
                           </td>
                           <td className="px-6 py-4 text-gray-600">
                             <div className="flex items-center gap-2">
                               <Archive className="w-4 h-4 text-gray-400" />
                               {eq.categoria}
                             </div>
                           </td>
                           <td className="px-6 py-4 text-center font-bold text-gray-700">
                             {eq.quantidadeTotal}
                           </td>
                           <td className="px-6 py-4 text-center">
                             <span className={`font-bold ${disponivel <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                               {disponivel}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-center">
                             {getStatusBadge(eq.status)}
                           </td>
                           <td className="px-6 py-4 text-center">
                             <div className="flex items-center justify-center gap-3">
                               <button 
                                  onClick={() => handleOpenModal(eq)}
                                  className="text-gray-400 hover:text-mesaninas-green transition-colors"
                                  title="Editar"
                                >
                                  <Pencil size={18} />
                               </button>
                               <button 
                                  onClick={() => handleDeleteClick(eq.id, eq.nome)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
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

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        itemName={itemToDelete?.nome || ''}
        onCancel={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* MODAL 90vw */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
              <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight">
                   {editingId ? 'Editar Equipamento' : 'Novo Equipamento'}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">Cadastro de patrimônio / ativos retornáveis</p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-mesaninas-green/50 hover:text-mesaninas-green transition-colors p-2"
              >
                <Trash2 size={20} className="hidden" /> {/* just for sizing or use X icon? usually X */}
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="max-w-2xl mx-auto space-y-6 bg-white p-6 md:p-8 border border-mesaninas-creme/50 rounded-xl shadow-sm">
                 
                 <div>
                    <label className="block text-sm font-bold text-mesaninas-green mb-1.5">
                      Nome do Equipamento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium"
                      placeholder="Ex: Rechaud Inox Redondo 5L"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-mesaninas-green mb-1.5">Categoria</label>
                      <select
                        className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium"
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value)}
                      >
                        {categoriasExemplo.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-mesaninas-green mb-1.5">Status</label>
                      <select
                        className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        {statusOptions.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-mesaninas-green mb-1.5">Quantidade Total</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium"
                        placeholder="0"
                        value={quantidadeTotal}
                        onChange={(e) => setQuantidadeTotal(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-mesaninas-green mb-1.5">Data de Aquisição</label>
                      <input
                        type="date"
                        className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium"
                        value={dataAquisicao}
                        onChange={(e) => setDataAquisicao(e.target.value)}
                      />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-mesaninas-green mb-1.5">Observações / Estado de Conservação</label>
                    <textarea
                      rows={4}
                      className="w-full bg-[#f4efdc]/30 border border-mesaninas-creme rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30 focus:bg-white transition-all text-mesaninas-green font-medium resize-none"
                      placeholder="Opcional. Ex: Riscos na tampa, pernas bambas..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    ></textarea>
                 </div>

              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-mesaninas-creme/50 bg-white/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="px-6 h-12 lg:h-10 text-mesaninas-green font-bold text-sm bg-transparent hover:bg-black/5 rounded-md transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !nome.trim()}
                className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Equipamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
