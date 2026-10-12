<script lang="ts">
  // Invitación beta (E19): diálogo propio, distinto de la bienvenida del inicio
  // (U11). Usa Dialog del sistema; foco, Tab, Escape y fondo son de overlay.ts.
  // El nombre entra como texto, nunca como HTML.
  import Dialog from '$lib/ui/Dialog.svelte';
  import Button from '$lib/ui/Button.svelte';
  import { user } from '$lib/stores/authStore';
  import { BETA_FEEDBACK_EMAIL, BETA_INVITATION_COPY } from '$lib/domain/betaInvitation';

  type Props = {
    name?: string | null;
    returnFocus?: HTMLElement | null;
    onclose?: () => void;
  };

  let { name = null, returnFocus = null, onclose }: Props = $props();

  const reportLoginHref = `/auth/login?redirect=${encodeURIComponent('/reportar')}`;

  // Cerrar, Escape, fondo y Explorar hacen lo mismo: la página quita beta/nombre de la URL.
  function close() {
    onclose?.();
  }
</script>

<Dialog
  open
  size="sm"
  title={name ? `Hola, ${name}.` : BETA_INVITATION_COPY.genericTitle}
  description={BETA_INVITATION_COPY.body}
  closeLabel="Cerrar invitación beta"
  {returnFocus}
  onclose={close}
  class="beta-invitation"
  data-beta-invitation
>
  {#if BETA_INVITATION_COPY.launchDate}
    <p class="beta-invitation__date">{BETA_INVITATION_COPY.launchDate}</p>
  {/if}

  <div class="beta-invitation__actions">
    <Button onclick={close}>{BETA_INVITATION_COPY.cta}</Button>
  </div>

  <div class="beta-invitation__feedback">
    <p>¿Prefieres escribirnos? Puedes contactarnos por correo durante la beta.</p>
    <a href={`mailto:${BETA_FEEDBACK_EMAIL}`}>Escribir a {BETA_FEEDBACK_EMAIL}</a>
    {#if $user}
      <p>Si iniciaste sesión, también puedes usar el canal protegido de la plataforma.</p>
      <a href="/reportar">Reportar un problema</a>
    {:else}
      <p>Para enviar un reporte protegido desde la plataforma, inicia sesión.</p>
      <a href={reportLoginHref}>Iniciar sesión para reportar un problema</a>
    {/if}
  </div>
</Dialog>

<style>
  .beta-invitation__date { margin: var(--space-4) 0 0; color: var(--color-acento); font-size: var(--text-sm); }
  .beta-invitation__actions { display: flex; margin-top: var(--space-4); }
  .beta-invitation__feedback {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-linea);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .beta-invitation__feedback p { margin: 0; }
  .beta-invitation__feedback a { width: fit-content; color: var(--color-acento); font-weight: 700; overflow-wrap: anywhere; }
</style>
