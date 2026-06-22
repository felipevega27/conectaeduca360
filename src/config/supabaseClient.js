import { createClient } from '@supabase/supabase-js';

// Inicializamos el cliente con la URL limpia y la llave de entorno
export const supabase = createClient(
  'https://iyotgxfszcdpkkorikbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b3RneGZzemNkcGtrb3Jpa2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0ODA5ODQsImV4cCI6MjA5NzA1Njk4NH0.WfQu9Q7e2I0N9_OFoM1EVBcfJDpP3N9FWLq-4eX8mcU'
);