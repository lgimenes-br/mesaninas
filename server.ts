import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { criarOrcamento } from './server/api/criarOrcamento';
import { criarUsuario } from './server/api/criarUsuario';
import uploadNotaHandler from './api/upload-nota';

const PORT = 3000;

async function startServer() {
  const app = express();
  
  // Middleware for parsing JSON bodies
  app.use(express.json());

  // === SERVER ACTIONS / API ROUTES ===
  // Healthcheck Route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Mesaninas API is running' });
  });

  // Main Endpoints (Next.js Server Action alternative for Express)
  app.post('/api/orcamentos', criarOrcamento);
  app.post('/api/usuarios', criarUsuario);
  app.post('/api/upload-nota', uploadNotaHandler);

  // === VITE / CLIENT HANDLING ===
  if (process.env.NODE_ENV !== 'production') {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Express inicializado na porta ${PORT}`);
  });
}

startServer();
