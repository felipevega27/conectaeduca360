import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../config/supabaseClient';
import { sortCursos } from '../../utils/sortUtils';

export const useProfesorDashboardQuery = (rutProfesor) => {
  return useQuery({
    queryKey: ['profesorDashboard', rutProfesor],
    queryFn: async () => {
      if (!rutProfesor) throw new Error('RUT del profesor requerido');

      let profesorJefeData = {
        idCurso: null,
        curso: 'Sin Jefatura',
        alumnosRiesgo: 0,
        avancePlanificacion: 0,
        alumnos: [],
        alumnosRiesgoDetalle: []
      };

      let clasesHoyData = [];
      let feriadoHoyData = null;
      let misCursosData = [];

      // 1. Obtener Jefatura
      const { data: cursoJefatura } = await supabase
        .from('cursos')
        .select('id, nombre')
        .eq('rut_profesor_jefe', rutProfesor)
        .maybeSingle();

      if (cursoJefatura) {
        const { data: asistencias } = await supabase
          .from('asistencia_alumnos')
          .select('rut_alumno, estado')
          .eq('id_curso', cursoJefatura.id)
          .eq('estado', 'Ausente');
        
        const ausenciasCount = {};
        asistencias?.forEach(a => {
            ausenciasCount[a.rut_alumno] = (ausenciasCount[a.rut_alumno] || 0) + 1;
        });
        
        const rutsRiesgo = Object.keys(ausenciasCount).filter(rut => ausenciasCount[rut] >= 2);
        
        profesorJefeData.idCurso = cursoJefatura.id;
        profesorJefeData.curso = cursoJefatura.nombre;
        profesorJefeData.alumnosRiesgo = rutsRiesgo.length;

        // Cargar alumnos de jefatura
        const { data: matriculas } = await supabase
          .from('matriculas')
          .select('rut_alumno')
          .eq('id_curso', cursoJefatura.id);

        if (matriculas && matriculas.length > 0) {
          const ruts = matriculas.map(m => m.rut_alumno);
          const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre, email, avatar_url').in('rut', ruts);
          
          const lista = matriculas.map(m => {
            const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
            return {
              rut: m.rut_alumno,
              nombre: perfil?.nombre || 'Sin Nombre',
              email: perfil?.email || 'Sin correo registrado',
              avatar_url: perfil?.avatar_url || null
            };
          });
          lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
          profesorJefeData.alumnos = lista;
          
          // Llenar lista de riesgo
          const riesgoLista = lista.filter(a => rutsRiesgo.includes(a.rut)).map(a => ({
              ...a,
              motivo: `${ausenciasCount[a.rut]} ausencias consecutivas`
          }));
          profesorJefeData.alumnosRiesgoDetalle = riesgoLista;
        }
      }

      // Obtener porcentaje de avance de planificaciones
      const { data: planes } = await supabase
        .from('planificaciones')
        .select('id')
        .eq('rut_profesor', rutProfesor);
      
      const planesCount = planes ? planes.length : 0;
      profesorJefeData.avancePlanificacion = Math.min(Math.round((planesCount / 10) * 100), 100);

      // 2. Obtener Clases de Hoy
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const hoy = new Date();
      const diaHoy = dias[hoy.getDay()];
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      const hoyIso = `${yyyy}-${mm}-${dd}`;

      const { data: feriadosList } = await supabase.from('feriados').select('*');
      const feriado = feriadosList?.find(f => f.fecha && f.fecha.startsWith(hoyIso));

      if (feriado) {
        feriadoHoyData = feriado;
      } else {
        const { data: horariosHoy } = await supabase
          .from('horarios')
          .select('*, cursos(nombre), asignaturas(nombre)')
          .eq('rut_profesor', rutProfesor)
          .eq('dia_semana', diaHoy)
          .order('hora_inicio', { ascending: true });

        if (horariosHoy && horariosHoy.length > 0) {
          const horariosIds = horariosHoy.map(h => h.id);
          const { data: leccionarios } = await supabase
            .from('leccionarios')
            .select('id_horario, firmado')
            .in('id_horario', horariosIds)
            .eq('fecha', hoyIso);

          const leccionariosMap = {};
          leccionarios?.forEach(lec => {
            leccionariosMap[lec.id_horario] = lec.firmado;
          });

          const horaActualStr = hoy.getHours().toString().padStart(2, '0') + ':' + hoy.getMinutes().toString().padStart(2, '0');

          clasesHoyData = horariosHoy.map(h => {
            let estado = 'Pendiente';
            if (horaActualStr >= h.hora_inicio && horaActualStr <= h.hora_fin) {
              estado = 'En Curso';
            } else if (horaActualStr > h.hora_fin || leccionariosMap[h.id]) {
              estado = 'Finalizada';
            }

            return {
              id: h.id,
              id_curso: h.id_curso,
              id_asignatura: h.id_asignatura,
              bloque: h.bloque,
              hora: `${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)}`,
              curso: h.cursos?.nombre || 'Curso Desconocido',
              asignatura: h.asignaturas?.nombre || 'Asignatura Desconocida',
              sala: h.sala || 'Sala Asignada',
              estado: estado,
              leccionarioFirmado: !!leccionariosMap[h.id]
            };
          });
        }
      }

      // 3. Obtener Cursos
      const { data: asignaturasData } = await supabase
        .from('asignaturas')
        .select('id_curso, cursos(nombre)')
        .eq('rut_profesor', rutProfesor);
      
      if (asignaturasData) {
        const uniqueCursosMap = new Map();
        asignaturasData.forEach(asig => {
          if (asig.cursos) {
            uniqueCursosMap.set(asig.id_curso, asig.cursos.nombre);
          }
        });
        const cursosList = Array.from(uniqueCursosMap, ([id, nombre]) => ({ id, nombre }));
        misCursosData = sortCursos(cursosList);
      }

      return {
        profesorJefe: profesorJefeData,
        clasesHoy: clasesHoyData,
        feriadoHoy: feriadoHoyData,
        misCursos: misCursosData
      };
    },
    enabled: !!rutProfesor
  });
};
