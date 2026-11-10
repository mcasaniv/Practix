import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure, CustomDeck } from '../types';

interface HomeViewProps {
  onSelectCourse: (course: string) => void;
  onStartMegaQuiz: (mode?: 'GENERAL' | 'CUSTOM') => void;
  onNavigateToTheory?: () => void;
  onNavigateToCustomDecks?: () => void;
  onViewSavedExams?: () => void;
  savedExamsCount?: number;
  theoryNotesCount?: number;
  customDecks?: CustomDeck[];
  academicStructure?: CourseStructure[];
}

const HomeView: React.FC<HomeViewProps> = ({ 
  onSelectCourse, 
  onStartMegaQuiz,
  onNavigateToTheory,
  onNavigateToCustomDecks,
  onViewSavedExams,
  savedExamsCount = 0,
  theoryNotesCount = 0,
  customDecks = [],
  academicStructure = ACADEMIC_STRUCTURE
}) => {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Admission Exam Banners */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-7 bg-indigo-600 rounded-full shrink-0" />
            <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">
              Simulacros de Admisión
            </h2>
          </div>
          {onViewSavedExams && (
            <button
              onClick={onViewSavedExams}
              className="self-start sm:self-auto text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 min-h-[40px] border-none active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Exámenes Rendidos</span>
              {savedExamsCount > 0 && (
                <span className="bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {savedExamsCount}
                </span>
              )}
            </button>
          )}
        </div>
        
        <div>
          {/* Card: Generar Examen (Simulacro oficial y personalizado) */}
          <div 
            onClick={() => onStartMegaQuiz('CUSTOM')}
            className="relative overflow-hidden group cursor-pointer bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-3xl p-5 sm:p-7 shadow-xl hover:shadow-2xl active:scale-[0.99] transition-all border border-indigo-400/30 text-white flex flex-col justify-between min-h-[200px]"
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm border border-white/20">
                  Simulacros Oficiales
                </span>
                <span className="text-xs font-bold text-indigo-200">
                  Ceprunsa • Todas las Fases
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">
                Generar examen
              </h3>
              <p className="text-indigo-100/90 text-xs sm:text-sm leading-relaxed max-w-2xl">
                Configura simulacros oficiales de 80 preguntas por semanas o elige materias específicas. Filtra por procesos anteriores o puntajes ponderados oficiales.
              </p>
            </div>

            <div className="relative z-10 shrink-0 flex items-center justify-between pt-4 mt-2 border-t border-indigo-400/20">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
                80 Preguntas o Por Cursos
              </span>
              <span className="bg-white hover:bg-indigo-50 text-indigo-700 font-black px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all group-hover:scale-105 min-h-[42px]">
                <span>Generar examen</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </div>

            <div className="absolute -bottom-6 -right-6 text-white opacity-10 pointer-events-none select-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-40 h-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Academic Structure Grid */}
      <div>
        <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
          <div className="w-2 h-7 bg-indigo-600 rounded-full shrink-0" />
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">
            Panel por Cursos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
          {academicStructure.map((course) => (
            <div 
              key={course.name}
              onClick={() => onSelectCourse(course.name)}
              className="group cursor-pointer bg-white dark:bg-[#020b38] rounded-2xl shadow-sm border border-gray-100 dark:border-indigo-900/50 p-4 sm:p-5 hover:shadow-xl hover:dark:border-indigo-600/70 active:scale-[0.98] transition-all overflow-hidden flex flex-col justify-between min-h-[160px]"
            >
              <div>
                <div className="flex items-center gap-3.5 mb-3">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden ${course.color.split(' ')[0]} dark:opacity-90 relative shadow-inner shrink-0`}>
                    <img 
                      src={course.icon} 
                      alt={course.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {course.name}
                    </h3>
                    <p className="text-gray-400 dark:text-indigo-300/80 text-xs font-semibold">
                      {course.subjects.length} Materias
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-50 dark:border-indigo-900/40 flex flex-wrap gap-1.5 items-center">
                {course.subjects.slice(0, 3).map(s => (
                  <span key={s} className="px-2 py-0.5 bg-gray-50 dark:bg-indigo-950/60 text-gray-500 dark:text-indigo-300 text-[10px] rounded-md font-bold tracking-tight truncate max-w-[100px] border border-transparent dark:border-indigo-900/40">
                    {s}
                  </span>
                ))}
                {course.subjects.length > 3 && (
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10px] rounded-md font-black border border-transparent dark:border-indigo-800/60">
                    +{course.subjects.length - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeView;

