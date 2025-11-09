import { createClient } from "@supabase/supabase-js";

let supabaseServerInstance = null;

function getSupabaseServer() {
  if (supabaseServerInstance) {
    return supabaseServerInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  supabaseServerInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseServerInstance;
}

// Export a Proxy that lazily initializes the client
// This allows the module to be imported during build without errors
export const supabaseServer = new Proxy(
  {},
  {
    get(target, prop) {
      const client = getSupabaseServer();
      const value = client[prop];

      // If it's a function, bind it to the client to maintain 'this' context
      if (typeof value === "function") {
        return value.bind(client);
      }

      return value;
    },
  }
);
