import React, { useState, useMemo } from 'react';
import { Question, ReadingText, TopicResult, SavedExam } from '../types';
import { ADMISSION_PROCESSES } from '../constants';
import { getQuestionProcess, getProcessBadgeStyle } from '../utils';
import { PrintExamModal } from '../components/PrintExamModal';

interface TopicsViewProps {
  subjectName: string;
  courseName?: string;
  questions: Question[];
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
}

const TopicsView: React.FC<TopicsViewProps> = ({ 
  subjectName, 
  courseName,
  questions, 
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
  onStartNewExam
}) => {
  const [selectedProcess, setSelectedProcess] = useState<string>(''); // '' = Todos los procesos
  const [mixedCount, setMixedCount] = useState<number>(Math.min(10, questions.length));
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToPrint, setExamToPrint] = useState<SavedExam | null>(null);
  const [groupByWeeks, setGroupByWeeks] = useState<boolean>(true);

  // Conteo de preguntas en esta materia por cada proceso de admisión
  const processStats = useMemo(() => {
    const stats: Record<string, number> = {};
    ADMISSION_PROCESSES.forEach(p => {
      stats[p] = 0;
    });
    questions.forEach(q => {
      const p = getQuestionProcess(q);
      stats[p] = (stats[p] || 0) + 1;
    });
    return stats;
  }, [questions]);

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
    if (!result || (!result.timesPracticed && !result.total)) {
      return "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800";
    }

    const { score, total } = result;
    if (total === 0) return "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800";

    // Verde: Puntaje perfecto
    if (score === total) {
      return "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-sm";
    }
    // Rojo: Inferior al 50% de aciertos
    if (score < total / 2) {
      return "bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80 shadow-sm";
    }
    // Amarillo / Ámbar: Aprobado (>= 50% y < 100%)
    return "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-sm";
  };

  const renderPracticeBadge = (topicName: string) => {
    const res = results[`${subjectName}|${topicName}`];
    const timesPracticed = res?.timesPracticed ?? (res && res.total > 0 ? 1 : 0);

    if (timesPracticed === 0 || !res || res.total === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
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
          <span>🔥</span>
          <span>{timesPracticed} {timesPracticed === 1 ? 'práctica' : 'prácticas'}</span>
        </span>

        {/* Fracción de aciertos */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${scoreBadgeStyle}`}>
          <span>{score}/{total}</span>
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs">Materia</span>
            {courseName && (
              <span className="text-gray-400 text-xs">• {courseName}</span>
            )}
            {selectedProcess && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getProcessBadgeStyle(selectedProcess).bg} ${getProcessBadgeStyle(selectedProcess).text} border ${getProcessBadgeStyle(selectedProcess).border}`}>
                {selectedProcess.replace(' 2027', '')}
              </span>
            )}
          </div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 mt-1">{subjectName}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {filteredQuestions.length} preguntas disponibles {selectedProcess ? `en ${selectedProcess}` : 'en total (3 en 1)'} distribuidas en {topics.length} temas
          </p>
        </div>

        {topics.length > 0 && (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold shrink-0">
            <button 
              onClick={() => setGroupByWeeks(true)}
              className={`px-3 py-1.5 rounded-lg transition-all ${groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              Por Semanas
            </button>
            <button 
              onClick={() => setGroupByWeeks(false)}
              className={`px-3 py-1.5 rounded-lg transition-all ${!groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              Lista Completa
            </button>
          </div>
        )}
      </div>

      {/* Selector de Proceso de Admisión (Ceprunsa I, Ceprequintos, Ceprunsa II, Todos) */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1.5">
            <span>🏛️</span>
            <span>Filtrar por Proceso de Admisión 2027:</span>
          </label>
          {selectedProcess && (
            <button
              onClick={() => setSelectedProcess('')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>✕</span>
              <span>Ver todos los procesos</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setSelectedProcess('')}
            className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedProcess === ''
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-gray-200/60 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1">
              <span>🌐</span>
              <span>Todos (3 en 1)</span>
            </div>
            <span className={`text-[10px] font-bold ${selectedProcess === '' ? 'text-indigo-200' : 'text-gray-400'}`}>
              {questions.length} preg.
            </span>
          </button>

          {ADMISSION_PROCESSES.map(proc => {
            const isSelected = selectedProcess === proc;
            const style = getProcessBadgeStyle(proc);
            const count = processStats[proc] || 0;

            return (
              <button
                key={proc}
                type="button"
                onClick={() => setSelectedProcess(isSelected ? '' : proc)}
                className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? `${style.bg} ${style.text} ${style.border} border-2 shadow-md`
                    : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 hover:border-indigo-300 border border-gray-200/60 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 truncate max-w-full">
                  <span>{style.icon}</span>
                  <span className="truncate">{proc.replace(' 2027', '')}</span>
                </div>
                <span className={`text-[10px] font-bold ${isSelected ? style.text : count > 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {count} preg.
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exámenes Registrados y Resueltos Section */}
      {(subjectName === 'Exámenes Simulacros' || courseName === 'Exámenes') && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-lg">📝</span>
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
                <span>🚀</span>
                <span>Generar Nuevo Simulacro</span>
              </button>
            )}
          </div>

          {(!savedExams || savedExams.length === 0) ? (
            <div className="text-center py-10 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8">
              <div className="text-4xl mb-3">📂</div>
              <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">Aún no hay exámenes registrados</h4>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-md mx-auto mb-4">
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
                
                let scoreBadgeClass = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                if (isSolved) {
                  if (percentage >= 70) scoreBadgeClass = "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                  else if (percentage < 50) scoreBadgeClass = "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
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
                    className="bg-gray-50 dark:bg-slate-800/70 border border-gray-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 tracking-wider">
                            {exam.mode === 'CUSTOM' ? 'Personalizado' : 'Simulacro General'}
                          </span>
                          {exam.selectedExamWeeks && exam.selectedExamWeeks.length > 0 && (
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 tracking-wider">
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
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 tracking-wider">
                          {exam.area}
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">
                        {exam.title}
                      </h4>

                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
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
                          <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider">Estado</span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">Pendiente de resolver</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200/60 dark:border-slate-700/60 mt-2">
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
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                        title="Imprimir o Exportar a PDF"
                      >
                        <span>🖨️</span>
                        <span>PDF</span>
                      </button>

                      {onDeleteSavedExam && (
                        <button
                          onClick={() => setExamToDelete(exam.id)}
                          className="p-2.5 text-rose-500 hover:bg-rose-100/60 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
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
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-100">Examen Mixto</h3>
              {renderPracticeBadge("Examen Mixto")}
            </div>
            <p className="text-indigo-700/70 dark:text-indigo-300/70 text-xs">
              Genera un examen aleatorio combinando preguntas de todos los temas de {subjectName}.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto shrink-0">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-[10px] font-black text-indigo-800 dark:text-indigo-300 mb-1 uppercase tracking-wider">Cantidad</label>
              <input 
                type="number" 
                min="1" 
                max={questions.length}
                value={mixedCount}
                onChange={(e) => setMixedCount(parseInt(e.target.value) || 1)}
                className="w-full sm:w-24 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-center"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-5 w-full sm:w-auto">
              <button 
                onClick={() => handleStartMixed('CLASSIC')}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                title="Examen Mixto Clásico"
              >
                <span>📋</span> Examen Clásico
              </button>
              <button 
                onClick={() => handleStartMixed('QUIZZIZ')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                title="Modo Juego Practix con tiempo y comodines"
              >
                <span>🎮</span> Jugar Practix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic List */}
      {topics.length === 0 ? (
        <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">
            No hay temas registrados aún
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-md mx-auto">
            Ve al Panel de Admin para crear la primera práctica.
          </p>
        </div>
      ) : groupByWeeks ? (
        <div className="space-y-10 animate-fade-in">
          {topicsByWeek.map(([weekName, weekTopics]) => (
            <div key={weekName} className="space-y-4">
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

                  return (
                    <div 
                      key={topic.name}
                      className={`rounded-2xl border p-5 flex flex-col md:flex-row items-center gap-4 md:gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name)}`}
                    >
                      {/* Topic Number */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border border-indigo-100 dark:border-indigo-800">
                        {topic.order === 999 ? '?' : topic.order}
                      </div>

                      {/* Topic Info & Practice Badge */}
                      <div className="flex-grow text-center md:text-left space-y-1.5">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                          <h4 className="text-lg font-black text-gray-800 dark:text-gray-100">{topic.name}</h4>
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
                                    {style.icon} {proc.replace(' 2027', '')}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-400 dark:text-gray-500">
                          <span>{topic.count} preguntas en este banco</span>
                          {topic.week !== undefined && topic.week !== null && (
                            <span>• Semana {topic.week}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                        <div className="flex border dark:border-slate-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-slate-800/50">
                          <button 
                            onClick={() => onMoveTopic(topic.name, 'UP')}
                            disabled={globalIndex === 0}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                            title="Mover Arriba"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => onMoveTopic(topic.name, 'DOWN')}
                            disabled={globalIndex === topics.length - 1}
                            className="p-2 border-l dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                            title="Mover Abajo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>

                        <button 
                          onClick={() => onSelectTopic(topic.name, 'CLASSIC', selectedProcess || undefined)}
                          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                          title="Práctica estándar de preguntas"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Examen Clásico</span>
                        </button>

                        <button 
                          onClick={() => onSelectTopic(topic.name, 'QUIZZIZ', selectedProcess || undefined)}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                          title="Modo Juego Practix con tiempo y comodines"
                        >
                          <span>🎮</span>
                          <span>Jugar Practix</span>
                        </button>

                        <button 
                          onClick={() => setTopicToDelete(topic.name)}
                          className="p-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                          title="Eliminar Práctica"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, index) => {
            return (
              <div 
                key={topic.name}
                className={`rounded-2xl border p-5 flex flex-col md:flex-row items-center gap-4 md:gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name)}`}
              >
                {/* Topic Number */}
                <div className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border border-indigo-100 dark:border-indigo-800">
                  {topic.order === 999 ? '?' : topic.order}
                </div>

                {/* Topic Info & Practice Badge */}
                <div className="flex-grow text-center md:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h4 className="text-lg font-black text-gray-800 dark:text-gray-100">{topic.name}</h4>
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
                              {style.icon} {proc.replace(' 2027', '')}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>{topic.count} preguntas en este banco</span>
                    {topic.week !== undefined && topic.week !== null && (
                      <span>• Semana {topic.week}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                  <div className="flex border dark:border-slate-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-slate-800/50">
                    <button 
                      onClick={() => onMoveTopic(topic.name, 'UP')}
                      disabled={index === 0}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                      title="Mover Arriba"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => onMoveTopic(topic.name, 'DOWN')}
                      disabled={index === topics.length - 1}
                      className="p-2 border-l dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                      title="Mover Abajo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <button 
                    onClick={() => onSelectTopic(topic.name, 'CLASSIC', selectedProcess || undefined)}
                    className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                    title="Práctica estándar de preguntas"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Examen Clásico</span>
                  </button>

                  <button 
                    onClick={() => onSelectTopic(topic.name, 'QUIZZIZ', selectedProcess || undefined)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                    title="Modo Juego Practix con tiempo y comodines"
                  >
                    <span>🎮</span>
                    <span>Jugar Practix</span>
                  </button>

                  <button 
                    onClick={() => setTopicToDelete(topic.name)}
                    className="p-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                    title="Eliminar Práctica"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Topic Modal */}
      {topicToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Práctica</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Seguro que deseas eliminar la práctica <span className="font-bold text-gray-800 dark:text-gray-200">"{topicToDelete}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTopicToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteTopic(topicToDelete);
                  setTopicToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Examen Registrado</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              ¿Seguro que deseas eliminar este examen del historial registrado? Esta acción no afectará tu puntaje general.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExamToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs"
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
          allQuestions={questions}
          readingTexts={readingTexts}
          onClose={() => setExamToPrint(null)}
        />
      )}
    </div>
  );
};

export default TopicsView;
