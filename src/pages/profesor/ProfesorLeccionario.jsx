import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfesorLeccionario() {
  const [user, setUser] = useState(null);
  const [asignaturas, setAsignaturas] = useState([]);
  const [selectedAsignatura, setSelectedAsignatura] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [bloque, setBloque] = useState('');
  const [contenido, setContenido] = useState('');
  const [actividades, setActividades] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ultimosRegistros, setUltimosRegistros] = useState([]);
  const [isLoadingRegistros, setIsLoadingRegistros] = useState(true);
  const [isModalHistorialOpen, setIsModalHistorialOpen] = useState(false);
  const [historialCompleto, setHistorialCompleto] = useState([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);

  const bloquesOptions = [
    'Bloque 1 (08:00 - 09:30)',
    'Bloque 2 (09:45 - 11:15)',
    'Bloque 3 (11:30 - 13:00)',
    'Bloque 4 (14:00 - 15:30)',
  ];

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAsignaturas(parsedUser.rut);
      cargarUltimosRegistros(parsedUser.rut);
    }
  }, []);

  const cargarAsignaturas = async (rutProfesor) => {
    try {
      // 1. Fetch cursos
      const { data: cursos } = await supabase.from('cursos').select('id, nombre');
      
      // 2. Fetch asignaturas dictadas por el profesor
      const { data: asignaturasProfesor, error } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('rut_profesor', rutProfesor);

      if (error) throw error;

      if (asignaturasProfesor && asignaturasProfesor.length > 0) {
        const asigConCursos = asignaturasProfesor.map(a => {
            const c = cursos?.find(c => c.id === a.id_curso);
            return { ...a, curso_nombre: c ? c.nombre : 'Curso Desconocido' };
        });
        setAsignaturas(asigConCursos);
      } else {
        setAsignaturas([]);
      }
    } catch (error) {
      console.error("Error cargando asignaturas:", error);
      setAsignaturas([]);
    }
  };

  const cargarUltimosRegistros = async (rut) => {
    setIsLoadingRegistros(true);
    try {
      const { data, error } = await supabase
        .from('leccionarios')
        .select(`
          id,
          fecha,
          descripcion_actividad,
          firmado,
          horarios (
            hora_inicio,
            hora_fin,
            asignaturas (nombre),
            cursos (nombre)
          )
        `)
        .eq('rut_profesor', rut)
        .order('fecha', { ascending: false })
        .limit(5);

      if (error) throw error;
      setUltimosRegistros(data || []);
    } catch (err) {
      console.error('Error cargando ultimos registros:', err);
    } finally {
      setIsLoadingRegistros(false);
    }
  };

  const cargarHistorialCompleto = async (rut) => {
    setIsLoadingHistorial(true);
    try {
      const { data, error } = await supabase
        .from('leccionarios')
        .select(`
          id,
          fecha,
          descripcion_actividad,
          firmado,
          horarios (
            hora_inicio,
            hora_fin,
            asignaturas (nombre),
            cursos (nombre)
          )
        `)
        .eq('rut_profesor', rut)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setHistorialCompleto(data || []);
    } catch (err) {
      console.error('Error cargando historial completo:', err);
      toast.error('No se pudo cargar el historial completo.');
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  const abrirHistorial = () => {
    setIsModalHistorialOpen(true);
    if (user) {
      cargarHistorialCompleto(user.rut || user.id);
    }
  };

  const handleGuardarLeccionario = async (e) => {
    e.preventDefault();
    
    if (!selectedAsignatura || !fecha || !bloque || !contenido) {
      toast.error("Por favor completa los campos obligatorios.");
      return;
    }

    setIsLoading(true);

    try {
      // Determinar el día de la semana
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dateObj = new Date(fecha + "T12:00:00"); // T12 para evitar problemas de zona horaria
      const diaSemana = dias[dateObj.getDay()];

      // Determinar el código del bloque
      let bloqueCode = '';
      if (bloque.startsWith('Bloque 1')) bloqueCode = 'B1';
      else if (bloque.startsWith('Bloque 2')) bloqueCode = 'B2';
      else if (bloque.startsWith('Bloque 3')) bloqueCode = 'B3';
      else if (bloque.startsWith('Bloque 4')) bloqueCode = 'B4';

      // 1. Buscar el horario correspondiente
      const { data: horariosMatch, error: errHorario } = await supabase
        .from('horarios')
        .select('id')
        .eq('rut_profesor', user.rut || user.id)
        .eq('id_asignatura', selectedAsignatura)
        .eq('dia_semana', diaSemana)
        .eq('bloque', bloqueCode);

      if (errHorario) throw errHorario;

      if (!horariosMatch || horariosMatch.length === 0) {
        toast.error(`No tienes programada esta asignatura el día ${diaSemana} en el ${bloqueCode}. Verifica tu horario.`);
        setIsLoading(false);
        return;
      }

      // 2. Insertar en leccionarios
      // Si hay varios id_horario (ej. cursos fusionados), insertamos para todos
      const descCompleta = actividades ? `${contenido}\n\nObservaciones: ${actividades}` : contenido;
      
      const leccionariosToInsert = horariosMatch.map(h => ({
        id_horario: h.id,
        fecha: fecha,
        descripcion_actividad: descCompleta,
        firmado: true,
        rut_profesor: user.rut || user.id
      }));

      // Primero borramos si ya existía para ese horario y fecha (upsert manual)
      const horariosIds = horariosMatch.map(h => h.id);
      await supabase.from('leccionarios').delete().in('id_horario', horariosIds).eq('fecha', fecha);

      const { error: insertError } = await supabase
        .from('leccionarios')
        .insert(leccionariosToInsert);

      if (insertError) throw insertError;
      
      toast.success("Leccionario firmado y guardado con éxito.");
      setContenido('');
      setActividades('');
      setBloque('');
      
      // Refrescar registros recientes
      cargarUltimosRegistros(user.rut || user.id);
      
    } catch (error) {
      console.error("Error guardando leccionario:", error);
      toast.error("Hubo un error al guardar el registro.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 p-4 sm:p-8">
      <Toaster position="top-right" />
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
          <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-2 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
          </span>
          Firma de Leccionario
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">
          Registra los contenidos tratados en clases y firma digitalmente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORMULARIO */}
        <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <form onSubmit={handleGuardarLeccionario} className="space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* ASIGNATURA */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Asignatura y Curso <span className="text-red-500">*</span></label>
                            <select
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                value={selectedAsignatura}
                                onChange={(e) => setSelectedAsignatura(e.target.value)}
                                required
                            >
                                <option value="">Selecciona una asignatura...</option>
                                {asignaturas.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre} - {a.curso_nombre}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* FECHA */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Fecha <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                required
                            />
                        </div>

                        {/* BLOQUE */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bloque Horario <span className="text-red-500">*</span></label>
                            <select
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                value={bloque}
                                onChange={(e) => setBloque(e.target.value)}
                                required
                            >
                                <option value="">Selecciona un bloque...</option>
                                {bloquesOptions.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* CONTENIDO TRATADO */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Contenido Tratado <span className="text-red-500">*</span></label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Describe brevemente lo que enseñaste en la clase.</p>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none h-24"
                            placeholder="Ej: Unidad 1: Ecuaciones de primer grado. Resolución de problemas en la pizarra..."
                            value={contenido}
                            onChange={(e) => setContenido(e.target.value)}
                            required
                        ></textarea>
                    </div>

                    {/* ACTIVIDADES Y OBSERVACIONES */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Actividades u Observaciones (Opcional)</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none h-20"
                            placeholder="Ej: Se entregó guía de ejercicios. Juan y María no trabajaron en clases."
                            value={actividades}
                            onChange={(e) => setActividades(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Firmando...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    Firmar y Guardar Registro
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* REGISTROS RECIENTES */}
        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Últimos Registros
                </h3>
                
                <div className="space-y-4">
                    {isLoadingRegistros ? (
                        <div className="flex justify-center p-4">
                            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : ultimosRegistros.length > 0 ? (
                        ultimosRegistros.map(reg => {
                            const dateObj = new Date(reg.fecha + "T00:00:00");
                            const isToday = dateObj.toDateString() === new Date().toDateString();
                            const isYesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toDateString() === dateObj.toDateString();
                            
                            let fechaStr = "";
                            if (isToday) fechaStr = "Hoy";
                            else if (isYesterday) fechaStr = "Ayer";
                            else fechaStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

                            const horario = reg.horarios;
                            const asignaturaNombre = horario?.asignaturas?.nombre || 'Desconocido';
                            const cursoNombre = horario?.cursos?.nombre || 'Desconocido';
                            const horaFormat = horario?.hora_inicio ? horario.hora_inicio.substring(0, 5) : '';

                            return (
                                <div key={reg.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${reg.firmado ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{fechaStr}{horaFormat ? `, ${horaFormat}` : ''}</span>
                                        <span className={`${reg.firmado ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'} text-[10px] font-bold px-2 py-0.5 rounded`}>
                                            {reg.firmado ? 'Firmado' : 'Pendiente'}
                                        </span>
                                    </div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">{asignaturaNombre} - {cursoNombre}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2" title={reg.descripcion_actividad}>{reg.descripcion_actividad}</p>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay registros recientes.</p>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <button 
                        onClick={abrirHistorial}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium transition-colors"
                    >
                        Ver Historial Completo →
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* MODAL HISTORIAL COMPLETO */}
      {isModalHistorialOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Historial Completo de Leccionarios
              </h3>
              <button 
                onClick={() => setIsModalHistorialOpen(false)}
                className="text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 p-2 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {isLoadingHistorial ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-500 font-medium">Cargando historial...</p>
                </div>
              ) : historialCompleto.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Fecha y Hora</th>
                        <th className="px-4 py-3 font-semibold">Asignatura y Curso</th>
                        <th className="px-4 py-3 font-semibold">Contenido Tratado</th>
                        <th className="px-4 py-3 font-semibold text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {historialCompleto.map(reg => {
                        const dateObj = new Date(reg.fecha + "T00:00:00");
                        const fechaStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                        
                        const horario = reg.horarios;
                        const asignaturaNombre = horario?.asignaturas?.nombre || 'Desconocido';
                        const cursoNombre = horario?.cursos?.nombre || 'Desconocido';
                        const horaFormat = horario?.hora_inicio ? horario.hora_inicio.substring(0, 5) : '';

                        return (
                          <tr key={reg.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{fechaStr}</p>
                              {horaFormat && <p className="text-xs text-gray-500">{horaFormat}</p>}
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-800 dark:text-gray-200">{asignaturaNombre}</p>
                              <p className="text-xs text-gray-500">{cursoNombre}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap text-xs">{reg.descripcion_actividad}</p>
                            </td>
                            <td className="px-4 py-4 text-center whitespace-nowrap">
                              {reg.firmado ? (
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/30">
                                  Firmado
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs font-bold px-2.5 py-1 rounded-full">
                                  Pendiente
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No hay registros de leccionario.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end">
              <button 
                onClick={() => setIsModalHistorialOpen(false)}
                className="px-5 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
