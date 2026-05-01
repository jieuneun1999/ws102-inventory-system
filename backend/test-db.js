import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function main() {
  console.log('Checking supplier_requests table...');
  const { data, error } = await supabase
    .from('supplier_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${data?.length ?? 0} supplier requests:`);
  if (data && data.length > 0) {
    data.slice(0, 5).forEach((req) => {
      console.log(`  - [${req.status}] ${req.item_name} (qty: ${req.quantity} ${req.unit}) from ${req.supplier_email}`);
    });
  } else {
    console.log('  (none)');
  }
}

main().catch(console.error);
