import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Usuario } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Pencil, UserCheck, X, Camera, Trash2 } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export default function Usuarios() {
  const { userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<'Admin' | 'Fornecedor' | 'Cliente'>('Cliente');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const requestDelete = (uid: string) => {
    setDeleteConfirmId(uid);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'usuarios', deleteConfirmId));
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir usuário.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatTimestamp = (timestamp?: any) => {
    if (!timestamp) return '';
    let dateObj;
    if (timestamp.toDate) {
      dateObj = timestamp.toDate();
    } else if (timestamp.seconds) {
      dateObj = new Date(timestamp.seconds * 1000);
    } else {
      dateObj = new Date(timestamp);
    }
    
    if (isNaN(dateObj.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(dateObj).replace(',', ' às');
  };

  const openNewModal = () => {
    setEditingUser(null);
    setNome('');
    setEmail('');
    setSenha('');
    setPerfil('Cliente');
    setStatus('Ativo');
    setFotoPerfil(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (userProfile?.perfil !== 'Admin') {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const data: Usuario[] = [];
      snapshot.forEach((doc) => {
        data.push({ uid: doc.id, ...doc.data() } as Usuario);
      });
      setUsuarios(data);
      setLoading(false);
    });

    return () => unsub();
  }, [userProfile]);

  const handleEditClick = (user: Usuario) => {
    setEditingUser(user);
    setNome(user.nome || '');
    setEmail(user.email || '');
    setPerfil(user.perfil || 'Cliente');
    setStatus(user.status || 'Ativo');
    setFotoPerfil(user.fotoPerfil || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setNome('');
    setEmail('');
    setSenha('');
    setFotoPerfil(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFotoPerfil(compressedDataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      alert('Nome e E-mail são obrigatórios.');
      return;
    }
    
    if (!editingUser && !senha.trim()) {
      alert('A senha é obrigatória para novos usuários.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'usuarios', editingUser.uid), {
          nome,
          email,
          perfil,
          status,
          ...(fotoPerfil !== undefined && { fotoPerfil })
        });
      } else {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          alert('Não foi possível autenticar a sua sessão para criar um usuário.');
          setIsSubmitting(false);
          return;
        }

        const response = await fetch('/api/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            nome,
            email,
            senha,
            perfil,
            status,
            fotoPerfil: fotoPerfil || null
          })
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
             const resData = await response.json();
             throw new Error(resData.error || 'Erro ao cadastrar o novo usuário.');
          } else {
             const textError = await response.text();
             console.error("API response error (non-JSON):", textError);
             throw new Error('Erro de comunicação com o servidor. A API retornou uma resposta inesperada.');
          }
        }
      }
      closeModal();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao salvar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-transparent items-center justify-center">
         <div className="w-10 h-10 border-4 border-mesaninas-green/20 border-t-mesaninas-yellow rounded-full animate-spin"></div>
         <p className="mt-4 text-mesaninas-green/70 font-medium">Carregando usuários...</p>
      </div>
    );
  }

  if (userProfile?.perfil !== 'Admin') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center max-w-md mx-auto">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-serif font-bold text-mesaninas-green mb-2">Acesso Negado</h2>
        <p className="text-mesaninas-green/70 text-sm">Apenas administradores podem acessar a gestão de usuários.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative gap-6">
      {/* Main Table Card */}
      <div className="bg-white border border-mesaninas-creme rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mesaninas-creme/50 bg-mesaninas-creme/10">
          <h3 className="font-serif font-bold text-lg text-mesaninas-green">Controle de Usuários</h3>
          <button
            onClick={openNewModal}
            className="px-4 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme transition-colors text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span> <span>Novo Usuário</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-mesaninas-creme/10 lg:bg-transparent">
        <table className="w-full text-left border-collapse">
          <thead className="bg-mesaninas-creme/30 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">Nome</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider">E-mail</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Conexão</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Perfil</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Status</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mesaninas-creme/50">
            {usuarios.length === 0 ? (
               <tr>
                 <td colSpan={6} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum usuário cadastrado.</td>
               </tr>
            ) : (
              usuarios.map((user) => (
                <tr key={user.uid} className="hover:bg-white/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-mesaninas-green">{user.nome}</td>
                  <td className="px-6 py-4 text-mesaninas-green/70 text-sm">{user.email}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${user.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                        {user.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      {!user.isOnline && user.ultimoAcesso && (
                        <span className="text-[10px] text-gray-500">Último acesso: {formatTimestamp(user.ultimoAcesso)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${user.perfil === 'Admin' ? 'bg-indigo-100 text-indigo-800' : user.perfil === 'Fornecedor' ? 'bg-orange-100 text-orange-800' : 'bg-mesaninas-creme/60 text-mesaninas-green'}`}>
                      {user.perfil?.toUpperCase() || 'CLIENTE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${user.status === 'Ativo' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                      {user.status?.toUpperCase() || 'ATIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEditClick(user)}
                        className="text-mesaninas-green/60 hover:text-[#e7e873] hover:bg-white rounded-md transition-all p-1.5 shadow-sm"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => requestDelete(user.uid)}
                        className="text-mesaninas-green/60 hover:text-red-500 hover:bg-white rounded-md transition-all p-1.5 shadow-sm"
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8">
          <div className="w-[90vw] h-[90vh] overflow-hidden rounded-2xl bg-[#f4efdc] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-mesaninas-creme/50 flex justify-between items-center bg-white/50 shrink-0">
               <div>
                 <h3 className="font-serif font-bold text-lg text-mesaninas-green flex items-center gap-2">
                   <UserCheck className="w-5 h-5 text-mesaninas-yellow" />
                   {editingUser ? 'Editar Acesso' : 'Cadastrar Usuário'}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">{editingUser ? editingUser.nome : 'Cadastrar novo usuário no sistema'}</p>
               </div>
               <button 
                 onClick={closeModal}
                 className="text-mesaninas-green/50 hover:text-mesaninas-green p-2 h-12 w-12 flex items-center justify-center -mr-2 text-2xl font-bold transition-colors"
                 title="Fechar"
               >
                 ×
               </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] flex-1 overflow-hidden">
               {/* 30% LEFT COLUMN: User Photo */}
               <div className="col-span-1 border-r border-mesaninas-creme/50 bg-mesaninas-creme/20 p-6 flex flex-col items-center justify-center pt-10">
                 <div className="w-full aspect-square max-w-[200px] mb-6 rounded-full border-4 border-white shadow-xl overflow-hidden relative group bg-white flex items-center justify-center">
                    {fotoPerfil ? (
                      <img src={fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-5xl font-bold text-mesaninas-green/30">
                        {nome ? nome.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                    >
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-xs font-bold uppercase tracking-widest">Alterar Foto</span>
                    </button>
                 </div>

                 <div className="flex gap-2">
                   <button 
                     type="button" 
                     onClick={() => fileInputRef.current?.click()}
                     className="px-4 py-2 bg-white border border-mesaninas-green/20 text-mesaninas-green text-xs font-bold rounded-md shadow-sm transition-colors hover:bg-mesaninas-creme/50"
                   >
                     Fazer Upload
                   </button>
                   {fotoPerfil && (
                     <button 
                       type="button" 
                       onClick={() => setFotoPerfil(null)}
                       className="px-4 py-2 bg-white border border-red-200 text-red-500 text-xs font-bold rounded-md hover:bg-red-50 transition-colors"
                     >
                       Remover
                     </button>
                   )}
                 </div>
                 <input 
                   type="file" 
                   accept="image/png, image/jpeg" 
                   ref={fileInputRef} 
                   onChange={handleFileChange} 
                   className="hidden" 
                 />

                 <div className="mt-auto pt-8 w-full text-center">
                    <p className="text-[10px] uppercase font-bold text-mesaninas-green/40 tracking-wider">Permissões de Acesso</p>
                    <div className="mt-2 text-sm text-mesaninas-green font-medium">
                       Perfil: <span className="text-mesaninas-yellow">{perfil}</span>
                    </div>
                 </div>
               </div>

               {/* 70% RIGHT COLUMN: Form and Footer */}
               <div className="col-span-1 overflow-y-auto bg-white flex flex-col relative h-full">
                  <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6 max-w-4xl w-full flex-1" id="usuarioForm">
                    <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Dados do Usuário</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Nome Completo</label>
                          <input 
                            type="text"
                            required
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                            className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 text-mesaninas-green bg-white"
                            placeholder="Ex: Ana Maria"
                          />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">E-mail</label>
                          <input 
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 text-mesaninas-green bg-white"
                            placeholder="Digite o e-mail"
                          />
                        </div>

                        {!editingUser && (
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Senha Temporária</label>
                            <input 
                              type="password"
                              required
                              value={senha}
                              onChange={e => setSenha(e.target.value)}
                              className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 text-mesaninas-green bg-white"
                              placeholder="Mínimo de 6 caracteres"
                              minLength={6}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 p-5 md:p-6 bg-mesaninas-creme/10 border border-mesaninas-creme/50 rounded-xl">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-mesaninas-green/60">Configurações de Conta</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Perfil do Usuário</label>
                          <select 
                            value={perfil} 
                            onChange={e => setPerfil(e.target.value as any)}
                            className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 text-mesaninas-green bg-white"
                          >
                            <option value="Cliente">Cliente</option>
                            <option value="Fornecedor">Fornecedor</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>
                        
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Status da Conta</label>
                          <select 
                            value={status} 
                            onChange={e => setStatus(e.target.value as any)}
                            className="w-full px-3 h-12 lg:h-10 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 text-mesaninas-green bg-white"
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* FORM FOOTER ACTION BAR */}
                  <div className="p-6 md:p-8 mt-auto flex justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 h-12 lg:h-10 text-sm font-medium text-mesaninas-green/70 hover:text-mesaninas-green transition-colors"
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      form="usuarioForm"
                      disabled={isSubmitting}
                      className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-sm font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Salvando...' : 'Salvar Acesso'}
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteConfirmId}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
