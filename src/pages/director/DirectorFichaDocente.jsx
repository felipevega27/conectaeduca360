import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import UserAvatar from '../../components/UserAvatar';
import { SkeletonCard, SkeletonRow, SkeletonBase } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

// Reutilizamos la misma imagen de portada
import portadaImg from '../../assets/FONDO PERFILES.png';

export default function DirectorFichaDocente() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // El RUT viene en la variable "state" desde la tabla de DirectorDocentes
  const docenteParams = location.state?.docenteSeleccionado;
  const rutDocente = docenteParams?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState({
    perfil: null,
    asistencia: [],
    cursoAsignado: null
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    titulo_profesional: '',
    curso_o_cargo: '',
    tipo_contrato: ''
  });

  useEffect(() => {
    if (rutDocente) {
      cargarFicha();
    } else {
      setIsLoading(false);
    }
  }, [rutDocente]);

  const cargarFicha = async () => {
    try {
      setIsLoading(true);
      // Consultamos el perfil del profesor
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('rut', rutDocente).single();
      // Consultamos su asistencia
      const { data: asistencia } = await supabase.from('asistencia_profesores').select('*').eq('rut_profesor', rutDocente).order('fecha', { ascending: false });

      // Consultamos si tiene un curso a cargo
      const { data: curso } = await supabase.from('cursos').select('nombre').eq('rut_profesor_jefe', rutDocente).maybeSingle();

      setData({ 
        perfil, 
        asistencia: asistencia || [],
        cursoAsignado: curso?.nombre || null 
      });
    } catch (error) {
      console.error("Error al cargar expediente docente:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalEdicion = () => {
    if (!data.perfil) return;
    setEditForm({
      nombre: data.perfil.nombre || '',
      email: data.perfil.email || '',
      telefono: data.perfil.telefono || '',
      titulo_profesional: data.perfil.titulo_profesional || '',
      curso_o_cargo: data.perfil.curso_o_cargo || '',
      tipo_contrato: data.perfil.tipo_contrato || ''
    });
    setIsEditModalOpen(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          nombre: editForm.nombre,
          email: editForm.email,
          telefono: editForm.telefono,
          titulo_profesional: editForm.titulo_profesional,
          curso_o_cargo: editForm.curso_o_cargo,
          tipo_contrato: editForm.tipo_contrato
        })
        .eq('rut', rutDocente);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        perfil: { ...prev.perfil, ...editForm }
      }));
      toast.success('Perfil actualizado correctamente');
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error('Error al actualizar el perfil: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const calcularAsistencia = () => {
    if (!data.asistencia.length) return '--';
    const presentes = data.asistencia.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
    return Math.round((presentes / data.asistencia.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando perfil del profesor...</p>
        </div>
      </div>
    );
  }

  if (!data.perfil) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Docente no encontrado</h2>
          <button onClick={() => navigate(-1)} className="w-full mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors">Volver al directorio</button>
        </div>
      </div>
    );
  }

  const asistenciaGral = calcularAsistencia();

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 hover:text-emerald-600 transition-all">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver atrás
        </button>
      </div>
          
      {/* CABECERA DEL PERFIL DOCENTE */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 relative">
        <div className="h-32 sm:h-40 w-full bg-cover bg-center relative" style={{ backgroundImage: `url('${portadaImg}')` }}>
          <div className="absolute inset-0 bg-emerald-900/50 mix-blend-multiply"></div>
          
          <button 
            onClick={abrirModalEdicion}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border border-white/30 hover:border-white/50 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Editar Perfil
          </button>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col sm:flex-row gap-5 relative z-10">
          <UserAvatar 
            nombre={data.perfil.nombre} 
            avatarUrl={data.perfil.avatar_url}
            className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0 border-4 border-white dark:border-gray-800 bg-linear-to-tr from-emerald-100 to-teal-100 text-emerald-700 text-3xl sm:text-4xl font-bold shadow-lg"
          />
          
          <div className="flex-1 text-center sm:text-left sm:pt-3 pb-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 justify-center sm:justify-start">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{data.perfil.nombre}</h1>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-1 sm:mt-0">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50">
                  {data.perfil.titulo_profesional || 'Profesional Docente'}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> RUT: {data.perfil.rut}</span>
              {data.perfil.email && <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {data.perfil.email}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Cumplimiento Mensual</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{asistenciaGral}%</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Situación Contractual</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2"><span className="text-gray-500">Especialidad Principal</span><span className="font-semibold text-gray-800 dark:text-white text-right">{data.perfil.curso_o_cargo || 'General'}</span></div>
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2"><span className="text-gray-500">Tipo de Contrato</span><span className="font-semibold text-gray-800 dark:text-white text-right">{data.perfil.tipo_contrato || 'Indefinido'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Jefatura de Curso</span><span className="font-semibold text-gray-800 dark:text-white text-right">{data.cursoAsignado ? `Sí (${data.cursoAsignado})` : 'No tiene'}</span></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Registro de Asistencia del Profesional</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white dark:bg-gray-800 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4">Fecha de Marca</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Observación Jefatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-gray-50/30 dark:bg-gray-900/30">
                  {data.asistencia.length > 0 ? (
                    data.asistencia.slice(0, 5).map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">{new Date(a.fecha).toLocaleDateString('es-CL')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${a.estado === 'Presente' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : a.estado === 'Atraso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {a.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{a.observacion || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="3" className="p-8 text-center text-gray-500">No hay marcas de asistencia recientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE EDICIÓN DE PERFIL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden flex flex-col max-h-[90vh] relative">
            {isSaving && <BackdropLoader mensaje="Guardando..." />}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Editar Perfil Docente</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="editDocenteForm" onSubmit={guardarEdicion} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                    <input type="text" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Título Profesional</label>
                    <input type="text" value={editForm.titulo_profesional} onChange={e => setEditForm({...editForm, titulo_profesional: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Correo Electrónico</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teléfono</label>
                    <input type="text" value={editForm.telefono} onChange={e => setEditForm({...editForm, telefono: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Especialidad Principal</label>
                    <input type="text" value={editForm.curso_o_cargo} onChange={e => setEditForm({...editForm, curso_o_cargo: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo de Contrato</label>
                    <select value={editForm.tipo_contrato} onChange={e => setEditForm({...editForm, tipo_contrato: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-emerald-500 outline-none">
                      <option value="">-- Seleccionar --</option>
                      <option value="Indefinido">Indefinido</option>
                      <option value="Plazo Fijo">Plazo Fijo</option>
                      <option value="Honorarios">Honorarios</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 shrink-0 flex gap-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600 transition-colors">Cancelar</button>
              <button type="submit" form="editDocenteForm" disabled={isSaving} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex justify-center items-center">
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}