import React, { useState, useMemo } from 'react';
import { CustomDeck, Question, ReadingText, TopicResult } from '../types';
import { CUSTOM_DECK_COLORS, CUSTOM_DECK_ICONS, ACADEMIC_STRUCTURE } from '../constants';
import { formatQuestionText, parseHTMLTags, getQuestionProcess, getProcessBadgeStyle, getProcessShortName } from '../utils';
import { PrintExamModal } from '../components/PrintExamModal';

interface CustomDecksViewProps {
  decks: CustomDeck[];
  questions: Question[];
  readingTexts?: ReadingText[];
  results?: Record<string, TopicResult>;
  onCreateDeck: (deck: Omit<CustomDeck, 'id' | 'createdAt'>) => void;
  onUpdateDeck: (deck: CustomDeck) => void;
  onDeleteDeck: (deckId: string) => void;
  onPlayDeck: (deck: CustomDeck, mode: 'CLASSIC' | 'QUIZZIZ') => void;
  onAddQuestionToDeck: (deckId: string, question: Omit<Question, 'id' | 'createdAt'>) => void;
  onToggleQuestionInDeck: (deckId: string, questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
  onBackToHome: () => void;
}

export const CustomDecksView: React.FC<CustomDecksViewProps> = ({
  decks = [],
  questions = [],
  readingTexts = [],
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

  // Form State for new deck
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('⭐');
  const [newColor, setNewColor] = useState('purple');

  // Manage Deck Modal Tabs: 'LIST' | 'BANK' | 'CREATE_Q'
  const [manageTab, setManageTab] = useState<'LIST' | 'BANK' | 'CREATE_Q'>('LIST');
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateDeck({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      icon: newIcon,
      color: newColor,
      questionIds: []
    });

    setNewTitle('');
    setNewDesc('');
    setNewIcon('⭐');
    setNewColor('purple');
    setShowCreateModal(false);
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

            return (
              <div
                key={deck.id}
                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-xl active:scale-[0.99] transition-all flex flex-col justify-between group overflow-hidden relative"
              >
                {/* Top strip with deck theme */}
                <div className={`h-2.5 w-full bg-gradient-to-r ${colorCfg.banner} absolute top-0 left-0 right-0`} />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${colorCfg.bg} border ${colorCfg.border}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {deck.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                          <span>{count} {count === 1 ? 'pregunta' : 'preguntas'}</span>
                          {times > 0 && (
                            <span>• {times} {times === 1 ? 'práctica' : 'prácticas'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeckToDelete(deck)}
                      className="p-2 text-gray-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                      title="Eliminar mazo"
                      aria-label="Eliminar mazo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {deck.description && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 leading-relaxed mb-4">
                      {deck.description}
                    </p>
                  )}

                  {deck.bestScore !== undefined && count > 0 && (
                    <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200 dark:border-emerald-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <span>Mejor puntaje: {deck.bestScore}/{count}</span>
                    </div>
                  )}
                </div>

                {/* Deck Action Buttons */}
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
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
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Jugar Practix</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setManagingDeck(deck);
                        setManageTab('LIST');
                      }}
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
            );
          })}
        </div>
      )}

      {/* CREATE DECK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 animate-scale-up space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">Crear Mazo Personalizado</h3>
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
                  className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 text-sm outline-none dark:text-gray-100 font-bold"
                  autoFocus
                />
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
                  className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 text-xs outline-none dark:text-gray-100"
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
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
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
                      className={`p-2.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all ${
                        newColor === col.id
                          ? `${col.bg} ${col.text} ${col.border} ring-2 ring-current shadow-sm`
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${col.banner}`} />
                      <span>{col.name}</span>
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
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md transition-all min-h-[44px]"
                >
                  Crear Mazo
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
                      <option value="">Todos los cursos</option>
                      {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>

                    <select
                      value={bankProcessFilter}
                      onChange={(e) => setBankProcessFilter(e.target.value)}
                      className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none dark:text-gray-200 font-medium"
                    >
                      <option value="">Todos los procesos</option>
                      {allBankProcesses.map(p => <option key={p} value={p}>{p}</option>)}
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
