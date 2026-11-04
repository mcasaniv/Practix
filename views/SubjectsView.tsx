import React from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { CourseStructure, Question, TopicResult, SavedExam, TargetArea } from '../types';
import { matchesQuestionArea, getAreaBadgeStyle } from '../utils';

interface SubjectsViewProps {
  courseName: string;
  questions?: Question[];
  results?: Record<string, TopicResult>;
  savedExams?: SavedExam[];
  incorrectQuestionIds?: string[];
  selectedArea?: TargetArea;
  onSelectSubject: (subject: string) => void;
  academicStructure?: CourseStructure[];
}

const SubjectsView: React.FC<SubjectsViewProps> = ({ 
  courseName, 
  questions = [],
  savedExams = [],
  incorrectQuestionIds = [],
  selectedArea = 'Biomédicas',
  onSelectSubject,
  academicStructure = ACADEMIC_STRUCTURE
}) => {
  const course = academicStructure.find(c => c.name === courseName);

  if (!course) return <div className="text-gray-600 dark:text-gray-300 p-4">Curso no encontrado.</div>;

  const currentArea: TargetArea = (selectedArea === 'Ingenierías' || selectedArea === 'Sociales') ? selectedArea : 'Biomédicas';
  const areaBadge = getAreaBadgeStyle(currentArea);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-md ${course.color.split(' ')[0]} dark:opacity-90 shrink-0`}>
            <img 
              src={course.icon} 
              alt={courseName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Curso</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${areaBadge.bg} ${areaBadge.text} ${areaBadge.border} dark:text-white`}>
                {areaBadge.icon} Área: {selectedArea}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white truncate">
              Materias de {courseName}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-gray-400 dark:text-white/80 truncate">
              {courseName === 'Exámenes' 
                ? 'Accede a tus simulacros dados, historial y resoluciones' 
                : `Prácticas semanales adaptadas para el área de ${selectedArea}`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {course.subjects.map((subject) => {
          const subjectQuestions = questions.filter(q => q.subject === subject);
          const subjectQuestionsCount = subjectQuestions.length;
          const areaQuestionsCount = subjectQuestions.filter(q => matchesQuestionArea(q, currentArea)).length;
          const isSavedExamsSubject = subject === 'Exámenes Rendidos' || subject === 'Exámenes Simulacros';
          const isOfficialExamsSubject = subject === 'Simulacros Oficiales';
          const incorrectSet = new Set(incorrectQuestionIds);
          const mistakesCount = subjectQuestions.filter(q => incorrectSet.has(q.id)).length;
          
          return (
            <div 
              key={subject}
              onClick={() => onSelectSubject(subject)}
              className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer group transition-all flex items-center justify-between min-h-[58px]"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {subject}
                  </h3>
                  {mistakesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-white border border-emerald-200 dark:border-slate-700 shrink-0">
                      {mistakesCount} {mistakesCount === 1 ? 'por reforzar' : 'por reforzar'}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-gray-400 dark:text-white/80">
                  {isSavedExamsSubject
                    ? (savedExams.length > 0 
                        ? `${savedExams.length} ${savedExams.length === 1 ? 'examen registrado' : 'exámenes registrados'}` 
                        : 'Historial de simulacros y exámenes')
                    : isOfficialExamsSubject
                    ? (subjectQuestionsCount > 0
                        ? `${subjectQuestionsCount} preguntas de exámenes pasados`
                        : 'Subir y practicar exámenes pasados')
                    : (subjectQuestionsCount > 0 
                        ? (areaQuestionsCount !== subjectQuestionsCount 
                            ? `${areaQuestionsCount} para ${currentArea} (${subjectQuestionsCount} total)`
                            : `${subjectQuestionsCount} preguntas disponibles`)
                        : 'Sin preguntas registradas')}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-white border border-indigo-100 dark:border-slate-700 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600 dark:group-hover:text-white transition-all shrink-0">
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
