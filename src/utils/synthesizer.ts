import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { CURATED_VOICES } from '../constants/voices';

/**
 * Intelligent text chunker: splits text into natural pieces
 * between 250 and 450 characters respecting punctuation boundaries.
 */
export function chunkText(text: string, maxLen = 420): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n+/);
  const sentences: string[] = [];

  for (const para of paragraphs) {
    const rawSentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [para];
    for (const s of rawSentences) {
      const trimmed = s.trim();
      if (trimmed) sentences.push(trimmed);
    }
  }

  const chunks: string[] = [];
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

/**
 * Synthesizes a single chunk with MsEdgeTTS.
 */
export async function synthesizeSingleChunk(
  text: string,
  voice: string,
  rate = '+0%',
  pitch = '+0Hz',
  volume = '+0%',
  overrideLocale?: string
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  const matchedVoice = CURATED_VOICES.find((v) => v.id === voice);
  const voiceLocale =
    overrideLocale ||
    matchedVoice?.voiceLocale ||
    (voice.startsWith('pt-') ? 'pt-BR' : undefined);

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
export async function synthesizeLongText(
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
  const concurrency = 4;
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
          await new Promise((r) => setTimeout(r, 300 * attempts));
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
  await Promise.all(workers);

  return Buffer.concat(results);
}
