import { google } from 'googleapis';
import stream from 'stream';
import multer from 'multer';

// Disable default body parser of Vercel to allow multer to parse multipart form
export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();
const upload = multer({ storage }).single('notaFiscal');

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: any, res: any) {
  // Check if it is a POST request
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Run the multer middleware to parse the file
    await runMiddleware(req, res, upload);

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
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

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const fileMetadata = {
      name: req.file.originalname,
      parents: [folderId],
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferStream,
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    const fileId = uploadResponse.data.id;

    if (!fileId) {
      throw new Error("Falha ao obter o ID do arquivo após upload.");
    }

    // Set permissions so anyone can read the file
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return res.status(200).json({
      link: uploadResponse.data.webViewLink,
      message: 'Upload concluído com sucesso.'
    });

  } catch (error: any) {
    console.error('Error in upload-nota serverless handler:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao realizar upload do arquivo.' });
  }
}
