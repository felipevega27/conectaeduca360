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
  console.log("Obteniendo todas las asignaturas...");
  const { data: asignaturas, error: asigError } = await supabase.from('asignaturas').select('id, rut_profesor');
  if (asigError) throw asigError;

  const asignaturaMap = {};
  asignaturas.forEach(a => {
    asignaturaMap[a.id] = a.rut_profesor;
  });

  console.log("Obteniendo todos los horarios...");
  const { data: horarios, error: horError } = await supabase.from('horarios').select('id, id_asignatura, rut_profesor');
  if (horError) throw horError;

  let updates = 0;
  for (const h of horarios) {
    const correctRut = asignaturaMap[h.id_asignatura];
    if (correctRut && h.rut_profesor !== correctRut) {
      console.log(`Corrigiendo Horario ID ${h.id}: rut_profesor de ${h.rut_profesor} a ${correctRut}`);
      const { error: updateError } = await supabase.from('horarios').update({ rut_profesor: correctRut }).eq('id', h.id);
      if (updateError) {
        console.error(`Error actualizando horario ${h.id}:`, updateError.message);
      } else {
        updates++;
      }
    }
  }

  console.log(`\n¡Proceso terminado! Se corrigieron ${updates} horarios que tenían el profesor equivocado.`);
}

run().catch(console.error);
