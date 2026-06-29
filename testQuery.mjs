import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const file = fs.readFileSync('src/config/supabaseClient.js', 'utf8');
const urlMatch = file.match(/supabaseUrl\s*=\s*['"`]([^'"`]+)['"`]/);
const keyMatch = file.match(/supabaseAnonKey\s*=\s*['"`]([^'"`]+)['"`]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
supabase.from('planificaciones').select('id, mes, semanas, unidad, oa, descripcion, actividad, estado, fecha_creacion, asignaturas(nombre), cursos(nombre), perfiles(nombre)').neq('estado', 'Borrador').order('fecha_creacion', {ascending: false}).then(res => console.log(JSON.stringify(res.error, null, 2)));
