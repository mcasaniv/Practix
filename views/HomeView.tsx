
import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure } from '../types';

interface HomeViewProps {
  onSelectCourse: (course: string) => void;
  onStartMegaQuiz: (mode?: 'GENERAL' | 'CUSTOM') => void;
  academicStructure?: CourseStructure[];
}

const HomeView: React.FC<HomeViewProps> = ({ 
  onSelectCourse, 
  onStartMegaQuiz,
  academicStructure = ACADEMIC_STRUCTURE
}) => {
  return (
    <div>
      <div className="mb-12">
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-6 border-l-4 border-indigo-600 pl-4">Simulacros de Admisión</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            onClick={() => onStartMegaQuiz('GENERAL')}
            className="relative overflow-hidden group cursor-pointer bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-3xl p-8 shadow-2xl hover:scale-[1.01] transition-all border border-indigo-400/30 dark:border-indigo-500/50"
          >
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block backdrop-blur-sm">Simulacro General</span>
                <h3 className="text-3xl font-black text-white mb-2">Examen 80 Preguntas</h3>
                <p className="text-indigo-100/80 leading-relaxed text-sm">Simulacro completo con todos los cursos y pesos oficiales. 100 puntos en juego.</p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <div className="text-2xl font-black text-white">100.00 pts</div>
                <button className="bg-white text-indigo-700 px-6 py-2 rounded-xl font-black hover:bg-gray-100 transition-colors shadow-lg">
                  Iniciar
                </button>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 text-[120px] opacity-10 rotate-12 pointer-events-none">📝</div>
          </div>

          <div 
            onClick={() => onStartMegaQuiz('CUSTOM')}
            className="relative overflow-hidden group cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl hover:scale-[1.02] transition-all border border-gray-100 dark:border-slate-800"
          >
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2">Examen Personalizado</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Toma el control. Elige los cursos que quieres practicar hoy sin ninguna restricción.</p>
              </div>
              <button className="text-indigo-600 font-bold flex items-center gap-2 group-hover:gap-4 transition-all uppercase tracking-widest text-xs">
                Configurar Examen <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
            </div>
            <div className="absolute -bottom-6 -right-6 text-[100px] opacity-5 rotate-12 pointer-events-none text-indigo-600">⚙️</div>
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-8 border-l-4 border-indigo-600 pl-4">Panel por Cursos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {academicStructure.map((course) => (
          <div 
            key={course.name}
            onClick={() => onSelectCourse(course.name)}
            className="group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
          >
            <div className={`w-14 h-14 rounded-2xl overflow-hidden mb-4 ${course.color.split(' ')[0]} dark:opacity-90 relative shadow-inner`}>
              <img 
                src={course.icon} 
                alt={course.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1 group-hover:text-indigo-600 transition-colors">{course.name}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{course.subjects.length} Materias disponibles</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {course.subjects.slice(0, 3).map(s => (
                <span key={s} className="px-2 py-0.5 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500 text-[10px] rounded uppercase font-bold tracking-wider">
                  {s}
                </span>
              ))}
              {course.subjects.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500 text-[10px] rounded font-bold">
                  +{course.subjects.length - 3}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeView;
