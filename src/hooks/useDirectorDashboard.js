import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

export default function useDirectorDashboard() {
  const [totalAlumnos, setTotalAlumnos] = useState(0);
  const [porcentajes, setPorcentajes] = useState({ regular: 0, sep: 0, pie: 0 });
  const [asistenciaGlobal, setAsistenciaGlobal] = useState(0);
  const [alumnosRiesgo, setAlumnosRiesgo] = useState(0);
  const [metricasUTP, setMetricasUTP] = useState({ coberturaPromedio: 0, alDia: 0, atrasados: 0, pendientes: 0, porcentajeAlDia: 0 });
  const [metricasPIE, setMetricasPIE] = useState({ porcentaje: 0, pendientes: 0 });
  const [protocolosActivos, setProtocolosActivos] = useState(0);
  const [alertas, setAlertas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const cargarDatos = async () => {
    try {
      setIsLoading(true);

      // INTENTO 1: Usar RPC optimizado (Fase 3)
      const { data: kpis, error: kpiError } = await supabase.rpc('obtener_kpis_director');

      if (!kpiError && kpis) {
        setTotalAlumnos(kpis.matriculas.total);
        setPorcentajes({
          regular: kpis.matriculas.porcentaje_regular,
          sep: kpis.matriculas.porcentaje_sep,
          pie: kpis.matriculas.porcentaje_pie
        });
        setAsistenciaGlobal(kpis.asistencia.global_porcentaje);
        setAlumnosRiesgo(kpis.asistencia.alumnos_riesgo);
        setMetricasUTP({
          coberturaPromedio: kpis.utp.cobertura_promedio,
          alDia: kpis.utp.al_dia,
          atrasados: kpis.utp.atrasados,
          pendientes: kpis.utp.pendientes,
          porcentajeAlDia: (kpis.utp.al_dia + kpis.utp.atrasados) > 0 
            ? Math.round((kpis.utp.al_dia / (kpis.utp.al_dia + kpis.utp.atrasados)) * 100) 
            : 100
        });
        setMetricasPIE({
          porcentaje: kpis.pie.porcentaje_al_dia,
          pendientes: kpis.pie.pendientes_fudei
        });
        setProtocolosActivos(kpis.convivencia.protocolos_activos);
      } else {
        // FALLBACK: Si falla el RPC (ej. no se corrió el script SQL), hacemos la carga manual tradicional
        console.warn("RPC no encontrado o falló. Usando modo compatibilidad (Carga Manual)...", kpiError);
        setIsUsingFallback(true);

        const { data: listaMatriculas } = await supabase.from('matriculas').select('rut_alumno, condicion_estudiante, cursos(nombre)');
        if (listaMatriculas && listaMatriculas.length > 0) {
          const total = listaMatriculas.length;
          setTotalAlumnos(total);
          let conteoRegular = 0, conteoSEP = 0, conteoPIE = 0;
          listaMatriculas.forEach(alumno => {
            const condicion = alumno.condicion_estudiante?.toUpperCase().trim();
            if (condicion === 'REGULAR') conteoRegular++;
            else if (condicion === 'SEP' || condicion === 'PRIORITARIO') conteoSEP++;
            else if (condicion === 'PIE') conteoPIE++;
          });
          setPorcentajes({
            regular: Math.round((conteoRegular / total) * 100) || 0,
            sep: Math.round((conteoSEP / total) * 100) || 0,
            pie: Math.round((conteoPIE / total) * 100) || 0
          });
        }

        const { data: listaAsistencia } = await supabase.from('asistencia_alumnos').select('*');
        if (listaAsistencia && listaAsistencia.length > 0) {
          const totalRegistros = listaAsistencia.length;
          const presentesYAtrasos = listaAsistencia.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
          setAsistenciaGlobal(Math.round((presentesYAtrasos / totalRegistros) * 100));
          const ausencias = listaAsistencia.filter(a => a.estado === 'Ausente');
          const alumnosUnicosConAusencia = new Set(ausencias.map(a => a.rut_alumno));
          setAlumnosRiesgo(alumnosUnicosConAusencia.size);
        }

        const { data: planificaciones } = await supabase.from('planificaciones').select('*');
        if (planificaciones && planificaciones.length > 0) {
          const hoy = new Date();
          const sumaCobertura = planificaciones.reduce((acc, plan) => acc + (plan.cobertura_porcentaje || 0), 0);
          const coberturaPromedio = Math.round(sumaCobertura / planificaciones.length);
          const pendientes = planificaciones.filter(p => p.estado_entrega === 'Pendiente de Revisión').length;

          let atrasados = 0, alDia = 0;
          planificaciones.forEach(plan => {
            const fechaLimite = new Date(plan.fecha_limite);
            if (fechaLimite < hoy && plan.estado_entrega !== 'Aprobada') atrasados++;
            else alDia++;
          });

          const totalParaEntrega = alDia + atrasados;
          const porcentajeAlDia = totalParaEntrega > 0 ? Math.round((alDia / totalParaEntrega) * 100) : 100;
          setMetricasUTP({ coberturaPromedio, pendientes, alDia, atrasados, porcentajeAlDia });
        }

        const { data: horasPIE } = await supabase.from('pie_horas_curso').select('horas_requeridas, horas_asignadas');
        if (horasPIE && horasPIE.length > 0) {
          let reqTotal = 0, asigTotal = 0;
          horasPIE.forEach(h => { reqTotal += h.horas_requeridas || 0; asigTotal += h.horas_asignadas || 0; });
          const pendientesPIE = reqTotal - asigTotal;
          const porcentajePIE = reqTotal > 0 ? Math.round((asigTotal / reqTotal) * 100) : 100;
          setMetricasPIE({ porcentaje: porcentajePIE, pendientes: pendientesPIE > 0 ? pendientesPIE : 0 });
        }

        const { data: casosConvivencia } = await supabase.from('casos_convivencia').select('id').eq('estado_protocolo', 'Activo');
        setProtocolosActivos(casosConvivencia ? casosConvivencia.length : 0);
      }

      // CARGA DE ALERTAS (Siempre local porque se necesitan los nombres y el payload es ligero con limit)
      const { data: alertasRaw } = await supabase
        .from('alertas_mineduc')
        .select(`id, rut_alumno, tipo_alerta, prioridad, fecha_alerta, perfiles ( nombre )`)
        .eq('estado', 'Activa')
        .order('fecha_alerta', { ascending: false });

      if (alertasRaw) {
        const rutsAlertas = alertasRaw.map(a => a.rut_alumno);
        let matriculasAlertas = [];
        if (rutsAlertas.length > 0) {
            const { data: m } = await supabase.from('matriculas')
                .select('rut_alumno, cursos(nombre)')
                .in('rut_alumno', rutsAlertas);
            if(m) matriculasAlertas = m;
        }

        const alertasProcesadas = alertasRaw.map(alerta => {
          const matriculaAlumno = matriculasAlertas.find(m => m.rut_alumno === alerta.rut_alumno);
          let colorBadge = 'emerald';
          if (alerta.prioridad === 'Alta') colorBadge = 'red';
          else if (alerta.prioridad === 'Media') colorBadge = 'orange';

          return {
            id: alerta.id,
            rut: alerta.rut_alumno,
            nombre: alerta.perfiles?.nombre || 'Desconocido',
            iniciales: (alerta.perfiles?.nombre || 'D').substring(0, 2).toUpperCase(),
            curso: matriculaAlumno?.cursos?.nombre || 'Sin curso',
            tipo: alerta.tipo_alerta,
            fecha: new Date(alerta.fecha_alerta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
            prioridad: alerta.prioridad,
            color: colorBadge
          };
        });
        setAlertas(alertasProcesadas);
      }
    } catch (error) {
      console.error('Error crítico en el Dashboard:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  return {
    totalAlumnos,
    porcentajes,
    asistenciaGlobal,
    alumnosRiesgo,
    metricasUTP,
    metricasPIE,
    protocolosActivos,
    alertas,
    isLoading,
    isUsingFallback
  };
}
