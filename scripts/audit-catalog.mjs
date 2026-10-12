import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const source = process.argv[2] ?? 'static/lanzamientos.json';
const raw = await readFile(source);
const releases = JSON.parse(raw);

if (!Array.isArray(releases)) {
  throw new Error(`${source} debe contener un arreglo JSON.`);
}

const requiredFields = [
  'artist',
  'title',
  'type',
  'country',
  'genre',
  'label',
  'release_date',
  'buy_link',
  'review',
  'radar',
  'cover'
];
const radarFields = ['experimental', 'denso', 'sintetico', 'bailable', 'rapido'];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function urlStatus(value) {
  if (isBlank(value)) return 'missing';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

function host(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function textList(value) {
  return Array.isArray(value) ? value : String(value ?? '').split(',');
}

function identity(release) {
  return [
    textList(release.artist).map((value) => value.trim().toLocaleLowerCase()).join('|'),
    String(release.title ?? '').trim().toLocaleLowerCase(),
    String(release.release_date ?? '').trim()
  ].join('::');
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1);
}

const missing = Object.fromEntries(
  requiredFields.map((field) => [field, releases.filter((release) => isBlank(release[field])).length])
);
const urls = Object.fromEntries(
  ['buy_link', 'cover'].map((field) => {
    const values = releases.map((release) => release[field]);
    const hosts = new Map();
    for (const value of values) {
      const valueHost = host(value);
      if (valueHost) hosts.set(valueHost, (hosts.get(valueHost) ?? 0) + 1);
    }
    return [field, {
      valid: values.filter((value) => urlStatus(value) === 'valid').length,
      invalid: values.filter((value) => urlStatus(value) === 'invalid').length,
      missing: values.filter((value) => urlStatus(value) === 'missing').length,
      topHosts: [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    }];
  })
);
const invalidRadar = releases.filter((release) =>
  !release.radar || radarFields.some((field) => {
    const value = Number(release.radar[field]);
    return !Number.isInteger(value) || value < 0 || value > 5;
  })
).length;

const report = {
  source,
  sha256: createHash('sha256').update(raw).digest('hex'),
  records: releases.length,
  missing,
  urls,
  invalidRadar,
  duplicateCandidateKeys: duplicates(releases.map(identity)).length
};

console.log(JSON.stringify(report, null, 2));
