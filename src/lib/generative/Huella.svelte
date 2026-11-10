<script module lang="ts">
  import { huella, type Rol } from './huella.ts';

  export type TamanoHuella = 32 | 40 | 96;

  /** Celdas en el lado del avatar: 7 a 32 y 40 px, 11 a 96. */
  export const celdasAvatar = (tamano: number) => Math.round(5 + tamano / 16);

  const cache = new Map<string, string>();

  /**
   * dataURL del avatar de un nombre. Se genera una vez por nombre, rol y tamaño,
   * a 2× (el DPR máximo del motor), y se cachea mientras viva la página.
   */
  export function avatarDataURL(nombre: string, rol: Rol, tamano: TamanoHuella): string {
    const clave = `${rol}|${tamano}|${nombre}`;
    const hecho = cache.get(clave);
    if (hecho) return hecho;
    const lado = tamano * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = lado;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    huella(ctx, lado, lado, { nombre, rol, celdas: celdasAvatar(tamano), borde: 0.8 });
    const url = canvas.toDataURL('image/png');
    cache.set(clave, url);
    return url;
  }
</script>

<script lang="ts">
  type Props = {
    nombre: string;
    rol?: Rol;
    tamano?: TamanoHuella;
    /** Vacío si el avatar acompaña al nombre escrito; si va solo, el nombre de la cuenta. */
    alt?: string;
    class?: string;
  };

  let { nombre, rol = 'usuario', tamano = 40, alt = '', class: className = '' }: Props = $props();

  const src = $derived(avatarDataURL(nombre, rol, tamano));
</script>

<!-- Avatar de huella (U27, §4): estático, circular y cacheado. -->
<img class="ui-huella {className}" {src} {alt} width={tamano} height={tamano} draggable="false" />

<style>
  .ui-huella {
    display: block;
    flex: none;
    border-radius: 50%;
    background: var(--color-fondo);
  }
</style>
