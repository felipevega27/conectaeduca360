import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Inicializar Supabase
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
const envFile = fs.readFileSync(envPath, 'utf-8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

// Configuración de Malla Curricular (JEC - Bloques por semana de 90 min)
const MALLA = [
  { nombre: 'Lenguaje y Comunicación', bloques: 4, especialidad: 'lenguaje' },
  { nombre: 'Matemáticas', bloques: 4, especialidad: 'matemática' },
  { nombre: 'Ciencias Naturales', bloques: 2, especialidad: 'ciencias' },
  { nombre: 'Historia y Geografía', bloques: 2, especialidad: 'historia' },
  { nombre: 'Educación Física', bloques: 2, especialidad: 'educación física' },
  { nombre: 'Informática', bloques: 1, especialidad: 'informática' }
];

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const BLOQUES_DIA = ['Bloque 1', 'Bloque 2', 'Bloque 3', 'Bloque 4'];
const HORAS_INICIO = ['08:00:00', '09:45:00', '11:30:00', '14:00:00'];
const HORAS_FIN = ['09:30:00', '11:15:00', '13:00:00', '15:30:00'];

function normalizarEspecialidad(cursoCargo) {
  if (!cursoCargo) return 'otro';
  const c = cursoCargo.toLowerCase();
  if (c.includes('lenguaje')) return 'lenguaje';
  if (c.includes('matemática') || c.includes('matematica')) return 'matemática';
  if (c.includes('ciencia')) return 'ciencias';
  if (c.includes('historia')) return 'historia';
  if (c.includes('física') || c.includes('fisica')) return 'educación física';
  if (c.includes('informática') || c.includes('informatica')) return 'informática';
  return 'otro';
}

// Mezclar array (Fisher-Yates) para aleatoriedad en horarios
function shuffleArray(array) {
  let curId = array.length;
  while (0 !== curId) {
    let randId = Math.floor(Math.random() * curId);
    curId -= 1;
    let tmp = array[curId];
    array[curId] = array[randId];
    array[randId] = tmp;
  }
  return array;
}

async function run() {
  console.log("🚀 Iniciando Generador Automático de Horarios...");

  // 1. Limpiar base de datos
  console.log("🧹 Limpiando tablas de horarios y asignaturas...");
  const { error: errH } = await supabase.from('horarios').delete().gte('id', 0); // Borra todo
  if (errH) console.error("Error borrando horarios:", errH.message);
  
  const { error: errA } = await supabase.from('asignaturas').delete().gte('id', 0);
  if (errA) console.error("Error borrando asignaturas:", errA.message);

  // 2. Obtener Cursos y Profesores
  const { data: cursos } = await supabase.from('cursos').select('*').order('id');
  const { data: profes } = await supabase.from('perfiles').select('*').eq('rol', 'profesor');

  // 3. Agrupar Profesores
  const profesPorEspecialidad = {};
  profes.forEach(p => {
    const esp = normalizarEspecialidad(p.curso_o_cargo);
    if (!profesPorEspecialidad[esp]) profesPorEspecialidad[esp] = [];
    profesPorEspecialidad[esp].push(p.rut);
  });

  const indiceProfes = {}; // Para Round Robin

  // 4. Crear Asignaturas
  console.log("📚 Generando asignaturas y asignando profesores (Round Robin)...");
  const nuevasAsignaturas = [];
  let idAsig = 1;

  for (const curso of cursos) {
    for (const ramo of MALLA) {
      const posiblesProfes = profesPorEspecialidad[ramo.especialidad];
      let rutAsignado = null;
      
      // 1. Dar prioridad absoluta al Profesor Jefe si es de la misma especialidad
      const esJefeEspecialista = posiblesProfes && posiblesProfes.includes(curso.rut_profesor_jefe);
      
      if (esJefeEspecialista) {
        rutAsignado = curso.rut_profesor_jefe;
      } 
      // 2. Si no es el jefe, usar el sistema equitativo (Round Robin)
      else if (posiblesProfes && posiblesProfes.length > 0) {
        if (indiceProfes[ramo.especialidad] === undefined) indiceProfes[ramo.especialidad] = 0;
        const idx = indiceProfes[ramo.especialidad] % posiblesProfes.length;
        rutAsignado = posiblesProfes[idx];
        indiceProfes[ramo.especialidad]++;
      }

      nuevasAsignaturas.push({
        nombre: ramo.nombre,
        id_curso: curso.id,
        rut_profesor: rutAsignado
      });
    }
  }

  const { error: errAsig } = await supabase.from('asignaturas').insert(nuevasAsignaturas);
  if (errAsig) throw errAsig;

  // 5. Algoritmo Timetabling (Sin colisiones)
  console.log("📅 Calculando horarios sin colisiones (Resolviendo puzzle)...");
  
  // Grilla de ocupación de profesores: profesOcupados[RUT][Dia][Bloque] = true
  const profesOcupados = {};
  profes.forEach(p => {
    profesOcupados[p.rut] = {};
    DIAS.forEach(d => {
      profesOcupados[p.rut][d] = {};
      BLOQUES_DIA.forEach(b => profesOcupados[p.rut][d][b] = false);
    });
  });

  // Volver a consultar asignaturas para tener sus IDs reales
  const { data: asignaturasInsertadas } = await supabase.from('asignaturas').select('*');

  const nuevosHorarios = [];
  let choquesSinResolver = 0;

  for (const curso of cursos) {
    // Grilla del curso: cursoOcupado[Dia][Bloque] = true
    const cursoOcupado = {};
    DIAS.forEach(d => {
      cursoOcupado[d] = {};
      BLOQUES_DIA.forEach(b => cursoOcupado[d][b] = false);
    });

    const asignaturasCurso = asignaturasInsertadas.filter(a => a.id_curso === curso.id);

    for (const asig of asignaturasCurso) {
      const configRamo = MALLA.find(m => m.nombre === asig.nombre);
      const bloquesRequeridos = configRamo.bloques;
      const rutProfe = asig.rut_profesor;

      let bloquesAgendados = 0;

      // Intentar agendar los bloques requeridos
      for (let i = 0; i < bloquesRequeridos; i++) {
        // Buscar un slot disponible aleatorio para darle variabilidad al horario
        let slotAsignado = false;
        const diasRandom = shuffleArray([...DIAS]);
        
        for (const dia of diasRandom) {
          const bloquesRandom = shuffleArray([0, 1, 2, 3]); // Índices de BLOQUES_DIA
          
          for (const blqIdx of bloquesRandom) {
            const bloqueNombre = BLOQUES_DIA[blqIdx];
            
            // ¿El curso está libre y el profesor está libre?
            const profeDisponible = (rutProfe && profesOcupados[rutProfe]) ? !profesOcupados[rutProfe][dia][bloqueNombre] : true;
            
            if (!cursoOcupado[dia][bloqueNombre] && profeDisponible) {
              // Asignar
              cursoOcupado[dia][bloqueNombre] = true;
              if (rutProfe && profesOcupados[rutProfe]) profesOcupados[rutProfe][dia][bloqueNombre] = true;
              
              nuevosHorarios.push({
                id_curso: curso.id,
                id_asignatura: asig.id,
                rut_profesor: rutProfe,
                dia_semana: dia,
                bloque: bloqueNombre,
                hora_inicio: HORAS_INICIO[blqIdx],
                hora_fin: HORAS_FIN[blqIdx],
                sala: `Sala ${curso.id}` // Asumimos sala por curso
              });
              
              slotAsignado = true;
              bloquesAgendados++;
              break; // Slot encontrado, pasar al siguiente bloque requerido
            }
          }
          if (slotAsignado) break;
        }

        if (!slotAsignado) {
          console.warn(`⚠️ No se pudo agendar 1 bloque de ${asig.nombre} para ${curso.nombre}. ${rutProfe ? 'Profesor saturado' : 'Sin profe'} o curso lleno.`);
          choquesSinResolver++;
        }
      }
    }
  }

  // 6. Insertar en lotes de 100
  console.log(`🚀 Insertando ${nuevosHorarios.length} bloques de horarios en la base de datos...`);
  for(let i=0; i<nuevosHorarios.length; i+=100) {
    const batch = nuevosHorarios.slice(i, i+100);
    const { error } = await supabase.from('horarios').insert(batch);
    if(error) console.error('Error insertando lote', i, error.message);
  }

  console.log(`\n✅ ¡Horarios generados con éxito!`);
  console.log(`📊 Estadísticas:`);
  console.log(`- Asignaturas creadas: ${nuevasAsignaturas.length}`);
  console.log(`- Clases programadas: ${nuevosHorarios.length}`);
  if (choquesSinResolver > 0) {
    console.log(`- ⚠️ Hubo ${choquesSinResolver} bloques que NO se pudieron agendar debido a falta de personal (profesores al límite de 20 bloques/semana). ¡Se requiere contratar más profesores!`);
  } else {
    console.log(`- 🎉 0 choques o conflictos. La capacidad docente es suficiente.`);
  }
}

run().catch(console.error);
