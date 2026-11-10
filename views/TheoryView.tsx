import React, { useState, useMemo, useRef } from 'react';
import { TheoryNote } from '../types';
import { ACADEMIC_STRUCTURE } from '../constants';

interface TheoryViewProps {
  theoryNotes: TheoryNote[];
  onSaveNote: (note: TheoryNote) => void;
  onUpdateNote: (note: TheoryNote) => void;
  onDeleteNote: (noteId: string) => void;
  onNavigateHome: () => void;
  onToast: (msg: string) => void;
}

export const TheoryView: React.FC<TheoryViewProps> = ({
  theoryNotes = [],
  onSaveNote,
  onUpdateNote,
  onDeleteNote,
  onNavigateHome,
  onToast
}) => {
  const [selectedCourse, setSelectedCourse] = useState<string>('TODOS');
  const [selectedSubject, setSelectedSubject] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'NONE' | 'CREATE' | 'EDIT' | 'VIEW'>('NONE');
  const [editingNote, setEditingNote] = useState<TheoryNote | null>(null);
  const [viewingNote, setViewingNote] = useState<TheoryNote | null>(null);

  // Form states
  const [formCourse, setFormCourse] = useState<string>(ACADEMIC_STRUCTURE[0].name);
  const [formSubject, setFormSubject] = useState<string>(ACADEMIC_STRUCTURE[0].subjects[0]);
  const [formTopic, setFormTopic] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available subjects for the selected filter course
  const currentCourseStructure = useMemo(() => {
    return ACADEMIC_STRUCTURE.find(c => c.name === selectedCourse);
  }, [selectedCourse]);

  const availableSubjectsForFilter = useMemo(() => {
    if (selectedCourse === 'TODOS') {
      const all: string[] = [];
      ACADEMIC_STRUCTURE.forEach(c => all.push(...c.subjects));
      return Array.from(new Set(all));
    }
    return currentCourseStructure ? currentCourseStructure.subjects : [];
  }, [selectedCourse, currentCourseStructure]);

  // Available subjects for the form modal
  const formSubjects = useMemo(() => {
    const courseObj = ACADEMIC_STRUCTURE.find(c => c.name === formCourse);
    return courseObj ? courseObj.subjects : [];
  }, [formCourse]);

  // Handle image upload with auto-downscaling
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setIsProcessingImage(false);
        return;
      }

      // Optimize image size using offscreen canvas to prevent bloating storage
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setFormImageUrl(compressed);
        } else {
          setFormImageUrl(result);
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setFormImageUrl(result);
        setIsProcessingImage(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const openCreateModal = () => {
    const defaultCourse = selectedCourse !== 'TODOS' ? selectedCourse : ACADEMIC_STRUCTURE[0].name;
    const courseObj = ACADEMIC_STRUCTURE.find(c => c.name === defaultCourse);
    const defaultSubject = selectedSubject !== 'TODAS' && courseObj?.subjects.includes(selectedSubject)
      ? selectedSubject
      : (courseObj?.subjects[0] || 'General');

    setFormCourse(defaultCourse);
    setFormSubject(defaultSubject);
    setFormTopic('');
    setFormTitle('');
    setFormContent('');
    setFormImageUrl('');
    setFormTags('');
    setEditingNote(null);
    setActiveModal('CREATE');
  };

  const openEditModal = (note: TheoryNote) => {
    setEditingNote(note);
    setFormCourse(note.course);
    setFormSubject(note.subject);
    setFormTopic(note.topic || '');
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormImageUrl(note.imageUrl || '');
    setFormTags(note.tags ? note.tags.join(', ') : '');
    setActiveModal('EDIT');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onToast('Por favor escribe un título para el apunte.');
      return;
    }
    if (!formContent.trim() && !formImageUrl.trim()) {
      onToast('Añade texto explicativo o una imagen para guardar el apunte.');
      return;
    }

    const parsedTags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    if (activeModal === 'EDIT' && editingNote) {
      const updated: TheoryNote = {
        ...editingNote,
        course: formCourse,
        subject: formSubject,
        topic: formTopic.trim() || undefined,
        title: formTitle.trim(),
        content: formContent.trim(),
        imageUrl: formImageUrl.trim() || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        updatedAt: Date.now()
      };
      onUpdateNote(updated);
      onToast('¡Apunte actualizado correctamente!');
      if (viewingNote?.id === editingNote.id) {
        setViewingNote(updated);
      }
    } else {
      const newNote: TheoryNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        course: formCourse,
        subject: formSubject,
        topic: formTopic.trim() || undefined,
        title: formTitle.trim(),
        content: formContent.trim(),
        imageUrl: formImageUrl.trim() || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      onSaveNote(newNote);
      onToast('¡Nuevo apunte guardado en Teoría!');
    }

    setActiveModal('NONE');
    setEditingNote(null);
  };

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return theoryNotes.filter(note => {
      if (selectedCourse !== 'TODOS' && note.course !== selectedCourse) return false;
      if (selectedSubject !== 'TODAS' && note.subject !== selectedSubject) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inTopic = (note.topic || '').toLowerCase().includes(q);
        const inTags = (note.tags || []).some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTopic && !inTags) return false;
      }
      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [theoryNotes, selectedCourse, selectedSubject, searchQuery]);

  return (
    <div className="min-h-screen bg-[#000a14] text-slate-100 pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-indigo-950/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <button
              onClick={onNavigateHome}
              className="hover:underline flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Inicio
            </button>
            <span>/</span>
            <span className="flex items-center gap-1.5 text-cyan-300">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Carpeta de Teoría
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Carpeta de Teoría & Apuntes</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-medium">
              {theoryNotes.length} {theoryNotes.length === 1 ? 'apunte' : 'apuntes'}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organiza tus resúmenes, esquemas, fórmulas clave e imágenes explicativas por curso y materia.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-950/40 hover:shadow-cyan-900/50 transition-all border border-cyan-400/30 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Nuevo Apunte de Teoría</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#001228]/80 backdrop-blur border border-indigo-950/80 rounded-2xl p-4 mb-6 shadow-xl space-y-4">
        {/* Search Input */}
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, tema, concepto, fórmula o etiqueta..."
            className="w-full pl-11 pr-10 py-2.5 bg-[#000a14] border border-indigo-950/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Course Filter Horizontal Scroll */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Cursos</span>
            {selectedCourse !== 'TODOS' && (
              <button
                onClick={() => { setSelectedCourse('TODOS'); setSelectedSubject('TODAS'); }}
                className="text-cyan-400 hover:underline text-[11px] normal-case"
              >
                Ver todos
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => { setSelectedCourse('TODOS'); setSelectedSubject('TODAS'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                selectedCourse === 'TODOS'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950'
                  : 'bg-[#000c19] text-slate-400 border-indigo-950/70 hover:text-slate-200 hover:border-indigo-800'
              }`}
            >
              Todos los Cursos
            </button>
            {ACADEMIC_STRUCTURE.map(c => {
              const count = theoryNotes.filter(n => n.course === c.name).length;
              return (
                <button
                  key={c.name}
                  onClick={() => {
                    setSelectedCourse(c.name);
                    setSelectedSubject('TODAS');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    selectedCourse === c.name
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950'
                      : 'bg-[#000c19] text-slate-400 border-indigo-950/70 hover:text-slate-200 hover:border-indigo-800'
                  }`}
                >
                  <span>{c.name}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950/90 text-indigo-300 border border-indigo-800/50">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject Filter (if course selected or all) */}
        {availableSubjectsForFilter.length > 0 && (
          <div className="pt-2 border-t border-indigo-950/40">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>Materias de {selectedCourse === 'TODOS' ? 'todos los cursos' : selectedCourse}</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedSubject('TODAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedSubject === 'TODAS'
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                    : 'bg-[#000c19] text-slate-400 border-indigo-950/50 hover:text-slate-200'
                }`}
              >
                Todas las materias
              </button>
              {availableSubjectsForFilter.map(subj => {
                const count = theoryNotes.filter(n =>
                  (selectedCourse === 'TODOS' || n.course === selectedCourse) && n.subject === subj
                ).length;
                return (
                  <button
                    key={subj}
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      selectedSubject === subj
                        ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                        : 'bg-[#000c19] text-slate-400 border-indigo-950/50 hover:text-slate-200'
                    }`}
                  >
                    <span>{subj}</span>
                    {count > 0 && (
                      <span className="text-[10px] opacity-75 font-semibold">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-[#001228]/60 border border-indigo-950/80 rounded-2xl p-12 text-center max-w-xl mx-auto mt-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {searchQuery || selectedCourse !== 'TODOS' || selectedSubject !== 'TODAS'
              ? 'No hay apuntes con los filtros seleccionados'
              : 'Aún no has agregado apuntes de teoría'}
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            {searchQuery
              ? 'Intenta con otros términos o limpia los filtros para explorar tus notas.'
              : 'Crea tu primer apunte con texto, resúmenes, esquemas o imágenes explicativas para consultarlos en cualquier momento.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Crear primer apunte de teoría</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => { setViewingNote(note); setActiveModal('VIEW'); }}
              className="group bg-[#001228]/80 hover:bg-[#001733] border border-indigo-950/80 hover:border-cyan-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-lg hover:shadow-cyan-950/20 relative"
            >
              <div>
                {/* Header badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                      {note.course}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-800/50 text-indigo-300">
                      {note.subject}
                    </span>
                  </div>
                  {note.topic && (
                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]" title={note.topic}>
                      {note.topic}
                    </span>
                  )}
                </div>

                {/* Optional Image thumbnail */}
                {note.imageUrl && (
                  <div className="w-full h-36 mb-3 rounded-xl overflow-hidden bg-black/40 border border-indigo-950/60 relative">
                    <img
                      src={note.imageUrl}
                      alt={note.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] text-cyan-300 font-medium border border-cyan-900/50 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Imagen
                    </div>
                  </div>
                )}

                {/* Title */}
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 mb-2">
                  {note.title}
                </h3>

                {/* Content Excerpt */}
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-line mb-3">
                  {note.content}
                </p>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {note.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        #{tag}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="text-[10px] text-slate-500">+{note.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom footer: date and actions */}
              <div className="pt-3 border-t border-indigo-950/60 flex items-center justify-between text-xs text-slate-400 mt-2">
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(note)}
                    title="Editar apunte"
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Seguro que deseas eliminar este apunte de teoría?')) {
                        onDeleteNote(note.id);
                        onToast('Apunte eliminado');
                      }
                    }}
                    title="Eliminar apunte"
                    className="p-1.5 rounded-lg hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(activeModal === 'CREATE' || activeModal === 'EDIT') && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#001024] border border-cyan-800/60 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#000a14] border-b border-indigo-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {activeModal === 'EDIT' ? 'Editar Apunte de Teoría' : 'Nuevo Apunte de Teoría'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Guarda explicaciones, fórmulas y esquemas visuales para tu preparación
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveModal('NONE'); setEditingNote(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
              {/* Course & Subject Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Curso *
                  </label>
                  <select
                    value={formCourse}
                    onChange={(e) => {
                      const newCourse = e.target.value;
                      setFormCourse(newCourse);
                      const courseObj = ACADEMIC_STRUCTURE.find(c => c.name === newCourse);
                      if (courseObj && courseObj.subjects.length > 0) {
                        setFormSubject(courseObj.subjects[0]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {ACADEMIC_STRUCTURE.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Materia *
                  </label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {formSubjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topic & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tema / Capítulo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="Ej. Fotosíntesis, Cinemática, Matrices..."
                    className="w-full px-3 py-2 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Etiquetas (separadas por comas)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Ej. fórmulas, examen, clave, resumen"
                    className="w-full px-3 py-2 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Note Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Título del Apunte *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej. Leyes de Kepler y Fórmulas de Gravitación Universal"
                  required
                  className="w-full px-3 py-2 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              {/* Image attachment */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Imagen o Diagrama (Opcional)
                  </label>
                  {formImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Quitar imagen
                    </button>
                  )}
                </div>

                {formImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-indigo-900/60 bg-black/40 h-44 flex items-center justify-center">
                    <img src={formImageUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-2 right-2 bg-black/80 hover:bg-rose-900 text-white p-1 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-indigo-950 hover:border-cyan-500/60 rounded-xl p-4 text-center cursor-pointer bg-[#000a14]/60 hover:bg-[#000e1f] transition-colors"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <svg className="w-8 h-8 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-slate-300 font-medium">
                        {isProcessingImage ? 'Optimizando imagen...' : 'Haz clic o arrastra para subir una imagen / diagrama'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, WebP (se optimizará automáticamente)</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="O pega aquí una URL directa de imagen (https://...)"
                        className="flex-1 px-3 py-1.5 bg-[#000a14] border border-indigo-950 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Note Content / Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Contenido y Explicación Teórica *
                  </label>
                  {/* Quick helper formatting buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormContent(prev => prev + '\n• ')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Agregar viñeta"
                    >
                      • Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormContent(prev => prev + '\n📌 IMPORTANTE: ')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Agregar nota importante"
                    >
                      📌 Clave
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormContent(prev => prev + '\n📐 FÓRMULA: ')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Agregar fórmula"
                    >
                      📐 Fórmula
                    </button>
                  </div>
                </div>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={8}
                  placeholder={`Escribe aquí tus apuntes, definiciones, leyes, trucos mnemotécnicos o demostraciones...\n\nEjemplo:\n• Primera Ley: Ley de la Inercia\n• Segunda Ley: F = m · a\n• Tercera Ley: Principio de Acción y Reacción`}
                  className="w-full px-3 py-2.5 bg-[#000a14] border border-indigo-950 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-indigo-950 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setActiveModal('NONE'); setEditingNote(null); }}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-medium text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
                >
                  {activeModal === 'EDIT' ? 'Guardar Cambios' : 'Guardar Apunte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW READER MODAL */}
      {activeModal === 'VIEW' && viewingNote && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#001024] border border-cyan-800/60 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-[#000a14] border-b border-indigo-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-cyan-950 border border-cyan-800/80 text-cyan-300">
                  {viewingNote.course}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/70 text-indigo-300">
                  {viewingNote.subject}
                </span>
                {viewingNote.topic && (
                  <span className="text-xs text-slate-400 font-medium">
                    • {viewingNote.topic}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toEdit = viewingNote;
                    setActiveModal('EDIT');
                    openEditModal(toEdit);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1.5 font-medium px-3"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => { setActiveModal('NONE'); setViewingNote(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reader Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <h2 className="text-2xl font-black text-white leading-tight">
                {viewingNote.title}
              </h2>

              {/* Tags and timestamp */}
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-indigo-950/60 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {viewingNote.tags?.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      #{tag}
                    </span>
                  ))}
                </div>
                <span>Actualizado: {new Date(viewingNote.updatedAt).toLocaleDateString()}</span>
              </div>

              {/* Image viewer if present */}
              {viewingNote.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-indigo-950 bg-black/60 p-2 flex justify-center">
                  <img
                    src={viewingNote.imageUrl}
                    alt={viewingNote.title}
                    className="max-h-96 w-auto object-contain rounded-lg shadow-xl"
                  />
                </div>
              )}

              {/* Content text */}
              <div className="bg-[#000a14]/60 border border-indigo-950/60 rounded-xl p-5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                {viewingNote.content}
              </div>
            </div>

            {/* Reader Footer */}
            <div className="px-6 py-3 bg-[#000a14] border-t border-indigo-950 flex items-center justify-between">
              <button
                onClick={() => {
                  if (window.confirm('¿Seguro que deseas eliminar este apunte de teoría?')) {
                    onDeleteNote(viewingNote.id);
                    onToast('Apunte eliminado');
                    setActiveModal('NONE');
                    setViewingNote(null);
                  }
                }}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Eliminar apunte</span>
              </button>
              <button
                onClick={() => { setActiveModal('NONE'); setViewingNote(null); }}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
