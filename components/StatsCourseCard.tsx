import React from 'react';

export interface SubjectDetail {
  name: string;
  totalTopics: number;
  practicedTopics: number;
  correctQuestions: number;
  practicedQuestions: number;
  accuracy: number;
  weight: number;
  questionCount: number;
  categoryName: string | null;
}

export interface CourseStatData {
  courseName: string;
  color: string;
  icon: string;
  totalTopics: number;
  practicedTopics: number;
  correctQuestions: number;
  practicedQuestions: number;
  accuracy: number;
  maxExamPoints: number;
  earnedExamPoints: number;
  examWeight: number;
  subjects: SubjectDetail[];
}

interface StatsCourseCardProps {
  course: CourseStatData;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const StatsCourseCard: React.FC<StatsCourseCardProps> = ({
  course,
  isExpanded,
  onToggleExpand
}) => {
  return (
    <div 
      id={`stats-course-card-${course.courseName}`}
      className="stats-course-component bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-md overflow-hidden transition-all duration-300"
    >
      {/* Main header row */}
      <div 
        onClick={onToggleExpand}
        className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 relative">
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
            <span className="text-[10px] text-gray-400 dark:text-gray-400 font-bold uppercase tracking-wide">
              {course.practicedTopics} / {course.totalTopics} Temas Completados
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
          {/* Course Weight badge */}
          <div className="text-left sm:text-right">
            <span className="text-[9px] uppercase font-black text-indigo-400 block tracking-wider leading-none">
              Peso Estimado
            </span>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
              {(course.earnedExamPoints ?? 0).toFixed(2)}{' '}
              <span className="text-xs font-normal text-gray-400">
                / {(course.maxExamPoints ?? 0).toFixed(2)} pts
              </span>
            </span>
          </div>

          {/* Accuracy badge */}
          <div className="text-left sm:text-right">
            <span className="text-[9px] uppercase font-black text-gray-400 block tracking-wider leading-none">
              Precisión
            </span>
            <span className={`text-sm font-black ${
              course.practicedQuestions > 0
                ? course.accuracy >= 75 ? 'text-emerald-500' : course.accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
                : 'text-gray-400 dark:text-gray-400'
            }`}>
              {course.practicedQuestions > 0 ? `${(course.accuracy ?? 0).toFixed(1)}%` : 'Sin práctica'}
            </span>
          </div>

          {/* Arrow toggle */}
          <button 
            type="button"
            aria-label="Alternar materias"
            className="text-gray-400 dark:text-gray-400 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
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
        <div className="px-5 sm:px-6 pb-6 pt-3 bg-gray-50/50 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800">
          <div className="space-y-4 max-w-4xl mx-auto">
            <h5 className="text-xs font-black uppercase text-gray-400 dark:text-gray-400 tracking-widest mb-3">
              Materias de {course.courseName}
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.subjects.map(subj => (
                <div 
                  key={subj.name}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h6 className="font-bold text-gray-700 dark:text-gray-100 text-sm">
                        {subj.name}
                      </h6>
                      <span className="text-[10px] text-gray-400 dark:text-gray-400 font-bold">
                        {subj.practicedTopics} / {subj.totalTopics} Temas Practicados
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <span>Peso: {(subj.weight ?? 0).toFixed(2)} pts</span>
                      {subj.questionCount > 0 && (
                        <span className="text-indigo-400 dark:text-indigo-400 font-bold">
                          ({subj.questionCount % 1 === 0 ? subj.questionCount : (subj.questionCount ?? 0).toFixed(1)} preg.)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black text-gray-400 dark:text-gray-400">
                      <span>ACIERTOS</span>
                      <span className={
                        subj.practicedQuestions > 0
                          ? subj.accuracy >= 75 ? 'text-emerald-500' : subj.accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
                          : 'text-gray-400 dark:text-gray-400'
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
};
