import React, { useState } from 'react';
import { signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import MesaninasLogo from '../components/MesaninasLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState('Cliente');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegisterMode) {
        if (!name) {
          setError('Por favor, informe seu nome.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, 'usuarios', user.uid), {
          nome: name,
          email: user.email,
          perfil: profileType,
          isAdmin: false,
          status: 'Ativo',
          isOnline: true,
          ultimoAcesso: serverTimestamp()
        });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await updateDoc(doc(db, 'usuarios', userCredential.user.uid), {
          isOnline: true,
          ultimoAcesso: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error(err);
      if (isRegisterMode) {
        setError('Erro ao criar conta. A senha deve ter no mínimo 6 caracteres ou o e-mail já está em uso.');
      } else {
        setError('Credenciais inválidas. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full h-screen items-center justify-center bg-mesaninas-creme bg-grid-pattern p-4">
      <div className="bg-[#00382b] p-8 rounded-2xl shadow-xl border border-[#00382b]/30 max-w-sm w-full flex flex-col items-center">
        <div className="mb-8 mt-4 flex justify-center w-full">
          <MesaninasLogo className="h-8 sm:h-10 text-[#e7e873]" />
        </div>
        <p className="text-sm text-white/80 mb-8 text-center">
          {isRegisterMode ? 'Crie sua conta de administrador.' : 'Faça login para acessar o sistema.'}
        </p>

        {error && (
          <div className="w-full bg-red-900/50 text-red-100 border border-red-500/30 text-xs p-3 rounded-md mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 h-12 bg-white text-[#00382b] border border-mesaninas-creme/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#e7e873]/50 focus:border-[#e7e873]"
                  placeholder="Ex: Ana Maria"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Desejo me cadastrar como:</label>
                <select
                  value={profileType}
                  onChange={(e) => setProfileType(e.target.value)}
                  className="w-full px-4 h-12 bg-white text-[#00382b] border border-mesaninas-creme/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#e7e873]/50 focus:border-[#e7e873]"
                >
                  <option value="Cliente">Cliente</option>
                  <option value="Fornecedor">Fornecedor</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-white/90 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 h-12 bg-white text-[#00382b] border border-mesaninas-creme/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#e7e873]/50 focus:border-[#e7e873]"
              placeholder="Digite seu e-mail"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/90 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 h-12 bg-white text-[#00382b] border border-mesaninas-creme/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#e7e873]/50 focus:border-[#e7e873]"
              placeholder={isRegisterMode ? "Mínimo 6 caracteres" : "Digite sua senha"}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 h-12 bg-[#e7e873] hover:bg-[#e7e873]/90 text-[#00382b] text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-70"
          >
            {loading ? 'Aguarde...' : (isRegisterMode ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>
        
        <div className="mt-6 text-xs text-white/75">
          {isRegisterMode ? (
            <p>Já tem uma conta? <button type="button" onClick={() => setIsRegisterMode(false)} className="font-bold underline text-[#e7e873] hover:text-[#e7e873]/80">Fazer login</button></p>
          ) : (
            <p>Ainda não tem acesso? <button type="button" onClick={() => setIsRegisterMode(true)} className="font-bold underline text-[#e7e873] hover:text-[#e7e873]/80">Cadastre-se</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
