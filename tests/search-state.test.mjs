import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSearchState,
  hasActiveRadar,
  parseSearchState,
  searchStateToCriteria,
  serializeSearchState
} from '../src/lib/domain/searchState.ts';

function query(state, unknown = '') {
  return serializeSearchState(state, unknown).toString();
}

test('URL canónica reconstruye texto Unicode, entidad tipada, filtros, Radar, página y modal', () => {
  const input = '?pais=Colombia&genero=Reggaetón&texto=Niño&entidad=%7B%22kind%22%3A%22artist%22%2C%22slug%22%3A%22julio-victoria%22%2C%22name%22%3A%22Julio+Victoria%22%7D&año=2026&type=EP&orden=radar&radar_denso=3&p=2&modal=mi-release&beta=1&nombre=Zo%C3%AB';
  const first = parseSearchState(input);
  assert.deepEqual(first.state, {
    text: ['Niño', { kind: 'artist', slug: 'julio-victoria', name: 'Julio Victoria' }],
    countries: ['Colombia'], genres: ['Reggaetón'], type: 'EP', year: '2026',
    radar: { experimental: 0, denso: 3, sintetico: 0, bailable: 0, rapido: 0 },
    order: 'radar', page: 2, modal: 'mi-release'
  });
  const second = parseSearchState(query(first.state, first.unknown));
  assert.deepEqual(second.state, first.state);
  assert.equal(second.unknown.toString(), 'beta=1&nombre=Zo%C3%AB');
});

test('normaliza duplicados e inválidos, retira mes y conserva params ajenos sin duplicarlos', () => {
  const parsed = parseSearchState('?pais=Colombia&pais=Colombia&pais=%20&genero=Ambient&texto=%20&texto=Ni%C3%B1o&texto=Ni%C3%B1o&año=20&tipo=EP&type=Invalido&type=Single&orden=titulo-asc&orden=fecha-asc&p=0&p=3&radar_denso=9&radar_denso=2&mes=07&beta=1&beta=1');
  assert.deepEqual(parsed.state, createSearchState({
    countries: ['Colombia'], genres: ['Ambient'], text: ['Niño'], type: 'Single', year: null,
    radar: { denso: 2 }, order: 'fecha-asc', page: 3
  }));
  const canonical = query(parsed.state, parsed.unknown);
  assert.equal(canonical, 'tipo=EP&beta=1&beta=1&texto=Ni%C3%B1o&pais=Colombia&genero=Ambient&type=Single&orden=fecha-asc&radar_denso=2&p=3');
  assert.equal(parseSearchState(canonical).unknown.toString(), 'tipo=EP&beta=1&beta=1');
  assert.equal(query(parseSearchState(canonical).state, parseSearchState(canonical).unknown), canonical);
});

test('política de orden conserva fecha explícita, elige match al primer criterio y radar al activarlo', () => {
  const clean = createSearchState();
  assert.equal(clean.order, 'fecha-desc');
  const text = createSearchState({ text: ['ambient'] });
  assert.equal(text.order, 'match');
  const radar = createSearchState({ radar: { experimental: 3 } });
  assert.equal(radar.order, 'radar');
  const explicitDate = createSearchState({ text: ['ambient'], order: 'fecha-asc' });
  assert.equal(explicitDate.order, 'fecha-asc');
  assert.equal(hasActiveRadar(radar), true);
  assert.deepEqual(searchStateToCriteria(explicitDate), {
    text: ['ambient'], genres: [], countries: [], type: null, year: null,
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 }, order: 'fecha-asc'
  });
});

test('entidades malformadas se ignoran y el serializer no emite mes', () => {
  const parsed = parseSearchState('?entidad=not-json&entidad=%7B%22kind%22%3A%22artist%22%7D&mes=11');
  assert.deepEqual(parsed.state.text, []);
  assert.equal(query(parsed.state, parsed.unknown).includes('mes='), false);
});
