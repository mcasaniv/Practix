
import React, { useMemo, useState } from 'react';
import { Question, TopicResult, ReadingText } from '../types';

interface TopicsViewProps {
  subjectName: string;
  questions: Question[];
  readingTexts: ReadingText[];
  results: Record<string, TopicResult>;
  onSelectTopic: (topic: string) => void;
  onStartMixedQuiz: (questions: Question[]) => void;
  onDeleteTopic: (topic: string) => void;
  onMoveTopic: (topic: string, direction: 'UP' | 'DOWN') => void;
}

const TopicsView: React.FC<TopicsViewProps> = ({ 
  subjectName, 
  questions, 
  readingTexts,
  results,
  onSelectTopic, 
  onStartMixedQuiz,
  onDeleteTopic, 
  onMoveTopic 
}) => {
  const [mixedCount, setMixedCount] = useState<number>(Math.min(10, questions.length));
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [groupByWeeks, setGroupByWeeks] = useState<boolean>(true);

  const handleStartMixed = () => {
    if (questions.length === 0) return;
    const count = Math.min(Math.max(1, mixedCount), questions.length);
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    onStartMixedQuiz(shuffled.slice(0, count));
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

      {questions.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">Examen Mixto</h3>
              {getTopicBadge("Examen Mixto")}
            </div>
            <p className="text-indigo-700/70 dark:text-indigo-300/70 text-sm">Mezcla preguntas de todos los temas de esta materia.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1 uppercase tracking-wider">Cantidad</label>
              <input 
                type="number" 
                min="1" 
                max={questions.length}
                value={mixedCount}
                onChange={(e) => setMixedCount(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              onClick={handleStartMixed}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md mt-5 whitespace-nowrap"
            >
              Iniciar Mixto
            </button>
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
                          onClick={() => onSelectTopic(topic.name)}
                          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Iniciar Quiz
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
                  onClick={() => onSelectTopic(topic.name)}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Iniciar Quiz
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
    </div>
  );
};

export default TopicsView;
