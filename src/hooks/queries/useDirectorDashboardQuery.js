import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../config/supabaseClient';
import { perteneceAlSemestre, getMesesSemestre } from '../../utils/dateUtils';

export const useDirectorDashboardQuery = (semestreActivo = 'Primer Semestre') => {
  return useQuery({
    queryKey: ['directorDashboard', semestreActivo],
    queryFn: async () => {
      let totalAlumnos = 0;
      let porcentajes = { regular: 0, sep: 0, pie: 0 };
      let asistenciaGlobal = 0;
      let alumnosRiesgo = 0;
      let metricasUTP = { coberturaPromedio: 0, alDia: 0, atrasados: 0, pendientes: 0, porcentajeAlDia: 0 };
      let metricasPIE = { porcentaje: 0, pendientes: 0 };
      let protocolosActivos = 0;
      let alertas = [];
      let asistenciaMensual = [];
      let isUsingFallback = true;

      const mesesValidos = getMesesSemestre(semestreActivo);

      // 1. Matrículas
      const { data: listaMatriculas } = await supabase.from('matriculas').select('rut_alumno, condicion_estudiante, cursos(nombre)');
      if (listaMatriculas && listaMatriculas.length > 0) {
        const total = listaMatriculas.length;
        totalAlumnos = total;
        let conteoRegular = 0, conteoSEP = 0, conteoPIE = 0;
        listaMatriculas.forEach(alumno => {
          const condicion = alumno.condicion_estudiante?.toUpperCase().trim();
          if (condicion === 'REGULAR') conteoRegular++;
          else if (condicion === 'SEP' || condicion === 'PRIORITARIO') conteoSEP++;
          else if (condicion === 'PIE') conteoPIE++;
        });
        porcentajes = {
          regular: Math.round((conteoRegular / total) * 100) || 0,
          sep: Math.round((conteoSEP / total) * 100) || 0,
          pie: Math.round((conteoPIE / total) * 100) || 0
        };
      }

      // 2. Asistencia
      const { data: listaAsistenciaRaw } = await supabase.from('asistencia_alumnos').select('*');
      const listaAsistencia = listaAsistenciaRaw?.filter(a => perteneceAlSemestre(a.fecha, semestreActivo)) || [];
      if (listaAsistencia && listaAsistencia.length > 0) {
        const totalRegistros = listaAsistencia.length;
        const presentesYAtrasos = listaAsistencia.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
        asistenciaGlobal = Math.round((presentesYAtrasos / totalRegistros) * 100);
        
        const ausencias = listaAsistencia.filter(a => a.estado === 'Ausente');
        const alumnosUnicosConAusencia = new Set(ausencias.map(a => a.rut_alumno));
        alumnosRiesgo = alumnosUnicosConAusencia.size;

        const mensualStats = {};
        listaAsistencia.forEach(a => {
           if (!a.fecha) return;
           const mesStr = a.fecha.includes('T') ? a.fecha.split('T')[0].split('-')[1] : a.fecha.split('-')[1];
           const mes = parseInt(mesStr, 10) - 1;
           if (!mensualStats[mes]) mensualStats[mes] = { total: 0, presentes: 0 };
           mensualStats[mes].total++;
           if (a.estado === 'Presente' || a.estado === 'Atraso') mensualStats[mes].presentes++;
        });

        asistenciaMensual = mesesValidos.map(m => {
           if (!mensualStats[m] || mensualStats[m].total === 0) return 0;
           return Math.round((mensualStats[m].presentes / mensualStats[m].total) * 100);
        });
      } else {
        asistenciaMensual = [0, 0, 0, 0, 0];
      }

      // 3. UTP
      const { data: planificacionesRaw } = await supabase.from('planificaciones').select('*');
      const planificaciones = planificacionesRaw?.filter(p => perteneceAlSemestre(p.fecha_limite, semestreActivo)) || [];
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
        metricasUTP = { coberturaPromedio, pendientes, alDia, atrasados, porcentajeAlDia };
      }

      // 4. PIE
      const { data: horasPIE } = await supabase.from('pie_horas_curso').select('horas_requeridas, horas_asignadas');
      if (horasPIE && horasPIE.length > 0) {
        let reqTotal = 0, asigTotal = 0;
        horasPIE.forEach(h => { reqTotal += h.horas_requeridas || 0; asigTotal += h.horas_asignadas || 0; });
        const pendientesPIE = reqTotal - asigTotal;
        const porcentajePIE = reqTotal > 0 ? Math.round((asigTotal / reqTotal) * 100) : 100;
        metricasPIE = { porcentaje: porcentajePIE, pendientes: pendientesPIE > 0 ? pendientesPIE : 0 };
      }

      // 5. Convivencia
      const { data: casosConvivenciaRaw } = await supabase.from('casos_convivencia').select('id, fecha_reporte').eq('estado_protocolo', 'Activo');
      const casosConvivencia = casosConvivenciaRaw?.filter(c => perteneceAlSemestre(c.fecha_reporte, semestreActivo)) || [];
      protocolosActivos = casosConvivencia ? casosConvivencia.length : 0;

      // 6. Alertas
      const { data: alertasRaw } = await supabase
        .from('alertas_mineduc')
        .select(`id, rut_alumno, tipo_alerta, prioridad, fecha_alerta, perfiles ( nombre )`)
        .eq('estado', 'Activa')
        .order('fecha_alerta', { ascending: false });

      if (alertasRaw) {
        const alertasSemestre = alertasRaw.filter(a => perteneceAlSemestre(a.fecha_alerta, semestreActivo));
        const rutsAlertas = alertasSemestre.map(a => a.rut_alumno);
        let matriculasAlertas = [];
        if (rutsAlertas.length > 0) {
            const { data: m } = await supabase.from('matriculas')
                .select('rut_alumno, cursos(nombre)')
                .in('rut_alumno', rutsAlertas);
            if(m) matriculasAlertas = m;
        }

        alertas = alertasSemestre.map(alerta => {
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
      }

      return {
        totalAlumnos,
        porcentajes,
        asistenciaGlobal,
        alumnosRiesgo,
        metricasUTP,
        metricasPIE,
        protocolosActivos,
        alertas,
        asistenciaMensual,
        isUsingFallback
      };
    }
  });
};
