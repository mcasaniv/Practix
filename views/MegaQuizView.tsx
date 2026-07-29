
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, ExamMode, TopicResult, SavedExam } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';
import { formatQuestionText, parseHTMLTags } from '../utils';
import { PrintExamModal } from '../components/PrintExamModal';

interface MegaQuizViewProps {
  questions: Question[];
  readingTexts: ReadingText[];
  results?: Record<string, TopicResult>;
  onFinishMega: (total: number) => void;
  mode?: ExamMode;
  selectedExamSubjects?: string[];
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  onBack: () => void;
  retakeExam?: SavedExam;
  isReviewMode?: boolean;
  onSaveExamResult?: (exam: SavedExam) => void;
}

const MegaQuizView: React.FC<MegaQuizViewProps> = ({ 
  questions, 
  readingTexts, 
  results = {},
  onFinishMega, 
  mode = 'GENERAL',
  selectedExamSubjects,
  selectedArea,
  onSetSelectedArea,
  onBack,
  retakeExam,
  isReviewMode = false,
  onSaveExamResult
}) => {
  const [step, setStep] = useState<'WELCOME' | 'QUIZ' | 'FINISHED'>(
    isReviewMode ? 'FINISHED' : 'WELCOME'
  );
  const [answers, setAnswers] = useState<Record<string, number>>(() => retakeExam?.userAnswers || {});
  const [resolutionIndex, setResolutionIndex] = useState(0); // For sequential view after exam
  const [showPrintModal, setShowPrintModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentExamIdRef = useRef<string>(retakeExam ? retakeExam.id : crypto.randomUUID());
  
  const [questionSource, setQuestionSource] = useState<'ALL' | 'PRACTICED'>('ALL');

  useEffect(() => {
    if (retakeExam?.area && (retakeExam.area === 'Biomédicas' || retakeExam.area === 'Ingenierías' || retakeExam.area === 'Sociales')) {
      onSetSelectedArea(retakeExam.area as any);
    }
  }, [retakeExam]);

  const questionPool = useMemo(() => {
    if (questionSource === 'PRACTICED') {
      return questions.filter(q => results && results[`${q.subject}|${q.topic}`] !== undefined);
    }
    return questions;
  }, [questions, results, questionSource]);

  const practicedQuestionsCount = useMemo(() => {
    return questions.filter(q => results && results[`${q.subject}|${q.topic}`] !== undefined).length;
  }, [questions, results]);

  const candidateQuestions = useMemo(() => {
    if (retakeExam && retakeExam.questionIds.length > 0) {
      const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
      const qMap = new Map(questionPool.map(q => [q.id, q]));
      const finalSelection: { question: Question; weight: number; category: string; readingText?: ReadingText }[] = [];

      retakeExam.questionIds.forEach(id => {
        const q = qMap.get(id);
        if (q) {
          let catName = q.subject;
          let weight = 1.25;
          for (const [cat, cfg] of Object.entries(activeAreaConfig)) {
            if (cfg.subjects.includes(q.subject) || cat === q.subject) {
              catName = cat;
              weight = cfg.weight;
              break;
            }
          }
          const readingText = q.readingTextId ? readingTexts.find(r => r.id === q.readingTextId) : undefined;
          finalSelection.push({ question: q, weight, category: catName, readingText });
        }
      });
      return finalSelection;
    }

    const finalSelection: { question: Question; weight: number; category: string; readingText?: ReadingText }[] = [];
    
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];

    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    Object.entries(configToUse).forEach(([categoryName, config]) => {
      if (categoryName === 'Comprensión Lectora') {
        const pool = questionPool.filter(q => q.subject === 'Comprensión Lectora' && q.readingTextId);
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
        const pool = questionPool.filter(q => q.subject === 'Inglés Lectura' && q.readingTextId);
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
        const pool = questionPool.filter(q => config.subjects.includes(q.subject));
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
  }, [questionPool, readingTexts, selectedExamSubjects, selectedArea, retakeExam]);

  const [activeQuestions, setActiveQuestions] = useState<{ question: Question; weight: number; category: string; readingText?: ReadingText }[]>([]);

  useEffect(() => {
    if (isReviewMode && candidateQuestions.length > 0) {
      setActiveQuestions(candidateQuestions);
      if (retakeExam?.userAnswers) {
        setAnswers(retakeExam.userAnswers);
      }
    }
  }, [isReviewMode, candidateQuestions, retakeExam]);

  const selectedQuestions = (step === 'WELCOME' || activeQuestions.length === 0) ? candidateQuestions : activeQuestions;

  const handleStartExam = () => {
    if (candidateQuestions.length === 0) return;
    const examQuestions = [...candidateQuestions];
    setActiveQuestions(examQuestions);
    setAnswers({});
    const duration = mode === 'GENERAL' ? 9000 : Math.max(examQuestions.length * 112.5, 300);
    setTimeLeft(duration);
    setStep('QUIZ');

    // Register initial exam record
    const examId = currentExamIdRef.current;
    const examRecord: SavedExam = {
      id: examId,
      title: retakeExam?.title || `${mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'} - ${selectedArea}`,
      course: 'Exámenes',
      subject: 'Exámenes Simulacros',
      area: selectedArea,
      mode: mode || 'GENERAL',
      questionIds: examQuestions.map(item => item.question.id),
      totalQuestions: examQuestions.length,
      createdAt: retakeExam?.createdAt || Date.now(),
      selectedExamSubjects: selectedExamSubjects,
      attemptsCount: (retakeExam?.attemptsCount || 0) + 1
    };
    if (onSaveExamResult) {
      onSaveExamResult(examRecord);
    }
  };

  const maxPossibleScore = useMemo(() => {
    return selectedQuestions.reduce((acc, curr) => acc + curr.weight, 0);
  }, [selectedQuestions]);

  const [timeLeft, setTimeLeft] = useState(9000);

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

    const resultsCalc = calculateDetailedResults();
    const examId = currentExamIdRef.current;
    const finalRecord: SavedExam = {
      id: examId,
      title: retakeExam?.title || `${mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'} - ${selectedArea}`,
      course: 'Exámenes',
      subject: 'Exámenes Simulacros',
      area: selectedArea,
      mode: mode || 'GENERAL',
      questionIds: selectedQuestions.map(item => item.question.id),
      totalQuestions: selectedQuestions.length,
      score: resultsCalc.totalScore,
      maxScore: maxPossibleScore,
      solvedAt: Date.now(),
      createdAt: retakeExam?.createdAt || Date.now(),
      selectedExamSubjects: selectedExamSubjects,
      attemptsCount: retakeExam?.attemptsCount ? retakeExam.attemptsCount + 1 : 1,
      userAnswers: answers
    };

    if (onSaveExamResult) {
      onSaveExamResult(finalRecord);
    }

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

  const detailedResults = useMemo(() => calculateDetailedResults(), [step, answers, selectedQuestions]);

  if (step !== 'WELCOME' && selectedQuestions.length === 0) {
    return <div className="max-w-2xl mx-auto py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-xl">⚠️ No hay preguntas suficientes.</div>;
  }

  if (step === 'WELCOME') {
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider mb-4 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Inicio
        </button>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 mb-4 tracking-tight">
              {mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General 80'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Este examen consta de <span className="text-indigo-600 font-black">{selectedQuestions.length}</span> preguntas seleccionadas por áreas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
            {/* Selector de Área */}
            <div className="flex flex-col items-center">
              <label className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2.5">
                Área Académica:
              </label>
              <div className="grid grid-cols-3 gap-1.5 w-full bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-850">
                {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
                  const isActive = selectedArea === area;
                  return (
                    <button
                      key={area}
                      onClick={() => onSetSelectedArea(area)}
                      className={`py-2 px-2 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${
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

            {/* Banco de Preguntas / Origen */}
            <div className="flex flex-col items-center">
              <label className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2.5">
                Banco de Preguntas:
              </label>
              <div className="grid grid-cols-2 gap-1.5 w-full bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setQuestionSource('ALL')}
                  className={`py-1 px-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider flex flex-col items-center justify-center min-h-[44px] ${
                    questionSource === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-450'
                  }`}
                >
                  <span>Completo</span>
                  <span className={`text-[9px] font-bold ${questionSource === 'ALL' ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {questions.length} Preguntas
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionSource('PRACTICED')}
                  className={`py-1 px-2.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider flex flex-col items-center justify-center min-h-[44px] ${
                    questionSource === 'PRACTICED'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-450'
                  }`}
                >
                  <span>Practicadas</span>
                  <span className={`text-[9px] font-bold ${questionSource === 'PRACTICED' ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {practicedQuestionsCount} Preguntas
                  </span>
                </button>
              </div>
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

          {selectedQuestions.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 text-center text-amber-800 dark:text-amber-300 font-bold text-sm mb-8 flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>No hay preguntas suficientes en las prácticas ya realizadas para el área seleccionada.</span>
              <span className="text-xs font-normal text-amber-700/85 dark:text-amber-400/85">
                Por favor, practica algunos temas de esta área en el Inicio primero, o cambia la opción a <strong>"Completo"</strong> para generar el simulacro utilizando todas las preguntas de la plataforma.
              </span>
            </div>
          ) : null}

          <button 
            onClick={handleStartExam}
            disabled={selectedQuestions.length === 0}
            className={`w-full py-6 rounded-2xl font-black text-xl shadow-xl transition-all flex items-center justify-center gap-4 ${
              selectedQuestions.length === 0 
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed shadow-none border border-gray-200 dark:border-slate-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none active:scale-[0.98]'
            }`}
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
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider mb-4 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Salir del Simulacro
      </button>
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
          {step === 'FINISHED' && isReviewMode && retakeExam && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>📅 Rendido el {new Date(retakeExam.solvedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {retakeExam.attemptsCount && retakeExam.attemptsCount > 1 && (
                <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                  Intento #{retakeExam.attemptsCount}
                </span>
              )}
            </div>
          )}
        </div>
        {step === 'QUIZ' ? (
          <button onClick={handleFinalize} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-black hover:bg-rose-600 shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest">Forzar Finalizar</button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setShowPrintModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-3 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>🖨️</span>
              <span>Imprimir / Exportar PDF</span>
            </button>
            {retakeExam && !isReviewMode && (
              <div className="text-center px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-gray-400 block tracking-widest">Puntaje Anterior</span>
                <span className="text-xl font-black text-gray-500 dark:text-gray-400">{retakeExam.score.toFixed(2)}</span>
              </div>
            )}
            <div className="text-center px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-indigo-400 block tracking-widest">
                {isReviewMode ? 'Puntaje Obtenido' : retakeExam ? 'Nuevo Puntaje' : 'Puntaje Total'}
              </span>
              <span className="text-2xl md:text-3xl font-black text-indigo-700 dark:text-indigo-200">
                {(isReviewMode && retakeExam ? retakeExam.score : detailedResults.totalScore).toFixed(2)} / {(isReviewMode && retakeExam ? retakeExam.maxScore : maxPossibleScore).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {step === 'FINISHED' && (
        <div className="space-y-12 mb-12 animate-fade-in">
          {/* Stats section */}
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
                  {Object.entries(detailedResults.categoryBreakdown).map(([cat, stats]) => (
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

          <div className={`grid grid-cols-1 ${detailedResults.bestTopics.length > 0 && detailedResults.weakTopics.length > 0 ? 'md:grid-cols-2' : ''} gap-6`}>
            {detailedResults.bestTopics.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex flex-col h-full">
                <h3 className="text-emerald-800 dark:text-emerald-300 font-black text-lg mb-6 flex items-center gap-2 shrink-0">
                  <span className="text-2xl">🏆</span> Mejores Temas
                </h3>
                <div className="space-y-4">
                  {detailedResults.bestTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20 shadow-sm shadow-emerald-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{t.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {detailedResults.weakTopics.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-900/10 p-8 rounded-3xl border border-rose-100 dark:border-rose-900/30 shadow-sm flex flex-col h-full">
                <h3 className="text-rose-800 dark:text-rose-300 font-black text-lg mb-6 flex items-center gap-2 shrink-0">
                  <span className="text-2xl">📉</span> Temas a Reforzar
                </h3>
                <div className="space-y-4">
                  {detailedResults.weakTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-rose-100 dark:border-rose-900/20 shadow-sm shadow-rose-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-rose-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{t.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Navigator Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-6 md:p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span>🎯</span> Navegación Rápida de Preguntas
              </h3>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  Correctas ({selectedQuestions.filter(i => answers[i.question.id] === i.question.correctIndex).length})
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                  Errores ({selectedQuestions.filter(i => answers[i.question.id] !== undefined && answers[i.question.id] !== i.question.correctIndex).length})
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-slate-700 inline-block"></span>
                  Omitidas ({selectedQuestions.filter(i => answers[i.question.id] === undefined).length})
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
              {selectedQuestions.map((item, idx) => {
                const userChoice = answers[item.question.id];
                const isCorrect = userChoice === item.question.correctIndex;
                const isAnswered = userChoice !== undefined;

                let badgeStyle = "bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700";
                if (isAnswered) {
                  badgeStyle = isCorrect
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-rose-500 text-white border-rose-600 shadow-sm";
                }

                return (
                  <button
                    key={item.question.id}
                    onClick={() => {
                      const el = document.getElementById(`res-q-${idx}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`w-9 h-9 rounded-xl border text-xs font-black transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${badgeStyle}`}
                    title={`Ir a pregunta ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Questions List Header */}
          <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-xl flex items-center justify-between">
            <h3 className="text-xl font-black flex items-center gap-3">
              <span>📖</span> Resolución Completa ({selectedQuestions.length} Preguntas)
            </h3>
            <span className="text-xs uppercase font-bold bg-white/20 px-4 py-1.5 rounded-full tracking-wider">
              Todas las soluciones
            </span>
          </div>

          {/* All Questions rendered in list */}
          <div className="space-y-12">
            {selectedQuestions.map((item, idx) => {
              const q = item.question;
              const selected = answers[q.id];
              const isAnswered = selected !== undefined;
              const isCorrect = selected === q.correctIndex;

              return (
                <div key={q.id} id={`res-q-${idx}`} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden scroll-mt-24 transition-all">
                  {/* Reading text header if first question of a reading text */}
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

                  {/* Reading text mini banner if subsequent question */}
                  {item.readingText && idx > 0 && selectedQuestions[idx - 1].readingText?.id === item.readingText.id && (
                    <div className="bg-amber-50/30 dark:bg-amber-950/20 border-l-4 border-amber-400 px-8 py-3.5 text-xs text-amber-800 dark:text-amber-300 font-bold border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                      <span>📖</span> Referente a la lectura anterior: <span className="underline italic">{item.readingText.title}</span>
                    </div>
                  )}

                  <div className="p-8 md:p-12">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="bg-gray-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-tighter">{item.category}</span>
                        <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                          {q.subject}: {q.topic}
                        </span>
                      </div>

                      {/* Result Badge */}
                      {isAnswered ? (
                        isCorrect ? (
                          <span className="bg-emerald-500 text-white text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                            <span>✓</span> Correcta
                          </span>
                        ) : (
                          <span className="bg-rose-500 text-white text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                            <span>✗</span> Incorrecta
                          </span>
                        )
                      ) : (
                        <span className="bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5">
                          <span>—</span> Sin responder
                        </span>
                      )}
                    </div>

                    {q.imageUrl && (
                      <div className="mb-8 rounded-3xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                        <img src={q.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[400px] object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-8">{formatQuestionText(q.questionText)}</p>

                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((opt, optIdx) => {
                        const isUserSelection = selected === optIdx;
                        const isCorrectAnswer = optIdx === q.correctIndex;

                        let styleClasses = "bg-gray-50/70 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 text-gray-600 dark:text-gray-300 opacity-60";
                        
                        if (isCorrectAnswer) {
                          styleClasses = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500 font-bold text-emerald-900 dark:text-emerald-100";
                        } else if (isUserSelection && !isCorrectAnswer) {
                          styleClasses = "bg-rose-50 dark:bg-rose-900/30 border-rose-500 ring-2 ring-rose-500 font-bold text-rose-900 dark:text-rose-100";
                        }

                        return (
                          <div key={optIdx} className={`p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${styleClasses}`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black shrink-0 ${
                                isCorrectAnswer 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : isUserSelection 
                                  ? 'bg-rose-600 border-rose-600 text-white' 
                                  : 'border-gray-300 dark:border-slate-700 text-gray-400'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              <span className="text-base leading-relaxed">{parseHTMLTags(opt)}</span>
                            </div>

                            {/* Option Tag */}
                            {isCorrectAnswer && (
                              <span className="text-xs font-black uppercase tracking-wider bg-emerald-500 text-white px-3 py-1 rounded-full shrink-0">
                                Respuesta Correcta
                              </span>
                            )}
                            {isUserSelection && !isCorrectAnswer && (
                              <span className="text-xs font-black uppercase tracking-wider bg-rose-500 text-white px-3 py-1 rounded-full shrink-0">
                                Tu Selección
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation box */}
                    <div className="mt-8 bg-indigo-50/40 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-indigo-900 dark:text-indigo-200 font-black mb-1.5 uppercase tracking-widest text-xs flex items-center gap-1.5">
                        <span>💡</span> Explicación & Fundamento:
                      </p>
                      <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                        {parseHTMLTags(q.explanation)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center p-8">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl flex items-center gap-2"
            >
              <span>⬆️</span> Volver al Inicio de la Resolución
            </button>
          </div>
        </div>
      )}

      {step === 'QUIZ' && (
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

                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-10 whitespace-pre-wrap">{formatQuestionText(item.question.questionText)}</p>

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
                          {parseHTMLTags(opt)}
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
      )}

      {showPrintModal && (
        <PrintExamModal
          exam={{
            id: currentExamIdRef.current,
            title: retakeExam?.title || `${mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'} - ${selectedArea}`,
            course: 'Exámenes',
            subject: 'Exámenes Simulacros',
            area: selectedArea,
            mode: mode || 'GENERAL',
            questionIds: selectedQuestions.map(item => item.question.id),
            totalQuestions: selectedQuestions.length,
            score: detailedResults.totalScore,
            maxScore: maxPossibleScore,
            solvedAt: Date.now(),
            createdAt: retakeExam?.createdAt || Date.now(),
            selectedExamSubjects: selectedExamSubjects,
          }}
          allQuestions={questions}
          readingTexts={readingTexts}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};

export default MegaQuizView;
