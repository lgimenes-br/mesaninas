import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import MesaninasLogo from '../components/MesaninasLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
        
        // Criar o documento do usuário com perfil de Admin padrão na fase de testes
        await setDoc(doc(db, 'usuarios', user.uid), {
          nome: name,
          email: user.email,
          perfil: 'Admin',
          status: 'Ativo'
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
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
    <div className="flex w-full h-screen items-center justify-center bg-mesaninas-creme bg-grid-pattern text-mesaninas-green p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-mesaninas-creme max-w-sm w-full flex flex-col items-center">
        <div className="mb-8 mt-4 flex justify-center w-full">
          <MesaninasLogo className="h-8 sm:h-10 text-mesaninas-green" />
        </div>
        <p className="text-sm text-mesaninas-green/60 mb-8 text-center">
          {isRegisterMode ? 'Crie sua conta de administrador.' : 'Faça login para acessar o sistema.'}
        </p>

        {error && (
          <div className="w-full bg-red-100 text-red-800 text-xs p-3 rounded-md mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 h-12 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
                placeholder="Ex: Ana Maria"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 h-12 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
              placeholder="Digite seu e-mail"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mesaninas-green/80 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 h-12 border border-mesaninas-creme rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-mesaninas-yellow/50 focus:border-mesaninas-yellow"
              placeholder={isRegisterMode ? "Mínimo 6 caracteres" : "Digite sua senha"}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 h-12 bg-mesaninas-green hover:bg-opacity-90 text-mesaninas-creme text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-70"
          >
            {loading ? 'Aguarde...' : (isRegisterMode ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>
        
        <div className="mt-6 text-xs text-mesaninas-green/70">
          {isRegisterMode ? (
            <p>Já tem uma conta? <button type="button" onClick={() => setIsRegisterMode(false)} className="font-bold underline text-mesaninas-green">Fazer login</button></p>
          ) : (
            <p>Ainda não tem acesso? <button type="button" onClick={() => setIsRegisterMode(true)} className="font-bold underline text-mesaninas-green">Criar conta como Admin</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
