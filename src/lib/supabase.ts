import { createClient } from '$lib/supabase/client';

// A single browser client keeps auth state in cookies and refreshes tokens while
// the application is open. This is the session-refresh equivalent for this
// static, client-rendered SvelteKit app.
export const supabase = createClient();
