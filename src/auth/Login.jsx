import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';

// Componentes
import RecoverPasswordModal from './RecoverPasswordModal';

// Importamos la imagen local desde la carpeta assets
import fachadaImg from '../assets/fachada_2.png';
import logoTexto from '../assets/logo_texto.png';

export default function Login() {
  // --- ESTADOS ORIGINALES ---
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  // --- ESTADO RECUPERACIÓN ---
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  // --- NUEVOS ESTADOS PARA CAMBIO DE CLAVE OBLIGATORIO ---
  const [isRequiringPasswordChange, setIsRequiringPasswordChange] = useState(false);
  const [tempUser, setTempUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- REDIRECCIÓN AUTOMÁTICA SI YA HAY SESIÓN ---
  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      if (user.role === 'director') navigate('/panel/director');
      else if (user.role === 'profesor') navigate('/panel/profesor');
      else if (user.role === 'apoderado') navigate('/panel/apoderado');
      else navigate('/panel/alumno');
    }
  }, [navigate]);

  // --- FUNCIÓN PARA FORMATEAR RUT CHILENO ---
  const formatRUT = (value) => {
    let cleanValue = value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanValue.length === 0) return '';
    const body = cleanValue.slice(0, -1);
    const dv = cleanValue.slice(-1);
    if (body.length > 0) {
      const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return `${formattedBody}-${dv}`;
    }
    return cleanValue;
  };

  const handleRutChange = (e) => {
    const formatted = formatRUT(e.target.value);
    setRut(formatted);
    setError(null);
  };

  // --- FLUJO 1: VERIFICACIÓN DE CREDENCIALES ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: usuario, error: supabaseError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('rut', rut)
        .maybeSingle();

      if (supabaseError || !usuario) {
        throw new Error('El RUT ingresado no está registrado en el sistema.');
      }

      if (usuario.clave !== password) {
        throw new Error('La contraseña ingresada es incorrecta.');
      }

      if (usuario.requiere_cambio_clave) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTempUser(usuario);
        setIsRequiringPasswordChange(true);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      iniciarSesionFinal(usuario);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FLUJO 2: GUARDADO DE NUEVA CONTRASEÑA ---
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden. Inténtalo de nuevo.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('perfiles')
        .update({
          clave: newPassword,
          requiere_cambio_clave: false
        })
        .eq('rut', tempUser.rut);

      if (updateError) throw new Error("Hubo un error al guardar tu nueva contraseña.");

      await new Promise(resolve => setTimeout(resolve, 1500));

      const userActualizado = { ...tempUser, clave: newPassword, requiere_cambio_clave: false };
      iniciarSesionFinal(userActualizado);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FLUJO 3: ENRUTAMIENTO FINAL ---
  const iniciarSesionFinal = (usuario) => {
    // 1. Eliminar la clave por seguridad antes de guardar en localStorage
    const { clave, ...usuarioSeguro } = usuario;

    const userToSave = {
      ...usuarioSeguro,
      role: usuarioSeguro.rol || usuarioSeguro.role || 'alumno',
      loginTimestamp: new Date().getTime() // 2. Guardar el timestamp para expiración (8 horas)
    };
    localStorage.setItem('userLogged', JSON.stringify(userToSave));

    switch (userToSave.role) {
      case 'director': navigate('/panel/director'); break;
      case 'profesor': navigate('/panel/profesor'); break;
      case 'apoderado': navigate('/panel/apoderado'); break;
      case 'alumno': default: navigate('/panel/alumno'); break;
    }
  };

  const fillTestData = (role) => {
    if (role === 'director') { setRut('20.003.705-7'); setPassword('123123'); }
    if (role === 'profesor') { setRut('27.223.152-4'); setPassword('123123'); }
    if (role === 'alumno') { setRut('12.312.312-3'); setPassword('123123'); }
    if (role === 'apoderado') { setRut('27.223.152-3'); setPassword('1234'); }
    setError(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">

      {/* ================= SECCIÓN IZQUIERDA: IMAGEN LIMPIA ================= */}
      <div className="hidden lg:block lg:w-1/2 relative h-full bg-white">
        {/* Capa súper sutil para que la imagen no queme la pantalla, pero sin oscurecerla */}
        <div className="absolute inset-0 bg-blue-900/5 z-10" />

        {/* Imagen ligeramente desplazada hacia arriba (20%) para centrar mejor el logo */}
        <img
          src={fachadaImg}
          alt="Estudiantes"
          className="absolute -top-[20%] left-0 h-[120%] w-full object-cover object-top z-0"
        />
      </div>

      {/* ================= SECCIÓN DERECHA: FORMULARIO CLÁSICO Y AMIGABLE ================= */}
      <div className="flex w-full lg:w-1/2 h-full items-center justify-center p-6 sm:p-12 md:p-16 bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 sm:p-10 border border-gray-100 flex flex-col">

          {!isRequiringPasswordChange ? (
            /* --- PANTALLA 1: LOGIN NORMAL --- */
            <>
              <div className="text-center mb-8 flex flex-col items-center shrink-0">
                <img src={logoTexto} alt="Logo ConectaEduca360" className="h-14 sm:h-16 w-auto mb-3 object-contain" />
                <p className="text-sm font-medium text-gray-500">Ingresa tus credenciales oficiales de acceso</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">RUT Usuario</label>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={handleRutChange}
                    maxLength={12}
                    placeholder="Ej: 20.003.705-9"
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 pb-2">
                  <div className="flex items-center">
                    <input type="checkbox" id="remember" className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer focus:ring-blue-500" />
                    <label htmlFor="remember" className="ml-2 block text-sm font-medium text-gray-600 cursor-pointer select-none">Recordarme</label>
                  </div>
                  <button type="button" onClick={() => setIsRecoveryModalOpen(true)} className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-semibold bg-transparent border-none p-0 cursor-pointer">
                    ¿Olvidaste tu clave?
                  </button>
                </div>

                {error && <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium text-center">{error}</div>}

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center pt-4 shrink-0">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500 font-medium mt-3">Verificando datos...</p>
                  </div>
                ) : (
                  <button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl transition duration-200 shadow-lg shadow-blue-600/25 mt-2">
                    Iniciar Sesión
                  </button>
                )}
              </form>

              {/* Botones de prueba en el entorno de desarrollo */}
              <div className="mt-8 pt-6 border-t border-gray-100 shrink-0">
                <p className="text-xs text-center text-gray-400 font-semibold mb-4 tracking-wide">Modo Sandbox / Pruebas</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button type="button" onClick={() => fillTestData('director')} className="py-2.5 px-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">Director</button>
                  <button type="button" onClick={() => fillTestData('profesor')} className="py-2.5 px-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">Profesor</button>
                  <button type="button" onClick={() => fillTestData('alumno')} className="py-2.5 px-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">Alumno</button>
                  <button type="button" onClick={() => fillTestData('apoderado')} className="py-2.5 px-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">Apoderado</button>
                </div>
              </div>
            </>
          ) : (
            /* --- PANTALLA 2: CAMBIO DE CLAVE OBLIGATORIO --- */
            <div className="animate-[fadeIn_0.3s_ease-out] flex flex-col h-full justify-center py-4">
              <div className="text-center mb-8 shrink-0">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-amber-100">
                  🔒
                </div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Actualiza tu Seguridad</h2>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                  Hola <span className="font-bold text-gray-700">{tempUser?.nombre}</span>, por políticas de la plataforma debes modificar tu contraseña provisoria antes de acceder.
                </p>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nueva Contraseña</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirma tu Contraseña</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la nueva clave" required minLength={6} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-gray-400" />
                </div>

                {error && <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium text-center">{error}</div>}

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center pt-4 shrink-0">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500 font-medium mt-3">Guardando cambios...</p>
                  </div>
                ) : (
                  <button type="submit" className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base rounded-xl transition duration-200 shadow-lg shadow-amber-500/25 mt-4">
                    Guardar y Entrar
                  </button>
                )}
              </form>
            </div>
          )}

        </div>
      </div>
      
      {/* MODAL DE RECUPERACIÓN DE CLAVE */}
      <RecoverPasswordModal 
        isOpen={isRecoveryModalOpen} 
        onClose={() => setIsRecoveryModalOpen(false)} 
      />
    </div>
  );
}