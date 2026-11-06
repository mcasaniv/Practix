import React from 'react';

export interface FlashcardTopicItem {
  name: string;
  isDefault: boolean;
  count: number;
  easy: number;
  medium: number;
  rated: number;
  order: number;
  imageCount: number;
  percent: number | null;
}

interface FlashcardTopicCardProps {
  topic: FlashcardTopicItem;
  index: number;
  nonDefaultIndex: number;
  nonDefaultCount: number;
  selectedCourseName: string;
  selectedSubjectName: string;
  onStartPlay: (course: string, subject: string, topic?: string) => void;
  onMoveTopic?: (topicName: string, subjectName: string, courseName: string, direction: 'UP' | 'DOWN') => void;
  onUploadOcclusionForTopic?: (topicName: string) => void;
  onCreateFormulaForTopic?: (topicName: string) => void;
}

export const FlashcardTopicCard: React.FC<FlashcardTopicCardProps> = ({
  topic,
  index,
  nonDefaultIndex,
  nonDefaultCount,
  selectedCourseName,
  selectedSubjectName,
  onStartPlay,
  onMoveTopic,
  onUploadOcclusionForTopic,
  onCreateFormulaForTopic
}) => {
  const mastery = topic.percent;

  let cardBgBorder = "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-800 dark:text-white hover:border-indigo-300 dark:hover:border-slate-700";
  if (mastery !== null) {
    if (mastery >= 80) {
      cardBgBorder = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 shadow-sm text-gray-900 dark:text-white hover:border-emerald-400";
    } else if (mastery >= 50) {
      cardBgBorder = "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 shadow-sm text-gray-900 dark:text-white hover:border-amber-400";
    } else {
      cardBgBorder = "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/80 shadow-sm text-gray-900 dark:text-white hover:border-rose-400";
    }
  }

  return (
    <div 
      id={`flashcard-topic-card-${index}`}
      onClick={() => onStartPlay(selectedCourseName, selectedSubjectName, topic.isDefault ? undefined : topic.name)}
      className={`flashcard-topic-component rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer group transition-all flex flex-col sm:flex-row sm:items-center justify-between border gap-3 sm:gap-4 ${cardBgBorder}`}
    >
      <div className="flex items-start sm:items-center gap-3.5 flex-grow min-w-0">
        {/* Topic Badge Number or Star Icon */}
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 border shadow-sm ${
          mastery === null
            ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-white border-indigo-100 dark:border-slate-700'
            : mastery >= 80
              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
              : mastery >= 50
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
        }`}>
          {topic.isDefault ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500 fill-amber-400" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          ) : (
            <span className="font-black">
              {nonDefaultIndex === -1 ? '?' : (nonDefaultIndex + 1)}
            </span>
          )}
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-base sm:text-lg font-black text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors break-words">
              {topic.name}
            </h4>
            
            {/* Mastery status badge */}
            {mastery !== null ? (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                mastery >= 80 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-white border-emerald-300 dark:border-emerald-700'
                  : mastery >= 50
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-white border-amber-300 dark:border-amber-700'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-white border-rose-300 dark:border-rose-700'
              }`}>
                <span>{mastery}% Dominio</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold text-indigo-700 dark:text-white bg-indigo-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200/80 dark:border-slate-700">
                Nuevo
              </span>
            )}

            {/* Occlusion image count badge */}
            {topic.imageCount > 0 && (
              <span className="text-[10px] font-bold text-purple-700 dark:text-white bg-purple-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-purple-200/80 dark:border-slate-700 flex items-center gap-1">
                <span>🖼️</span>
                <span className="dark:text-white">{topic.imageCount} con imagen</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500 dark:text-white font-medium">
              {topic.count} {topic.count === 1 ? 'tarjeta disponible' : 'tarjetas disponibles'}
            </p>
            {/* Quick link to add image with occlusion to this topic */}
            {onUploadOcclusionForTopic && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadOcclusionForTopic(topic.isDefault ? '' : topic.name);
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
                title="Subir imagen con oclusión a este tema"
              >
                <span>+ Imagen con oclusión</span>
              </button>
            )}

            {/* Quick link to create formula flashcard for this topic */}
            {onCreateFormulaForTopic && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFormulaForTopic(topic.isDefault ? '' : topic.name);
                }}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline flex items-center gap-1"
                title="Armar fórmula con bloques para este tema"
              >
                <span>🧩 + Armar fórmula</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right controls: Up / Down order buttons */}
      <div 
        className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800" 
        onClick={(e) => e.stopPropagation()}
      >
        {onMoveTopic && !topic.isDefault && (
          <div className="flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800 shrink-0">
            {/* Up Button */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveTopic(topic.name, selectedSubjectName, selectedCourseName, 'UP');
              }}
              disabled={nonDefaultIndex === 0}
              className="p-2 min-h-[40px] min-w-[36px] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors text-gray-600 dark:text-white font-bold"
              title="Mover Arriba"
            >
              ▲
            </button>

            {/* Down Button */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveTopic(topic.name, selectedSubjectName, selectedCourseName, 'DOWN');
              }}
              disabled={nonDefaultIndex === nonDefaultCount - 1}
              className="p-2 min-h-[40px] min-w-[36px] flex items-center justify-center border-l border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors text-gray-600 dark:text-white font-bold"
              title="Mover Abajo"
            >
              ▼
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
