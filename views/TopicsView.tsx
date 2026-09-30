import React, { useState, useMemo } from 'react';
import { Question, ReadingText, TopicResult, SavedExam } from '../types';
import { getQuestionProcess, getProcessBadgeStyle, getProcessShortName, getAvailableProcesses } from '../utils';
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
  onSelectTopic: (topic: string, mode?: 'CLASSIC' | 'QUIZZIZ', process?: string) => void;
  onStartMixedQuiz: (questions: Question[], mode?: 'CLASSIC' | 'QUIZZIZ') => void;
  onDeleteTopic: (topic: string) => void;
  onMoveTopic: (topic: string, direction: 'UP' | 'DOWN') => void;
  onRetakeExam?: (exam: SavedExam) => void;
  onViewExamResolution?: (exam: SavedExam) => void;
  onDeleteSavedExam?: (examId: string) => void;
  onStartNewExam?: () => void;
  onSaveQuestions?: (questions: Question[]) => void;
  selectedArea?: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onToast?: (msg: string) => void;
}

const TopicsView: React.FC<TopicsViewProps> = ({ 
  subjectName, 
  courseName,
  questions, 
  allDatabaseQuestions = [],
  readingTexts = [],
  results, 
  savedExams = [],
  onSelectTopic, 
  onStartMixedQuiz,
  onDeleteTopic,
  onMoveTopic,
  onRetakeExam,
  onViewExamResolution,
  onDeleteSavedExam,
  onStartNewExam,
  onSaveQuestions,
  selectedArea,
  onToast
}) => {
  const [selectedProcess, setSelectedProcess] = useState<string>(''); // '' = Todos los procesos
  const [mixedCount, setMixedCount] = useState<number>(Math.min(10, questions.length));
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToPrint, setExamToPrint] = useState<SavedExam | null>(null);
  const [groupByWeeks, setGroupByWeeks] = useState<boolean>(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalInitialTopic, setUploadModalInitialTopic] = useState('');

  // Lista dinámica de procesos presentes en esta materia o disponibles
  const availableProcesses = useMemo(() => {
    return getAvailableProcesses(questions);
  }, [questions]);

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

  // Preguntas filtradas según el proceso de admisión seleccionado
  const filteredQuestions = useMemo(() => {
    if (!selectedProcess) return questions;
    return questions.filter(q => getQuestionProcess(q) === selectedProcess);
  }, [questions, selectedProcess]);

  const handleStartMixed = (mode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    if (filteredQuestions.length === 0) return;
    const count = Math.min(Math.max(1, mixedCount), filteredQuestions.length);
    const shuffled = [...filteredQuestions].sort(() => 0.5 - Math.random());
    onStartMixedQuiz(shuffled.slice(0, count), mode);
  };

  const topics = useMemo(() => {
    const grouped = filteredQuestions.reduce((acc, q) => {
      const proc = getQuestionProcess(q);
      if (!acc[q.topic]) {
        acc[q.topic] = {
          name: q.topic,
          count: 0,
          order: q.order ?? 999,
          week: q.week,
          processes: new Set<string>()
        };
      }
      acc[q.topic].count++;
      acc[q.topic].processes.add(proc);
      if (q.week !== undefined && acc[q.topic].week === undefined) {
        acc[q.topic].week = q.week;
      }
      return acc;
    }, {} as Record<string, { name: string; count: number; order: number; week?: number; processes: Set<string> }>);

    return (Object.values(grouped) as { name: string; count: number; order: number; week?: number; processes: Set<string> }[])
      .map(t => ({
        ...t,
        processesList: Array.from(t.processes)
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

  const getTopicColorClasses = (topicName: string) => {
    const result = results[`${subjectName}|${topicName}`];
    const timesPracticed = result?.timesPracticed ?? (result && result.total > 0 ? 1 : 0);
    const isPracticed = timesPracticed > 0 && result && result.total > 0;

    // Color gris si todavía no está practicado
    if (!isPracticed) {
      return "bg-gray-100/85 dark:bg-[#0f1424] border-gray-300/80 dark:border-slate-800 text-gray-700 dark:text-gray-300";
    }

    const { score, total } = result;

    // Verde: Puntaje perfecto
    if (score === total) {
      return "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-sm";
    }
    // Rojo: Inferior al 50% de aciertos
    if (score < total / 2) {
      return "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 shadow-sm";
    }
    // Amarillo / Ámbar: Aprobado (>= 50% y < 100%)
    return "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm";
  };

  const renderPracticeBadge = (topicName: string) => {
    const res = results[`${subjectName}|${topicName}`];
    const timesPracticed = res?.timesPracticed ?? (res && res.total > 0 ? 1 : 0);

    if (timesPracticed === 0 || !res || res.total === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-200/90 text-gray-600 dark:bg-slate-800 dark:text-gray-300 border border-gray-300 dark:border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          Sin practicar
        </span>
      );
    }

    const { score, total } = res;
    let scoreBadgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800";

    if (score === total && total > 0) {
      scoreBadgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    } else if (score < total / 2) {
      scoreBadgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Contador de prácticas */}
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{timesPracticed} {timesPracticed === 1 ? 'práctica' : 'prácticas'}</span>
        </span>

        {/* Fracción de aciertos */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${scoreBadgeStyle}`}>
          <span>{score}/{total}</span>
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
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center gap-3.5 sm:gap-4 md:gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name)}`}
      >
        {/* Left Section: Topic Number + Topic Title + Badges */}
        <div className="flex items-start gap-3 w-full md:w-auto flex-grow min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 border bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800">
            {topic.order === 999 ? '?' : topic.order}
          </div>

          <div className="flex-grow min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 break-words">{topic.name}</h4>
              {renderPracticeBadge(topic.name)}
              {topic.processesList && topic.processesList.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {topic.processesList.map(proc => {
                    const style = getProcessBadgeStyle(proc);
                    return (
                      <span 
                        key={proc}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${style.bg} ${style.text} border ${style.border}`}
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
                  <span key={a} className="bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-black text-[10px] border border-purple-200 dark:border-purple-800/60">
                    Área {a}
                  </span>
                ))}
                {Array.from(subjectsMap.entries()).map(([subj, info]) => (
                  <span key={subj} className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-black text-[10px] border border-emerald-200 dark:border-emerald-800/60">
                    {subj} ({info.count}) {info.weight ? `• ${info.weight.toFixed(3)} pts` : ''}
                  </span>
                ))}
                {totalPoints > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-mono font-black text-[10px] border border-indigo-200 dark:border-indigo-800/60">
                    Total: {totalPoints.toFixed(2)} pts
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-indigo-300/80 font-medium">
              <span>{topic.count} {topic.count === 1 ? 'pregunta' : 'preguntas'}</span>
              {topic.week !== undefined && topic.week !== null && (
                <span>• Semana {topic.week}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-indigo-900/50 justify-between md:justify-end shrink-0 flex-wrap sm:flex-nowrap">
          {/* Botón para añadir más materias a este examen */}
          {isOfficialExamView && onSaveQuestions && (
            <button
              onClick={() => {
                setUploadModalInitialTopic(topic.name);
                setIsUploadModalOpen(true);
              }}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/80 px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] shadow-sm active:scale-95"
              title="Añadir preguntas de otra materia a este mismo examen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Materia</span>
            </button>
          )}

          {/* Move Up/Down */}
          <div className="flex border border-indigo-200 dark:border-indigo-800/80 rounded-xl overflow-hidden bg-gray-50/70 dark:bg-[#030d42] shrink-0">
            <button 
              onClick={() => onMoveTopic(topic.name, 'UP')}
              disabled={globalIndex === 0}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[38px] flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-indigo-700 dark:text-indigo-200"
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
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[38px] flex items-center justify-center border-l border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-indigo-700 dark:text-indigo-200"
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
            onClick={() => onSelectTopic(topic.name, 'CLASSIC', selectedProcess || undefined)}
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
            onClick={() => onSelectTopic(topic.name, 'QUIZZIZ', selectedProcess || undefined)}
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#020b38] border border-gray-100 dark:border-indigo-900/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs">Materia</span>
            {courseName && (
              <span className="text-gray-400 dark:text-indigo-300/60 text-xs">• {courseName}</span>
            )}
            {selectedProcess && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getProcessBadgeStyle(selectedProcess).bg} ${getProcessBadgeStyle(selectedProcess).text} border ${getProcessBadgeStyle(selectedProcess).border}`}>
                {selectedProcess.replace(' 2027', '')}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 mt-1">{subjectName}</h2>
          {subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros' ? (
            <p className="text-xs text-gray-400 dark:text-indigo-300/80 mt-1">
              {savedExams.length} {savedExams.length === 1 ? 'examen registrado' : 'exámenes registrados'} • Historial y resoluciones de tus simulacros
            </p>
          ) : subjectName === 'Simulacros Oficiales' ? (
            <p className="text-xs text-gray-400 dark:text-indigo-300/80 mt-1">
              {filteredQuestions.length} preguntas de exámenes oficiales {selectedProcess ? `en ${selectedProcess}` : ''} distribuidas en {topics.length} mazos oficiales
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-indigo-300/80 mt-1">
              {filteredQuestions.length} preguntas disponibles {selectedProcess ? `en ${selectedProcess}` : 'en total (3 en 1)'} distribuidas en {topics.length} temas
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
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[36px] ${groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-indigo-300 hover:text-gray-800 dark:hover:text-white'}`}
              >
                Por Semanas
              </button>
              <button 
                onClick={() => setGroupByWeeks(false)}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[36px] ${!groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-indigo-300 hover:text-gray-800 dark:hover:text-white'}`}
              >
                Lista Completa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selector de Proceso de Admisión (Ceprunsa I, Ceprequintos, Ceprunsa II, Todos) */}
      {!((subjectName === 'Exámenes Rendidos' || subjectName === 'Exámenes Simulacros') && filteredQuestions.length === 0) && (
        <div className="bg-white dark:bg-[#020b38] border border-gray-100 dark:border-indigo-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <label className="text-xs font-black uppercase text-gray-500 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Filtrar por Proceso de Admisión:</span>
            </label>
            {selectedProcess && (
              <button
                onClick={() => setSelectedProcess('')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Ver todos los procesos</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedProcess('')}
              className={`py-2 px-3 sm:px-3.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 min-h-[44px] ${
                selectedProcess === ''
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 border border-gray-200/80 dark:border-indigo-800/70 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Todos los Procesos</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${selectedProcess === '' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'}`}>
                {questions.length}
              </span>
            </button>

            {availableProcesses.map(proc => {
              const isSelected = selectedProcess === proc;
              const style = getProcessBadgeStyle(proc);
              const count = processStats[proc] || 0;
              const shortName = getProcessShortName(proc);

              return (
                <button
                  key={proc}
                  type="button"
                  onClick={() => setSelectedProcess(isSelected ? '' : proc)}
                  className={`py-2 px-3 sm:px-3.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 min-h-[44px] ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} border-2 shadow-md`
                      : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 border border-gray-200/80 dark:border-indigo-800/70 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm'
                  }`}
                >
                  <span>{shortName}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isSelected 
                      ? 'bg-white/30 text-current' 
                      : count > 0 
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60' 
                      : 'bg-gray-100 dark:bg-indigo-950/40 text-gray-400 dark:text-indigo-400/60'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
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

      {/* Examen Mixto Section */}
      {questions.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-lg sm:text-xl font-black text-indigo-900 dark:text-indigo-100">Examen Mixto</h3>
              {renderPracticeBadge("Examen Mixto")}
            </div>
            <p className="text-indigo-700/70 dark:text-indigo-300/70 text-xs">
              Genera un examen aleatorio combinando preguntas de todos los temas de {subjectName}.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full md:w-auto shrink-0">
            <div className="flex items-center sm:flex-col justify-between sm:justify-center gap-2 sm:gap-0">
              <label className="text-[10px] font-black text-indigo-800 dark:text-indigo-300 sm:mb-1 uppercase tracking-wider">Cantidad</label>
              <input 
                type="number" 
                min="1" 
                max={questions.length}
                value={mixedCount}
                onChange={(e) => setMixedCount(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-[#020b38] text-gray-800 dark:text-gray-100 font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-center min-h-[42px]"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => handleStartMixed('CLASSIC')}
                className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[44px]"
                title="Examen Mixto Clásico"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Examen Clásico</span>
              </button>
              <button 
                onClick={() => handleStartMixed('QUIZZIZ')}
                className="flex-1 sm:flex-initial bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[44px]"
                title="Modo Juego Practix con tiempo y comodines"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Jugar Practix</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic List */}
      {topics.length === 0 ? (
        subjectName === 'Simulacros Oficiales' ? (
          <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white dark:from-[#020b38] dark:via-[#01093a] dark:to-[#020b38] rounded-3xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600/10 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2">
              Aún no hay preguntas de exámenes oficiales subidas
            </h3>
            <p className="text-gray-500 dark:text-indigo-200/80 text-xs sm:text-sm max-w-lg mx-auto mb-6 leading-relaxed">
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
          <div className="bg-white dark:bg-[#020b38] rounded-2xl border-2 border-dashed border-gray-200 dark:border-indigo-900/60 p-8 sm:p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-indigo-400/60 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-700 dark:text-gray-300">
              No hay temas registrados aún
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-md mx-auto">
              Ve al Panel de Admin para crear la primera práctica.
            </p>
          </div>
        )
      ) : groupByWeeks ? (
        <div className="space-y-8 sm:space-y-10 animate-fade-in">
          {topicsByWeek.map(([weekName, weekTopics]) => (
            <div key={weekName} className="space-y-3 sm:space-y-4">
              <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-indigo-100 dark:border-indigo-950 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                {weekName}
                <span className="text-[10px] text-gray-400 font-bold ml-auto">
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
          <div className="bg-white dark:bg-[#020b38] rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-indigo-900/80">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Práctica</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              ¿Seguro que deseas eliminar la práctica <span className="font-bold text-gray-800 dark:text-gray-100">"{topicToDelete}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTopicToDelete(null)}
                className="px-4 py-2 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors text-xs"
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
