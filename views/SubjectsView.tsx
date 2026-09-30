import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure, Question, TopicResult, SavedExam } from '../types';

interface SubjectsViewProps {
  courseName: string;
  questions?: Question[];
  results?: Record<string, TopicResult>;
  savedExams?: SavedExam[];
  onSelectSubject: (subject: string) => void;
  academicStructure?: CourseStructure[];
}

const SubjectsView: React.FC<SubjectsViewProps> = ({ 
  courseName, 
  questions = [],
  savedExams = [],
  onSelectSubject,
  academicStructure = ACADEMIC_STRUCTURE
}) => {
  const course = academicStructure.find(c => c.name === courseName);

  if (!course) return <div className="text-gray-600 dark:text-gray-300 p-4">Curso no encontrado.</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3.5 sm:gap-4">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-md ${course.color.split(' ')[0]} dark:opacity-90 shrink-0`}>
          <img 
            src={course.icon} 
            alt={courseName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 truncate">
            Materias de {courseName}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500 truncate">
            {courseName === 'Exámenes' 
              ? 'Accede a tus simulacros dados, historial y resoluciones' 
              : 'Selecciona una materia para acceder a sus semanas, prácticas y simulacros'}
          </p>
        </div>
      </div>
      
      {/* Subjects Grid */}
      <div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl"
        style={{ backgroundColor: '#020126' }}
      >
        {course.subjects.map((subject, index) => {
          const subjectQuestionsCount = questions.filter(q => q.subject === subject).length;
          const isSavedExamsSubject = subject === 'Exámenes Rendidos' || subject === 'Exámenes Simulacros';
          const isOfficialExamsSubject = subject === 'Simulacros Oficiales';
          
          return (
            <div 
              key={subject}
              onClick={() => onSelectSubject(subject)}
              className="bg-white dark:bg-[#020b38] border border-gray-100 dark:border-indigo-900/50 hover:dark:border-indigo-600/70 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer group transition-all flex items-center justify-between min-h-[58px]"
            >
              <div 
                className="min-w-0 pr-3 rounded-xl p-1.5"
                style={index === 1 ? { backgroundColor: '#000523' } : undefined}
              >
                <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                  {subject}
                </h3>
                <span className="text-[11px] font-bold text-gray-400 dark:text-indigo-300/80">
                  {isSavedExamsSubject
                    ? (savedExams.length > 0 
                        ? `${savedExams.length} ${savedExams.length === 1 ? 'examen registrado' : 'exámenes registrados'}` 
                        : 'Historial de simulacros y exámenes')
                    : isOfficialExamsSubject
                    ? (subjectQuestionsCount > 0
                        ? `${subjectQuestionsCount} preguntas de exámenes pasados`
                        : 'Subir y practicar exámenes pasados')
                    : (subjectQuestionsCount > 0 
                        ? `${subjectQuestionsCount} preguntas disponibles` 
                        : 'Sin preguntas registradas')}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600 dark:group-hover:text-white transition-all shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubjectsView;
