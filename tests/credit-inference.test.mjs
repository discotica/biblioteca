import assert from "node:assert/strict";
import test from "node:test";
import { CREDIT_INFERENCE_VERSION, inferCredits } from "../supabase/functions/_shared/credit-inference.ts";

const artists = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Ana" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Beto" },
  { id: "00000000-0000-0000-0000-000000000003", name: "A&B" },
  { id: "00000000-0000-0000-0000-000000000004", name: "Comma, Name" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Cora" },
];
const base = { provider: "bandcamp", source_url: "https://example.bandcamp.com/album/test", source_available: true };

test("coautoría con & solo es high cuando ambas identidades ya existen", () => {
  const result = inferCredits({ ...base, structured_author: "Ana & Beto" }, artists);
  assert.equal(result.heuristic_version, CREDIT_INFERENCE_VERSION);
  assert.equal(result.classification, "high");
  assert.deepEqual(result.primary_artist_ids, [artists[0].id, artists[1].id]);
});

test("un nombre artístico que contiene & o coma no se divide ciegamente", () => {
  assert.deepEqual(inferCredits({ ...base, structured_author: "A&B" }, artists).primary_artist_ids, [artists[2].id]);
  assert.deepEqual(inferCredits({ ...base, structured_author: "Comma, Name" }, artists).primary_artist_ids, [artists[3].id]);
  assert.equal(inferCredits({ ...base, structured_author: "Ana & Desconocido" }, artists).classification, "review");
});

test("remixers, coautoría por track y contradicciones quedan en review/manual", () => {
  assert.equal(inferCredits({ ...base, structured_author: "Ana", title: "Tema feat. Beto (Remixed by C)" }, artists).classification, "review");
  assert.equal(inferCredits({ ...base, structured_author: "Ana", track_authors: ["Ana", "Nombre sin resolver"] }, artists).classification, "review");
  assert.equal(inferCredits({ ...base, structured_author: "Ana, Beto, Desconocido" }, artists).classification, "review");
});

test("fuente no disponible nunca crea un crédito propuesto", () => {
  const result = inferCredits({ provider: "manual", source_available: false, structured_author: "Ana" }, artists);
  assert.equal(result.classification, "manual");
  assert.deepEqual(result.primary_artist_ids, []);
});

test("tres artistas sin señal de colaboración pueden ser high solo con autor estructurado exacto", () => {
  const result = inferCredits({ ...base, structured_author: "Ana, Beto, Cora" }, artists);
  assert.equal(result.classification, "high");
  assert.equal(result.primary_artist_ids.length, 3);
});
