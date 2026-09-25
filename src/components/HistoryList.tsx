import React, { useState } from 'react';
import { Play, Download, Trash2, Clock, Volume2, History as HistoryIcon, HardDrive, Pencil, Check } from 'lucide-react';
import { GeneratedAudio } from '../types';
import { formatTime, formatBytes, downloadAudio, formatFilename } from '../utils/audio';

interface HistoryListProps {
  history: GeneratedAudio[];
  onSelectAudio: (audio: GeneratedAudio) => void;
  onDeleteAudio: (id: string) => void;
  onClearHistory: () => void;
  onUpdateTitle?: (id: string, newTitle: string) => void;
  currentAudioId?: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onSelectAudio,
  onDeleteAudio,
  onClearHistory,
  onUpdateTitle,
  currentAudioId,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const startEditing = (item: GeneratedAudio) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
  };

  const saveEditing = (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && onUpdateTitle) {
      onUpdateTitle(id, trimmed);
    }
    setEditingId(null);
  };

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 mb-3">
          <HistoryIcon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          Nenhum áudio gerado ainda
        </h3>
        <p className="text-sm text-neutral-400 max-w-sm mx-auto">
          Os áudios que você sintetizar ficarão salvos aqui no seu navegador com os nomes definidos, para que você possa escutar e baixar com o nome correto a qualquer momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Histórico de Gerações</h3>
          <p className="text-xs text-neutral-400">
            {history.length} {history.length === 1 ? 'áudio salvo' : 'áudios salvos'} localmente no navegador
          </p>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 border border-transparent hover:border-neutral-800 rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Limpar Histórico</span>
        </button>
      </div>

      <div className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
        {history.map((item) => {
          const isCurrent = item.id === currentAudioId;
          const isEditing = editingId === item.id;
          const downloadFilename = formatFilename(item.title, `audio-${item.id.slice(0, 8)}`, 'mp3');
          const dateStr = new Date(item.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={item.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                isCurrent ? 'bg-neutral-800/50' : 'hover:bg-neutral-900/80'
              }`}
            >
              {/* Left Info */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 max-w-sm">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditing(item.id)}
                        autoFocus
                        className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-sm text-white rounded focus:outline-none focus:border-white"
                      />
                      <button
                        type="button"
                        onClick={() => saveEditing(item.id)}
                        className="p-1 text-white bg-neutral-700 hover:bg-neutral-600 rounded"
                        title="Salvar nome"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate max-w-md">
                        {item.title || item.textSnippet || 'Áudio sem título'}
                      </span>
                      {onUpdateTitle && (
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="p-1 text-neutral-500 hover:text-white rounded transition-colors"
                          title="Renomear este áudio"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {isCurrent && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      (Em reprodução)
                    </span>
                  )}
                </div>

                {/* Clean unboxed metadata with download filename preview */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span>{item.voice.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.voice.langLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{item.charCount.toLocaleString('pt-BR')} caracteres</span>
                  {item.durationSeconds > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatTime(item.durationSeconds)}</span>
                    </>
                  )}
                  {item.sizeBytes && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatBytes(item.sizeBytes)}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <HardDrive className="h-3 w-3" />
                    <span>Salvo</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-neutral-300 font-mono">
                    Download: <span className="text-white underline decoration-neutral-600">{downloadFilename}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{dateStr}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Play in main player */}
                <button
                  type="button"
                  onClick={() => onSelectAudio(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                  title="Ouvir este áudio no player principal"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Ouvir</span>
                </button>

                {/* Download MP3 with custom name */}
                <button
                  type="button"
                  onClick={() => downloadAudio(item, downloadFilename)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                  title={`Baixar como "${downloadFilename}"`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Baixar MP3</span>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onDeleteAudio(item.id)}
                  className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  title="Excluir do histórico"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
