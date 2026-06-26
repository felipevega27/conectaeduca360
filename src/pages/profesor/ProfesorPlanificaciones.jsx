import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfesorPlanificaciones() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [asignaturas, setAsignaturas] = useState([]);
  const [cursoActual, setCursoActual] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);

  const [planificaciones, setPlanificaciones] = useState([]);

  const [formPlan, setFormPlan] = useState({
    mes: 'Marzo',
    unidad: 'Unidad 1',
    oa: 'OA 01',
    descripcion: '',
    actividad: '',
    semanaInicio: 1,
    semanaFin: 4
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
        const unicas = data.filter((v, i, a) => a.findIndex(v2 => (v2.id_curso === v.id_curso && v2.nombre === v.nombre)) === i);
        setAsignaturas(unicas);
        setCursoActual(unicas[0].id.toString());
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
      if (!asignSelect) return;

      const { data } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('id_asignatura', asignSelect.id)
        .order('fecha_creacion', { ascending: true });

      setPlanificaciones(data || []);
    } catch (error) {
      console.error('Error al cargar planificaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sugerirActividadConIA = async () => {
    const asignSelect = asignaturas.find(a => a.id.toString() === cursoActual);
    if (!asignSelect) { toast.error('Seleccione un curso primero.'); return; }
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) { toast.error('Falta la API Key de Groq.'); return; }

    setIsGeneratingIA(true);
    const toastId = toast.loading('Consultando Bases Curriculares...');

    try {
      const prompt = `Soy profesor en Chile de la asignatura "${asignSelect.nombre}" para el curso "${asignSelect.cursos?.nombre}". 
      Estoy planificando la ${formPlan.unidad} para el mes de ${formPlan.mes}. El objetivo a trabajar es el ${formPlan.oa}.
      Devuélveme SOLO un objeto JSON con:
      1. "descripcion": Descripción técnica del OA (máx 150 char).
      2. "actividad": Sugerencia de actividad formativa (máx 250 char).
      Formato estricto: {"descripcion": "...", "actividad": "..."}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      const jsonString = content.slice(jsonStart, jsonEnd);
      const resultado = JSON.parse(jsonString);

      setFormPlan(prev => ({ ...prev, descripcion: resultado.descripcion, actividad: resultado.actividad }));
      toast.success('¡Sugerencia generada con éxito!', { id: toastId });
    } catch (error) {
      toast.error('No se pudo generar la sugerencia.', { id: toastId });
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleCrearPlanificacion = async (e) => {
    e.preventDefault();
    if (!formPlan.descripcion || !formPlan.actividad) { toast.error('Complete todos los campos'); return; }

    if (parseInt(formPlan.semanaInicio) > parseInt(formPlan.semanaFin)) {
      toast.error('La semana de inicio no puede ser mayor a la de fin.');
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
        semanas: `Semana ${formPlan.semanaInicio} a ${formPlan.semanaFin}`,
        unidad: formPlan.unidad,
        oa: formPlan.oa,
        descripcion: formPlan.descripcion,
        actividad: formPlan.actividad,
        estado: 'Borrador'
      }]);

      if (error) throw error;
      toast.success('Planificación agregada correctamente.');
      setIsModalOpen(false);
      setFormPlan({ ...formPlan, descripcion: '', actividad: '' });
      cargarPlanificaciones();
    } catch (error) {
      toast.error('Error al guardar la planificación.');
    } finally {
      setIsSaving(false);
    }
  };

  const enviarAUTP = async () => {
    const borrados = planificaciones.filter(p => p.estado === 'Borrador');
    if (borrados.length === 0) { toast('No hay planificaciones en borrador para enviar.', { icon: 'ℹ️' }); return; }

    try {
      const idsBorradores = borrados.map(b => b.id);
      const { error } = await supabase.from('planificaciones').update({ estado: 'En Revisión' }).in('id', idsBorradores);
      if (error) throw error;
      toast.success('¡Planificaciones enviadas a UTP con éxito!');
      cargarPlanificaciones();
    } catch (error) {
      toast.error('Error al enviar a UTP.');
    }
  };

  // --- SOLUCIÓN: ENRUTAMIENTO INTELIGENTE ---
  const irADiseñador = (oa, modoDestino) => {
    // Le enviamos a la ruta el OA que eligió, el curso, y el "MODO" (Tarea vs Evaluación)
    navigate('/panel/profesor/tareas/nueva', {
      state: {
        oaPredefinido: oa,
        asignaturaPredefinida: cursoActual,
        modoPredefinido: modoDestino // 'tarea' o 'evaluacion'
      }
    });
  };

  const oaTratados = new Set(planificaciones.map(p => p.oa)).size;
  const planificadasAprobadas = planificaciones.filter(p => p.estado === 'Aprobado UTP').length;
  const coberturaPorcentaje = Math.min(Math.round((oaTratados / 10) * 100), 100);

  const generarTrackerSemanas = (rangoString) => {
    const numeros = rangoString.match(/\d+/g);
    if (!numeros || numeros.length !== 2) return null;
    const inicio = parseInt(numeros[0]);
    const fin = parseInt(numeros[1]);
    const duracion = fin - inicio + 1;
    return Array.from({ length: Math.min(duracion, 5) }).map((_, i) => (
      <div key={i} className="w-2.5 h-4 bg-emerald-400 dark:bg-emerald-500 rounded-sm shadow-sm"></div>
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" />

      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Planificación Curricular</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Estructure sus unidades y conecte sus objetivos con evaluaciones y materiales.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={cursoActual}
            onChange={(e) => setCursoActual(e.target.value)}
            className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none shadow-sm"
          >
            {asignaturas.length === 0 ? <option value="">Cargando...</option> : asignaturas.map(asig => <option key={asig.id} value={asig.id}>{asig.cursos?.nombre} - {asig.nombre}</option>)}
          </select>

          <button onClick={enviarAUTP} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Enviar a UTP
          </button>
        </div>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Cobertura Curricular</p>
          <div className="flex items-end gap-3 mt-1">
            <h3 className="text-2xl font-black text-gray-800 dark:text-white">{coberturaPorcentaje}%</h3>
            <span className={`text-xs font-medium mb-1 ${coberturaPorcentaje >= 30 ? 'text-emerald-600' : 'text-orange-500'}`}>{coberturaPorcentaje >= 30 ? 'En rango esperado' : 'Requiere acelerar'}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-3"><div className={`h-full rounded-full ${coberturaPorcentaje >= 30 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${coberturaPorcentaje}%` }}></div></div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">O.A. Tratados</p>
          <h3 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{oaTratados} O.A</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Aprobación UTP</p>
            <h3 className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">{planificadasAprobadas} aprobadas</h3>
          </div>
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </div>

      {/* ZONA DE PLANIFICACIONES */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Cronograma Anual de Aula
        </h2>
        <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-sm font-bold rounded-lg border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Planificar Nuevo O.A.
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : planificaciones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center text-gray-500">
          No hay planificaciones registradas en esta asignatura.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {planificaciones.map((plan) => (
            <div key={plan.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 flex flex-col group relative overflow-hidden">

              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${plan.estado === 'Aprobado UTP' ? 'bg-emerald-500' : plan.estado === 'En Revisión' ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>

              <div className="flex flex-wrap items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-4 mb-4 gap-4 pl-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 font-bold text-xs uppercase rounded-md tracking-wide">
                    {plan.unidad}
                  </span>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 text-sm font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Mes de {plan.mes}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${plan.estado === 'Aprobado UTP' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                    plan.estado === 'En Revisión' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                      'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                  ESTADO: {plan.estado}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pl-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-black text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                      {plan.oa}
                    </span>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Objetivo Curricular</h3>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed font-medium">
                    {plan.descripcion}
                  </p>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase flex items-center gap-1.5 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Estrategia y Actividad
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {plan.actividad}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4 pl-3">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cronograma de Ejecución:</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/50">
                      {plan.semanas}
                    </span>
                    <div className="flex gap-1 ml-1">
                      {generarTrackerSemanas(plan.semanas)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">

                  {/* SE CREARON DOS INTENCIONES DE RUTEO DISTINTAS */}
                  <button onClick={() => irADiseñador(plan.oa, 'tarea')} className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 shadow-sm">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    Subir Material (Plataforma)
                  </button>

                  <button onClick={() => irADiseñador(plan.oa, 'evaluacion')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/20 flex justify-center items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Conectar Evaluación (Libro)
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL INGRESAR PLANIFICACIÓN CON IA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

          <div className="relative z-50 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Configurar Unidad Curricular
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 p-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCrearPlanificacion} className="p-6 space-y-5">

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Mes a ejecutar</label>
                  <select value={formPlan.mes} onChange={e => setFormPlan({ ...formPlan, mes: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-white transition-all">
                    {['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Unidad Temática</label>
                  <select value={formPlan.unidad} onChange={e => setFormPlan({ ...formPlan, unidad: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-white transition-all">
                    <option value="Unidad 1">Unidad 1</option><option value="Unidad 2">Unidad 2</option><option value="Unidad 3">Unidad 3</option><option value="Unidad 4">Unidad 4</option><option value="Unidad 0 (Nivelación)">Unidad 0 (Nivelación)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Rango de Semanas</label>
                  <div className="flex items-center gap-2">
                    <select value={formPlan.semanaInicio} onChange={e => setFormPlan({ ...formPlan, semanaInicio: e.target.value })} className="w-full h-11 px-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-white">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>Semana {n}</option>)}
                    </select>
                    <span className="text-sm font-bold text-gray-400">a</span>
                    <select value={formPlan.semanaFin} onChange={e => setFormPlan({ ...formPlan, semanaFin: e.target.value })} className="w-full h-11 px-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-white">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>Semana {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Objetivo de Apdz. (O.A.)</label>
                  <select value={formPlan.oa} onChange={e => setFormPlan({ ...formPlan, oa: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-white transition-all">
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => <option key={`OA ${num.toString().padStart(2, '0')}`} value={`OA ${num.toString().padStart(2, '0')}`}>{`OA ${num.toString().padStart(2, '0')}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wide">Desglose del Objetivo</label>
                  <button type="button" onClick={sugerirActividadConIA} disabled={isGeneratingIA} className="text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
                    {isGeneratingIA ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '✨ Redactar con IA'}
                  </button>
                </div>
                <div>
                  <input type="text" required value={formPlan.descripcion} onChange={e => setFormPlan({ ...formPlan, descripcion: e.target.value })} placeholder="Descripción técnica del O.A. según currículum..." className="w-full h-10 px-3 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-800 dark:text-white transition-all" />
                </div>
                <div>
                  <textarea rows="3" required value={formPlan.actividad} onChange={e => setFormPlan({ ...formPlan, actividad: e.target.value })} placeholder="Describe la estrategia pedagógica o formato de evaluación..." className="w-full p-3 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-800 dark:text-white resize-none transition-all"></textarea>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                  {isSaving ? 'Guardando...' : 'Guardar en Portafolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}