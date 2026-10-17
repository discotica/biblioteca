import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export const load: PageLoad = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect(302, '/auth/login?redirect=/mis-aportes');
  return { userId: session.user.id, username: (session.user.user_metadata?.username as string | undefined) ?? '' };
};
