import React, { useState, useEffect } from 'react';
import { 
  auth, 
  firestore, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  doc, 
  setDoc,
  getDoc 
} from '../firebase';
import { UserProfile } from '../types';
import { soundController } from '../utils/soundEffects';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile, area?: 'Biomédicas' | 'Ingenierías' | 'Sociales') => void;
  initialMode?: 'LOGIN' | 'REGISTER';
  defaultArea?: 'Biomédicas' | 'Ingenierías' | 'Sociales';
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'LOGIN',
  defaultArea = 'Biomédicas'
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Registration specific fields
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [targetArea, setTargetArea] = useState<'Biomédicas' | 'Ingenierías' | 'Sociales'>(defaultArea);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (defaultArea) setTargetArea(defaultArea);
    }
  }, [isOpen, initialMode, defaultArea]);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg("Ingresa tu correo electrónico.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (mode === 'REGISTER') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMsg("Ingresa el nombre con el que deseas registrarte.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Las contraseñas no coinciden.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'REGISTER') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, {
          displayName: name.trim()
        });

        const newProfile: UserProfile = {
          name: name.trim(),
          email: cred.user.email || trimmedEmail,
          uid: cred.user.uid,
          plan: 'pro',
          bio: bio.trim() || undefined,
          targetArea: targetArea,
          soundEffectsEnabled: true,
          motivationalQuotesEnabled: true
        };

        // Save in Firestore
        try {
          await setDoc(doc(firestore, 'users', cred.user.uid), {
            profile: newProfile,
            selectedArea: targetArea,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.error("Error saving user doc in Firestore:", dbErr);
        }

        soundController.playCelebration();
        onSuccess(newProfile, targetArea);
        onClose();
      } else {
        // LOGIN
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        let userProfileData: UserProfile = {
          name: cred.user.displayName || 'Estudiante Practix',
          email: cred.user.email || trimmedEmail,
          uid: cred.user.uid,
          plan: 'pro'
        };

        let userArea: 'Biomédicas' | 'Ingenierías' | 'Sociales' | undefined = undefined;

        try {
          const userDoc = await getDoc(doc(firestore, 'users', cred.user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.profile) {
              userProfileData = { ...userProfileData, ...data.profile };
            }
            if (data.selectedArea) {
              userArea = data.selectedArea;
            }
          }
        } catch (dbErr) {
          console.error("Error fetching user doc:", dbErr);
        }

        soundController.playSuccess();
        onSuccess(userProfileData, userArea);
        onClose();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = "Ocurrió un error al procesar tu solicitud.";
      if (err.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está registrado. Intenta iniciar sesión.";
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = "Correo o contraseña incorrectos. Verifica tus datos.";
      } else if (err.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico no es válido.";
      } else if (err.message) {
        message = err.message;
      }
      setErrorMsg(message);
      soundController.playError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      let userProfileData: UserProfile = {
        name: user.displayName || 'Estudiante Practix',
        avatarUrl: user.photoURL || undefined,
        email: user.email || undefined,
        uid: user.uid,
        plan: 'pro',
        targetArea: targetArea,
        soundEffectsEnabled: true,
        motivationalQuotesEnabled: true
      };

      let userArea: 'Biomédicas' | 'Ingenierías' | 'Sociales' | undefined = targetArea;

      try {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.profile) {
            userProfileData = { ...userProfileData, ...data.profile };
          }
          if (data.selectedArea) {
            userArea = data.selectedArea;
          }
        } else {
          // First time with Google: save registration metadata
          await setDoc(doc(firestore, 'users', user.uid), {
            profile: userProfileData,
            selectedArea: targetArea,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (dbErr) {
        console.error("Error setting Google user doc:", dbErr);
      }

      soundController.playCelebration();
      onSuccess(userProfileData, userArea);
      onClose();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErrorMsg("No se pudo iniciar sesión con Google. Intenta nuevamente.");
        soundController.playError();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-slate-800 animate-scale-up space-y-6 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              {mode === 'REGISTER' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {mode === 'REGISTER' ? 'Registro por Primera Vez' : 'Iniciar Sesión'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mode === 'REGISTER'
                  ? 'Configura tu cuenta y área de postulación para Practix'
                  : 'Ingresa para sincronizar tu avance y puntajes'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab switch between Login and Register */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-black">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              mode === 'LOGIN'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            Ya tengo cuenta (Iniciar)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              mode === 'REGISTER'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            Registrarse por primera vez
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          
          {/* REGISTRATION-SPECIFIC FIELDS */}
          {mode === 'REGISTER' && (
            <>
              {/* Área al cual se postula */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1.5 tracking-wider">
                  Área al cual te postulas *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map((area) => {
                    const isSelected = targetArea === area;
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => {
                          setTargetArea(area);
                          soundController.playClick();
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/40 shadow-sm'
                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="text-base">
                          {area === 'Biomédicas' ? '🧬' : area === 'Ingenierías' ? '⚙️' : '⚖️'}
                        </span>
                        <span>{area}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombre con el que desea registrarse */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1.5 tracking-wider">
                  Nombre con el que deseas registrarte *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Breve descripción opcional de su persona */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1.5 tracking-wider">
                  Breve descripción de tu persona <span className="text-gray-400 font-normal lowercase">(opcional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ej. Postulante a Medicina UNSA, enfocado en subir mi puntaje en Biología y Química..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1.5 tracking-wider">
              Correo Electrónico *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-correo@ejemplo.com"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-wider">
                {mode === 'REGISTER' ? 'Contraseña con la que iniciarás sesión *' : 'Contraseña *'}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña (mín. 6 caracteres)..."
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {mode === 'REGISTER' && (
              <p className="text-[10px] text-gray-400 mt-1">
                Usa esta contraseña para ingresar a Practix en cualquier momento. Mínimo 6 caracteres.
              </p>
            )}
          </div>

          {/* Confirm Password for Register */}
          {mode === 'REGISTER' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-wider">
                  Confirmar Contraseña *
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña para confirmar..."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 px-4 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 ${
              mode === 'REGISTER'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            }`}
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : mode === 'REGISTER' ? (
              <span>Registrarse y Crear Cuenta</span>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>

          {/* Switch link below submit */}
          <div className="text-center pt-1">
            {mode === 'REGISTER' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              >
                ¿Ya tienes una cuenta registrada? <strong>Inicia sesión aquí</strong>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setErrorMsg(null);
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
              >
                ¿No tienes cuenta aún? <strong>Regístrate por primera vez aquí</strong>
              </button>
            )}
          </div>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-200 dark:border-slate-700 w-full" />
          <span className="bg-white dark:bg-slate-900 px-3 text-xs font-bold text-gray-400 uppercase">
            o también
          </span>
        </div>

        {/* Google Login / Register */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm transition-all text-xs flex items-center justify-center gap-2.5 active:scale-95"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <GoogleIcon className="w-4 h-4" />
          </div>
          <span>Continuar con Google</span>
        </button>

      </div>
    </div>
  );
};
