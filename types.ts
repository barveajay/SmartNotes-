
export interface QuizItem {
  question: string;
  options: string[];
  answer: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

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
  quiz?: QuizItem[];
  flashcards?: Flashcard[];
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

export type PageView = 'HOME' | 'HISTORY' | 'HOW_IT_WORKS' | 'RESOURCES' | 'SETTINGS' | 'STUDY_MODE';
