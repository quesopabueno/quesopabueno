import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: o } = await supabase.from("orders").select("customer_id").limit(1);
  const { data: c } = await supabase.from("customers").select("*").limit(1);
  console.log("Orders:", JSON.stringify(o));
  console.log("Customers:", JSON.stringify(c));
}
check();
