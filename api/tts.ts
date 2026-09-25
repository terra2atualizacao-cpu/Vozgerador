import { synthesizeLongText } from '../src/utils/synthesizer';

export const config = {
  maxDuration: 60, // Support longer generation on Vercel Pro/Enterprise or standard 10-15s
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { text, voice = 'pt-BR-FranciscaNeural', rate = '+0%', pitch = '+0Hz', volume = '+0%' } =
      req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Texto não informado ou vazio.' });
    }

    if (text.length > 25000) {
      return res.status(400).json({ error: 'Texto excede o limite de 25.000 caracteres.' });
    }

    const audioBuffer = await synthesizeLongText(text, voice, rate, pitch, volume);

    // Return direct binary MP3
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(audioBuffer);
  } catch (err: any) {
    console.error('Error generating audio in /api/tts:', err);
    return res.status(500).json({
      error: 'Erro na geração de áudio.',
      details: err?.message || String(err),
    });
  }
}
