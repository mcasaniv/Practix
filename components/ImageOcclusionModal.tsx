import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CourseStructure, Flashcard, OcclusionBox } from '../types';
import { ACADEMIC_STRUCTURE } from '../constants';

interface ImageOcclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFlashcards: (cards: Flashcard[]) => void;
  initialCourseName?: string | null;
  initialSubjectName?: string | null;
  initialTopicName?: string | null;
  academicStructure?: CourseStructure[];
  onToast?: (msg: string) => void;
}

// Helper to compress image down to max dimension 1200px and 0.85 quality for crisp, lightweight base64 storage
const compressImage = (fileOrUrl: File | string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const maxDim = 1200;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrUrl === 'string' ? fileOrUrl : '');
        return;
      }

      // Draw with high quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrUrl);
    }
  });
};

export const ImageOcclusionModal: React.FC<ImageOcclusionModalProps> = ({
  isOpen,
  onClose,
  onSaveFlashcards,
  initialCourseName,
  initialSubjectName,
  initialTopicName,
  academicStructure = ACADEMIC_STRUCTURE,
  onToast
}) => {
  const [course, setCourse] = useState<string>(initialCourseName || 'Ciencias');
  const [subject, setSubject] = useState<string>(initialSubjectName || '');
  const [topic, setTopic] = useState<string>(initialTopicName || '');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [boxes, setBoxes] = useState<OcclusionBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [mode, setMode] = useState<'ONE_PER_BOX' | 'ALL_IN_ONE'>('ONE_PER_BOX');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync available subjects when course changes
  const availableSubjects = (academicStructure.find(c => c.name === course)?.subjects) || [];

  useEffect(() => {
    if (initialCourseName) setCourse(initialCourseName);
    if (initialSubjectName) setSubject(initialSubjectName);
    if (initialTopicName !== undefined) setTopic(initialTopicName || '');
  }, [initialCourseName, initialSubjectName, initialTopicName]);

  useEffect(() => {
    if (availableSubjects.length > 0 && (!subject || !availableSubjects.includes(subject))) {
      setSubject(availableSubjects[0]);
    }
  }, [course]);

  // Support paste image directly from clipboard (Ctrl+V) anywhere inside the modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            setIsProcessingImage(true);
            try {
              const compressed = await compressImage(blob);
              setImageUrl(compressed);
              if (onToast) onToast("Imagen pegada desde el portapapeles.");
            } catch {
              if (onToast) onToast("No se pudo cargar la imagen pegada.");
            } finally {
              setIsProcessingImage(false);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onToast]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const compressed = await compressImage(file);
      setImageUrl(compressed);
      if (onToast) onToast("Imagen cargada exitosamente.");
    } catch {
      if (onToast) onToast("Error al procesar la imagen seleccionada.");
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleLoadFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsProcessingImage(true);
    try {
      const compressed = await compressImage(urlInput.trim());
      setImageUrl(compressed);
      setUrlInput('');
      if (onToast) onToast("Imagen cargada desde URL.");
    } catch {
      // If CORS prevents canvas compression, use raw URL as fallback
      setImageUrl(urlInput.trim());
      setUrlInput('');
      if (onToast) onToast("Imagen cargada.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Convert client pointer coordinates into relative percentage (0 - 100)
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // Start drawing occlusion box on mouse/touch down
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // If clicked on an existing box or button, ignore drawing
    const target = e.target as HTMLElement;
    if (target.closest('[data-box-control="true"]')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const coords = getRelativeCoords(clientX, clientY);
    setIsDrawing(true);
    setDrawStart(coords);
    setCurrentDragRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !drawStart) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const currentCoords = getRelativeCoords(clientX, clientY);

    const minX = Math.min(drawStart.x, currentCoords.x);
    const minY = Math.min(drawStart.y, currentCoords.y);
    const width = Math.abs(currentCoords.x - drawStart.x);
    const height = Math.abs(currentCoords.y - drawStart.y);

    setCurrentDragRect({ x: minX, y: minY, width, height });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentDragRect) {
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDragRect(null);
      return;
    }

    // Only create box if it has reasonable size (at least 2% width & 2% height)
    if (currentDragRect.width >= 2 && currentDragRect.height >= 2) {
      const newBoxId = crypto.randomUUID();
      const newBoxNumber = boxes.length + 1;
      const newBox: OcclusionBox = {
        id: newBoxId,
        x: Math.round(currentDragRect.x * 10) / 10,
        y: Math.round(currentDragRect.y * 10) / 10,
        width: Math.round(currentDragRect.width * 10) / 10,
        height: Math.round(currentDragRect.height * 10) / 10,
        correctAnswer: '',
        label: `#${newBoxNumber}`
      };

      setBoxes(prev => [...prev, newBox]);
      setSelectedBoxId(newBoxId);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentDragRect(null);
  };

  // Add a quick box via button
  const handleAddQuickBox = () => {
    const newBoxId = crypto.randomUUID();
    const newBoxNumber = boxes.length + 1;
    const newBox: OcclusionBox = {
      id: newBoxId,
      x: 35,
      y: 40,
      width: 30,
      height: 12,
      correctAnswer: '',
      label: `#${newBoxNumber}`
    };
    setBoxes(prev => [...prev, newBox]);
    setSelectedBoxId(newBoxId);
  };

  const handleUpdateBoxAnswer = (id: string, answer: string) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, correctAnswer: answer } : b));
  };

  const handleDeleteBox = (id: string) => {
    setBoxes(prev => prev.filter(b => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  const handleClearAllBoxes = () => {
    if (boxes.length === 0) return;
    if (window.confirm("¿Seguro que deseas eliminar todos los cuadros en blanco?")) {
      setBoxes([]);
      setSelectedBoxId(null);
    }
  };

  // Handle Save
  const handleSave = () => {
    if (!course) {
      alert("Por favor selecciona un curso.");
      return;
    }
    if (!subject) {
      alert("Por favor selecciona una materia.");
      return;
    }
    if (!imageUrl) {
      alert("Por favor sube o proporciona una imagen.");
      return;
    }
    if (boxes.length === 0) {
      alert("Debes colocar al menos un cuadro en blanco sobre la imagen para tapar algo.");
      return;
    }

    // Validate that each box has a non-empty correct answer
    const emptyBox = boxes.find(b => !b.correctAnswer.trim());
    if (emptyBox) {
      alert(`El cuadro ${emptyBox.label || 'en blanco'} no tiene respuesta asignada. Por favor escribe qué nombre o respuesta oculta ese cuadro.`);
      setSelectedBoxId(emptyBox.id);
      return;
    }

    const finalTopic = topic.trim() || 'Oclusión de Imagen';
    const cardsToSave: Flashcard[] = [];

    if (mode === 'ONE_PER_BOX') {
      // Create one flashcard per occlusion box (style)
      boxes.forEach((box, index) => {
        const cardId = crypto.randomUUID();
        const card: Flashcard = {
          id: cardId,
          course,
          subject,
          topic: finalTopic,
          type: 'IMAGE_OCCLUSION',
          imageUrl,
          occlusionBoxes: boxes,
          activeBoxId: box.id,
          front: `Identifica la estructura oculta en el cuadro ${box.label || (index + 1)} (${finalTopic})`,
          back: box.correctAnswer.trim(),
          createdAt: Date.now() + index,
          order: index + 1
        };
        cardsToSave.push(card);
      });
    } else {
      // Create single flashcard with all boxes
      const cardId = crypto.randomUUID();
      const allAnswers = boxes.map((b, i) => `${b.label || `#${i+1}`}: ${b.correctAnswer.trim()}`).join('\n');
      const card: Flashcard = {
        id: cardId,
        course,
        subject,
        topic: finalTopic,
        type: 'IMAGE_OCCLUSION',
        imageUrl,
        occlusionBoxes: boxes,
        front: `Completa los nombres ocultos en los ${boxes.length} cuadros (${finalTopic})`,
        back: allAnswers,
        createdAt: Date.now(),
        order: 1
      };
      cardsToSave.push(card);
    }

    onSaveFlashcards(cardsToSave);
    if (onToast) {
      onToast(cardsToSave.length === 1 
        ? "Tarjeta con imagen y oclusión creada exitosamente." 
        : `¡${cardsToSave.length} tarjetas con imagen y oclusión creadas exitosamente!`
      );
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100 leading-tight">
                Flashcards con Imagen (Oclusión)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tapa nombres de estructuras, fórmulas o esquemas con cuadros en blanco para escribir y calificar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-grow">
          {/* Metadata Form: Course, Subject, Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/40 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Curso
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
              >
                {academicStructure.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Materia
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
              >
                {availableSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Tema / Diagrama
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ej. Anatomía del Ojo, Célula animal..."
                className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Image Uploader or Canvas */}
          {!imageUrl ? (
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-6 sm:p-10 text-center bg-indigo-50/20 dark:bg-slate-800/20 transition-all">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 mb-1">
                Sube la imagen para tapar nombres
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-5">
                Carga un esquema con flechas o nombres desde tu dispositivo, pega una imagen directamente con <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-[10px] font-mono">Ctrl + V</kbd>, o usa un enlace URL.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isProcessingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>{isProcessingImage ? 'Procesando...' : 'Seleccionar Archivo'}</span>
                </button>
              </div>

              {/* URL Input option */}
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-slate-800 max-w-md mx-auto flex items-center gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="O pega aquí el enlace URL de la imagen..."
                  className="flex-grow text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  disabled={!urlInput.trim() || isProcessingImage}
                  onClick={handleLoadFromUrl}
                  className="px-3.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  Cargar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toolbar above image */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50 dark:bg-slate-850 p-3 rounded-2xl border border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <span>Haz clic y arrastra sobre la imagen para dibujar un cuadro blanco</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleAddQuickBox}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                  >
                    <span>+ Añadir Cuadro</span>
                  </button>

                  {boxes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllBoxes}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl transition-all"
                    >
                      Limpiar Cuadros
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-gray-200 dark:border-slate-800">
                    {boxes.length} {boxes.length === 1 ? 'cuadro colocado' : 'cuadros colocados'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("¿Deseas cambiar la imagen? Se mantendrán o resetearán los cuadros.")) {
                        setImageUrl('');
                        setBoxes([]);
                        setSelectedBoxId(null);
                      }
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:underline px-2 py-1"
                  >
                    Cambiar Imagen
                  </button>
                </div>
              </div>

              {/* Interactive Canvas */}
              <div className="relative border-2 border-indigo-200 dark:border-slate-700 rounded-3xl overflow-hidden bg-gray-900/5 select-none max-h-[500px] flex items-center justify-center">
                <div
                  ref={containerRef}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  className="relative cursor-crosshair inline-block max-w-full"
                  style={{ touchAction: 'none' }}
                >
                  <img
                    src={imageUrl}
                    alt="Occlusion target"
                    className="block max-h-[460px] w-auto max-w-full object-contain pointer-events-none rounded-2xl"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />

                  {/* Render Existing Occlusion Boxes (cuadros en blanco tapando el texto) */}
                  {boxes.map((b, idx) => {
                    const isSelected = selectedBoxId === b.id;
                    return (
                      <div
                        key={b.id}
                        data-box-control="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBoxId(b.id);
                        }}
                        style={{
                          left: `${b.x}%`,
                          top: `${b.y}%`,
                          width: `${b.width}%`,
                          height: `${b.height}%`
                        }}
                        className={`absolute flex items-center justify-center transition-shadow cursor-pointer rounded ${
                          isSelected
                            ? 'bg-white shadow-xl ring-2 ring-indigo-600 border-2 border-indigo-500 z-30'
                            : 'bg-white shadow-md border-2 border-dashed border-indigo-400 hover:border-indigo-600 z-20'
                        }`}
                        title={`Cuadro ${b.label || (idx + 1)}: ${b.correctAnswer || 'Sin respuesta aún'}`}
                      >
                        {/* Number Badge and label */}
                        <div className="flex items-center gap-1 px-1 py-0.5 max-w-full truncate text-center">
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {b.label || `#${idx + 1}`}
                          </span>
                          {b.correctAnswer && (
                            <span className="text-[10px] font-bold text-gray-800 truncate max-w-[100px] hidden sm:inline">
                              {b.correctAnswer}
                            </span>
                          )}
                        </div>

                        {/* Quick delete button */}
                        <button
                          type="button"
                          data-box-control="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBox(b.id);
                          }}
                          className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md hover:scale-110 active:scale-95 transition-transform"
                          title="Eliminar este cuadro"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  {/* Render Current Dragging Box */}
                  {isDrawing && currentDragRect && (
                    <div
                      style={{
                        left: `${currentDragRect.x}%`,
                        top: `${currentDragRect.y}%`,
                        width: `${currentDragRect.width}%`,
                        height: `${currentDragRect.height}%`
                      }}
                      className="absolute bg-white/90 border-2 border-indigo-600 border-dashed rounded z-40 pointer-events-none shadow-lg animate-pulse"
                    />
                  )}
                </div>
              </div>

              {/* Selected Box Config / Answer Editor */}
              {selectedBoxId && (() => {
                const activeBox = boxes.find(b => b.id === selectedBoxId);
                if (!activeBox) return null;
                const activeIdx = boxes.findIndex(b => b.id === selectedBoxId);

                return (
                  <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-2xl border-2 border-indigo-300 dark:border-indigo-600 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-0.5 rounded-lg">
                          Configurando Cuadro {activeBox.label || `#${activeIdx + 1}`}
                        </span>
                        <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                          Escribe lo que está tapado por este recuadro blanco:
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBox(activeBox.id)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Eliminar cuadro</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Respuesta Correcta / Nombre a Adivinar *
                        </label>
                        <input
                          type="text"
                          value={activeBox.correctAnswer}
                          onChange={(e) => handleUpdateBoxAnswer(activeBox.id, e.target.value)}
                          placeholder="Ej. Bulbo raquídeo, Ventrículo izquierdo, Fémur..."
                          className="w-full text-sm font-bold bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-xl px-3 py-2 outline-none text-gray-800 dark:text-gray-100 shadow-sm"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Etiqueta / Número
                        </label>
                        <input
                          type="text"
                          value={activeBox.label || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBoxes(prev => prev.map(b => b.id === activeBox.id ? { ...b, label: val } : b));
                          }}
                          placeholder={`#${activeIdx + 1}`}
                          className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-gray-800 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Generation Mode Selector */}
              <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Modo de Estudio al generar:
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {mode === 'ONE_PER_BOX' 
                      ? 'Recomendado: Crea una flashcard por cada cuadro colocado para repasar individualmente.' 
                      : 'Crea una sola flashcard donde deberás completar todos los cuadros de la imagen a la vez.'
                    }
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMode('ONE_PER_BOX')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      mode === 'ONE_PER_BOX'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    1 Tarjeta por Cuadro ({boxes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('ALL_IN_ONE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      mode === 'ALL_IN_ONE'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    1 Tarjeta con Todo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-slate-850">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!imageUrl || boxes.length === 0}
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>
              {mode === 'ONE_PER_BOX' 
                ? `Guardar ${boxes.length > 0 ? boxes.length : ''} Flashcards` 
                : 'Guardar Flashcard'
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
