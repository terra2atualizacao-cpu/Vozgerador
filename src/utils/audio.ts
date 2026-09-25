/**
 * Utility functions for audio manipulation, formatting, and downloads.
 */

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Estimates reading/audio duration in seconds from character count.
 * Average Portuguese speech rate is approx 140 words/min or 850 chars/min.
 */
export function estimateDurationSeconds(charCount: number, rateMultiplier = 1.0): number {
  if (!charCount || charCount <= 0) return 0;
  const words = Math.max(1, Math.round(charCount / 5.5));
  const minutes = words / (135 * rateMultiplier);
  return Math.max(1, Math.round(minutes * 60));
}

/**
 * Cleans and formats a custom file name safely for downloads.
 */
export function formatFilename(name: string | undefined, fallback: string, ext: string): string {
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
  if (!name || !name.trim()) {
    return `${fallback}${cleanExt}`;
  }
  // Sanitize illegal filesystem characters: \ / : * ? " < > |
  let sanitized = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ');

  // Remove existing extension if typed by user
  if (sanitized.toLowerCase().endsWith(cleanExt.toLowerCase())) {
    sanitized = sanitized.slice(0, -cleanExt.length);
  }

  return `${sanitized.trim() || fallback}${cleanExt}`;
}

/**
 * Downloads a Blob directly with browser verification.
 * Creates a clean object URL to ensure cross-origin/iframe compatibility.
 */
export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(blobUrl);
    }, 10000);
    return true;
  } catch (err) {
    console.error('downloadBlob error:', err);
    return false;
  }
}

/**
 * Downloads audio file by either utilizing existing Blob or fetching and creating one.
 */
export async function downloadAudio(
  audio: { blob?: Blob; blobUrl?: string; audioUrl: string },
  filename: string
): Promise<void> {
  try {
    if (audio.blob) {
      downloadBlob(audio.blob, filename);
      return;
    }

    // If no blob in memory, fetch it as Blob
    const res = await fetch(audio.audioUrl);
    if (!res.ok) throw new Error('Não foi possível carregar o arquivo de áudio.');
    const blob = await res.blob();
    downloadBlob(blob, filename);
  } catch (err) {
    console.error('downloadAudio error:', err);
    // Last resort fallback: open direct download URL
    const a = document.createElement('a');
    a.href = audio.audioUrl.includes('?') ? `${audio.audioUrl}&download=true` : `${audio.audioUrl}?download=true`;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);
  }
}

/**
 * Converts an AudioBuffer to a WAV Blob for high-quality lossless download.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit precision

  // data sub-chunk
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}
