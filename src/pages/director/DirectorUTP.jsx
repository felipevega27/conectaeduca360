import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorUTP() {
    const navigate = useNavigate();
    const [planificaciones, setPlanificaciones] = useState([]);
    const [filtroActivo, setFiltroActivo] = useState('En Revisión'); // Pestañas reales
    const [isLoading, setIsLoading] = useState(true);

    // Cargar los datos desde la tabla real planificaciones
    const cargarPlanificaciones = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('planificaciones')
                .select(`
                    id,
                    mes,
                    semanas,
                    unidad,
                    oa,
                    descripcion,
                    actividad,
                    estado,
                    fecha_creacion,
                    asignaturas ( nombre ),
                    cursos ( nombre ),
                    perfiles ( nombre )
                `)
                .neq('estado', 'Borrador') // UTP NO debe ver los borradores de los profesores
                .order('fecha_creacion', { ascending: false }); // Las más recientes primero

            if (error) throw error;
            setPlanificaciones(data || []);
        } catch (error) {
            console.error("Error al cargar planificaciones:", error.message);
            toast.error("Hubo un problema al cargar los datos.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        cargarPlanificaciones();
    }, []);

    // Función para aprobar o rechazar (Actualiza Supabase a los estados oficiales)
    const actualizarEstado = async (id, nuevoEstado) => {
        try {
            const { error } = await supabase
                .from('planificaciones')
                .update({ estado: nuevoEstado })
                .eq('id', id);

            if (error) throw error;

            // Actualizamos la vista localmente
            setPlanificaciones(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
            toast.success(`Planificación ${nuevoEstado === 'Aprobado UTP' ? 'aprobada' : 'rechazada'} exitosamente.`);

        } catch (error) {
            toast.error("Error al actualizar el estado: " + error.message);
        }
    };

    // Filtrado de las pestañas
    const planificacionesFiltradas = planificaciones.filter(p => {
        if (filtroActivo === 'Todas') return true;
        return p.estado === filtroActivo;
    });

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
            <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

            {/* CABECERA */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión Académica UTP</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Revisión de cobertura y aprobación de planificaciones docentes.</p>
                </div>
            </div>

            {/* CONTENEDOR PRINCIPAL */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

                {/* PESTAÑAS (TABS) */}
                <div className="border-b border-gray-200 dark:border-gray-700 px-2 flex overflow-x-auto hide-scrollbar bg-gray-50/50 dark:bg-gray-800/50">
                    {['En Revisión', 'Aprobado UTP', 'Rechazada', 'Todas'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFiltroActivo(tab)}
                            className={`whitespace-nowrap px-5 py-4 text-sm font-semibold transition-colors border-b-2 ${filtroActivo === tab
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab === 'En Revisión' ? 'Pendientes de Revisión' : tab === 'Aprobado UTP' ? 'Aprobadas' : tab}

                            {/* Burbuja contadora roja para las pendientes */}
                            {tab === 'En Revisión' && (
                                <span className="ml-2 inline-flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                    {planificaciones.filter(p => p.estado === 'En Revisión').length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* TABLA DE PLANIFICACIONES */}
                <div className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="p-10 flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cargando...</span>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-white dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-5 font-semibold min-w-[200px]">Docente y Asignatura</th>
                                    <th className="p-5 font-semibold">Temporalidad</th>
                                    <th className="p-5 font-semibold min-w-[300px]">Unidad y O.A. Planificado</th>
                                    <th className="p-5 font-semibold text-center">Estado</th>
                                    <th className="p-5 font-semibold text-right">Acción UTP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {planificacionesFiltradas.length > 0 ? (
                                    planificacionesFiltradas.map((plan) => (
                                        <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">

                                            {/* COLUMNA 1: DOCENTE Y ASIGNATURA */}
                                            <td className="p-5 align-top">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                        {plan.perfiles?.nombre ? plan.perfiles.nombre.substring(0, 2).toUpperCase() : 'PD'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{plan.perfiles?.nombre || 'Docente'}</p>
                                                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-0.5">{plan.cursos?.nombre} • {plan.asignaturas?.nombre}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* COLUMNA 2: TEMPORALIDAD */}
                                            <td className="p-5 align-top">
                                                <p className="font-bold text-gray-800 dark:text-gray-200">{plan.mes}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{plan.semanas}</p>
                                            </td>

                                            {/* COLUMNA 3: O.A Y ACTIVIDAD */}
                                            <td className="p-5 align-top">
                                                <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wide">{plan.unidad}</p>
                                                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-tight mb-2">
                                                    <span className="bg-gray-100 dark:bg-gray-700 font-bold text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-[10px] mr-2 border border-gray-200 dark:border-gray-600">{plan.oa}</span>
                                                    {plan.descripcion}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">
                                                    <b>Actividad:</b> {plan.actividad}
                                                </p>
                                            </td>

                                            {/* COLUMNA 4: BADGE DE ESTADO */}
                                            <td className="p-5 align-top text-center">
                                                {plan.estado === 'Aprobado UTP' && <span className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 uppercase">Aprobada</span>}
                                                {plan.estado === 'En Revisión' && <span className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 uppercase">Pendiente</span>}
                                                {plan.estado === 'Rechazada' && <span className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50 uppercase">Rechazada</span>}
                                            </td>

                                            {/* COLUMNA 5: BOTONES DE ACCIÓN UTP */}
                                            <td className="p-5 align-top text-right">
                                                {plan.estado === 'En Revisión' ? (
                                                    <div className="flex justify-end gap-2">
                                                        {/* Botón Aprobar */}
                                                        <button
                                                            onClick={() => actualizarEstado(plan.id, 'Aprobado UTP')}
                                                            className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-lg transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                                                            title="Aprobar Planificación"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                        </button>
                                                        {/* Botón Rechazar */}
                                                        <button
                                                            onClick={() => actualizarEstado(plan.id, 'Rechazada')}
                                                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                                            title="Rechazar Planificación"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    // Opción de Deshacer
                                                    <button
                                                        onClick={() => actualizarEstado(plan.id, 'En Revisión')}
                                                        className="text-xs font-semibold text-gray-400 hover:text-blue-500 underline transition-colors mt-1"
                                                    >
                                                        Deshacer acción
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center">
                                            <div className="mx-auto w-16 h-16 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Sin registros</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">
                                                No hay planificaciones en la categoría <span className="font-semibold text-gray-700 dark:text-gray-300">"{filtroActivo}"</span> en este momento.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}