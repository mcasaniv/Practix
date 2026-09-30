
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
  process?: string; // Proceso de admisión (ej: 'Ceprunsa I Fase 2027', 'Ceprunsa II Fase 2027', 'Ceprequintos 2027')
  targetSubject?: string; // Materia académica específica (ej: 'Física', 'Literatura', 'Biología')
  area?: 'Biomédicas' | 'Ingenierías' | 'Sociales'; // Área de admisión oficial
  weight?: number; // Valor/puntaje oficial asignado a la pregunta
}

export interface TopicPracticeHistoryItem {
  score: number;
  total: number;
  date: number;
  mode?: 'CLASSIC' | 'QUIZZIZ';
}

export interface TopicResult {
  score: number;
  total: number;
  timesPracticed?: number;
  classicPracticesCount?: number;
  gamePracticesCount?: number;
  lastPracticedAt?: number;
  bestScore?: number;
  history?: TopicPracticeHistoryItem[];
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

export interface SavedExam {
  id: string;
  title: string;
  course: string;
  subject: string;
  area: string;
  mode: ExamMode;
  questionIds: string[];
  totalQuestions: number;
  score?: number;
  maxScore?: number;
  solvedAt?: number;
  createdAt: number;
  selectedExamSubjects?: string[];
  selectedExamWeeks?: number[];
  selectedExamProcesses?: string[];
  attemptsCount?: number;
  userAnswers?: Record<string, number>;
}

export interface UserProfile {
  name: string;
  avatarUrl?: string;
}

export interface CustomDeck {
  id: string;
  title: string;
  description?: string;
  icon?: string; // Icon id e.g. 'star', 'brain', 'flame'
  color?: string; // e.g. 'indigo', 'purple', 'emerald', 'amber', 'rose', 'cyan'
  questionIds: string[];
  createdAt: number;
  updatedAt?: number;
  timesPracticed?: number;
  bestScore?: number;
  lastPracticedAt?: number;
}

export interface AppDatabase {
  questions: Question[];
  readingTexts?: ReadingText[];
  results?: Record<string, TopicResult>;
  totalPracticed?: number;
  totalFlashcardsPracticed?: number;
  flashcards?: Flashcard[];
  courseCovers?: Record<string, string>;
  savedExams?: SavedExam[];
  userProfile?: UserProfile;
  customDecks?: CustomDeck[];
}

export type ViewType = 'HOME' | 'SUBJECTS' | 'TOPICS' | 'QUIZ' | 'ADMIN' | 'MEGA_QUIZ' | 'MIXED_QUIZ' | 'EXAM_SETUP' | 'FLASHCARDS_HOME' | 'FLASHCARDS_SUBJECTS' | 'FLASHCARDS_PLAY' | 'STATS' | 'CUSTOM_DECKS';

export type ExamMode = 'GENERAL' | 'CUSTOM';

export interface NavigationState {
  view: ViewType;
  selectedCourse?: string;
  selectedSubject?: string;
  selectedTopic?: string;
  selectedDeckId?: string;
  mixedQuestions?: Question[];
  examMode?: ExamMode;
  selectedExamSubjects?: string[];
  selectedExamWeeks?: number[];
  selectedExamProcesses?: string[];
  selectedProcess?: string;
  retakeExam?: SavedExam;
  isReviewMode?: boolean;
  quizMode?: 'CLASSIC' | 'QUIZZIZ';
}

export interface CourseStructure {
  name: string;
  subjects: string[];
  icon: string;
  color: string;
}
