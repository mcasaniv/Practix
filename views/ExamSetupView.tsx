import React, { useState, useMemo } from 'react';
import { ExamMode, Question } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';
import { getQuestionWeek, getQuestionProcess, getProcessBadgeStyle, getProcessShortName, getAvailableProcesses } from '../utils';

interface ExamSetupViewProps {
  mode: ExamMode;
  questions?: Question[];
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  onStart: (selectedSubjects?: string[], selectedWeeks?: number[], selectedProcesses?: string[]) => void;
  onCancel: () => void;
}

const ExamSetupView: React.FC<ExamSetupViewProps> = ({ 
  mode, 
  questions = [],
  selectedArea,
  onSetSelectedArea,
  onStart, 
  onCancel 
}) => {
  const [setupType, setSetupType] = useState<'WEEKS_80' | 'CUSTOM_SUBJECTS'>('WEEKS_80');
  const [selectedPreset, setSelectedPreset] = useState<'W1' | 'W1_2' | 'W1_3' | 'W1_4' | 'ALL' | 'CUSTOM'>('W1');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([1]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]); // Empty = All 3 processes
  
  const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
  const allSubjects = Object.keys(activeAreaConfig);

  // Available processes dynamically from questions
  const availableProcesses = useMemo(() => {
    return getAvailableProcesses(questions);
  }, [questions]);

  // Available processes with question counts
  const processStats = useMemo(() => {
    const counts: Record<string, number> = {};
    availableProcesses.forEach(p => {
      counts[p] = 0;
    });
    questions.forEach(q => {
      const p = getQuestionProcess(q);
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [questions, availableProcesses]);

  // Determine available weeks in database
  const availableWeeks = useMemo(() => {
    const weekSet = new Set<number>();
    questions.forEach(q => {
      const w = getQuestionWeek(q);
      if (w && w > 0) weekSet.add(w);
    });
    const sorted = Array.from(weekSet).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return [1, 2, 3, 4, 5, 6, 7, 8];
    }
    return sorted;
  }, [questions]);

  // Plant emojis exclusively for weeks
  const getWeekPlantEmoji = (weekNum: number) => {
    const plantEmojis = ['🌱', '🌿', '🌳', '🌲', '🌻', '🌴', '🌺', '🌾', '🍀', '🎋', '🪴', '🍁'];
    return plantEmojis[(weekNum - 1) % plantEmojis.length] || '🌱';
  };

  // Calculate question count in selected weeks & processes
  const matchingQuestionsCount = useMemo(() => {
    return questions.filter(q => {
      const matchWeek = selectedWeeks.length === 0 || (getQuestionWeek(q) !== undefined && selectedWeeks.includes(getQuestionWeek(q)!));
      const matchProc = selectedProcesses.length === 0 || selectedProcesses.includes(getQuestionProcess(q));
      return matchWeek && matchProc;
    }).length;
  }, [questions, selectedWeeks, selectedProcesses]);

  const handleSelectPreset = (preset: 'W1' | 'W1_2' | 'W1_3' | 'W1_4' | 'ALL' | 'CUSTOM') => {
    setSelectedPreset(preset);
    if (preset === 'W1') {
      setSelectedWeeks([1]);
    } else if (preset === 'W1_2') {
      setSelectedWeeks([1, 2]);
    } else if (preset === 'W1_3') {
      setSelectedWeeks([1, 2, 3]);
    } else if (preset === 'W1_4') {
      setSelectedWeeks([1, 2, 3, 4]);
    } else if (preset === 'ALL') {
      setSelectedWeeks([]);
    }
  };

  const toggleWeek = (weekNum: number) => {
    setSelectedPreset('CUSTOM');
    setSelectedWeeks(prev => {
      if (prev.includes(weekNum)) {
        const next = prev.filter(w => w !== weekNum);
        return next;
      } else {
        return [...prev, weekNum].sort((a, b) => a - b);
      }
    });
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subject)) {
        return prev.filter(s => s !== subject);
      } else {
        return [...prev, subject];
      }
    });
  };

  const handleSelectAllSubjects = () => {
    setSelectedSubjects([...allSubjects]);
  };

  const handleClearSubjects = () => {
    setSelectedSubjects([]);
  };

  const handleToggleProcess = (processName: string) => {
    setSelectedProcesses(prev => {
      if (prev.includes(processName)) {
        return prev.filter(p => p !== processName);
      } else {
        return [...prev, processName];
      }
    });
  };

  const handleSelectSingleProcess = (processName: string) => {
    setSelectedProcesses([processName]);
  };

  const handleSelectAllProcesses = () => {
    setSelectedProcesses([]);
  };

  const handleStartExam = () => {
    const processesToPass = selectedProcesses.length > 0 ? selectedProcesses : undefined;
    if (setupType === 'WEEKS_80') {
      // 80 questions with all subjects of the area, filtered by weeks and process
      onStart(undefined, selectedWeeks.length > 0 ? selectedWeeks : undefined, processesToPass);
    } else {
      // Custom subjects without weeks filter
      if (selectedSubjects.length === 0) return;
      onStart(selectedSubjects, undefined, processesToPass);
    }
  };

  const getPresetLabel = () => {
    if (selectedWeeks.length === 0) return 'Todas las semanas';
    if (selectedWeeks.length === 1) return `Semana ${selectedWeeks[0]}`;
    if (selectedWeeks.length === 2 && selectedWeeks[0] === 1 && selectedWeeks[1] === 2) return 'Semana 1 y 2';
    if (selectedWeeks.length === 3 && selectedWeeks[0] === 1 && selectedWeeks[1] === 2 && selectedWeeks[2] === 3) return 'Semana 1, 2 y 3';
    if (selectedWeeks.length === 4 && selectedWeeks[0] === 1 && selectedWeeks[1] === 2 && selectedWeeks[2] === 3 && selectedWeeks[3] === 4) return 'Semana 1 a 4';
    return `Semanas ${selectedWeeks.join(', ')}`;
  };

  const getProcessLabel = () => {
    if (selectedProcesses.length === 0) return 'Todos los procesos';
    if (selectedProcesses.length === 1) return getProcessShortName(selectedProcesses[0]);
    return `${selectedProcesses.length} procesos seleccionados`;
  };

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-6 px-1 sm:px-4">
      <div className="bg-white dark:bg-[#020b38] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 dark:border-indigo-900/60 p-4 sm:p-6 md:p-10">
        <button 
          onClick={onCancel} 
          className="mb-4 sm:mb-6 text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/50 font-bold flex items-center gap-2 transition-all text-sm min-h-[44px] px-3.5 py-1.5 rounded-xl shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>

        <div className="text-center mb-6 sm:mb-8">
          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-2.5 inline-block">
            Simulacro Personalizado
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 mb-2 tracking-tight">
            Configurar Examen
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Rinde un simulacro de 80 preguntas por semanas o personaliza los cursos que deseas evaluar. Los exámenes se guardarán en tu registro de <span className="font-bold text-gray-700 dark:text-gray-200">Exámenes Simulacros</span>.
          </p>
        </div>

        {/* Selector de Proceso de Admisión */}
        <div className="mb-6 sm:mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Proceso de Admisión:</span>
            </label>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[180px] sm:max-w-none text-right">
              {getProcessLabel()}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-indigo-950/50 p-2.5 rounded-2xl border border-gray-100 dark:border-indigo-900/40">
            <button
              type="button"
              onClick={handleSelectAllProcesses}
              className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 min-h-[44px] ${
                selectedProcesses.length === 0
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-indigo-100 border border-gray-200/60 dark:border-indigo-800/60'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Todos los Procesos</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${selectedProcesses.length === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-indigo-900/60 text-gray-600 dark:text-indigo-300'}`}>
                {questions.length}
              </span>
            </button>

            {availableProcesses.map(proc => {
              const isSelected = selectedProcesses.length === 1 && selectedProcesses[0] === proc;
              const isMultiSelected = selectedProcesses.includes(proc) && selectedProcesses.length > 1;
              const active = isSelected || isMultiSelected;
              const style = getProcessBadgeStyle(proc);
              const count = processStats[proc] || 0;
              const shortName = getProcessShortName(proc);

              return (
                <button
                  key={proc}
                  type="button"
                  onClick={() => {
                    if (selectedProcesses.length === 0) {
                      handleSelectSingleProcess(proc);
                    } else if (selectedProcesses.length === 1 && selectedProcesses[0] === proc) {
                      handleSelectAllProcesses();
                    } else {
                      handleToggleProcess(proc);
                    }
                  }}
                  className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 min-h-[44px] ${
                    active
                      ? `${style.bg} ${style.text} ${style.border} border-2 shadow-md`
                      : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 hover:border-indigo-400 border border-gray-200/60 dark:border-indigo-800/60'
                  }`}
                >
                  <span className="text-sm">{style.icon}</span>
                  <span>{shortName}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    active 
                      ? 'bg-white/30 text-current' 
                      : count > 0 
                      ? 'bg-gray-100 dark:bg-indigo-900/60 text-gray-700 dark:text-indigo-200' 
                      : 'bg-gray-50 dark:bg-indigo-950 text-gray-400 dark:text-indigo-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-indigo-300/80 text-center mt-2">
            Tip: Toca un proceso para evaluarte solo con ese banco (ej. 2026, 2025, 2017), o selecciona "Todos los Procesos" para combinarlos.
          </p>
        </div>

        {/* Selector de Área */}
        <div className="flex flex-col items-center mb-8 max-w-md mx-auto">
          <label className="text-xs font-black uppercase text-gray-400 dark:text-indigo-300 tracking-wider mb-2">
            Área Académica:
          </label>
          <div className="grid grid-cols-3 gap-2 w-full bg-gray-50 dark:bg-indigo-950/60 p-1.5 rounded-2xl border border-gray-100 dark:border-indigo-900/50">
            {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
              const isActive = selectedArea === area;
              return (
                <button
                  key={area}
                  onClick={() => onSetSelectedArea(area)}
                  className={`py-2 px-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-indigo-950 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-white bg-transparent hover:bg-white/60 dark:hover:bg-indigo-900/40'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modalidad de Examen Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 bg-gray-100 dark:bg-indigo-950/70 p-1.5 rounded-2xl border border-gray-200/80 dark:border-indigo-900/50">
          <button
            onClick={() => setSetupType('WEEKS_80')}
            className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all ${
              setupType === 'WEEKS_80'
                ? 'bg-white dark:bg-[#030d42] text-indigo-600 dark:text-indigo-300 shadow-md border border-gray-100 dark:border-indigo-800'
                : 'text-gray-500 dark:text-indigo-300/80 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-left leading-tight">
              <span className="block font-black">Simulacro 80 Preguntas</span>
              <span className="text-[11px] font-medium text-gray-400 dark:text-indigo-300/70">Filtrado por Semanas</span>
            </div>
          </button>

          <button
            onClick={() => setSetupType('CUSTOM_SUBJECTS')}
            className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all ${
              setupType === 'CUSTOM_SUBJECTS'
                ? 'bg-white dark:bg-[#030d42] text-indigo-600 dark:text-indigo-300 shadow-md border border-gray-100 dark:border-indigo-800'
                : 'text-gray-500 dark:text-indigo-300/80 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div className="text-left leading-tight">
              <span className="block font-black">Personalizado por Cursos</span>
              <span className="text-[11px] font-medium text-gray-400 dark:text-indigo-300/70">Seleccionar Materias</span>
            </div>
          </button>
        </div>

        {/* CONTENIDO MODO 1: SIMULACRO 80 POR SEMANAS */}
        {setupType === 'WEEKS_80' && (
          <div className="space-y-6 mb-8 animate-in fade-in duration-200">
            {/* Selector de semanas con botón de Todas */}
            <div className="bg-gray-50 dark:bg-indigo-950/40 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-indigo-900/60 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-200/70 dark:border-indigo-800/60">
                <div>
                  <h3 className="text-base font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Seleccionar Semanas del Simulacro</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-indigo-300/80 mt-0.5">
                    Elige qué semanas deseas incluir en la evaluación de 80 preguntas
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleSelectPreset('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border-2 ${
                      selectedWeeks.length === 0
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 border-gray-200 dark:border-indigo-800/80 hover:border-indigo-400'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Todas las Semanas</span>
                  </button>
                  <span className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                    Filtro: {getPresetLabel()}
                  </span>
                </div>
              </div>

              {/* Grid espacioso y claro con botones de semanas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
                {availableWeeks.map(weekNum => {
                  const isIndividuallySelected = selectedWeeks.includes(weekNum);
                  return (
                    <button
                      key={weekNum}
                      onClick={() => toggleWeek(weekNum)}
                      className={`p-4 sm:p-5 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-2 border-2 relative overflow-hidden group ${
                        isIndividuallySelected && selectedWeeks.length > 0
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none scale-[1.02]'
                          : selectedWeeks.length === 0
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/60'
                          : 'bg-white dark:bg-[#030d42] text-gray-700 dark:text-indigo-200 border-gray-200 dark:border-indigo-800/70 hover:border-indigo-400 hover:shadow-md'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 transition-transform group-hover:scale-110">
                        {getWeekPlantEmoji(weekNum)}
                      </span>
                      <div>
                        <span className="font-black text-sm sm:text-base block">Semana {weekNum}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                          isIndividuallySelected && selectedWeeks.length > 0
                            ? 'bg-white/20 text-white'
                            : selectedWeeks.length === 0
                            ? 'bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                        }`}>
                          {selectedWeeks.length === 0 ? 'Incluida (Todas)' : isIndividuallySelected ? 'Seleccionada' : 'Inactiva'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumen del Examen de 80 */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-black text-indigo-950 dark:text-indigo-200 text-base flex items-center gap-2 flex-wrap">
                    <span>Simulacro 80 Preguntas ({getPresetLabel()})</span>
                    <span className="text-xs bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-md">
                      {getProcessLabel()}
                    </span>
                  </h4>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                    Estructura oficial del Área {selectedArea} • 80 preguntas • 100 puntos en juego
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>• {allSubjects.length} cursos evaluados según pesos oficiales</span>
                <span>• {matchingQuestionsCount} preguntas disponibles en las semanas seleccionadas</span>
                <span>• Se guardará en <strong className="text-gray-700 dark:text-gray-200">Exámenes Simulacros</strong></span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-indigo-200/50 dark:border-indigo-800/40 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Si una materia aún no tiene preguntas en la semana elegida, el sistema la completará automáticamente con la semana más próxima para garantizar las 80 preguntas.</span>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO MODO 2: PERSONALIZADO POR CURSOS */}
        {setupType === 'CUSTOM_SUBJECTS' && (
          <div className="space-y-6 mb-8 animate-in fade-in duration-200">
            {/* Selección de materias */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">
                  Selecciona los Cursos a Incluir:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllSubjects}
                    className="text-xs text-indigo-600 hover:underline font-bold"
                  >
                    Todos
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    onClick={handleClearSubjects}
                    className="text-xs text-gray-400 hover:underline font-bold"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allSubjects.map(subject => {
                  const isSelected = selectedSubjects.includes(subject);
                  const count = activeAreaConfig[subject]?.count || 0;
                  return (
                    <button
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-md' 
                          : 'border-gray-100 dark:border-slate-800 hover:border-indigo-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`font-bold text-sm transition-colors ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {subject}
                        </span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-indigo-600 animate-in zoom-in duration-200 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="text-[10px] uppercase font-black text-gray-400">
                        {count} {count === 1 ? 'pregunta' : 'preguntas'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer y Botón de Inicio */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">
              Configuración de Evaluación ({getProcessLabel()})
            </span>
            <div className="text-xl font-black text-gray-800 dark:text-gray-100">
              {setupType === 'WEEKS_80' ? (
                <>80 Preguntas <span className="text-sm font-normal text-indigo-600 dark:text-indigo-400">({getPresetLabel()})</span></>
              ) : (
                <>{selectedSubjects.length} <span className="text-sm font-normal text-gray-500">cursos seleccionados</span></>
              )}
            </div>
          </div>
          
          <button 
            disabled={setupType === 'CUSTOM_SUBJECTS' && selectedSubjects.length === 0}
            onClick={handleStartExam}
            className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 ${
              (setupType === 'WEEKS_80' || selectedSubjects.length > 0)
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95' 
                : 'bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {setupType === 'WEEKS_80' 
                ? `Iniciar Simulacro 80 (${getPresetLabel()})` 
                : 'Iniciar Examen Personalizado'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamSetupView;
