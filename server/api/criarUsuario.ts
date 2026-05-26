import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../../src/lib/firebaseAdmin';

export async function criarUsuario(req: Request, res: Response) {
  try {
    // 1. Validação de Autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // 2. Validação se o chamador é de fato um Admin
    const callerSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.perfil !== 'Admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem criar novos usuários.' });
    }

    // 3. Validação Inbound
    const { nome, email, senha, perfil, status, fotoPerfil } = req.body;

    if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: 'Nome, E-mail e Senha são obrigatórios.' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    }

    // 4. Criar usuário no Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password: senha,
      displayName: nome,
    });

    // 5. Salvar dados no Firestore utilizando o UID de autenticação gerado
    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      nome,
      email,
      perfil: perfil || 'Cliente',
      status: status || 'Ativo',
      fotoPerfil: fotoPerfil || null
    });

    return res.status(201).json({
      success: true,
      uid: userRecord.uid,
      message: 'Usuário e credenciais criados com sucesso.'
    });

  } catch (error: any) {
    console.error('SERVER ACTION ERROR: Falha ao criar usuário', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }
    return res.status(500).json({ error: error.message || 'Erro interno ao processar a criação do usuário.' });
  }
}
