import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Disk storage for permanent local preservation of generated audio
const DATA_DIR = path.resolve(__dirname, 'data', 'audios');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory cache for audio results (expires after 30 minutes)
interface AudioCacheEntry {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}
const audioCache = new Map<string, AudioCacheEntry>();

// Cleanup cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of audioCache.entries()) {
    if (now - entry.createdAt > 30 * 60 * 1000) {
      audioCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Curated list of high-quality neural voices
const CURATED_VOICES = [
  // Portuguese - Brazil (Female)
  {
    id: 'pt-BR-FranciscaNeural',
    name: 'Francisca',
    gender: 'Feminino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Natural, expressiva e envolvente. Perfeita para histórias, artigos e audiobooks.',
    isDefault: true,
  },
  {
    id: 'pt-BR-ThalitaMultilingualNeural',
    name: 'Thalita',
    gender: 'Feminino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Suave, amigável e moderna. Ótima para podcasts e conteúdos descontraídos.',
  },

  // Portuguese - Brazil (Male) - Expanding Brazilian Male Voices as requested
  {
    id: 'pt-BR-AntonioNeural',
    name: 'Antônio',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz clássica, madura, firme e segura. Excelente para notícias, tutoriais e negócios.',
  },
  {
    id: 'en-US-AndrewMultilingualNeural',
    name: 'André',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz masculina jovem, dinâmica e natural. Ideal para vídeos, podcasts e narrativas contemporâneas.',
    voiceLocale: 'pt-BR',
  },
  {
    id: 'en-US-BrianMultilingualNeural',
    name: 'Bruno',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz encorpada, grave e com presença forte. Ótima para audiobooks, documentários e cinema.',
    voiceLocale: 'pt-BR',
  },
  {
    id: 'en-AU-WilliamMultilingualNeural',
    name: 'William',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz calorosa, calma e acolhedora. Perfeita para reflexões, histórias e leitura explicativa.',
    voiceLocale: 'pt-BR',
  },
  {
    id: 'fr-FR-RemyMultilingualNeural',
    name: 'Rodrigo',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz moderna, ágil e articulada. Ideal para apresentações e conteúdos didáticos.',
    voiceLocale: 'pt-BR',
  },
  {
    id: 'de-DE-FlorianMultilingualNeural',
    name: 'Fábio',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz serena, pausada e analítica. Perfeita para artigos longos e relatórios técnicos.',
    voiceLocale: 'pt-BR',
  },
  {
    id: 'it-IT-GiuseppeMultilingualNeural',
    name: 'Gustavo',
    gender: 'Masculino',
    lang: 'pt-BR',
    langLabel: 'Português (Brasil)',
    description: 'Voz comunicativa, enérgica e clara. Ótima para cursos online e treinamentos.',
    voiceLocale: 'pt-BR',
  },

  // Portuguese - Portugal
  {
    id: 'pt-PT-RaquelNeural',
    name: 'Raquel',
    gender: 'Feminino',
    lang: 'pt-PT',
    langLabel: 'Português (Portugal)',
    description: 'Clara e formal, com pronúncia nativa de Portugal.',
  },
  {
    id: 'pt-PT-DuarteNeural',
    name: 'Duarte',
    gender: 'Masculino',
    lang: 'pt-PT',
    langLabel: 'Português (Portugal)',
    description: 'Masculina profunda e pausada de Portugal.',
  },
  // English - US
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny',
    gender: 'Feminino',
    lang: 'en-US',
    langLabel: 'Inglês (EUA)',
    description: 'Ultra-natural US English female voice for general content.',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy',
    gender: 'Masculino',
    lang: 'en-US',
    langLabel: 'Inglês (EUA)',
    description: 'Warm, natural US English male voice.',
  },
  {
    id: 'en-US-AriaNeural',
    name: 'Aria',
    gender: 'Feminino',
    lang: 'en-US',
    langLabel: 'Inglês (EUA)',
    description: 'Expressive and engaging US female narrator.',
  },
  // English - UK
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia',
    gender: 'Feminino',
    lang: 'en-GB',
    langLabel: 'Inglês (Reino Unido)',
    description: 'Clear British English female voice.',
  },
  {
    id: 'en-GB-RyanNeural',
    name: 'Ryan',
    gender: 'Masculino',
    lang: 'en-GB',
    langLabel: 'Inglês (Reino Unido)',
    description: 'Natural British English male narrator.',
  },
  // Spanish
  {
    id: 'es-ES-ElviraNeural',
    name: 'Elvira',
    gender: 'Feminino',
    lang: 'es-ES',
    langLabel: 'Espanhol (Espanha)',
    description: 'Voz femenina natural de España.',
  },
  {
    id: 'es-ES-AlvaroNeural',
    name: 'Álvaro',
    gender: 'Masculino',
    lang: 'es-ES',
    langLabel: 'Espanhol (Espanha)',
    description: 'Voz masculina cálida de España.',
  },
  {
    id: 'es-MX-DaliaNeural',
    name: 'Dalia',
    gender: 'Feminino',
    lang: 'es-MX',
    langLabel: 'Espanhol (México)',
    description: 'Voz femenina latinoamericana.',
  },
];

