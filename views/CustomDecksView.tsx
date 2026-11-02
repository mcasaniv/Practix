import React, { useState, useMemo } from 'react';
import { CustomDeck, Question, ReadingText, TopicResult, CourseStructure } from '../types';
import { CUSTOM_DECK_COLORS, CUSTOM_DECK_ICONS, ACADEMIC_STRUCTURE } from '../constants';
import { formatQuestionText, parseHTMLTags, getQuestionProcess, getProcessBadgeStyle, getProcessShortName } from '../utils';
import { compressImageFile } from '../utils/dbStorage';
import { PrintExamModal } from '../components/PrintExamModal';

interface CustomDecksViewProps {
  decks: CustomDeck[];
  questions: Question[];
  readingTexts?: ReadingText[];
  results?: Record<string, TopicResult>;
  academicStructure?: CourseStructure[];
  courseCovers?: Record<string, string>;
  onCreateDeck: (deck: Omit<CustomDeck, 'id' | 'createdAt'>) => void;
  onUpdateDeck: (deck: CustomDeck) => void;
  onDeleteDeck: (deckId: string) => void;
  onPlayDeck: (deck: CustomDeck, mode: 'CLASSIC' | 'QUIZZIZ') => void;
  onAddQuestionToDeck: (deckId: string, question: Omit<Question, 'id' | 'createdAt'>) => void;
  onToggleQuestionInDeck: (deckId: string, questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
  onBackToHome: () => void;
}

const DECK_COVER_PRESETS = [
  { course: 'Matemática', label: 'Fórmulas y Geometría', url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600' },
  { course: 'Comunicación', label: 'Biblioteca y Letras', url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=600' },
  { course: 'Ciencias', label: 'Laboratorio y Física', url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600' },
  { course: 'Sociales', label: 'Historia y Mapas', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600' },
  { course: 'DPCC', label: 'Filosofía y Mente', url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600' },
  { course: 'Razonamiento', label: 'Lógica y Estrategia', url: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600' },
  { course: 'Idioma', label: 'Inglés y Mundo', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600' },
  { course: 'Exámenes', label: 'Simulacros y Claves', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600' },
];

export const CustomDecksView: React.FC<CustomDecksViewProps> = ({
  decks = [],
  questions = [],
  readingTexts = [],
  academicStructure,
  courseCovers = {},
  onCreateDeck,
  onUpdateDeck,
  onDeleteDeck,
  onPlayDeck,
  onAddQuestionToDeck,
  onToggleQuestionInDeck,
  onDeleteQuestion,
  onBackToHome
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingDeck, setManagingDeck] = useState<CustomDeck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<CustomDeck | null>(null);
  const [deckToPrint, setDeckToPrint] = useState<CustomDeck | null>(null);

  const coursesList = useMemo(() => {
    return academicStructure || ACADEMIC_STRUCTURE;
  }, [academicStructure]);

  const getCourseCover = (courseName?: string) => {
    if (!courseName) return '';
    const custom = courseCovers?.[courseName];
    if (custom) return custom;
    const found = coursesList.find(c => c.name === courseName);
    return found?.icon || '';
  };

  // Form State for new deck
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('⭐');
  const [newColor, setNewColor] = useState('purple');
  const [newCourse, setNewCourse] = useState('Matemática');
  const [newCoverUrl, setNewCoverUrl] = useState('');

  // Edit Deck in Manage state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('⭐');
  const [editColor, setEditColor] = useState('purple');
  const [editCourse, setEditCourse] = useState('Matemática');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState(false);

  // Manage Deck Modal Tabs: 'LIST' | 'BANK' | 'CREATE_Q' | 'EDIT_DECK'
  const [manageTab, setManageTab] = useState<'LIST' | 'BANK' | 'CREATE_Q' | 'EDIT_DECK'>('LIST');
  const [searchBank, setSearchBank] = useState('');
  const [bankCourseFilter, setBankCourseFilter] = useState('');
  const [bankProcessFilter, setBankProcessFilter] = useState('');

  // Form State for creating a question inside custom deck (Sin Cepre)
  const [newQText, setNewQText] = useState('');
  const [newQOptions, setNewQOptions] = useState(['', '', '', '', '']);
  const [newQCorrect, setNewQCorrect] = useState(0);
  const [newQExplanation, setNewQExplanation] = useState('');
  const [newQImageUrl, setNewQImageUrl] = useState('');

  const questionsMap = useMemo(() => {
    return new Map<string, Question>(questions.map(q => [q.id, q]));
  }, [questions]);

  // Processes present in questions for bank filter
  const allBankProcesses = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      const p = getQuestionProcess(q);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [questions]);

  const handleCoverFileUpload = async (setter: (url: string) => void, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }
    try {
      const dataUrl = await compressImageFile(file, 800, 500, 0.82);
      if (dataUrl) {
        setter(dataUrl);
      }
    } catch (err) {
      console.warn('Could not compress deck cover image:', err);
    }
    e.target.value = '';
  };

  const openManagingDeck = (deck: CustomDeck) => {
    setManagingDeck(deck);
    setEditTitle(deck.title || '');
    setEditDesc(deck.description || '');
    setEditIcon(deck.icon || '⭐');
    setEditColor(deck.color || 'purple');
    setEditCourse(deck.course || 'Matemática');
    setEditCoverUrl(deck.coverUrl || '');
    setManageTab('LIST');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const finalCover = newCoverUrl.trim() || getCourseCover(newCourse);

    onCreateDeck({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      icon: newIcon,
      color: newColor,
      course: newCourse,
      coverUrl: finalCover || undefined,
      questionIds: []
    });

    setNewTitle('');
    setNewDesc('');
    setNewIcon('⭐');
    setNewColor('purple');
    setNewCoverUrl('');
    setShowCreateModal(false);
  };

  const handleUpdateDeckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingDeck || !editTitle.trim()) return;

    const updated: CustomDeck = {
      ...managingDeck,
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      icon: editIcon,
      color: editColor,
      course: editCourse,
      coverUrl: editCoverUrl.trim() || getCourseCover(editCourse) || undefined,
      updatedAt: Date.now()
    };

    onUpdateDeck(updated);
    setManagingDeck(updated);
    setEditSuccessMsg(true);
    setTimeout(() => setEditSuccessMsg(false), 3000);
  };

  const handleCreateQuestionInDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingDeck || !newQText.trim()) return;

    const filteredOptions = newQOptions.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      alert("Por favor ingresa al menos 2 alternativas.");
      return;
    }

    onAddQuestionToDeck(managingDeck.id, {
      course: 'Personalizado',
      subject: 'Mazo Propio',
      topic: managingDeck.title,
      process: 'Mazo Propio (Sin Cepre)',
      questionText: newQText.trim(),
      options: filteredOptions,
      correctIndex: Math.min(newQCorrect, filteredOptions.length - 1),
      explanation: newQExplanation.trim(),
      imageUrl: newQImageUrl.trim() || undefined,
      order: 1
    });

    // Reset Q form
    setNewQText('');
    setNewQOptions(['', '', '', '', '']);
    setNewQCorrect(0);
    setNewQExplanation('');
    setNewQImageUrl('');
    setManageTab('LIST');
  };

  // Filtered bank questions for the picker
  const filteredBankQuestions = useMemo(() => {
    if (!managingDeck) return [];
    const searchLower = searchBank.toLowerCase().trim();

    return questions.filter(q => {
      const matchCourse = !bankCourseFilter || q.course === bankCourseFilter;
      const matchProcess = !bankProcessFilter || getQuestionProcess(q) === bankProcessFilter;
      const matchText = !searchLower || 
        q.questionText.toLowerCase().includes(searchLower) ||
        q.topic.toLowerCase().includes(searchLower) ||
        q.subject.toLowerCase().includes(searchLower);

      return matchCourse && matchProcess && matchText;
    });
  }, [questions, managingDeck, searchBank, bankCourseFilter, bankProcessFilter]);

  // Questions of current managing deck
  const currentDeckQuestions = useMemo(() => {
    if (!managingDeck) return [];
    return managingDeck.questionIds
      .map(id => questionsMap.get(id))
      .filter((q): q is Question => q !== undefined);
  }, [managingDeck, questionsMap]);

  const getColorClasses = (colorId?: string) => {
    const c = CUSTOM_DECK_COLORS.find(item => item.id === colorId) || CUSTOM_DECK_COLORS[1];
    return c;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-black uppercase tracking-wider text-purple-100 border border-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Sin ataduras a ningún CEPRE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Mis Mazos de Preguntas
            </h1>
            <p className="text-purple-100/90 text-xs sm:text-sm leading-relaxed">
              Crea tus propios bancos de preguntas independientes: agrupa preguntas de tus temas favoritos, fórmulas clave o tus propios apuntes sin necesidad de categorizarlos bajo una universidad o CEPRE.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-purple-700 hover:bg-purple-50 active:scale-95 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Crear Nuevo Mazo</span>
            </button>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute -right-8 -bottom-8 text-white opacity-10 pointer-events-none select-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-40 h-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>

      {/* Decks Grid or Empty State */}
      {decks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-gray-100">
            Aún no tienes mazos personalizados
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-md mx-auto">
            Puedes crear un mazo para repasar preguntas seleccionadas de cualquier proceso anterior (ej. 2026, 2025, 2017) o redactar tus propias preguntas de estudio.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-md transition-all flex items-center gap-2 mx-auto min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Crear mi Primer Mazo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {decks.map(deck => {
            const colorCfg = getColorClasses(deck.color);
            const count = deck.questionIds?.length || 0;
            const times = deck.timesPracticed || 0;
            const coverToDisplay = deck.coverUrl || getCourseCover(deck.course);

            return (
              <div
                key={deck.id}
                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-xl active:scale-[0.99] transition-all flex flex-col justify-between group overflow-hidden relative"
              >
                {/* Deck Cover Banner */}
                {coverToDisplay ? (
                  <div className="h-32 w-full relative overflow-hidden bg-slate-800 shrink-0">
                    <img
                      src={coverToDisplay}
                      alt={deck.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />
                    
                    {/* Course tag on cover */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                      <span>{deck.course || 'Mazo Propio'}</span>
                    </div>

                    {/* Deck Icon on cover */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-white/30 text-white flex items-center justify-center text-sm shadow">
                        {deck.icon || '⭐'}
                      </div>
                      <button
                        onClick={() => setDeckToDelete(deck)}
                        className="w-8 h-8 rounded-xl bg-black/60 hover:bg-rose-600 text-white/80 hover:text-white backdrop-blur-md transition-colors flex items-center justify-center"
                        title="Eliminar mazo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Title & Count Overlay on bottom of cover */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
                      <h3 className="text-base font-black text-white truncate drop-shadow">
                        {deck.title}
                      </h3>
                      <span className="text-[10px] font-bold text-white/90 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full shrink-0">
                        {count} {count === 1 ? 'preg.' : 'preg.'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`h-20 w-full bg-gradient-to-r ${colorCfg.banner} relative p-3 flex items-start justify-between shrink-0`}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                      <span>{deck.course || 'Mazo Propio'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center text-sm shadow">
                        {deck.icon || '⭐'}
                      </div>
                      <button
                        onClick={() => setDeckToDelete(deck)}
                        className="w-7 h-7 rounded-lg bg-black/40 hover:bg-rose-600 text-white transition-colors flex items-center justify-center"
                        title="Eliminar mazo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {!coverToDisplay && (
                      <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 truncate mb-1">
                        {deck.title}
                      </h3>
                    )}
                    {deck.description && (
                      <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 leading-relaxed mb-3">
                        {deck.description}
                      </p>
                    )}
                    {deck.bestScore !== undefined && count > 0 && (
                      <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200 dark:border-emerald-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span>Mejor puntaje: {deck.bestScore}/{count}</span>
                      </div>
                    )}
                  </div>

                  {/* Deck Action Buttons */}
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={count === 0}
                        onClick={() => onPlayDeck(deck, 'CLASSIC')}
                        className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 border border-gray-200/80 dark:border-slate-700 text-xs font-bold transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Clásico</span>
                      </button>

                      <button
                        disabled={count === 0}
                        onClick={() => onPlayDeck(deck, 'QUIZZIZ')}
                        className={`py-2.5 px-3 rounded-xl text-white font-black text-xs transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 min-h-[44px] bg-gradient-to-r ${colorCfg.banner}`}
                      >
                        <span className="text-sm">🎮</span>
                        <span>Jugar Practix</span>
                        <span className="text-xs">⚡</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openManagingDeck(deck)}
                        className="flex-1 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[40px] border border-purple-200 dark:border-purple-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Gestionar ({count})</span>
                      </button>

                      {count > 0 && (
                        <button
                          onClick={() => setDeckToPrint(deck)}
                          className="py-2 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-600 dark:text-gray-300 font-bold text-xs transition-all flex items-center justify-center gap-1 min-h-[40px] border border-gray-200 dark:border-slate-700"
                          title="Imprimir mazo"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE DECK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-slate-800 animate-scale-up space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">Crear Mazo Personalizado</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Escoge el curso y la portada para guardar tu mazo</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1.5">
                  Nombre del Mazo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fórmulas de Física, Preguntas Trampa..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none dark:text-gray-100 font-bold focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              {/* CURSO DONDE GUARDAR */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1.5">
                  Guardar en el Curso:
                </label>
                <select
                  value={newCourse}
                  onChange={(e) => {
                    const c = e.target.value;
                    setNewCourse(c);
                    // Automatically offer course cover if user hasn't explicitly set a custom one
                    if (!newCoverUrl) {
                      setNewCoverUrl(getCourseCover(c));
                    }
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  {coursesList.map(c => (
                    <option key={c.name} value={c.name} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">{c.name} ({c.subjects.slice(0, 2).join(', ')})</option>
                  ))}
                  <option value="General / Multi-materia" className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">General / Multi-materia</option>
                </select>
              </div>

              {/* PORTADA DEL MAZO */}
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-wider">
                    Portada del Mazo
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewCoverUrl(getCourseCover(newCourse))}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Usar portada del curso
                  </button>
                </div>

                {/* Live Preview of Cover Banner */}
                <div className="h-28 w-full rounded-xl overflow-hidden relative border border-gray-200 dark:border-slate-700 bg-slate-900 shadow-inner group">
                  <img
                    src={newCoverUrl || getCourseCover(newCourse)}
                    alt="Portada preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider">
                    {newCourse}
                  </div>
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center text-xs">
                    {newIcon}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 text-white font-black text-xs truncate">
                    {newTitle.trim() || 'Título de tu mazo'}
                  </div>
                </div>

                {/* Input URL and File upload */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newCoverUrl}
                    onChange={(e) => setNewCoverUrl(e.target.value)}
                    placeholder="URL de imagen (https://...)"
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1 shrink-0 border border-indigo-200 dark:border-indigo-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Subir foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleCoverFileUpload(setNewCoverUrl, e)}
                    />
                  </label>
                </div>

                {/* Presets Gallery */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-1">
                    Portadas sugeridas para este curso:
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {DECK_COVER_PRESETS.map((pre, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewCoverUrl(pre.url)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                          newCoverUrl === pre.url
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pre.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1.5">
                  Descripción (opcional)
                </label>
                <textarea
                  placeholder="Breve nota o propósito de este mazo..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none dark:text-gray-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1.5">
                  Elige un Ícono
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_DECK_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewIcon(icon)}
                      className={`w-9 h-9 rounded-xl text-base flex items-center justify-center transition-all ${
                        newIcon === icon
                          ? 'bg-purple-600 text-white scale-110 shadow-md ring-2 ring-purple-400'
                          : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1.5">
                  Color del Mazo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CUSTOM_DECK_COLORS.map(col => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setNewColor(col.id)}
                      className={`p-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all ${
                        newColor === col.id
                          ? `${col.bg} ${col.text} ${col.border} ring-2 ring-current shadow-sm`
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${col.banner}`} />
                      <span className="truncate">{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-md transition-all min-h-[44px]"
                >
                  Guardar Mazo en {newCourse}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE DECK MODAL (View Questions, Add from Bank, Create Custom Question) */}
      {managingDeck && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-gray-100 dark:border-slate-800 animate-scale-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{managingDeck.icon || '⭐'}</span>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100 truncate max-w-[240px] sm:max-w-md">
                    {managingDeck.title}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {managingDeck.questionIds.length} {managingDeck.questionIds.length === 1 ? 'pregunta en este mazo' : 'preguntas en este mazo'} • Sin categoría de Cepre
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingDeck(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cerrar modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl my-4 text-xs font-black shrink-0">
              <button
                onClick={() => setManageTab('LIST')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  manageTab === 'LIST'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Preguntas del Mazo ({managingDeck.questionIds.length})</span>
              </button>
              <button
                onClick={() => setManageTab('BANK')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  manageTab === 'BANK'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Elegir del Banco</span>
              </button>
              <button
                onClick={() => setManageTab('CREATE_Q')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  manageTab === 'CREATE_Q'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Crear Pregunta Propia</span>
              </button>
            </div>

            {/* Content per Tab */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* TAB 1: LIST QUESTIONS IN DECK */}
              {manageTab === 'LIST' && (
                <div>
                  {currentDeckQuestions.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-gray-500">Este mazo no tiene preguntas aún.</p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => setManageTab('BANK')}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm"
                        >
                          Elegir del Banco
                        </button>
                        <button
                          onClick={() => setManageTab('CREATE_Q')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black shadow-sm"
                        >
                          Crear Pregunta
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentDeckQuestions.map((q, idx) => {
                        const procStyle = getProcessBadgeStyle(q.process);
                        return (
                          <div
                            key={q.id}
                            className="bg-gray-50 dark:bg-slate-800/80 p-3.5 sm:p-4 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-start justify-between gap-3 group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-xs shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 space-y-1">
                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                                  {formatQuestionText(q.questionText)}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                                  <span className="font-semibold text-gray-600 dark:text-gray-300">{q.subject}</span>
                                  <span>•</span>
                                  <span>{q.topic}</span>
                                  {q.process && (
                                    <span className={`px-1.5 py-0.5 rounded font-black ${procStyle.bg} ${procStyle.text}`}>
                                      {getProcessShortName(q.process)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                onToggleQuestionInDeck(managingDeck.id, q.id);
                                setManagingDeck({
                                  ...managingDeck,
                                  questionIds: managingDeck.questionIds.filter(id => id !== q.id)
                                });
                              }}
                              className="text-rose-500 hover:bg-rose-100/50 dark:hover:bg-rose-900/40 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1"
                              title="Quitar del mazo"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Quitar</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SELECT FROM BANK */}
              {manageTab === 'BANK' && (
                <div className="space-y-3">
                  {/* Filters for bank */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por texto o tema..."
                      value={searchBank}
                      onChange={(e) => setSearchBank(e.target.value)}
                      className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none dark:text-gray-200 font-medium"
                    />

                    <select
                      value={bankCourseFilter}
                      onChange={(e) => setBankCourseFilter(e.target.value)}
                      className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none dark:text-gray-200 font-medium"
                    >
                      <option value="" className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">Todos los cursos</option>
                      {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">{c.name}</option>)}
                    </select>

                    <select
                      value={bankProcessFilter}
                      onChange={(e) => setBankProcessFilter(e.target.value)}
                      className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none dark:text-gray-200 font-medium"
                    >
                      <option value="" className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">Todos los procesos</option>
                      {allBankProcesses.map(p => <option key={p} value={p} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">{p}</option>)}
                    </select>
                  </div>

                  <div className="text-[11px] text-gray-400 font-bold flex items-center justify-between">
                    <span>{filteredBankQuestions.length} preguntas encontradas</span>
                    <span>Toca (+) para agregar al mazo</span>
                  </div>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredBankQuestions.slice(0, 50).map(q => {
                      const isIncluded = managingDeck.questionIds.includes(q.id);
                      const procStyle = getProcessBadgeStyle(q.process);

                      return (
                        <div
                          key={q.id}
                          className={`p-3 rounded-2xl border text-xs flex items-start justify-between gap-3 transition-all ${
                            isIncluded
                              ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                              : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                              {formatQuestionText(q.questionText)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                              <span className="font-semibold text-gray-600 dark:text-gray-300">{q.subject}</span>
                              <span>•</span>
                              <span>{q.topic}</span>
                              {q.process && (
                                <span className={`px-1.5 py-0.5 rounded font-black ${procStyle.bg} ${procStyle.text}`}>
                                  {getProcessShortName(q.process)}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              onToggleQuestionInDeck(managingDeck.id, q.id);
                              if (isIncluded) {
                                setManagingDeck({
                                  ...managingDeck,
                                  questionIds: managingDeck.questionIds.filter(id => id !== q.id)
                                });
                              } else {
                                setManagingDeck({
                                  ...managingDeck,
                                  questionIds: [...managingDeck.questionIds, q.id]
                                });
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs shrink-0 transition-all flex items-center gap-1 ${
                              isIncluded
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {isIncluded ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>En mazo</span>
                              </>
                            ) : (
                              <span>+ Agregar</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: CREATE NEW QUESTION DIRECTLY FOR THIS DECK */}
              {manageTab === 'CREATE_Q' && (
                <form onSubmit={handleCreateQuestionInDeck} className="space-y-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Esta pregunta se creará exclusivamente para este mazo y quedará marcada como "Mazo Propio (Sin Cepre)".</span>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1">
                      Enunciado de la Pregunta *
                    </label>
                    <textarea
                      required
                      placeholder="Redacta la pregunta (soporta fórmulas LaTeX como $x^2$)..."
                      value={newQText}
                      onChange={(e) => setNewQText(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 text-xs outline-none dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1">
                      URL de Imagen Opcional (se mostrará debajo del texto)
                    </label>
                    <input
                      type="url"
                      placeholder="https://i.imgur.com/..."
                      value={newQImageUrl}
                      onChange={(e) => setNewQImageUrl(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none dark:text-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1">
                      Alternativas (marca la correcta) *
                    </label>
                    {newQOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="newQCorrectRadio"
                          checked={newQCorrect === idx}
                          onChange={() => setNewQCorrect(idx)}
                          className="w-4 h-4 text-purple-600 accent-purple-600 cursor-pointer"
                        />
                        <span className="w-5 text-xs font-black text-gray-400">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <input
                          type="text"
                          placeholder={`Alternativa ${String.fromCharCode(65 + idx)}`}
                          value={opt}
                          onChange={(e) => {
                            const copy = [...newQOptions];
                            copy[idx] = e.target.value;
                            setNewQOptions(copy);
                          }}
                          className="flex-1 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none dark:text-gray-100"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-1">
                      Solución o Explicación (opcional)
                    </label>
                    <textarea
                      placeholder="Explicación detallada de la respuesta correcta..."
                      value={newQExplanation}
                      onChange={(e) => setNewQExplanation(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none dark:text-gray-100"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
                    >
                      Guardar y Añadir al Mazo
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-400 font-bold">
                {managingDeck.questionIds.length} preguntas en el mazo
              </span>
              <button
                onClick={() => setManagingDeck(null)}
                className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deckToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">
              ¿Eliminar mazo "{deckToDelete.title}"?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Esta acción eliminará el mazo de tu lista. Las preguntas originales no se borrarán.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeckToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteDeck(deckToDelete.id);
                  setDeckToDelete(null);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-md"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT DECK MODAL */}
      {deckToPrint && (
        <PrintExamModal
          exam={{
            id: deckToPrint.id,
            title: `Mazo: ${deckToPrint.title}`,
            course: 'Personalizado',
            subject: 'Mazo Propio',
            area: 'General',
            mode: 'CUSTOM',
            questionIds: deckToPrint.questionIds,
            totalQuestions: deckToPrint.questionIds.length,
            createdAt: deckToPrint.createdAt
          }}
          allQuestions={questions}
          readingTexts={readingTexts}
          onClose={() => setDeckToPrint(null)}
        />
      )}
    </div>
  );
};
