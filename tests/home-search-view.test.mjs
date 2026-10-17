import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchState } from '../src/lib/domain/searchState.ts';
import {
  RELEASES_PER_PAGE,
  activeSearchPills,
  availableOrders,
  countActiveFilters,
  describeResults,
  pageSlice,
  searchFilterValues,
  totalPagesFor,
  withFilterForm,
  withOrder,
  withPage,
  withRadar,
  withoutPill
} from '../src/lib/domain/homeSearchView.ts';

const artist = { kind: 'artist', slug: 'luz', name: 'Luz' };

const busy = () => createSearchState({
  countries: ['Chile', 'Perú'],
  genres: ['Techno'],
  text: ['ruido', artist],
  year: '2020',
  type: 'EP',
  radar: { experimental: 0, denso: 3, sintetico: 0, bailable: 0, rapido: 0 },
  page: 3
});

test('valores de filtros: alias del SearchState con año y tipo vacíos como cadena', () => {
  assert.deepEqual(searchFilterValues(createSearchState()), {
    pais: [], genero: [], texto: [], año: '', type: '', orden: 'fecha-desc',
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 }
  });
});

test('pills en orden país, género, texto, año, tipo y Radar, y su conteo', () => {
  const state = busy();
  assert.deepEqual(activeSearchPills(state).map(({ id, label, kind }) => [id, label, kind]), [
    ['country:Chile', 'Chile', 'country'],
    ['country:Perú', 'Perú', 'country'],
    ['genre:Techno', 'Techno', 'genre'],
    ['text:0:ruido', '"ruido"', 'text'],
    ['text:1:Luz', '"Luz"', 'text'],
    ['year:2020', '2020', 'year'],
    ['type:EP', 'EP', 'type'],
    ['radar', 'Radar', 'radar']
  ]);
  assert.equal(countActiveFilters(state), 8);
  assert.equal(countActiveFilters(createSearchState()), 0);
  assert.deepEqual(activeSearchPills(createSearchState()), []);
});

test('quitar una pill vuelve a página 1 y conserva el resto', () => {
  const state = busy();
  const pills = activeSearchPills(state);
  const byId = (id) => pills.find((pill) => pill.id === id);
  assert.deepEqual(withoutPill(state, byId('country:Chile')).countries, ['Perú']);
  assert.deepEqual(withoutPill(state, byId('text:1:Luz')).text, ['ruido']);
  assert.deepEqual(withoutPill(state, byId('text:0:ruido')).text, [artist]);
  assert.equal(withoutPill(state, byId('year:2020')).year, null);
  assert.equal(withoutPill(state, byId('type:EP')).type, null);
  const withoutRadar = withoutPill(state, byId('radar'));
  assert.deepEqual(withoutRadar.radar, { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 });
  assert.equal(withoutRadar.page, 1);
  assert.deepEqual(withoutRadar.countries, ['Chile', 'Perú']);
});

test('órdenes: fechas sin criterios, coincidencia con criterios y Radar solo si está activo', () => {
  assert.deepEqual(availableOrders(createSearchState()).map((o) => o.value), ['fecha-desc', 'fecha-asc']);
  assert.deepEqual(availableOrders(createSearchState({ genres: ['Techno'] })).map((o) => o.value), ['match', 'fecha-desc', 'fecha-asc']);
  assert.deepEqual(availableOrders(busy()).map((o) => o.value), ['match', 'radar', 'fecha-desc', 'fecha-asc']);
});

test('formulario: normaliza listas, año de cuatro cifras y conserva el orden solo con criterios previos', () => {
  const fromEmpty = withFilterForm(createSearchState({ page: 4 }), { pais: 'Chile', genero: null, texto: ['a'], año: 1999, type: '' });
  assert.deepEqual(fromEmpty.countries, ['Chile']);
  assert.deepEqual(fromEmpty.genres, []);
  assert.equal(fromEmpty.year, '1999');
  assert.equal(fromEmpty.type, null);
  assert.equal(fromEmpty.page, 1);
  assert.equal(withFilterForm(createSearchState(), { año: '99' }).year, null);
  const kept = withFilterForm(createSearchState({ genres: ['Techno'], order: 'fecha-asc' }), { genero: ['House'] });
  assert.equal(kept.order, 'fecha-asc');
});

test('Radar: redondea, pasa a orden radar al activarse y respeta el orden elegido después', () => {
  const first = withRadar(createSearchState(), { denso: 2.6 });
  assert.equal(first.radar.denso, 3);
  assert.equal(first.order, 'radar');
  const chosen = withRadar(createSearchState({ radar: { experimental: 0, denso: 3, sintetico: 0, bailable: 0, rapido: 0 }, order: 'fecha-asc' }), { denso: 4 });
  assert.equal(chosen.order, 'fecha-asc');
});

test('página y orden', () => {
  assert.equal(withPage(createSearchState(), 9, 4).page, 4);
  assert.equal(withPage(createSearchState(), 0, 4).page, 1);
  const ordered = withOrder(createSearchState({ genres: ['Techno'], page: 3 }), 'fecha-asc');
  assert.equal(ordered.order, 'fecha-asc');
  assert.equal(ordered.page, 1);
  assert.equal(totalPagesFor(0), 1);
  assert.equal(totalPagesFor(RELEASES_PER_PAGE + 1), 2);
  const items = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(pageSlice(items, 3), items.slice(24, 30));
});

test('anuncio de resultados', () => {
  const base = { loading: false, error: false, total: 30, onlyApproximate: false, approximateTotal: 0, mixedGroups: false, exactOnPage: 12, approximateOnPage: 0 };
  assert.equal(describeResults({ ...base, loading: true }), 'Cargando lanzamientos.');
  assert.equal(describeResults({ ...base, error: true }), 'No pudimos cargar los lanzamientos.');
  assert.equal(describeResults({ ...base, total: 0 }), 'No encontramos lanzamientos con estos filtros.');
  assert.equal(describeResults({ ...base, onlyApproximate: true, approximateTotal: 7 }), '7 resultados aproximados.');
  assert.equal(describeResults({ ...base, mixedGroups: true, exactOnPage: 5, approximateOnPage: 7 }), '5 resultados exactos y 7 aproximados en esta página.');
  assert.equal(describeResults(base), '30 lanzamientos.');
});
