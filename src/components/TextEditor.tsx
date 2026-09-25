import React, { useRef } from 'react';
import { Upload, Clipboard, Trash2, Wand2, FileText, Clock, FileAudio } from 'lucide-react';
import { estimateDurationSeconds, formatTime } from '../utils/audio';

interface TextEditorProps {
  text: string;
  onChange: (val: string) => void;
  audioTitle?: string;
  onTitleChange?: (val: string) => void;
  maxChars?: number;
  disabled?: boolean;
}

const SAMPLE_TEXTS = [
  {
    title: 'Exemplo: Narração / História',
    text: `Era uma manhã tranquila quando as primeiras notas de música começaram a ecoar pelo vale silencioso. O viajante parou à beira do caminho de pedras antigas, observando a névoa se dissipar sob a luz suave do sol. Ele sabia que aquela jornada estava apenas começando, mas cada passo dado trazia uma nova certeza de que o destino valeria todo o esforço. Com a mente serena e o coração cheio de esperança, ele respirou fundo e seguiu em frente.`,
  },
  {
    title: 'Exemplo: Artigo de Tecnologia',
    text: `A inteligência artificial transformou radicalmente a maneira como interagimos com computadores e consumimos informações. Hoje, a síntese de voz neural permite alcançar entonações humanas, pausas naturais e clareza acústica comparável a locuções profissionais de estúdio. Ferramentas abertas e gratuitas democratizam essa tecnologia, permitindo que educadores, criadores de conteúdo e pesquisadores convertam textos extensos em áudio acessível sem barreiras financeiras ou restrições de créditos.`,
  },
  {
    title: 'Exemplo: Texto Longo (3.500 caracteres)',
    text: `Capítulo 1: O Surgimento da Voz Digital.
Desde os primeiros experimentos com síntese mecânica de voz no século dezoito, a humanidade busca replicar a complexidade do aparelho fonador humano. Nos primeiros sintetizadores computacionais, as vozes soavam robóticas, monocórdicas e cansativas para o ouvinte. No entanto, a introdução das redes neurais profundas e dos modelos de atenção transformou completamente esse cenário.

Hoje, a conversão de texto em fala compreende o contexto gramatical, a pontuação, o ritmo da respiração e as variações sutis de ênfase que tornam uma leitura verdadeiramente natural e prazerosa. Esse avanço abre caminhos inéditos para acessibilidade digital: pessoas com deficiência visual agora têm acesso instantâneo a bibliotecas inteiras em áudio de alta fidelidade; estudantes podem revisar apostilas longas durante deslocamentos; e produtores de conteúdo podem gerar versões narradas de seus artigos em minutos.

A liberdade tecnológica é outro pilar fundamental. Por muito tempo, as melhores vozes neurais ficaram restritas a plataformas comerciais fechadas que cobravam assinaturas caras por minuto sintetizado. A proposta de ferramentas universais e ilimitadas é eliminar essas barreiras: permitir que qualquer pessoa processe textos curtos ou longos com velocidade, sem surpresas de saldo esgotado e com download direto dos arquivos gerados.

Com o processamento inteligente em blocos contínuos, até mesmo textos de milhares de caracteres são fragmentados respeitando as pausas naturais da linguagem falada. O resultado é um áudio unificado, cristalino e pronto para ser baixado nos formatos mais utilizados da indústria, como MP3 e WAV. O futuro da comunicação em áudio é acessível, livre e ilimitado.`.repeat(2),
  },
];

