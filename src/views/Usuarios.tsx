import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Usuario } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Pencil, UserCheck, X, Camera } from 'lucide-react';

export default function Usuarios() {
  const { userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<'Admin' | 'Fornecedor' | 'Cliente'>('Cliente');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openNewModal = () => {
    setEditingUser(null);
    setNome('');
    setEmail('');
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
        const newDocRef = doc(collection(db, 'usuarios'));
        await setDoc(newDocRef, {
          nome,
          email,
          perfil,
          status,
          fotoPerfil: fotoPerfil || null
        });
      }
      closeModal();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar usuário.');
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
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Perfil</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-center">Status</th>
              <th className="px-6 py-3 text-[11px] uppercase font-bold text-mesaninas-green/60 tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mesaninas-creme/50">
            {usuarios.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-6 py-12 text-center text-mesaninas-green/50 text-sm">Nenhum usuário cadastrado.</td>
               </tr>
            ) : (
              usuarios.map((user) => (
                <tr key={user.uid} className="hover:bg-white/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-mesaninas-green">{user.nome}</td>
                  <td className="px-6 py-4 text-mesaninas-green/70 text-sm">{user.email}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${user.perfil === 'Admin' ? 'bg-indigo-100 text-indigo-800' : user.perfil === 'Fornecedor' ? 'bg-orange-100 text-orange-800' : 'bg-mesaninas-creme/60 text-mesaninas-green'}`}>
                      {user.perfil?.toUpperCase() || 'CLIENTE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${user.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {user.status?.toUpperCase() || 'ATIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleEditClick(user)}
                      className="p-2 text-mesaninas-green/50 hover:text-mesaninas-yellow hover:bg-white rounded-md transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Editar Permissões"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-mesaninas-green/80 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4 z-50">
          <div className="bg-white lg:rounded-2xl rounded-t-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl relative animate-in slide-in-from-bottom-full lg:slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center px-4 lg:px-6 py-4 border-b border-mesaninas-creme shrink-0">
               <div>
                 <h3 className="text-lg font-serif font-bold text-mesaninas-green flex items-center gap-2">
                   <UserCheck className="w-5 h-5 text-mesaninas-yellow" />
                   {editingUser ? 'Editar Acesso' : 'Cadastrar Usuário'}
                 </h3>
                 <p className="text-xs text-mesaninas-green/70">{editingUser ? editingUser.nome : 'Cadastrar novo usuário no sistema'}</p>
               </div>
               <button 
                 onClick={closeModal}
                 className="text-mesaninas-green/50 hover:text-mesaninas-green p-2 flex items-center justify-center -mr-2"
               >
                 <X size={24} />
               </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-auto p-4 lg:p-6 space-y-4 bg-mesaninas-creme/10">
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-mesaninas-green/50 flex items-center justify-center bg-mesaninas-creme overflow-hidden shadow-sm">
                    {fotoPerfil ? (
                      <img src={fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xl font-bold text-mesaninas-green">
                        {nome ? nome.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button" 
                    className="absolute bottom-0 right-0 w-7 h-7 bg-mesaninas-green rounded-full flex items-center justify-center text-mesaninas-creme border-2 border-white shadow-sm hover:bg-mesaninas-green/90 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-mesaninas-green text-mesaninas-creme text-xs font-bold rounded-md shadow-sm transition-colors hover:bg-mesaninas-green/90"
                  >
                    Fazer Upload
                  </button>
                  {fotoPerfil && (
                    <button 
                      type="button" 
                      onClick={() => setFotoPerfil(null)}
                      className="px-4 py-2 border border-mesaninas-green/30 text-mesaninas-green text-xs font-bold rounded-md hover:bg-mesaninas-green/5 transition-colors"
                    >
                      Remover Foto
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
              </div>

              <div>
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

              <div>
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

              <div>
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
              
              <div>
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
            </form>

            <div className="px-4 lg:px-6 py-4 border-t border-mesaninas-creme bg-white flex justify-end gap-3 shrink-0 pb-safe z-10 w-full rounded-b-xl lg:rounded-none">
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
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-6 h-12 lg:h-10 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-sm font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Acesso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
