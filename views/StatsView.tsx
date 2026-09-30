import React, { useMemo, useState, useEffect } from 'react';
import { AREA_EXAM_CONFIGS, ADMISSION_PROCESSES } from '../constants';
import { Question, TopicResult, CourseStructure, UserProfile } from '../types';
import { getQuestionProcess, getProcessBadgeStyle } from '../utils';

interface StatsViewProps {
  questions: Question[];
  results: Record<string, TopicResult>;
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  academicStructure: CourseStructure[];
  userProfile?: UserProfile;
  onUpdateProfile?: (profile: UserProfile) => void;
}

const STATS_PROCESS_STORAGE_KEY = 'practix_stats_selected_process';

export const StatsView: React.FC<StatsViewProps> = ({
  questions,
  results,
  selectedArea,
  onSetSelectedArea,
  academicStructure,
  userProfile,
  onUpdateProfile
}) => {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcessState] = useState<string>(() => {
    try {
      return localStorage.getItem(STATS_PROCESS_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const setSelectedProcess = (proc: string) => {
    setSelectedProcessState(proc);
    try {
      if (proc) {
        localStorage.setItem(STATS_PROCESS_STORAGE_KEY, proc);
      } else {
        localStorage.removeItem(STATS_PROCESS_STORAGE_KEY);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [profileName, setProfileName] = useState(userProfile?.name || 'Estudiante Practix');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [savedAlert, setSavedAlert] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || 'Estudiante Practix');
      setProfileAvatarUrl(userProfile.avatarUrl || '');
    }
  }, [userProfile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateProfile) {
      onUpdateProfile({
        name: profileName.trim() || 'Estudiante Practix',
        avatarUrl: profileAvatarUrl.trim()
      });
    }
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  // Helper to map a subject to its category in the selected exam config
  const getCategoryForSubject = (subjectName: string, config: typeof AREA_EXAM_CONFIGS['Biomédicas']) => {
    // 1. Direct match or within config subjects array
    for (const [catName, catConfig] of Object.entries(config)) {
      if (catName === subjectName || catConfig.subjects.includes(subjectName)) {
        return { category: catName, weight: catConfig.weight, count: catConfig.count };
      }
    }
    // 2. Special cases
    if (subjectName === 'Anatomía') {
      if (config['Biología']) {
        return { category: 'Biología', weight: config['Biología'].weight, count: config['Biología'].count };
      }
    }
    if (subjectName === 'Inglés') {
      if (config['Inglés Gramática']) {
        return { category: 'Inglés Gramática', weight: config['Inglés Gramática'].weight, count: config['Inglés Gramática'].count };
      }
    }
    // 3. Fallback
    return null;
  };

  // Filtered questions based on selected process
  const filteredQuestions = useMemo(() => {
    if (!selectedProcess) return questions;
    return questions.filter(q => getQuestionProcess(q) === selectedProcess);
  }, [questions, selectedProcess]);

  // Per-process summary calculations: only processes with questions in the database
  const processSummary = useMemo(() => {
    // Gather all processes present in questions
    const setOfProcesses = new Set<string>();
    questions.forEach(q => {
      const p = getQuestionProcess(q);
      if (p) setOfProcesses.add(p);
    });

    const activeList = Array.from(setOfProcesses).sort();

    return activeList.map(proc => {
      const qInProc = questions.filter(q => getQuestionProcess(q) === proc);
      const topicsInProc = new Set<string>(qInProc.map(q => `${q.subject}|${q.topic}`));
      let practicedTopics = 0;
      let correctQ = 0;
      let totalPracticedQ = 0;
      topicsInProc.forEach(tKey => {
        const res = results[tKey];
        if (res && res.total > 0) {
          practicedTopics++;
          correctQ += res.score;
          totalPracticedQ += res.total;
        }
      });
      return {
        name: proc,
        questionCount: qInProc.length,
        totalTopics: topicsInProc.size,
        practicedTopics,
        accuracy: totalPracticedQ > 0 ? (correctQ / totalPracticedQ) * 100 : 0
      };
    }).filter(p => p.questionCount > 0);
  }, [questions, results]);

  // Group all unique topics available in the filtered questions
  const dbTopics = useMemo(() => {
    const map = new Map<string, { course: string; subject: string; name: string; questionCount: number }>();
    filteredQuestions.forEach(q => {
      const key = `${q.subject}|${q.topic}`;
      if (!map.has(key)) {
        map.set(key, {
          course: q.course,
          subject: q.subject,
          name: q.topic,
          questionCount: 0
        });
      }
      map.get(key)!.questionCount++;
    });
    return Array.from(map.values());
  }, [filteredQuestions]);

  // Compute category-level statistics for the selected area
  const areaStats = useMemo(() => {
    const config = AREA_EXAM_CONFIGS[selectedArea];
    const categoryDetails: Record<string, {
      count: number;
      weight: number;
      totalTopics: number;
      practicedTopics: number;
      correctQuestions: number;
      practicedQuestions: number;
      accuracy: number;
      pointsMax: number;
      pointsEarned: number;
    }> = {};

    // Initialize all categories in the config
    Object.keys(config).forEach(cat => {
      categoryDetails[cat] = {
        count: config[cat].count,
        weight: config[cat].weight,
        totalTopics: 0,
        practicedTopics: 0,
        correctQuestions: 0,
        practicedQuestions: 0,
        accuracy: 0,
        pointsMax: config[cat].count * config[cat].weight,
        pointsEarned: 0
      };
    });

    // Distribute database topics into their respective categories
    dbTopics.forEach(topic => {
      const mapResult = getCategoryForSubject(topic.subject, config);
      if (mapResult && categoryDetails[mapResult.category]) {
        const cat = mapResult.category;
        categoryDetails[cat].totalTopics++;

        const resultKey = `${topic.subject}|${topic.name}`;
        const result = results[resultKey];
        if (result && result.total > 0) {
          categoryDetails[cat].practicedTopics++;
          categoryDetails[cat].correctQuestions += result.score;
          categoryDetails[cat].practicedQuestions += result.total;
        }
      }
    });

    // Calculate accuracies and earned points per category
    let sumMaxPoints = 0;
    let sumEarnedPoints = 0;
    let totalPracticedQ = 0;
    let totalCorrectQ = 0;

    Object.keys(categoryDetails).forEach(cat => {
      const detail = categoryDetails[cat];
      const mastery = detail.practicedQuestions > 0 ? (detail.correctQuestions / detail.practicedQuestions) : 0;
      const coverage = detail.totalTopics > 0 ? (detail.practicedTopics / detail.totalTopics) : 0;
      const guessingProb = 0.20; // 20% success probability for unpracticed topics
      const expectedAccuracy = coverage * mastery + (1 - coverage) * guessingProb;

      detail.accuracy = expectedAccuracy * 100;
      detail.pointsEarned = detail.pointsMax * expectedAccuracy;

      sumMaxPoints += detail.pointsMax;
      sumEarnedPoints += detail.pointsEarned;
      totalPracticedQ += detail.practicedQuestions;
      totalCorrectQ += detail.correctQuestions;
    });

    return {
      categoryDetails,
      totalMaxPoints: sumMaxPoints,
      totalEarnedPoints: sumEarnedPoints,
      totalPracticedQuestions: totalPracticedQ,
      totalCorrectQuestions: totalCorrectQ,
      overallAccuracy: sumMaxPoints > 0 ? (sumEarnedPoints / sumMaxPoints) * 100 : 0
    };
  }, [selectedArea, dbTopics, results]);

  // Compute stats grouped by Course (Matemática, Ciencias, etc.)
  const courseStats = useMemo(() => {
    const config = AREA_EXAM_CONFIGS[selectedArea];
    
    return academicStructure.map(course => {
      let totalTopicsInCourse = 0;
      let practicedTopicsInCourse = 0;
      let correctQInCourse = 0;
      let practicedQInCourse = 0;
      let courseExamWeight = 0;
      let courseMaxExamPoints = 0;
      let courseEarnedExamPoints = 0;

      // Track subjects in this course to map them to categories
      const subjectDetailsList: {
        name: string;
        totalTopics: number;
        practicedTopics: number;
        correctQuestions: number;
        practicedQuestions: number;
        accuracy: number;
        weight: number;
        questionCount: number;
        categoryName: string | null;
      }[] = [];

      course.subjects.forEach(subj => {
        let totalTopicsInSubj = 0;
        let practicedTopicsInSubj = 0;
        let correctQInSubj = 0;
        let practicedQInSubj = 0;

        // Count topics
        dbTopics.forEach(topic => {
          if (topic.subject === subj) {
            totalTopicsInSubj++;
            const resultKey = `${topic.subject}|${topic.name}`;
            const result = results[resultKey];
            if (result && result.total > 0) {
              practicedTopicsInSubj++;
              correctQInSubj += result.score;
              practicedQInSubj += result.total;
            }
          }
        });

        const mapResult = getCategoryForSubject(subj, config);
        const subjWeight = mapResult ? mapResult.weight : 0;
        const subjCount = mapResult ? mapResult.count : 0;
        const categoryName = mapResult ? mapResult.category : null;

        totalTopicsInCourse += totalTopicsInSubj;
        practicedTopicsInCourse += practicedTopicsInSubj;
        correctQInCourse += correctQInSubj;
        practicedQInCourse += practicedQInSubj;

        let portionMaxPoints = 0;
        let portionQuestions = 0;

        if (mapResult) {
          // Approximate weight contribution for this subject
          // If a category has multiple subjects (e.g. Historia lists HP and HU), divide weight and count among them
          const totalSubjectsInCat = config[mapResult.category].subjects.length || 1;
          portionMaxPoints = (subjCount * subjWeight) / totalSubjectsInCat;
          portionQuestions = subjCount / totalSubjectsInCat;

          courseMaxExamPoints += portionMaxPoints;
          
          const subjMastery = practicedQInSubj > 0 ? (correctQInSubj / practicedQInSubj) : 0;
          const subjCoverage = totalTopicsInSubj > 0 ? (practicedTopicsInSubj / totalTopicsInSubj) : 0;
          const subjExpectedAccuracy = subjCoverage * subjMastery + (1 - subjCoverage) * 0.20;
          
          courseEarnedExamPoints += portionMaxPoints * subjExpectedAccuracy;
          courseExamWeight += subjWeight / totalSubjectsInCat;
        }

        const subjMastery = practicedQInSubj > 0 ? (correctQInSubj / practicedQInSubj) : 0;
        const subjCoverage = totalTopicsInSubj > 0 ? (practicedTopicsInSubj / totalTopicsInSubj) : 0;
        const subjExpectedAccuracy = subjCoverage * subjMastery + (1 - subjCoverage) * 0.20;

        subjectDetailsList.push({
          name: subj,
          totalTopics: totalTopicsInSubj,
          practicedTopics: practicedTopicsInSubj,
          correctQuestions: correctQInSubj,
          practicedQuestions: practicedQInSubj,
          accuracy: subjExpectedAccuracy * 100,
          weight: portionMaxPoints,
          questionCount: portionQuestions,
          categoryName
        });
      });

      const courseAccuracy = courseMaxExamPoints > 0 ? (courseEarnedExamPoints / courseMaxExamPoints) * 100 : 0;

      return {
        courseName: course.name,
        color: course.color,
        icon: course.icon,
        totalTopics: totalTopicsInCourse,
        practicedTopics: practicedTopicsInCourse,
        correctQuestions: correctQInCourse,
        practicedQuestions: practicedQInCourse,
        accuracy: courseAccuracy,
        maxExamPoints: courseMaxExamPoints,
        earnedExamPoints: courseEarnedExamPoints,
        examWeight: courseExamWeight,
        subjects: subjectDetailsList
      };
    }).filter(c => c.totalTopics > 0); // Only show courses that have at least one topic in the database
  }, [academicStructure, dbTopics, results, selectedArea]);

  // General summary statistics
  const generalSummary = useMemo(() => {
    const totalTopicsCount = dbTopics.length;
    const practicedTopicsCount = dbTopics.filter(t => results[`${t.subject}|${t.name}`]?.total > 0).length;
    const progressPercentage = totalTopicsCount > 0 ? (practicedTopicsCount / totalTopicsCount) * 100 : 0;

    return {
      totalTopicsCount,
      practicedTopicsCount,
      progressPercentage
    };
  }, [dbTopics, results]);

  // Ranked list of subjects by importance/weight for the selected area
  const rankedSubjects = useMemo(() => {
    const config = AREA_EXAM_CONFIGS[selectedArea];
    return Object.entries(config)
      .map(([catName, catConfig]) => {
        const detail = areaStats.categoryDetails[catName];
        return {
          category: catName,
          weight: catConfig.weight,
          count: catConfig.count,
          totalPoints: catConfig.count * catConfig.weight,
          accuracy: detail ? detail.accuracy : 0,
          practiced: detail ? detail.practicedQuestions > 0 : false,
          subjects: catConfig.subjects
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [selectedArea, areaStats]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-4 animate-fade-in">
      
      {/* User Profile Card for Practix */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">
              Perfil de Jugador (Practix)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Personaliza tu nombre e imagen de perfil para las partidas en el modo Jugar Practix.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5">
              Nombre de Jugador:
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-100 font-bold text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5">
              URL de Imagen / Avatar:
            </label>
            <input
              type="url"
              value={profileAvatarUrl}
              onChange={(e) => setProfileAvatarUrl(e.target.value)}
              placeholder="https://ejemplo.com/mi-avatar.jpg"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-100 font-bold text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-800/80 p-2.5 px-3 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5 min-w-0">
              {profileAvatarUrl.trim() ? (
                <img
                  src={profileAvatarUrl.trim()}
                  alt="Avatar"
                  className="w-9 h-9 rounded-full object-cover border-2 border-purple-500 shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-400 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-gray-400 block tracking-wider">Vista Previa</span>
                <span className="text-xs font-black text-gray-800 dark:text-gray-200 truncate block">
                  {profileName.trim() || 'Estudiante'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
            >
              Guardar
            </button>
          </div>
        </form>

        {savedAlert && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-2 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Perfil actualizado correctamente. Se usará en tu próximo Jugar Practix.</span>
          </div>
        )}
      </div>

      {/* Header section with academic area switcher AND process dropdown */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl">
        <div className="space-y-1.5 text-center lg:text-left w-full lg:w-auto">
          <div className="flex items-center gap-2 justify-center lg:justify-start flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-800 dark:text-gray-100">
              Estadísticas del Progreso
            </h2>
            {selectedProcess && (
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${getProcessBadgeStyle(selectedProcess).bg} ${getProcessBadgeStyle(selectedProcess).text} border ${getProcessBadgeStyle(selectedProcess).border}`}>
                {selectedProcess}
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-md">
            Mide tu preparación y estima tu puntaje ponderado de admisión en tiempo real según el peso de cada curso y proceso.
          </p>
        </div>

        {/* Right side controls: Proceso dropdown a un lado + Área tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto shrink-0">
          {/* Proceso selector (lista desplegable a un lado, solo con preguntas) */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest">
                Proceso:
              </label>
              {selectedProcess && (
                <button
                  type="button"
                  onClick={() => setSelectedProcess('')}
                  className="text-[10px] text-gray-400 hover:text-indigo-500 dark:text-indigo-400 font-semibold underline ml-2"
                >
                  Ver todos
                </button>
              )}
            </div>
            <select
              id="stats-process-dropdown"
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="w-full sm:w-56 bg-white dark:bg-[#020b38] border border-gray-200 dark:border-indigo-800/80 text-gray-800 dark:text-indigo-100 text-xs font-bold rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm"
            >
              <option value="" className="bg-white dark:bg-[#020b38] text-gray-800 dark:text-gray-100">Todos los procesos ({questions.length} preg.)</option>
              {processSummary.map(proc => (
                <option key={proc.name} value={proc.name} className="bg-white dark:bg-[#020b38] text-gray-800 dark:text-gray-100">
                  {proc.name} ({proc.questionCount} preg.)
                </option>
              ))}
            </select>
          </div>

          {/* Área de Postulación */}
          <div className="flex flex-col">
            <label className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest mb-1.5">
              Área de Postulación:
            </label>
            <div className="grid grid-cols-3 gap-1 bg-gray-50 dark:bg-[#020b38] p-1 rounded-xl border border-gray-200/80 dark:border-indigo-900/60">
              {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
                const isActive = selectedArea === area;
                return (
                  <button
                    key={area}
                    id={`area-tab-${area}`}
                    onClick={() => onSetSelectedArea(area)}
                    className={`py-2 px-3 rounded-lg font-black text-xs transition-all uppercase tracking-wider min-h-[38px] flex items-center justify-center ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-white'
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen conciso del proceso activo (si está seleccionado) */}
      {selectedProcess && (
        <div className="bg-indigo-50/70 dark:bg-[#020b38] border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${getProcessBadgeStyle(selectedProcess).bg} ${getProcessBadgeStyle(selectedProcess).text} border ${getProcessBadgeStyle(selectedProcess).border}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-600 dark:text-indigo-200">
                Filtrando métricas por: <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedProcess}</span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-indigo-300/80">
                Puntajes y coberturas calculados con las {filteredQuestions.length} preguntas registradas de este proceso.
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedProcess('')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Quitar filtro y ver todos
          </button>
        </div>
      )}

      {/* Main KPI scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Estimated weighted score card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-3xl p-8 shadow-2xl border border-indigo-500/30 text-white flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block backdrop-blur-sm mb-4">
              Puntaje Estimado ({selectedArea})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight">
                {(areaStats.totalEarnedPoints ?? 0).toFixed(2)}
              </span>
              <span className="text-indigo-200 text-lg font-bold">
                / {(areaStats.totalMaxPoints ?? 0).toFixed(2)} pts
              </span>
            </div>
            <p className="text-indigo-100/75 text-xs mt-3 leading-relaxed">
              Puntaje ponderado esperado considerando los temas no practicados, asumiendo una probabilidad de acierto del 20% (por azar) para estos.
            </p>
          </div>
          <div className="mt-4 relative z-10">
            <div className="w-full bg-indigo-900/40 rounded-full h-2">
              <div 
                className="bg-emerald-400 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${areaStats.totalMaxPoints > 0 ? (areaStats.totalEarnedPoints / areaStats.totalMaxPoints) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 text-white opacity-10 pointer-events-none select-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-36 h-36" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Practice cover rate scorecard */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-xl flex flex-col justify-between min-h-[220px]">
          <div>
            <span className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block mb-4">
              Cobertura de Temas
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight text-gray-800 dark:text-gray-100">
                {generalSummary.practicedTopicsCount}
              </span>
              <span className="text-gray-400 text-lg font-bold">
                / {generalSummary.totalTopicsCount} temas
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 leading-relaxed">
              Porcentaje de temas en los cuales has realizado al menos un intento de práctica.
            </p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center text-xs font-black text-gray-400 mb-1.5">
              <span>AVANCE</span>
              <span className="text-indigo-600 dark:text-indigo-450">{(generalSummary.progressPercentage ?? 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${generalSummary.progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Overall Accuracy scorecard */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-xl flex flex-col justify-between min-h-[220px]">
          <div>
            <span className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block mb-4">
              Precisión de Aciertos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight text-gray-800 dark:text-gray-100">
                {(areaStats.overallAccuracy ?? 0).toFixed(1)}%
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 leading-relaxed">
              Precisión general promedio ponderada para un examen, integrando aciertos reales y la probabilidad por azar (20%) en temas no estudiados.
            </p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center text-xs font-black text-gray-400 mb-1.5">
              <span>PRECISIÓN DE RESPUESTA</span>
              <span className={`font-black ${
                areaStats.overallAccuracy >= 75 ? 'text-emerald-500' : areaStats.overallAccuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
              }`}>{(areaStats.overallAccuracy ?? 0).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  areaStats.overallAccuracy >= 75 ? 'bg-emerald-500' : areaStats.overallAccuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${areaStats.overallAccuracy}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Course detailed statistics with expansion toggles */}
      <div>
        <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-5 border-l-4 border-indigo-600 pl-4">
          Detalle del Progreso por Cursos
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {courseStats.map(course => {
            const isExpanded = expandedCourse === course.courseName;
            
            return (
              <div 
                key={course.courseName}
                id={`course-stat-${course.courseName}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-md overflow-hidden transition-all duration-300"
              >
                {/* Main header row */}
                <div 
                  onClick={() => setExpandedCourse(isExpanded ? null : course.courseName)}
                  className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 relative`}>
                      <img 
                        src={course.icon} 
                        alt={course.courseName} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {course.courseName}
                      </h4>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wide">
                        {course.practicedTopics} / {course.totalTopics} Temas Completados
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Course Weight badge */}
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] uppercase font-black text-indigo-400 block tracking-wider leading-none">Peso Estimado</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {(course.earnedExamPoints ?? 0).toFixed(2)} <span className="text-xs font-normal text-gray-400">/ {(course.maxExamPoints ?? 0).toFixed(2)} pts</span>
                      </span>
                    </div>

                    {/* Accuracy badge */}
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] uppercase font-black text-gray-400 block tracking-wider leading-none">Precisión</span>
                      <span className={`text-sm font-black ${
                        course.practicedQuestions > 0
                          ? course.accuracy >= 75 ? 'text-emerald-500' : course.accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
                          : 'text-gray-400'
                      }`}>
                        {course.practicedQuestions > 0 ? `${(course.accuracy ?? 0).toFixed(1)}%` : 'Sin práctica'}
                      </span>
                    </div>

                    {/* Arrow toggle */}
                    <button className="text-gray-400 dark:text-gray-600 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-5 w-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded subjects detail */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-800">
                    <div className="space-y-4 max-w-4xl mx-auto">
                      <h5 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Materias de {course.courseName}</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {course.subjects.map(subj => (
                          <div 
                            key={subj.name}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h6 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{subj.name}</h6>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                                  {subj.practicedTopics} / {subj.totalTopics} Temas Practicados
                                </span>
                              </div>
                              <span className="text-[10px] bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <span>Peso: {(subj.weight ?? 0).toFixed(2)} pts</span>
                                {subj.questionCount > 0 && (
                                  <span className="text-indigo-400 dark:text-indigo-500 font-bold">({subj.questionCount % 1 === 0 ? subj.questionCount : (subj.questionCount ?? 0).toFixed(1)} preg.)</span>
                                )}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-black text-gray-400">
                                <span>ACIERTOS</span>
                                <span className={
                                  subj.practicedQuestions > 0
                                    ? subj.accuracy >= 75 ? 'text-emerald-500' : subj.accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
                                    : 'text-gray-400'
                                }>
                                  {subj.practicedQuestions > 0 ? `${(subj.accuracy ?? 0).toFixed(0)}%` : 'PENDIENTE'}
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    subj.accuracy >= 75 ? 'bg-emerald-500' : subj.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${subj.practicedQuestions > 0 ? subj.accuracy : 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Weighted Importance list for selected area */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl">
        <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-2">
          Prioridad Académica ({selectedArea})
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6">
          Ranking de temas ordenados de mayor a menor según el peso total asignado por pregunta en el examen oficial de admisión para {selectedArea}.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <th className="pb-4 pt-2 font-black">Categoría / Temas</th>
                <th className="pb-4 pt-2 font-black text-center">Preguntas</th>
                <th className="pb-4 pt-2 font-black text-center">Peso Unitario</th>
                <th className="pb-4 pt-2 font-black text-center">Puntaje Total</th>
                <th className="pb-4 pt-2 font-black text-right">Tu Rendimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-sm">
              {rankedSubjects.map((item, idx) => {
                const percentage = item.accuracy;
                const statusColor = percentage >= 75 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-rose-500';
                
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-all">
                    <td className="py-4">
                      <div className="font-bold text-gray-800 dark:text-gray-200">{item.category}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        Aplica a: {item.subjects.join(', ')}
                      </div>
                    </td>
                    <td className="py-4 text-center font-black text-gray-500 dark:text-gray-400">
                      {item.count}
                    </td>
                    <td className="py-4 text-center font-mono text-xs text-gray-600 dark:text-gray-400">
                      {(item.weight ?? 0).toFixed(4)}
                    </td>
                    <td className="py-4 text-center font-black text-indigo-600 dark:text-indigo-400">
                      {(item.totalPoints ?? 0).toFixed(2)} pts
                    </td>
                    <td className="py-4 text-right">
                      {item.practiced ? (
                        <span className={`font-black ${statusColor}`}>
                          {(percentage ?? 0).toFixed(1)}% Acierto
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-xs font-bold uppercase tracking-wider">
                          Sin Práctica
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
