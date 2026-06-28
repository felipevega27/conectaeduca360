import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

export default function DirectorSAT() {
  const [alumnosRiesgo, setAlumnosRiesgo] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS PARA EL MODAL DE RETENCIÓN ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [formularioPlan, setFormularioPlan] = useState({ responsable: 'Psicología', accion_inicial: '' });
  const [isSaving, setIsSaving] = useState(false);

  const cargarSistemaAlertaTemprana = async () => {
    try {
      setIsLoading(true);

      const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').eq('rol', 'alumno');
      const { data: matriculas } = await supabase.from('matriculas').select('*');
      const { data: cursos } = await supabase.from('cursos').select('*');
      const { data: asistencia } = await supabase.from('asistencia_alumnos').select('*');
      const { data: notas } = await supabase.from('notas').select('*');
      const { data: convivencia } = await supabase.from('casos_convivencia').select('*').eq('estado_protocolo', 'Activo');
      
      // TRAEMOS LOS PLANES ACTIVOS para saber si un alumno ya está siendo intervenido
      const { data: planesActivos } = await supabase.from('planes_retencion').select('*').eq('estado', 'En Seguimiento');

      const listaRiesgo = [];

      perfiles?.forEach(alumno => {
        let factoresRiesgo = [];
        let nivelRiesgo = 0;

        // Análisis de Asistencia
        const asisAlumno = asistencia?.filter(a => a.rut_alumno === alumno.rut) || [];
        if (asisAlumno.length > 0) {
          const ausencias = asisAlumno.filter(a => a.estado === 'Ausente').length;
          const porcentajeAsistencia = Math.round(((asisAlumno.length - ausencias) / asisAlumno.length) * 100);
          if (porcentajeAsistencia < 85) {
            factoresRiesgo.push(`Asistencia Crítica (${porcentajeAsistencia}%)`);
            nivelRiesgo += 2;
          }
        }

        // Análisis de Notas
        const notasAlumno = notas?.filter(n => n.rut_alumno === alumno.rut) || [];
        if (notasAlumno.length > 0) {
          const rojas = notasAlumno.filter(n => Number(n.nota) < 4.0).length;
          if (rojas >= 2) {
            factoresRiesgo.push(`Riesgo Académico (${rojas} rojas)`);
            nivelRiesgo += 1;
          }
        }

        // Análisis de Convivencia
        const casosAlumno = convivencia?.filter(c => c.rut_alumno === alumno.rut) || [];
        if (casosAlumno.length > 0) {
          const casosGraves = casosAlumno.filter(c => c.gravedad === 'Rojo').length;
          if (casosGraves > 0) {
            factoresRiesgo.push('Protocolo Convivencia Activo');
            nivelRiesgo += 2;
          }
        }

        if (factoresRiesgo.length > 0) {
          const mat = matriculas?.find(m => m.rut_alumno === alumno.rut);
          const cur = cursos?.find(c => c.id === mat?.id_curso);
          
          // Verificamos si ya le crearon un plan antes
          const planExistente = planesActivos?.find(p => p.rut_alumno === alumno.rut);

          listaRiesgo.push({
            rut: alumno.rut,
            nombre: alumno.nombre,
            curso: cur ? cur.nombre : 'Sin Matricular',
            factores: factoresRiesgo,
            nivel: nivelRiesgo >= 3 ? 'Crítico' : 'Alerta',
            color: nivelRiesgo >= 3 ? 'red' : 'amber',
            planActivo: planExistente ? true : false // Indicador para la UI
          });
        }
      });

      listaRiesgo.sort((a, b) => (a.nivel === 'Crítico' ? -1 : 1));
      setAlumnosRiesgo(listaRiesgo);

    } catch (error) {
      console.error('Error calculando SAT:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarSistemaAlertaTemprana();
  }, []);

  // --- FUNCIÓN PARA ABRIR MODAL ---
  const abrirModalPlan = (alumno) => {
    setAlumnoSeleccionado(alumno);
    setFormularioPlan({ responsable: 'Psicología', accion_inicial: '' });
    setIsModalOpen(true);
  };

  // --- FUNCIÓN PARA GUARDAR EL PLAN EN SUPABASE ---
  const handleGuardarPlan = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      
      const { error } = await supabase.from('planes_retencion').insert([{
        rut_alumno: alumnoSeleccionado.rut,
        responsable: formularioPlan.responsable,
        accion_inicial: formularioPlan.accion_inicial,
        estado: 'En Seguimiento'
      }]);

      if (error) throw error;

      // Pausa para consistencia visual
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(`Plan de retención iniciado con éxito para ${alumnoSeleccionado.nombre}`);
      setIsModalOpen(false);
      cargarSistemaAlertaTemprana(); // Recarga la tabla para mostrar que ya tiene plan activo

    } catch (error) {
      console.error("Error al guardar plan:", error.message);
      toast.error("Hubo un problema al guardar el plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const alumnosFiltrados = alumnosRiesgo.filter(al => 
    al.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    al.curso.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando sistema de alertas tempranas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0 relative">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Sistema de Alerta Temprana (S.A.T.)</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detección automática de estudiantes con riesgo de deserción escolar.</p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Exportar Nómina S.A.T.
        </button>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Estudiantes Detectados</h2>
          
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Buscar alumno o curso..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full sm:w-64 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent pl-9 pr-3 text-sm text-gray-600 dark:text-gray-300 focus:border-red-500 focus:outline-none" 
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-medium">Alumno / Curso</th>
                <th className="p-4 font-medium">Nivel de Riesgo</th>
                <th className="p-4 font-medium">Factores Detectados (Motor SAT)</th>
                <th className="p-4 font-medium text-right">Acción de Retención</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="p-0">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      <tr><td colSpan="12"><SkeletonRow /></td></tr>
                      <tr><td colSpan="12"><SkeletonRow /></td></tr>
                      <tr><td colSpan="12"><SkeletonRow /></td></tr>
                      <tr><td colSpan="12"><SkeletonRow /></td></tr>
                    </div>
                  </td>
                </tr>
              ) : alumnosFiltrados.length > 0 ? (
                alumnosFiltrados.map((alumno, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{alumno.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{alumno.curso}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                        alumno.color === 'red' 
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' 
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                      }`}>
                        {alumno.nivel}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {alumno.factores.map((factor, fIdx) => (
                          <span key={fIdx} className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-medium">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                            {factor}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {alumno.planActivo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          Plan en curso
                        </span>
                      ) : (
                        <button 
                          onClick={() => abrirModalPlan(alumno)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                        >
                          Iniciar Plan de Retención
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-10 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    No hay estudiantes detectados por el Sistema de Alerta Temprana en este momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL PARA INICIAR PLAN DE RETENCIÓN --- */}
      {isModalOpen && alumnoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden relative">
            {isSaving && <BackdropLoader mensaje="Guardando plan..." />}
            
            <div className="bg-blue-50 dark:bg-blue-900/30 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-blue-900 dark:text-blue-300">Activar Plan de Retención</h2>
                  <p className="text-sm text-blue-700/80 dark:text-blue-400/80 mt-1">
                    Estudiante: <strong className="font-semibold">{alumnoSeleccionado.nombre}</strong> ({alumnoSeleccionado.curso})
                  </p>
                </div>
                <div className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                  Riesgo {alumnoSeleccionado.nivel}
                </div>
              </div>
            </div>

            <form onSubmit={handleGuardarPlan} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Profesional Responsable del Caso
                </label>
                <select 
                  required
                  value={formularioPlan.responsable}
                  onChange={(e) => setFormularioPlan({...formularioPlan, responsable: e.target.value})}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 text-sm dark:text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Psicología">Área de Psicología / Convivencia</option>
                  <option value="Unidad Técnica (UTP)">Unidad Técnica Pedagógica (UTP)</option>
                  <option value="Profesor Jefe">Profesor Jefe</option>
                  <option value="Trabajo Social">Trabajador(a) Social</option>
                  <option value="Dirección">Dirección General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Acción Inmediata a realizar
                </label>
                <textarea 
                  required
                  rows="3"
                  value={formularioPlan.accion_inicial}
                  onChange={(e) => setFormularioPlan({...formularioPlan, accion_inicial: e.target.value})}
                  placeholder="Ej: Citación urgente a apoderados para firmar compromiso de asistencia..." 
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm dark:text-white focus:border-blue-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 flex justify-center items-center"
                >
                  Guardar y Activar Plan
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}