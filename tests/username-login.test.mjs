import assert from "node:assert/strict";
import test from "node:test";
import { clientIp, FAILURE_FLOOR_MS, hashClientIp, waitForFloor } from "../supabase/functions/_shared/username-login.ts";

test("clientIp prefiere la IP que pone la plataforma y cae al primer x-forwarded-for", () => {
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": " 203.0.113.8 " })), "203.0.113.8");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })), "198.51.100.1");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": " , " })), "unknown");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("hashClientIp es un HMAC hexadecimal de 64 caracteres que depende de la clave", async () => {
  const a = await hashClientIp("203.0.113.7", "clave-a");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(await hashClientIp("203.0.113.7", "clave-a"), a);
  assert.notEqual(await hashClientIp("203.0.113.7", "clave-b"), a);
  assert.notEqual(await hashClientIp("203.0.113.8", "clave-a"), a);
  assert.ok(!a.includes("203"));
});

test("waitForFloor completa el tiempo mínimo y no espera si ya pasó", async () => {
  const startedAt = performance.now();
  await waitForFloor(startedAt, 60);
  assert.ok(performance.now() - startedAt >= 60);

  const late = performance.now();
  await waitForFloor(late - FAILURE_FLOOR_MS - 1);
  assert.ok(performance.now() - late < 20);
});
