/**
 * Bienvenida editorial del inicio (E20, permanente desde U11). El equipo puede
 * cambiar este objeto (o pasar otro a HomeWelcome) sin tocar la regla de
 * sesión ni la navegación. U29: el arte lo pone el campo de pulso de la franja,
 * así que ya no hay ilustración, antetítulo ni botón; el título es el de la franja.
 */
export interface WelcomeContent {
  title: string;
  description: string;
  closeLabel: string;
}

export const WELCOME_CONTENT: WelcomeContent = {
  title: 'Explora la biblioteca',
  description: 'Descubre lanzamientos por género, país, año y perfil sonoro.',
  closeLabel: 'Cerrar bienvenida'
};
