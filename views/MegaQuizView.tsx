
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, ExamMode } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';

interface MegaQuizViewProps {
  questions: Question[];
  readingTexts: ReadingText[];
  onFinishMega: (total: number) => void;
  mode?: ExamMode;
  selectedExamSubjects?: string[];
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
}

const MegaQuizView: React.FC<MegaQuizViewProps> = ({ 
  questions, 
  readingTexts, 
  onFinishMega, 
  mode = 'GENERAL',
  selectedExamSubjects,
  selectedArea,
  onSetSelectedArea
}) => {
  const [step, setStep] = useState<'WELCOME' | 'QUIZ' | 'FINISHED'>('WELCOME');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [resolutionIndex, setResolutionIndex] = useState(0); // For sequential view after exam
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedQuestions = useMemo(() => {
    const finalSelection: { question: Question; weight: number; category: string; readingText?: ReadingText }[] = [];
    
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];

    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    Object.entries(configToUse).forEach(([categoryName, config]) => {
      if (categoryName === 'Comprensión Lectora') {
        const pool = questions.filter(q => q.subject === 'Comprensión Lectora' && q.readingTextId);
        const groupedByText: Record<string, Question[]> = {};
         
        pool.forEach(q => {
          if (q.readingTextId) {
            if (!groupedByText[q.readingTextId]) groupedByText[q.readingTextId] = [];
            groupedByText[q.readingTextId].push(q);
          }
        });

        const textIds = Object.keys(groupedByText).sort(() => 0.5 - Math.random());
        
        if (textIds[0]) {
          const text1 = readingTexts.find(t => t.id === textIds[0]);
          const qs1 = [...groupedByText[textIds[0]]].sort(() => 0.5 - Math.random()).slice(0, 3);
          qs1.forEach(q => finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text1 }));
        }

        if (textIds[1]) {
          const text2 = readingTexts.find(t => t.id === textIds[1]);
          const qs2 = [...groupedByText[textIds[1]]].sort(() => 0.5 - Math.random()).slice(0, 2);
          qs2.forEach(q => finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text2 }));
        }
      } else if (categoryName === 'Inglés Lectura') {
        const pool = questions.filter(q => q.subject === 'Inglés Lectura' && q.readingTextId);
        const groupedByText: Record<string, Question[]> = {};
        
        pool.forEach(q => {
          if (q.readingTextId) {
            if (!groupedByText[q.readingTextId]) groupedByText[q.readingTextId] = [];
            groupedByText[q.readingTextId].push(q);
          }
        });

        const textIds = Object.keys(groupedByText).sort(() => 0.5 - Math.random());
        
        if (textIds[0]) {
          const text1 = readingTexts.find(t => t.id === textIds[0]);
          const qs1 = [...groupedByText[textIds[0]]].sort(() => 0.5 - Math.random()).slice(0, 2);
          qs1.forEach(q => finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text1 }));
        }
      } else {
        const pool = questions.filter(q => config.subjects.includes(q.subject));
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, config.count);
        selected.forEach(q => finalSelection.push({ question: q, weight: config.weight, category: categoryName }));
      }
    });

    // Grouping by category first, then by subject (materia) within each category, and by reading text if applicable to make sure questions of the same materia and text stay together
    return finalSelection.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      if (a.question.subject !== b.question.subject) {
        return a.question.subject.localeCompare(b.question.subject);
      }
      const textIdA = a.readingText?.id || '';
      const textIdB = b.readingText?.id || '';
      return textIdA.localeCompare(textIdB);
    });
  }, [questions, readingTexts, selectedExamSubjects, selectedArea]);

  const INITIAL_TIME = useMemo(() => {
    if (mode === 'GENERAL') return 9000;
    // For custom mode, give ~1.875 minutes per question (same ratio as 80/9000)
    return Math.max(selectedQuestions.length * 112.5, 300); // Min 5 minutes
  }, [mode, selectedQuestions.length]);

  const maxPossibleScore = useMemo(() => {
    return selectedQuestions.reduce((acc, curr) => acc + curr.weight, 0);
  }, [selectedQuestions]);

  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);

  useEffect(() => {
    setTimeLeft(INITIAL_TIME);
  }, [INITIAL_TIME]);

  useEffect(() => {
    if (step !== 'QUIZ') return;
    if (timeLeft <= 0) { handleFinalize(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, step]);

  // KaTeX rendering effect
  useEffect(() => {
    const renderMath = () => {
      if (containerRef.current && (window as any).renderMathInElement) {
        (window as any).renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    };
    
    renderMath();
    const timeout = setTimeout(renderMath, 150); // Small delay for DOM updates
    return () => clearTimeout(timeout);
  }, [step, answers, resolutionIndex]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelect = (qId: string, optIndex: number) => {
    if (step === 'FINISHED') return;
    setAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const handleFinalize = () => {
    if (step === 'FINISHED') return;
    setStep('FINISHED');
    setResolutionIndex(0); // Reset resolution index
    onFinishMega(selectedQuestions.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calculateDetailedResults = () => {
    const categoryBreakdown: Record<string, { correct: number; total: number; points: number; maxPoints: number }> = {};
    const topicBreakdown: Record<string, { correct: number; total: number }> = {};
    let totalScore = 0;

    selectedQuestions.forEach(item => {
      // Category stats
      if (!categoryBreakdown[item.category]) categoryBreakdown[item.category] = { correct: 0, total: 0, points: 0, maxPoints: 0 };
      categoryBreakdown[item.category].total += 1;
      categoryBreakdown[item.category].maxPoints += item.weight;

      // Topic stats
      const tKey = `${item.question.subject} - ${item.question.topic}`;
      if (!topicBreakdown[tKey]) topicBreakdown[tKey] = { correct: 0, total: 0 };
      topicBreakdown[tKey].total += 1;

      if (answers[item.question.id] === item.question.correctIndex) {
        categoryBreakdown[item.category].correct += 1;
        categoryBreakdown[item.category].points += item.weight;
        topicBreakdown[tKey].correct += 1;
        totalScore += item.weight;
      }
    });

    const topicStats = Object.entries(topicBreakdown).map(([name, stats]) => ({
      name,
      percentage: (stats.correct / stats.total) * 100,
      ...stats
    })).sort((a, b) => b.percentage - a.percentage);

    const bestTopics = topicStats.filter(t => t.percentage >= 70);
    const weakTopics = topicStats.filter(t => t.percentage < 70).reverse();

    return { totalScore, categoryBreakdown, topicStats, bestTopics, weakTopics };
  };

  const results = useMemo(() => calculateDetailedResults(), [step, answers, selectedQuestions]);

  if (selectedQuestions.length === 0) {
    return <div className="max-w-2xl mx-auto py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-xl">⚠️ No hay preguntas suficientes.</div>;
  }

  if (step === 'WELCOME') {
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 mb-4 tracking-tight">
              {mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General 80'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Este examen consta de <span className="text-indigo-600 font-black">{selectedQuestions.length}</span> preguntas seleccionadas por áreas.</p>
          </div>

          {/* Selector de Área */}
          <div className="flex flex-col items-center mb-8 max-w-sm mx-auto">
            <label className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2.5">
              Área Académica Seleccionada:
            </label>
            <div className="grid grid-cols-3 gap-1.5 w-full bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-850">
              {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
                const isActive = selectedArea === area;
                return (
                  <button
                    key={area}
                    onClick={() => onSetSelectedArea(area)}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-450'
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 mb-10">
            <table className="w-full text-left border-collapse font-sans text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Área / Curso</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Preguntas</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Peso Unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {Object.entries(configToUse).map(([category, config]) => (
                  <tr key={category} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-bold text-gray-700 dark:text-gray-200">{category}</td>
                    <td className="p-4 font-mono font-black text-indigo-600 dark:text-indigo-400 text-center">{config.count}</td>
                    <td className="p-4 font-mono text-gray-400 text-right">{config.weight.toFixed(4)}</td>
                  </tr>
                ))}
                <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                  <td className="p-4 font-black text-indigo-700 dark:text-indigo-300">TOTAL ESTIMADO</td>
                  <td className="p-4 font-mono font-black text-indigo-700 dark:text-indigo-300 text-center">{selectedQuestions.length}</td>
                  <td className="p-4 font-mono font-black text-indigo-700 dark:text-indigo-300 text-right">{maxPossibleScore.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button 
            onClick={() => setStep('QUIZ')}
            className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-4"
          >
            <span>🚀 Comenzar Examen</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Resolution UI Helpers
  const isShowStats = resolutionIndex === selectedQuestions.length;
  const resolutionItem = !isShowStats ? selectedQuestions[resolutionIndex] : null;
  const isLastResolution = resolutionIndex === selectedQuestions.length;

  const nextResolutionQuestion = () => {
    if (resolutionIndex < selectedQuestions.length) {
      setResolutionIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevResolutionQuestion = () => {
    if (resolutionIndex > 0) {
      setResolutionIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto" ref={containerRef}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight flex items-center flex-wrap gap-2.5">
            <span>{mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'}</span>
            <span className="text-xs shrink-0 font-black tracking-wider uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/10">
              {selectedArea}
            </span>
          </h2>
          {step === 'QUIZ' && (
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-400 text-sm">Tiempo restante: {formatTime(timeLeft)}</p>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
              <p className="text-indigo-600 font-bold text-sm">{selectedQuestions.length} preguntas en total</p>
            </div>
          )}
        </div>
        {step === 'QUIZ' ? (
          <button onClick={handleFinalize} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-black hover:bg-rose-600 shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest">Forzar Finalizar</button>
        ) : (
          <div className="text-center px-8 py-3 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl">
            <span className="text-[10px] uppercase font-black text-indigo-400 block tracking-widest">Puntaje Total</span>
            <span className="text-4xl font-black text-indigo-700 dark:text-indigo-200">{results.totalScore.toFixed(4)} / {maxPossibleScore.toFixed(4)}</span>
          </div>
        )}
      </div>

      {step === 'FINISHED' && isShowStats && (
        <div className="space-y-12 mb-12 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <span className="bg-indigo-600 text-white p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Estadísticas Detalladas por Área
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-sm">
                <thead>
                  <tr className="bg-gray-50/30 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 uppercase tracking-widest text-[10px] font-black text-gray-400">
                    <th className="p-6">Curso / Área</th>
                    <th className="p-6 text-center">Correctas</th>
                    <th className="p-6 text-center text-rose-500">Errores</th>
                    <th className="p-6 text-center">Total</th>
                    <th className="p-6 text-right">Puntaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {Object.entries(results.categoryBreakdown).map(([cat, stats]) => (
                    <tr key={cat} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-6">
                        <div className="font-black text-gray-700 dark:text-gray-200">{cat}</div>
                        <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-1000" 
                            style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg font-black">{stats.correct}</span>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-lg font-black ${stats.total - stats.correct > 0 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'text-gray-300'}`}>
                          {stats.total - stats.correct}
                        </span>
                      </td>
                      <td className="p-6 text-center font-bold text-gray-400">{stats.total}</td>
                      <td className="p-6 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {stats.points.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${results.bestTopics.length > 0 && results.weakTopics.length > 0 ? 'md:grid-cols-2' : ''} gap-6`}>
            {results.bestTopics.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex flex-col h-full">
                <h3 className="text-emerald-800 dark:text-emerald-300 font-black text-lg mb-6 flex items-center gap-2 shrink-0">
                  <span className="text-2xl">🏆</span> Mejores Temas
                </h3>
                <div className="space-y-4">
                  {results.bestTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20 shadow-sm shadow-emerald-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{t.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {results.weakTopics.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-900/10 p-8 rounded-3xl border border-rose-100 dark:border-rose-900/30 shadow-sm flex flex-col h-full">
                <h3 className="text-rose-800 dark:text-rose-300 font-black text-lg mb-6 flex items-center gap-2 shrink-0">
                  <span className="text-2xl">📉</span> Temas a Reforzar
                </h3>
                <div className="space-y-4">
                  {results.weakTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-rose-100 dark:border-rose-900/20 shadow-sm shadow-rose-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-rose-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{t.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-center p-8">
            <button 
              onClick={() => {
                setResolutionIndex(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-12 py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-800 transition-all shadow-xl"
            >
              Reiniciar Resolución
            </button>
          </div>
        </div>
      )}

      {step === 'QUIZ' ? (
        <div className="space-y-12 pb-32">
          {selectedQuestions.map((item, idx) => (
            <div key={item.question.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-fade-in">
              {item.readingText && (idx === 0 || selectedQuestions[idx - 1].readingText?.id !== item.readingText.id) && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border-l-8 border-amber-400 p-8 md:p-12 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-widest">
                    <span>📖</span> TEXTO DE {item.readingText.subject.toUpperCase()}
                  </div>
                  <h4 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 font-serif">{item.readingText.title}</h4>
                  <div className="text-gray-700 dark:text-gray-200 leading-relaxed font-serif whitespace-pre-wrap text-xl italic bg-white/40 dark:bg-slate-900/40 p-6 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    {item.readingText.content}
                  </div>
                </div>
              )}

              {item.readingText && idx > 0 && selectedQuestions[idx - 1].readingText?.id === item.readingText.id && (
                <div className="bg-amber-50/30 dark:bg-amber-950/20 border-l-4 border-amber-400 px-8 py-3.5 text-xs text-amber-800 dark:text-amber-300 font-bold border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                  <span>📖</span> Referente a la lectura anterior: <span className="underline italic">{item.readingText.title}</span>
                </div>
              )}

              <div className="p-8 md:p-12">
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <span className="bg-gray-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0">{idx + 1}</span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">{item.category}</span>
                  <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    {item.question.subject}: {item.question.topic}
                  </span>
                </div>

                {item.question.imageUrl && (
                  <div className="mb-8 rounded-3xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <img src={item.question.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[400px] object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}

                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-10 whitespace-pre-wrap">{item.question.questionText}</p>

                <div className="grid grid-cols-1 gap-4">
                  {item.question.options.map((opt, optIdx) => {
                    const isSelected = answers[item.question.id] === optIdx;
                    return (
                      <button
                        id={`q-${item.question.id}-opt-${optIdx}`}
                        key={optIdx}
                        onClick={() => handleSelect(item.question.id, optIdx)}
                        className={`flex items-center gap-6 p-6 rounded-2xl border-2 text-left transition-all group ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-100 dark:shadow-none' 
                            : 'border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all shrink-0 ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 dark:border-slate-700 text-gray-400'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <span className={`text-lg font-bold transition-all ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-400'}`}>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex justify-center p-8">
            <button 
              onClick={handleFinalize}
              className="bg-indigo-600 text-white px-16 py-6 rounded-3xl font-black text-xl uppercase tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
            >
              Finalizar y Ver Resultados
            </button>
          </div>
        </div>
      ) : !isShowStats ? (
        <div className="space-y-12 pb-20 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 p-4 mb-4 flex items-center justify-between shadow-sm">
            <h3 className="font-black text-indigo-600 uppercase tracking-widest text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Resolución de Examen
            </h3>
            <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black px-4 py-1 rounded-full text-xs uppercase tracking-widest">
              Pregunta {resolutionIndex + 1} de {selectedQuestions.length}
            </span>
          </div>

          {resolutionItem?.readingText && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border-l-8 border-amber-400 rounded-r-3xl p-8 md:p-12 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-widest">
                <span>📖</span> TEXTO DE {resolutionItem.readingText.subject.toUpperCase()}
              </div>
              <h4 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 font-serif">{resolutionItem.readingText.title}</h4>
              <div className="text-gray-700 dark:text-gray-200 leading-relaxed font-serif whitespace-pre-wrap text-xl italic bg-white/40 dark:bg-slate-900/40 p-6 rounded-xl border border-amber-100 dark:border-amber-900/30">
                {resolutionItem.readingText.content}
              </div>
            </div>
          )}

          {resolutionItem && (() => {
            const q = resolutionItem.question;
            const selected = answers[q.id];
            const isCorrect = selected === q.correctIndex;
            
            return (
              <div key={q.id} className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 ${isCorrect ? 'border-emerald-200 shadow-emerald-50 dark:border-emerald-800' : 'border-rose-200 shadow-rose-50 dark:border-rose-800'}`}>
                <div className="p-6 md:p-10">
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="bg-gray-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0">{resolutionIndex + 1}</span>
                    <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase">{resolutionItem.category}</span>
                    <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      {q.subject}: {q.topic}
                    </span>
                  </div>
                  
                  {q.imageUrl && (
                    <div className="mb-8 rounded-3xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                      <img src={q.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[400px] object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-8">{q.questionText}</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isUserSelection = selected === optIdx;
                      const isCorrectAnswer = optIdx === q.correctIndex;
                      let bgColor = "bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-40";
                      if (isCorrectAnswer) bgColor = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500";
                      else if (isUserSelection) bgColor = "bg-rose-50 dark:bg-rose-900/30 border-rose-500 ring-2 ring-rose-500";

                      return (
                        <div key={optIdx} className={`text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${bgColor}`}>
                          <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black ${isUserSelection ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-gray-400'}`}>{String.fromCharCode(65 + optIdx)}</div>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-8 bg-indigo-50/30 dark:bg-indigo-900/20 p-6 rounded-2xl border dark:border-indigo-900/30">
                    <p className="text-indigo-900 dark:text-indigo-200 font-bold mb-2 uppercase tracking-widest text-xs">Respuesta Correcta:</p>
                    <p className="text-gray-800 dark:text-gray-100 font-bold text-lg mb-4">{q.options[q.correctIndex]}</p>
                    <div className="h-px bg-indigo-100 dark:bg-indigo-800 mb-4"></div>
                    <p className="text-indigo-900 dark:text-indigo-200 font-bold mb-2 uppercase tracking-widest text-xs">Explicación:</p>
                    <div className="text-gray-500 dark:text-gray-400 italic text-sm whitespace-pre-wrap leading-relaxed">{q.explanation}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between gap-4 py-4 sticky bottom-8 z-30">
            <button 
              onClick={prevResolutionQuestion}
              disabled={resolutionIndex === 0}
              className={`px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all ${
                resolutionIndex === 0 ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
              }`}
            >
              Anterior
            </button>
            <button 
              onClick={nextResolutionQuestion}
              className={`px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all min-w-[200px] bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl`}
            >
              {resolutionIndex === selectedQuestions.length - 1 ? 'Ver Estadísticas' : 'Siguiente Pregunta'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MegaQuizView;
