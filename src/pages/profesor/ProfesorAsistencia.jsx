import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';
import { SkeletonCard, SkeletonRow } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

export default function ProfesorAsistencia() {
    const navigate = useNavigate();
    const location = useLocation();

    // Usamos selectedClase en lugar de claseInfo para poder actualizarlo si elige desde esta vista
    const [selectedClase, setSelectedClase] = useState(location.state || null);

    const [alumnos, setAlumnos] = useState([]);
    const [leccionario, setLeccionario] = useState('');
    const [leccionarioId, setLeccionarioId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para Firma Digital
    const [isModalFirmaOpen, setIsModalFirmaOpen] = useState(false);
    const [claveInput, setClaveInput] = useState('');
    const [errorClave, setErrorClave] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [isFirmado, setIsFirmado] = useState(false);

    // Estados para cuando no viene clase seleccionada
    const [clasesHoy, setClasesHoy] = useState([]);
    const [isLoadingClases, setIsLoadingClases] = useState(false);

    // --- NUEVOS ESTADOS: FICHA DEL ALUMNO ---
    const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
    const [rutFichaSeleccionada, setRutFichaSeleccionada] = useState(null);

    // Obtener el día de la semana actual en español
    const getDiaHoy = () => {
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return dias[new Date().getDay()];
    };

    useEffect(() => {
        if (selectedClase) {
            cargarDatosClase();
        } else {
            cargarClasesDeHoy();
        }
    }, [selectedClase]);

    const cargarClasesDeHoy = async () => {
        setIsLoadingClases(true);
        try {
            const loggedUser = JSON.parse(localStorage.getItem('userLogged'));
            const rutProfesor = loggedUser.rut;
            const diaHoy = getDiaHoy();

            const { data: horariosHoy } = await supabase
                .from('horarios')
                .select('*, cursos(nombre), asignaturas(nombre)')
                .eq('rut_profesor', rutProfesor)
                .eq('dia_semana', diaHoy)
                .order('hora_inicio', { ascending: true });

            if (horariosHoy && horariosHoy.length > 0) {
                // Obtener los leccionarios de hoy para saber si están firmados
                const hoyISO = new Date().toISOString().split('T')[0];
                const horariosIds = horariosHoy.map(h => h.id);
                const { data: leccionarios } = await supabase
                    .from('leccionarios')
                    .select('id_horario, firmado')
                    .in('id_horario', horariosIds)
                    .eq('fecha', hoyISO);

                const leccionariosMap = {};
                leccionarios?.forEach(lec => {
                    leccionariosMap[lec.id_horario] = lec.firmado;
                });

                // Formatear para que coincida con la estructura esperada por selectedClase
                const clasesFormateadas = horariosHoy.map(h => ({
                    id: h.id,
                    id_curso: h.id_curso,
                    id_asignatura: h.id_asignatura,
                    bloque: h.bloque,
                    hora: `${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)}`,
                    curso: h.cursos?.nombre || 'Curso Desconocido',
                    asignatura: h.asignaturas?.nombre || 'Asignatura Desconocida',
                    sala: h.sala || 'Sala Asignada',
                    leccionarioFirmado: !!leccionariosMap[h.id]
                }));
                setClasesHoy(clasesFormateadas);
            }
        } catch (error) {
            console.error('Error cargando clases del día:', error);
        } finally {
            setIsLoadingClases(false);
        }
    };

    const cargarDatosClase = async () => {
        setIsLoading(true);
        try {
            // 1. Obtener Matrículas del curso
            const { data: matriculas } = await supabase
                .from('matriculas')
                .select('rut_alumno, condicion_estudiante')
                .eq('id_curso', selectedClase.id_curso);

            const ruts = matriculas?.map(m => m.rut_alumno) || [];
            const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', ruts);

            // 2. Obtener registro de Asistencia de HOY (si ya pasó lista)
            const hoyISO = new Date().toISOString().split('T')[0];
            const { data: asistenciaPrevia } = await supabase
                .from('asistencia_alumnos')
                .select('*')
                .eq('id_curso', selectedClase.id_curso)
                .eq('fecha', hoyISO);

            const asistenciaMap = {};
            asistenciaPrevia?.forEach(a => {
                asistenciaMap[a.rut_alumno] = a.estado;
            });

            // 3. Mapear alumnos para el estado
            if (matriculas && matriculas.length > 0) {
                const alumnosList = matriculas.map(m => {
                    const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
                    let estadoDefecto = 'P';
                    const pie = m.condicion_estudiante?.toUpperCase() === 'PIE';

                    return {
                        id: m.rut_alumno,
                        rut: m.rut_alumno,
                        nombre: perfil?.nombre || 'Sin Nombre',
                        pie: pie,
                        estado: asistenciaMap[m.rut_alumno] || estadoDefecto
                    };
                });

                alumnosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
                setAlumnos(alumnosList);
            } else {
                setAlumnos([]);
            }

            // 4. Obtener leccionario previo si existe
            const { data: leccionarioPrevio } = await supabase
                .from('leccionarios')
                .select('id, descripcion_actividad, firmado')
                .eq('id_horario', selectedClase.id)
                .eq('fecha', hoyISO)
                .maybeSingle();

            if (leccionarioPrevio) {
                setLeccionario(leccionarioPrevio.descripcion_actividad || '');
                setLeccionarioId(leccionarioPrevio.id);
                if (leccionarioPrevio.firmado) {
                    setIsFirmado(true);
                }
            } else {
                setIsFirmado(false);
            }

        } catch (error) {
            console.error("Error cargando clase:", error);
            toast.error("Error cargando el listado del curso.");
        } finally {
            setIsLoading(false);
        }
    };

    // Función para cambiar estado con un clic
    const toggleEstado = (id) => {
        setAlumnos(prev => prev.map(alumno => {
            if (alumno.id === id) {
                const ciclos = { 'P': 'A', 'A': 'T', 'T': 'P' };
                return { ...alumno, estado: alumno.estado === 'J' ? 'J' : ciclos[alumno.estado] };
            }
            return alumno;
        }));
    };

    // --- NUEVA FUNCIÓN: ABRIR FICHA DEL ALUMNO ---
    const handleAbrirFicha = (rut) => {
        setRutFichaSeleccionada(rut);
        setIsFichaDrawerOpen(true);
    };

    const abrirModalFirma = () => {
        if (!leccionario.trim()) {
            toast.error("El registro del leccionario no puede estar vacío.");
            return;
        }
        setIsModalFirmaOpen(true);
        setClaveInput('');
        setErrorClave('');
    };

    const validarFirmaYGuardar = async (e) => {
        if (e) e.preventDefault();
        if (!claveInput.trim()) {
            setErrorClave('Debe ingresar su clave para firmar.');
            return;
        }

        setIsSigning(true);
        setErrorClave('');
        try {
            const loggedUser = JSON.parse(localStorage.getItem('userLogged'));

            const { data: perfil, error: errPerfil } = await supabase
                .from('perfiles')
                .select('clave')
                .eq('rut', loggedUser.rut)
                .single();

            if (errPerfil || !perfil) throw new Error('Error buscando perfil');

            if (perfil.clave === claveInput) {
                setIsModalFirmaOpen(false);
                await handleGuardar();
            } else {
                setErrorClave('Clave incorrecta. Inténtelo nuevamente.');
            }
        } catch (error) {
            console.error('Error validando firma:', error);
            setErrorClave('Error al comunicarse con el servidor.');
        } finally {
            setIsSigning(false);
        }
    };

    const handleGuardar = async () => {
        setIsSaving(true);
        const toastId = toast.loading('Firmando y enviando datos...');

        try {
            const loggedUser = JSON.parse(localStorage.getItem('userLogged'));
            const rutProfesor = loggedUser.rut;
            const hoyISO = new Date().toISOString().split('T')[0];

            // 1. Guardar/Actualizar Asistencias
            const upsertAsistencias = alumnos.map(a => ({
                rut_alumno: a.rut,
                id_curso: selectedClase.id_curso,
                fecha: hoyISO,
                estado: a.estado === 'P' ? 'Presente' : (a.estado === 'A' ? 'Ausente' : 'Atraso'),
                rut_profesor_registro: rutProfesor
            }));

            await supabase.from('asistencia_alumnos').delete().eq('id_curso', selectedClase.id_curso).eq('fecha', hoyISO);
            const { error: errorAsis } = await supabase.from('asistencia_alumnos').insert(upsertAsistencias);
            if (errorAsis) throw errorAsis;

            // 2. Firmar Leccionario
            if (leccionarioId) {
                await supabase.from('leccionarios').update({
                    descripcion_actividad: leccionario,
                    firmado: true
                }).eq('id', leccionarioId);
            } else {
                await supabase.from('leccionarios').insert([{
                    id_horario: selectedClase.id,
                    fecha: hoyISO,
                    descripcion_actividad: leccionario,
                    firmado: true,
                    rut_profesor: rutProfesor
                }]);
            }

            toast.success('Clase firmada y asistencia registrada.', { id: toastId });
            setTimeout(() => navigate('/panel/profesor'), 1500);

        } catch (error) {
            console.error('Error guardando asistencia:', error);
            toast.error('Ocurrió un error al guardar los datos.', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedClase) {
        return (
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Libro de Clases: Pasar Asistencia</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Selecciona el bloque de clases actual para proceder a tomar asistencia.</p>
                </div>

                {isLoadingClases ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                ) : clasesHoy.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center max-w-md mx-auto mt-10">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No hay clases registradas hoy</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No tienes bloques asignados para el día {getDiaHoy()}.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {clasesHoy.map(clase => (
                            <div
                                key={clase.id}
                                onClick={() => setSelectedClase(clase)}
                                className={`bg-white dark:bg-gray-800 border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group ${clase.leccionarioFirmado
                                        ? 'border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-700'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`text-center px-3 py-1.5 rounded-lg font-bold text-xs border ${clase.leccionarioFirmado
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                            }`}>
                                            {clase.bloque}
                                        </div>
                                        <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">{clase.hora}</span>
                                    </div>
                                    {clase.leccionarioFirmado && (
                                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 p-1.5 rounded-full" title="Firmado">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                        </span>
                                    )}
                                </div>
                                <h4 className={`font-bold text-lg leading-tight mb-1 transition-colors ${clase.leccionarioFirmado ? 'text-gray-700 dark:text-gray-300' : 'text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                    }`}>{clase.asignatura}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{clase.curso} • {clase.sala}</p>

                                <div className="mt-5">
                                    <button className={`w-full font-bold text-xs rounded-lg transition-colors py-2 flex items-center justify-center gap-2 ${clase.leccionarioFirmado
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/40'
                                            : 'bg-gray-50 dark:bg-gray-700/50 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                                        }`}>
                                        {clase.leccionarioFirmado ? 'Ver Registro Cerrado' : 'Seleccionar y Pasar Lista'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Contadores para el resumen superior
    const presentes = alumnos.filter(a => a.estado === 'P').length;
    const atrasos = alumnos.filter(a => a.estado === 'T').length;
    const ausentes = alumnos.filter(a => a.estado === 'A').length;
    const totalPresentesEfectivos = presentes + atrasos;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando registro de asistencia...</p>
        </div>
      </div>
    );
  }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0 relative">
            <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
            {isSaving && <BackdropLoader mensaje="Firmando y enviando datos..." />}

            {/* CABECERA OPERATIVA */}
            <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <button onClick={() => {
                        if (location.state) navigate(-1);
                        else setSelectedClase(null);
                    }} className="flex w-fit items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Volver a Selección
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">{selectedClase.asignatura}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedClase.curso} • {selectedClase.bloque} ({selectedClase.hora})</p>
                </div>

                {/* RESUMEN RÁPIDO */}
                <div className="flex gap-2 flex-wrap">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm">
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Total Presentes</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalPresentesEfectivos}/{alumnos.length}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm">
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Atrasos</p>
                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{atrasos}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm">
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Ausentes</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{ausentes}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUMNA IZQUIERDA: LISTA DE ASISTENCIA */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                            <span className="text-base font-semibold text-gray-800 dark:text-white">Listado de Curso</span>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex gap-4 uppercase font-bold">
                                <span>P: Presente</span>
                                <span>A: Ausente</span>
                                <span>T: Atraso</span>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-125 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="space-y-1">
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                </div>
                            ) : alumnos.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">Este curso aún no tiene alumnos matriculados.</div>
                            ) : alumnos.map((alumno) => (
                                <div
                                    key={alumno.id}
                                    className={`flex items-center justify-between p-4 transition-colors ${alumno.estado === 'A' ? 'bg-red-50/30 dark:bg-red-900/10' :
                                            alumno.estado === 'T' ? 'bg-orange-50/30 dark:bg-orange-900/10' :
                                                'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                >

                                    {/* --- NUEVA LÓGICA: PERFIL CLICKEABLE --- */}
                                    <div
                                        onClick={() => handleAbrirFicha(alumno.rut)}
                                        className="flex items-center gap-3 cursor-pointer group/ficha"
                                        title="Ver Ficha del Alumno"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-xs group-hover/ficha:bg-blue-100 dark:group-hover/ficha:bg-blue-900/40 group-hover/ficha:text-blue-600 dark:group-hover/ficha:text-blue-400 transition-colors">
                                            {alumno.nombre.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover/ficha:text-blue-600 dark:group-hover/ficha:text-blue-400 transition-colors flex items-center">
                                                {alumno.nombre}
                                                {alumno.pie && <span className="ml-2 text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">PIE</span>}
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{alumno.rut}</p>
                                        </div>
                                    </div>

                                    {/* SELECTOR DE ESTADO RÁPIDO */}
                                    <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg ml-2 shrink-0">
                                        {['P', 'A', 'T'].map((e) => (
                                            <button
                                                key={e}
                                                disabled={alumno.estado === 'J' || isFirmado}
                                                onClick={() => {
                                                    setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, estado: e } : a))
                                                }}
                                                className={`w-8 h-8 rounded-md text-xs font-black transition-all ${alumno.estado === e
                                                        ? (e === 'P' ? 'bg-emerald-500 text-white shadow-md' : e === 'A' ? 'bg-red-500 text-white shadow-md' : 'bg-orange-500 text-white shadow-md')
                                                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                                                    } ${alumno.estado === 'J' || isFirmado ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                        {alumno.estado === 'J' && (
                                            <div className="px-3 flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Justificado</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA: LECCIONARIO Y FIRMA */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Registro de Leccionario
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 italic">Describa la actividad realizada hoy (Exigencia Mineduc para subvención).</p>

                        <textarea
                            value={leccionario}
                            disabled={isFirmado}
                            onChange={(e) => setLeccionario(e.target.value)}
                            rows="5"
                            placeholder="Ej: Análisis de textos argumentativos y debate grupal sobre la ética en medios..."
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm text-gray-800 dark:text-white dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        ></textarea>

                        <div className="mt-6 space-y-3">
                            {!isFirmado && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                                    <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300">Confirmo que los datos ingresados son verídicos.</span>
                                </div>
                            )}

                            <button
                                disabled={isSaving || isFirmado}
                                onClick={abrirModalFirma}
                                className={`w-full font-medium text-sm py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2
                  ${isFirmado
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 cursor-not-allowed border border-emerald-200 dark:border-emerald-800 shadow-none'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                                    }
                  ${isSaving ? 'opacity-70 cursor-wait' : ''}
                `}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : isFirmado ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                )}
                                {isFirmado ? 'Registro Completado y Cerrado' : 'Finalizar y Firmar'}
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl text-blue-700 dark:text-blue-400 text-[11px]">
                        <p className="font-bold uppercase mb-1">Tip de velocidad:</p>
                        <p>Por defecto todos están presentes. Solo cambia a quienes veas ausentes en la sala. Haz clic en el nombre de un alumno para ver su ficha completa.</p>
                    </div>
                </div>

            </div>

            {/* MODAL DE FIRMA ELECTRÓNICA */}
            {isModalFirmaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isSigning && setIsModalFirmaOpen(false)}></div>

                    <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 animate-fade-in-up border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                            </div>
                            <h2 className="text-xl font-black text-gray-800 dark:text-white">Firma Electrónica Simple</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Para cerrar el leccionario de forma legal, ingrese su clave de acceso personal.
                            </p>
                        </div>

                        <form onSubmit={validarFirmaYGuardar} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    placeholder="Ingrese su clave..."
                                    value={claveInput}
                                    onChange={(e) => setClaveInput(e.target.value)}
                                    className={`w-full text-center tracking-widest text-lg font-bold px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none transition-all ${errorClave ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                                    autoFocus
                                />
                                {errorClave && <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center font-bold">{errorClave}</p>}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={isSigning}
                                    onClick={() => setIsModalFirmaOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSigning}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                                >
                                    {isSigning ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : 'Firmar y Enviar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EL COMPONENTE MÁGICO DE LA FICHA DEL ALUMNO --- */}
            <FichaAlumnoDrawer
                isOpen={isFichaDrawerOpen}
                onClose={() => setIsFichaDrawerOpen(false)}
                rutAlumno={rutFichaSeleccionada}
            />

        </div>
    );
}