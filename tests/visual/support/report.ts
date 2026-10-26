// Informe de la suite visual: tests/visual/report/informe.md (+ informe.json y
// las imágenes esperada/actual/diff de cada captura distinta en report/diferencias/).
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

type Entry = {
  id: string;
  estado: 'igual' | 'diferente' | 'sin-linea-base' | 'actualizada' | 'error' | 'inestable-igual' | 'inestable-diferente';
  vista: string;
  pixeles?: number;
  ratio?: number;
  detalle?: string;
  imagenes?: string[];
  duracionMs: number;
  notas: Record<string, string[]>;
};

const NOTE_TYPES = ['suplementaria', 'inestable', 'diferencia-inestable', 'fuente-ausente', 'sin-mock', 'red-bloqueada', 'escritura-simulada'];

export default class VisualReport implements Reporter {
  private outputDir: string;
  private entries: Entry[] = [];
  private mode: 'captura' | 'comparación' = 'comparación';
  private started = Date.now();

  constructor(options: { outputDir: string }) {
    this.outputDir = options.outputDir;
  }

  onBegin(config: FullConfig, _suite: Suite) {
    this.mode = config.updateSnapshots === 'all' || config.updateSnapshots === 'changed' ? 'captura' : 'comparación';
    fs.rmSync(path.join(this.outputDir, 'diferencias'), { recursive: true, force: true });
    fs.mkdirSync(path.join(this.outputDir, 'diferencias'), { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (test.title.startsWith('el censo')) return;
    const notes: Record<string, string[]> = {};
    for (const { type, description } of test.annotations) {
      if (!NOTE_TYPES.includes(type)) continue;
      (notes[type] ??= []).push(description ?? '');
    }
    const vista = test.annotations.find((a) => a.type === 'vista')?.description ?? '';
    const message = result.errors.map((e) => e.message ?? '').join('\n').replace(/\u001b\[[0-9;]*m/g, '');
    const unstableDiff = notes['diferencia-inestable']?.[0];
    const text = message || unstableDiff || '';
    const pixels = text.match(/(\d+) pixels \(ratio ([\d.]+)/);
    const entry: Entry = { id: test.title, estado: 'igual', vista, duracionMs: result.duration, notas: notes };

    if (/doesn't exist|missing/i.test(text) && this.mode === 'comparación') {
      entry.estado = 'sin-linea-base';
    } else if (pixels || /Expected an image|sizes differ|different size/i.test(text)) {
      entry.estado = notes.inestable ? 'inestable-diferente' : 'diferente';
      if (pixels) { entry.pixeles = Number(pixels[1]); entry.ratio = Number(pixels[2]); }
      entry.detalle = text.split('\n').find((line) => /pixels|Expected an image|size/i.test(line))?.trim();
      entry.imagenes = this.copyImages(test.title, result);
    } else if (result.status !== 'passed') {
      entry.estado = 'error';
      entry.detalle = text.split('\n').slice(0, 3).join(' ').trim().slice(0, 300);
      entry.imagenes = this.copyImages(test.title, result);
    } else if (this.mode === 'captura') {
      entry.estado = 'actualizada';
    } else if (notes.inestable) {
      entry.estado = 'inestable-igual';
    }
    this.entries.push(entry);
  }

  private copyImages(id: string, result: TestResult) {
    const copied: string[] = [];
    for (const attachment of result.attachments) {
      if (!attachment.path || !attachment.contentType.startsWith('image/')) continue;
      const kind = /expected/.test(attachment.name) ? 'esperada' : /actual/.test(attachment.name) ? 'actual' : /diff/.test(attachment.name) ? 'diff' : null;
      if (!kind || !fs.existsSync(attachment.path)) continue;
      const target = path.join(this.outputDir, 'diferencias', `${id}.${kind}.png`);
      fs.copyFileSync(attachment.path, target);
      copied.push(path.relative(this.outputDir, target));
    }
    return copied;
  }

  onEnd() {
    const elapsed = (Date.now() - this.started) / 1000;
    const entries = this.entries.sort((a, b) => a.id.localeCompare(b.id));
    const count = (estado: Entry['estado']) => entries.filter((e) => e.estado === estado).length;
    const changed = entries.filter((e) => ['diferente', 'sin-linea-base', 'error'].includes(e.estado));
    const unstable = entries.filter((e) => e.estado.startsWith('inestable'));
    const network = entries.filter((e) => e.notas['sin-mock'] || e.notas['red-bloqueada']);
    const missingFont = entries.filter((e) => e.notas['fuente-ausente']);

    const lines = [
      `# Informe visual — ${this.mode}`,
      '',
      `- Fecha: ${new Date().toISOString()}`,
      `- Capturas: ${entries.length} · iguales ${count('igual')} · diferentes ${count('diferente')} · sin línea base ${count('sin-linea-base')} · errores ${count('error')} · actualizadas ${count('actualizada')} · inestables ${unstable.length}`,
      `- Duración: ${elapsed.toFixed(1)} s (suma por captura ${(entries.reduce((s, e) => s + e.duracionMs, 0) / 1000).toFixed(1)} s)`,
      `- Umbral: color ${process.env.VISUAL_THRESHOLD ?? 0.02} · píxeles tolerados ${process.env.VISUAL_MAX_DIFF_PIXELS ?? 0}`,
      `- Informe HTML con comparador deslizante: report/html/index.html (\`npx playwright show-report tests/visual/report/html\`)`,
      ''
    ];
    if (missingFont.length) lines.push(`> Work Sans no está instalada en esta máquina: ${missingFont.length} capturas usan la fuente de respaldo y no son comparables con la línea base.`, '');
    lines.push('## Capturas con diferencias', '');
    if (!changed.length) lines.push('Ninguna.', '');
    else {
      lines.push('| ID | Estado | Píxeles | Ratio | Vista | Detalle | Imágenes |', '| --- | --- | --- | --- | --- | --- | --- |');
      for (const e of changed) lines.push(`| ${e.id} | ${e.estado} | ${e.pixeles ?? '—'} | ${e.ratio ?? '—'} | ${e.vista} | ${(e.detalle ?? '').replace(/\|/g, '\\|')} | ${(e.imagenes ?? []).map((p) => `[${path.basename(p).split('.').slice(-2, -1)[0]}](${p})`).join(' ')} |`);
      lines.push('');
    }
    lines.push('## Capturas inestables', '');
    if (!unstable.length) lines.push('Ninguna.', '');
    else for (const e of unstable) lines.push(`- **${e.id}** (${e.estado}): ${e.notas.inestable?.[0] ?? ''}${e.pixeles ? ` — ${e.pixeles} píxeles` : ''}`), lines.push('');
    if (network.length) {
      lines.push('## Red no simulada', '', 'Peticiones sin mock o bloqueadas. Si una vista nueva las provoca, añade su mock en support/mocks.ts.', '');
      for (const e of network) for (const item of [...(e.notas['sin-mock'] ?? []), ...(e.notas['red-bloqueada'] ?? [])]) lines.push(`- ${e.id}: \`${item}\``);
      lines.push('');
    }
    lines.push('## Todas las capturas', '', '| ID | Estado | Vista | Tiempo (s) |', '| --- | --- | --- | --- |');
    for (const e of entries) lines.push(`| ${e.id}${e.notas.suplementaria ? ' ⁺' : ''} | ${e.estado} | ${e.vista} | ${(e.duracionMs / 1000).toFixed(1)} |`);
    lines.push('', '⁺ Suplementaria: está en el anexo pero no en el censo.', '');

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'informe.md'), lines.join('\n'));
    fs.writeFileSync(path.join(this.outputDir, 'informe.json'), JSON.stringify({ mode: this.mode, elapsedSeconds: elapsed, entries }, null, 1));
    console.log(`\nInforme visual (${this.mode}): ${changed.length} con diferencias, ${unstable.length} inestables, ${entries.length} capturas en ${elapsed.toFixed(1)} s`);
    console.log(`→ ${path.relative(process.cwd(), path.join(this.outputDir, 'informe.md'))}`);
    for (const e of changed) console.log(`  ${e.estado.padEnd(15)} ${e.id}${e.pixeles != null ? ` (${e.pixeles} px)` : ''}`);
  }
}
