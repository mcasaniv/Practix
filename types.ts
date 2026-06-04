
export interface ReadingText {
  id: string;
  title: string;
  content: string;
  subject: string;
}

export interface Question {
  id: string;
  course: string;
  subject: string;
  topic: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  order: number;
  createdAt: number;
  readingTextId?: string;
  imageUrl?: string; // Nuevo: Soporte opcional para imágenes por link
  optionsImageUrls?: string[];
  explanationImageUrl?: string;
  week?: number; // Opcional: Semana a la que pertenece el tema (1, 2, 3...)
}

export interface TopicResult {
  score: number;
  total: number;
}

export interface Flashcard {
  id: string;
  course: string;
  subject: string;
  topic?: string;
  front: string;
  back: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  createdAt: number;
  order?: number;
}

export interface AppDatabase {
  questions: Question[];
  readingTexts?: ReadingText[];
  results?: Record<string, TopicResult>;
  totalPracticed?: number;
  totalFlashcardsPracticed?: number;
  flashcards?: Flashcard[];
  courseCovers?: Record<string, string>;
}

export type ViewType = 'HOME' | 'SUBJECTS' | 'TOPICS' | 'QUIZ' | 'ADMIN' | 'MEGA_QUIZ' | 'MIXED_QUIZ' | 'EXAM_SETUP' | 'FLASHCARDS_HOME' | 'FLASHCARDS_SUBJECTS' | 'FLASHCARDS_PLAY';

export type ExamMode = 'GENERAL' | 'CUSTOM';

export interface NavigationState {
  view: ViewType;
  selectedCourse?: string;
  selectedSubject?: string;
  selectedTopic?: string;
  mixedQuestions?: Question[];
  examMode?: ExamMode;
  selectedExamSubjects?: string[];
}

export interface CourseStructure {
  name: string;
  subjects: string[];
  icon: string;
  color: string;
}
