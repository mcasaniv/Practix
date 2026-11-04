import React, { useState, useMemo, useEffect } from 'react';
import { Question, ReadingText, TopicResult, SavedExam } from '../types';
import { getQuestionProcess, getQuestionWeek, getProcessBadgeStyle, getProcessShortName, getAvailableProcesses, getQuestionArea, getQuestionAreas, matchesQuestionArea, getAreaBadgeStyle } from '../utils';
import { PrintExamModal } from '../components/PrintExamModal';
import { UploadExamQuestionsModal } from '../components/UploadExamQuestionsModal';

interface TopicsViewProps {
  subjectName: string;
  courseName?: string;
  questions: Question[];
  allDatabaseQuestions?: Question[];
  readingTexts?: ReadingText[];
  results: Record<string, TopicResult>;
  savedExams?: SavedExam[];
  onSelectTopic: (topic: string, mode?: 'CLASSIC' | 'QUIZZIZ', process?: string, areaFilter?: 'Biomédicas' | 'Ingenierías' | 'Sociales' | 'Todas') => void;
  onStartMixedQuiz: (questions: Question[], mode?: 'CLASSIC' | 'QUIZZIZ', customTitle?: string) => void;
  onStartMistakesQuiz?: (questions: Question[], mode?: 'CLASSIC' | 'QUIZZIZ') => void;
  incorrectQuestionIds?: string[];
  onClearSubjectMistakes?: (subjectName: string) => void;
  onAddSampleMistakes?: (questionIds: string[]) => void;
  onDeleteTopic: (topic: string) => void;
  onMoveTopic: (topic: string, direction: 'UP' | 'DOWN') => void;
  onRetakeExam?: (exam: SavedExam) => void;
  onViewExamResolution?: (exam: SavedExam) => void;
  onDeleteSavedExam?: (examId: string) => void;
  onStartNewExam?: () => void;
  onSaveQuestions?: (questions: Question[]) => void;
  selectedArea?: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onToast?: (msg: string) => void;
  initialProcess?: string;
  onSelectProcessChange?: (process: string) => void;
}

