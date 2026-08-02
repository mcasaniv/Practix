
import React, { useMemo, useState } from 'react';
import { Question, TopicResult, ReadingText, SavedExam } from '../types';
import { PrintExamModal } from '../components/PrintExamModal';

interface TopicsViewProps {
  subjectName: string;
  courseName?: string;
  questions: Question[];
  readingTexts: ReadingText[];
  results: Record<string, TopicResult>;
  savedExams?: SavedExam[];
  onSelectTopic: (topic: string, mode?: 'CLASSIC' | 'QUIZZIZ') => void;
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
  readingTexts,
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
  const [mixedCount, setMixedCount] = useState<number>(Math.min(10, questions.length));
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToPrint, setExamToPrint] = useState<SavedExam | null>(null);
  const [groupByWeeks, setGroupByWeeks] = useState<boolean>(true);

  const handleStartMixed = (mode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    if (questions.length === 0) return;
    const count = Math.min(Math.max(1, mixedCount), questions.length);
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    onStartMixedQuiz(shuffled.slice(0, count), mode);
  };
  const topics = useMemo(() => {
    const grouped = questions.reduce((acc, q) => {
      if (!acc[q.topic]) {
        acc[q.topic] = {
          name: q.topic,
          count: 0,
          order: q.order ?? 999,
          week: q.week
        };
      }
      acc[q.topic].count++;
      if (q.week !== undefined && acc[q.topic].week === undefined) {
        acc[q.topic].week = q.week;
      }
      return acc;
    }, {} as Record<string, { name: string, count: number, order: number, week?: number }>);

    return (Object.values(grouped) as { name: string; count: number; order: number; week?: number }[])
      .sort((a, b) => a.order - b.order);
  }, [questions]);

  const topicsByWeek = useMemo(() => {
    const weeksMap: Record<string, { name: string; count: number; order: number; week?: number }[]> = {};
    
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
    if (!result) return "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800";

    const { score, total } = result;
    
    // Verde: Perfecto
    if (score === total) {
      return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
    }
    
    // Rojo: Menos de la mitad
    if (score < total / 2) {
      return "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
    }
    
    // Amarillo: No perfecto pero más de la mitad
    return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  };

  const getTopicBadge = (topicName: string) => {
    const result = results[`${subjectName}|${topicName}`];
    if (!result) return null;

    const { score, total } = result;
    let textColor = "text-amber-600 dark:text-amber-400";
    if (score === total) textColor = "text-emerald-600 dark:text-emerald-400";
    if (score < total / 2) textColor = "text-rose-600 dark:text-rose-400";

    return (
      <span className={`text-[10px] font-black uppercase tracking-tighter ${textColor}`}>
        Último: {score}/{total}
      </span>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b dark:border-slate-800 pb-4 gap-4 animate-fade-in">
        <div>
          <p className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs mb-1">Materia</p>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{subjectName}</h2>
        </div>
        <div className="flex items-center gap-4 self-end shrink-0">
          {topics.length > 0 && (
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner border border-gray-150 dark:border-slate-800">
              <button 
                onClick={() => setGroupByWeeks(true)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                Por Semanas
              </button>
              <button 
                onClick={() => setGroupByWeeks(false)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${!groupByWeeks ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                Temas
              </button>
            </div>
          )}
          <div className="text-right text-gray-400 dark:text-gray-500 text-sm hidden sm:block">
            {topics.length} temas registrados
          </div>
        </div>
      </div>

      {/* Exámenes Registrados y Resueltos Section */}
      {(subjectName === 'Exámenes Simulacros' || courseName === 'Exámenes') && (
        <div className="mb-10 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
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
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 tracking-wider">
                          {exam.mode === 'CUSTOM' ? 'Personalizado' : 'Simulacro General'}
                        </span>
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

      {questions.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">Examen Mixto</h3>
              {getTopicBadge("Examen Mixto")}
            </div>
            <p className="text-indigo-700/70 dark:text-indigo-300/70 text-sm">Mezcla preguntas de todos los temas de esta materia.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1 uppercase tracking-wider">Cantidad</label>
              <input 
                type="number" 
                min="1" 
                max={questions.length}
                value={mixedCount}
                onChange={(e) => setMixedCount(parseInt(e.target.value) || 1)}
                className="w-full sm:w-24 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-5 w-full sm:w-auto">
              <button 
                onClick={() => handleStartMixed('CLASSIC')}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                title="Examen Mixto Clásico"
              >
                <span>📋</span> Examen Clásico
              </button>
              <button 
                onClick={() => handleStartMixed('QUIZZIZ')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg text-xs font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                title="Modo Juego Practix con tiempo y comodines"
              >
                <span>🎮</span> Jugar Practix
              </button>
            </div>
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No hay temas registrados aún</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Ve al Panel de Admin para crear la primera práctica.</p>
        </div>
      ) : groupByWeeks ? (
        <div className="space-y-10 animate-fade-in">
          {topicsByWeek.map(([weekName, weekTopics]) => (
            <div key={weekName} className="space-y-4">
              <h3 className="text-sm font-extrabold text-indigo-600 dark:text-indigo-455 uppercase tracking-widest flex items-center gap-2 border-b-2 border-indigo-50 dark:border-indigo-950/30 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                {weekName}
              </h3>
              <div className="space-y-4">
                {weekTopics.map((topic) => {
                  const globalIndex = topics.findIndex(t => t.name === topic.name);
                  return (
                    <div 
                      key={topic.name}
                      className={`rounded-xl shadow-sm border p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name)}`}
                    >
                      <div className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg shrink-0">
                        {topic.order === 999 ? '?' : topic.order}
                      </div>

                      <div className="flex-grow text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-0.5">
                          <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">{topic.name}</h4>
                          {getTopicBadge(topic.name)}
                        </div>
                        <p className="text-gray-400 dark:text-gray-500 text-sm">{topic.count} preguntas en este banco</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                        <div className="flex border dark:border-slate-800 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-slate-800/50">
                          <button 
                            onClick={() => onMoveTopic(topic.name, 'UP')}
                            disabled={globalIndex === 0}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                            title="Mover Arriba"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => onMoveTopic(topic.name, 'DOWN')}
                            disabled={globalIndex === topics.length - 1}
                            className="p-2 border-l dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                            title="Mover Abajo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>

                        <button 
                          onClick={() => onSelectTopic(topic.name, 'CLASSIC')}
                          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                          title="Práctica estándar de preguntas"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Examen Clásico
                        </button>

                        <button 
                          onClick={() => onSelectTopic(topic.name, 'QUIZZIZ')}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                          title="Modo Juego Practix con tiempo y comodines"
                        >
                          <span>🎮</span>
                          <span>Jugar Practix</span>
                        </button>

                        <button 
                          onClick={() => setTopicToDelete(topic.name)}
                          className="p-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="Eliminar Práctica"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <div 
              key={topic.name}
              className={`rounded-xl shadow-sm border p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-all ${getTopicColorClasses(topic.name)}`}
            >
              <div className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg shrink-0">
                {topic.order === 999 ? '?' : topic.order}
              </div>

              <div className="flex-grow text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-0.5">
                  <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">{topic.name}</h4>
                  {getTopicBadge(topic.name)}
                </div>
                <p className="text-gray-400 dark:text-gray-500 text-sm">{topic.count} preguntas en este banco</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                <div className="flex border dark:border-slate-800 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-slate-800/50">
                  <button 
                    onClick={() => onMoveTopic(topic.name, 'UP')}
                    disabled={index === 0}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                    title="Mover Arriba"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => onMoveTopic(topic.name, 'DOWN')}
                    disabled={index === topics.length - 1}
                    className="p-2 border-l dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:text-gray-400"
                    title="Mover Abajo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <button 
                  onClick={() => onSelectTopic(topic.name, 'CLASSIC')}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                  title="Práctica estándar de preguntas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Examen Clásico
                </button>

                <button 
                  onClick={() => onSelectTopic(topic.name, 'QUIZZIZ')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                  title="Modo Juego Practix con tiempo y comodines"
                >
                  <span>🎮</span>
                  <span>Jugar Practix</span>
                </button>

                <button 
                  onClick={() => setTopicToDelete(topic.name)}
                  className="p-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                  title="Eliminar Práctica"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
