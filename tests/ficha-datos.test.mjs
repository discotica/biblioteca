import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contarPorFrecuencia,
  datosArtista,
  datosColeccion,
  datosSello,
  portadaMasReciente,
  rangoDeAnios
} from '../src/lib/domain/fichaDatos.ts';
import { normalizeReleaseDate } from '../src/lib/domain/releases.ts';

const artista = (name, slug = null) => ({ id: null, slug, name, position: 0 });
const rel = ({ fecha = '2024-05-01', label = '', countries = [], genres = [], artists = [], cover = '' } = {}) => ({
  releaseDate: normalizeReleaseDate(fecha),
  label,
  countries,
  genres,
  primaryArtists: artists,
  coverUrl: cover,
  cover
});

const nombres = (dato) => dato.items.map((item) => `${item.nombre}:${item.cantidad}`);
const fila = (datos, etiqueta) => datos.find((dato) => dato.etiqueta === etiqueta);

test('U32: las listas van por frecuencia y los empates por nombre', () => {
  const items = contarPorFrecuencia(
    [['b', 'a'], ['a'], ['c'], ['c', 'a'], ['b']],
    (lista) => lista.map((value) => ({ key: value, nombre: value.toUpperCase(), href: `/${value}` }))
  );
  assert.deepEqual(items.map((item) => [item.nombre, item.cantidad]), [['A', 3], ['B', 2], ['C', 2]]);
});

test('U32: cada lanzamiento cuenta una vez por entrada, aunque la repita', () => {
  const items = contarPorFrecuencia([['x', 'x', 'X']], (lista) =>
    lista.map((value) => ({ key: value.toLowerCase(), nombre: value, href: '' }))
  );
  assert.deepEqual(items, [{ nombre: 'x', cantidad: 1, href: '' }]);
});

test('U32 artista: País, Años, Sellos, Géneros y Lanzamientos, en ese orden', () => {
  const releases = [
    rel({ fecha: '2020-02-01', label: 'C.T.M', countries: ['Ecuador'], genres: ['Bass', 'Techno'] }),
    rel({ fecha: '2026-03-01', label: 'C.T.M', countries: ['Ecuador'], genres: ['Techno'] }),
    rel({ fecha: '2023-01-01', label: 'TraTraTrax', countries: ['Ecuador', 'LATAM'], genres: ['Dembow'] }),
    rel({ fecha: '2022-01-01', label: 'Independiente', countries: ['latam'], genres: ['techno'] })
  ];
  const datos = datosArtista(releases);
  assert.deepEqual(datos.map((dato) => dato.etiqueta), ['País', 'Años', 'Sellos', 'Géneros', 'Lanzamientos']);
  assert.deepEqual(nombres(fila(datos, 'País')), ['Ecuador:3']);
  assert.equal(fila(datos, 'Años').valor, '2020–2026');
  // «Independiente» no es un sello en la ficha.
  assert.deepEqual(nombres(fila(datos, 'Sellos')), ['C.T.M:2', 'TraTraTrax:1']);
  // «techno» y «Techno» son el mismo género; se muestra la primera forma vista.
  assert.deepEqual(nombres(fila(datos, 'Géneros')), ['Techno:3', 'Bass:1', 'Dembow:1']);
  assert.equal(fila(datos, 'Lanzamientos').valor, '4');
});

test('U32: los enlaces llevan a la ficha del sello o del artista, y al catálogo filtrado', () => {
  const releases = [
    rel({ label: 'Love in the Endz', countries: ['Perú'], genres: ['Ambient'], artists: [artista('Nick León', 'nick-leon'), artista('Doctor Jeep')] })
  ];
  const sello = datosArtista(releases);
  assert.equal(fila(sello, 'Sellos').items[0].href, '/sello/love-in-the-endz');
  assert.equal(fila(sello, 'País').items[0].href, '/?pais=Per%C3%BA&orden=match');
  assert.equal(fila(sello, 'Géneros').items[0].href, '/?genero=Ambient&orden=match');
  const artistas = fila(datosSello(releases), 'Artistas').items;
  assert.deepEqual(artistas.map((item) => item.href), ['/artista/doctor-jeep', '/artista/nick-leon']);
});

