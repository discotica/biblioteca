<script lang="ts">
  // Invitación beta (E19), distinta de la bienvenida del inicio (U11). U29: deja
  // de ser un diálogo; ocupa el hueco de la franja de entrada, como la
  // bienvenida. La lógica no cambia: el nombre entra como texto, nunca como
  // HTML, y cerrar hace que la página quite beta/nombre de la URL.
  import FranjaCabeza from '$lib/components/home/FranjaCabeza.svelte';
  import { user } from '$lib/stores/authStore';
  import { BETA_FEEDBACK_EMAIL, BETA_INVITATION_COPY } from '$lib/domain/betaInvitation';

  type Props = {
    name?: string | null;
    onclose?: () => void;
  };

  let { name = null, onclose }: Props = $props();

  const reportLoginHref = `/auth/login?redirect=${encodeURIComponent('/reportar')}`;
</script>

<FranjaCabeza
  id="beta-title"
  titulo={name ? `Hola, ${name}.` : BETA_INVITATION_COPY.genericTitle}
  texto={BETA_INVITATION_COPY.body}
  closeLabel="Cerrar invitación beta"
  {onclose}
  data-beta-invitation
>
  {#if BETA_INVITATION_COPY.launchDate}<p>{BETA_INVITATION_COPY.launchDate}</p>{/if}
  <a href={`mailto:${BETA_FEEDBACK_EMAIL}`}>Escribir a {BETA_FEEDBACK_EMAIL}</a>
  {#if $user}
    <a href="/reportar">Reportar un problema</a>
  {:else}
    <a href={reportLoginHref}>Iniciar sesión para reportar un problema</a>
  {/if}
</FranjaCabeza>
