/**
 * Reglas y fortaleza de contraseña para PasswordField (U5).
 *
 * Solo la longitud mínima es obligatoria: es la regla que el registro ya
 * impone (`minlength="8"`). Las demás orientan y suben la fortaleza, pero no
 * bloquean el envío; volverlas obligatorias sería un cambio de producto.
 */
export type PasswordRule = {
  id: string;
  label: string;
  /** Si no se cumple, el formulario no debe enviarse. */
  required: boolean;
  test: (password: string) => boolean;
};

export type PasswordStrength = 'vacia' | 'debil' | 'aceptable' | 'fuerte';

export const PASSWORD_MIN_LENGTH = 8;

export const DEFAULT_PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'longitud',
    label: `${PASSWORD_MIN_LENGTH} caracteres o más`,
    required: true,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH
  },
  {
    id: 'letras-numeros',
    label: 'Letras y números',
    required: false,
    test: (password) => /\p{L}/u.test(password) && /\p{N}/u.test(password)
  },
  {
    id: 'mayuscula-simbolo',
    label: 'Una mayúscula o un símbolo',
    required: false,
    test: (password) => /\p{Lu}/u.test(password) || /[^\p{L}\p{N}\s]/u.test(password)
  }
];

export type PasswordEvaluation = {
  rules: { id: string; label: string; required: boolean; met: boolean }[];
  /** Todas las reglas obligatorias se cumplen. */
  valid: boolean;
  strength: PasswordStrength;
  /** 0–3, para el medidor de tres segmentos. */
  score: 0 | 1 | 2 | 3;
};

/** Variedad de clases de caracteres: minúsculas, mayúsculas, números y símbolos. */
function variety(password: string) {
  return [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((pattern) => pattern.test(password)).length;
}

export function evaluatePassword(password: string, rules: PasswordRule[] = DEFAULT_PASSWORD_RULES): PasswordEvaluation {
  const evaluated = rules.map(({ id, label, required, test }) => ({ id, label, required, met: test(password) }));
  const valid = evaluated.every((rule) => !rule.required || rule.met);

  if (!password) return { rules: evaluated, valid, strength: 'vacia', score: 0 };
  if (!valid) return { rules: evaluated, valid, strength: 'debil', score: 1 };

  // Longitud y variedad suman por igual. "Fuerte" exige además 12 caracteres:
  // la variedad sola no compensa una contraseña corta.
  const points =
    (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0) + Math.max(0, variety(password) - 1);

  if (points >= 3 && password.length >= 12) return { rules: evaluated, valid, strength: 'fuerte', score: 3 };
  if (points >= 1) return { rules: evaluated, valid, strength: 'aceptable', score: 2 };
  return { rules: evaluated, valid, strength: 'debil', score: 1 };
}

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  vacia: '',
  debil: 'Débil',
  aceptable: 'Aceptable',
  fuerte: 'Fuerte'
};
