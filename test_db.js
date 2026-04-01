import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rtczsllhilqwnjbzujeh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0Y3pzbGxoaWxxd25qYnp1amVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDQyOTksImV4cCI6MjA4NTY4MDI5OX0.BzYnuVGWHFQUQ8ahUFsTzzhxcwd7OlXOmhuusQIhVRI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('admins').select('*');
  console.log('Admins error:', error);
  console.log('Admins data:', data);

  const { data: sData, error: sErr } = await supabase.from('students').select('*');
  console.log('Students error:', sErr);
  console.log('Students data:', sData);
}

test();
