import React, { useMemo, useState } from 'react';
import { AREA_EXAM_CONFIGS } from '../constants';
import { Question, TopicResult, CourseStructure } from '../types';

interface StatsViewProps {
  questions: Question[];
  results: Record<string, TopicResult>;
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  academicStructure: CourseStructure[];
}

export const StatsView: React.FC<StatsViewProps> = ({
  questions,
  results,
  selectedArea,
  onSetSelectedArea,
  academicStructure
}) => {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

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

  // Group all unique topics available in the database from questions
  const dbTopics = useMemo(() => {
    const map = new Map<string, { course: string; subject: string; name: string; questionCount: number }>();
    questions.forEach(q => {
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
  }, [questions]);

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
      
      {/* Header section with academic area switcher */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-850 shadow-xl">
        <div className="space-y-1.5 text-center md:text-left">
          <h2 className="text-3xl font-black tracking-tight text-gray-800 dark:text-gray-100">
            Estadísticas del Progreso
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
            Mide tu preparación y estima tu puntaje ponderado de admisión en tiempo real según el peso de cada curso.
          </p>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <label className="text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-300 tracking-widest mb-2.5">
            Área de Postulación seleccionada:
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-gray-50 dark:bg-slate-800/80 p-1 rounded-2xl border border-gray-100 dark:border-slate-850">
            {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
              const isActive = selectedArea === area;
              return (
                <button
                  key={area}
                  id={`area-tab-${area}`}
                  onClick={() => onSetSelectedArea(area)}
                  className={`py-2 px-4 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main KPI scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Estimated weighted score card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-850 rounded-3xl p-8 shadow-2xl border border-indigo-500/30 text-white flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block backdrop-blur-sm mb-4">
              Puntaje Estimado ({selectedArea})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight">
                {areaStats.totalEarnedPoints.toFixed(2)}
              </span>
              <span className="text-indigo-200 text-lg font-bold">
                / {areaStats.totalMaxPoints.toFixed(2)} pts
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
          <div className="absolute -bottom-6 -right-6 text-[110px] opacity-10 rotate-12 pointer-events-none select-none">
            🎯
          </div>
        </div>

        {/* Practice cover rate scorecard */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-850 shadow-xl flex flex-col justify-between min-h-[220px]">
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
              <span className="text-indigo-600 dark:text-indigo-450">{generalSummary.progressPercentage.toFixed(1)}%</span>
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-850 shadow-xl flex flex-col justify-between min-h-[220px]">
          <div>
            <span className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block mb-4">
              Precisión de Aciertos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight text-gray-800 dark:text-gray-100">
                {areaStats.overallAccuracy.toFixed(1)}%
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
              }`}>{areaStats.overallAccuracy.toFixed(0)}%</span>
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-850 shadow-md overflow-hidden transition-all duration-300"
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
                        {course.earnedExamPoints.toFixed(2)} <span className="text-xs font-normal text-gray-400">/ {course.maxExamPoints.toFixed(2)} pts</span>
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
                        {course.practicedQuestions > 0 ? `${course.accuracy.toFixed(1)}%` : 'Sin práctica'}
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
                  <div className="px-6 pb-6 pt-2 bg-gray-50/50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-850">
                    <div className="space-y-4 max-w-4xl mx-auto">
                      <h5 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Materias de {course.courseName}</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {course.subjects.map(subj => (
                          <div 
                            key={subj.name}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-850 shadow-sm space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h6 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{subj.name}</h6>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                                  {subj.practicedTopics} / {subj.totalTopics} Temas Practicados
                                </span>
                              </div>
                              <span className="text-[10px] bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <span>Peso: {subj.weight.toFixed(2)} pts</span>
                                {subj.questionCount > 0 && (
                                  <span className="text-indigo-400 dark:text-indigo-500 font-bold">({subj.questionCount % 1 === 0 ? subj.questionCount : subj.questionCount.toFixed(1)} preg.)</span>
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
                                  {subj.practicedQuestions > 0 ? `${subj.accuracy.toFixed(0)}%` : 'PENDIENTE'}
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
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-850 shadow-xl">
        <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-2">
          Prioridad Académica ({selectedArea})
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6">
          Ranking de temas ordenados de mayor a menor según el peso total asignado por pregunta en el examen oficial de admisión para {selectedArea}.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-850 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <th className="pb-4 pt-2 font-black">Categoría / Temas</th>
                <th className="pb-4 pt-2 font-black text-center">Preguntas</th>
                <th className="pb-4 pt-2 font-black text-center">Peso Unitario</th>
                <th className="pb-4 pt-2 font-black text-center">Puntaje Total</th>
                <th className="pb-4 pt-2 font-black text-right">Tu Rendimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-850 text-sm">
              {rankedSubjects.map((item, idx) => {
                const percentage = item.accuracy;
                const statusColor = percentage >= 75 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-rose-500';
                
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-850/20 transition-all">
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
                      {item.weight.toFixed(4)}
                    </td>
                    <td className="py-4 text-center font-black text-indigo-600 dark:text-indigo-400">
                      {item.totalPoints.toFixed(2)} pts
                    </td>
                    <td className="py-4 text-right">
                      {item.practiced ? (
                        <span className={`font-black ${statusColor}`}>
                          {percentage.toFixed(1)}% Acierto
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
