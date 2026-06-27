import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iyotgxfszcdpkkorikbq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b3RneGZzemNkcGtrb3Jpa2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0ODA5ODQsImV4cCI6MjA5NzA1Njk4NH0.WfQu9Q7e2I0N9_OFoM1EVBcfJDpP3N9FWLq-4eX8mcU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('perfiles').select('rol');
  if (error) {
    console.error(error);
    return;
  }
  const roles = new Set(data.map(d => d.rol));
  console.log('Unique roles in DB:', Array.from(roles));
}
run();