test('U32 sello: Países, Años, Artistas principales, Géneros y Lanzamientos', () => {
  const releases = [
    rel({ fecha: '2021-01-01', label: 'TraTraTrax', countries: ['Colombia'], genres: ['Techno'], artists: [artista('Nick León', 'nick-leon')] }),
    rel({ fecha: '2021-06-01', label: 'TraTraTrax', countries: ['Colombia', 'Venezuela'], genres: ['Tribal'], artists: [artista('Nick León', 'nick-leon'), artista('Doctor Jeep', 'doctor-jeep')] }),
    rel({ fecha: '2021-09-01', label: 'TraTraTrax', countries: ['Venezuela', 'LATAM'], genres: ['Techno'], artists: [artista('Doctor Jeep', 'doctor-jeep')] }),
    rel({ fecha: '2021-12-01', label: 'TraTraTrax', countries: ['Colombia'], genres: [], artists: [artista('Nick León', 'nick-leon')] })
  ];
  const datos = datosSello(releases);
  assert.deepEqual(datos.map((dato) => dato.etiqueta), ['Países', 'Años', 'Artistas', 'Géneros', 'Lanzamientos']);
  assert.deepEqual(nombres(fila(datos, 'Países')), ['Colombia:3', 'Venezuela:2']);
  // Un solo año, sin rango.
  assert.equal(fila(datos, 'Años').valor, '2021');
  assert.deepEqual(nombres(fila(datos, 'Artistas')), ['Nick León:3', 'Doctor Jeep:2']);
  assert.deepEqual(nombres(fila(datos, 'Géneros')), ['Techno:2', 'Tribal:1']);
  assert.equal(fila(datos, 'Lanzamientos').valor, '4');
});

test('U32: una lista vacía no ocupa fila (solo LATAM, solo Independiente, sin fechas)', () => {
  const datos = datosArtista([rel({ fecha: '', label: 'Independiente', countries: ['LATAM'], genres: [] })]);
  assert.deepEqual(datos, [{ tipo: 'texto', etiqueta: 'Lanzamientos', valor: '1' }]);
});

test('U32: años de mínimo a máximo, sin importar el orden ni las fechas legadas', () => {
  assert.equal(rangoDeAnios([rel({ fecha: '15/03/2019' }), rel({ fecha: '2025-01-01' }), rel({ fecha: '2021-01-01' })]), '2019–2025');
  assert.equal(rangoDeAnios([]), '');
});

test('U32: la cenefa usa la portada del lanzamiento más reciente que tenga portada', () => {
  assert.equal(
    portadaMasReciente([
      rel({ fecha: '2020-01-01', cover: 'a.jpg' }),
      rel({ fecha: '2026-01-01', cover: '' }),
      rel({ fecha: '2024-01-01', cover: 'b.jpg' }),
      rel({ fecha: '2022-01-01', cover: 'c.jpg' })
    ]),
    'b.jpg'
  );
  assert.equal(portadaMasReciente([rel({ cover: '' })]), null);
});

test('U32 colección: Curada por con enlace al perfil, Lanzamientos y Visibilidad', () => {
  assert.deepEqual(datosColeccion({ usuario: 'comunidad', lanzamientos: 6, publica: true }), [
    { tipo: 'texto', etiqueta: 'Curada por', valor: '@comunidad', href: '/perfil/comunidad' },
    { tipo: 'texto', etiqueta: 'Lanzamientos', valor: '6' },
    { tipo: 'texto', etiqueta: 'Visibilidad', valor: 'Pública' }
  ]);
  assert.equal(datosColeccion({ usuario: 'x', lanzamientos: 0, publica: false }).at(-1).valor, 'Privada');
});