const TopicsView: React.FC<TopicsViewProps> = ({ 
  subjectName, 
  courseName, 
  questions, 
  allDatabaseQuestions = [],
  readingTexts = [],
  results, 
  savedExams = [],
  incorrectQuestionIds = [],
  onSelectTopic, 
  onStartMixedQuiz,
  onStartMistakesQuiz,
  onClearSubjectMistakes,
  onAddSampleMistakes,
  onDeleteTopic,
  onMoveTopic,
  onRetakeExam,
  onViewExamResolution,
  onDeleteSavedExam,
  onStartNewExam,
  onSaveQuestions,
  selectedArea,
  onToast,
  initialProcess,
  onSelectProcessChange
}) => {
  // Función para recuperar el proceso de admisión recordado para esta materia o en toda la app
  const getStoredProcess = (): string => {
    if (initialProcess !== undefined && initialProcess !== '') return initialProcess;
    if (typeof window === 'undefined') return '';
    try {
      // 1. Preferencia guardada específicamente para esta materia
      const subjectKey = `practix_process_${subjectName}`;
      const savedForSubject = localStorage.getItem(subjectKey);
      if (savedForSubject === '__TODOS__') return '';
      if (savedForSubject) return savedForSubject;

      // 2. Último proceso seleccionado globalmente en la app
      const globalProcess = localStorage.getItem('practix_selected_process') || localStorage.getItem('practix_last_selected_process');
      if (globalProcess && globalProcess !== '__TODOS__') return globalProcess;
    } catch {
      // ignore
    }
    return '';
  };

  const [selectedProcess, setSelectedProcessState] = useState<string>(() => getStoredProcess());

  const handleSelectProcess = (proc: string) => {
    setSelectedProcessState(proc);
    if (typeof window !== 'undefined') {
      try {
        if (proc) {
          localStorage.setItem(`practix_process_${subjectName}`, proc);
          localStorage.setItem('practix_selected_process', proc);
          localStorage.setItem('practix_last_selected_process', proc);
        } else {
          localStorage.setItem(`practix_process_${subjectName}`, '__TODOS__');
          localStorage.setItem('practix_selected_process', '');
          localStorage.setItem('practix_last_selected_process', '');
        }
      } catch {
        // ignore
      }
    }
    if (onSelectProcessChange) {
      onSelectProcessChange(proc);
    }
    if (onToast && proc) {
      onToast(`Proceso guardado: ${getProcessShortName(proc)}`);
    }
  };

  // Recordar el proceso cada vez que se navega o cambia de materia
  useEffect(() => {
    const stored = getStoredProcess();
    setSelectedProcessState(stored);
    if (onSelectProcessChange && stored) {
      onSelectProcessChange(stored);
    }
  }, [subjectName, initialProcess]);

  const [activeAreaFilter, setActiveAreaFilter] = useState<'Biomédicas' | 'Ingenierías' | 'Sociales' | 'Todas'>(selectedArea || 'Biomédicas');
  const [mixedCount, setMixedCount] = useState<number>(Math.min(10, questions.length));
  
  // Modo de distribución del examen mixto: 'PER_TOPIC' (1 o más por tema), 'PER_WEEK' (1 o más por semana), o 'TOTAL' (aleatorio general)
  const [mixedDistMode, setMixedDistMode] = useState<'PER_TOPIC' | 'PER_WEEK' | 'TOTAL'>(() => {
    try {
      const saved = localStorage.getItem('practix_mixed_dist_mode');
      if (saved === 'PER_TOPIC' || saved === 'PER_WEEK' || saved === 'TOTAL') return saved;
    } catch {}
    return 'PER_TOPIC';
  });

  const [perTopicCount, setPerTopicCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('practix_mixed_per_topic');
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 1) return n;
      }
    } catch {}
    return 1;
  });

  const [perWeekCount, setPerWeekCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('practix_mixed_per_week');
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 1) return n;
      }
    } catch {}
    return 1;
  });

  const handleSelectDistMode = (mode: 'PER_TOPIC' | 'PER_WEEK' | 'TOTAL') => {
    setMixedDistMode(mode);
    try {
      localStorage.setItem('practix_mixed_dist_mode', mode);
    } catch {}
  };

  const handleUpdatePerTopicCount = (count: number) => {
    const val = Math.max(1, count);
    setPerTopicCount(val);
    try {
      localStorage.setItem('practix_mixed_per_topic', val.toString());
    } catch {}
  };

  const handleUpdatePerWeekCount = (count: number) => {
    const val = Math.max(1, count);
    setPerWeekCount(val);
    try {
      localStorage.setItem('practix_mixed_per_week', val.toString());
    } catch {}
  };

  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToPrint, setExamToPrint] = useState<SavedExam | null>(null);
  const [groupByWeeks, setGroupByWeeks] = useState<boolean>(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalInitialTopic, setUploadModalInitialTopic] = useState('');
  
  // Estado para desplegar u ocultar de manera discreta los filtros, banco de errores y examen mixto
  const [isToolsExpanded, setIsToolsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('practix_subject_tools_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const toggleToolsExpanded = () => {
    setIsToolsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('practix_subject_tools_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Sincronizar filtro cuando cambia el área del usuario
  useEffect(() => {
    if (selectedArea) {
      setActiveAreaFilter(selectedArea);
    }
  }, [selectedArea]);

  // Lista dinámica de procesos presentes en esta materia o disponibles
  const availableProcesses = useMemo(() => {
    return getAvailableProcesses(questions);
  }, [questions]);

  // Proceso activo efectivo: si el recordado no existe entre las opciones de esta materia, no filtramos a cero
  const effectiveProcess = useMemo(() => {
    if (!selectedProcess) return '';
    if (availableProcesses.length > 0 && !availableProcesses.includes(selectedProcess)) {
      return '';
    }
    return selectedProcess;
  }, [selectedProcess, availableProcesses]);

  // Conteo de preguntas en esta materia por cada proceso de admisión
  const processStats = useMemo(() => {
    const stats: Record<string, number> = {};
    availableProcesses.forEach(p => {
      stats[p] = 0;
    });
    questions.forEach(q => {
      const p = getQuestionProcess(q);
      stats[p] = (stats[p] || 0) + 1;
    });
    return stats;
  }, [questions, availableProcesses]);

  // Conteo de preguntas en esta materia por cada área académica
  const areaStats = useMemo(() => {
    const stats: Record<string, number> = {
      'Biomédicas': 0,
      'Ingenierías': 0,
      'Sociales': 0,
      'Todas': 0
    };
    questions.forEach(q => {
      const qAreas = getQuestionAreas(q);
      qAreas.forEach(a => {
        if (stats[a] !== undefined) stats[a]++;
      });
      if (q.area === 'Todas' || (Array.isArray(q.areas) && q.areas.length >= 3)) {
        stats['Todas']++;
      }
    });
    return stats;
  }, [questions]);

  // Preguntas filtradas según el proceso de admisión Y el área de postulación seleccionada
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (effectiveProcess && getQuestionProcess(q) !== effectiveProcess) return false;
      if (!matchesQuestionArea(q, activeAreaFilter)) return false;
      return true;
    });
  }, [questions, effectiveProcess, activeAreaFilter]);

  // Preguntas en las que el usuario se ha equivocado dentro de esta materia
  const mistakeQuestions = useMemo(() => {
    const incorrectSet = new Set(incorrectQuestionIds || []);
    // Also include any questions missed in savedExams for this subject
    if (savedExams && savedExams.length > 0) {
      savedExams.forEach(exam => {
        if (exam.userAnswers) {
          Object.entries(exam.userAnswers).forEach(([qId, ans]) => {
            const q = questions.find(item => item.id === qId) || allDatabaseQuestions.find(item => item.id === qId);
            if (q && (q.subject === subjectName || q.targetSubject === subjectName) && ans !== q.correctIndex) {
              incorrectSet.add(qId);
            }
          });
        }
      });
    }

    // Pool of questions for this subject
    const pool = (allDatabaseQuestions && allDatabaseQuestions.length > 0)
      ? allDatabaseQuestions.filter(q => q.subject === subjectName || q.targetSubject === subjectName)
      : questions;

    return pool.filter(q => incorrectSet.has(q.id));
  }, [incorrectQuestionIds, savedExams, questions, allDatabaseQuestions, subjectName]);

  const [mistakesCountLimit, setMistakesCountLimit] = useState<number>(() => Math.max(1, mistakeQuestions.length));

  useEffect(() => {
    if (mistakeQuestions.length > 0) {
      setMistakesCountLimit(mistakeQuestions.length);
    }
  }, [mistakeQuestions.length]);

  const handleStartMistakes = (mode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    if (mistakeQuestions.length === 0) return;
    const count = mistakesCountLimit > 0 ? Math.min(mistakesCountLimit, mistakeQuestions.length) : mistakeQuestions.length;
    const shuffled = [...mistakeQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    if (onStartMistakesQuiz) {
      onStartMistakesQuiz(selected, mode);
    } else {
      onStartMixedQuiz(selected, mode);
    }
  };

  const handleClearMistakes = () => {
    if (window.confirm(`¿Deseas limpiar el registro de errores para ${subjectName}? Las preguntas volverán a considerarse aprobadas.`)) {
      if (onClearSubjectMistakes) {
        onClearSubjectMistakes(subjectName);
      }
    }
  };

  const handleAddSampleMistake = () => {
    if (questions.length === 0) return;
    const sampleIds = questions.slice(0, 3).map(q => q.id);
    if (onAddSampleMistakes) {
      onAddSampleMistakes(sampleIds);
    }
  };

  const topics = useMemo(() => {
    const grouped = filteredQuestions.reduce((acc, q) => {
      const proc = getQuestionProcess(q);
      const qAreas = getQuestionAreas(q);
      if (!acc[q.topic]) {
        acc[q.topic] = {
          name: q.topic,
          count: 0,
          order: q.order ?? 999,
          week: q.week,
          processes: new Set<string>(),
          areas: new Set<string>()
        };
      }
      acc[q.topic].count++;
      acc[q.topic].processes.add(proc);
      qAreas.forEach(a => acc[q.topic].areas.add(a));
      if (q.week !== undefined && acc[q.topic].week === undefined) {
        acc[q.topic].week = q.week;
      }
      return acc;
    }, {} as Record<string, { name: string; count: number; order: number; week?: number; processes: Set<string>; areas: Set<string> }>);

    return (Object.values(grouped) as { name: string; count: number; order: number; week?: number; processes: Set<string>; areas: Set<string> }[])
      .map(t => ({
        ...t,
        processesList: Array.from(t.processes),
        areasList: Array.from(t.areas)
      }))
      .sort((a, b) => a.order - b.order);
  }, [filteredQuestions]);

  const topicsByWeek = useMemo(() => {
    const weeksMap: Record<string, typeof topics> = {};
    
    topics.forEach(t => {
      const wKey = t.week !== undefined && t.week !== null ? `Semana ${t.week}` : 'Sin Semana';
      if (!weeksMap[wKey]) {
        weeksMap[wKey] = [];
      }
      weeksMap[wKey].push(t);
    });

    return Object.entries(weeksMap).sort(([keyA], [keyB]) => {
      if (keyA === 'Sin Semana') return 1;
      if (keyB === 'Sin Semana') return -1;
      const numA = parseInt(keyA.replace('Semana ', '')) || 0;
      const numB = parseInt(keyB.replace('Semana ', '')) || 0;
      return numA - numB;
    });
  }, [topics]);

  // Semanas disponibles en esta materia
  const availableWeeks = useMemo(() => {
    const weeksSet = new Set<number>();
    filteredQuestions.forEach(q => {
      const w = getQuestionWeek(q) ?? (topics.find(t => t.name === q.topic)?.week);
      if (typeof w === 'number' && !isNaN(w) && w > 0) {
        weeksSet.add(w);
      }
    });
    return Array.from(weeksSet).sort((a, b) => a - b);
  }, [filteredQuestions, topics]);

  // Preguntas que se seleccionarán para el examen mixto según el modo activo
  const calculatedMixedQuestions = useMemo(() => {
    if (filteredQuestions.length === 0) return [];

    if (mixedDistMode === 'TOTAL') {
      const count = Math.min(Math.max(1, mixedCount), filteredQuestions.length);
      return filteredQuestions.slice(0, count);
    }

    if (mixedDistMode === 'PER_TOPIC') {
      const result: Question[] = [];
      topics.forEach(t => {
        const topicQuestions = filteredQuestions.filter(q => q.topic === t.name);
        if (topicQuestions.length > 0) {
          const toTake = Math.min(perTopicCount, topicQuestions.length);
          result.push(...topicQuestions.slice(0, toTake));
        }
      });
      return result;
    }

    if (mixedDistMode === 'PER_WEEK') {
      const result: Question[] = [];
      const weekGroups = new Map<string, Question[]>();
      filteredQuestions.forEach(q => {
        const w = getQuestionWeek(q) ?? (topics.find(t => t.name === q.topic)?.week);
        const key = w !== undefined && w !== null ? `Semana ${w}` : 'Sin Semana';
        if (!weekGroups.has(key)) weekGroups.set(key, []);
        weekGroups.get(key)!.push(q);
      });

      const sortedEntries = Array.from(weekGroups.entries()).sort(([a], [b]) => {
        if (a === 'Sin Semana') return 1;
        if (b === 'Sin Semana') return -1;
        const numA = parseInt(a.replace('Semana ', ''), 10) || 0;
        const numB = parseInt(b.replace('Semana ', ''), 10) || 0;
        return numA - numB;
      });

      sortedEntries.forEach(([, qList]) => {
        if (qList.length > 0) {
          const toTake = Math.min(perWeekCount, qList.length);
          result.push(...qList.slice(0, toTake));
        }
      });
      return result;
    }

    return [];
  }, [filteredQuestions, mixedDistMode, mixedCount, perTopicCount, perWeekCount, topics]);

  const handleStartMixed = (mode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    if (filteredQuestions.length === 0) {
      if (onToast) onToast('No hay preguntas disponibles con los filtros actuales.');
      return;
    }

    let selected: Question[] = [];
    let customTitle = `Examen Mixto`;

    if (mixedDistMode === 'TOTAL') {
      const count = Math.min(Math.max(1, mixedCount), filteredQuestions.length);
      const shuffled = [...filteredQuestions].sort(() => 0.5 - Math.random());
      selected = shuffled.slice(0, count);
      customTitle = `Examen Mixto (${selected.length} preguntas)`;
    } else if (mixedDistMode === 'PER_TOPIC') {
      const collected: Question[] = [];
      topics.forEach(t => {
        const topicQuestions = filteredQuestions.filter(q => q.topic === t.name);
        if (topicQuestions.length > 0) {
          const shuffled = [...topicQuestions].sort(() => 0.5 - Math.random());
          const toTake = Math.min(perTopicCount, shuffled.length);
          collected.push(...shuffled.slice(0, toTake));
        }
      });
      selected = collected.sort(() => 0.5 - Math.random());
      customTitle = `Examen Mixto (${perTopicCount} ${perTopicCount === 1 ? 'pregunta' : 'preguntas'} por tema)`;
    } else if (mixedDistMode === 'PER_WEEK') {
      const collected: Question[] = [];
      const weekGroups = new Map<string, Question[]>();
      filteredQuestions.forEach(q => {
        const w = getQuestionWeek(q) ?? (topics.find(t => t.name === q.topic)?.week);
        const key = w !== undefined && w !== null ? `Semana ${w}` : 'Sin Semana';
        if (!weekGroups.has(key)) weekGroups.set(key, []);
        weekGroups.get(key)!.push(q);
      });

      weekGroups.forEach((qList) => {
        if (qList.length > 0) {
          const shuffled = [...qList].sort(() => 0.5 - Math.random());
          const toTake = Math.min(perWeekCount, shuffled.length);
          collected.push(...qList.slice(0, toTake));
        }
      });
      selected = collected.sort(() => 0.5 - Math.random());
      customTitle = `Examen Mixto (${perWeekCount} ${perWeekCount === 1 ? 'pregunta' : 'preguntas'} por semana)`;
    }

    if (selected.length === 0) {
      if (onToast) onToast('No se encontraron preguntas para este modo de distribución.');
      return;
    }

    onStartMixedQuiz(selected, mode, customTitle);
  };

  const getTopicColorClasses = (topicName: string, globalIndex?: number) => {
    const result = results[`${subjectName}|${topicName}`];
    const timesPracticed = result?.timesPracticed ?? (result && result.total > 0 ? 1 : 0);
    const isPracticed = timesPracticed > 0 && result && result.total > 0;

    let darkBg = "dark:bg-slate-900";
    if (globalIndex === 0) {
      darkBg = "dark:bg-[#001228]";
    } else if (globalIndex === 2) {
      darkBg = "dark:bg-[#000307]";
    }

    // Color estándar consistente con el resto de componentes
    if (!isPracticed) {
      return `bg-white ${darkBg} border-gray-200 dark:border-slate-800 text-gray-800 dark:text-white hover:border-indigo-300 dark:hover:border-slate-700`;
    }

    const { score, total } = result;

    // Verde: Puntaje perfecto
    if (score === total) {
      return `bg-white ${darkBg} border-emerald-300 dark:border-emerald-700/80 shadow-sm text-gray-800 dark:text-white hover:border-emerald-400`;
    }
    // Rojo: Inferior al 50% de aciertos
    if (score < total / 2) {
      return `bg-white ${darkBg} border-rose-300 dark:border-rose-700/80 shadow-sm text-gray-800 dark:text-white hover:border-rose-400`;
    }
    // Amarillo / Ámbar: Aprobado (>= 50% y < 100%)
    return `bg-white ${darkBg} border-amber-300 dark:border-amber-700/80 shadow-sm text-gray-800 dark:text-white hover:border-amber-400`;
  };

  const renderPracticeBadge = (topicName: string) => {
    const res = results[`${subjectName}|${topicName}`];
    const timesPracticed = res?.timesPracticed ?? (res && res.total > 0 ? 1 : 0);

    if (timesPracticed === 0 || !res || res.total === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          Sin practicar
        </span>
      );
    }

    const { score, total } = res;
    let scoreBadgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-white border-amber-300 dark:border-amber-700";

    if (score === total && total > 0) {
      scoreBadgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-white border-emerald-300 dark:border-emerald-700";
    } else if (score < total / 2) {
      scoreBadgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-white border-rose-300 dark:border-rose-700";
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Contador de prácticas */}
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-white border border-indigo-200 dark:border-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="dark:text-white">{timesPracticed} {timesPracticed === 1 ? 'práctica' : 'prácticas'}</span>
        </span>

        {/* Fracción de aciertos */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${scoreBadgeStyle}`}>
          <span className="dark:text-white">{score}/{total}</span>
        </span>
      </div>
    );
  };

  const renderTopicCard = (topic: typeof topics[0], globalIndex: number) => {
    const isOfficialExamView = subjectName === 'Simulacros Oficiales' || courseName === 'Exámenes';
    const topicQuestions = filteredQuestions.filter(q => q.topic === topic.name);
    
    // Group subjects inside this exam deck
    const subjectsMap = new Map<string, { count: number; weight?: number }>();
    topicQuestions.forEach(q => {
      const s = q.targetSubject || q.subject;
      const cur = subjectsMap.get(s) || { count: 0, weight: q.weight };
      cur.count++;
      if (q.weight) cur.weight = q.weight;
      subjectsMap.set(s, cur);
    });

    const areasInTopic = Array.from(new Set(topicQuestions.map(q => q.area).filter(Boolean)));
    const totalPoints = topicQuestions.reduce((sum, q) => sum + (q.weight || 1.25), 0);

    return (
      <div 
        key={topic.name}
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center gap-3.5 sm:gap-4 md:gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name, globalIndex)}`}
      >
        {/* Left Section: Topic Number + Topic Title + Badges */}
        <div className="flex items-start gap-3 w-full md:w-auto flex-grow min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 border bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-white border-indigo-100 dark:border-slate-700">
            {topic.order === 999 ? '?' : topic.order}
          </div>

          <div className="flex-grow min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base sm:text-lg font-black text-gray-800 dark:text-white break-words">{topic.name}</h4>
              {renderPracticeBadge(topic.name)}
              {topic.processesList && topic.processesList.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {topic.processesList.map(proc => {
                    const style = getProcessBadgeStyle(proc);
                    return (
                      <span 
                        key={proc}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${style.bg} ${style.text} border ${style.border} dark:text-white`}
                        title={`Preguntas de este tema incluidas en ${proc}`}
                      >
                        {style.icon} {getProcessShortName(proc)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Badges para Examen Oficial: Materias incluidas y sus pesos */}
            {isOfficialExamView && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {areasInTopic.map(a => (
                  <span key={a} className="bg-purple-100 dark:bg-slate-800 text-purple-700 dark:text-white px-2 py-0.5 rounded-md font-black text-[10px] border border-purple-200 dark:border-slate-700">
                    Área {a}
                  </span>
                ))}
                {Array.from(subjectsMap.entries()).map(([subj, info]) => (
                  <span key={subj} className="bg-emerald-100 dark:bg-slate-800 text-emerald-800 dark:text-white px-2 py-0.5 rounded-md font-black text-[10px] border border-emerald-200 dark:border-slate-700">
                    {subj} ({info.count}) {info.weight ? `• ${info.weight.toFixed(3)} pts` : ''}
                  </span>
                ))}
                {totalPoints > 0 && (
                  <span className="bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-white px-2 py-0.5 rounded-md font-mono font-black text-[10px] border border-indigo-200 dark:border-slate-700">
                    Total: {totalPoints.toFixed(2)} pts
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-white/85 font-medium">
              <span className="dark:text-white/85">{topic.count} {topic.count === 1 ? 'pregunta' : 'preguntas'}</span>
              {topic.week !== undefined && topic.week !== null && (
                <span className="dark:text-white/85">• Semana {topic.week}</span>
              )}
              {topic.areasList && topic.areasList.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {topic.areasList.map(a => {
                    const badge = getAreaBadgeStyle(a);
                    return (
                      <span 
                        key={a}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badge.bg} ${badge.text} border ${badge.border} dark:text-white`}
                        title={`Práctica para el área ${a}`}
                      >
                        {badge.icon} {a === 'Todas' ? 'Común' : a}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-slate-800 justify-between md:justify-end shrink-0 flex-wrap sm:flex-nowrap">
          {/* Botón para añadir más materias a este examen */}
          {isOfficialExamView && onSaveQuestions && (
            <button
              onClick={() => {
                setUploadModalInitialTopic(topic.name);
                setIsUploadModalOpen(true);
              }}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-white border border-indigo-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] shadow-sm active:scale-95"
              title="Añadir preguntas de otra materia a este mismo examen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Materia</span>
            </button>
          )}

          {/* Move Up/Down */}
          <div className={`flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden ${
            globalIndex === 1 ? 'bg-gray-50 dark:bg-[#000c19]' : 'bg-gray-50 dark:bg-slate-800'
          } shrink-0`}>
            <button 
              onClick={() => onMoveTopic(topic.name, 'UP')}
              disabled={globalIndex === 0}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[38px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-white"
              title="Mover Arriba"
              aria-label="Mover arriba"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={() => onMoveTopic(topic.name, 'DOWN')}
              disabled={globalIndex === topics.length - 1}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[38px] flex items-center justify-center border-l border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-white"
              title="Mover Abajo"
              aria-label="Mover abajo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Examen Clásico */}
          <button 
            onClick={() => onSelectTopic(topic.name, 'CLASSIC', effectiveProcess || undefined, activeAreaFilter)}
            className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[44px]"
            title="Práctica estándar de preguntas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Clásico</span>
          </button>

          {/* Jugar Practix */}
          <button 
            onClick={() => onSelectTopic(topic.name, 'QUIZZIZ', effectiveProcess || undefined, activeAreaFilter)}
            className="flex-1 md:flex-initial bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[44px]"
            title="Modo Juego Practix con tiempo y comodines"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Jugar Practix</span>
          </button>

          {/* Delete Practice */}
          <button 
            onClick={() => setTopicToDelete(topic.name)}
            className="p-2.5 text-rose-500 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            title="Eliminar Práctica"
            aria-label="Eliminar práctica"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs">Materia</span>
            {courseName && (
              <span className="text-gray-400 dark:text-white/80 text-xs">• {courseName}</span>
            )}
            {effectiveProcess && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getProcessBadgeStyle(effectiveProcess).bg} ${getProcessBadgeStyle(effectiveProcess).text} border ${getProcessBadgeStyle(effectiveProcess).border} dark:text-white`}>
                {effectiveProcess.replace(' 2027', '')}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white mt-1">{subjectName}</h2>
          {subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros' ? (
            <p className="text-xs text-gray-400 dark:text-white/85 mt-1">
              {savedExams.length} {savedExams.length === 1 ? 'examen registrado' : 'exámenes registrados'} • Historial y resoluciones de tus simulacros
            </p>
          ) : subjectName === 'Simulacros Oficiales' ? (
            <p className="text-xs text-gray-400 dark:text-white/85 mt-1">
              {filteredQuestions.length} preguntas de exámenes oficiales {effectiveProcess ? `en ${effectiveProcess}` : ''} distribuidas en {topics.length} mazos oficiales
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-white/85 mt-1">
              {filteredQuestions.length} preguntas disponibles {effectiveProcess ? `en ${effectiveProcess}` : 'en total'} distribuidas en {topics.length} temas
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {subjectName === 'Simulacros Oficiales' && onSaveQuestions && (
            <button
              onClick={() => {
                setUploadModalInitialTopic('');
                setIsUploadModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md flex items-center gap-2 min-h-[40px] shrink-0"
              title="Subir preguntas de exámenes oficiales de admisión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Subir Preguntas</span>
            </button>
          )}

          {topics.length > 0 && (
            <div className="flex bg-gray-100 dark:bg-[#030d42] p-1 rounded-xl border border-gray-200 dark:border-indigo-900/60 text-xs font-bold shrink-0 self-start sm:self-auto">
              <button 
                onClick={() => setGroupByWeeks(true)}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[34px] ${groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-indigo-300 hover:text-gray-800 dark:hover:text-white'}`}
              >
                Por Semanas
              </button>
              <button 
                onClick={() => setGroupByWeeks(false)}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[34px] ${!groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-indigo-300 hover:text-gray-800 dark:hover:text-white'}`}
              >
                Lista Completa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel Discreto y Desplegable: Filtros (Área y Proceso), Banco de Errores y Examen Mixto */}
      {!((subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros') && questions.length === 0) && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs transition-all">
          {/* Barra Resumen Compacta (Siempre visible de forma discreta) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase text-gray-500 dark:text-white tracking-wider flex items-center gap-1 mr-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Ajustes:</span>
              </span>

              {/* Chip de Área Activa */}
              {(() => {
                const b = getAreaBadgeStyle(activeAreaFilter);
                return (
                  <button
                    type="button"
                    onClick={toggleToolsExpanded}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${b.bg} ${b.text} ${b.border} dark:text-white hover:opacity-90`}
                    title="Clic para desplegar y cambiar filtro de área"
                  >
                    <span className="text-xs">{b.icon}</span>
                    <span>{activeAreaFilter === 'Todas' ? 'Todas las áreas' : activeAreaFilter}</span>
                  </button>
                );
              })()}

              {/* Chip de Proceso Activo */}
              {(() => {
                const isAll = !effectiveProcess;
                const pStyle = effectiveProcess ? getProcessBadgeStyle(effectiveProcess) : null;
                return (
                  <button
                    type="button"
                    onClick={toggleToolsExpanded}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isAll 
                        ? 'bg-gray-100/90 dark:bg-slate-800 text-gray-700 dark:text-white border-gray-200 dark:border-slate-700' 
                        : `${pStyle?.bg} ${pStyle?.text} ${pStyle?.border} dark:text-white`
                    } hover:opacity-90`}
                    title="Clic para desplegar y cambiar filtro de proceso"
                  >
                    <span>🏛️</span>
                    <span>{effectiveProcess ? getProcessShortName(effectiveProcess) : 'Todos'}</span>
                  </button>
                );
              })()}

              {/* Chip Banco de Errores */}
              {questions.length > 0 && (
                mistakeQuestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleToolsExpanded}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-white border border-rose-200/80 dark:border-rose-900/60 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                    title="Clic para desplegar banco de errores"
                  >
                    <span>⚠️</span>
                    <span>{mistakeQuestions.length} errores</span>
                  </button>
                ) : (
                  <span 
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50/80 dark:bg-emerald-950/80 text-emerald-700 dark:text-white border border-emerald-200/60 dark:border-emerald-900/40 hidden md:inline-flex"
                    title="No tienes errores pendientes en esta materia"
                  >
                    <span>✓ 0 fallos</span>
                  </span>
                )
              )}

              {/* Chip Examen Mixto */}
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={toggleToolsExpanded}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-white border border-indigo-200/60 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer hidden sm:inline-flex"
                  title="Clic para configurar Examen Mixto"
                >
                  <span>⚡</span>
                  <span>Mixto ({calculatedMixedQuestions.length})</span>
                </button>
              )}
            </div>

            {/* Acciones Rápidas y Botón Desplegar */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              {/* Acceso rápido a repasar errores si hay pendientes */}
              {questions.length > 0 && mistakeQuestions.length > 0 && !isToolsExpanded && (
                <button
                  type="button"
                  onClick={() => handleStartMistakes('CLASSIC')}
                  className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Repasar directamente las preguntas falladas en modo clásico"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Repasar ({mistakeQuestions.length})</span>
                </button>
              )}

              {/* Botón Principal de Desplegar/Colapsar */}
              <button
                type="button"
                onClick={toggleToolsExpanded}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isToolsExpanded 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-indigo-50/90 dark:bg-slate-800 text-indigo-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200/80 dark:border-slate-700'
                }`}
                title={isToolsExpanded ? 'Ocultar panel desplegable' : 'Desplegar filtros, banco de errores y examen mixto'}
              >
                <span>{isToolsExpanded ? 'Ocultar Opciones' : 'Desplegar Herramientas'}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel Desplegable con Controles Completos */}
          {isToolsExpanded && (
            <div className="pt-3 mt-3 border-t border-gray-200/70 dark:border-slate-800 space-y-3.5 animate-fadeIn">
              {/* Sección 1: Filtros de Área y Proceso */}
              <div className="bg-gray-50/80 dark:bg-slate-800/60 rounded-xl p-3 border border-gray-200/60 dark:border-slate-700/60 space-y-2.5">
                {/* Área Filter Row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                    <span className="text-[11px] font-black uppercase text-gray-700 dark:text-white tracking-wider">
                      Área de Postulación:
                    </span>
                    {selectedArea && (
                      <span className="text-[10px] text-gray-400 dark:text-white/80 hidden sm:inline">
                        (Tu área: {selectedArea})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {(['Biomédicas', 'Ingenierías', 'Sociales', 'Todas'] as const).map(areaKey => {
                      const badge = getAreaBadgeStyle(areaKey);
                      const isSelected = activeAreaFilter === areaKey;
                      const isUserArea = selectedArea === areaKey;
                      const count = areaKey === 'Todas' ? questions.length : areaStats[areaKey] || 0;

                      return (
                        <button
                          key={areaKey}
                          type="button"
                          onClick={() => setActiveAreaFilter(areaKey)}
                          className={`py-0.5 px-2 sm:px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[28px] ${
                            isSelected
                              ? `${badge.bg} ${badge.text} ${badge.border} border font-black shadow-2xs dark:text-white`
                              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700'
                          }`}
                          title={`Filtrar prácticas por ${areaKey}`}
                        >
                          <span className="text-xs">{badge.icon}</span>
                          <span>{areaKey === 'Todas' ? 'Todas' : areaKey}</span>
                          <span className={`text-[10px] px-1 py-0.2 rounded-md ${isSelected ? 'bg-black/10 dark:bg-white/20' : 'bg-gray-200/70 dark:bg-slate-700 text-gray-600 dark:text-white'}`}>
                            {count}
                          </span>
                          {isUserArea && isSelected && (
                            <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-300 hidden lg:inline">
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Proceso Filter Row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-gray-200/50 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-[11px] font-black uppercase text-gray-700 dark:text-white tracking-wider">
                      Proceso de Admisión:
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectProcess('')}
                      className={`py-0.5 px-2 sm:px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[28px] ${
                        effectiveProcess === ''
                          ? 'bg-indigo-600 text-white shadow-2xs font-black'
                          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700'
                      }`}
                    >
                      <span>Todos</span>
                      <span className={`text-[10px] px-1 py-0.2 rounded-md ${effectiveProcess === '' ? 'bg-white/20 text-white' : 'bg-gray-200/70 dark:bg-slate-700 text-gray-600 dark:text-white'}`}>
                        {questions.length}
                      </span>
                    </button>

                    {availableProcesses.map(proc => {
                      const isSelected = effectiveProcess === proc;
                      const style = getProcessBadgeStyle(proc);
                      const count = processStats[proc] || 0;
                      const shortName = getProcessShortName(proc);

                      return (
                        <button
                          key={proc}
                          type="button"
                          onClick={() => handleSelectProcess(isSelected ? '' : proc)}
                          className={`py-0.5 px-2 sm:px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[28px] ${
                            isSelected
                              ? `${style.bg} ${style.text} ${style.border} border font-black shadow-2xs dark:text-white`
                              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700'
                          }`}
                          title={`Filtrar por proceso ${proc} (Se recordará en tus prácticas)`}
                        >
                          <span>{shortName}</span>
                          <span className={`text-[10px] px-1 py-0.2 rounded-md ${
                            isSelected 
                              ? 'bg-black/10 dark:bg-white/20 text-current' 
                              : 'bg-gray-200/70 dark:bg-slate-700 text-gray-600 dark:text-white'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sección 2: Banco de Errores */}
              {questions.length > 0 && (
                mistakeQuestions.length === 0 ? (
                  <div className="bg-emerald-50/40 dark:bg-slate-800/60 border border-emerald-200/50 dark:border-slate-700 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-900 dark:text-white">
                        Banco de Errores:
                      </span>
                      <span className="text-[11px] text-emerald-700/85 dark:text-white/80">
                        0 fallos pendientes • ¡Estás al día en {subjectName}!
                      </span>
                    </div>
                    {onAddSampleMistakes && (
                      <button
                        type="button"
                        onClick={handleAddSampleMistake}
                        className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold py-0.5 px-2 cursor-pointer"
                        title="Añadir preguntas de prueba para probar la función"
                      >
                        + Probar banco
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50/60 dark:bg-slate-800/60 border border-emerald-200/80 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 shadow-2xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Banco de Errores</span>
                        </span>
                        <span className="text-xs font-black text-gray-800 dark:text-white">
                          {mistakeQuestions.length} {mistakeQuestions.length === 1 ? 'pregunta por reforzar' : 'preguntas por reforzar'}
                        </span>
                        {onClearSubjectMistakes && (
                          <button
                            type="button"
                            onClick={handleClearMistakes}
                            className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                            title="Reiniciar registro de errores"
                          >
                            • Reiniciar
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-white/80 mt-0.5 truncate">
                        Refuerza tus preguntas falladas de {subjectName}; al acertarlas saldrán de este banco.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0 justify-end flex-wrap sm:flex-nowrap">
                      {mistakeQuestions.length > 5 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-white uppercase">Cant:</span>
                          <input 
                            type="number" 
                            min="1" 
                            max={mistakeQuestions.length}
                            value={mistakesCountLimit}
                            onChange={(e) => setMistakesCountLimit(parseInt(e.target.value) || 1)}
                            className="w-14 px-1.5 py-1 rounded-lg border border-emerald-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white font-bold focus:ring-1 focus:ring-emerald-500 outline-none text-center text-xs"
                            title="Cantidad de preguntas"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartMistakes('CLASSIC')}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Practicar todas en modo clásico"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Repasar ({mistakeQuestions.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartMistakes('QUIZZIZ')}
                        className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Jugar en modo Practix"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Jugar Practix</span>
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Sección 3: Examen Mixto */}
              {questions.length > 0 && (
                <div className="bg-indigo-50/70 dark:bg-slate-800/60 border border-indigo-100/90 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 space-y-2.5 shadow-2xs">
                  {/* Top row: Title, badge and summary description */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-indigo-900 dark:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span>Examen Mixto</span>
                      </span>
                      {renderPracticeBadge("Examen Mixto")}
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-white border border-indigo-200/80 dark:border-slate-700">
                        {calculatedMixedQuestions.length} {calculatedMixedQuestions.length === 1 ? 'pregunta' : 'preguntas'} listas
                      </span>
                    </div>
                    <p className="text-indigo-700/70 dark:text-white/80 text-[11px]">
                      {mixedDistMode === 'PER_TOPIC' && `${perTopicCount} de cada uno de los ${topics.length} temas`}
                      {mixedDistMode === 'PER_WEEK' && `${perWeekCount} de cada una de las ${availableWeeks.length || 'todas las'} semanas`}
                      {mixedDistMode === 'TOTAL' && `Aleatorio global entre todos los temas`}
                    </p>
                  </div>

                  {/* Controls row: Selector de modo, control de cantidad y botones de inicio */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1.5 border-t border-indigo-100/60 dark:border-slate-700/60">
                    {/* Mode Segmented Selector */}
                    <div className="flex items-center gap-1 bg-white/70 dark:bg-slate-900/60 p-0.5 rounded-lg border border-indigo-100 dark:border-slate-700 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectDistMode('PER_TOPIC')}
                        className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          mixedDistMode === 'PER_TOPIC'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-600 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800/60'
                        }`}
                        title="Genera un examen con 1 o más preguntas de cada tema para un repaso equilibrado"
                      >
                        <span>1+ por Tema</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectDistMode('PER_WEEK')}
                        className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          mixedDistMode === 'PER_WEEK'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-600 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800/60'
                        }`}
                        title="Genera un examen con 1 o más preguntas de cada semana"
                      >
                        <span>1+ por Semana</span>
                        {availableWeeks.length > 0 && (
                          <span className={`text-[9px] px-1 rounded ${mixedDistMode === 'PER_WEEK' ? 'bg-indigo-800/70 text-indigo-100' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-white'}`}>
                            {availableWeeks.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectDistMode('TOTAL')}
                        className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          mixedDistMode === 'TOTAL'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-600 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800/60'
                        }`}
                        title="Selecciona una cantidad fija aleatoria de todas las preguntas"
                      >
                        <span>Aleatorio Total</span>
                      </button>
                    </div>

                    {/* Stepper / Count Input depending on mode */}
                    <div className="flex items-center gap-2 justify-between md:justify-end flex-wrap sm:flex-nowrap">
                      {mixedDistMode === 'PER_TOPIC' && (
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-slate-700">
                          <span className="text-[10px] font-black text-indigo-800 dark:text-white uppercase">Por Tema:</span>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => handleUpdatePerTopicCount(perTopicCount - 1)}
                              disabled={perTopicCount <= 1}
                              className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-indigo-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <span className="w-7 text-center text-xs font-black text-indigo-950 dark:text-white font-mono">
                              {perTopicCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePerTopicCount(perTopicCount + 1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-indigo-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-slate-800"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {mixedDistMode === 'PER_WEEK' && (
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-slate-700">
                          <span className="text-[10px] font-black text-indigo-800 dark:text-white uppercase">Por Semana:</span>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => handleUpdatePerWeekCount(perWeekCount - 1)}
                              disabled={perWeekCount <= 1}
                              className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-indigo-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <span className="w-7 text-center text-xs font-black text-indigo-950 dark:text-white font-mono">
                              {perWeekCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePerWeekCount(perWeekCount + 1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-indigo-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-slate-800"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {mixedDistMode === 'TOTAL' && (
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-slate-700">
                          <span className="text-[10px] font-black text-indigo-800 dark:text-white uppercase">Total:</span>
                          <input 
                            type="number" 
                            min="1" 
                            max={filteredQuestions.length}
                            value={mixedCount}
                            onChange={(e) => setMixedCount(parseInt(e.target.value) || 1)}
                            className="w-14 px-1 py-0.5 rounded border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-center text-xs"
                          />
                        </div>
                      )}

                      {/* Start buttons */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleStartMixed('CLASSIC')}
                          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          title="Examen Mixto en formato clásico"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Clásico</span>
                        </button>
                        <button 
                          onClick={() => handleStartMixed('QUIZZIZ')}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          title="Modo Juego Practix con tiempo y comodines"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Jugar Practix</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón para colapsar en el pie del panel */}
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={toggleToolsExpanded}
                  className="text-xs font-bold text-gray-500 dark:text-white/80 hover:text-indigo-600 dark:hover:text-white transition-colors py-1 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                  <span>Ocultar herramientas y volver a los temas</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exámenes Registrados y Resueltos Section (Solo para Exámenes Rendidos / Exámenes Simulacros) */}
      {(subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros') && (
        <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-lg border border-indigo-100 dark:border-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100">Exámenes Registrados y Resueltos</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Historial de exámenes generados en la plataforma. Puedes volver a tomarlos en cualquier momento.
              </p>
            </div>
            {onStartNewExam && (
              <button
                onClick={onStartNewExam}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Generar Nuevo Simulacro</span>
              </button>
            )}
          </div>

          {(!savedExams || savedExams.length === 0) ? (
            <div className="text-center py-10 bg-gray-50/70 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8">
              <div className="w-12 h-12 mx-auto mb-3 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-gray-700 dark:text-gray-200">Aún no hay exámenes registrados</h4>
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-1 max-w-md mx-auto mb-4">
                Al iniciar un Simulacro General o Examen Personalizado en la plataforma, se registrará aquí automáticamente para que puedas volver a tomarlo cuando quieras.
              </p>
              {onStartNewExam && (
                <button
                  onClick={onStartNewExam}
                  className="bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                >
                  Iniciar mi primer simulacro
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedExams.map((exam) => {
                const isSolved = exam.score !== undefined && exam.score !== null;
                const percentage = isSolved && exam.maxScore ? Math.round((exam.score! / exam.maxScore) * 100) : 0;
                
                let scoreBadgeClass = "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                if (isSolved) {
                  if (percentage >= 70) scoreBadgeClass = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                  else if (percentage < 50) scoreBadgeClass = "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                }

                const createdDateStr = new Date(exam.createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={exam.id} 
                    className="bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 hover:border-indigo-300 hover:dark:border-indigo-600/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 tracking-wider border border-indigo-200 dark:border-indigo-800/60">
                            {exam.mode === 'CUSTOM' ? 'Personalizado' : 'Simulacro General'}
                          </span>
                          {exam.selectedExamWeeks && exam.selectedExamWeeks.length > 0 && (
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 tracking-wider border border-emerald-200 dark:border-emerald-800/60">
                              {exam.selectedExamWeeks.length === 1 
                                ? `Semana ${exam.selectedExamWeeks[0]}`
                                : exam.selectedExamWeeks.length === 2 && exam.selectedExamWeeks[0] === 1 && exam.selectedExamWeeks[1] === 2
                                ? 'Sem 1 y 2'
                                : exam.selectedExamWeeks.length === 3 && exam.selectedExamWeeks[0] === 1 && exam.selectedExamWeeks[1] === 2 && exam.selectedExamWeeks[2] === 3
                                ? 'Sem 1, 2 y 3'
                                : `Sem ${exam.selectedExamWeeks.join(', ')}`
                              }
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 tracking-wider">
                          {exam.area}
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">
                        {exam.title}
                      </h4>

                      <p className="text-xs text-gray-400 dark:text-gray-400 mb-4">
                        {exam.totalQuestions} preguntas • Registrado: {createdDateStr}
                        {exam.attemptsCount && exam.attemptsCount > 1 ? ` • Intento #${exam.attemptsCount}` : ''}
                      </p>

                      <div className="mb-4">
                        {isSolved ? (
                          <div className={`p-3 rounded-xl border flex items-center justify-between ${scoreBadgeClass}`}>
                            <span className="text-xs font-black uppercase tracking-wider">Puntaje Obtenido</span>
                            <span className="text-sm font-black">
                              {(exam.score ?? 0).toFixed(2)} / {(exam.maxScore ?? 0).toFixed(2)} pts ({percentage}%)
                            </span>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider">Estado</span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">Pendiente de resolver</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800/80 mt-2">
                      {onViewExamResolution && (
                        <button
                          onClick={() => onViewExamResolution(exam)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                          title="Ver resolución detallada de preguntas y respuestas"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Ver resolución</span>
                        </button>
                      )}

                      {onRetakeExam && (
                        <button
                          onClick={() => onRetakeExam(exam)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                          title="Volver a rendir este examen"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Volver a tomar</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExamToPrint(exam)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                        title="Imprimir o Exportar a PDF"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span>PDF</span>
                      </button>

                      {onDeleteSavedExam && (
                        <button
                          onClick={() => setExamToDelete(exam.id)}
                          className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                          title="Eliminar examen del registro"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* Topic List */}
      {topics.length === 0 ? (
        subjectName === 'Simulacros Oficiales' ? (
          <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 rounded-3xl border-2 border-dashed border-indigo-200 dark:border-slate-800 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600/10 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2">
              Aún no hay preguntas de exámenes oficiales subidas
            </h3>
            <p className="text-gray-500 dark:text-white/80 text-xs sm:text-sm max-w-lg mx-auto mb-6 leading-relaxed">
              Sube preguntas de exámenes de admisión anteriores (Ceprunsa u Ordinario). Al subir, podrás especificar de qué <strong>materia</strong> son (Física, Literatura, Biología, etc.) y a qué <strong>área</strong> corresponden (Biomédicas, Ingenierías o Sociales) para aplicar sus ponderaciones oficiales automáticamente dentro del mismo mazo.
            </p>
            {onSaveQuestions && (
              <button
                onClick={() => {
                  setUploadModalInitialTopic('');
                  setIsUploadModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/25 active:scale-95 inline-flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Subir Preguntas Ahora</span>
              </button>
            )}
          </div>
        ) : (subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros') ? null : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 sm:p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-700 dark:text-white">
              No hay temas registrados aún
            </h3>
            <p className="text-gray-400 dark:text-white/70 text-xs mt-1 max-w-md mx-auto">
              Ve al Panel de Admin para crear la primera práctica.
            </p>
          </div>
        )
      ) : groupByWeeks ? (
        <div className="space-y-8 sm:space-y-10 animate-fade-in">
          {topicsByWeek.map(([weekName, weekTopics]) => (
            <div key={weekName} className="space-y-3 sm:space-y-4">
              <h3 className="text-xs font-black text-indigo-600 dark:text-white uppercase tracking-widest flex items-center gap-2 border-b-2 border-indigo-100 dark:border-slate-800 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                {weekName}
                <span className="text-[10px] text-gray-400 dark:text-white/80 font-bold ml-auto">
                  {weekTopics.length} {weekTopics.length === 1 ? 'tema' : 'temas'}
                </span>
              </h3>
              <div className="space-y-3">
                {weekTopics.map((topic) => {
                  const globalIndex = topics.findIndex(t => t.name === topic.name);
                  return renderTopicCard(topic, globalIndex);
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, index) => renderTopicCard(topic, index))}
        </div>
      )}

      {/* Delete Topic Modal */}
      {topicToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Práctica</h3>
            <p className="text-gray-600 dark:text-white/80 mb-6">
              ¿Seguro que deseas eliminar la práctica <span className="font-bold text-gray-800 dark:text-white">"{topicToDelete}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTopicToDelete(null)}
                className="px-4 py-2 text-indigo-700 dark:text-white font-bold hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteTopic(topicToDelete);
                  setTopicToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm text-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Saved Exam Modal */}
      {examToDelete !== null && onDeleteSavedExam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#020b38] rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-indigo-900/80">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Examen Registrado</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
              ¿Seguro que deseas eliminar este examen del historial registrado? Esta acción no afectará tu puntaje general.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExamToDelete(null)}
                className="px-4 py-2 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteSavedExam(examToDelete);
                  setExamToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm text-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {examToPrint !== null && (
        <PrintExamModal
          exam={examToPrint}
          allQuestions={allDatabaseQuestions.length > 0 ? allDatabaseQuestions : questions}
          readingTexts={readingTexts}
          onClose={() => setExamToPrint(null)}
        />
      )}

      {/* Modal para Subir Preguntas de Examen Anterior Oficial */}
      {onSaveQuestions && (
        <UploadExamQuestionsModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setUploadModalInitialTopic('');
          }}
          onSaveQuestions={(newQuestions) => {
            onSaveQuestions(newQuestions);
            setIsUploadModalOpen(false);
            setUploadModalInitialTopic('');
            if (onToast) onToast(`¡Se subieron ${newQuestions.length} preguntas correctamente al mazo oficial!`);
          }}
          existingTopics={topics.map(t => t.name)}
          initialTopic={uploadModalInitialTopic}
          initialArea={selectedArea || 'Biomédicas'}
          onToast={onToast}
        />
      )}
    </div>
  );
};

export default TopicsView;
