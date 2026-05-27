import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Usuario } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: Usuario | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  loginWithGoogle: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let cleanupPresence: (() => void) | null = null;

    const cleanupCurrentPresence = () => {
      if (cleanupPresence) {
        cleanupPresence();
        cleanupPresence = null;
      }
    };
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      
      cleanupCurrentPresence();
      
      if (user) {
        // Automatically set user as online when session restores
        const userRef = doc(db, 'usuarios', user.uid);
        updateDoc(userRef, {
          isOnline: true,
          ultimoAcesso: serverTimestamp()
        }).catch(err => console.error('Erro ao atualizar presença online:', err));

        // Add window event listeners for presence
        const handleBeforeUnload = () => {
          updateDoc(userRef, {
            isOnline: false,
            ultimoAcesso: serverTimestamp()
          });
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            updateDoc(userRef, {
              isOnline: true,
              ultimoAcesso: serverTimestamp()
            });
          }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        cleanupPresence = () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        unsubscribeSnapshot = onSnapshot(doc(db, 'usuarios', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile({ uid: user.uid, ...docSnap.data() } as Usuario);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao escutar perfil do usuário:", error);
          setUserProfile(null);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      cleanupCurrentPresence();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          nome: user.displayName || user.email?.split('@')[0] || 'Usuário Google',
          email: user.email || '',
          perfil: 'Cliente',
          isAdmin: false,
          status: 'Ativo',
          isOnline: true,
          ultimoAcesso: serverTimestamp()
        });
      } else {
        await updateDoc(userDocRef, {
          isOnline: true,
          ultimoAcesso: serverTimestamp()
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login com Google cancelado pelo usuário.');
      } else {
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
