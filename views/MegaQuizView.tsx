
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, ExamMode, TopicResult, SavedExam, UserProfile } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';
import { formatQuestionText, parseHTMLTags, getQuestionWeek, getQuestionProcess, getProcessBadgeStyle, getProcessShortName } from '../utils';
import { PrintExamModal } from '../components/PrintExamModal';
import { QuizizzGame } from '../components/QuizizzGame';

interface MegaQuizViewProps {
  questions: Question[];
  readingTexts: ReadingText[];
  results?: Record<string, TopicResult>;
  onFinishMega: (total: number) => void;
  mode?: ExamMode;
  selectedExamSubjects?: string[];
  selectedExamWeeks?: number[];
  selectedExamProcesses?: string[];
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  onBack: () => void;
  retakeExam?: SavedExam;
  isReviewMode?: boolean;
  onSaveExamResult?: (exam: SavedExam) => void;
  userProfile?: UserProfile;
}

const MegaQuizView: React.FC<MegaQuizViewProps> = ({ 
  questions, 
  readingTexts, 
  results = {},
  onFinishMega, 
  mode = 'GENERAL',
  selectedExamSubjects,
  selectedExamWeeks,
  selectedExamProcesses,
  selectedArea,
  onSetSelectedArea,
  onBack,
  retakeExam,
  isReviewMode = false,
  onSaveExamResult,
  userProfile
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

  const activeWeeks = useMemo(() => {
    return selectedExamWeeks || retakeExam?.selectedExamWeeks;
  }, [selectedExamWeeks, retakeExam]);

  const activeProcesses = useMemo(() => {
    return selectedExamProcesses || retakeExam?.selectedExamProcesses;
  }, [selectedExamProcesses, retakeExam]);

  const basePool = useMemo(() => {
    if (questionSource === 'PRACTICED') {
      return questions.filter(q => results && results[`${q.subject}|${q.topic}`] !== undefined);
    }
    return questions;
  }, [questions, results, questionSource]);

  const practicedQuestionsCount = useMemo(() => {
    return questions.filter(q => results && results[`${q.subject}|${q.topic}`] !== undefined).length;
  }, [questions, results]);

  const getExamDefaultTitle = () => {
    if (retakeExam?.title) return retakeExam.title;
    let weekLabel = '';
    if (activeWeeks && activeWeeks.length > 0) {
      if (activeWeeks.length === 1 && activeWeeks[0] === 1) {
        weekLabel = ' (Semana 1)';
      } else if (activeWeeks.length === 2 && activeWeeks[0] === 1 && activeWeeks[1] === 2) {
        weekLabel = ' (Semana 1 y 2)';
      } else if (activeWeeks.length === 3 && activeWeeks[0] === 1 && activeWeeks[1] === 2 && activeWeeks[2] === 3) {
        weekLabel = ' (Semana 1, 2 y 3)';
      } else {
        weekLabel = ` (Semanas ${activeWeeks.join(', ')})`;
      }
    }

    let procLabel = '';
    if (activeProcesses && activeProcesses.length > 0) {
      if (activeProcesses.length === 1) {
        procLabel = ` [${getProcessShortName(activeProcesses[0])}]`;
      } else if (activeProcesses.length < 3) {
        procLabel = ` [${activeProcesses.map(p => getProcessShortName(p)).join(', ')}]`;
      }
    }

    const isFull80 = !selectedExamSubjects || selectedExamSubjects.length === 0;
    if (isFull80) {
      return `Simulacro 80 Preguntas${procLabel}${weekLabel} - ${selectedArea}`;
    }
    return `Examen Personalizado${procLabel}${weekLabel} - ${selectedArea}`;
  };

  const candidateQuestions = useMemo(() => {
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];

    // 1. Si es reintento o revisión de examen ya guardado
    if (retakeExam && retakeExam.questionIds.length > 0) {
      const qMap = new Map<string, Question>(questions.map(q => [q.id, q]));
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
          const readingText = q.readingTextId ? (readingTexts || []).find(r => Boolean(r && r.id === q.readingTextId)) : undefined;
          finalSelection.push({ question: q, weight, category: catName, readingText });
        }
      });
      return finalSelection;
    }

    // 2. Generar nuevo examen
    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    // Distancia en semanas: 0 = coincide con activeWeeks, 1, 2, ... = cercanía de semana, 50 = sin semana
    const getWeekDist = (q: Question): number => {
      if (!activeWeeks || activeWeeks.length === 0) return 0;
      const w = getQuestionWeek(q);
      if (w === undefined || w === null || w <= 0) return 50;
      if (activeWeeks.includes(w)) return 0;
      return Math.min(...activeWeeks.map(targetW => Math.abs(w - targetW)));
    };

    // Prioridad por proceso: 0 = coincide con los procesos seleccionados, 1 = otro proceso
    const getProcRank = (q: Question): number => {
      if (!activeProcesses || activeProcesses.length === 0) return 0;
      const p = getQuestionProcess(q);
      return activeProcesses.includes(p) ? 0 : 1;
    };

    // Ordenamiento inteligente: Proceso coincidente > Semana más cercana > Aleatoriedad
    const scoreAndSortQuestions = (list: Question[]): Question[] => {
      return [...list].sort((a, b) => {
        const procA = getProcRank(a);
        const procB = getProcRank(b);
        if (procA !== procB) return procA - procB;

        const distA = getWeekDist(a);
        const distB = getWeekDist(b);
        if (distA !== distB) return distA - distB;

        return Math.random() - 0.5;
      });
    };

    const finalSelection: { question: Question; weight: number; category: string; readingText?: ReadingText }[] = [];
    const usedQuestionIds = new Set<string>();

    // Paso 1: Seleccionar preguntas de cada categoría respetando cuotas y completando con la semana más próxima si faltan
    Object.entries(configToUse).forEach(([categoryName, config]) => {
      if (categoryName === 'Comprensión Lectora') {
        const pool = basePool.filter(q => q.subject === 'Comprensión Lectora' && q.readingTextId && !usedQuestionIds.has(q.id));
        const groupedByText: Record<string, Question[]> = {};
        
        pool.forEach(q => {
          if (q.readingTextId) {
            if (!groupedByText[q.readingTextId]) groupedByText[q.readingTextId] = [];
            groupedByText[q.readingTextId].push(q);
          }
        });

        // Clasificar textos por proceso y cercanía de semana
        const rankedTexts = Object.keys(groupedByText).sort((tA, tB) => {
          const qsA = groupedByText[tA];
          const qsB = groupedByText[tB];
          const bestProcA = Math.min(...qsA.map(getProcRank));
          const bestProcB = Math.min(...qsB.map(getProcRank));
          if (bestProcA !== bestProcB) return bestProcA - bestProcB;

          const bestDistA = Math.min(...qsA.map(getWeekDist));
          const bestDistB = Math.min(...qsB.map(getWeekDist));
          if (bestDistA !== bestDistB) return bestDistA - bestDistB;

          return Math.random() - 0.5;
        });

        let questionsNeeded = config.count || 5;

        // Texto 1
        if (rankedTexts[0] && questionsNeeded > 0) {
          const text1 = (readingTexts || []).find(t => Boolean(t && t.id === rankedTexts[0]));
          const availableQs1 = scoreAndSortQuestions(groupedByText[rankedTexts[0]]);
          const takeCount1 = rankedTexts.length > 1 ? Math.min(3, availableQs1.length, questionsNeeded) : Math.min(questionsNeeded, availableQs1.length);
          const qs1 = availableQs1.slice(0, takeCount1);
          qs1.forEach(q => {
            finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text1 });
            usedQuestionIds.add(q.id);
          });
          questionsNeeded -= qs1.length;
        }

        // Texto 2
        if (rankedTexts[1] && questionsNeeded > 0) {
          const text2 = (readingTexts || []).find(t => Boolean(t && t.id === rankedTexts[1]));
          const availableQs2 = scoreAndSortQuestions(groupedByText[rankedTexts[1]]);
          const qs2 = availableQs2.slice(0, Math.min(questionsNeeded, availableQs2.length));
          qs2.forEach(q => {
            finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text2 });
            usedQuestionIds.add(q.id);
          });
          questionsNeeded -= qs2.length;
        }

        // Si aún faltan preguntas de lectura, buscar en otros textos disponibles por cercanía
        if (questionsNeeded > 0) {
          for (let i = 2; i < rankedTexts.length && questionsNeeded > 0; i++) {
            const textI = (readingTexts || []).find(t => Boolean(t && t.id === rankedTexts[i]));
            const availableQsI = scoreAndSortQuestions(groupedByText[rankedTexts[i]]);
            const qsI = availableQsI.slice(0, Math.min(questionsNeeded, availableQsI.length));
            qsI.forEach(q => {
              finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: textI });
              usedQuestionIds.add(q.id);
            });
            questionsNeeded -= qsI.length;
          }
        }

        // Si aún faltan, cualquier otra pregunta de Comprensión Lectora
        if (questionsNeeded > 0) {
          const remainingCL = scoreAndSortQuestions(basePool.filter(q => q.subject === 'Comprensión Lectora' && !usedQuestionIds.has(q.id)));
          const takeRem = remainingCL.slice(0, questionsNeeded);
          takeRem.forEach(q => {
            const text = q.readingTextId ? (readingTexts || []).find(t => Boolean(t && t.id === q.readingTextId)) : undefined;
            finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text });
            usedQuestionIds.add(q.id);
          });
        }
      } else if (categoryName === 'Inglés Lectura') {
        const pool = basePool.filter(q => q.subject === 'Inglés Lectura' && q.readingTextId && !usedQuestionIds.has(q.id));
        const groupedByText: Record<string, Question[]> = {};
        
        pool.forEach(q => {
          if (q.readingTextId) {
            if (!groupedByText[q.readingTextId]) groupedByText[q.readingTextId] = [];
            groupedByText[q.readingTextId].push(q);
          }
        });

        const rankedTexts = Object.keys(groupedByText).sort((tA, tB) => {
          const qsA = groupedByText[tA];
          const qsB = groupedByText[tB];
          const bestProcA = Math.min(...qsA.map(getProcRank));
          const bestProcB = Math.min(...qsB.map(getProcRank));
          if (bestProcA !== bestProcB) return bestProcA - bestProcB;

          const bestDistA = Math.min(...qsA.map(getWeekDist));
          const bestDistB = Math.min(...qsB.map(getWeekDist));
          if (bestDistA !== bestDistB) return bestDistA - bestDistB;

          return Math.random() - 0.5;
        });

        let questionsNeeded = config.count || 2;
        if (rankedTexts[0]) {
          const text1 = (readingTexts || []).find(t => Boolean(t && t.id === rankedTexts[0]));
          const availableQs1 = scoreAndSortQuestions(groupedByText[rankedTexts[0]]);
          const qs1 = availableQs1.slice(0, Math.min(questionsNeeded, availableQs1.length));
          qs1.forEach(q => {
            finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text1 });
            usedQuestionIds.add(q.id);
          });
          questionsNeeded -= qs1.length;
        }

        // Si faltan, buscar en otros textos o preguntas de inglés
        if (questionsNeeded > 0) {
          const remainingIL = scoreAndSortQuestions(basePool.filter(q => (q.subject === 'Inglés Lectura' || q.subject === 'Inglés') && !usedQuestionIds.has(q.id)));
          const takeRem = remainingIL.slice(0, questionsNeeded);
          takeRem.forEach(q => {
            const text = q.readingTextId ? (readingTexts || []).find(t => Boolean(t && t.id === q.readingTextId)) : undefined;
            finalSelection.push({ question: q, weight: config.weight, category: categoryName, readingText: text });
            usedQuestionIds.add(q.id);
          });
        }
      } else {
        const pool = basePool.filter(q => config.subjects.includes(q.subject) && !usedQuestionIds.has(q.id));
        const sorted = scoreAndSortQuestions(pool);
        const selected = sorted.slice(0, config.count);
        selected.forEach(q => {
          finalSelection.push({ question: q, weight: config.weight, category: categoryName });
          usedQuestionIds.add(q.id);
        });
      }
    });

    // Paso 2: Si es un simulacro completo de 80 preguntas y faltaron preguntas en alguna materia,
    // rellenar con preguntas disponibles de otras materias del área (priorizando semana más próxima)
    const isFull80Target = !selectedExamSubjects || selectedExamSubjects.length === 0;
    const targetTotal = isFull80Target ? 80 : Object.values(configToUse).reduce((sum, c) => sum + c.count, 0);

    if (finalSelection.length < targetTotal) {
      const allAreaSubjects = new Set(Object.values(activeAreaConfig).flatMap(c => c.subjects));
      const remainingUnused = basePool.filter(q => allAreaSubjects.has(q.subject) && !usedQuestionIds.has(q.id));
      const sortedRemaining = scoreAndSortQuestions(remainingUnused);
      const neededCount = targetTotal - finalSelection.length;
      const fillers = sortedRemaining.slice(0, neededCount);

      fillers.forEach(q => {
        let catName = q.subject;
        let weight = 1.25;
        for (const [cat, cfg] of Object.entries(activeAreaConfig)) {
          if (cfg.subjects.includes(q.subject) || cat === q.subject) {
            catName = cat;
            weight = cfg.weight;
            break;
          }
        }
        const readingText = q.readingTextId ? (readingTexts || []).find(r => Boolean(r && r.id === q.readingTextId)) : undefined;
        finalSelection.push({ question: q, weight, category: catName, readingText });
        usedQuestionIds.add(q.id);
      });
    }

    // Ordenar preguntas según la estructura oficial de materias y agrupar textos de lectura
    const categoryOrderMap = new Map(Object.keys(activeAreaConfig).map((cat, idx) => [cat, idx]));

    return finalSelection.sort((a, b) => {
      const orderA = categoryOrderMap.get(a.category) ?? 99;
      const orderB = categoryOrderMap.get(b.category) ?? 99;
      if (orderA !== orderB) return orderA - orderB;

      if (a.question.subject !== b.question.subject) {
        return a.question.subject.localeCompare(b.question.subject);
      }
      const textIdA = a.readingText?.id || '';
      const textIdB = b.readingText?.id || '';
      return textIdA.localeCompare(textIdB);
    });
  }, [basePool, questions, readingTexts, selectedExamSubjects, selectedArea, retakeExam, activeWeeks, activeProcesses]);

  const [activeQuestions, setActiveQuestions] = useState<{ question: Question; weight: number; category: string; readingText?: ReadingText }[]>([]);

  useEffect(() => {
    if (isReviewMode && candidateQuestions.length > 0) {
      setActiveQuestions(candidateQuestions);
      if (retakeExam?.userAnswers) {
        setAnswers(retakeExam.userAnswers);
      }
    }
  }, [isReviewMode, candidateQuestions, retakeExam]);

  const [playMode, setPlayMode] = useState<'CLASSIC' | 'QUIZZIZ'>('CLASSIC');

  const selectedQuestions = (step === 'WELCOME' || activeQuestions.length === 0) ? candidateQuestions : activeQuestions;

  const handleStartExam = (selectedPlayMode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    if (candidateQuestions.length === 0) return;
    setPlayMode(selectedPlayMode);
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
      title: getExamDefaultTitle(),
      course: 'Exámenes',
      subject: 'Exámenes Simulacros',
      area: selectedArea,
      mode: (mode || 'GENERAL') as any,
      questionIds: examQuestions.map(item => item.question.id),
      totalQuestions: examQuestions.length,
      createdAt: retakeExam?.createdAt || Date.now(),
      selectedExamSubjects: selectedExamSubjects,
      selectedExamWeeks: activeWeeks,
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
      title: getExamDefaultTitle(),
      course: 'Exámenes',
      subject: 'Exámenes Simulacros',
      area: selectedArea,
      mode: (mode || 'GENERAL') as any,
      questionIds: selectedQuestions.map(item => item.question.id),
      totalQuestions: selectedQuestions.length,
      score: resultsCalc.totalScore,
      maxScore: maxPossibleScore,
      solvedAt: Date.now(),
      createdAt: retakeExam?.createdAt || Date.now(),
      selectedExamSubjects: selectedExamSubjects,
      selectedExamWeeks: activeWeeks,
      selectedExamProcesses: activeProcesses,
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
    return <div className="max-w-2xl mx-auto py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-xl font-bold text-gray-700 dark:text-gray-200">No hay preguntas suficientes.</div>;
  }

  if (step === 'WELCOME') {
    const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
    const configToUse = selectedExamSubjects 
      ? Object.fromEntries(Object.entries(activeAreaConfig).filter(([k]) => selectedExamSubjects.includes(k)))
      : activeAreaConfig;

    return (
      <div className="max-w-4xl mx-auto py-4 sm:py-10 px-2 sm:px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider mb-4 transition-colors min-h-[44px] px-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Inicio
        </button>
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 p-4 sm:p-8 md:p-12">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                {mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'}
              </span>
              {activeProcesses && activeProcesses.length > 0 ? (
                activeProcesses.map(proc => {
                  const style = getProcessBadgeStyle(proc);
                  return (
                    <span key={proc} className={`${style.bg} ${style.text} ${style.border} border text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1`}>
                      <span>{proc}</span>
                    </span>
                  );
                })
              ) : (
                <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span>Todos los Procesos</span>
                </span>
              )}
              {activeWeeks && activeWeeks.length > 0 && (
                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  {activeWeeks.length === 1 ? `Semana ${activeWeeks[0]}` : `Semanas ${activeWeeks.join(', ')}`}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 mb-2 sm:mb-3 tracking-tight">
              {getExamDefaultTitle()}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
              Este examen consta de <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedQuestions.length} preguntas</span> distribuidas según los pesos oficiales del Área {selectedArea}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-2xl mx-auto">
            {/* Selector de Área */}
            <div className="flex flex-col items-center">
              <label className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2.5">
                Área Académica:
              </label>
              <div className="grid grid-cols-3 gap-1.5 w-full bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-700">
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
              <div className="grid grid-cols-2 gap-1.5 w-full bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-700">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => handleStartExam('CLASSIC')}
              disabled={selectedQuestions.length === 0}
              className={`py-5 px-6 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                selectedQuestions.length === 0 
                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed shadow-none border border-gray-200 dark:border-slate-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none active:scale-[0.98]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Examen Tradicional</span>
            </button>

            <button 
              onClick={() => handleStartExam('QUIZZIZ')}
              disabled={selectedQuestions.length === 0}
              className={`py-5 px-6 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                selectedQuestions.length === 0 
                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed shadow-none border border-gray-200 dark:border-slate-700' 
                  : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-200 dark:shadow-none active:scale-[0.98]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Jugar Practix Interactivo</span>
            </button>
          </div>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Rendido el {new Date(retakeExam.solvedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Imprimir / Exportar PDF</span>
            </button>
            {retakeExam && !isReviewMode && (
              <div className="text-center px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-gray-400 block tracking-widest">Puntaje Anterior</span>
                <span className="text-xl font-black text-gray-500 dark:text-gray-400">{(retakeExam.score ?? 0).toFixed(2)}</span>
              </div>
            )}
            <div className="text-center px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-indigo-400 block tracking-widest">
                {isReviewMode ? 'Puntaje Obtenido' : retakeExam ? 'Nuevo Puntaje' : 'Puntaje Total'}
              </span>
              <span className="text-2xl md:text-3xl font-black text-indigo-700 dark:text-indigo-200">
                {((isReviewMode && retakeExam ? retakeExam.score : detailedResults.totalScore) ?? 0).toFixed(2)} / {((isReviewMode && retakeExam ? retakeExam.maxScore : maxPossibleScore) ?? 0).toFixed(2)}
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
                  {Object.entries(detailedResults.categoryBreakdown).map(([cat, stats]: [string, any]) => (
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
                        {(stats.points ?? 0).toFixed(4)}
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span>Mejores Temas</span>
                </h3>
                <div className="space-y-4">
                  {detailedResults.bestTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20 shadow-sm shadow-emerald-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{(t.percentage ?? 0).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {detailedResults.weakTopics.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-900/10 p-8 rounded-3xl border border-rose-100 dark:border-rose-900/30 shadow-sm flex flex-col h-full">
                <h3 className="text-rose-800 dark:text-rose-300 font-black text-lg mb-6 flex items-center gap-2 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  <span>Temas a Reforzar</span>
                </h3>
                <div className="space-y-4">
                  {detailedResults.weakTopics.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-rose-100 dark:border-rose-900/20 shadow-sm shadow-rose-100/50 dark:shadow-none hover:translate-x-1 transition-transform">
                      <span className="text-gray-700 dark:text-gray-300 font-bold text-xs leading-tight pr-2">{t.name}</span>
                      <span className="bg-rose-500 text-white px-3 py-1 rounded-full font-black text-[10px] shrink-0">{(t.percentage ?? 0).toFixed(0)}%</span>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Navegación Rápida de Preguntas</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Resolución Completa ({selectedQuestions.length} Preguntas)</span>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>TEXTO DE {item.readingText.subject.toUpperCase()}</span>
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
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>Referente a la lectura anterior: <span className="underline italic">{item.readingText.title}</span></span>
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
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Correcta</span>
                          </span>
                        ) : (
                          <span className="bg-rose-500 text-white text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Incorrecta</span>
                          </span>
                        )
                      ) : (
                        <span className="bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5">
                          <span>—</span> Sin responder
                        </span>
                      )}
                    </div>

                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-6">
                      {formatQuestionText(q.questionText)}
                    </div>

                    {q.imageUrl && (
                      <div className="mb-8 rounded-3xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 max-w-2xl mx-auto p-2">
                        <img src={q.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[400px] object-contain rounded-2xl" referrerPolicy="no-referrer" />
                      </div>
                    )}

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
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Explicación & Fundamento:</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>Volver al Inicio de la Resolución</span>
            </button>
          </div>
        </div>
      )}

      {step === 'QUIZ' && playMode === 'QUIZZIZ' && (
        <QuizizzGame
          title={`${mode === 'CUSTOM' ? 'Examen Personalizado' : 'Simulacro General'} - ${selectedArea}`}
          subtitle="Modo Practix Interactivo"
          questions={selectedQuestions.map(item => item.question)}
          readingTexts={readingTexts}
          userProfile={userProfile}
          onFinish={(score, total) => {
            handleFinalize();
          }}
          onBack={() => setStep('WELCOME')}
        />
      )}

      {step === 'QUIZ' && playMode === 'CLASSIC' && (
        <div className="space-y-12 pb-32">
          {selectedQuestions.map((item, idx) => (
            <div key={item.question.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-fade-in">
              {item.readingText && (idx === 0 || selectedQuestions[idx - 1].readingText?.id !== item.readingText.id) && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border-l-8 border-amber-400 p-8 md:p-12 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-widest">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>TEXTO DE {item.readingText.subject.toUpperCase()}</span>
                  </div>
                  <h4 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 font-serif">{item.readingText.title}</h4>
                  <div className="text-gray-700 dark:text-gray-200 leading-relaxed font-serif whitespace-pre-wrap text-xl italic bg-white/40 dark:bg-slate-900/40 p-6 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    {item.readingText.content}
                  </div>
                </div>
              )}

              {item.readingText && idx > 0 && selectedQuestions[idx - 1].readingText?.id === item.readingText.id && (
                <div className="bg-amber-50/30 dark:bg-amber-950/20 border-l-4 border-amber-400 px-8 py-3.5 text-xs text-amber-800 dark:text-amber-300 font-bold border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Referente a la lectura anterior: <span className="underline italic">{item.readingText.title}</span></span>
                </div>
              )}

              <div className="p-4 sm:p-8 md:p-12">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-8">
                  <span className="bg-gray-800 text-white font-black w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 text-xs sm:text-base">{idx + 1}</span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">{item.category}</span>
                  <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase truncate max-w-[200px]">
                    {item.question.subject}: {item.question.topic}
                  </span>
                </div>

                <div className="text-base sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed mb-6 sm:mb-8 whitespace-pre-wrap">
                  {formatQuestionText(item.question.questionText)}
                </div>

                {item.question.imageUrl && (
                  <div className="mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 max-w-2xl mx-auto p-2">
                    <img src={item.question.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[400px] object-contain rounded-2xl" referrerPolicy="no-referrer" />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:gap-4">
                  {item.question.options.map((opt, optIdx) => {
                    const isSelected = answers[item.question.id] === optIdx;
                    return (
                      <button
                        id={`q-${item.question.id}-opt-${optIdx}`}
                        key={optIdx}
                        onClick={() => handleSelect(item.question.id, optIdx)}
                        className={`flex items-start sm:items-center gap-3 sm:gap-5 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border-2 text-left transition-all min-h-[48px] active:scale-[0.99] ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-100 dark:shadow-none' 
                            : 'border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900'
                        }`}
                      >
                        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl border-2 flex items-center justify-center font-black transition-all shrink-0 text-xs sm:text-base mt-0.5 sm:mt-0 ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 dark:border-slate-700 text-gray-400'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <span className={`text-sm sm:text-base font-bold break-words leading-relaxed transition-all ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-300'}`}>
                            {parseHTMLTags(opt)}
                          </span>
                          {item.question.optionsImageUrls && item.question.optionsImageUrls[optIdx] && (
                            <img src={item.question.optionsImageUrls[optIdx]} alt={`Opción ${String.fromCharCode(65 + optIdx)}`} className="max-w-full h-auto rounded-lg border dark:border-slate-700 max-h-[160px] object-contain self-start" referrerPolicy="no-referrer" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex justify-center p-4 sm:p-8">
            <button 
              onClick={handleFinalize}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 sm:px-16 py-4 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-base sm:text-xl uppercase tracking-wider hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all active:scale-95 min-h-[52px]"
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