/**
 * Intelligent text chunker: splits text up to 20,000 characters
 * into natural pieces between 250 and 450 characters respecting
 * punctuation boundaries (paragraphs, periods, question marks, commas).
 */
function chunkText(text: string, maxLen = 420): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
  if (!clean) return [];

  // Split first by line breaks and strong punctuation
  const rawSegments = clean.split(/(?<=[.?!;:\n])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const seg of rawSegments) {
    const s = seg.trim();
    if (!s) continue;

    if (s.length > maxLen) {
      // Split long sentences by comma or space
      const subParts = s.split(/(?<=[,])\s+|\s+/);
      for (const part of subParts) {
        if (!part) continue;
        if ((current + ' ' + part).trim().length > maxLen) {
          if (current.trim()) chunks.push(current.trim());
          current = part;
        } else {
          current = current ? `${current} ${part}` : part;
        }
      }
    } else if ((current + ' ' + s).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Synthesizes a single chunk with MsEdgeTTS.
 */
async function synthesizeSingleChunk(
  text: string,
  voice: string,
  rate = '+0%',
  pitch = '+0Hz',
  volume = '+0%',
  overrideLocale?: string
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  const matchedVoice = CURATED_VOICES.find((v) => v.id === voice);
  const voiceLocale = overrideLocale || matchedVoice?.voiceLocale || (voice.startsWith('pt-') ? 'pt-BR' : undefined);

  if (voiceLocale) {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { voiceLocale });
  } else {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  }

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const { audioStream } = tts.toStream(text, {
        rate: rate || '+0%',
        pitch: pitch || '+0Hz',
        volume: volume || '+0%',
      });

      const chunks: Buffer[] = [];
      audioStream.on('data', (d: Buffer) => chunks.push(d));
      audioStream.on('end', () => {
        tts.close();
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err) => {
        tts.close();
        reject(err);
      });
    } catch (e) {
      tts.close();
      reject(e);
    }
  });
}

/**
 * Synthesizes long text by chunking and processing in controlled parallel batches.
 */
async function synthesizeLongText(
  text: string,
  voice: string,
  rate = '+0%',
  pitch = '+0Hz',
  volume = '+0%',
  onProgress?: (completed: number, total: number) => void
): Promise<Buffer> {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('Nenhum texto válido fornecido para conversão.');
  }

  const results: Buffer[] = new Array(chunks.length);
  const concurrency = 3; // 3 parallel connections for fast generation without overwhelming
  let currentIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (currentIndex < chunks.length) {
      const idx = currentIndex++;
      const chunk = chunks[idx];
      let attempts = 0;
      let success = false;

      while (!success && attempts < 3) {
        try {
          attempts++;
          results[idx] = await synthesizeSingleChunk(chunk, voice, rate, pitch, volume);
          success = true;
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, chunks.length);
          }
        } catch (err) {
          if (attempts >= 3) {
            throw err;
          }
          // Small backoff before retry
          await new Promise((r) => setTimeout(r, 400 * attempts));
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
  await Promise.all(workers);

  return Buffer.concat(results);
}

// API Routes
app.get('/api/voices', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    voices: CURATED_VOICES,
  });
});

// Single POST endpoint for instant generation or preview
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'pt-BR-FranciscaNeural', rate = '+0%', pitch = '+0Hz', volume = '+0%' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Texto não informado ou vazio.' });
      return;
    }

    if (text.length > 25000) {
      res.status(400).json({ error: 'Texto excede o limite máximo suportado de 25.000 caracteres.' });
      return;
    }

    const audioBuffer = await synthesizeLongText(text, voice, rate, pitch, volume);
    const audioId = crypto.randomUUID();

    audioCache.set(audioId, {
      buffer: audioBuffer,
      mimeType: 'audio/mpeg',
      createdAt: Date.now(),
    });

    // Persist to local disk so audio is never lost
    try {
      fs.writeFileSync(path.join(DATA_DIR, `${audioId}.mp3`), audioBuffer);
    } catch (e) {
      console.error('Failed to write audio to disk:', e);
    }

    res.json({
      status: 'ok',
      id: audioId,
      sizeBytes: audioBuffer.length,
      audioUrl: `/api/tts/audio/${audioId}`,
      downloadUrl: `/api/tts/audio/${audioId}?download=true`,
      chars: text.length,
    });
  } catch (err: any) {
    console.error('Error generating TTS:', err);
    res.status(500).json({
      error: 'Erro na geração de áudio. Tente novamente em alguns segundos.',
      details: err?.message || String(err),
    });
  }
});

