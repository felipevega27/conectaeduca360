import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../config/supabaseClient';

export const useAlumnoDashboardQuery = (rutAlumno, currentUser) => {
  return useQuery({
    queryKey: ['alumnoDashboard', rutAlumno],
    queryFn: async () => {
      if (!rutAlumno) throw new Error('RUT del alumno requerido');

      // 1. Obtener Matrícula y Curso
      const { data: matricula, error: matriculaError } = await supabase
        .from('matriculas')
        .select('id_curso, cursos(nombre)')
        .eq('rut_alumno', rutAlumno)
        .maybeSingle();

      if (matriculaError) throw matriculaError;

      const cursoId = matricula?.id_curso || null;
      const cursoNombre = matricula?.cursos?.nombre || 'Sin Curso';

      // 2. Obtener Asistencia
      const { data: asistencias, error: asistenciaError } = await supabase
        .from('asistencia_alumnos')
        .select('estado, justificado')
        .eq('rut_alumno', rutAlumno);
      
      if (asistenciaError) throw asistenciaError;

      let porcentajeAsistencia = 0;
      let faltasInjustificadas = 0;
      if (asistencias && asistencias.length > 0) {
        const presentes = asistencias.filter(a => a.estado.toLowerCase() === 'presente' || a.estado.toLowerCase() === 'atraso').length;
        faltasInjustificadas = asistencias.filter(a => a.estado.toLowerCase() === 'ausente' && a.justificado !== true).length;
        porcentajeAsistencia = Math.round((presentes / asistencias.length) * 100);
      }

      // 3. Obtener Anotaciones (Negativas y Recientes)
      const { data: anotacionesData, error: anotacionesError } = await supabase
        .from('anotaciones')
        .select('*, perfiles!rut_profesor(nombre)')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });
      
      if (anotacionesError) throw anotacionesError;

      let negativasCount = 0;
      let positivasCount = 0;
      let ultimasAnot = [];
      if (anotacionesData) {
        negativasCount = anotacionesData.filter(a => a.tipo.toLowerCase() === 'negativa').length;
        positivasCount = anotacionesData.filter(a => a.tipo.toLowerCase() === 'positiva').length;
        ultimasAnot = anotacionesData.slice(0, 3).map(a => ({
          id: a.id,
          tipo: a.tipo.toLowerCase(),
          descripcion: a.descripcion,
          fecha: new Date(a.fecha).toLocaleDateString('es-CL'),
          profesor: a.perfiles?.nombre || 'Profesor'
        }));
      }

      // 4. Obtener Calificaciones y Calcular Promedio General
      const { data: calificacionesData, error: calificacionesError } = await supabase
        .from('notas')
        .select('*')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });
      
      if (calificacionesError) throw calificacionesError;

      let promedio = 0;
      let notasRecientes = [];
      if (calificacionesData && calificacionesData.length > 0) {
        const sumaNotas = calificacionesData.reduce((acc, curr) => acc + (curr.nota || 0), 0);
        promedio = sumaNotas / calificacionesData.length;
        
        const recientes = calificacionesData.slice(0, 3);
        const asignaturasIds = [...new Set(recientes.map(n => n.id_asignatura).filter(Boolean))];
        const evaluacionesIds = [...new Set(recientes.map(n => n.id_evaluacion).filter(Boolean))];
        
        let asignaturasMap = {};
        let evaluacionesMap = {};
        
        if (asignaturasIds.length > 0) {
          const { data: asigData } = await supabase.from('asignaturas').select('id, nombre').in('id', asignaturasIds);
          if (asigData) asigData.forEach(a => asignaturasMap[a.id] = a.nombre);
        }
        if (evaluacionesIds.length > 0) {
          const { data: evalData } = await supabase.from('evaluaciones').select('id, nombre').in('id', evaluacionesIds);
          if (evalData) evalData.forEach(e => evaluacionesMap[e.id] = e.nombre);
        }

        notasRecientes = recientes.map(c => ({
          id: c.id,
          asignatura: asignaturasMap[c.id_asignatura] || 'Desconocida',
          evaluacion: evaluacionesMap[c.id_evaluacion] || 'Evaluación',
          nota: c.nota,
          fecha: new Date(c.created_at || c.fecha).toLocaleDateString('es-CL')
        }));
      }

      // 5. Obtener Avisos (Muro de Avisos del Curso)
      let avisosMuro = [];
      if (cursoId) {
        const { data: avisos } = await supabase
          .from('anuncios_curso')
          .select('*, perfiles!rut_profesor(nombre)')
          .eq('id_curso', cursoId)
          .order('fecha_creacion', { ascending: false });
        
        if (avisos) {
          avisosMuro = avisos;
        }
      }

      // 6. Datos para el certificado
      const alumnoInfo = {
        rut: rutAlumno,
        nombre: currentUser?.name || currentUser?.nombre || 'Alumno',
        curso: cursoNombre
      };
      const { data: configColegio } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();

      return {
        alumnoData: {
          cursoNombre,
          asistencia: porcentajeAsistencia,
          promedioGeneral: parseFloat(promedio.toFixed(1)),
          anotacionesNegativas: negativasCount,
          anotacionesPositivas: positivasCount,
          faltasInjustificadas
        },
        ultimasNotas: notasRecientes,
        avisosMuro,
        anotaciones: ultimasAnot,
        alumnoInfo,
        configColegio: configColegio || {}
      };
    },
    enabled: !!rutAlumno // Solo ejecutar la query si tenemos el RUT
  });
};
