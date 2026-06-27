import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import UserAvatar from '../../components/UserAvatar';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

export default function DirectorDocentes() {
  const navigate = useNavigate();

  // --- ESTADO DEL BUSCADOR ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS DE LA BASE DE DATOS ---
  const [docentes, setDocentes] = useState([]);
  const [metricas, setMetricas] = useState({
    asistenciaHoy: '100%',
    licenciasActivas: 0,
    atrasosHoy: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // --- ESTADOS DE MODALES ---
  const [isModalReemplazoOpen, setIsModalReemplazoOpen] = useState(false);
  const [isModalLicenciaOpen, setIsModalLicenciaOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // --- FORMULARIOS ---
  const [rutAusente, setRutAusente] = useState('');
  const [rutReemplazante, setRutReemplazante] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  const [licenciaForm, setLicenciaForm] = useState({ rut_profesor: '', estado: 'Atraso', observacion: '' });
  const [editForm, setEditForm] = useState({ nombre: '', asignatura: '' });
  const [selectedDocente, setSelectedDocente] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- 1. CARGAR DATOS Y ORDENAR ---
  const cargarGestionDocentes = async () => {
    try {
      setIsLoading(true);

      const { data: profesoresData, error: errProf } = await supabase.from('perfiles').select('*').eq('rol', 'profesor');
      if (errProf) throw errProf;

      const hoyISO = new Date().toISOString().split('T')[0];
      const { data: asistenciaData, error: errAsis } = await supabase.from('asistencia_profesores').select('*').eq('fecha', hoyISO);
      if (errAsis) throw errAsis;

      const totalProfesores = profesoresData.length;
      const conteoAtrasos = asistenciaData?.filter(a => a.estado === 'Atraso').length || 0;
      const conteoLicencias = asistenciaData?.filter(a => a.estado === 'Licencia' || a.estado === 'Permiso').length || 0;
      const conteoFaltas = asistenciaData?.filter(a => a.estado === 'Inasistencia').length || 0;

      const totalAusentes = conteoLicencias + conteoFaltas;
      const totalPresentes = totalProfesores - totalAusentes;
      const porcentaje = totalProfesores > 0 ? Math.round((totalPresentes / totalProfesores) * 100) : 100;

      setMetricas({ asistenciaHoy: `${porcentaje}%`, licenciasActivas: conteoLicencias + conteoFaltas, atrasosHoy: conteoAtrasos });

      const profesoresCruzados = profesoresData.map((profe) => {
        const registroExcepcion = asistenciaData?.find(a => a.rut_profesor === profe.rut);
        return {
          ...profe,
          id: profe.rut,
          asignatura: profe.curso_o_cargo || 'No asignada',
          estado: registroExcepcion ? registroExcepcion.estado : 'Presente',
          observacion: registroExcepcion?.observacion || ''
        };
      });

      // --- NUEVO: ORDENAMIENTO INTELIGENTE (Prioridad de visualización) ---
      const ordenPrioridad = {
        'Inasistencia': 1,
        'Licencia': 2,
        'Permiso': 3,
        'Atraso': 4,
        'Presente': 5
      };

      profesoresCruzados.sort((a, b) => {
        // Primero ordena por el estado (los problemas arriba)
        if (ordenPrioridad[a.estado] !== ordenPrioridad[b.estado]) {
          return ordenPrioridad[a.estado] - ordenPrioridad[b.estado];
        }
        // Si tienen el mismo estado, los ordena alfabéticamente
        return a.nombre.localeCompare(b.nombre);
      });

      setDocentes(profesoresCruzados);
    } catch (error) {
      console.error('Error al cargar gestión de docentes:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarGestionDocentes();
  }, []);

  // --- 2. GUARDAR AUSENCIA ---
  const guardarLicenciaFalta = async (e) => {
    e.preventDefault();
    if (!licenciaForm.rut_profesor) {
      toast.error("Selecciona a un profesor.");
      return;
    }
    setIsSaving(true);
    try {
      const hoyISO = new Date().toISOString().split('T')[0];
      const { data: existe } = await supabase.from('asistencia_profesores').select('id').eq('rut_profesor', licenciaForm.rut_profesor).eq('fecha', hoyISO).single();

      if (existe) {
        await supabase.from('asistencia_profesores').update({ estado: licenciaForm.estado, observacion: licenciaForm.observacion }).eq('id', existe.id);
      } else {
        await supabase.from('asistencia_profesores').insert([{ rut_profesor: licenciaForm.rut_profesor, fecha: hoyISO, estado: licenciaForm.estado, observacion: licenciaForm.observacion }]);
      }
      await cargarGestionDocentes();
      setIsModalLicenciaOpen(false);
      setLicenciaForm({ rut_profesor: '', estado: 'Atraso', observacion: '' });
      toast.success("Excepción registrada correctamente.");
    } catch (err) {
      toast.error('Error al registrar la ausencia: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- 3. GUARDAR REEMPLAZO ---
  const guardarReemplazo = async (e) => {
    e.preventDefault();
    if (!rutAusente || !rutReemplazante || !fechaInicio) {
      toast.error("Completa los campos obligatorios.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('reemplazos').insert([{ rut_profesor_ausente: rutAusente, rut_reemplazante: rutReemplazante, fecha_inicio: fechaInicio, fecha_termino: fechaTermino || null, estado: 'Confirmado' }]);
      if (error) throw error;
      toast.success('Reemplazo ingresado exitosamente en el sistema.');
      setIsModalReemplazoOpen(false); setRutAusente(''); setRutReemplazante(''); setFechaInicio(''); setFechaTermino('');
    } catch (err) {
      toast.error('Error al guardar el reemplazo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- 4. EDICIÓN Y ELIMINACIÓN (Soft Delete) ---
  const abrirModalEditar = (docente) => { setSelectedDocente(docente); setEditForm({ nombre: docente.nombre, asignatura: docente.curso_o_cargo || '' }); setIsEditModalOpen(true); };
  const guardarEdicion = async (e) => {
    e.preventDefault(); setIsSaving(true);
    try {
      let nuevaAvatarUrl = undefined;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${selectedDocente.rut}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        nuevaAvatarUrl = publicUrl;
      }
      const updates = { nombre: editForm.nombre, curso_o_cargo: editForm.asignatura };
      if (nuevaAvatarUrl) updates.avatar_url = nuevaAvatarUrl;

      const { error } = await supabase.from('perfiles').update(updates).eq('rut', selectedDocente.rut);
      if (error) throw error;
      await cargarGestionDocentes(); setIsEditModalOpen(false); setAvatarFile(null);
      toast.success("Docente actualizado exitosamente.");
    } catch (error) { toast.error("Error al actualizar: " + error.message); } finally { setIsSaving(false); }
  };
  
  const abrirModalEliminar = (docente) => { setSelectedDocente(docente); setIsDeleteModalOpen(true); };
  const confirmarEliminacion = async () => {
    setIsDeleting(true);
    try {
      // Borrado Lógico: Conservamos historial (asistencia, notas) pero lo ocultamos de las listas
      const { error } = await supabase.from('perfiles').update({ rol: 'inactivo' }).eq('rut', selectedDocente.rut);
      if (error) throw error;
      
      // Liberar jefatura de curso si tenía una
      await supabase.from('cursos').update({ rut_profesor_jefe: null }).eq('rut_profesor_jefe', selectedDocente.rut);
      
      setDocentes(docentes.filter(d => d.rut !== selectedDocente.rut)); 
      setIsDeleteModalOpen(false);
      toast.success(`Docente ${selectedDocente.nombre} eliminado exitosamente.`);
    } catch (error) { toast.error("Error al eliminar al docente: " + error.message); } finally { setIsDeleting(false); }
  };

  const docentesFiltrados = docentes.filter(doc =>
    doc.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || doc.asignatura.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

      {/* HEADER */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión del Equipo Docente</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Directorio, asistencia diaria, licencias y desempeño.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setIsModalLicenciaOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-400 px-4 py-2.5 text-sm font-bold transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Registrar Falta/Atraso
          </button>
          <button onClick={() => setIsModalReemplazoOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Asignar Reemplazo
          </button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ASISTENCIA HOY</p><h3 className="text-xl font-bold text-gray-800 dark:text-white">{metricas.asistenciaHoy}</h3></div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 p-3 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
          <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">LICENCIAS / FALTAS</p><h3 className="text-xl font-bold text-gray-800 dark:text-white">{metricas.licenciasActivas}</h3></div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ATRASOS HOY</p><h3 className="text-xl font-bold text-gray-800 dark:text-white">{metricas.atrasosHoy}</h3></div>
        </div>
      </div>

      {/* TABLA DIRECTORIO Y CONTROL */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Directorio y Control Diario</h2>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar profesor o asignatura..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full sm:w-64 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent dark:text-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-semibold">Docente</th>
                  <th className="p-4 font-semibold text-center">RUT</th>
                  {/* AQUÍ ESTÁ LA MEJORA DEL TÍTULO DE LA FECHA */}
                  <th className="p-4 font-semibold text-center">
                    Estado ({new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })})
                  </th>
                  <th className="p-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {docentesFiltrados.length > 0 ? (
                  docentesFiltrados.map((doc) => (
                    // Si no está presente, sombreamos un poco la fila para que resalte
                    <tr key={doc.id} className={`group transition-colors ${doc.estado !== 'Presente' ? 'bg-orange-50/20 dark:bg-orange-900/5' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            nombre={doc.nombre} 
                            avatarUrl={doc.avatar_url}
                            className={`w-9 h-9 text-xs ${doc.estado !== 'Presente' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 text-blue-700 dark:text-blue-400'}`}
                          />
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-200">{doc.nombre}</p>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{doc.asignatura}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-600 dark:text-gray-300 font-medium">{doc.rut}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center flex-col items-center">
                          {/* Presente ahora es sutil y limpio */}
                          {doc.estado === 'Presente' && <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> PRESENTE</span>}

                          {/* Las excepciones sí son badges (etiquetas) fuertes */}
                          {doc.estado === 'Atraso' && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50">ATRASO</span>}
                          {doc.estado === 'Licencia' && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50">LICENCIA</span>}
                          {doc.estado === 'Permiso' && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50">PERMISO</span>}
                          {doc.estado === 'Inasistencia' && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50">INASISTENCIA</span>}

                          {doc.observacion && <p className="text-[10px] text-gray-400 mt-1 italic max-w-[120px] truncate" title={doc.observacion}>{doc.observacion}</p>}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => navigate('/panel/director/ficha-docente', { state: { docenteSeleccionado: doc } })} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors" title="Ver Ficha e Historial">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => abrirModalEditar(doc)} className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 rounded-lg transition-colors" title="Editar Información">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => abrirModalEliminar(doc)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors" title="Eliminar Docente">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-500 dark:text-gray-400">No se encontró ningún docente con "{searchTerm}"</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- MODALES OMITIDOS PARA BREVEDAD (SON LOS MISMOS QUE YA TIENES) --- */}
      {/* ... Modal Licencia ... */}
      {/* ... Modal Reemplazo ... */}
      {/* ... Modal Edición ... */}
      {/* ... Modal Eliminar ... */}

      {isModalLicenciaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden relative">
            {isSaving && <BackdropLoader mensaje="Registrando..." />}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-orange-50/50 dark:bg-orange-900/20">
              <h2 className="text-lg font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Registrar Excepción de Hoy
              </h2>
              <button onClick={() => setIsModalLicenciaOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={guardarLicenciaFalta} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Seleccionar Docente</label>
                <select required value={licenciaForm.rut_profesor} onChange={(e) => setLicenciaForm({ ...licenciaForm, rut_profesor: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-orange-500 outline-none">
                  <option value="" disabled>Seleccione al profesor...</option>
                  {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Motivo de Excepción</label>
                <select value={licenciaForm.estado} onChange={(e) => setLicenciaForm({ ...licenciaForm, estado: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-orange-500 outline-none">
                  <option value="Atraso">Atraso (Llegó tarde)</option>
                  <option value="Licencia">Licencia Médica</option>
                  <option value="Inasistencia">Inasistencia (Sin justificar)</option>
                  <option value="Permiso">Permiso Administrativo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Observación (Opcional)</label>
                <input type="text" placeholder="Ej: Tráfico, Motivos de salud..." value={licenciaForm.observacion} onChange={(e) => setLicenciaForm({ ...licenciaForm, observacion: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-orange-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                <button type="button" onClick={() => setIsModalLicenciaOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 shadow-md flex justify-center items-center">
                  Registrar Excepción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalReemplazoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden relative">
            {isSaving && <BackdropLoader mensaje="Guardando..." />}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Asignar Reemplazo
              </h2>
              <button onClick={() => setIsModalReemplazoOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={guardarReemplazo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Docente Ausente</label>
                <select required value={rutAusente} onChange={(e) => setRutAusente(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none">
                  <option value="" disabled>Seleccione docente ausente...</option>
                  {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">RUT Docente Reemplazante</label>
                <input type="text" required placeholder="Ej: 15.234.567-8" value={rutReemplazante} onChange={(e) => setRutReemplazante(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha Inicio</label>
                  <input type="date" required value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none scheme-light-dark" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha Término</label>
                  <input type="date" value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none scheme-light-dark" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                <button type="button" onClick={() => setIsModalReemplazoOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-md flex justify-center items-center">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden relative">
            {isSaving && <BackdropLoader mensaje="Guardando..." />}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Docente</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={guardarEdicion} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Foto de Perfil</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900/30 dark:file:text-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                <input type="text" required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Asignatura / Especialidad</label>
                <input type="text" required value={editForm.asignatura} onChange={(e) => setEditForm({ ...editForm, asignatura: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 shadow-md flex justify-center items-center">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-red-100 dark:border-red-900/30 animate-[fadeInUp_0.2s_ease-out] relative overflow-hidden">
            {isDeleting && <BackdropLoader mensaje="Eliminando..." />}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Eliminar a {selectedDocente?.nombre}?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Se borrará permanentemente su registro de la plataforma. Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={confirmarEliminacion} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-md flex justify-center items-center">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}