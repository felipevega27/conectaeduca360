import { createClient } from '@supabase/supabase-js';

// Inicializamos el cliente con la URL limpia y la llave de entorno
export const supabase = createClient(
  'https://iyotgxfszcdpkkorikbq.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY
);