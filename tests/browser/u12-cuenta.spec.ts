import { expect, test, type Page, type Request, type Route } from '@playwright/test';

// U12 — Cuenta: entrar con usuario o correo, registro, "Revisa tu correo",
// aterrizaje tras confirmar y editar cuenta. Supabase está simulado.
const project = 'hgocyrzhgohetfpzbmfs';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function sessionFixture() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const user = {
    id: userId, aud: 'authenticated', role: 'authenticated', email: 'persona@gmail.com',
    app_metadata: {}, user_metadata: { username: 'persona' }, created_at: '2026-10-01T00:00:00Z'
  };
  return {
    access_token: `${header}.${payload}.signature`, refresh_token: 'u12-refresh', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
  };
}

async function signedIn(page: Page) {
  const session = sessionFixture();
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);
  return session;
}

type AuthMock = {
  /** Respuesta de la función login-with-username. */
  usernameLogin?: (body: { username: string; password: string }) => { status: number; body: unknown };
  /** Respuesta de /token?grant_type=password. */
  emailLogin?: (body: { email: string; password: string }) => { status: number; body: unknown };
  signup?: (body: Record<string, unknown>) => { status: number; body: unknown };
  updateUser?: (body: Record<string, unknown>) => { status: number; body: unknown };
  /** Respuesta de POST /verify (enlaces con token_hash). Por defecto, una sesión nueva. */
  verify?: (body: Record<string, unknown>) => { status: number; body: unknown };
  profile?: Record<string, unknown>;
};

