export interface Voice {
  id: string;
  name: string;
  gender: string;
  lang: string;
  langLabel: string;
  description: string;
  isDefault?: boolean;
  voiceLocale?: string;
}

export interface GeneratedAudio {
  id: string;
  title: string;
  voice: Voice;
  textSnippet: string;
  charCount: number;
  durationSeconds: number;
  createdAt: number;
  audioUrl: string;
  downloadUrl: string;
  blobUrl?: string;
  blob?: Blob;
  sizeBytes?: number;
}

export interface GenerationProgress {
  active: boolean;
  completedChunks: number;
  totalChunks: number;
  percent: number;
  statusText: string;
}

export interface ProsodySettings {
  rate: string; // e.g. "+0%", "+15%", "-20%"
  pitch: string; // e.g. "+0Hz", "+15Hz", "-15Hz"
  volume: string; // e.g. "+0%"
}

export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

export interface VideoClip {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  label: string;
}
