// Servidor de desarrollo propio de la suite visual. Hereda la configuración del
// proyecto y solo cambia lo necesario para que la captura sea reproducible:
// caché de dependencias separada (no choca con `npm run dev`) y sin HMR (un
// guardado durante la corrida no se propaga a las páginas abiertas).
import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config.js';

export default mergeConfig(base, defineConfig({
  cacheDir: 'node_modules/.vite-visual',
  clearScreen: false,
  server: { hmr: false }
}));
