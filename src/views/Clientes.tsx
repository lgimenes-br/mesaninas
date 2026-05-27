import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cliente } from '../types';
import { Pencil, Trash2 } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const formatCpfCnpj = (val: string) => {
  let v = val.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v;
};

interface ClienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteData?: Cliente | null;
  onSaveSuccess: () => void;
}

function ClienteFormModal({ isOpen, onClose, clienteData, onSaveSuccess }: ClienteFormModalProps) {
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState<'Social' | 'Corporativo'>('Social');
  
  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState('');

  useEffect(() => {
    if (clienteData) {
      setNome(clienteData.nome || '');
      setCpfCnpj(clienteData.cpf_cnpj || '');
      setEmail(clienteData.email || '');
      setTelefone(clienteData.telefone || '');
      setTipo(clienteData.tipo || 'Social');
      setCep(clienteData.cep || '');
      setLogradouro(clienteData.logradouro || '');
      setNumero(clienteData.numero || '');
      setComplemento(clienteData.complemento || '');
      setBairro(clienteData.bairro || '');
      setCidade(clienteData.cidade || '');
      setUf(clienteData.uf || '');
      setObservacoes(clienteData.observacoes || '');
    } else {
      setNome('');
      setCpfCnpj('');
      setEmail('');
      setTelefone('');
      setTipo('Social');
      setCep('');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidade('');
      setUf('');
      setObservacoes('');
    }
  }, [clienteData, isOpen]);

  const handleCnpjBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cleanCnpj = e.target.value.replace(/\D/g, '');
    if ((tipo === 'Corporativo' && cleanCnpj.length === 14) || cleanCnpj.length === 14) {
      setIsSearchingCnpj(true);
      setCnpjError('');
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (!response.ok) {
          throw new Error('Not found');
        }
        const data = await response.json();
        
        if (data.razao_social) setNome(data.razao_social);
        else if (data.nome_fantasia) setNome(data.nome_fantasia);

        if (data.email) setEmail(data.email);
        
        if (data.ddd_telefone_1) {
          const formatPhone = data.ddd_telefone_1.replace(/\D/g, '');
          if (formatPhone.length === 10) {
            setTelefone(`(${formatPhone.substring(0, 2)}) ${formatPhone.substring(2, 6)}-${formatPhone.substring(6)}`);
          } else if (formatPhone.length === 11) {
            setTelefone(`(${formatPhone.substring(0, 2)}) ${formatPhone.substring(2, 7)}-${formatPhone.substring(7)}`);
          } else {
            setTelefone(data.ddd_telefone_1);
          }
        }
        
        if (data.cep) {
          const cepClean = data.cep.replace(/\D/g, '');
          if (cepClean.length === 8) {
            setCep(`${cepClean.substring(0, 5)}-${cepClean.substring(5)}`);
          } else {
            setCep(data.cep);
          }
        }
        
        if (data.logradouro) setLogradouro(data.logradouro);
        if (data.bairro) setBairro(data.bairro);
        if (data.municipio) setCidade(data.municipio);
        if (data.uf) setUf(data.uf);
        if (data.numero) setNumero(data.numero);
        if (data.complemento) setComplemento(data.complemento);
      } catch (err) {
        console.error('Erro ao buscar CNPJ', err);
        setCnpjError('CNPJ não encontrado ou inválido. Verifique o número.');
      } finally {
        setIsSearchingCnpj(false);
      }
    }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    let cleanCep = e.target.value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro);
          setBairro(data.bairro);
          setCidade(data.localidade);
          setUf(data.uf);
          document.getElementById('numero_input')?.focus();
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    setIsSubmitting(true);
    try {
      const enderecoFormatado = `${logradouro}${numero ? ', ' + numero : ''}${complemento ? ' - ' + complemento : ''}, ${bairro}, ${cidade} - ${uf}, CEP: ${cep}`;
      
      const payload = {
        nome,
        cpf_cnpj: cpfCnpj,
        email,
        telefone,
        tipo,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        endereco: logradouro ? enderecoFormatado : '',
        observacoes
      };

      if (clienteData?.id) {
        // Edit
        console.log(`Atualizando cliente ${clienteData.id} no Firebase...`);
        const clienteRef = doc(db, 'clientes', clienteData.id);
        await updateDoc(clienteRef, payload);
        console.log("Sucesso: Cliente atualizado no Firebase com ID", clienteData.id);
      } else {
        // Create
        console.log("Salvando novo cliente no Firebase...");
        const docRef = await addDoc(collection(db, 'clientes'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        console.log("Sucesso: Cliente salvo no Firebase com ID", docRef.id);
      }
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar no Firebase:", err);
      alert('Erro ao salvar cliente: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
      <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
          <div>
            <h3 className="font-serif font-bold text-lg text-mesaninas-green tracking-tight">
              {clienteData ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <p className="text-xs text-mesaninas-green/70">
              {clienteData ? 'Atualize as informações do contato' : 'Cadastre um contato para orçamentos'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-mesaninas-green/50 hover:text-mesaninas-green text-2xl font-bold p-2 h-12 w-12 flex items-center justify-center -mr-2 transition-colors"
            title="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 bg-white">
          <form onSubmit={handleSave} className="w-full max-w-7xl mx-auto space-y-6" id="clienteForm">
            
            <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Dados Básicos</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-3">
                  <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Tipo de Cliente*</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-mesaninas-green cursor-pointer">
                      <input
                        type="radio"
                        value="Social"
                        checked={tipo === 'Social'}
                        onChange={() => setTipo('Social')}
                        className="text-mesaninas-yellow focus:ring-mesaninas-yellow h-4 w-4 border-mesaninas-creme"
                      />
                      Evento Social (Física)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-mesaninas-green cursor-pointer">
                      <input
                        type="radio"
                        value="Corporativo"
                        checked={tipo === 'Corporativo'}
                        onChange={() => setTipo('Corporativo')}
                        className="text-mesaninas-blue focus:ring-mesaninas-blue h-4 w-4 border-mesaninas-creme"
                      />
                      Corporativo (Jurídica)
                    </label>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">
                    {tipo === 'Social' ? 'Nome Completo*' : 'Razão Social / Nome Fantasia*'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    placeholder="Ex: Mariana Alvim"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1 flex justify-between items-center">
                    <span>{tipo === 'Social' ? 'CPF' : 'CNPJ'}</span>
                    {isSearchingCnpj && <span className="text-[10px] text-mesaninas-yellow font-bold animate-pulse">Buscando...</span>}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cpfCnpj}
                      onChange={e => {
                        setCpfCnpj(formatCpfCnpj(e.target.value));
                        setCnpjError('');
                      }}
                      onBlur={handleCnpjBlur}
                      className={`w-full px-3 h-12 lg:h-10 bg-white border ${cnpjError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-mesaninas-creme focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow'} rounded-md text-sm focus:outline-none text-mesaninas-green`}
                      placeholder={tipo === 'Social' ? '000.000.000-00' : '00.000.000/0000-00'}
                    />
                    {cnpjError && (
                      <p className="absolute -bottom-5 left-0 text-[10px] text-red-500 font-medium">
                        {cnpjError}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    placeholder="(11) 90000-0000"
                  />
                </div>

                <div className="col-span-1 lg:col-span-1">
                  <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Email de Contato</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    placeholder="contato@email.com"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Endereço Completo</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">CEP (Busca Automática)</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={e => setCep(e.target.value)}
                      onBlur={handleCepBlur}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="00000-000"
                    />
                 </div>
                 
                 <div className="col-span-1 md:col-span-2 lg:col-span-3"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                 <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Logradouro (Rua/Av)</label>
                    <input
                      type="text"
                      value={logradouro}
                      onChange={e => setLogradouro(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                 </div>
                 <div className="col-span-1 lg:col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Número</label>
                    <input
                      id="numero_input"
                      type="text"
                      value={numero}
                      onChange={e => setNumero(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                 </div>
                 
                 <div className="col-span-1 md:col-span-1 lg:col-span-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={e => setComplemento(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                      placeholder="Apto, Sala, Bloco..."
                    />
                 </div>
                 <div className="col-span-1 md:col-span-1 lg:col-span-2">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={bairro}
                      onChange={e => setBairro(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                 </div>
                 
                 <div className="col-span-1 md:col-span-1 lg:col-span-3">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={cidade}
                      onChange={e => setCidade(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                    />
                 </div>
                 <div className="col-span-1 md:col-span-1 lg:col-span-1">
                    <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">UF</label>
                    <input
                      type="text"
                      value={uf}
                      onChange={e => setUf(e.target.value)}
                      className="w-full px-3 h-12 lg:h-10 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green uppercase"
                      maxLength={2}
                    />
                 </div>
              </div>
            </div>

            <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
               <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Observações / Preferências</label>
               <textarea
                 rows={3}
                 value={observacoes}
                 onChange={e => setObservacoes(e.target.value)}
                 className="w-full px-3 py-2 bg-white border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow text-mesaninas-green"
                 placeholder="Preferências alimentares, histórico, particularidades..."
               />
            </div>

          </form>
        </div>

        <div className="px-6 py-4 border-t border-mesaninas-creme/80 bg-white flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-12 lg:h-10 text-sm font-medium text-mesaninas-green/70 hover:text-mesaninas-green transition-colors"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="clienteForm"
            disabled={isSubmitting || isSearchingCnpj || !nome}
            className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'clientes'),
      (snapshot) => {
        const data: Cliente[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Cliente);
        });
        setClientes(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro de permissão ou conexão ao buscar clientes no Firebase:", err);
        setError(`Não foi possível carregar os clientes: ${err.message}`);
        setClientes([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const openNewModal = () => {
    setEditingCliente(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setIsModalOpen(true);
  };

  const requestDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'clientes', itemToDelete));
      showToast('Cliente apagado com sucesso.');
    } catch (err: any) {
      console.error("Erro ao apagar:", err);
      alert('Erro ao apagar cliente: ' + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf_cnpj.includes(searchTerm)
  );

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString('pt-BR');
    if (typeof date === 'string') return new Date(date).toLocaleDateString('pt-BR');
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex flex-col h-full relative gap-6">
      {/* Toast and errors can float/be here */}
      {error && (
        <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2 shrink-0 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          {error}
        </div>
      )}

      {toastMessage && (
        <div className="absolute top-4 inset-x-0 mx-auto w-max px-4 py-2 bg-mesaninas-green text-mesaninas-creme text-sm font-bold rounded-full shadow-lg border border-mesaninas-yellow/30 z-20 animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 w-full">
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 lg:h-10 pl-10 pr-4 bg-white border border-mesaninas-creme rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-green/30"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <button
          onClick={openNewModal}
          className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <span className="text-lg leading-none">+</span> <span>Novo Cliente</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
         <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm flex-1 w-full flex flex-col overflow-hidden">
            <div className="overflow-x-auto">
              {/* DESKTOP TABLE */}
              <table className="hidden lg:table w-full text-left border-collapse min-w-[700px] text-sm">
            <thead className="bg-[#f4efdc]/30 text-[10px] uppercase tracking-wider font-bold text-[#00382b]/60 sticky top-0 z-10 shadow-sm">
              <tr className="border-b border-[#f4efdc]/50">
                <th className="px-6 py-3 font-semibold">Nome / Razão Social</th>
                <th className="px-6 py-3 font-semibold">Contato</th>
                <th className="px-6 py-3 font-semibold text-center">Tipo</th>
                <th className="px-6 py-3 font-semibold text-center">Cadastro</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mesaninas-creme/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Carregando dados...</td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                 <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum cliente encontrado.</td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-mesaninas-creme/30 group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-mesaninas-green">{cliente.nome}</div>
                      <div className="text-xs text-mesaninas-green/60 mt-0.5">{cliente.cpf_cnpj}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-mesaninas-green font-medium">{cliente.telefone}</div>
                      <div className="text-xs text-mesaninas-green/60 mt-0.5">{cliente.email}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        cliente.tipo === 'Corporativo'
                          ? 'bg-mesaninas-blue/50 text-mesaninas-green'
                          : 'bg-mesaninas-yellow/50 text-mesaninas-green'
                      }`}>
                        {cliente.tipo || 'Desconhecido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-mesaninas-green/70 text-xs">
                       {formatDate(cliente.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                         <button 
                           onClick={() => openEditModal(cliente)}
                           className="text-mesaninas-green/60 hover:text-[#e7e873] transition-colors p-1.5"
                           title="Editar"
                         >
                           <Pencil className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => requestDelete(cliente.id)}
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
        </div>

        {/* MOBILE CARDS border removed to fit the new design structure */}
        <div className="lg:hidden flex flex-col p-4 gap-4 bg-mesaninas-creme/5">
            {loading ? (
                <div className="text-center text-mesaninas-green/50 text-sm py-8">Carregando dados...</div>
              ) : filteredClientes.length === 0 ? (
                <div className="text-center text-mesaninas-green/50 text-sm py-8">Nenhum cliente encontrado.</div>
              ) : (
                filteredClientes.map((cliente) => (
                  <div key={cliente.id} className="bg-white border border-mesaninas-creme/70 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-mesaninas-green text-base leading-tight truncate">{cliente.nome}</div>
                        <div className="text-sm text-mesaninas-green/60 mt-1">{cliente.cpf_cnpj}</div>
                      </div>
                      <span className={`px-2.5 py-1 whitespace-nowrap rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        cliente.tipo === 'Corporativo'
                          ? 'bg-mesaninas-blue/50 text-mesaninas-green'
                          : 'bg-mesaninas-yellow/50 text-mesaninas-green'
                      }`}>
                        {cliente.tipo || 'Desconhecido'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 text-sm bg-mesaninas-creme/30 p-3.5 rounded-lg border border-mesaninas-creme/50">
                    <div className="flex items-center gap-2.5 text-mesaninas-green">
                      <svg className="w-4 h-4 text-mesaninas-green/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                      <span className="font-medium">{cliente.telefone}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-mesaninas-green/80">
                      <svg className="w-4 h-4 text-mesaninas-green/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-1">
                     <button 
                        onClick={() => openEditModal(cliente)}
                        className="h-10 bg-white hover:bg-mesaninas-creme/20 border border-mesaninas-creme text-mesaninas-green font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 group"
                     >
                       <Pencil className="w-4 h-4 text-mesaninas-green/50 group-hover:text-[#e7e873]" />
                       <span>Editar</span>
                     </button>
                     <button 
                        onClick={() => requestDelete(cliente.id)}
                        className="h-10 bg-white hover:bg-red-50/50 border border-mesaninas-creme text-mesaninas-green font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 group"
                     >
                       <Trash2 className="w-4 h-4 text-mesaninas-green/50 group-hover:text-red-500" />
                       <span>Apagar</span>
                     </button>
                  </div>
                </div>
              ))
            )}
        </div>
      </div>
      </div>

      <ClienteFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clienteData={editingCliente}
        onSaveSuccess={() => showToast(editingCliente ? 'Cliente atualizado com sucesso!' : 'Novo cliente cadastrado com sucesso!')}
      />
      
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
