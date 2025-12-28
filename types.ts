
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SmartNotes {
  id: string;
  timestamp: number;
  title: string;
  summary: string;
  keyConcepts: string[];
  actionItems: string[];
  transcription: string;
  sources?: GroundingSource[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type PageView = 'HOME' | 'HISTORY' | 'HOW_IT_WORKS' | 'RESOURCES' | 'SETTINGS';
