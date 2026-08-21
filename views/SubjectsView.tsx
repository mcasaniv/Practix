
import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure, Question, TopicResult } from '../types';

interface SubjectsViewProps {
  courseName: string;
  questions?: Question[];
  results?: Record<string, TopicResult>;
  onSelectSubject: (subject: string) => void;
  academicStructure?: CourseStructure[];
}

const SubjectsView: React.FC<SubjectsViewProps> = ({ 
  courseName, 
  questions = [],
  onSelectSubject,
  academicStructure = ACADEMIC_STRUCTURE
}) => {
  const course = academicStructure.find(c => c.name === courseName);

  if (!course) return <div className="dark:text-white">Curso no encontrado.</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-xl overflow-hidden shadow-md ${course.color.split(' ')[0]} dark:opacity-90`}>
          <img 
            src={course.icon} 
            alt={courseName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100">Materias de {courseName}</h2>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Selecciona una materia para acceder a sus prácticas y simulacros</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {course.subjects.map((subject) => {
          return (
            <div 
              key={subject}
              onClick={() => onSelectSubject(subject)}
              className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md cursor-pointer group transition-all flex items-center justify-between"
            >
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {subject}
              </h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 group-hover:translate-x-1 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubjectsView;
