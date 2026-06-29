import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if(line.startsWith('VITE_SUPABASE_URL')) url = line.split('=')[1].trim();
  if(line.startsWith('VITE_SUPABASE_ANON_KEY')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

async function run() {
  const { data: horarios, error } = await supabase.from('horarios').select('id, rut_profesor, id_asignatura, asignaturas(nombre, rut_profesor)');
  if(error) {
    console.error(error);
  } else {
    let mismatches = 0;
    for (const h of horarios) {
      if (h.asignaturas && h.rut_profesor !== h.asignaturas.rut_profesor) {
        console.log(`Mismatch: Horario ID ${h.id} has teacher ${h.rut_profesor}, but Asignatura ${h.id_asignatura} (${h.asignaturas.nombre}) belongs to ${h.asignaturas.rut_profesor}`);
        mismatches++;
      }
    }
    console.log(`Total mismatches: ${mismatches} out of ${horarios.length} horarios`);
  }
}
run().catch(console.error);
