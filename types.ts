
export interface ReadingText {
  id: string;
  title: string;
  content: string;
  subject: string;
}

export type AcademicArea = 'Biomédicas' | 'Ingenierías' | 'Sociales' | 'Todas';
export type TargetArea = 'Biomédicas' | 'Ingenierías' | 'Sociales';

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
  area?: AcademicArea; // Área oficial de la práctica Ceprunsa (Biomédicas, Ingenierías, Sociales o Todas)
  areas?: TargetArea[]; // Áreas a las que aplica la pregunta (permite 1, 2 o las 3 áreas)
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

export interface OcclusionBox {
  id: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  width: number; // percentage 0 - 100
  height: number; // percentage 0 - 100
  correctAnswer: string;
  label?: string;
  hint?: string;
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
  type?: 'TEXT' | 'IMAGE_OCCLUSION' | 'FORMULA_BUILDER';
  imageUrl?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  occlusionBoxes?: OcclusionBox[];
  activeBoxId?: string;
  formulaTokens?: string[];
  formulaDistractors?: string[];
  formulaFull?: string;
  formulaExplanation?: string;
  multiAnswers?: string[];
  hasMultipleAnswers?: boolean;
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
  uid?: string;
  name: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  targetArea?: TargetArea;
  targetCareer?: string;
  plan?: string;
  soundEffectsEnabled?: boolean;
  motivationalQuotesEnabled?: boolean;
}

export interface CustomDeck {
  id: string;
  title: string;
  description?: string;
  icon?: string; // Icon id e.g. 'star', 'brain', 'flame'
  color?: string; // e.g. 'indigo', 'purple', 'emerald', 'amber', 'rose', 'cyan'
  course?: string;
  coverUrl?: string;
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
  incorrectQuestionIds?: string[];
  theoryNotes?: TheoryNote[];
}

export interface TheoryNote {
  id: string;
  course: string;
  subject: string;
  topic?: string;
  title: string;
  content: string;
  imageUrl?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type MemoryGameMode = 'FLASHCARDS' | 'MATCH' | 'QUIZ' | 'MULTI_SELECT';

export type ViewType = 'HOME' | 'SUBJECTS' | 'TOPICS' | 'QUIZ' | 'ADMIN' | 'MEGA_QUIZ' | 'MIXED_QUIZ' | 'EXAM_SETUP' | 'FLASHCARDS_HOME' | 'FLASHCARDS_SUBJECTS' | 'FLASHCARDS_PLAY' | 'STATS' | 'CUSTOM_DECKS' | 'THEORY' | 'PROFILE';

export type ExamMode = 'GENERAL' | 'CUSTOM';

export interface NavigationState {
  view: ViewType;
  selectedCourse?: string;
  selectedSubject?: string;
  selectedTopic?: string;
  selectedDeckId?: string;
  mixedQuestions?: Question[];
  isMistakesPractice?: boolean;
  examMode?: ExamMode;
  selectedExamSubjects?: string[];
  selectedExamWeeks?: number[];
  selectedExamProcesses?: string[];
  selectedProcess?: string;
  retakeExam?: SavedExam;
  isReviewMode?: boolean;
  quizMode?: 'CLASSIC' | 'QUIZZIZ';
  selectedAreaFilter?: 'Biomédicas' | 'Ingenierías' | 'Sociales' | 'Todas';
}

export interface CourseStructure {
  name: string;
  subjects: string[];
  icon: string;
  color: string;
}
