// Vista previa de enlaces (2026-11-17): escribe build/vista-previa.config.php
// con la URL y la clave publicable de Supabase, las mismas que van en el bundle
// del navegador (públicas). Las lee static/vista-previa.php en Hostinger.
// Sin variables, escribe una configuración vacía y el script sirve las
// etiquetas genéricas.
import { writeFileSync, existsSync } from 'node:fs';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV === 'development' ? 'development' : 'production', process.cwd(), 'VITE_');
const url = env.VITE_SUPABASE_URL ?? '';
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (key.startsWith('sb_secret_')) {
  console.error('vista-previa: VITE_SUPABASE_PUBLISHABLE_KEY es una clave secreta; no se escribe.');
  process.exit(1);
}
if (!existsSync('build')) {
  console.error('vista-previa: no existe build/; corre vite build antes.');
  process.exit(1);
}

const php = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
writeFileSync(
  'build/vista-previa.config.php',
  `<?php\n// Generado por scripts/vista-previa-config.mjs. No editar.\nreturn [\n  'supabase_url' => ${php(url)},\n  'supabase_key' => ${php(key)},\n  'origin' => 'https://biblioteca.discotica.com',\n];\n`
);
console.log(`vista-previa: configuración escrita (${url ? 'con Supabase' : 'sin Supabase: solo etiquetas genéricas'}).`);
