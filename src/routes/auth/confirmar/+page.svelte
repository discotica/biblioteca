<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AbrirCorreo from '$lib/components/account/AbrirCorreo.svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { confirmationRedirect, readPendingSignup, writePendingSignup } from '$lib/components/account/pendingSignup';
  import { Button, Field, FormPanel, Notice } from '$lib/ui';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { RESEND_COOLDOWN_SECONDS, retryAfterSeconds } from '$lib/domain/account';

  // Correo de la cuenta recién creada. Sin él (otra pestaña, enlace vencido),
  // la pantalla lo pide para reenviar.
  let email = $state('');
  let username = $state('');
  let typedEmail = $state('');
  let sentAt = $state(0);
  let now = $state(Date.now());
  let sending = $state(false);
  let notice = $state<{ tone: 'success' | 'error'; text: string } | null>(null);
  let cooldownUntil = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  const secondsLeft = $derived(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));

  function startCooldown(seconds: number) {
    cooldownUntil = Date.now() + seconds * 1000;
    now = Date.now();
  }

  onMount(() => {
    const fromNavigation = $page.state as { email?: string; username?: string };
    const pending = readPendingSignup();
    email = fromNavigation.email ?? pending?.email ?? '';
    username = fromNavigation.username ?? (pending?.email === email ? pending?.username : undefined) ?? '';
    sentAt = pending?.email === email ? pending.sentAt : email ? Date.now() : 0;
    if (sentAt) cooldownUntil = sentAt + RESEND_COOLDOWN_SECONDS * 1000;
    timer = setInterval(() => (now = Date.now()), 1000);
  });

  onDestroy(() => clearInterval(timer));

  function format(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  async function resend(target: string) {
    if (sending || secondsLeft > 0) return;
    notice = null;
    sending = true;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: target,
      options: { emailRedirectTo: confirmationRedirect(window.location.origin) }
    });
    sending = false;

    const wait = retryAfterSeconds(error?.message);
    if (error && (error.status === 429 || wait)) {
      startCooldown(wait ?? RESEND_COOLDOWN_SECONDS);
      notice = { tone: 'error', text: 'Espera un momento antes de pedir otro correo.' };
      return;
    }
    // Éxito y cualquier otro error dicen lo mismo: el mensaje no puede revelar
    // si hay una cuenta pendiente con ese correo.
    startCooldown(RESEND_COOLDOWN_SECONDS);
    if (!email) {
      email = target;
    }
    writePendingSignup({ email: target, sentAt: Date.now(), ...(username ? { username } : {}) });
    notice = {
      tone: 'success',
      text: 'Si hay una cuenta pendiente de confirmar con ese correo, te llegará un enlace nuevo en unos minutos.'
    };
  }

  function resendTyped(event: SubmitEvent) {
    event.preventDefault();
    const target = typedEmail.trim().toLowerCase();
    if (!target.includes('@')) {
      notice = { tone: 'error', text: 'Escribe el correo con el que creaste la cuenta.' };
      return;
    }
    void resend(target);
  }
</script>

<svelte:head>
  <title>Revisa tu correo — Biblioteca Discótica</title>
</svelte:head>

<!-- No es un paso más: la huella del alta se queda, ya con su color y un latido suave (tablero K). -->
<AccesoPagina contenedor="wide" alinea="inicio" nombre={username} color={Boolean(username)} latido={6}>
  <FormPanel size="wide">
    {#if email}
      <AccesoTitulo titulo="Revisa tu correo">
        Te enviamos un enlace a <strong>{email}</strong> para confirmar tu cuenta.
      </AccesoTitulo>

      <div class="confirmar__acciones">
        <AbrirCorreo>
          <Button
            variant="secondary"
            size="form"
            loading={sending}
            disabled={secondsLeft > 0}
            onclick={() => resend(email)}
            aria-describedby={secondsLeft > 0 ? 'resend-wait' : undefined}
          >
            Reenviar
          </Button>
        </AbrirCorreo>
        {#if secondsLeft > 0}
          <p class="confirmar__espera" id="resend-wait">Podrás reenviarlo en {format(secondsLeft)}.</p>
        {/if}
        <p class="confirmar__ayuda">Si no lo ves en unos minutos, busca en spam o en promociones.</p>
      </div>
    {:else}
      <AccesoTitulo titulo="Revisa tu correo">
        Escribe el correo con el que creaste la cuenta y te enviamos otro enlace de confirmación.
      </AccesoTitulo>

      <form class="confirmar__form" onsubmit={resendTyped} novalidate>
        <Field label="Correo" type="email" name="email" autocomplete="email" bind:value={typedEmail} required />
        <Button type="submit" size="form" block loading={sending} disabled={secondsLeft > 0}>Enviar enlace</Button>
        {#if secondsLeft > 0}<p class="confirmar__espera">Podrás pedir otro en {format(secondsLeft)}.</p>{/if}
      </form>
    {/if}

    {#if notice}
      <Notice tone={notice.tone}>{notice.text}</Notice>
    {/if}

    {#snippet actions()}
      <a class="confirmar__otro" href="/auth/registro">Usar otro correo</a>
    {/snippet}
  </FormPanel>
</AccesoPagina>

<style>
  .confirmar__acciones,
  .confirmar__form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .confirmar__espera,
  .confirmar__ayuda {
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
  }
  .confirmar__espera { color: var(--color-texto-medio); }

  .confirmar__otro {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }
  .confirmar__otro:hover { color: var(--color-acento); }
</style>
