import admin from 'firebase-admin';

// Singleton para inicialização segura do Firebase Admin SDK no Server-Side.
// Utilizado para Server Actions, API Routes ou middlewares no Next.js/Express.
if (!admin.apps?.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Limpeza de quebras de linha essenciais para certificados gerados via .env do Vercel
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin inicializado com sucesso.');
  } catch (error) {
    console.error('Erro na inicialização do Firebase Admin', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