export const TextEditor: React.FC<TextEditorProps> = ({
  text,
  onChange,
  audioTitle,
  onTitleChange,
  maxChars = 20000,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const durationEst = estimateDurationSeconds(charCount);
  const isNearLimit = charCount > maxChars * 0.9;
  const isOverLimit = charCount > maxChars;

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        onChange(clipboardText);
      }
    } catch {
      // Fallback: browser permission denied
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onChange(content.slice(0, maxChars));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const cleanTextFormatting = () => {
    if (!text) return;
    // Remove duplicate empty lines and extra consecutive spaces
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    onChange(cleaned);
  };

  return (
    <div className="space-y-2">
      {/* Editor Top Bar with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <label htmlFor="tts-text-input" className="text-sm font-medium text-white">
            Texto para Converter
          </label>
          <span className="text-xs text-neutral-400">
            (Até 20.000 caracteres por geração)
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Samples Dropdown */}
          <div className="relative group">
            <button
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-md hover:text-white hover:border-neutral-700 transition-colors disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-neutral-400" />
              <span>Inserir Exemplo</span>
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block group-focus-within:block z-30 w-56 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl p-1">
              {SAMPLE_TEXTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(sample.text)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Paste */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-md hover:text-white hover:border-neutral-700 transition-colors disabled:opacity-50"
            title="Colar texto da área de transferência"
          >
            <Clipboard className="h-3.5 w-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Colar</span>
          </button>

          {/* Upload Text File */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-md hover:text-white hover:border-neutral-700 transition-colors disabled:opacity-50"
            title="Carregar arquivo .txt ou .md"
          >
            <Upload className="h-3.5 w-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Carregar .txt</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Clean redundant spacing */}
          {text.length > 0 && (
            <button
              type="button"
              onClick={cleanTextFormatting}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Otimizar espaçamentos e quebras de linha"
            >
              <Wand2 className="h-3 w-3" />
              <span className="hidden sm:inline">Formatar</span>
            </button>
          )}

          {/* Clear */}
          {text.length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-rose-400 transition-colors"
              title="Limpar texto"
            >
              <Trash2 className="h-3 w-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Audio Title / File Name Input Field */}
      {onTitleChange && (
        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-neutral-900/60 border border-neutral-800 rounded-xl focus-within:border-neutral-600 transition-colors">
          <FileAudio className="h-4 w-4 text-neutral-400 shrink-0" />
          <label htmlFor="audio-title-input" className="text-xs font-medium text-neutral-300 shrink-0">
            Nome do Áudio:
          </label>
          <input
            id="audio-title-input"
            type="text"
            value={audioTitle || ''}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={disabled}
            placeholder="Ex: Capítulo 1 - O Início, Roteiro Podcast, Notícia de Hoje... (Opcional)"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
          />
          <span className="text-[11px] font-mono text-neutral-500 shrink-0 hidden sm:inline">
            .mp3 / .wav
          </span>
        </div>
      )}

      {/* Main Textarea */}
      <div className="relative rounded-xl border border-neutral-800 bg-neutral-900/60 focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500 transition-all">
        <textarea
          id="tts-text-input"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Digite ou cole aqui o texto que deseja transformar em áudio natural... Suporta textos longos de até 20.000 caracteres (artigos, livros, scripts, histórias)."
          rows={8}
          className="w-full bg-transparent px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none resize-y leading-relaxed font-sans"
        />

        {/* Bottom Metadata & Statistics Strip */}
        <div className="flex flex-wrap items-center justify-between border-t border-neutral-800/80 px-4 py-2.5 text-xs text-neutral-400 bg-neutral-900/40 rounded-b-xl gap-2">
          {/* Audio Reading Estimate */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
              <span>Duração estimada:</span>
              <strong className="font-mono text-neutral-200">
                {formatTime(durationEst)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-mono text-neutral-200">{wordCount}</strong> palavras
            </span>
          </div>

          {/* Character Counter */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isOverLimit
                    ? 'bg-rose-500'
                    : isNearLimit
                    ? 'bg-amber-400'
                    : 'bg-neutral-300'
                }`}
                style={{ width: `${Math.min(100, (charCount / maxChars) * 100)}%` }}
              />
            </div>
            <span
              className={`font-mono text-xs tabular-nums ${
                isOverLimit
                  ? 'text-rose-400 font-bold'
                  : isNearLimit
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {charCount.toLocaleString('pt-BR')} / {maxChars.toLocaleString('pt-BR')} caracteres
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
