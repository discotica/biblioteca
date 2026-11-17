# Capturas de la QA de U34 (2026-11-12)

- `1440-*.jpg`, `390-*.jpg` y `zoom200-*.jpg`: cada vista del inventario (tablero L) y el panel de cuenta, generadas por `ANCHOS_OUT=docs/modernizacion/capturas-u34 npm run test:anchos`. Zoom al 200 % = 640 × 400 CSS px a DPR 2. A 1024 también se comprobó, pero no se guardan. JPEG al 72 %.
- `staging/`: el recorrido en staging con la app local (`scripts/u34-recorrido-staging.mjs`): `visitante-*`, `nuevo-*` (alta completa), `comunidad-1440-*` y `comunidad-390-*`, `colaborador-*` y `admin-*`. `informe-*.json` lista los hallazgos de cada corrida.
- `contraste-cenefa-sintetico/`: una medida por escenario del contraste sobre la cenefa con portadas del peor caso (`u34-qa.spec.ts`).
- `contraste-staging-tras-arreglo.json`: las 18 fichas más justas con portadas reales, vueltas a medir tras subir el tono de migas y etiquetas (`scripts/u34-contraste-staging.mjs`).
- `visual-u34-solo/`: informe y muestras (esperada, actual, diff) de lo que cambió solo en U34: el fondo de acceso y el resumen de propuesta del Estudio, contra `.ref-pre-u34`; y `informe-fichas-tono.md`, las 12 fichas que cambian por el tono de migas y etiquetas.
- `informe-visual-u25-a-u34.md`: la comparación completa contra la línea base publicada (U25). Los enlaces apuntan a `tests/visual/report/`, que no se versiona.
