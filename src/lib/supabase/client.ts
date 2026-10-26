import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Las anon keys heredadas siguen siendo claves públicas compatibles. La nueva
// variable publishable es preferida para no bloquear el despliegue actual.
const supabaseKey =
	import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
	);
}

/** Creates the browser client used by this client-rendered SvelteKit app. */
export const createClient = () =>
	createBrowserClient(supabaseUrl, supabaseKey, {
		auth: {
			// La app es estática y el enlace puede abrirse desde el cliente de correo.
			// El flujo implícito no depende del code verifier local que exige PKCE.
			flowType: 'implicit',
			detectSessionInUrl: true
		}
	});
