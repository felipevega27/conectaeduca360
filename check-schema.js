import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  'https://iyotgxfszcdpkkorikbq.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  const tables = ['asignaturas', 'cursos', 'asistencia_alumnos', 'notas', 'casos_convivencia', 'planificaciones', 'horarios', 'leccionario'];
  for (let t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Table ${t}:`);
    if (error) {
       console.log('Error or does not exist:', error.message);
    } else {
       console.log('Columns:', data.length > 0 ? Object.keys(data[0]) : 'Empty table, schema unknown via select *');
    }
    console.log('---');
  }
}

checkSchema();
