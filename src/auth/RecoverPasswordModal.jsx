import { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import emailjs from '@emailjs/browser';

// --- CONFIGURACIÓN DE EMAILJS (Reemplazar con tus credenciales) ---
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'TU_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'TU_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'TU_PUBLIC_KEY';

export default function RecoverPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [rut, setRut] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  if (!isOpen) return null;

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

  // PASO 1: Validar RUT y enviar código
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Buscar usuario en Supabase
      const { data: usuario, error: supabaseError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('rut', rut)
        .maybeSingle();

      if (supabaseError || !usuario) {
        throw new Error('El RUT ingresado no está registrado en el sistema.');
      }

      if (!usuario.email) {
        throw new Error('Este RUT no tiene un correo electrónico asociado. Contacta a la administración.');
      }

      // Generar código de 6 dígitos
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Guardar código y expiración (15 mins) en la BD
      const expiracion = new Date();
      expiracion.setMinutes(expiracion.getMinutes() + 15);

      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ 
          codigo_recuperacion: generatedCode,
          expiracion_codigo: expiracion.toISOString()
        })
        .eq('rut', rut);

      if (updateError) {
        throw new Error('Error al generar la solicitud de recuperación.');
      }

      // Enviar correo con EmailJS
      const templateParams = {
        to_email: usuario.email,
        to_name: usuario.nombre,
        recovery_code: generatedCode
      };

      try {
        console.log("EmailJS Params:", {
          service: EMAILJS_SERVICE_ID,
          template: EMAILJS_TEMPLATE_ID,
          publicKey: EMAILJS_PUBLIC_KEY
        });
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          {
            publicKey: EMAILJS_PUBLIC_KEY
          }
        );
      } catch (emailError) {
        console.error("Error EmailJS:", emailError);
        throw new Error('No se pudo enviar el correo de recuperación. Asegúrate de configurar correctamente EmailJS.');
      }

      setUserProfile(usuario);
      setSuccessMsg(`Código enviado a: ${usuario.email.replace(/(.{2})(.*)(?=@)/, '$1***')}`);
      setStep(2);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // PASO 2: Validar Código
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: usuario, error: supabaseError } = await supabase
        .from('perfiles')
        .select('codigo_recuperacion, expiracion_codigo')
        .eq('rut', rut)
        .single();

      if (supabaseError || !usuario) throw new Error('Error al verificar el código.');

      if (usuario.codigo_recuperacion !== code) {
        throw new Error('El código ingresado es incorrecto.');
      }

      const ahora = new Date();
      const expiracion = new Date(usuario.expiracion_codigo);
      if (ahora > expiracion) {
        throw new Error('El código ha expirado. Por favor solicita uno nuevo.');
      }

      setStep(3);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // PASO 3: Guardar nueva contraseña
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setIsLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ 
          clave: newPassword,
          codigo_recuperacion: null, // Limpiar el código usado
          expiracion_codigo: null
        })
        .eq('rut', rut);

      if (updateError) throw new Error('Error al actualizar la contraseña.');

      setSuccessMsg('¡Contraseña actualizada con éxito!');
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setRut('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-lg">Recuperar Contraseña</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}
          
          {successMsg && step !== 4 && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-medium flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: SOLICITAR CÓDIGO */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Ingresa tu RUT y te enviaremos un código de seguridad a tu correo electrónico registrado.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">RUT Usuario</label>
                <input
                  type="text"
                  required
                  value={rut}
                  onChange={(e) => setRut(formatRUT(e.target.value))}
                  maxLength={12}
                  placeholder="Ej: 20.003.705-9"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition duration-200 flex justify-center items-center gap-2 mt-2"
              >
                {isLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</>
                ) : (
                  'Enviar Código de Recuperación'
                )}
              </button>
            </form>
          )}

          {/* STEP 2: INGRESAR CÓDIGO */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Ingresa el código de 6 dígitos que enviamos a tu correo.
              </p>
              <div>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full h-14 text-center text-2xl tracking-[0.5em] font-bold rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || code.length < 6}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition duration-200 flex justify-center items-center mt-2"
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Verificar Código'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium mt-2">Volver a intentar</button>
            </form>
          )}

          {/* STEP 3: NUEVA CLAVE */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Código verificado. Ahora crea tu nueva contraseña.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirmar Contraseña</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva clave"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-xl transition duration-200 flex justify-center items-center mt-2"
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Guardar Nueva Contraseña'}
              </button>
            </form>
          )}

          {/* STEP 4: ÉXITO */}
          {step === 4 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">¡Listo!</h4>
              <p className="text-sm text-gray-600 mb-6">Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.</p>
              <button
                onClick={handleClose}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition duration-200"
              >
                Volver al Inicio de Sesión
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
