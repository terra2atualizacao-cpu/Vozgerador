import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, Loader2, AlertCircle, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { Header } from './components/Header';
import { TextEditor } from './components/TextEditor';
import { VoiceSelector } from './components/VoiceSelector';
import { VoiceSettings } from './components/VoiceSettings';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryList } from './components/HistoryList';
import { AboutSection } from './components/AboutSection';
import { Voice, GeneratedAudio, GenerationProgress, ProsodySettings } from './types';
import { estimateDurationSeconds } from './utils/audio';
import { CURATED_VOICES } from './constants/voices';
import {
  saveAudioToDB,
  getAllAudiosFromDB,
  deleteAudioFromDB,
  clearAllAudiosFromDB,
  updateAudioTitleInDB,
} from './utils/db';

const STORAGE_KEY_VOICE = 'vozlivre_selected_voice_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'converter' | 'voices' | 'history' | 'about'>('converter');
  const [voices, setVoices] = useState<Voice[]>(CURATED_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(() => {
    try {
      const savedVoiceId = localStorage.getItem(STORAGE_KEY_VOICE);
      return CURATED_VOICES.find((v) => v.id === savedVoiceId) || CURATED_VOICES[0];
    } catch {
      return CURATED_VOICES[0];
    }
  });
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  const [text, setText] = useState<string>('');
  const [audioTitle, setAudioTitle] = useState<string>('');
  const [settings, setSettings] = useState<ProsodySettings>({
    rate: '+0%',
    pitch: '+0Hz',
    volume: '+0%',
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    active: false,
    completedChunks: 0,
    totalChunks: 0,
    percent: 0,
    statusText: '',
  });

  const [currentAudio, setCurrentAudio] = useState<GeneratedAudio | null>(null);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(null);

  // Load voices from API
  useEffect(() => {
    async function fetchVoices() {
      try {
        const res = await fetch('/api/voices');
        const data = await res.json();
        if (data.voices && Array.isArray(data.voices)) {
          setVoices(data.voices);

          // Restore saved voice or pick default (Francisca)
          const savedVoiceId = localStorage.getItem(STORAGE_KEY_VOICE);
          const found = data.voices.find((v: Voice) => v.id === savedVoiceId);
          if (found) {
            setSelectedVoice(found);
          } else {
            const defaultVoice = data.voices.find((v: Voice) => v.isDefault) || data.voices[0];
            setSelectedVoice(defaultVoice);
          }
        }
      } catch (err) {
        console.error('Failed to load voices:', err);
      }
    }
    fetchVoices();
  }, []);

  // Load history permanently from IndexedDB (preserves raw audio files locally)
  useEffect(() => {
    async function loadSavedAudios() {
      try {
        const items = await getAllAudiosFromDB();
        if (items && items.length > 0) {
          const loaded: GeneratedAudio[] = items.map((item) => {
            const blobUrl = URL.createObjectURL(item.audioBlob);
            return {
              id: item.id,
              title: item.title,
              voice: item.voice,
              textSnippet: item.textSnippet,
              charCount: item.charCount,
              durationSeconds: item.durationSeconds,
              createdAt: item.createdAt,
              audioUrl: blobUrl,
              downloadUrl: blobUrl,
              blobUrl: blobUrl,
              blob: item.audioBlob,
              sizeBytes: item.sizeBytes,
            };
          });
          setHistory(loaded);
        }
      } catch (e) {
        console.error('Failed to load audio history from IndexedDB:', e);
      }
    }
    loadSavedAudios();
  }, []);

  const handleSelectVoice = (voice: Voice) => {
    setSelectedVoice(voice);
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, voice.id);
    } catch {}
    setIsVoicePickerOpen(false);
  };

  const handleUpdateAudioTitle = async (id: string, newTitle: string) => {
    try {
      await updateAudioTitleInDB(id, newTitle);
    } catch (e) {
      console.error('Failed to update title in DB:', e);
    }
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
    if (currentAudio?.id === id) {
      setCurrentAudio((prev) => (prev ? { ...prev, title: newTitle } : null));
    }
  };

  const handleDeleteAudio = async (id: string) => {
    try {
      await deleteAudioFromDB(id);
    } catch (e) {
      console.error('Failed to delete from IndexedDB:', e);
    }
    setHistory((prev) => prev.filter((i) => i.id !== id));
    if (currentAudio?.id === id) {
      setCurrentAudio(null);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearAllAudiosFromDB();
    } catch (e) {
      console.error('Failed to clear IndexedDB:', e);
    }
    setHistory([]);
  };

  // Cancel generation
  const handleCancelGeneration = () => {
    if (eventSourceRef) {
      eventSourceRef.close();
      setEventSourceRef(null);
    }
    setIsGenerating(false);
    setProgress({
      active: false,
      completedChunks: 0,
      totalChunks: 0,
      percent: 0,
      statusText: '',
    });
  };

  // Main Conversion Handler (supports up to 20,000 characters)
  const handleConvert = async () => {
    if (!text.trim()) {
      setError('Por favor, insira ou cole o texto que deseja converter em voz.');
      return;
    }

    if (text.length > 25000) {
      setError('O texto ultrapassa o limite máximo permitido de 25.000 caracteres.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setProgress({
      active: true,
      completedChunks: 0,
      totalChunks: 1,
      percent: 5,
      statusText: 'Iniciando síntese de voz...',
    });

    const activeVoice = selectedVoice || voices[0] || {
      id: 'pt-BR-FranciscaNeural',
      name: 'Francisca',
      gender: 'Feminino',
      lang: 'pt-BR',
      langLabel: 'Português (Brasil)',
      description: 'Voz natural e expressiva',
    };

    try {
      // Smooth progress indicator
      let curPercent = 10;
      const progressTimer = setInterval(() => {
        curPercent = Math.min(94, curPercent + 12);
        setProgress((p) => ({
          ...p,
          percent: curPercent,
          statusText: `Sintetizando áudio neural com ${activeVoice.name} (${curPercent}%)...`,
        }));
      }, 350);

      // Direct POST to /api/tts - works on Vercel Serverless & Express
      const res = await fetch('/api/tts?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          voice: activeVoice.id,
          rate: settings.rate,
          pitch: settings.pitch,
          volume: settings.volume,
        }),
      });

      clearInterval(progressTimer);

      if (!res.ok) {
        let errMessage = 'Erro na síntese de áudio.';
        try {
          const errJson = await res.json();
          errMessage = errJson?.error || errMessage;
        } catch {
          errMessage = 'Serviço de voz temporariamente ocupado. Tente novamente.';
        }
        throw new Error(errMessage);
      }

      // Read audio binary directly
      let audioBlob: Blob;
      const cType = res.headers.get('content-type') || '';
      if (cType.includes('audio/')) {
        audioBlob = await res.blob();
      } else {
        const jsonData = await res.json();
        if (jsonData.audioUrl) {
          const fileRes = await fetch(jsonData.audioUrl);
          audioBlob = await fileRes.blob();
        } else {
          throw new Error('Formato de resposta de áudio inválido.');
        }
      }

      const audioId = res.headers.get('x-audio-id') || crypto.randomUUID();
      const localAudioUrl = URL.createObjectURL(audioBlob);

      setProgress({
        active: false,
        completedChunks: 1,
        totalChunks: 1,
        percent: 100,
        statusText: 'Áudio concluído com sucesso!',
      });
      setIsGenerating(false);

      // Determine user defined title or sensible fallback from text
      const firstSnippet = text.trim().slice(0, 70).replace(/\n/g, ' ') + (text.length > 70 ? '...' : '');
      const determinedTitle =
        audioTitle.trim() ||
        text.trim().slice(0, 50).replace(/\n/g, ' ') ||
        `audio-${activeVoice.name.toLowerCase()}`;
      const estDuration = estimateDurationSeconds(text.length);

      const newAudio: GeneratedAudio = {
        id: audioId,
        title: determinedTitle,
        voice: activeVoice,
        textSnippet: firstSnippet,
        charCount: text.length,
        durationSeconds: estDuration,
        createdAt: Date.now(),
        audioUrl: localAudioUrl,
        downloadUrl: localAudioUrl,
        blobUrl: localAudioUrl,
        blob: audioBlob,
        sizeBytes: audioBlob.size,
      };

      setCurrentAudio(newAudio);

      // Persist to IndexedDB permanently
      try {
        await saveAudioToDB({
          id: audioId,
          title: determinedTitle,
          voice: activeVoice,
          textSnippet: firstSnippet,
          charCount: text.length,
          durationSeconds: estDuration,
          createdAt: Date.now(),
          sizeBytes: audioBlob.size,
          audioBlob,
        });
      } catch (dbErr) {
        console.error('Failed to save audio to IndexedDB:', dbErr);
      }

      setHistory((prev) => [newAudio, ...prev.filter((i) => i.id !== audioId)]);
    } catch (err: any) {
      console.error('TTS error:', err);
      setIsGenerating(false);
      setProgress({
        active: false,
        completedChunks: 0,
        totalChunks: 0,
        percent: 0,
        statusText: '',
      });
      setError(
        err?.message || 'Falha na conexão com o serviço de voz. Verifique sua conexão e tente novamente.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
      {/* 3-Zone Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setError(null);
        }}
        historyCount={history.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Error notification */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-900/50 bg-rose-950/40 p-4 flex items-start justify-between gap-3 text-sm text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-rose-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
        )}

        {/* View 1: Converter */}
        {activeTab === 'converter' && (
          <div className="space-y-6">
            {/* Minimalist Hero Subhead */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-neutral-900 pb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Texto em Voz Natural
                </h1>
                <p className="text-sm text-neutral-400 mt-1 max-w-xl">
                  Gere áudios longos de até 20.000 caracteres com entonação humana ultra-realista. 100% gratuito, sem limite de créditos e com download imediato em MP3 e WAV com o nome que você escolher.
                </p>
              </div>

              {/* Trust Tag */}
              <div className="flex items-center gap-2 text-xs text-neutral-400 shrink-0">
                <span className="font-mono text-neutral-300">20.000</span> caracteres
                <span aria-hidden="true">·</span>
                <span>Voz Neural Edge</span>
              </div>
            </div>

            {/* Selected Voice Card & Picker Trigger */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-100 shrink-0">
                    <Volume2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">Voz Selecionada:</span>
                      <strong className="text-sm font-semibold text-white">
                        {selectedVoice?.name || 'Carregando vozes...'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                      <span>{selectedVoice?.langLabel || 'Português (Brasil)'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedVoice?.gender || 'Feminino'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="hidden sm:inline text-neutral-400">
                        {selectedVoice?.description}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  <span>{isVoicePickerOpen ? 'Fechar Catálogo' : 'Trocar Voz'}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isVoicePickerOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {/* Expandable Voice Picker Accordion */}
              {isVoicePickerOpen && (
                <div className="mt-4 pt-4 border-t border-neutral-800">
                  <VoiceSelector
                    voices={voices}
                    selectedVoiceId={selectedVoice?.id || ''}
                    onSelectVoice={handleSelectVoice}
                  />
                </div>
              )}
            </div>

            {/* Text Editor with Char Counter & File Name input */}
            <TextEditor
              text={text}
              onChange={setText}
              audioTitle={audioTitle}
              onTitleChange={setAudioTitle}
              maxChars={20000}
              disabled={isGenerating}
            />

            {/* Voice Prosody Settings (Speed & Pitch) */}
            <VoiceSettings
              settings={settings}
              onChange={setSettings}
              disabled={isGenerating}
            />

            {/* Generation CTA & Progress */}
            <div className="space-y-3 pt-2">
              {!isGenerating ? (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={!text.trim() || isGenerating}
                  className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-neutral-950 bg-white hover:bg-neutral-200 active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Converter em Áudio Natural</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span className="flex items-center gap-2 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>{progress.statusText}</span>
                    </span>
                    <span className="font-mono tabular-nums text-neutral-400">
                      {progress.percent}%
                    </span>
                  </div>

                  {/* Clean Progress Bar */}
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                    <span>Processando áudio com voz neural em múltiplos blocos simultâneos</span>
                    <button
                      type="button"
                      onClick={handleCancelGeneration}
                      className="text-neutral-400 hover:text-rose-400 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Player (Appears when audio is ready) */}
            {currentAudio && (
              <div className="pt-2 animate-in fade-in duration-300">
                <AudioPlayer
                  audio={currentAudio}
                  onUpdateTitle={handleUpdateAudioTitle}
                />
              </div>
            )}
          </div>
        )}

        {/* View 2: Full Voice Catalog */}
        {activeTab === 'voices' && (
          <div className="space-y-6">
            <div className="border-b border-neutral-900 pb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Catálogo de Vozes Neurais
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Todas as vozes utilizam modelos neurais avançados com entonação humana natural e sem limites de créditos. Clique no botão de reprodução para ouvir uma demonstração de cada voz.
              </p>
            </div>

            <VoiceSelector
              voices={voices}
              selectedVoiceId={selectedVoice?.id || ''}
              onSelectVoice={(voice) => {
                handleSelectVoice(voice);
                setActiveTab('converter');
              }}
            />
          </div>
        )}

        {/* View 3: History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <HistoryList
              history={history}
              currentAudioId={currentAudio?.id}
              onSelectAudio={(item) => {
                setCurrentAudio(item);
                setActiveTab('converter');
              }}
              onDeleteAudio={handleDeleteAudio}
              onClearHistory={handleClearHistory}
              onUpdateTitle={handleUpdateAudioTitle}
            />
          </div>
        )}

        {/* View 4: How It Works */}
        {activeTab === 'about' && (
          <AboutSection />
        )}
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950 py-6 mt-12 text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">VozLivre</span>
            <span aria-hidden="true">·</span>
            <span>Síntese de Voz Neural Livre e Ilimitada</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Nomeação Personalizada de Arquivos</span>
            <span aria-hidden="true">·</span>
            <span>Até 20.000 caracteres</span>
            <span aria-hidden="true">·</span>
            <span>Zero Créditos / Grátis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
