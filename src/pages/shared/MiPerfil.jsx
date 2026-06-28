import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import portadaImg from '../../assets/FONDO PERFILES.png';
import { SkeletonCard, SkeletonBase } from '../../components/SkeletonLoader';

export default function MiPerfil() {
  const [sessionUser, setSessionUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para edición
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    email: '',
    telefono: '',
    direccion: '',
  });

  // Estado para foto
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);

  // Estados para cambio de contraseña (MODAL)
  const [isChangingPasswordModalOpen, setIsChangingPasswordModalOpen] = useState(false);
  const [passwords, setPasswords] = useState({
    actual: '',
    nueva: '',
    confirmar: ''
  });

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setSessionUser(parsedUser);
      fetchPerfil(parsedUser.rut);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchPerfil = async (rut) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('rut', rut)
        .single();

      if (error) throw error;
      
      // Si es alumno, cargamos sus datos académicos/familiares básicos
      if (data.rol === 'alumno' || data.role === 'alumno') {
        const { data: matricula } = await supabase
          .from('matriculas')
          .select('rut_apoderado, id_curso, cursos(nombre, rut_profesor_jefe)')
          .eq('rut_alumno', rut)
          .maybeSingle();
        
        if (matricula) {
          data.alumnoData = {
            curso: matricula.cursos?.nombre || 'Sin Curso',
          };
          
          if (matricula.rut_apoderado) {
             const { data: apod } = await supabase.from('perfiles').select('nombre').eq('rut', matricula.rut_apoderado).maybeSingle();
             data.alumnoData.apoderado_nombre = apod?.nombre;
          }
          if (matricula.cursos?.rut_profesor_jefe) {
             const { data: profe } = await supabase.from('perfiles').select('nombre').eq('rut', matricula.cursos.rut_profesor_jefe).maybeSingle();
             data.alumnoData.profesor_jefe_nombre = profe?.nombre;
          }
        }
      }

      setPerfil(data);
      setEditForm({
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
      });
    } catch (error) {
      console.error("Error al cargar perfil:", error);
      toast.error("No se pudo cargar la información de tu perfil.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    if (!perfil) return;

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          email: editForm.email,
          telefono: editForm.telefono,
          direccion: editForm.direccion
        })
        .eq('id', perfil.id);

      if (error) throw error;

      toast.success("Información de contacto actualizada.");
      setPerfil({ ...perfil, ...editForm });
      setIsEditing(false);
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      toast.error("Error al actualizar la información.");
    }
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file || !perfil) return;

    try {
      setIsUploadingFoto(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${perfil.rut}_avatar_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message.includes('bucket')) {
          toast.error("El bucket 'avatars' no existe en Supabase Storage. Un administrador debe crearlo.");
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('perfiles')
        .update({ avatar_url: publicUrl })
        .eq('id', perfil.id);

      if (dbError) throw dbError;

      setPerfil(prev => ({ ...prev, avatar_url: publicUrl }));
      
      if (sessionUser) {
        const updatedSession = { ...sessionUser, avatar_url: publicUrl };
        localStorage.setItem('userLogged', JSON.stringify(updatedSession));
      }

      toast.success("Foto de perfil actualizada exitosamente.");
    } catch (error) {
      console.error("Error subiendo avatar:", error);
      toast.error("Error al subir la imagen. Intenta con un archivo más pequeño.");
    } finally {
      setIsUploadingFoto(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!perfil) return;

    if (passwords.actual !== perfil.clave) {
      toast.error("La contraseña actual es incorrecta.");
      return;
    }
    
    if (passwords.nueva.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (passwords.nueva !== passwords.confirmar) {
      toast.error("Las contraseñas nuevas no coinciden.");
      return;
    }

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ clave: passwords.nueva, requiere_cambio_clave: false })
        .eq('id', perfil.id);

      if (error) throw error;

      toast.success("¡Contraseña actualizada correctamente!");
      setPerfil({ ...perfil, clave: passwords.nueva });
      setIsChangingPasswordModalOpen(false);
      setPasswords({ actual: '', nueva: '', confirmar: '' });
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      toast.error("Error al cambiar la contraseña.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 dark:bg-gray-900 min-h-screen">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Perfil no encontrado</h2>
        <p className="text-gray-500 dark:text-gray-400">No se encontraron los datos para tu cuenta en la base de datos.</p>
      </div>
    );
  }

  // --- REGLAS DE PERMISOS ---
  const canEditPhoto = ['director', 'administrador', 'sostenedor', 'profesor'].includes(perfil?.rol?.toLowerCase());
  const canEditContact = perfil?.rol?.toLowerCase() !== 'alumno';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
        
        {/* CABECERA DEL PERFIL */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 relative animate-fade-in">
          <div className="h-32 sm:h-48 w-full bg-cover bg-center relative" style={{ backgroundImage: `url('${portadaImg}')` }}>
            <div className="absolute inset-0 bg-indigo-900/40 mix-blend-multiply"></div>
            <button 
              onClick={() => setIsChangingPasswordModalOpen(true)} 
              className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white hover:bg-white/40 backdrop-blur-md transition-colors shadow-sm z-10 text-sm font-medium border border-white/20" 
              title="Cambiar Contraseña"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Seguridad
            </button>
          </div>

          <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col sm:flex-row gap-5 relative z-10">
            {/* AVATAR INTERACTIVO */}
            <div className="relative group mx-auto sm:mx-0 -mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-800 bg-linear-to-tr from-blue-100 dark:from-blue-900/60 to-indigo-100 dark:to-indigo-900/60 flex items-center justify-center text-4xl font-bold shadow-lg overflow-hidden shrink-0">
                {perfil.avatar_url ? (
                  <img src={perfil.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-blue-700 dark:text-blue-300">{perfil.nombre?.charAt(0).toUpperCase()}</span>
                )}
                
                {/* Overlay de Edición Foto */}
                {canEditPhoto && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer rounded-full">
                    {isUploadingFoto ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} disabled={isUploadingFoto} />
                  </label>
                )}
            </div>

            <div className="flex-1 text-center sm:text-left sm:pt-3 pb-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">{perfil.nombre}</h1>
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-1 sm:mt-0">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50">
                    {perfil.rol}
                  </span>
                  {perfil.curso_o_cargo && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50">
                      {perfil.curso_o_cargo}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Miembro del colegio</p>
            </div>
            
            {/* Botón Acción Principal */}
            {canEditContact && !isEditing && (
              <div className="sm:pt-3 flex justify-center sm:justify-end">
                 <button 
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm shadow-blue-600/20 flex items-center gap-2 h-fit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Actualizar Contacto
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQUIERDA: DATOS PRINCIPALES */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>
              
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                Ficha Institucional
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">RUT</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.rut}</span>
                </div>
                {perfil.titulo_profesional && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Título Profesional</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.titulo_profesional}</span>
                  </div>
                )}
                {perfil.tipo_contrato && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Tipo Contrato</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.tipo_contrato}</span>
                  </div>
                )}
                {perfil.fecha_nacimiento && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Fecha de Nacimiento</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.fecha_nacimiento}</span>
                  </div>
                )}
                
                {/* DATOS EXCLUSIVOS DE ALUMNO */}
                {perfil.alumnoData && (
                  <>
                    <hr className="border-gray-100 dark:border-gray-700 my-2" />
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Curso Actual</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800/50">{perfil.alumnoData.curso}</span>
                    </div>
                    {perfil.alumnoData.profesor_jefe_nombre && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Profesor Jefe</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.alumnoData.profesor_jefe_nombre}</span>
                      </div>
                    )}
                    {perfil.alumnoData.apoderado_nombre && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">Apoderado Titular</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">{perfil.alumnoData.apoderado_nombre}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: CONTACTO Y EDICIÓN */}
          <div className="md:col-span-2 space-y-6">
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group">
               <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>

              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Datos de Contacto
                </h3>
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="flex flex-col gap-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Correo Electrónico</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-all">{perfil.email || 'No registrado'}</span>
                  </div>

                  <div className="flex flex-col gap-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teléfono</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-all">{perfil.telefono || 'No registrado'}</span>
                  </div>

                  <div className="flex flex-col gap-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors md:col-span-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dirección</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{perfil.direccion || 'No registrada'}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateInfo} className="space-y-4 animate-fade-in relative z-10 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Correo Electrónico</label>
                      <input 
                        type="email" 
                        className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Teléfono</label>
                      <input 
                        type="tel" 
                        className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={editForm.telefono}
                        onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Dirección Completa</label>
                      <input 
                        type="text" 
                        className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={editForm.direccion}
                        onChange={(e) => setEditForm({...editForm, direccion: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({ email: perfil.email, telefono: perfil.telefono, direccion: perfil.direccion });
                      }}
                      className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium text-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm transition-colors shadow-md shadow-blue-600/20"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>

        {/* MODAL CAMBIO DE CONTRASEÑA */}
        {isChangingPasswordModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-fade-in-up">
              
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  Cambiar Contraseña
                </h3>
                <button 
                  onClick={() => {
                    setIsChangingPasswordModalOpen(false);
                    setPasswords({ actual: '', nueva: '', confirmar: '' });
                  }} 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contraseña Actual</label>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow"
                      value={passwords.actual}
                      onChange={(e) => setPasswords({...passwords, actual: e.target.value})}
                    />
                  </div>
                  <hr className="border-gray-100 dark:border-gray-700 my-2" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nueva Contraseña</label>
                    <input 
                      type="password" 
                      required
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow"
                      value={passwords.nueva}
                      onChange={(e) => setPasswords({...passwords, nueva: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirmar Nueva Contraseña</label>
                    <input 
                      type="password" 
                      required
                      placeholder="Repite la nueva contraseña"
                      minLength={6}
                      className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-shadow dark:bg-gray-700 dark:text-white ${passwords.confirmar && passwords.nueva !== passwords.confirmar ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600'}`}
                      value={passwords.confirmar}
                      onChange={(e) => setPasswords({...passwords, confirmar: e.target.value})}
                    />
                    {passwords.confirmar && passwords.nueva !== passwords.confirmar && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium animate-fade-in">Las contraseñas no coinciden</p>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={!passwords.actual || !passwords.nueva || !passwords.confirmar || passwords.nueva !== passwords.confirmar}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      Actualizar Contraseña
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
