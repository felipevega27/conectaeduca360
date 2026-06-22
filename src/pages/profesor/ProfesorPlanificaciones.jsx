import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfesorPlanificaciones() {
  const [user, setUser] = useState(null);
  const [asignaturas, setAsignaturas] = useState([]);
  const [cursoActual, setCursoActual] = useState(''); // ID de la asignatura seleccionada
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Datos reales
  const [planificaciones, setPlanificaciones] = useState([]);
  
  // Formulario Modal
  const [formPlan, setFormPlan] = useState({
    mes: 'Marzo',
    unidad: 'Unidad 1',
    oa: 'OA 01',
    descripcion: '',
    actividad: '',
    semanas: 'Semana 1 a 4'
  });

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAsignaturas(parsedUser.rut);
    }
  }, []);

  const cargarAsignaturas = async (rut) => {
    try {
      const { data } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso, cursos(nombre)')
        .eq('rut_profesor', rut);
      
      if (data && data.length > 0) {
        setAsignaturas(data);
        setCursoActual(data[0].id.toString());
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error al cargar asignaturas:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (cursoActual && user) {
      cargarPlanificaciones();
    }
  }, [cursoActual, user]);

  const cargarPlanificaciones = async () => {
    setIsLoading(true);
    try {
      const asignSelect = asignaturas.find(a => a.id.toString() === cursoActual);
      if(!asignSelect) return;

      const { data } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('id_asignatura', asignSelect.id)
        .order('id', { ascending: true });
        
      setPlanificaciones(data || []);
    } catch (error) {
      console.error('Error al cargar planificaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCrearPlanificacion = async (e) => {
    e.preventDefault();
    if (!formPlan.descripcion || !formPlan.actividad) {
      toast.error('Complete todos los campos');
      return;
    }

    const asignSelect = asignaturas.find(a => a.id.toString() === cursoActual);
    if (!asignSelect) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('planificaciones').insert([{
        rut_profesor: user.rut,
        id_curso: asignSelect.id_curso,
        id_asignatura: asignSelect.id,
        mes: formPlan.mes,
        semanas: formPlan.semanas,
        unidad: formPlan.unidad,
        oa: formPlan.oa,
        descripcion: formPlan.descripcion,
        actividad: formPlan.actividad,
        estado: 'Borrador'
      }]);

      if (error) throw error;
      toast.success('Planificación agregada correctamente.');
      setIsModalOpen(false);
      setFormPlan({ ...formPlan, descripcion: '', actividad: '' }); // Reset text fields
      cargarPlanificaciones();
    } catch (error) {
      console.error('Error al guardar planificación:', error);
      toast.error('Error al guardar la planificación.');
    } finally {
      setIsSaving(false);
    }
  };

  const enviarAUTP = async () => {
    const borrados = planificaciones.filter(p => p.estado === 'Borrador');
    if (borrados.length === 0) {
      toast('No hay planificaciones en borrador para enviar.', { icon: 'ℹ️' });
      return;
    }

    try {
      const idsBorradores = borrados.map(b => b.id);
      const { error } = await supabase
        .from('planificaciones')
        .update({ estado: 'En Revisión' })
        .in('id', idsBorradores);

      if (error) throw error;
      toast.success('¡Planificaciones enviadas a UTP con éxito!');
      cargarPlanificaciones();
    } catch (error) {
      console.error('Error al enviar a UTP:', error);
      toast.error('Error al enviar a UTP.');
    }
  };

  // Cálculos de KPI
  const oaTratados = new Set(planificaciones.map(p => p.oa)).size;
  const planificadasAprobadas = planificaciones.filter(p => p.estado === 'Aprobado UTP').length;
  // Simulación de cobertura en base a OAs (supongamos 10 OAs objetivo)
  const coberturaPorcentaje = Math.min(Math.round((oaTratados / 10) * 100), 100);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Planificación Curricular</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Estructure sus unidades basadas en el currículum Mineduc.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={cursoActual}
            onChange={(e) => setCursoActual(e.target.value)}
            className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none shadow-sm"
          >
            {asignaturas.length === 0 ? (
              <option value="">Cargando asignaturas...</option>
            ) : (
              asignaturas.map(asig => (
                <option key={asig.id} value={asig.id}>
                  {asig.cursos?.nombre} - {asig.nombre}
                </option>
              ))
            )}
          </select>

          <button 
            onClick={enviarAUTP}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Enviar a UTP
          </button>
        </div>
      </div>

      {/* KPI's Curriculares */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Cobertura Curricular (Anual)</p>
          <div className="flex items-end gap-3 mt-1">
            <h3 className="text-2xl font-black text-gray-800 dark:text-white">{coberturaPorcentaje}%</h3>
            <span className={`text-xs font-medium mb-1 ${coberturaPorcentaje >= 30 ? 'text-emerald-600' : 'text-orange-500'}`}>
              {coberturaPorcentaje >= 30 ? 'En el rango esperado' : 'Requiere acelerar ritmo'}
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-3"><div className={`h-full rounded-full ${coberturaPorcentaje >= 30 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{width: `${coberturaPorcentaje}%`}}></div></div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">O.A. Tratados (En la Asignatura)</p>
          <div className="flex items-end gap-3 mt-1">
            <h3 className="text-2xl font-black text-gray-800 dark:text-white">{oaTratados} O.A</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Aprobación UTP</p>
            <h3 className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">{planificadasAprobadas} aprobadas</h3>
          </div>
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </div>

      {/* TABLA DE PLANIFICACIONES */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">Cronograma Anual</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Agregar O.A.
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-bold min-w-30">Temporalidad</th>
                <th className="p-4 font-bold min-w-37.5">Unidad / O.A.</th>
                <th className="p-4 font-bold min-w-62.5">Actividad y Evaluación</th>
                <th className="p-4 font-bold text-center">Estado UTP</th>
                <th className="p-4 font-bold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
              {isLoading ? (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">Cargando planificaciones...</td></tr>
              ) : planificaciones.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No hay planificaciones registradas en esta asignatura.</td></tr>
              ) : (
                planificaciones.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="p-4 align-top">
                      <p className="font-bold text-gray-800 dark:text-gray-200">{plan.mes}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{plan.semanas}</p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{plan.unidad}</p>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs mr-2">{plan.oa}</span>
                        {plan.descripcion}
                      </p>
                    </td>
                    <td className="p-4 align-top text-gray-600 dark:text-gray-300">
                      {plan.actividad}
                    </td>
                    <td className="p-4 align-top text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        plan.estado === 'Aprobado UTP' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' :
                        plan.estado === 'En Revisión' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                      }`}>
                        {plan.estado}
                      </span>
                    </td>
                    <td className="p-4 align-top text-right">
                      <button className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Eliminar (No implementado en MVP)">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INGRESAR PLANIFICACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative z-70 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Nueva Planificación</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCrearPlanificacion} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Mes</label>
                  <select 
                    value={formPlan.mes} 
                    onChange={e => setFormPlan({...formPlan, mes: e.target.value})}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                  >
                    <option>Marzo</option>
                    <option>Abril</option>
                    <option>Mayo</option>
                    <option>Junio</option>
                    <option>Julio</option>
                    <option>Agosto</option>
                    <option>Septiembre</option>
                    <option>Octubre</option>
                    <option>Noviembre</option>
                    <option>Diciembre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Unidad</label>
                  <select 
                    value={formPlan.unidad}
                    onChange={e => setFormPlan({...formPlan, unidad: e.target.value})}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                  >
                    <option>Unidad 1</option>
                    <option>Unidad 2</option>
                    <option>Unidad 3</option>
                    <option>Unidad 4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Semanas (Rango)</label>
                  <input 
                    type="text" 
                    value={formPlan.semanas}
                    onChange={e => setFormPlan({...formPlan, semanas: e.target.value})}
                    placeholder="Ej: Semana 1 a 4"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Objetivo (O.A.)</label>
                  <select 
                    value={formPlan.oa}
                    onChange={e => setFormPlan({...formPlan, oa: e.target.value})}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                  >
                    <option>OA 01</option>
                    <option>OA 02</option>
                    <option>OA 03</option>
                    <option>OA 04</option>
                    <option>OA 05</option>
                    <option>OA 06</option>
                    <option>OA 07</option>
                    <option>OA 08</option>
                    <option>OA 09</option>
                    <option>OA 10</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Descripción Breve del O.A.</label>
                <input 
                  type="text"
                  value={formPlan.descripcion}
                  onChange={e => setFormPlan({...formPlan, descripcion: e.target.value})}
                  placeholder="Ej: Analizar textos de los medios de comunicación..." 
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Actividad y forma de Evaluación</label>
                <textarea 
                  rows="3" 
                  value={formPlan.actividad}
                  onChange={e => setFormPlan({...formPlan, actividad: e.target.value})}
                  placeholder="Describa brevemente cómo logrará y evaluará este objetivo en el aula..." 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors disabled:opacity-50">
                  {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}