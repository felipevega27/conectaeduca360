import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import UserAvatar from '../../components/UserAvatar';

// Importa aquí tu imagen desde la carpeta assets. Cambia 'tu-imagen.jpg' por el nombre real de tu archivo.
import portadaImg from '../../assets/FONDO PERFILES.png';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorPerfilAlumno() {
  const { rut: paramRut } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const rutAlumno = paramRut || location.state?.alumnoSeleccionado?.rut;

  const [isLoading, setIsLoading] = useState(true);
  const [rolUsuario, setRolUsuario] = useState('director'); // Para seguridad
  const [activeTab, setActiveTab] = useState('pedagogico'); // 'pedagogico', 'convivencia', 'pie'

  const [data, setData] = useState({
    perfil: null,
    curso: null,
    apoderado: null,
    notas: [],
    asistencia: [],
    convivencia: [],
    pie: null,
    sesionesPie: []
  });

  // --- ESTADOS PARA EL MODO EDICIÓN ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ nombre: '', fecha_nacimiento: '', direccion: '' });
  const [avatarFile, setAvatarFile] = useState(null);

  // --- IMAGEN DE PORTADA ---
  const imagenPortada = portadaImg;

  useEffect(() => {
    if (rutAlumno) {
      cargarExpedienteCompleto();
    } else {
      setIsLoading(false);
    }
  }, [rutAlumno]);

  const cargarExpedienteCompleto = async () => {
    try {
      setIsLoading(true);

      // 1. Identificar rol
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfilUsuario } = await supabase.from('perfiles').select('rol').eq('email', user.email).single();
        if (perfilUsuario) setRolUsuario(perfilUsuario.role || perfilUsuario.rol);
      }

      // 2. Datos generales
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('rut', rutAlumno).single();
      const { data: matricula } = await supabase.from('matriculas').select('id_curso').eq('rut_alumno', rutAlumno).maybeSingle();

      let cursoInfo = { nombre: 'Sin Curso' };
      if (matricula?.id_curso) {
        const { data: curso } = await supabase.from('cursos').select('nombre').eq('id', matricula.id_curso).maybeSingle();
        if (curso) cursoInfo = curso;
      }

      let apoderadoInfo = null;
      const { data: relacion } = await supabase.from('relacion_apoderados').select('*').eq('rut_alumno', rutAlumno).maybeSingle();
      if (relacion) {
        const { data: perfilApoderado } = await supabase.from('perfiles').select('nombre').eq('rut', relacion.rut_apoderado).maybeSingle();
        apoderadoInfo = { ...relacion, nombre: perfilApoderado?.nombre };
      }

      const { data: notas } = await supabase.from('notas').select('*, asignaturas(nombre)').eq('rut_alumno', rutAlumno).order('fecha', { ascending: false });
      const { data: asistencia } = await supabase.from('asistencia_alumnos').select('*').eq('rut_alumno', rutAlumno).order('fecha', { ascending: false });
      
      // Obtener tanto Casos Formales como Anotaciones Simples (sin inner joins para evitar errores de FK)
      const { data: convivencia } = await supabase.from('casos_convivencia').select('*').eq('rut_alumno', rutAlumno);
      const { data: anotaciones } = await supabase.from('anotaciones').select('*').eq('rut_alumno', rutAlumno);
      
      // Obtener nombres de todos los perfiles para mapear los autores
      const { data: perfilesAutores } = await supabase.from('perfiles').select('rut, nombre');

      const historialCombinado = [];
      if (convivencia) {
        convivencia.forEach(c => {
          const autorNombre = perfilesAutores?.find(p => p.rut === c.rut_reportador)?.nombre || 'Inspectoría';
          historialCombinado.push({
            id: `conv_${c.id}`,
            esCaso: true,
            titulo: `Protocolo: ${c.tipo_falta}`,
            fecha: c.fecha_reporte,
            estado: c.estado_protocolo,
            descripcion: c.descripcion,
            autor: autorNombre,
            color: 'red'
          });
        });
      }
      if (anotaciones) {
        anotaciones.forEach(a => {
          const autorNombre = perfilesAutores?.find(p => p.rut === a.rut_profesor)?.nombre || 'Docente';
          historialCombinado.push({
            id: `anot_${a.id}`,
            esCaso: false,
            titulo: `Anotación ${a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}${a.gravedad ? ` - ${a.gravedad}` : ''}`,
            fecha: a.fecha,
            estado: a.tipo,
            descripcion: a.descripcion,
            autor: autorNombre,
            color: a.tipo === 'positiva' ? 'emerald' : a.tipo === 'negativa' ? 'red' : 'orange'
          });
        });
      }
      historialCombinado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // 4. Módulo PIE Completo
      const { data: pie } = await supabase.from('pie_estudiantes').select('*').eq('rut_alumno', rutAlumno).maybeSingle();
      let sesionesProcesadas = [];

      if (pie) {
        const { data: sesData } = await supabase.from('pie_sesiones').select('*').eq('rut_alumno', rutAlumno).order('fecha_sesion', { ascending: false });
        const { data: especialistasData } = await supabase.from('perfiles').select('rut, nombre');

        sesionesProcesadas = (sesData || []).map(s => ({
          ...s,
          nombre_especialista: especialistasData?.find(e => e.rut === s.rut_especialista)?.nombre || 'Especialista'
        }));
      }

      setData({
        perfil,
        curso: cursoInfo,
        apoderado: apoderadoInfo,
        notas: notas || [],
        asistencia: asistencia || [],
        convivencia: historialCombinado,
        pie: pie || null,
        sesionesPie: sesionesProcesadas
      });

      setEditForm({
        nombre: perfil?.nombre || '',
        fecha_nacimiento: perfil?.fecha_nacimiento || '',
        direccion: perfil?.direccion || ''
      });

    } catch (error) {
      console.error("Error al cargar expediente:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let nuevaAvatarUrl = undefined;
      
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${rutAlumno}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        nuevaAvatarUrl = publicUrl;
      }

      const updates = {
        nombre: editForm.nombre,
        fecha_nacimiento: editForm.fecha_nacimiento || null,
        direccion: editForm.direccion || null
      };

      if (nuevaAvatarUrl) {
        updates.avatar_url = nuevaAvatarUrl;
      }

      const { error } = await supabase
        .from('perfiles')
        .update(updates)
        .eq('rut', rutAlumno);

      if (error) throw error;

      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsEditModalOpen(false);
      setAvatarFile(null);
      cargarExpedienteCompleto();
      toast.success('Expediente actualizado exitosamente.');
    } catch (error) {
      console.error('Error actualizando perfil:', error.message);
      toast.error('Hubo un error al actualizar los datos.');
    } finally {
      setIsSaving(false);
    }
  };

  const calcularAsistencia = () => {
    if (!data.asistencia.length) return '--';
    const ausencias = data.asistencia.filter(a => a.estado === 'Ausente').length;
    return Math.round(((data.asistencia.length - ausencias) / data.asistencia.length) * 100);
  };

  const calcularPromedio = () => {
    if (!data.notas.length) return '--';
    const suma = data.notas.reduce((acc, curr) => acc + Number(curr.nota), 0);
    return (suma / data.notas.length).toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 h-full min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3">Procesando Ficha De Alumno...</p>
      </div>
    );
  }

  if (!data.perfil) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Alumno no encontrado</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">No se pudo cargar la información del estudiante. Es posible que el RUT no exista o haya sido eliminado.</p>
          <button onClick={() => navigate(-1)} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm">
            Volver al directorio
          </button>
        </div>
      </div>
    );
  }

  const asistenciaGral = calcularAsistencia();
  const promedioGral = calcularPromedio();

  // Permisos de Visualización
  const tieneAccesoPie = ['director', 'especialista'].includes(rolUsuario);
  const tieneAccesoConvivencia = ['director', 'inspector', 'docente', 'especialista'].includes(rolUsuario);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

      {/* NAVEGACIÓN */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver atrás
        </button>
      </div>

      {/* CABECERA DEL PERFIL */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 relative">
        <div className="h-32 sm:h-40 w-full bg-cover bg-center relative" style={{ backgroundImage: `url('${imagenPortada}')` }}>
          <div className="absolute inset-0 bg-indigo-900/40 mix-blend-multiply"></div>
          
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border border-white/30 hover:border-white/50 shadow-sm z-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Editar Expediente
          </button>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col sm:flex-row gap-5 relative z-10">
          <UserAvatar 
            nombre={data.perfil.nombre} 
            avatarUrl={data.perfil.avatar_url}
            className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0 border-4 border-white dark:border-gray-800 bg-linear-to-tr from-blue-100 dark:from-blue-900/60 to-indigo-100 dark:to-indigo-900/60 text-blue-700 dark:text-blue-300 text-3xl sm:text-4xl font-bold shadow-lg" 
          />

          <div className="flex-1 text-center sm:text-left sm:pt-3 pb-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 justify-center sm:justify-start">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">{data.perfil.nombre}</h1>

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-1 sm:mt-0">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50">
                  {data.curso.nombre}
                </span>
                {data.pie && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50">
                    PIE ({data.pie.tipo_necesidad})
                  </span>
                )}
                {asistenciaGral !== '--' && asistenciaGral < 85 && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50 animate-pulse">
                    Riesgo Deserción
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> RUT: {data.perfil.rut}</span>
              {data.perfil.fecha_nacimiento && (<span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Nacimiento: {new Date(data.perfil.fecha_nacimiento).toLocaleDateString('es-CL')}</span>)}
              {data.perfil.direccion && (<span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {data.perfil.direccion}</span>)}
            </div>
          </div>
        </div>

        {/* --- MENÚ DE PESTAÑAS (TABS) --- */}
        <div className="px-6 sm:px-8 pb-4">
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 p-1 rounded-xl">
            <button onClick={() => setActiveTab('pedagogico')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'pedagogico' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
              Resumen Pedagógico
            </button>
            <button onClick={() => setActiveTab('convivencia')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'convivencia' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
              Convivencia Escolar {!tieneAccesoConvivencia && '🔒'}
            </button>
            <button onClick={() => setActiveTab('pie')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'pie' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
              Expediente PIE {!tieneAccesoPie && '🔒'}
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENIDO DE PESTAÑAS --- */}

      {/* PESTAÑA A: PEDAGÓGICO */}
      {activeTab === 'pedagogico' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Promedio General</p>
                <p className={`text-4xl font-black tracking-tight ${Number(promedioGral) < 4.0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>{promedioGral}</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Asistencia Total</p>
                <p className={`text-4xl font-black tracking-tight ${asistenciaGral !== '--' && asistenciaGral < 85 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{asistenciaGral}%</p>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${asistenciaGral !== '--' && asistenciaGral < 85 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Núcleo Familiar</h3>
              </div>
              {data.apoderado ? (
                <div className="bg-gray-50/50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{data.apoderado.nombre}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">{data.apoderado.parentesco} • RUT: {data.apoderado.rut_apoderado}</p>
                  <div className="mt-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm bg-indigo-50 dark:bg-indigo-900/10 py-2 px-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {data.apoderado.telefono || 'Sin teléfono'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Sin apoderado registrado.</p>
              )}
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Libro de Calificaciones
                </h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-white dark:bg-gray-800 text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4">Asignatura</th>
                      <th className="px-6 py-4">Evaluación</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4 text-right">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.notas.length > 0 ? (
                      data.notas.map(n => (
                        <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-200">{n.asignaturas?.nombre || 'Desconocida'}</td>
                          <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{n.tipo_evaluacion}</td>
                          <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(n.fecha).toLocaleDateString('es-CL')}</td>
                          <td className={`px-6 py-4 text-right font-black text-lg ${Number(n.nota) < 4.0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{n.nota}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="4" className="p-8 text-center text-gray-500">No hay calificaciones registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PESTAÑA B: CONVIVENCIA ESCOLAR */}
      {activeTab === 'convivencia' && (
        !tieneAccesoConvivencia ? (
          <div className="p-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-800/30">
            <span className="text-4xl mb-3">🔒</span>
            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Acceso Restringido</h3>
            <p className="text-sm text-gray-500 max-w-md">Solo Inspectores, Docentes y Dirección pueden ver el historial de convivencia escolar.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hoja de Vida (Casos RICE)</h3>
            </div>

            {data.convivencia.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.convivencia.map(item => (
                  <div key={item.id} className={`p-5 rounded-xl border bg-white dark:bg-gray-800 shadow-sm ${
                    item.color === 'emerald' ? 'border-emerald-100 dark:border-emerald-900/30' : 
                    item.color === 'red' ? 'border-red-100 dark:border-red-900/30' : 
                    'border-orange-100 dark:border-orange-900/30'
                  } ${item.esCaso && item.estado === 'Cerrado' ? 'opacity-80 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{item.titulo}</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">{new Date(item.fecha).toLocaleDateString('es-CL')} • Registrado por: {item.autor}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        item.estado === 'Cerrado' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                        item.color === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                        item.color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {item.esCaso ? `Protocolo: ${item.estado}` : item.estado}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100/50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">{item.descripcion}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-base font-bold text-emerald-800 dark:text-emerald-400">Historial Limpio</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">El estudiante no registra faltas ni protocolos activos.</p>
              </div>
            )}
          </div>
        )
      )}

      {/* PESTAÑA C: EXPEDIENTE CLÍNICO PIE */}
      {activeTab === 'pie' && (
        !tieneAccesoPie ? (
          <div className="p-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-800/30">
            <span className="text-4xl mb-3">🔒</span>
            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Protección de Datos Sensibles (Ley N° 19.628)</h3>
            <p className="text-sm text-gray-500 max-w-md">La información diagnóstica y evolución médica solo es visible para Especialistas PIE y Equipo Directivo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Lado Izquierdo: Diagnóstico */}
            <div className="lg:col-span-1">
              {data.pie ? (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm h-full">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-5 border-b border-gray-200 dark:border-gray-700 pb-3">Ficha Clínica Ministerial</h3>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Clasificación Dto. 170</p>
                      <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold ${data.pie.tipo_necesidad === 'NEEP' ? 'bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                        {data.pie.tipo_necesidad === 'NEEP' ? 'NEEP (Permanente)' : 'NEET (Transitoria)'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estado de Reevaluación (FUDEI)</p>
                      <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold border ${data.pie.estado_fudei === 'Al Día' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200 animate-pulse'}`}>
                        {data.pie.estado_fudei}
                      </span>
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Diagnóstico Médico Base</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">{data.pie.diagnostico}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center h-full flex flex-col justify-center">
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Estudiante Regular</p>
                  <p className="text-xs text-gray-500 mt-1">No pertenece al Programa de Integración Escolar.</p>
                </div>
              )}
            </div>

            {/* Lado Derecho: Sesiones */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm h-full">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-5 border-b border-gray-100 dark:border-gray-700 pb-3">Libro de Atenciones (Historial)</h3>

                {data.sesionesPie.length > 0 ? (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {data.sesionesPie.map(sesion => (
                      <div key={sesion.id} className="p-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-sm block">{sesion.nombre_especialista}</span>
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded mt-1 inline-block">
                              {new Date(sesion.fecha_sesion).toLocaleDateString('es-CL')}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 px-2 py-1 rounded">
                            {sesion.lugar_atencion}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm bg-white dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap shadow-inner border border-gray-100 dark:border-gray-800">
                          {sesion.observacion}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center text-gray-500 py-10">
                    {data.pie ? "No se registran atenciones clínicas cargadas en este período." : "Requiere ingreso al PIE para registrar atenciones."}
                  </p>
                )}
              </div>
            </div>

          </div>
        )
      )}

      {/* --- MODAL DE EDICIÓN --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Expediente del Alumno</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleGuardarCambios} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Foto de Perfil</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                <input type="text" required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha de Nacimiento</label>
                <input type="date" value={editForm.fecha_nacimiento} onChange={(e) => setEditForm({ ...editForm, fecha_nacimiento: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none scheme-light-dark" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Dirección Física</label>
                <input type="text" placeholder="Ej: Av. Los Leones 1234" value={editForm.direccion} onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 flex justify-center items-center disabled:opacity-70">
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}