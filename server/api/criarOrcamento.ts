import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../../src/lib/firebaseAdmin';

/**
 * Este controller é a adaptação da Server Action solicitada (`criarOrcamento`)
 * para o ambiente de ExpressJS. Em um ambiente Next.js App Router, este
 * código viveria dentro de app/actions/criarOrcamento.ts utilizando 'use server'.
 */

export interface CriarOrcamentoRequest {
  clienteId: string;
  dataEvento: string;
  numConvidados: number;
  pratosSelecionados: string[];
  custoTotal: number;
  valorVenda: number;
}

export async function criarOrcamento(req: Request, res: Response) {
  try {
    // 1. Validação de Autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verifica e decodifica o token usando Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Regra de negócio: Exigir e-mail validado
    if (!decodedToken.email_verified) {
      return res.status(403).json({ error: 'Acesso negado. O e-mail do funcionário deve estar verificado.' });
    }

    // 2. Validação Inbound (Sanitization and Schema Verification)
    const { clienteId, dataEvento, numConvidados, pratosSelecionados, custoTotal, valorVenda } = req.body as CriarOrcamentoRequest;

    if (!clienteId || !dataEvento || numConvidados <= 0) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes ou inválidos.' });
    }

    // 3. Validação Atômica / Relacional (Verifica se cliente existe)
    const clienteRef = adminDb.collection('clientes').doc(clienteId);
    const clienteSnap = await clienteRef.get();
    
    if (!clienteSnap.exists) {
      return res.status(404).json({ error: 'Cliente referenciado não encontrado.' });
    }

    // 4. Inserção Segura no Firestore 
    const novoOrcamentoRef = adminDb.collection('orcamentos').doc();
    
    // Utilizando o serverTimestamp da admin SDK para garantir integridade do Timestamp (evitar timestamp spoofing)
    const { FieldValue } = await import('firebase-admin/firestore');
    
    const orcamentoData = {
      clienteId,
      dataEvento,
      numConvidados,
      pratosSelecionados: pratosSelecionados || [],
      custoTotal,
      valorVenda,
      status: 'pendente', 
      createdAt: FieldValue.serverTimestamp(),
      criadoPorId: decodedToken.uid // Rastreabilidade do criador
    };

    await novoOrcamentoRef.set(orcamentoData);

    return res.status(201).json({
      success: true,
      orcamentoId: novoOrcamentoRef.id,
      message: 'Orçamento gerado com sucesso no Firebase.'
    });

  } catch (error) {
    console.error('SERVER ACTION ERROR: Falha ao criar orçamento', error);
    return res.status(500).json({ error: 'Erro interno ao processar a criação do orçamento.' });
  }
}
