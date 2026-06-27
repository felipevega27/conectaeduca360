import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

export default function ApoderadoDashboard() {
  const [pupilos, setPupilos] = useState([]);
  const [pupiloActivo, setPupiloActivo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalJustificar, setIsModalJustificar] = useState(false);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarPupilos(user.rut);
    }
  }, []);

  const cargarPupilos = async (rutApoderado) => {
    setIsLoading(true);
    try {
      // Obtener las relaciones familiares del apoderado
      const { data: relaciones } = await supabase
        .from('relacion_apoderados')
        .select('rut_alumno')
        .eq('rut_apoderado', rutApoderado);

      if (relaciones && relaciones.length > 0) {
        const rutsPupilos = relaciones.map(r => r.rut_alumno);
        
        // Obtener datos de los perfiles y cursos
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('rut, nombre, avatar_url')
          .in('rut', rutsPupilos);

        const { data: matriculas } = await supabase
          .from('matriculas')
          .select('rut_alumno, id_curso')
          .in('rut_alumno', rutsPupilos);
          
        let idsCursos = [];
        if (matriculas) idsCursos = matriculas.map(m => m.id_curso);

        const { data: cursos } = await supabase
          .from('cursos')
          .select('id, nombre, nivel')
          .in('id', idsCursos);

        // Fetch de KPIs (Asistencia y Notas)
        const pupilosCompletos = await Promise.all(perfiles.map(async (perfil) => {
          const matricula = matriculas?.find(m => m.rut_alumno === perfil.rut);
          const curso = cursos?.find(c => c.id === matricula?.id_curso);
          const nombreCurso = curso ? `${curso.nivel} ${curso.nombre}` : 'Sin curso asignado';
          
          // Calcular Asistencia Real
          const { data: asist } = await supabase
            .from('asistencia_alumnos')
            .select('estado')
            .eq('rut_alumno', perfil.rut);
            
          let porcentajeAsistencia = 100;
          if (asist && asist.length > 0) {
            const presentes = asist.filter(a => a.estado.toLowerCase() === 'presente').length;
            porcentajeAsistencia = Math.round((presentes / asist.length) * 100);
          }

          // Calcular Notas Reales
          const { data: notas } = await supabase
            .from('notas')
            .select('nota')
            .eq('rut_alumno', perfil.rut);
            
          let promedio = 0;
          if (notas && notas.length > 0) {
            const suma = notas.reduce((acc, curr) => acc + curr.nota, 0);
            promedio = parseFloat((suma / notas.length).toFixed(1));
          }

          return {
            rut: perfil.rut,
            nombre: perfil.nombre,
            iniciales: perfil.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            curso: nombreCurso,
            asistencia: porcentajeAsistencia,
            promedio: promedio > 0 ? promedio : 'Sin notas'
          };
        }));
        
        setPupilos(pupilosCompletos);
        localStorage.setItem('apoderadoPupilos', JSON.stringify(pupilosCompletos));
        if (pupilosCompletos.length > 0) {
          setPupiloActivo(pupilosCompletos[0]);
          localStorage.setItem('pupiloActivo', JSON.stringify(pupilosCompletos[0]));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCambiarPupilo = (e) => {
    const seleccionado = pupilos.find(p => p.rut === e.target.value);
    setPupiloActivo(seleccionado);
    localStorage.setItem('pupiloActivo', JSON.stringify(seleccionado));
    // Disparamos evento para que las otras vistas sepan que cambió
    window.dispatchEvent(new Event('pupiloChanged'));
  };

  // Bandeja de notificaciones y alertas simuladas por ahora
  const [notificaciones] = useState([
    { id: 1, tipo: 'anotacion', urgente: true, titulo: 'Anotación Negativa Registrada', descripcion: 'El alumno ha recibido una anotación en Convivencia Escolar.', fecha: 'Hace 1 hora', leido: false },
    { id: 2, tipo: 'reunion', urgente: true, titulo: 'Citación a Reunión de Apoderados', descripcion: 'Reunión general presencial el día Jueves 18 a las 19:00 hrs.', fecha: 'Hoy, 09:00 AM', leido: false },
    { id: 3, tipo: 'nota_alerta', urgente: false, titulo: 'Nuevas Calificaciones', descripcion: 'Se han ingresado nuevas notas al sistema.', fecha: 'Ayer', leido: true },
  ]);

  const notificacionesNoLeidas = notificaciones.filter(n => !n.leido).length;

  const handleJustificar = (e) => {
    e.preventDefault();
    alert('Certificado enviado a Inspectoría con éxito.');
    setIsModalJustificar(false);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando panel de apoderado...</div>;
  }

  if (!pupiloActivo) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm text-center">
          <p className="text-gray-500">No tienes pupilos asignados a tu cuenta. Contacta a Inspectoría.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* CABECERA Y SELECTOR DE PUPILO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Panel del Apoderado</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Supervisión académica y de convivencia de sus pupilos.</p>
        </div>
        
        {/* Selector de Pupilo */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 pl-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
            {pupiloActivo.iniciales}
          </div>
          <div className="flex flex-col flex-1 pr-2">
            {pupilos.length > 1 ? (
              <select 
                value={pupiloActivo.rut} 
                onChange={handleCambiarPupilo}
                className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 leading-none outline-none cursor-pointer appearance-none"
              >
                {pupilos.map(p => (
                  <option key={p.rut} value={p.rut} className="text-gray-800">{p.nombre}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none">{pupiloActivo.nombre}</span>
            )}
            <span className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">{pupiloActivo.curso}</span>
          </div>
          {pupilos.length > 1 && (
            <svg className="w-5 h-5 text-gray-400 pointer-events-none mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA PRINCIPAL: BANDEJA DE ALERTAS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              Bandeja de Notificaciones
              {notificacionesNoLeidas > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{notificacionesNoLeidas} nuevas</span>
              )}
            </h2>
            <button className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Marcar todo como leído</button>
          </div>

          <div className="space-y-3">
            {notificaciones.map(notif => (
              <div key={notif.id} className={`p-4 rounded-2xl border transition-all ${
                !notif.leido ? 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-900/50 shadow-md ring-1 ring-indigo-50 dark:ring-indigo-900/20' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-80'
              }`}>
                <div className="flex gap-4">
                  {/* Icono de la notificación */}
                  <div className={`mt-1 shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    notif.tipo === 'anotacion' ? 'bg-red-100 text-red-600' :
                    notif.tipo === 'reunion' ? 'bg-indigo-100 text-indigo-600' :
                    notif.tipo === 'nota_alerta' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {notif.tipo === 'anotacion' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
                    {notif.tipo === 'reunion' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                    {notif.tipo === 'nota_alerta' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
                    {(notif.tipo === 'tarea' || notif.tipo === 'asistencia') && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`text-sm font-bold ${!notif.leido ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{notif.titulo}</h3>
                      <span className="text-[10px] font-semibold text-gray-400">{notif.fecha}</span>
                    </div>
                    <p className={`text-sm mt-1 ${!notif.leido ? 'text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>{notif.descripcion}</p>
                    
                    {/* Botones de acción rápida en la notificación */}
                    {notif.tipo === 'reunion' && (
                      <div className="mt-3 flex gap-2">
                        <button className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">Confirmar Asistencia</button>
                        <button className="text-xs font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg">No podré asistir</button>
                      </div>
                    )}
                    {notif.tipo === 'asistencia' && (
                      <button onClick={() => setIsModalJustificar(true)} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">Justificar ahora</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: ESTADO ACTUAL Y ACCIONES */}
        <div className="space-y-6">
          
          {/* Tarjeta de Resumen del Pupilo */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Resumen Actual</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Promedio General</span>
                <span className={`text-lg font-black ${typeof pupiloActivo.promedio === 'number' && pupiloActivo.promedio < 4.0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {pupiloActivo.promedio}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Asistencia Acumulada</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{pupiloActivo.asistencia}%</span>
              </div>
            </div>
            
            <button className="w-full mt-5 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              Ver Ficha Completa
            </button>
          </div>

          {/* Botón Gigante para Justificar (Acción Rápida) */}
          <button 
            onClick={() => setIsModalJustificar(true)}
            className="w-full group bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl p-1 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all hover:-translate-y-1 text-left"
          >
            <div className="bg-white/10 p-5 rounded-xl h-full backdrop-blur-sm">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Subir Justificativo</h3>
              <p className="text-xs text-indigo-100 font-medium leading-relaxed">Envíe el certificado médico directamente a Inspectoría General.</p>
            </div>
          </button>
        </div>

      </div>

      {/* MODAL JUSTIFICACIÓN */}
      {isModalJustificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Justificar Inasistencia</h2>
            <form onSubmit={handleJustificar} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Día a justificar</label>
                <select className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option>Martes 21 de Abril (Inasistencia)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Certificado Médico</label>
                <input type="file" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setIsModalJustificar(false)} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Enviar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}