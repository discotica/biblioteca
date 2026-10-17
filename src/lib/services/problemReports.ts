import { supabase } from '$lib/supabase';

export const REPORT_CATEGORIES = [
  ['catalog_error', 'Error de catálogo'],
  ['technical_bug', 'Problema técnico'],
  ['general_feedback', 'Comentario general']
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number][0];

/** Report states in workflow order, with the Spanish label shown in the interface. */
export const REPORT_STATUSES = [
  ['new', 'Nuevo'],
  ['triaged', 'Clasificado'],
  ['in_progress', 'En curso'],
  ['resolved', 'Resuelto'],
  ['closed', 'Cerrado']
] as const;

export function reportStatusLabel(status: string): string {
  return REPORT_STATUSES.find(([value]) => value === status)?.[1] ?? status;
}
export type ProblemReport = {
  id: string; author_id: string; category: ReportCategory; description: string; page_url: string;
  release_id: string | null; technical_context: Record<string, unknown>; screenshot_path: string | null;
  status: 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed'; assigned_to: string | null;
  created_at: string; updated_at: string;
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileBytes = 5 * 1024 * 1024;

function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  const next = new Error(error.message) as Error & { code?: string };
  next.code = error.code;
  throw next;
}

export function validateScreenshot(file: File | null) {
  if (!file) return;
  if (!allowedTypes.has(file.type)) throw new Error('La captura debe ser JPEG, PNG o WebP.');
  if (file.size > maxFileBytes) throw new Error('La captura no puede superar 5 MB.');
}

export function technicalReportContext(releaseId: string | null) {
  const pageUrl = `${window.location.pathname}${window.location.search}`;
  return {
    route: pageUrl,
    ...(releaseId ? { release_id: releaseId } : {}),
    timestamp: new Date().toISOString(),
    app_version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    catalog_source: import.meta.env.VITE_CATALOG_SOURCE ?? 'legacy',
    user_agent: navigator.userAgent.slice(0, 512),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    locale: navigator.language,
    online: navigator.onLine
  };
}

export async function createProblemReport(input: { category: ReportCategory; description: string; releaseId: string | null; screenshot: File | null }) {
  validateScreenshot(input.screenshot);
  const { data: session, error: sessionError } = await supabase.auth.getUser();
  fail(sessionError);
  if (!session.user) throw new Error('Necesitas iniciar sesión para enviar un reporte.');
  const context = technicalReportContext(input.releaseId);
  const { data: report, error } = await supabase.from('problem_reports').insert({
    author_id: session.user.id, category: input.category, description: input.description.trim(),
    page_url: context.route, release_id: input.releaseId, technical_context: context
  }).select().single();
  fail(error);
  if (!input.screenshot) return { report: report as ProblemReport, screenshotError: null };

  const extension = input.screenshot.type === 'image/jpeg' ? 'jpg' : input.screenshot.type.split('/')[1];
  const path = `${session.user.id}/${report.id}/screenshot.${extension}`;
  const { error: uploadError } = await supabase.storage.from('problem-report-screenshots').upload(path, input.screenshot, { upsert: false, contentType: input.screenshot.type });
  if (uploadError) return { report: report as ProblemReport, screenshotError: 'El reporte se guardó, pero no se pudo subir la captura. Puedes reintentarla desde la cola de soporte.' };
  const { data: attached, error: attachError } = await supabase.rpc('attach_problem_report_screenshot', { p_report_id: report.id, p_path: path });
  if (attachError) return { report: report as ProblemReport, screenshotError: 'El reporte se guardó, pero no se pudo adjuntar la captura. El equipo podrá limpiar el archivo pendiente.' };
  return { report: attached as ProblemReport, screenshotError: null };
}

export async function loadProblemReports() {
  const { data, error } = await supabase.from('problem_reports').select('*').order('created_at', { ascending: false });
  fail(error); return (data ?? []) as ProblemReport[];
}

export async function updateProblemReport(id: string, status: ProblemReport['status'], assignedTo: string | null, note: string) {
  const { data, error } = await supabase.rpc('admin_update_problem_report', { p_report_id: id, p_status: status, p_assigned_to: assignedTo, p_note: note });
  fail(error); return data as ProblemReport;
}
