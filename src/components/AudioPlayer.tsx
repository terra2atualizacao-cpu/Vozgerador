import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Volume2,
  VolumeX,
  Share2,
  Check,
  Music,
  Pencil,
  FileAudio,
} from 'lucide-react';
import {
  formatTime,
  formatBytes,
  audioBufferToWavBlob,
  downloadAudio,
  downloadBlob,
  formatFilename,
} from '../utils/audio';
import { GeneratedAudio } from '../types';

interface AudioPlayerProps {
  audio: GeneratedAudio;
  onUpdateTitle?: (audioId: string, newTitle: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audio, onUpdateTitle }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isConvertingWav, setIsConvertingWav] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Custom audio name management
  const [audioTitle, setAudioTitle] = useState(audio.title || `audio-${audio.id.slice(0, 8)}`);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(audioTitle);

  // Sync state when audio changes
  useEffect(() => {
    const currentName = audio.title || `audio-${audio.id.slice(0, 8)}`;
    setAudioTitle(currentName);
    setTempTitle(currentName);
  }, [audio.id, audio.title]);

  const saveNewTitle = () => {
    const trimmed = tempTitle.trim() || `audio-${audio.id.slice(0, 8)}`;
    setAudioTitle(trimmed);
    setIsEditingTitle(false);
    if (onUpdateTitle) {
      onUpdateTitle(audio.id, trimmed);
    }
  };

  // Sync audio source
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = audio.audioUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [audio.audioUrl]);

  // Audio event listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoadedMetadata = () => {
      if (el.duration && !isNaN(el.duration) && isFinite(el.duration)) {
        setDuration(el.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  // Visualizer drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const numBars = 48;
    const barWidth = 3;
    const gap = 3;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const progress = duration > 0 ? currentTime / duration : 0;

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + gap);
        const barProgress = i / numBars;
        const isPast = barProgress <= progress;

        const timeFactor = isPlaying ? Date.now() / 250 : 0;
        const baseHeight = 6 + Math.sin(i * 0.4 + timeFactor) * 8 + Math.cos(i * 0.8) * 6;
        const height = Math.max(4, Math.min(canvas.height - 4, baseHeight));
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = isPast
          ? '#ffffff'
          : isPlaying
          ? 'rgba(255, 255, 255, 0.4)'
          : 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, y, barWidth, height);
      }

      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error(err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const skip = (delta: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const mp3Filename = formatFilename(audioTitle, `audio-${audio.id.slice(0, 8)}`, 'mp3');
  const wavFilename = formatFilename(audioTitle, `audio-${audio.id.slice(0, 8)}`, 'wav');

  const downloadMp3 = async () => {
    if (isDownloadingMp3) return;
    try {
      setIsDownloadingMp3(true);
      await downloadAudio(audio, mp3Filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error downloading MP3:', err);
    } finally {
      setIsDownloadingMp3(false);
    }
  };

  const downloadWav = async () => {
    if (isConvertingWav) return;
    try {
      setIsConvertingWav(true);
      let arrayBuf: ArrayBuffer;
      if (audio.blob) {
        arrayBuf = await audio.blob.arrayBuffer();
      } else {
        const res = await fetch(audio.audioUrl);
        arrayBuf = await res.arrayBuffer();
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
      const wavBlob = audioBufferToWavBlob(decodedBuffer);
      downloadBlob(wavBlob, wavFilename);
    } catch (err) {
      console.error('Failed to convert to WAV:', err);
      await downloadMp3();
    } finally {
      setIsConvertingWav(false);
    }
  };

  const copyAudioLink = () => {
    const fullUrl = `${window.location.origin}${audio.audioUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-4 shadow-xl">
      <audio ref={audioRef} preload="metadata" />

      {/* Header Info & File Name Customization */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1 min-w-0 flex-1">
          {/* Custom File Name Row */}
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-neutral-400 shrink-0" />
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveNewTitle()}
                  autoFocus
                  placeholder="Nome do arquivo..."
                  className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-sm text-white rounded-md focus:outline-none focus:border-white w-full"
                />
                <button
                  type="button"
                  onClick={saveNewTitle}
                  className="px-2.5 py-1 text-xs bg-white text-neutral-950 font-semibold rounded-md hover:bg-neutral-200 transition-colors"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <h4
                  onClick={() => setIsEditingTitle(true)}
                  className="text-sm font-semibold text-white tracking-tight truncate cursor-pointer hover:text-neutral-200 transition-colors"
                  title="Clique para renomear este áudio"
                >
                  {audioTitle}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-neutral-400 hover:text-white rounded transition-colors"
                  title="Renomear nome do arquivo para download"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Clean unboxed metadata with download filename preview */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>Voz: {audio.voice.name}</span>
            <span aria-hidden="true">·</span>
            <span>{audio.voice.langLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{audio.charCount.toLocaleString('pt-BR')} caracteres</span>
            {audio.sizeBytes && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{formatBytes(audio.sizeBytes)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 font-medium">Salvo localmente</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-300 font-mono">
              Arquivo: <span className="text-white underline decoration-neutral-600">{mp3Filename}</span>
            </span>
          </div>
        </div>

        {/* Primary Download Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Download MP3 */}
          <button
            type="button"
            onClick={downloadMp3}
            disabled={isDownloadingMp3}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-200 active:scale-95 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title={`Baixar como "${mp3Filename}"`}
          >
            {downloadSuccess ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{isDownloadingMp3 ? 'Preparando...' : downloadSuccess ? 'Baixado!' : 'Baixar MP3'}</span>
          </button>

          {/* Download WAV */}
          <button
            type="button"
            onClick={downloadWav}
            disabled={isConvertingWav}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            title={`Baixar como "${wavFilename}"`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isConvertingWav ? 'Convertendo...' : 'Baixar WAV'}</span>
          </button>

          {/* Share / Copy link */}
          <button
            type="button"
            onClick={copyAudioLink}
            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800/80 border border-neutral-700/80 rounded-lg transition-colors cursor-pointer"
            title="Copiar link direto do áudio"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Visualizer & Scrubber Canvas */}
      <div className="flex items-center justify-between gap-4 py-1">
        <canvas
          ref={canvasRef}
          width={288}
          height={32}
          className="w-48 sm:w-64 h-8 shrink-0"
        />

        {/* Progress & Time */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs font-mono text-neutral-400 tabular-nums shrink-0">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
          />

          <span className="text-xs font-mono text-neutral-400 tabular-nums shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Main Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Playback buttons */}
        <div className="flex items-center gap-2">
          {/* Skip -10s */}
          <button
            type="button"
            onClick={() => skip(-10)}
            className="p-2 text-neutral-400 hover:text-white rounded-lg transition-colors"
            title="Voltar 10 segundos"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Main Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-950 hover:bg-neutral-200 transition-transform active:scale-95 shadow-md cursor-pointer"
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip +10s */}
          <button
            type="button"
            onClick={() => skip(10)}
            className="p-2 text-neutral-400 hover:text-white rounded-lg transition-colors"
            title="Avançar 10 segundos"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Center: Playback Speed selector */}
        <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-lg border border-neutral-700/60">
          {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                playbackRate === rate
                  ? 'bg-white text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Right: Volume slider */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="text-neutral-400 hover:text-white transition-colors"
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>
      </div>
    </div>
  );
};