async function mockSupabase(page: Page, mock: AuthMock = {}) {
  const requests: Request[] = [];
  const session = sessionFixture();
  await page.route(`https://${project}.supabase.co/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(request);
    const body = () => (request.postDataJSON() ?? {}) as Record<string, any>;

    if (url.pathname === '/functions/v1/login-with-username') {
      const result = mock.usernameLogin?.(body() as any) ?? { status: 401, body: { error: 'Invalid credentials' } };
      return json(route, result.body, result.status);
    }
    if (url.pathname === '/auth/v1/token') {
      const result = mock.emailLogin?.(body() as any) ?? { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
      return json(route, result.body, result.status);
    }
    if (url.pathname === '/auth/v1/signup') {
      const result = mock.signup?.(body()) ?? {
        status: 200,
        body: { id: 'nuevo', aud: 'authenticated', email: body().email, identities: [{}], created_at: '2026-10-09T00:00:00Z' }
      };
      return json(route, result.body, result.status);
    }
    if (url.pathname === '/auth/v1/resend') return json(route, {});
    if (url.pathname === '/auth/v1/verify' && request.method() === 'POST') {
      const result = mock.verify?.(body()) ?? { status: 200, body: session };
      return json(route, result.body, result.status);
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') {
        const result = mock.updateUser?.(body()) ?? { status: 200, body: session.user };
        return json(route, result.body, result.status);
      }
      return json(route, session.user);
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/profiles') {
      const accept = request.headers().accept ?? '';
      if (url.searchParams.get('select') === 'id' && url.searchParams.get('username')) {
        return json(route, url.searchParams.get('username') === 'eq.tomado' ? { id: 'otro' } : null, 200);
      }
      const profile = {
        id: userId, username: 'persona', display_name: 'Persona', bio: null, created_at: '2026-10-01T00:00:00Z',
        newsletter_opt_in: false, social_bandcamp: null, social_bandcamp_kind: null, social_soundcloud: null,
        social_instagram: null, social_x: null, social_facebook: null, show_accepted_contributions: false,
        ...mock.profile
      };
      if (request.method() === 'PATCH') return json(route, { ...profile, ...body() });
      return json(route, accept.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    return json(route, []);
  });
  const calls = (path: string) => requests.filter((r) => new URL(r.url()).pathname === path);
  return { calls, session };
}

async function fillLogin(page: Page, identifier: string, password = 'una-contraseña') {
  await page.getByLabel('Usuario o correo').fill(identifier);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('U12 entrar', () => {
  test('con usuario usa login-with-username; con correo, Supabase Auth', async ({ page }) => {
    const session = sessionFixture();
    const tokens = { access_token: session.access_token, refresh_token: session.refresh_token };
    const { calls } = await mockSupabase(page, {
      usernameLogin: () => ({ status: 200, body: tokens }),
      emailLogin: () => ({ status: 200, body: session })
    });

    await page.goto('/auth/login?redirect=/mis-colecciones');
    await fillLogin(page, '  Persona ');
    await page.waitForURL('**/mis-colecciones');
    expect(calls('/functions/v1/login-with-username')[0].postDataJSON()).toEqual({ username: 'persona', password: 'una-contraseña' });
    expect(calls('/auth/v1/token').filter((r) => r.url().includes('grant_type=password'))).toHaveLength(0);

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth/login');
    await fillLogin(page, 'Persona@Gmail.com');
    await page.waitForURL('**/mis-colecciones');
    const passwordGrant = calls('/auth/v1/token').filter((r) => r.url().includes('grant_type=password'));
    expect(passwordGrant).toHaveLength(1);
    expect(passwordGrant[0].postDataJSON()).toMatchObject({ email: 'persona@gmail.com', password: 'una-contraseña' });
    expect(calls('/functions/v1/login-with-username')).toHaveLength(1);
  });

  test('el error es el mismo para usuario, correo, cuenta sin confirmar y formato imposible', async ({ page }) => {
    let emailCase = 'invalid_credentials';
    await mockSupabase(page, {
      emailLogin: () =>
        emailCase === 'invalid_credentials'
          ? { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }
          : { status: 400, body: { error_code: 'email_not_confirmed', msg: 'Email not confirmed' } }
    });
    await page.goto('/auth/login');
    const alert = page.getByRole('alert');

    await fillLogin(page, 'no_existe');
    await expect(alert).toBeVisible();
    const usernameText = await alert.textContent();

    await fillLogin(page, 'no-existe@example.com');
    await expect(alert).toHaveText(usernameText!);

    emailCase = 'email_not_confirmed';
    await fillLogin(page, 'sin-confirmar@example.com');
    await expect(alert).toHaveText(usernameText!);

    await fillLogin(page, 'x');
    await expect(alert).toHaveText(usernameText!);
    expect(usernameText).toContain('No pudimos entrar con esos datos');
    expect(usernameText).not.toMatch(/no existe|no está registrad|confirm/i);
  });

  test('el límite de intentos se dice sin hablar de la cuenta', async ({ page }) => {
    await mockSupabase(page, { emailLogin: () => ({ status: 429, body: { error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' } }) });
    await page.goto('/auth/login');
    await fillLogin(page, 'persona@example.com');
    await expect(page.getByRole('alert')).toHaveText(/Demasiados intentos seguidos/);
  });

  test('el límite propio de login-with-username (429) se dice igual que el de Auth', async ({ page }) => {
    await mockSupabase(page, { usernameLogin: () => ({ status: 429, body: { error: 'Too many attempts' } }) });
    await page.goto('/auth/login');
    await fillLogin(page, 'persona');
    await expect(page.getByRole('alert')).toHaveText(/Demasiados intentos seguidos/);
  });

  test('desktop en dos columnas con beneficios a la izquierda; móvil, primero el formulario', async ({ page }) => {
    await mockSupabase(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/auth/login');
    const benefits = page.locator('.l-account__aside');
    const form = page.locator('.l-account__main form');
    await expect(benefits.getByRole('listitem')).toHaveCount(3);
    let a = (await benefits.boundingBox())!;
    let f = (await form.boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(f.x);

    for (const width of [390, 834]) {
      await page.setViewportSize({ width, height: 900 });
      a = (await benefits.boundingBox())!;
      f = (await form.boundingBox())!;
      if (width === 390) expect(f.y + f.height).toBeLessThan(a.y);
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(inner);
    }
  });
});

test.describe('U12 registro', () => {
  test('contraseña débil bloquea el alta; fuerte la permite, con redes y aterrizaje en "Revisa tu correo"', async ({ page }) => {
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/registro');

    await page.getByLabel('Correo', { exact: true }).fill('Nueva@Gmail.com');
    const password = page.getByLabel('Contraseña', { exact: true });
    await password.fill('corta1');
    await expect(page.getByText('Fortaleza: Débil')).toBeVisible();
    await page.getByLabel('Repite la contraseña').fill('corta1');
    await page.getByLabel('Usuario').fill('nueva_persona');
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('La contraseña necesita 8 caracteres o más.')).toBeVisible();
    await expect(password).toBeFocused();
    expect(calls('/auth/v1/signup')).toHaveLength(0);

    await password.fill('Una-Frase-Larga-2026');
    await expect(page.getByText('Fortaleza: Fuerte')).toBeVisible();
    await page.getByLabel('Repite la contraseña').fill('Una-Frase-Larga-2026');
    await page.getByLabel('Instagram').fill('@Nueva.Persona');
    await page.getByLabel('Bandcamp').fill('https://nueva-artista.bandcamp.com/album/disco');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await page.waitForURL('**/auth/confirmar');
    const signup = calls('/auth/v1/signup')[0];
    expect(new URL(signup.url()).searchParams.get('redirect_to')).toMatch(/\/auth\/reset$/);
    expect(signup.postDataJSON()).toMatchObject({
      email: 'Nueva@Gmail.com',
      data: {
        username: 'nueva_persona', display_name: 'nueva_persona', newsletter_opt_in: false,
        social_instagram: 'nueva.persona', social_bandcamp: 'nueva-artista', social_bandcamp_kind: 'artist'
      }
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible();
    await expect(page.getByText('Nueva@Gmail.com')).toBeVisible();
    await expect(page.getByRole('link', { name: /Abrir Gmail/ })).toHaveAttribute('href', 'https://mail.google.com/mail/');
  });

  test('una red inválida o la privacidad sin aceptar no envían nada y marcan el campo', async ({ page }) => {
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/registro');
    await page.getByLabel('Correo', { exact: true }).fill('nueva@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('una-contraseña');
    await page.getByLabel('Repite la contraseña').fill('una-contraseña');
    await page.getByLabel('Usuario').fill('nueva_persona');
    await page.getByLabel('Facebook').fill('abc');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText(/El usuario de Facebook no es válido/)).toBeVisible();
    await expect(page.getByText('Para crear la cuenta tienes que aceptar la política de privacidad.')).toBeVisible();
    expect(calls('/auth/v1/signup')).toHaveLength(0);
  });

  test('un correo ya registrado lleva a la misma pantalla que uno nuevo', async ({ page }) => {
    await mockSupabase(page, { signup: () => ({ status: 422, body: { error_code: 'user_already_exists', msg: 'User already registered' } }) });
    await page.goto('/auth/registro');
    await page.getByLabel('Correo', { exact: true }).fill('existe@yahoo.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('una-contraseña');
    await page.getByLabel('Repite la contraseña').fill('una-contraseña');
    await page.getByLabel('Usuario').fill('otra_persona');
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL('**/auth/confirmar');
    await expect(page.getByText('existe@yahoo.com')).toBeVisible();
    // Yahoo no está entre los webmails con enlace.
    await expect(page.getByRole('link', { name: /Abrir/ })).toHaveCount(0);
  });
});

test.describe('U12 revisa tu correo', () => {
  test('reenviar espera entre envíos y no revela si la cuenta existe', async ({ page }) => {
    await page.clock.install();
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/registro');
    await page.getByLabel('Correo', { exact: true }).fill('nueva@icloud.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('una-contraseña');
    await page.getByLabel('Repite la contraseña').fill('una-contraseña');
    await page.getByLabel('Usuario').fill('nueva_persona');
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL('**/auth/confirmar');

    const resend = page.getByRole('button', { name: 'Reenviar correo' });
    await expect(page.getByRole('link', { name: /Abrir iCloud Mail/ })).toBeVisible();
    await expect(resend).toBeDisabled();
    await expect(page.getByText('Podrás reenviarlo en 1:00')).toBeVisible();

    await page.clock.fastForward(61_000);
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(page.getByRole('status')).toHaveText(/Si hay una cuenta pendiente de confirmar con ese correo/);
    expect(calls('/auth/v1/resend')[0].postDataJSON()).toMatchObject({ type: 'signup', email: 'nueva@icloud.com' });
    await expect(resend).toBeDisabled();

    // Recargar conserva el correo y la espera (sessionStorage), sin ponerlo en la URL.
    await page.reload();
    await expect(page.getByText('nueva@icloud.com')).toBeVisible();
    await expect(resend).toBeDisabled();
    expect(page.url()).not.toContain('icloud');
  });

  test('sin correo conocido, lo pide para reenviar', async ({ page }) => {
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/confirmar');
    await page.getByLabel('Correo', { exact: true }).fill('alguien@example.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('status')).toHaveText(/Si hay una cuenta pendiente/);
    expect(calls('/auth/v1/resend')).toHaveLength(1);
  });
});

test.describe('U12 enlaces del correo', () => {
  test('confirmar la cuenta aterriza en Mis colecciones con aviso, una sola vez', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page);
    await page.goto('/auth/reset?flow=signup');
    await page.waitForURL((url) => url.pathname === '/mis-colecciones');
    await expect(page.getByRole('status').filter({ hasText: 'Tu cuenta está confirmada' })).toBeVisible();
    expect(new URL(page.url()).searchParams.has('aviso')).toBe(false);
    await page.reload();
    await expect(page.getByText('Tu cuenta está confirmada')).toHaveCount(0);
  });

  test('abrir Mis colecciones con el aviso en la URL lo muestra y carga las colecciones', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page);
    await page.goto('/mis-colecciones?aviso=cuenta-confirmada');
    await expect(page.getByText('Tu cuenta está confirmada')).toBeVisible();
    await expect(page.getByText('Todavía no tienes colecciones.')).toBeVisible();
    await expect(page).toHaveURL(/\/mis-colecciones$/);
  });

  test('confirmar el cambio de correo vuelve a Editar cuenta con aviso', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page);
    await page.goto('/auth/reset?flow=email_change');
    await page.waitForURL((url) => url.pathname === '/cuenta');
    await expect(page.getByText(/Confirmamos el enlace/)).toBeVisible();
    await expect(page.getByLabel('Usuario')).toHaveValue('persona');
    await expect(page).toHaveURL(/\/cuenta$/);
  });

  // RC2-P0-01: los enlaces de las plantillas traen token_hash y se canjean aquí,
  // sin sesión previa ni code verifier (sirven abiertos en otro dispositivo).
  test('el enlace de confirmación (token_hash) canjea con verifyOtp y aterriza en Mis colecciones', async ({ page }) => {
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/reset?token_hash=hash-confirmar&type=email');
    await page.waitForURL((url) => url.pathname === '/mis-colecciones');
    await expect(page.getByRole('status').filter({ hasText: 'Tu cuenta está confirmada' })).toBeVisible();
    expect(calls('/auth/v1/verify').map((r) => r.postDataJSON())).toMatchObject([{ token_hash: 'hash-confirmar', type: 'email' }]);
    expect(calls('/auth/v1/token')).toHaveLength(0);
  });

  test('el enlace de recuperación (token_hash) abre el formulario, se quita de la URL y guarda la contraseña', async ({ page }) => {
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/reset?token_hash=hash-recuperar&type=recovery');
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva contraseña' })).toBeVisible();
    expect(calls('/auth/v1/verify').map((r) => r.postDataJSON())).toMatchObject([{ token_hash: 'hash-recuperar', type: 'recovery' }]);
    await expect(page).toHaveURL(/\/auth\/reset\?flow=recovery$/);
    await page.getByLabel('Contraseña nueva').fill('Una-Frase-Larga-2026');
    await page.getByLabel('Repite la contraseña').fill('Una-Frase-Larga-2026');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL((url) => url.pathname === '/mis-colecciones');
    expect(calls('/auth/v1/user').filter((r) => r.method() === 'PUT').map((r) => r.postDataJSON())).toMatchObject([{ password: 'Una-Frase-Larga-2026' }]);
  });

  test('un token_hash vencido o usado muestra "venció" y ofrece pedir otro', async ({ page }) => {
    await mockSupabase(page, { verify: () => ({ status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' } }) });
    await page.goto('/auth/reset?token_hash=hash-viejo&type=recovery');
    await expect(page.getByRole('heading', { level: 1, name: 'El enlace venció' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute('href', '/auth/recuperar');
    await expect(page).toHaveURL(/\/auth\/reset\?flow=recovery$/);
  });

  test('la primera de las dos confirmaciones de un cambio de correo avisa que falta la otra', async ({ page }) => {
    await mockSupabase(page, { verify: () => ({ status: 200, body: { msg: 'Confirmation link accepted. Please proceed to confirm link sent to the other email', code: 200 } }) });
    await page.goto('/auth/reset?token_hash=hash-cambio&type=email_change');
    await expect(page.getByRole('heading', { level: 1, name: 'Falta un paso' })).toBeVisible();
    await expect(page.getByText(/Abre también el enlace que llegó a la otra dirección/)).toBeVisible();
  });

  test('un enlace PKCE que el SDK ya canjeó no se vuelve a canjear', async ({ page }) => {
    await signedIn(page);
    const { calls } = await mockSupabase(page);
    await page.goto('/auth/reset?code=ya-canjeado&flow=signup');
    await page.waitForURL((url) => url.pathname === '/mis-colecciones');
    expect(calls('/auth/v1/verify')).toHaveLength(0);
  });

  test('un enlace de confirmación vencido ofrece pedir otro', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/auth/reset?flow=signup#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByRole('heading', { level: 1, name: 'El enlace de confirmación venció' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute('href', '/auth/confirmar');
  });
});

test.describe('U12 editar cuenta', () => {
  test('sin sesión lleva a Entrar', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/cuenta');
    await page.waitForURL('**/auth/login?redirect=/cuenta');
  });

  test('guarda perfil, redes y preferencia en una escritura del dueño', async ({ page }) => {
    await signedIn(page);
    const { calls } = await mockSupabase(page, {
      profile: { social_bandcamp: 'persona', social_bandcamp_kind: 'fan', social_instagram: 'persona.ig' }
    });
    await page.goto('/cuenta');
    await expect(page.getByLabel('Usuario')).toHaveValue('persona');
    await expect(page.getByLabel('Bandcamp')).toHaveValue('https://bandcamp.com/persona');
    await expect(page.getByLabel('Instagram')).toHaveValue('persona.ig');

    await page.getByLabel(/Nombre para mostrar/).fill('Persona Nueva');
    await page.getByLabel('Instagram').fill('');
    await page.getByLabel('SoundCloud').fill('https://soundcloud.com/Persona-SC');
    await page.getByLabel(/Quiero recibir novedades/).check();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Guardamos los cambios.')).toBeVisible();

    const patch = calls('/rest/v1/profiles').find((r) => r.method() === 'PATCH')!;
    expect(new URL(patch.url()).searchParams.get('id')).toBe(`eq.${userId}`);
    expect(patch.postDataJSON()).toEqual({
      display_name: 'Persona Nueva', bio: null, newsletter_opt_in: true,
      social_bandcamp: 'persona', social_bandcamp_kind: 'fan', social_soundcloud: 'persona-sc',
      social_instagram: null, social_x: null, social_facebook: null
    });
  });

  test('sin las columnas de D1 oculta las redes y guarda lo demás', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page);
    // Registrada después: Playwright prueba primero la última ruta.
    await page.route(`https://${project}.supabase.co/rest/v1/profiles**`, (route) => {
      const select = new URL(route.request().url()).searchParams.get('select') ?? '';
      if (select.includes('social_')) return json(route, { code: '42703', message: 'column profiles.social_bandcamp does not exist' }, 400);
      return route.fallback();
    });
    await page.goto('/cuenta');
    await expect(page.getByLabel(/Nombre para mostrar/)).toHaveValue('Persona');
    await expect(page.getByLabel('Instagram')).toHaveCount(0);
  });

  test('cambiar a un correo ya usado responde igual que a uno libre', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page, { updateUser: () => ({ status: 422, body: { error_code: 'email_exists', msg: 'A user with this email address has already been registered' } }) });
    await page.goto('/cuenta');
    await page.getByLabel('Correo nuevo').fill('otra@example.com');
    await page.getByRole('button', { name: 'Cambiar correo' }).click();
    await expect(page.getByText(/Te enviamos un enlace para confirmar el cambio/)).toBeVisible();
    await expect(page.getByText(/Cambio pendiente a/)).toBeVisible();
  });

  test('cambiar la contraseña exige 8 caracteres y que coincidan', async ({ page }) => {
    await signedIn(page);
    const { calls } = await mockSupabase(page);
    await page.goto('/cuenta');
    await page.getByLabel('Contraseña nueva').fill('corta');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText('La contraseña necesita 8 caracteres o más.')).toBeVisible();
    await page.getByLabel('Contraseña nueva').fill('una-contraseña-larga');
    await page.getByLabel('Repite la contraseña').fill('una-contraseña-larga');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText('Tu contraseña cambió.')).toBeVisible();
    expect(calls('/auth/v1/user').filter((r) => r.method() === 'PUT')[0].postDataJSON()).toMatchObject({ password: 'una-contraseña-larga' });
  });

  test('el menú de cuenta y el perfil propio enlazan a Editar cuenta', async ({ page }) => {
    await signedIn(page);
    await mockSupabase(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/perfil/persona');
    await expect(page.getByRole('link', { name: 'Editar cuenta' })).toHaveAttribute('href', '/cuenta');
    await page.locator('.account-menu .ui-menu__trigger').click();
    await expect(page.getByRole('menuitem', { name: 'Editar cuenta' })).toBeVisible();
  });
});
