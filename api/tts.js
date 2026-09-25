import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Curated voices list for locale fallback
const CURATED_VOICES = [
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'pt-BR-ThalitaMultilingualNeural', name: 'Thalita', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'pt-BR-AntonioNeural', name: 'Antônio', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'André', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'en-US-BrianMultilingualNeural', name: 'Bruno', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'en-AU-WilliamMultilingualNeural', name: 'William', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'fr-FR-RemyMultilingualNeural', name: 'Rodrigo', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'de-DE-FlorianMultilingualNeural', name: 'Fábio', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'it-IT-GiuseppeMultilingualNeural', name: 'Gustavo', lang: 'pt-BR', voiceLocale: 'pt-BR' },
  { id: 'pt-PT-RaquelNeural', name: 'Raquel', lang: 'pt-PT', voiceLocale: 'pt-PT' },
  { id: 'pt-PT-DuarteNeural', name: 'Duarte', lang: 'pt-PT', voiceLocale: 'pt-PT' },
  { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', voiceLocale: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', voiceLocale: 'en-US' },
  { id: 'en-US-AriaNeural', name: 'Aria', lang: 'en-US', voiceLocale: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', lang: 'en-GB', voiceLocale: 'en-GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', lang: 'en-GB', voiceLocale: 'en-GB' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES', voiceLocale: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', name: 'Álvaro', lang: 'es-ES', voiceLocale: 'es-ES' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: 'es-MX', voiceLocale: 'es-MX' },
];

function chunkText(text, maxLen = 420) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n+/);
  const sentences = [];

  for (const para of paragraphs) {
    const rawSentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [para];
    for (const s of rawSentences) {
      const trimmed = s.trim();
      if (trimmed) sentences.push(trimmed);
    }
  }

  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > maxLen) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      const commas = s.split(/(?<=[,;:—])\s+/);
      for (const part of commas) {
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

async function synthesizeChunk(text, voice, rate = '+0%', pitch = '+0Hz', volume = '+0%') {
  const tts = new MsEdgeTTS();
  const matchedVoice = CURATED_VOICES.find((v) => v.id === voice);
  const voiceLocale = matchedVoice?.voiceLocale || (voice.startsWith('pt-') ? 'pt-BR' : undefined);

  if (voiceLocale) {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { voiceLocale });
  } else {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  }

  return new Promise((resolve, reject) => {
    try {
      const { audioStream } = tts.toStream(text, {
        rate: rate || '+0%',
        pitch: pitch || '+0Hz',
        volume: volume || '+0%',
      });

      const chunks = [];
      audioStream.on('data', (d) => chunks.push(d));
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

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { text, voice = 'pt-BR-FranciscaNeural', rate = '+0%', pitch = '+0Hz', volume = '+0%' } =
      body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Texto não informado ou vazio.' });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Nenhum texto válido para conversão.' });
    }

    const results = new Array(chunks.length);
    const concurrency = 3;
    let currentIndex = 0;

    async function worker() {
      while (currentIndex < chunks.length) {
        const idx = currentIndex++;
        const chunk = chunks[idx];
        let attempts = 0;
        let success = false;

        while (!success && attempts < 3) {
          try {
            attempts++;
            results[idx] = await synthesizeChunk(chunk, voice, rate, pitch, volume);
            success = true;
          } catch (err) {
            if (attempts >= 3) throw err;
            await new Promise((r) => setTimeout(r, 300 * attempts));
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
    await Promise.all(workers);

    const fullBuffer = Buffer.concat(results);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', fullBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(fullBuffer);
  } catch (err) {
    console.error('Error in /api/tts:', err);
    return res.status(500).json({
      error: 'Erro na geração de áudio.',
      details: err?.message || String(err),
    });
  }
}
