
import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure } from '../types';

interface SubjectsViewProps {
  courseName: string;
  onSelectSubject: (subject: string) => void;
  academicStructure?: CourseStructure[];
}

const SubjectsView: React.FC<SubjectsViewProps> = ({ 
  courseName, 
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
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Materias de {courseName}</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {course.subjects.map((subject) => (
          <div 
            key={subject}
            onClick={() => onSelectSubject(subject)}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md cursor-pointer group transition-all"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{subject}</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">Selecciona para ver los temas disponibles y realizar simulacros.</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectsView;
