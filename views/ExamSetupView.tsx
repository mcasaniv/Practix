
import React, { useState } from 'react';
import { ExamMode } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';

interface ExamSetupViewProps {
  mode: ExamMode;
  selectedArea: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onSetSelectedArea: (area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  onStart: (selectedSubjects: string[]) => void;
  onCancel: () => void;
}

const ExamSetupView: React.FC<ExamSetupViewProps> = ({ 
  mode, 
  selectedArea,
  onSetSelectedArea,
  onStart, 
  onCancel 
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  
  const activeAreaConfig = AREA_EXAM_CONFIGS[selectedArea] || AREA_EXAM_CONFIGS['Biomédicas'];
  const subjects = Object.keys(activeAreaConfig);

  const toggleSubject = (subject: string) => {
    if (selected.includes(subject)) {
      setSelected(prev => prev.filter(s => s !== subject));
    } else {
      setSelected(prev => [...prev, subject]);
    }
  };

  const handleStart = () => {
    if (selected.length > 0) {
      onStart(selected);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-8 md:p-12">
        <button onClick={onCancel} className="mb-8 text-gray-400 hover:text-indigo-600 font-bold flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>

        <div className="text-center mb-8">
          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-2.5 inline-block">
            Simulacro Personalizado
          </span>
          <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 mb-3 tracking-tight">
            Examen Personalizado
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-[15px] max-w-lg mx-auto leading-relaxed">
            Selecciona los cursos que deseas incluir en este examen. Los pesos y preguntas coincidirán con tu área escogida.
          </p>
        </div>

        {/* Selector de Área */}
        <div className="flex flex-col items-center mb-10 max-w-md mx-auto">
          <label className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2.5">
            Área Académica Seleccionada:
          </label>
          <div className="grid grid-cols-3 gap-2 w-full bg-gray-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800">
            {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(area => {
              const isActive = selectedArea === area;
              return (
                <button
                  key={area}
                  onClick={() => onSetSelectedArea(area)}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {subjects.map(subject => {
            const isSelected = selected.includes(subject);
            const count = activeAreaConfig[subject]?.count || 0;
            return (
              <button
                key={subject}
                onClick={() => toggleSubject(subject)}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-md' 
                    : 'border-gray-100 dark:border-slate-800 hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`font-bold transition-colors ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    {subject}
                  </span>
                  {isSelected && (
                    <svg className="w-5 h-5 text-indigo-600 animate-in zoom-in duration-200" fill="currentColor" viewBox="0 0 20 20">
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

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Materias Seleccionadas</span>
            <div className="text-2xl font-black text-gray-800 dark:text-gray-100">
              {selected.length} <span className="text-sm font-normal text-gray-500">cursos</span>
            </div>
          </div>
          
          <button 
            disabled={selected.length === 0}
            onClick={handleStart}
            className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
              selected.length > 0 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95' 
                : 'bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            🚀 Iniciar Examen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamSetupView;
