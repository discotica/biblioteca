import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_TIMEOUT_MS = 12_000;

export function providerForUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes('bandcamp')) return 'bandcamp';
    if (host.includes('soundcloud')) return 'soundcloud';
    if (host.includes('spotify')) return 'spotify';
    return host || 'unknown';
  } catch {
    return 'invalid';
  }
}

export function mediaCandidates(releases) {
  return releases.flatMap((release, index) => ['buy_link', 'cover'].flatMap((field) => {
    const url = String(release?.[field] ?? '').trim();
    if (!/^https?:\/\//i.test(url)) return [];
    return [{ index, field, provider: providerForUrl(url), url }];
  }));
}

export function summarize(results) {
  const byProvider = {};
  for (const result of results) {
    const provider = byProvider[result.provider] ??= { total: 0, healthy: 0, failed: 0 };
    provider.total += 1;
    if (result.ok) provider.healthy += 1;
    else provider.failed += 1;
  }
  return {
    checkedAt: new Date().toISOString(),
    total: results.length,
    healthy: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    byProvider,
    results
  };
}

async function probe(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const request = (method, headers = {}) => fetch(url, {
    method, headers, redirect: 'follow', signal: controller.signal
  });
  try {
    let response = await request('HEAD');
    if ([405, 403, 501].includes(response.status)) {
      response = await request('GET', { Range: 'bytes=0-0' });
    }
    return { ok: response.ok, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { ok: false, status: null, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf('--source');
  const source = sourceIndex >= 0 ? args[sourceIndex + 1] : 'static/lanzamientos.json';
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;
  const raw = await readFile(source, 'utf8');
  const candidates = mediaCandidates(JSON.parse(raw)).slice(0, Number.isFinite(limit) ? limit : Infinity);
  const results = await mapWithConcurrency(candidates, 12, async (candidate) => ({
    ...candidate,
    ...(await probe(candidate.url, DEFAULT_TIMEOUT_MS))
  }));
  const report = { source, ...summarize(results) };
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (args.includes('--strict') && report.failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
