import React, { useState } from 'react';
import { signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import MesaninasLogo from '../components/MesaninasLogo';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState('Cliente');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const { loginWithGoogle } = useAuth();

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

  const handleGoogleAuth = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError('Falha ao autenticar com o Google. Tente novamente.');
    } finally {
      setGoogleLoading(false);
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
          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-2 h-12 bg-[#e7e873] hover:bg-[#e7e873]/90 text-[#00382b] text-sm font-bold rounded-md shadow-sm transition-colors border-none"
          >
            {loading ? 'Aguarde...' : (isRegisterMode ? 'Criar Conta' : 'Entrar')}
          </Button>
        </form>

        <div className="flex items-center my-4 w-full">
          <div className="flex-1 border-t border-white/20"></div>
          <span className="px-3 text-xs text-white/40 uppercase font-medium tracking-wider">ou</span>
          <div className="flex-1 border-t border-white/20"></div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={loading || googleLoading}
          onClick={handleGoogleAuth}
          className="w-full h-12 !bg-white !text-[#00382b] hover:!bg-white/95 !border-none shadow-md font-bold transition-all duration-200"
        >
          {googleLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-[#00382b]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continuar com o Google
            </span>
          )}
        </Button>
        
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
