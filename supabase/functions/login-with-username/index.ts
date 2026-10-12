// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const USERNAME = /^[a-z0-9_-]{3,30}$/;
const headers = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers });
    }
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // La clave pública no autoriza por sí sola, pero evita que este endpoint
    // quede abierto a tráfico ajeno al proyecto. La seguridad de la cuenta la
    // sigue imponiendo el grant de contraseña de Auth.
    if (!anonKey || !serviceRoleKey || !supabaseUrl || req.headers.get("apikey") !== anonKey) {
      return Response.json({ error: "Login unavailable" }, { status: 503, headers });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let username = "";
    let password = "";
    try {
      const body = await req.json();
      username = String(body?.username ?? "").trim().toLowerCase();
      password = String(body?.password ?? "");
    } catch {
      return Response.json({ error: "Invalid credentials" }, { status: 400, headers });
    }

    // La respuesta es deliberadamente indistinguible para usuario inexistente,
    // contraseña incorrecta o cuenta sin email confirmado; nunca devuelve email.
    if (!USERNAME.test(username) || password.length < 8) {
      return Response.json({ error: "Invalid credentials" }, { status: 400, headers });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!profile) {
      return Response.json({ error: "Invalid credentials" }, { status: 401, headers });
    }

    const { data: userData } = await admin.auth.admin.getUserById(profile.id);
    const email = userData.user?.email;
    if (!email) {
      console.error("Username login is missing required Auth configuration.");
      return Response.json({ error: "Login unavailable" }, { status: 503, headers });
    }

    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!tokenResponse.ok) {
      return Response.json({ error: "Invalid credentials" }, { status: 401, headers });
    }

    const session = await tokenResponse.json();
    return Response.json(
      { access_token: session.access_token, refresh_token: session.refresh_token },
      { headers },
    );
  },
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/login-with-username' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
