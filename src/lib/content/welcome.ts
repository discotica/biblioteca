/**
 * Bienvenida editorial del inicio (E20, permanente desde U11). El equipo puede
 * cambiar este objeto (o pasar otro a HomeWelcome) sin tocar la regla de
 * sesión ni la navegación. U29: el arte lo pone el campo de pulso de la franja,
 * así que ya no hay ilustración, antetítulo ni botón; el título es el de la franja.
 */
export interface WelcomeContent {
  title: string;
  description: string;
  /** Título de la banda reducida (tras el primer scroll o sin bienvenida). */
  bandTitle: string;
  closeLabel: string;
}

export const WELCOME_CONTENT: WelcomeContent = {
  title: 'La casa del orgullo sudaca.',
  description:
    'Bienvenidx a la primera y más grande biblioteca de música electrónica latinoamericana. Descubre lanzamientos por género, país, año o perfil sonoro.',
  bandTitle: 'Explora la biblioteca',
  closeLabel: 'Cerrar bienvenida'
};
