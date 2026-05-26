import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// O Vite usa import.meta.env para variáveis de ambiente cliente.
// Nota: Para Next.js, substitua import.meta.env por process.env 
// e o prefixo VITE_ por NEXT_PUBLIC_
const envs = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: envs.VITE_FIREBASE_API_KEY,
  authDomain: envs.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envs.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envs.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envs.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envs.VITE_FIREBASE_APP_ID,
};

// Singleton para o Firebase Client: Inicializa o app apenas uma vez.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Inicialização dos serviços Modular (v9+)
export const db = getFirestore(app);
export const auth = getAuth(app);
