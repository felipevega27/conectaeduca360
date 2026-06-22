import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorUTP() {
    const navigate = useNavigate();
    const [planificaciones, setPlanificaciones] = useState([]);
    const [filtroActivo, setFiltroActivo] = useState('Pendiente de Revisión'); // Pestañas: Pendientes, Aprobadas, Rechazadas, Todas
    const [isLoading, setIsLoading] = useState(true);

    // Cargar los datos desde tu tabla planificaciones
    const cargarPlanificaciones = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('planificaciones')
                .select(`
          id,
          unidad_numero,
          nombre_unidad,
          estado_entrega,
          cobertura_porcentaje,
          fecha_limite,
          asignaturas ( nombre )
        `)
                .order('fecha_limite', { ascending: true }); // Ordena por las que vencen primero

            if (error) throw error;
            setPlanificaciones(data || []);
        } catch (error) {
            console.error("Error al cargar planificaciones:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        cargarPlanificaciones();
    }, []);

    // Función para aprobar o rechazar (Actualiza Supabase)
    const actualizarEstado = async (id, nuevoEstado) => {
        try {
            const { error } = await supabase
                .from('planificaciones')
                .update({ estado_entrega: nuevoEstado })
                .eq('id', id);

            if (error) throw error;

            // Actualizamos la vista sin recargar la página entera
            setPlanificaciones(prev => prev.map(p => p.id === id ? { ...p, estado_entrega: nuevoEstado } : p));
            toast.success(`Planificación ${nuevoEstado.toLowerCase()} exitosamente.`);

        } catch (error) {
            toast.error("Error al actualizar el estado: " + error.message);
        }
    };

    // Filtrado de las pestañas
    const planificacionesFiltradas = planificaciones.filter(p => {
        if (filtroActivo === 'Todas') return true;
        return p.estado_entrega === filtroActivo;
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
                    {['Pendiente de Revisión', 'Aprobada', 'Rechazada', 'Todas'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFiltroActivo(tab)}
                            className={`whitespace-nowrap px-5 py-4 text-sm font-semibold transition-colors border-b-2 ${filtroActivo === tab
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab === 'Pendiente de Revisión' ? 'Pendientes' : tab}

                            {/* Burbuja contadora roja para las pendientes */}
                            {tab === 'Pendiente de Revisión' && (
                                <span className="ml-2 inline-flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                    {planificaciones.filter(p => p.estado_entrega === 'Pendiente de Revisión').length}
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
                                    <th className="p-5 font-semibold">Unidad & Asignatura</th>
                                    <th className="p-5 font-semibold text-center">Fecha Límite</th>
                                    <th className="p-5 font-semibold text-center">Cobertura</th>
                                    <th className="p-5 font-semibold text-center">Estado</th>
                                    <th className="p-5 font-semibold text-right">Acción UTP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {planificacionesFiltradas.length > 0 ? (
                                    planificacionesFiltradas.map((plan) => {
                                        const fechaLimiteObj = new Date(plan.fecha_limite);
                                        const hoy = new Date();
                                        const estaAtrasada = fechaLimiteObj < hoy && plan.estado_entrega !== 'Aprobada';

                                        return (
                                            <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">

                                                {/* COLUMNA 1: INFO DE LA UNIDAD */}
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                                            U{plan.unidad_numero}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{plan.nombre_unidad}</p>
                                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{plan.asignaturas?.nombre || 'Asignatura Desconocida'}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* COLUMNA 2: FECHA */}
                                                <td className="p-5 text-center">
                                                    <span className={`font-semibold px-2.5 py-1 rounded-md text-xs ${estaAtrasada
                                                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                            : 'text-gray-600 dark:text-gray-300'
                                                        }`}>
                                                        {fechaLimiteObj.toLocaleDateString('es-CL')}
                                                        {estaAtrasada && ' (Atrasada)'}
                                                    </span>
                                                </td>

                                                {/* COLUMNA 3: BARRA DE COBERTURA */}
                                                <td className="p-5 text-center">
                                                    <div className="flex flex-col items-center w-full max-w-[120px] mx-auto">
                                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-1">{plan.cobertura_porcentaje}% Completado</span>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${plan.cobertura_porcentaje}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* COLUMNA 4: BADGE DE ESTADO */}
                                                <td className="p-5 text-center">
                                                    {plan.estado_entrega === 'Aprobada' && <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">APROBADA</span>}
                                                    {plan.estado_entrega === 'Pendiente de Revisión' && <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">PENDIENTE</span>}
                                                    {plan.estado_entrega === 'Rechazada' && <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50">RECHAZADA</span>}
                                                </td>

                                                {/* COLUMNA 5: BOTONES DE ACCIÓN UTP */}
                                                <td className="p-5 text-right">
                                                    {plan.estado_entrega === 'Pendiente de Revisión' ? (
                                                        <div className="flex justify-end gap-2">
                                                            {/* Botón Aprobar */}
                                                            <button
                                                                onClick={() => actualizarEstado(plan.id, 'Aprobada')}
                                                                className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-lg transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                                                                title="Aprobar Planificación"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                            </button>
                                                            {/* Botón Rechazar */}
                                                            <button
                                                                onClick={() => actualizarEstado(plan.id, 'Rechazada')}
                                                                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                                                title="Rechazar"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        // Si ya fue aprobada o rechazada, dar opción de Deshacer
                                                        <button
                                                            onClick={() => actualizarEstado(plan.id, 'Pendiente de Revisión')}
                                                            className="text-xs font-semibold text-gray-400 hover:text-blue-500 underline transition-colors"
                                                        >
                                                            Deshacer acción
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
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