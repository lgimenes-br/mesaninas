import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  // Allow POST requests for the deletion
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { fileUrl } = req.body || {};

    if (!fileUrl) {
      return res.status(400).json({ error: 'Nenhuma URL de arquivo enviada.' });
    }

    // Try to extract Google Drive fileId using regex
    const driveIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = driveIdMatch ? driveIdMatch[1] : null;

    if (!fileId) {
      return res.status(400).json({ error: 'Não foi possível extrair o ID do arquivo a partir da URL fornecida.' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error("Missing Google Drive OAuth2 credentials in environment variables.");
      return res.status(500).json({ error: 'Configuração do Google Drive OAuth2 ausente no servidor.' });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Physically delete the file from Google Drive
    await drive.files.delete({
      fileId: fileId,
    });

    return res.status(200).json({
      success: true,
      message: 'Arquivo excluído com sucesso do Google Drive.'
    });

  } catch (error: any) {
    console.error('Error in delete-nota serverless handler:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao excluir arquivo do Google Drive.' });
  }
}
