import type { PageLoad } from './$types';

// «Revisa tu correo» (U30, tablero K) usa la barra mínima del onboarding: es la
// continuación del alta, no un paso del sitio.
export const load: PageLoad = () => ({ header: 'minimo' as const });
