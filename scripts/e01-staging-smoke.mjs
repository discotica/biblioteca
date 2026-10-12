import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const projectRef = process.env.E01_STAGING_PROJECT_REF ?? 'hgocyrzhgohetfpzbmfs';
const emailDeliveryProbe = process.env.E01_AUTH_EMAIL_DELIVERY_PROBE === '1';
const supabaseUrl = `https://${projectRef}.supabase.co`;
const bucket = 'contribution-covers';
const suffix = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.slice(-14);
const originalPassword = `E01-${randomBytes(18).toString('base64url')}aA1!`;
const recoveredPassword = `E01-${randomBytes(18).toString('base64url')}bB2!`;
const createdUserIds = [];
const createdContributionIds = [];
const createdCrateIds = [];
const objectPaths = new Set();
const checks = [];
const diagnostics = [];
const cleanupErrors = [];

function record(name, ok, detail = undefined) {
  checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) });
  return ok;
}

function diagnose(name, detail = undefined) {
  diagnostics.push({ name, ...(detail === undefined ? {} : { detail }) });
}

function requireValue(value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function requireNoError(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.code ?? result.error.status ?? 'error'} ${result.error.message}`);
  }
  return result.data;
}

function newClient(key) {
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function loadApiKeys() {
  const raw = execFileSync(
    'npx',
    [
      '--no-install',
      'supabase',
      'projects',
      'api-keys',
      '--project-ref',
      projectRef,
      '--reveal',
      '--output',
      'json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const keys = JSON.parse(raw);
  return {
    publishable: requireValue(keys.find((item) => item.type === 'publishable')?.api_key, 'publishable key'),
    anon: requireValue(keys.find((item) => item.name === 'anon')?.api_key, 'legacy anon key'),
    service: requireValue(
      keys.find((item) => item.type === 'secret')?.api_key
        ?? keys.find((item) => item.name === 'service_role')?.api_key,
      'secret/service key',
    ),
  };
}

async function rawUsernameLogin(key, username, password) {
  const response = await fetch(`${supabaseUrl}/functions/v1/login-with-username`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return {
    status: response.status,
    error: typeof body.error === 'string' ? body.error : null,
    hasSessionTokens: typeof body.access_token === 'string' && typeof body.refresh_token === 'string',
  };
}

async function rawRecoveryRequest(key, email) {
  const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ email, gotrue_meta_security: {} }),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return {
    status: response.status,
    code: typeof body.code === 'string' ? body.code : null,
    message: typeof body.msg === 'string' ? body.msg : typeof body.message === 'string' ? body.message : null,
  };
}

async function createConfirmedUser(admin, email, username, role = 'comunidad') {
  const data = requireNoError(
    await admin.auth.admin.createUser({
      email,
      password: originalPassword,
      email_confirm: true,
      user_metadata: { username, display_name: `E01 ${role}`, newsletter_opt_in: false },
    }),
    `create ${role} user`,
  );
  const userId = requireValue(data.user?.id, `${role} user id`);
  createdUserIds.push(userId);
  if (role !== 'comunidad') {
    requireNoError(
      await admin.from('profiles').update({ role }).eq('id', userId).select('id,role').single(),
      `assign ${role} role`,
    );
  }
  const client = newClient(keys.publishable);
  requireNoError(
    await client.auth.signInWithPassword({ email, password: originalPassword }),
    `sign in ${role}`,
  );
  return { id: userId, email, username, client };
}

let keys;
let admin;
let fatalError = null;

try {
  keys = loadApiKeys();
  admin = newClient(keys.service);
  const anonymous = newClient(keys.publishable);

  const authorEmail = `e01-author-${suffix}@example.com`;
  const authorUsername = `e01_author_${suffix}`.slice(0, 30);
  const signup = requireNoError(
    await admin.auth.admin.generateLink({
      type: 'signup',
      email: authorEmail,
      password: originalPassword,
      options: {
        data: {
          username: authorUsername,
          display_name: 'E01 author',
          newsletter_opt_in: false,
        },
        redirectTo: 'http://127.0.0.1:4173/auth/reset?flow=signup',
      },
    }),
    'generate signup link',
  );
  const authorId = requireValue(signup.user?.id, 'signup user id');
  createdUserIds.push(authorId);
  const signupToken = requireValue(signup.properties?.hashed_token, 'signup token hash');

  const beforeConfirmation = await newClient(keys.publishable).auth.signInWithPassword({
    email: authorEmail,
    password: originalPassword,
  });
  record('auth_unconfirmed_login_denied', Boolean(beforeConfirmation.error));

  const author = newClient(keys.publishable);
  const confirmation = await author.auth.verifyOtp({ type: 'signup', token_hash: signupToken });
  record('auth_signup_confirmation', !confirmation.error && Boolean(confirmation.data.session));
  requireNoError(confirmation, 'confirm signup');

  const profile = requireNoError(
    await admin.from('profiles').select('id,username,role').eq('id', authorId).single(),
    'read author profile',
  );
  record(
    'auth_signup_profile_trigger',
    profile.username === authorUsername && profile.role === 'comunidad',
  );

  requireNoError(
    await author.auth.signInWithPassword({ email: authorEmail, password: originalPassword }),
    'email/password login',
  );
  record('auth_email_password_login', true);

  const recovery = requireNoError(
    await admin.auth.admin.generateLink({
      type: 'recovery',
      email: authorEmail,
      options: { redirectTo: 'http://127.0.0.1:4173/auth/reset?flow=recovery' },
    }),
    'generate recovery link',
  );
  const recoveryToken = requireValue(recovery.properties?.hashed_token, 'recovery token hash');
  const recoveryClient = newClient(keys.publishable);
  const recoverySession = await recoveryClient.auth.verifyOtp({ type: 'recovery', token_hash: recoveryToken });
  record('auth_recovery_link_session', !recoverySession.error && Boolean(recoverySession.data.session));
  requireNoError(recoverySession, 'verify recovery link');
  requireNoError(await recoveryClient.auth.updateUser({ password: recoveredPassword }), 'update recovered password');
  const oldPasswordLogin = await newClient(keys.publishable).auth.signInWithPassword({
    email: authorEmail,
    password: originalPassword,
  });
  record('auth_recovery_old_password_denied', Boolean(oldPasswordLogin.error));
  const recoveredAuthor = newClient(keys.publishable);
  requireNoError(
    await recoveredAuthor.auth.signInWithPassword({ email: authorEmail, password: recoveredPassword }),
    'login with recovered password',
  );
  record('auth_recovery_new_password_login', true);

  const usernameSuccess = await rawUsernameLogin(keys.publishable, authorUsername, recoveredPassword);
  const usernameWrong = await rawUsernameLogin(keys.publishable, authorUsername, `${recoveredPassword}wrong`);
  const usernameMissing = await rawUsernameLogin(keys.publishable, `missing_${suffix}`.slice(0, 30), recoveredPassword);
  record(
    'auth_username_login_publishable_key',
    usernameSuccess.status === 200 && usernameSuccess.hasSessionTokens,
    { status: usernameSuccess.status, error: usernameSuccess.error },
  );
  record(
    'auth_username_login_non_enumerative',
    usernameWrong.status === usernameMissing.status
      && usernameWrong.error === usernameMissing.error
      && !usernameWrong.hasSessionTokens
      && !usernameMissing.hasSessionTokens,
    {
      wrong: { status: usernameWrong.status, error: usernameWrong.error },
      missing: { status: usernameMissing.status, error: usernameMissing.error },
    },
  );
  if (usernameSuccess.status !== 200) {
    const legacySuccess = await rawUsernameLogin(keys.anon, authorUsername, recoveredPassword);
    record(
      'auth_username_login_legacy_diagnostic',
      legacySuccess.status === 200 && legacySuccess.hasSessionTokens,
      { status: legacySuccess.status, error: legacySuccess.error },
    );
  }

  if (emailDeliveryProbe) {
    const existingRecovery = await rawRecoveryRequest(keys.publishable, authorEmail);
    const missingRecovery = await rawRecoveryRequest(
      keys.publishable,
      `e01-missing-${suffix}@example.com`,
    );
    diagnose('auth_recovery_delivery_endpoint', {
      nonEnumerative: existingRecovery.status === missingRecovery.status
        && existingRecovery.code === missingRecovery.code
        && existingRecovery.message === missingRecovery.message,
      existing: existingRecovery,
      missing: missingRecovery,
    });

    const probeEmail = `e01-signup-${suffix}@example.com`;
    const probeUsername = `e01_signup_${suffix}`.slice(0, 30);
    const publicSignup = await newClient(keys.publishable).auth.signUp({
      email: probeEmail,
      password: originalPassword,
      options: {
        data: { username: probeUsername, display_name: 'E01 signup probe' },
        emailRedirectTo: 'http://127.0.0.1:4173/auth/reset?flow=signup',
      },
    });
    if (publicSignup.data.user?.id) createdUserIds.push(publicSignup.data.user.id);
    diagnose(
      'auth_public_signup_delivery_endpoint',
      publicSignup.error
        ? { code: publicSignup.error.code ?? null, status: publicSignup.error.status ?? null }
        : { confirmationRequired: !publicSignup.data.session },
    );
  } else {
    diagnose('auth_email_delivery_probe_skipped', {
      reason: 'requires a team-authorized recipient or custom SMTP; token flows are tested without sending email',
    });
  }

  const outsider = await createConfirmedUser(
    admin,
    `e01-outsider-${suffix}@example.com`,
    `e01_out_${suffix}`.slice(0, 30),
  );
  const collaborator = await createConfirmedUser(
    admin,
    `e01-collab-${suffix}@example.com`,
    `e01_col_${suffix}`.slice(0, 30),
    'colaborador',
  );
  const administrator = await createConfirmedUser(
    admin,
    `e01-admin-${suffix}@example.com`,
    `e01_adm_${suffix}`.slice(0, 30),
    'admin',
  );
  record('auth_role_fixtures', true);

  const roleEscalation = await recoveredAuthor
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', authorId)
    .select('id');
  record('rls_profile_role_escalation_denied', Boolean(roleEscalation.error));
  const safeProfileUpdate = await recoveredAuthor
    .from('profiles')
    .update({ bio: `E01 ${suffix}` })
    .eq('id', authorId)
    .select('id,bio')
    .single();
  record('rls_profile_safe_update_allowed', !safeProfileUpdate.error);

  const release = requireNoError(
    await anonymous.from('releases').select('id,slug').eq('status', 'published').limit(1).single(),
    'read published release',
  );
  const privateCrate = requireNoError(
    await recoveredAuthor
      .from('crates')
      .insert({
        owner_id: authorId,
        name: `E01 ${suffix}`,
        slug: `e01-${suffix}`,
        is_public: false,
      })
      .select('id')
      .single(),
    'create private crate',
  );
  createdCrateIds.push(privateCrate.id);
  const outsiderPrivateRead = requireNoError(
    await outsider.client.from('crates').select('id').eq('id', privateCrate.id),
    'outsider private crate read',
  );
  record('rls_private_crate_hidden', outsiderPrivateRead.length === 0);
  requireNoError(
    await recoveredAuthor.from('crates').update({ is_public: true }).eq('id', privateCrate.id),
    'publish crate',
  );
  const outsiderPublicRead = requireNoError(
    await outsider.client.from('crates').select('id').eq('id', privateCrate.id),
    'outsider public crate read',
  );
  record('rls_public_crate_visible', outsiderPublicRead.length === 1);
  const crateItem = requireNoError(
    await recoveredAuthor
      .from('crate_items')
      .insert({ crate_id: privateCrate.id, release_id: release.id, lanzamiento_slug: release.slug })
      .select('id,release_id')
      .single(),
    'insert crate item by release id',
  );
  record('rls_crate_item_release_id_allowed', crateItem.release_id === release.id);
  const outsiderCrateInsert = await outsider.client
    .from('crate_items')
    .insert({ crate_id: privateCrate.id, release_id: release.id, lanzamiento_slug: release.slug });
  record('rls_foreign_crate_insert_denied', Boolean(outsiderCrateInsert.error));
  const outsiderCrateDelete = requireNoError(
    await outsider.client.from('crate_items').delete().eq('id', crateItem.id).select('id'),
    'outsider crate delete query',
  );
  record('rls_foreign_crate_delete_denied', outsiderCrateDelete.length === 0);

  const contribution = requireNoError(
    await recoveredAuthor
      .from('contributions')
      .insert({
        author_id: authorId,
        status: 'draft',
        source_url: `https://example.com/e01/${suffix}`,
        source_provider: 'e01',
        payload: { title: `E01 ${suffix}`, artists: ['E01 fixture'] },
      })
      .select('id,status')
      .single(),
    'create draft contribution',
  );
  createdContributionIds.push(contribution.id);
  const outsiderContributionRead = requireNoError(
    await outsider.client.from('contributions').select('id').eq('id', contribution.id),
    'outsider contribution read',
  );
  record('rls_foreign_contribution_hidden', outsiderContributionRead.length === 0);
  const collaboratorContributionRead = requireNoError(
    await collaborator.client.from('contributions').select('id').eq('id', contribution.id),
    'collaborator queue read',
  );
  record('rls_collaborator_queue_read', collaboratorContributionRead.length === 1);
  const privilegedColumnUpdate = await recoveredAuthor
    .from('contributions')
    .update({ reviewed_by: authorId })
    .eq('id', contribution.id);
  record('rls_contribution_privileged_column_denied', Boolean(privilegedColumnUpdate.error));

  const objectPath = `${authorId}/${contribution.id}/cover.png`;
  objectPaths.add(objectPath);
  const upload = await recoveredAuthor.storage
    .from(bucket)
    .upload(objectPath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
      contentType: 'image/png',
      upsert: false,
    });
  record('storage_author_upload_editable', !upload.error);
  const authorDownload = await recoveredAuthor.storage.from(bucket).download(objectPath);
  record('storage_author_read', !authorDownload.error && Boolean(authorDownload.data));
  const outsiderDownload = await outsider.client.storage.from(bucket).download(objectPath);
  record('storage_outsider_read_denied', Boolean(outsiderDownload.error));
  const editorDownload = await collaborator.client.storage.from(bucket).download(objectPath);
  record('storage_editor_read_allowed', !editorDownload.error && Boolean(editorDownload.data));

  const foreignDelete = await outsider.client.storage.from(bucket).remove([objectPath]);
  const afterForeignDelete = await recoveredAuthor.storage.from(bucket).download(objectPath);
  record(
    'storage_outsider_delete_denied',
    (Boolean(foreignDelete.error) || foreignDelete.data.length === 0) && !afterForeignDelete.error,
  );

  const deepPath = `${authorId}/${contribution.id}/nested/cover.png`;
  const deepUpload = await recoveredAuthor.storage
    .from(bucket)
    .upload(deepPath, new Uint8Array([1]), { contentType: 'image/png' });
  if (!deepUpload.error) objectPaths.add(deepPath);
  record('storage_deep_path_denied', Boolean(deepUpload.error));

  requireNoError(
    await recoveredAuthor
      .from('contributions')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', contribution.id)
      .select('id,status')
      .single(),
    'submit contribution',
  );
  const pendingPath = `${authorId}/${contribution.id}/pending.png`;
  const pendingUpload = await recoveredAuthor.storage
    .from(bucket)
    .upload(pendingPath, new Uint8Array([1]), { contentType: 'image/png' });
  if (!pendingUpload.error) objectPaths.add(pendingPath);
  record('storage_pending_upload_denied', Boolean(pendingUpload.error));
  const pendingDelete = await recoveredAuthor.storage.from(bucket).remove([objectPath]);
  const afterPendingDelete = await recoveredAuthor.storage.from(bucket).download(objectPath);
  record(
    'storage_pending_delete_denied',
    (Boolean(pendingDelete.error) || pendingDelete.data.length === 0) && !afterPendingDelete.error,
  );

  const collaboratorReview = await collaborator.client.rpc('review_contribution', {
    p_contribution_id: contribution.id,
    p_action: 'changes_requested',
    p_note: 'E01 collaborator must be denied',
  });
  record(
    'roles_collaborator_review_denied',
    collaboratorReview.error?.code === '42501',
    { code: collaboratorReview.error?.code ?? null },
  );
  const adminReview = await administrator.client.rpc('review_contribution', {
    p_contribution_id: contribution.id,
    p_action: 'changes_requested',
    p_note: 'E01 admin test',
  });
  record(
    'roles_admin_review_allowed',
    !adminReview.error && adminReview.data?.status === 'changes_requested',
  );
  const editableDelete = await recoveredAuthor.storage.from(bucket).remove([objectPath]);
  const afterEditableDelete = await recoveredAuthor.storage.from(bucket).download(objectPath);
  const afterEditableList = await admin.storage
    .from(bucket)
    .list(`${authorId}/${contribution.id}`, { search: 'cover.png' });
  record(
    'storage_author_delete_editable',
    !editableDelete.error
      && editableDelete.data.length === 1
      && !afterEditableList.error
      && afterEditableList.data.length === 0,
    {
      removeError: editableDelete.error?.message ?? null,
      removedCount: editableDelete.data?.length ?? 0,
      downloadAfterDeleteCached: !afterEditableDelete.error,
      listError: afterEditableList.error?.message ?? null,
      remainingCount: afterEditableList.data?.length ?? null,
    },
  );
  if (!editableDelete.error) objectPaths.delete(objectPath);
} catch (error) {
  fatalError = error instanceof Error ? error.message : String(error);
} finally {
  if (admin) {
    if (objectPaths.size > 0) {
      const cleanup = await admin.storage.from(bucket).remove([...objectPaths]);
      if (cleanup.error) cleanupErrors.push(`storage: ${cleanup.error.message}`);
    }
    for (const crateId of createdCrateIds) {
      const cleanup = await admin.from('crates').delete().eq('id', crateId);
      if (cleanup.error) cleanupErrors.push(`crate: ${cleanup.error.message}`);
    }
    for (const contributionId of createdContributionIds) {
      const cleanup = await admin.from('contributions').delete().eq('id', contributionId);
      if (cleanup.error) cleanupErrors.push(`contribution: ${cleanup.error.message}`);
    }
    for (const userId of [...new Set(createdUserIds)].reverse()) {
      const cleanup = await admin.auth.admin.deleteUser(userId);
      if (cleanup.error && cleanup.error.status !== 404) {
        cleanupErrors.push(`auth user: ${cleanup.error.message}`);
      }
    }
  }
}

const failedChecks = checks.filter((check) => !check.ok);
const summary = {
  projectRef,
  generatedAt: new Date().toISOString(),
  checks,
  diagnostics,
  cleanup: {
    usersAttempted: new Set(createdUserIds).size,
    objectsAttempted: objectPaths.size,
    errors: cleanupErrors,
  },
  fatalError,
};
console.log(JSON.stringify(summary, null, 2));

if (fatalError || failedChecks.length > 0 || cleanupErrors.length > 0) {
  process.exitCode = 1;
}