// Job queue for SSE streaming of long texts
interface TtsJob {
  id: string;
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
  createdAt: number;
}
const activeJobs = new Map<string, TtsJob>();

// Create a job for SSE streaming (supports massive 20,000 char texts safely via POST)
app.post('/api/tts/jobs', (req: Request, res: Response) => {
  const { text, voice = 'pt-BR-FranciscaNeural', rate = '+0%', pitch = '+0Hz', volume = '+0%' } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Texto não informado ou vazio.' });
    return;
  }

  if (text.length > 25000) {
    res.status(400).json({ error: 'Texto excede o limite de 25.000 caracteres.' });
    return;
  }

  const jobId = crypto.randomUUID();
  activeJobs.set(jobId, {
    id: jobId,
    text,
    voice,
    rate,
    pitch,
    volume,
    createdAt: Date.now(),
  });

  const chunks = chunkText(text);

  res.json({
    status: 'ok',
    jobId,
    totalChunks: chunks.length,
    chars: text.length,
  });
});

// Stream SSE events for a created job
app.get('/api/tts/jobs/:id/events', async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    res.status(404).send('Job não encontrado ou expirado.');
    return;
  }

  // Remove job from map once connected
  activeJobs.delete(id);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const chunks = chunkText(job.text);
    sendEvent('init', {
      totalChunks: chunks.length,
      chars: job.text.length,
    });

    const audioBuffer = await synthesizeLongText(
      job.text,
      job.voice,
      job.rate,
      job.pitch,
      job.volume,
      (completed, total) => {
        sendEvent('progress', {
          completed,
          total,
          percent: Math.round((completed / total) * 100),
        });
      }
    );

    const audioId = crypto.randomUUID();
    audioCache.set(audioId, {
      buffer: audioBuffer,
      mimeType: 'audio/mpeg',
      createdAt: Date.now(),
    });

    // Persist to local disk so audio is never lost
    try {
      fs.writeFileSync(path.join(DATA_DIR, `${audioId}.mp3`), audioBuffer);
    } catch (e) {
      console.error('Failed to write audio to disk:', e);
    }

    sendEvent('done', {
      id: audioId,
      sizeBytes: audioBuffer.length,
      audioUrl: `/api/tts/audio/${audioId}`,
      downloadUrl: `/api/tts/audio/${audioId}?download=true`,
      chars: job.text.length,
    });
    res.end();
  } catch (err: any) {
    console.error('Job synthesis error:', err);
    sendEvent('error', { message: err?.message || 'Falha ao processar áudio' });
    res.end();
  }
});

// Audio streaming & download endpoint with disk backup
app.get('/api/tts/audio/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const download = req.query.download === 'true';

  let buffer: Buffer | undefined;
  let mimeType = 'audio/mpeg';

  const entry = audioCache.get(id);
  if (entry) {
    buffer = entry.buffer;
    mimeType = entry.mimeType;
  } else {
    // Check disk storage
    const diskPath = path.join(DATA_DIR, `${id}.mp3`);
    if (fs.existsSync(diskPath)) {
      try {
        buffer = fs.readFileSync(diskPath);
        audioCache.set(id, { buffer, mimeType, createdAt: Date.now() });
      } catch (err) {
        console.error('Failed to read from disk:', err);
      }
    }
  }

  if (!buffer) {
    res.status(404).send('Áudio não encontrado ou expirado.');
    return;
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (download) {
    const filename = `vozlivre-${id.slice(0, 8)}.mp3`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }

  res.send(buffer);
});

// Direct text preview for voice samples
app.post('/api/tts/preview', async (req: Request, res: Response) => {
  try {
    const { voice = 'pt-BR-FranciscaNeural', sampleText } = req.body;
    const textToSay = sampleText || 'Olá, esta é uma demonstração da minha voz natural com síntese de alta qualidade.';
    const buffer = await synthesizeSingleChunk(textToSay, voice);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar amostra.', details: err?.message });
  }
});

// Vite Integration
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
