<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import { confirmationRedirect, readPendingSignup, writePendingSignup } from '$lib/components/account/pendingSignup';
  import { Button, Field, Notice } from '$lib/ui';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { RESEND_COOLDOWN_SECONDS, retryAfterSeconds, webmailFor } from '$lib/domain/account';

  // Correo de la cuenta recién creada. Sin él (otra pestaña, enlace vencido),
  // la pantalla lo pide para reenviar.
  let email = $state('');
  let typedEmail = $state('');
  let sentAt = $state(0);
  let now = $state(Date.now());
  let sending = $state(false);
  let notice = $state<{ tone: 'success' | 'error'; text: string } | null>(null);
  let cooldownUntil = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  const webmail = $derived(email ? webmailFor(email) : null);
  const secondsLeft = $derived(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));

  function startCooldown(seconds: number) {
    cooldownUntil = Date.now() + seconds * 1000;
    now = Date.now();
  }

  onMount(() => {
    const fromNavigation = ($page.state as { email?: string }).email;
    const pending = readPendingSignup();
    email = fromNavigation ?? pending?.email ?? '';
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
    writePendingSignup({ email: target, sentAt: Date.now() });
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

<AccountLayout
  title="Revisa tu correo"
  help={email ? undefined : 'Escribe el correo con el que creaste la cuenta y te enviamos otro enlace de confirmación.'}
>
  {#if email}
    <div class="check-email">
      <p class="check-email__lead">
        Te enviamos un enlace para confirmar tu cuenta a
        <strong class="check-email__address">{email}</strong>
      </p>
      <p class="check-email__help">Ábrelo desde este dispositivo o desde otro. Si no lo ves en unos minutos, busca en spam o en promociones.</p>

      <div class="check-email__actions">
        {#if webmail}
          <Button href={webmail.url} target="_blank" rel="noopener" iconEnd="flecha-externa" block>Abrir {webmail.label}<span class="sr-only"> (se abre en otra pestaña)</span></Button>
        {/if}
        <Button
          variant="secondary"
          block
          loading={sending}
          disabled={secondsLeft > 0}
          onclick={() => resend(email)}
          aria-describedby={secondsLeft > 0 ? 'resend-wait' : undefined}
        >
          Reenviar correo
        </Button>
        {#if secondsLeft > 0}
          <p class="check-email__wait" id="resend-wait">Podrás reenviarlo en {format(secondsLeft)}.</p>
        {/if}
      </div>
    </div>
  {:else}
    <form class="account-form" onsubmit={resendTyped} novalidate>
      <Field label="Correo" type="email" name="email" autocomplete="email" bind:value={typedEmail} required />
      <Button type="submit" block loading={sending} disabled={secondsLeft > 0}>Enviar enlace</Button>
      {#if secondsLeft > 0}<p class="check-email__wait">Podrás pedir otro en {format(secondsLeft)}.</p>{/if}
    </form>
  {/if}

  {#if notice}
    <Notice tone={notice.tone} class="check-email__notice">{notice.text}</Notice>
  {/if}

  {#snippet footer()}
    <a href="/auth/registro">Usar otro correo</a>
    <span aria-hidden="true">·</span>
    <a href="/auth/login">Entrar</a>
  {/snippet}
</AccountLayout>

<style>
  .check-email__lead {
    margin: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-md);
    line-height: 1.55;
  }
  .check-email__address {
    display: block;
    margin-top: var(--space-1);
    color: var(--color-texto);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .check-email__help {
    margin: var(--space-3) 0 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.55;
  }
  .check-email__actions,
  .account-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .check-email__actions { margin-top: var(--space-6); }
  .check-email__wait {
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
    text-align: center;
  }
  :global(.check-email__notice) { margin-top: var(--space-5); }
</style>
