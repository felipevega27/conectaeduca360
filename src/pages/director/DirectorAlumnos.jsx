import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import UserAvatar from '../../components/UserAvatar';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { SkeletonRow } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

export default function DirectorAlumnos() {
  const navigate = useNavigate();
  
  // --- ESTADOS DE DATOS ---
  const [alumnos, setAlumnos] = useState([]);
  const [cursosDisponibles, setCursosDisponibles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- ESTADOS DE FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('Todos');

  // --- ESTADOS DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- ESTADOS DE MODALES Y ACCIONES ---
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  
  // Modal Eliminar
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Modal Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({ 
    nombre: '', 
    id_curso: '',
    fecha_nacimiento: '',
    direccion: '',
    nombre_apoderado: '',
    telefono: '',
    email_apoderado: '',
    parentesco: ''
  });

  // --- 1. CARGA PRINCIPAL ---
  const cargarDatos = async () => {
    try {
      setIsLoading(true);

      // Cargar Catálogos
      const { data: cursosData } = await supabase.from('cursos').select('*').order('nombre');
      setCursosDisponibles(cursosData || []);

      // Cargar Datos Relacionales
      const { data: perfilesData, error } = await supabase.from('perfiles').select('*');
      if (error) throw error;

      const { data: matriculasData } = await supabase.from('matriculas').select('*');
      const { data: relacionData } = await supabase.from('relacion_apoderados').select('*');
      const { data: asistenciaData } = await supabase.from('asistencia_alumnos').select('*');

      const soloAlumnos = perfilesData.filter(p => p.rol === 'alumno');

      const alumnosArmados = soloAlumnos.map((perfil) => {
        const suMatricula = matriculasData?.find(m => m.rut_alumno === perfil.rut);
        const suCursoObj = suMatricula ? cursosData?.find(c => c.id == suMatricula.id_curso) : null;
        const suRelacion = relacionData?.find(r => r.rut_alumno === perfil.rut);
        const suApoderado = suRelacion ? perfilesData?.find(p => p.rut === suRelacion.rut_apoderado) : null;

        // Calcular Asistencia
        let asistenciaValor = null;
        let asistenciaTexto = '--%';
        if (asistenciaData) {
          const registrosEstudiante = asistenciaData.filter(a => a.rut_alumno === perfil.rut);
          if (registrosEstudiante.length > 0) {
            const presentes = registrosEstudiante.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
            asistenciaValor = Math.round((presentes / registrosEstudiante.length) * 100);
            asistenciaTexto = `${asistenciaValor}%`;
          }
        }

        return {
          rut: perfil.rut,
          nombre: perfil.nombre,
          avatar_url: perfil.avatar_url,
          fecha_nacimiento: perfil.fecha_nacimiento || '',
          direccion: perfil.direccion || '',
          id_curso: suCursoObj ? suCursoObj.id : '',
          cursoNombre: suCursoObj ? suCursoObj.nombre : 'Sin Matricular',
          apoderadoNombre: suApoderado ? suApoderado.nombre : 'Sin asignar',
          apoderadoRut: suApoderado ? suApoderado.rut : '---',
          apoderadoEmail: suApoderado ? suApoderado.email : '',
          apoderadoTelefono: suRelacion ? suRelacion.telefono : '',
          apoderadoParentesco: suRelacion ? suRelacion.parentesco : 'Madre',
          asistenciaTexto: asistenciaTexto,
          asistenciaValor: asistenciaValor
        };
      });

      // Ordenar alfabéticamente
      alumnosArmados.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnos(alumnosArmados);

    } catch (error) {
      console.error('Error cargando el directorio:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // --- 2. LÓGICA DE FILTRADO ---
  const alumnosFiltrados = alumnos.filter(a => {
    const matchSearch = a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || a.rut.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCurso = cursoFiltro === 'Todos' || a.id_curso == cursoFiltro;
    return matchSearch && matchCurso;
  });

  // Reiniciar a página 1 si cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, cursoFiltro]);

  // --- 2.1. LÓGICA DE PAGINACIÓN ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = alumnosFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(alumnosFiltrados.length / itemsPerPage);

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  // --- 2.2. EXPORTAR A EXCEL ---
  const exportarExcel = () => {
    const dataToExport = alumnosFiltrados.map(a => ({
      'RUT': a.rut,
      'Nombre Alumno': a.nombre,
      'Curso': a.cursoNombre,
      'Asistencia': a.asistenciaTexto,
      'Apoderado': a.apoderadoNombre,
      'Teléfono': a.apoderadoTelefono || 'Sin registro',
      'Correo': a.apoderadoEmail || 'Sin registro'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');
    XLSX.writeFile(workbook, `Directorio_Alumnos_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Archivo Excel descargado correctamente.');
  };

  // --- 3. LÓGICA ELIMINAR ---
  const abrirModalEliminar = (alumno) => {
    setSelectedAlumno(alumno);
    setIsDeleteModalOpen(true);
  };

  const confirmarEliminacion = async () => {
    setIsDeleting(true);
    try {
      // SOFT DELETE: Borramos la matrícula en lugar de eliminar la información completa
      // Esto retira al estudiante del año escolar actual pero preserva notas y asistencias
      const { error } = await supabase.from('matriculas').delete().eq('rut_alumno', selectedAlumno.rut);
      if (error) throw error;

      // Pausa para consistencia visual
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Estudiante retirado correctamente. Su historial ha sido preservado.');
      
      await cargarDatos();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Hubo un error al retirar al estudiante.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- 4. LÓGICA EDITAR RÁPIDO ---
  const abrirModalEditar = (alumno) => {
    setSelectedAlumno(alumno);
    setEditForm({
      nombre: alumno.nombre,
      id_curso: alumno.id_curso || '',
      fecha_nacimiento: alumno.fecha_nacimiento || '',
      direccion: alumno.direccion || '',
      nombre_apoderado: alumno.apoderadoNombre !== 'Sin asignar' ? alumno.apoderadoNombre : '',
      telefono: (alumno.apoderadoTelefono || '').replace(/^\+56\s?9\s?/, '').replace(/\s/g, ''),
      email_apoderado: alumno.apoderadoEmail || '',
      parentesco: alumno.apoderadoParentesco || 'Madre'
    });
    setIsEditModalOpen(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);
    try {
      // 1. Actualizar Datos del Alumno en Perfiles
      const updatesAlumno = {};
      if (editForm.nombre !== selectedAlumno.nombre) updatesAlumno.nombre = editForm.nombre;
      if (editForm.fecha_nacimiento !== selectedAlumno.fecha_nacimiento) updatesAlumno.fecha_nacimiento = editForm.fecha_nacimiento;
      if (editForm.direccion !== selectedAlumno.direccion) updatesAlumno.direccion = editForm.direccion;
      
      if (Object.keys(updatesAlumno).length > 0) {
        await supabase.from('perfiles').update(updatesAlumno).eq('rut', selectedAlumno.rut);
      }

      // 2. Actualizar o Insertar Matrícula (Cambio de curso)
      if (editForm.id_curso !== selectedAlumno.id_curso) {
        if (selectedAlumno.id_curso) {
          await supabase.from('matriculas').update({ id_curso: parseInt(editForm.id_curso) }).eq('rut_alumno', selectedAlumno.rut);
        } else {
          await supabase.from('matriculas').insert([{ 
            rut_alumno: selectedAlumno.rut, 
            id_curso: parseInt(editForm.id_curso),
            anio_escolar: new Date().getFullYear()
          }]);
        }
      }

      // 3. Actualizar Datos del Apoderado (Si tiene apoderado asignado)
      if (selectedAlumno.apoderadoRut !== '---') {
        const updatesApoderado = {};
        if (editForm.nombre_apoderado !== selectedAlumno.apoderadoNombre) updatesApoderado.nombre = editForm.nombre_apoderado;
        if (editForm.email_apoderado !== selectedAlumno.apoderadoEmail) updatesApoderado.email = editForm.email_apoderado;
        
        if (Object.keys(updatesApoderado).length > 0) {
          await supabase.from('perfiles').update(updatesApoderado).eq('rut', selectedAlumno.apoderadoRut);
        }

        const updatesRelacion = {};
        if (editForm.telefono !== ((selectedAlumno.apoderadoTelefono || '').replace(/^\+56\s?9\s?/, '').replace(/\s/g, ''))) {
          updatesRelacion.telefono = editForm.telefono ? `+56 9 ${editForm.telefono}` : null;
        }
        if (editForm.parentesco !== selectedAlumno.apoderadoParentesco) updatesRelacion.parentesco = editForm.parentesco;
        
        if (Object.keys(updatesRelacion).length > 0) {
          await supabase.from('relacion_apoderados')
            .update(updatesRelacion)
            .eq('rut_alumno', selectedAlumno.rut)
            .eq('rut_apoderado', selectedAlumno.apoderadoRut);
        }
      }

      // Pausa para consistencia visual
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recargamos silenciosamente los datos para reflejar los cambios
      await cargarDatos();
      setIsEditModalOpen(false);
      toast.success('Datos actualizados correctamente.');

    } catch (error) {
      console.error(error);
      toast.error('Hubo un error al actualizar los datos.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Directorio General de Alumnos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administración de matrículas, cursos y Fichas de Alumnos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportarExcel}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Exportar Excel
          </button>
          <button 
            onClick={() => navigate('/panel/director/alumnos/crear')}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all hover:-translate-y-0.5 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Matricular Alumno Nuevo
          </button>
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS (Buscador y Filtro) */}
      <div className="bg-white dark:bg-gray-800 rounded-t-xl border border-gray-200 dark:border-gray-700 border-b-0 p-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
        
        {/* Buscador */}
        <div className="relative w-full sm:max-w-md">
          <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Buscar por RUT o Nombre..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 dark:text-white text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
          />
        </div>

        {/* Filtro por Curso */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">Filtrar curso:</label>
          <select 
            value={cursoFiltro}
            onChange={(e) => setCursoFiltro(e.target.value)}
            className="h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 dark:text-white text-sm focus:border-blue-500 outline-none cursor-pointer w-full sm:w-48"
          >
            <option value="Todos">Todos los Cursos</option>
            {cursosDisponibles.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="rounded-b-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-semibold">Estudiante</th>
                <th className="p-4 font-semibold">RUT</th>
                <th className="p-4 font-semibold">Curso Asignado</th>
                <th className="p-4 font-semibold text-center">Asistencia</th>
                <th className="p-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <>
                  <tr><td colSpan="12"><SkeletonRow /></td></tr>
                  <tr><td colSpan="12"><SkeletonRow /></td></tr>
                  <tr><td colSpan="12"><SkeletonRow /></td></tr>
                  <tr><td colSpan="12"><SkeletonRow /></td></tr>
                  <tr><td colSpan="12"><SkeletonRow /></td></tr>
                </>
              ) : currentItems.length > 0 ? (
                currentItems.map((alumno) => (
                  <tr key={alumno.rut} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="p-4 flex items-center gap-3">
                      <UserAvatar 
                        nombre={alumno.nombre} 
                        avatarUrl={alumno.avatar_url}
                        className="w-8 h-8 text-blue-700 dark:text-blue-400 font-bold text-xs bg-linear-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40"
                      />
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 leading-tight">{alumno.nombre}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Apoderado: {alumno.apoderadoNombre}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 font-medium">{alumno.rut}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        alumno.cursoNombre === 'Sin Matricular' 
                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                      }`}>
                        {alumno.cursoNombre}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-bold ${
                        alumno.asistenciaValor === null 
                          ? 'text-gray-400'
                          : alumno.asistenciaValor >= 85
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}>
                        {alumno.asistenciaTexto}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        
                        {/* Botón Ver Ficha */}
                        <button 
                          onClick={() => navigate(`/panel/director/alumnos/${alumno.rut}`)}
                          className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                          title="Ver Ficha Completa"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        
                        {/* Botón Editar Rápido */}
                        <button 
                          onClick={() => abrirModalEditar(alumno)}
                          className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
                          title="Editar Curso/Nombre"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>

                        {/* Botón Eliminar */}
                        <button 
                          onClick={() => abrirModalEliminar(alumno)}
                          className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                          title="Eliminar Estudiante"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No hay alumnos que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, alumnosFiltrados.length)} de {alumnosFiltrados.length} alumnos
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={prevPage} 
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <div className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Página {currentPage} de {totalPages}
              </div>
              <button 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

      {/* --- MODAL EDICIÓN COMPLETA --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden max-h-[90vh] flex flex-col relative">
            {isSavingEdit && <BackdropLoader mensaje="Guardando cambios..." />}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Datos del Estudiante</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={guardarEdicion} className="p-6 overflow-y-auto space-y-6">
              
              {/* Sección Alumno */}
              <div>
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Datos del Estudiante</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                    <input 
                      type="text" required value={editForm.nombre} onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Mover de Curso</label>
                    <select 
                      required value={editForm.id_curso} onChange={(e) => setEditForm({...editForm, id_curso: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    >
                      <option value="" disabled>Seleccione el curso...</option>
                      {cursosDisponibles.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha de Nacimiento</label>
                    <input 
                      type="date" value={editForm.fecha_nacimiento} onChange={(e) => setEditForm({...editForm, fecha_nacimiento: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none scheme-light-dark" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Dirección Completa</label>
                    <input 
                      type="text" value={editForm.direccion} onChange={(e) => setEditForm({...editForm, direccion: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Sección Apoderado */}
              {selectedAlumno?.apoderadoRut !== '---' && (
                <div>
                  <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Datos del Apoderado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Apoderado</label>
                      <input 
                        type="text" required value={editForm.nombre_apoderado} onChange={(e) => setEditForm({...editForm, nombre_apoderado: e.target.value})}
                        className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Parentesco</label>
                      <select 
                        value={editForm.parentesco} onChange={(e) => setEditForm({...editForm, parentesco: e.target.value})}
                        className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      >
                        <option value="Madre">Madre</option>
                        <option value="Padre">Padre</option>
                        <option value="Tutor Legal">Tutor Legal</option>
                        <option value="Abuelo/a">Abuelo/a</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teléfono Móvil</label>
                      <div className="flex">
                        <span className="inline-flex items-center h-11 px-4 whitespace-nowrap text-sm font-medium text-gray-600 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
                          +56 9
                        </span>
                        <input 
                          type="text" maxLength="8" placeholder="12345678" value={editForm.telefono} onChange={(e) => setEditForm({...editForm, telefono: e.target.value.replace(/\D/g, '')})}
                          className="w-full h-11 px-4 rounded-r-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Correo Electrónico</label>
                      <input 
                        type="email" value={editForm.email_apoderado} onChange={(e) => setEditForm({...editForm, email_apoderado: e.target.value})}
                        className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSavingEdit} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 flex justify-center items-center">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ELIMINAR (ALERTA CRÍTICA) --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] relative overflow-hidden">
            {isDeleting && <BackdropLoader mensaje="Eliminando..." />}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Eliminar Estudiante</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              ¿Seguro que desea retirar a <strong className="text-gray-900 dark:text-white">{selectedAlumno?.nombre}</strong> del sistema? Esta acción eliminará su matrícula actual para que no aparezca en las listas, pero <strong>preservará todo su historial</strong> académico y disciplinario de forma segura.
            </p>
            
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                No, cancelar
              </button>
              <button onClick={confirmarEliminacion} disabled={isDeleting} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}