import { Request, Response } from 'express';
import { google } from 'googleapis';
import stream from 'stream';

export const uploadNotaHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientEmail || !privateKey || !folderId) {
      console.error("Missing Google credentials in environment variables.");
      return res.status(500).json({ error: 'Configuração do Google Drive ausente no servidor.' });
    }

    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    // Upload the file
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
      fields: 'id, webViewLink'
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

    res.status(200).json({
      link: uploadResponse.data.webViewLink,
      message: 'Upload concluído com sucesso.'
    });

  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    res.status(500).json({ error: 'Erro interno ao realizar upload do arquivo.' });
  }
};
