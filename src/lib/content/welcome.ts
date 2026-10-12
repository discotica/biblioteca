/**
 * Bienvenida editorial del inicio (E20, permanente desde U11). El equipo puede
 * cambiar este objeto (o pasar otro a HomeWelcome) sin tocar la regla de
 * sesión ni la navegación.
 */
export interface WelcomeIllustration {
  /**
   * Ruta pública del arte, p. ej. `/img/bienvenida/ilustracion.svg` (el archivo
   * va en `static/img/bienvenida/`). Se recorta para llenar el hueco: 4:3 en
   * dos columnas y una banda 5:2 en móvil, así que el motivo debe quedar en la
   * franja central.
   */
  src: string;
  /** Vacío si el arte es decorativo (lo habitual): el título ya da el sentido. */
  alt: string;
}

export interface WelcomeContent {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  closeLabel: string;
  /** null: hasta que llegue la ilustración de marca, el logo atenuado (como una portada sin imagen). */
  illustration: WelcomeIllustration | null;
}

export const WELCOME_CONTENT: WelcomeContent = {
  eyebrow: 'Biblioteca Discótica',
  title: 'Explora la biblioteca de Discótica',
  description: 'Descubre lanzamientos por género, país, año y perfil sonoro.',
  cta: 'Explorar',
  closeLabel: 'Cerrar bienvenida',
  illustration: null
};
