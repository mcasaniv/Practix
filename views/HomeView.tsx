import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure, CustomDeck } from '../types';

interface HomeViewProps {
  onSelectCourse: (course: string) => void;
  onStartMegaQuiz: (mode?: 'GENERAL' | 'CUSTOM') => void;
  onNavigateToCustomDecks?: () => void;
  onViewSavedExams?: () => void;
  savedExamsCount?: number;
  customDecks?: CustomDeck[];
  academicStructure?: CourseStructure[];
}

const HomeView: React.FC<HomeViewProps> = ({ 
  onSelectCourse, 
  onStartMegaQuiz,
  onNavigateToCustomDecks,
  onViewSavedExams,
  savedExamsCount = 0,
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* General 80Q Exam Card */}
          <div 
            onClick={() => onStartMegaQuiz('GENERAL')}
            className="relative overflow-hidden group cursor-pointer bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-3xl p-5 sm:p-7 md:p-8 shadow-xl hover:shadow-2xl active:scale-[0.99] transition-all border border-indigo-400/30 text-white"
          >
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[190px] sm:min-h-[220px]">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                  <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-sm">
                    Simulacro Oficial
                  </span>
                  <span className="text-xs font-black text-indigo-200 bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                    Ceprunsa • Todas las Fases
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                  Examen 80 Preguntas
                </h3>
                <p className="text-indigo-100/80 leading-relaxed text-xs sm:text-sm max-w-md">
                  Simulacro completo con todos los cursos y pesos oficiales. 100 puntos en juego con temporizador y solucionario.
                </p>
              </div>

              <div className="mt-6 sm:mt-8 flex items-center justify-between gap-4 pt-4 border-t border-white/10">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Puntaje Máximo</span>
                  <span className="text-xl sm:text-2xl font-black text-white">100.00 pts</span>
                </div>
                <button 
                  className="bg-white text-indigo-700 px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-indigo-50 active:scale-95 transition-all shadow-lg min-h-[44px] flex items-center gap-2"
                  aria-label="Iniciar examen de 80 preguntas"
                >
                  <span>Iniciar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 text-white opacity-10 pointer-events-none select-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          {/* Custom Exam Card */}
          <div 
            onClick={() => onStartMegaQuiz('CUSTOM')}
            className="relative overflow-hidden group cursor-pointer bg-white dark:bg-[#020b38] rounded-3xl p-5 sm:p-7 md:p-8 shadow-md hover:shadow-xl active:scale-[0.99] transition-all border border-gray-100 dark:border-indigo-900/60 hover:dark:border-indigo-700/80"
          >
            <div className="relative z-10 h-full flex flex-col justify-between min-h-[190px] sm:min-h-[220px]">
              <div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-inner border border-indigo-100 dark:border-indigo-800/60">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 leading-tight">
                  Examen Personalizado
                </h3>
                <p className="text-gray-500 dark:text-indigo-200/80 text-xs sm:text-sm leading-relaxed max-w-md">
                  Elige materias, semanas y filtra por procesos anteriores (2026, 2025, 2017) o el actual 2027.
                </p>
              </div>

              <div className="mt-6 sm:mt-8 pt-4 border-t border-gray-100 dark:border-indigo-900/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-indigo-300 uppercase tracking-wider">
                  Filtro por procesos y semanas
                </span>
                <span className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all group-hover:scale-105 min-h-[40px]">
                  <span>Configurar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 text-indigo-600 opacity-5 pointer-events-none select-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Mis Mazos Personalizados (Sin Cepre) Banner */}
      {onNavigateToCustomDecks && (
        <div 
          onClick={onNavigateToCustomDecks}
          className="cursor-pointer bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg hover:shadow-xl active:scale-[0.99] transition-all border border-purple-500/30 relative overflow-hidden group"
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Libre • Sin Cepre
                </span>
                {customDecks.length > 0 && (
                  <span className="text-xs font-bold text-purple-200">
                    {customDecks.length} {customDecks.length === 1 ? 'mazo creado' : 'mazos creados'}
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>Mis Mazos de Preguntas Propios</span>
              </h3>
              <p className="text-xs sm:text-sm text-purple-100/80 leading-relaxed">
                Crea tus propios bancos de preguntas independientes para repasar a tu ritmo. Agrupa preguntas difíciles de procesos anteriores o añade tus propios apuntes.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">
              <span className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2">
                <span>Explorar Mazos</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </div>
          </div>

          <div className="absolute -bottom-6 -right-6 text-white opacity-10 pointer-events-none select-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
      )}

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
                  <div className={`w-12 h-12 rounded-xl overflow-hidden ${course.color.split(' ')[0]} dark:opacity-90 relative shadow-inner shrink-0`}>
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

