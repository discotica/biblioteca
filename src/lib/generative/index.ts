/**
 * Motor generativo (U27, plan de dirección de arte §4). Sin dependencias.
 * - Semilla FNV-1a y PRNG determinista: `semilla.ts`.
 * - Huella por nombre y gama por rol: `huella.ts`, `Huella.svelte` (avatar) y
 *   `Cenefa.svelte` (con portada y sin ella).
 * - Campo de pulso del tablero A2: `pulso.ts`, `CampoPulso.svelte` y el worker
 *   que lo dibuja (`motorPulso.ts`, `pulso.trabajador.ts`).
 * API y medida de rendimiento: docs/producto/u27-motor-generativo-2026-11-10.md
 */
export { fnv1a, prng, semillaDe, normalizarNombre } from './semilla.ts';
export {
  huella,
  puntosHuella,
  campoDe,
  tonosDe,
  bandaDe,
  firma,
  FONDO,
  ROL_ADMIN,
  TONOS_GRISES,
  RADIO_MIN,
  RADIO_MAX,
  GANANCIA,
  ALFA_MASCARA,
  type Rol,
  type Tonos,
  type OpcionesHuella,
  type Contexto2D
} from './huella.ts';
export { crearPulso, seno, potencia32, PULSO_POR_DEFECTO, T_FIJO, type OpcionesPulso, type Pulso } from './pulso.ts';
export { default as Huella, avatarDataURL, celdasAvatar, type TamanoHuella } from './Huella.svelte';
export { default as Cenefa } from './Cenefa.svelte';
export { default as CampoPulso, DPR_MAX } from './CampoPulso.svelte';
