import React, { useState, useEffect } from 'react';
import { UserProfile, TargetArea, CourseStructure } from '../types';
import { getAreaBadgeStyle } from '../utils';
import { ACADEMIC_STRUCTURE } from '../constants';

interface ProfileViewProps {
  userProfile?: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  selectedArea: TargetArea;
  onSetSelectedArea: (area: TargetArea) => void;
  totalPracticed: number;
  totalFlashcardsPracticed: number;
  savedExamsCount: number;
  courseCovers?: Record<string, string>;
  onSaveCourseCovers?: (covers: Record<string, string>) => void;
  academicStructure?: CourseStructure[];
  onToast?: (message: string) => void;
  onNavigateToHome?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  selectedArea,
  onSetSelectedArea,
  totalPracticed,
  totalFlashcardsPracticed,
  savedExamsCount,
  courseCovers = {},
  onSaveCourseCovers,
  academicStructure,
  onToast,
  onNavigateToHome
}) => {
  const [name, setName] = useState(userProfile?.name || 'Estudiante Practix');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [targetArea, setTargetArea] = useState<TargetArea>(userProfile?.targetArea || selectedArea || 'Biomédicas');
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  // Course covers management in Profile
  const [tempCovers, setTempCovers] = useState<Record<string, string>>(courseCovers || {});

  const courseCoversStr = JSON.stringify(courseCovers);
  useEffect(() => {
    if (courseCovers) {
      setTempCovers(courseCovers);
    }
  }, [courseCoversStr]);

  const coursesList = academicStructure && academicStructure.length > 0 ? academicStructure : ACADEMIC_STRUCTURE;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (onToast) onToast('La imagen debe pesar menos de 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        if (onToast) onToast('¡Foto cargada exitosamente!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCoverChange = (courseName: string, val: string) => {
    setTempCovers(prev => ({
      ...prev,
      [courseName]: val
    }));
  };

  const handleCoverFileUpload = (courseName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (onToast) onToast('La imagen de portada debe pesar menos de 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const updated = {
          ...tempCovers,
          [courseName]: result
        };
        setTempCovers(updated);
        if (onSaveCourseCovers) {
          onSaveCourseCovers(updated);
        }
        if (onToast) onToast(`¡Portada de ${courseName} actualizada!`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveSingleCover = (courseName: string) => {
    if (onSaveCourseCovers) {
      const updated = {
        ...tempCovers,
        [courseName]: tempCovers[courseName] ? tempCovers[courseName].trim() : ''
      };
      if (!updated[courseName]) {
        delete updated[courseName];
      }
      onSaveCourseCovers(updated);
      if (onToast) onToast(`Portada de ${courseName} guardada correctamente.`);
    }
  };

  const handleResetSingleCover = (courseName: string) => {
    const updated = { ...tempCovers };
    delete updated[courseName];
    setTempCovers(updated);
    if (onSaveCourseCovers) {
      onSaveCourseCovers(updated);
    }
    if (onToast) onToast(`Portada de ${courseName} restablecida al diseño predeterminado.`);
  };

  useEffect(() => {
    if (userProfile) {
      if (userProfile.name) setName(userProfile.name);
      if (userProfile.avatarUrl !== undefined) setAvatarUrl(userProfile.avatarUrl);
      if (userProfile.targetArea) setTargetArea(userProfile.targetArea);
    }
  }, [userProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || 'Estudiante Practix';
    const finalAvatar = avatarUrl.trim();

    onUpdateProfile({
      name: finalName,
      avatarUrl: finalAvatar,
      targetArea: targetArea
    });

    onSetSelectedArea(targetArea);

    setShowSavedFeedback(true);
    if (onToast) {
      onToast(`¡Perfil guardado! Área configurada: ${targetArea}.`);
    }

    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 4000);
  };

  const handleSelectArea = (area: TargetArea) => {
    setTargetArea(area);
  };

  const activeBadge = getAreaBadgeStyle(targetArea);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2 sm:py-4 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-lg">
              {avatarUrl.trim() ? (
                <img
                  src={avatarUrl.trim()}
                  alt="Avatar"
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://i.imgur.com/hqV69r2.png';
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-white/20 flex items-center justify-center font-black text-2xl text-white">
                  {name.trim() ? name.trim().charAt(0).toUpperCase() : 'P'}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-100">
                  Perfil de Postulante
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${activeBadge.bg} ${activeBadge.text} border ${activeBadge.border}`}>
                  {activeBadge.icon} Postula a: {targetArea}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {name.trim() || 'Estudiante Practix'}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                Adapta tus prácticas semanales, simulacros y estadísticas a tu área universitaria.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 bg-black/20 backdrop-blur-md p-3 rounded-2xl border border-white/10 self-start md:self-auto">
            <div className="text-center px-2">
              <span className="text-[9px] uppercase font-bold text-indigo-200 block">Preguntas</span>
              <span className="text-base sm:text-lg font-black font-mono">{totalPracticed}</span>
            </div>
            <div className="w-px h-7 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[9px] uppercase font-bold text-indigo-200 block">Flashcards</span>
              <span className="text-base sm:text-lg font-black font-mono">{totalFlashcardsPracticed}</span>
            </div>
            <div className="w-px h-7 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[9px] uppercase font-bold text-indigo-200 block">Exámenes</span>
              <span className="text-base sm:text-lg font-black font-mono">{savedExamsCount}</span>
            </div>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -bottom-8 -right-8 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Target Area Question */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-xl space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100">
                  ¿A qué área postulas?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selecciona tu área (Biomédicas, Ingenierías o Sociales) para priorizar las preguntas y materias de tus prácticas oficiales.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Biomédicas */}
            <div
              onClick={() => handleSelectArea('Biomédicas')}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                targetArea === 'Biomédicas'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10 scale-[1.01]'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-2xl shadow-sm">
                    🧬
                  </div>
                  {targetArea === 'Biomédicas' && (
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Seleccionada
                    </span>
                  )}
                </div>

                <h4 className="font-black text-lg text-gray-800 dark:text-gray-100">
                  Área Biomédicas
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Ciencias de la Salud, Médicas y Biológicas.
                </p>

                <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 space-y-1.5 text-xs">
                  <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-wider">
                    Carreras del Área:
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    Medicina, Enfermería, Biología, Nutrición e Ingeniería Pesquera.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 font-bold">
                Mayor peso en: <span className="text-emerald-600 dark:text-emerald-400 font-black">Biología (9 preg), Química (6 preg), Física</span>
              </div>
            </div>

            {/* Card 2: Ingenierías */}
            <div
              onClick={() => handleSelectArea('Ingenierías')}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                targetArea === 'Ingenierías'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/10 scale-[1.01]'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-2xl shadow-sm">
                    ⚙️
                  </div>
                  {targetArea === 'Ingenierías' && (
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Seleccionada
                    </span>
                  )}
                </div>

                <h4 className="font-black text-lg text-gray-800 dark:text-gray-100">
                  Área Ingenierías
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Ciencias Físico-Matemáticas, Exactas y Tecnológicas.
                </p>

                <div className="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/40 space-y-1.5 text-xs">
                  <div className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                    Carreras del Área:
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    Ing. de Sistemas, Civil, Minas, Industrial, Mecánica, Eléctrica, Electrónica, Arquitectura, etc.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 font-bold">
                Mayor peso en: <span className="text-blue-600 dark:text-blue-400 font-black">Matemática (Álgebra, Geometría), Física (7 preg)</span>
              </div>
            </div>

            {/* Card 3: Sociales */}
            <div
              onClick={() => handleSelectArea('Sociales')}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                targetArea === 'Sociales'
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-lg shadow-purple-500/10 scale-[1.01]'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-700/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-2xl shadow-sm">
                    ⚖️
                  </div>
                  {targetArea === 'Sociales' && (
                    <span className="bg-purple-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Seleccionada
                    </span>
                  )}
                </div>

                <h4 className="font-black text-lg text-gray-800 dark:text-gray-100">
                  Área Sociales
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Humanidades, Jurídicas, Administrativas y Sociales.
                </p>

                <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-900/40 space-y-1.5 text-xs">
                  <div className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                    Carreras del Área:
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    Derecho, Psicología, Economía, Administración, Contabilidad, Educación, Historia, etc.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 font-bold">
                Mayor peso en: <span className="text-purple-600 dark:text-purple-400 font-black">Historia (8 preg), Lenguaje (8 preg), Literatura, Geografía</span>
              </div>
            </div>
          </div>

          {/* Context note on 3 practices per week */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-900/60 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl shrink-0">💡</span>
            <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
              <strong className="font-black">Filtro por Área Activo:</strong> Al elegir tu área ({targetArea}), el temario y las prácticas semanales darán prioridad a las preguntas correspondientes a tu examen de admisión oficial de Ceprunsa.
            </div>
          </div>
        </div>

        {/* Section 2: Player Identity Form */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-xl space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100">
                  Datos Personales y Foto de Perfil
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configura tu nombre y foto de perfil. Puedes subir una imagen desde tu dispositivo o pegar un enlace.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5 tracking-wider">
                  Tu Nombre o Apodo:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-100 font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5 tracking-wider">
                  Foto o Imagen de Perfil:
                </label>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Subir foto desde este dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                      JPG, PNG, WEBP (&lt;2MB)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1">
                      O pega el enlace URL de una imagen:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://ejemplo.com/tu-foto.jpg"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-100 font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors shrink-0"
                          title="Quitar foto"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                Vista Previa del Perfil
              </span>

              <div className="relative">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-xl bg-gray-200 dark:bg-slate-700 flex items-center justify-center relative">
                  {avatarUrl.trim() ? (
                    <img
                      src={avatarUrl.trim()}
                      alt="Avatar Preview"
                      className="absolute inset-0 w-full h-full object-cover object-center block"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://i.imgur.com/hqV69r2.png';
                      }}
                    />
                  ) : (
                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      {name.trim() ? name.trim().charAt(0).toUpperCase() : 'P'}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 text-xl bg-white dark:bg-slate-800 p-1 rounded-full shadow-md">
                  {activeBadge.icon}
                </div>
              </div>

              <div>
                <h4 className="text-base font-black text-gray-800 dark:text-gray-100">
                  {name.trim() || 'Estudiante Practix'}
                </h4>
                <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${activeBadge.bg} ${activeBadge.text} border ${activeBadge.border}`}>
                    Postulante a {targetArea}
                  </span>
                </div>
              </div>

              <div className="w-full border-t border-gray-200 dark:border-slate-700 pt-3 text-[11px] text-gray-500 dark:text-gray-400">
                Tu perfil representa tu progreso y personaliza tus prácticas oficiales.
              </div>
            </div>
          </div>

          {/* Save Profile Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
            {onNavigateToHome && (
              <button
                type="button"
                onClick={onNavigateToHome}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold text-sm transition-all"
              >
                ← Volver al Inicio
              </button>
            )}

            <button
              type="submit"
              className="w-full sm:w-auto ml-auto bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black px-8 py-3.5 rounded-xl text-sm uppercase tracking-wider transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar Perfil y Área</span>
            </button>
          </div>

          {showSavedFeedback && (
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 p-4 rounded-2xl text-emerald-800 dark:text-emerald-200 font-bold text-sm flex items-center gap-3 animate-fade-in shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <span>¡Perfil actualizado con éxito! Se aplicó el área de <strong>{targetArea}</strong> a tus prácticas y estadísticas.</span>
              </div>
            </div>
          )}
        </div>

      </form>

      {/* Section 3: Portadas de los Cursos (Moved from Admin Panel to Profile) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-xl space-y-6">
        <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100">
                Portadas para los Cursos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Personaliza la imagen de portada de cada curso. Puedes pegar un link o subir una imagen desde tu dispositivo. Si lo dejas vacío o usas "Restablecer", se mostrará la imagen oficial por defecto.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {coursesList.map((course) => {
            const currentUrl = tempCovers[course.name] ?? '';
            const defaultCover = course.icon || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400';
            const displayCover = currentUrl || defaultCover;

            return (
              <div 
                key={course.name} 
                className="flex flex-col sm:flex-row gap-4 p-5 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800/80 transition-shadow hover:shadow-md"
              >
                {/* Thumbnail Preview */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-slate-700 shadow-inner relative group bg-gray-150 dark:bg-slate-800 flex items-center justify-center">
                  <img 
                    src={displayCover} 
                    alt={course.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300';
                    }}
                  />
                  <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-[2px] text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                    {currentUrl ? 'Personalizada' : 'Por Defecto'}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex-grow flex flex-col justify-between gap-2.5">
                  <div>
                    <h4 className="font-extrabold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                      <span>{course.name}</span>
                      {currentUrl && (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          Editada
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">
                      {course.subjects.join(', ')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {/* Link Input & File Upload */}
                    <div className="flex gap-2 items-center">
                      <input 
                        type="url" 
                        value={currentUrl} 
                        onChange={(e) => handleCoverChange(course.name, e.target.value)} 
                        placeholder="Link URL (https://...)" 
                        className="flex-1 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 outline-none dark:text-gray-200 focus:border-indigo-500 dark:focus:border-indigo-600 transition-colors"
                      />
                      <label 
                        className="cursor-pointer p-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-colors shrink-0"
                        title="Subir imagen desde tu dispositivo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleCoverFileUpload(course.name, e)} 
                        />
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveSingleCover(course.name)}
                        className="flex-grow py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Guardar Portada
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetSingleCover(course.name)}
                        className="py-2 px-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 text-xs font-bold transition-all active:scale-[0.98]"
                        title="Restaurar portada por defecto"
                      >
                        Restablecer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
