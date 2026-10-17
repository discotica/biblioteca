import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

export const user = writable<User | null>(null);

// Carga la sesión ya persistida al abrir o recargar la aplicación.
supabase.auth.getSession().then(({ data }) => {
  user.set(data.session?.user ?? null);
});

// Sincroniza el store con los cambios de sesión (login, logout, refresh de token).
supabase.auth.onAuthStateChange((_event, session) => {
  user.set(session?.user ?? null);
});
