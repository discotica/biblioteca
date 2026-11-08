<script module lang="ts">
  /**
   * ok: publicado o listo · pending: pendiente o falta algo · draft: borrador
   * (contorno) · danger: archivado o rechazado · neutral: cualquier otro.
   */
  export type StatusTone = 'ok' | 'pending' | 'draft' | 'danger' | 'neutral';
</script>

<script lang="ts">
  type Props = {
    /** Una palabra, en caja normal ("Publicado", "Borrador"). */
    label: string;
    tone?: StatusTone;
    /**
     * Explicación que no cabe en la palabra (guía de voz, regla 3): va en el
     * `title` y la leen los lectores de pantalla junto a la palabra.
     */
    description?: string;
    /** Solo el punto; la palabra queda para lectores de pantalla y en el `title`. */
    hideLabel?: boolean;
    class?: string;
    [attribute: string]: unknown;
  };

  let { label, tone = 'neutral', description, hideLabel = false, class: className = '', ...rest }: Props = $props();

  const title = $derived(description ?? (hideLabel ? label : undefined));
</script>

<!-- Estado del Estudio (U20): punto de color + una palabra. Sustituye a
     Chip kind="status" en el Estudio, sin mayúsculas forzadas ni caja. -->
<span class="ui-status ui-status--{tone} {className}" {title} {...rest}>
  <span class="ui-status__dot" aria-hidden="true"></span>
  <span class="ui-status__label" class:sr-only={hideLabel}>{label}</span>
  {#if description}<span class="sr-only">: {description}</span>{/if}
</span>

<style>
  .ui-status {
    --status-color: var(--color-texto-tenue);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    color: var(--color-texto-alto);
    font-size: inherit;
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
  }

  /* 8 px: la mitad de un icono sm. */
  .ui-status__dot {
    flex: none;
    width: calc(var(--icon-sm) / 2);
    height: calc(var(--icon-sm) / 2);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--status-color);
  }

  .ui-status__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  .ui-status--ok { --status-color: var(--color-acento); }
  .ui-status--pending { --status-color: var(--color-aviso); }
  .ui-status--danger { --status-color: var(--color-danger); }
  .ui-status--neutral { --status-color: var(--color-texto-tenue); }
  /* Borrador: solo el contorno, sin relleno. */
  .ui-status--draft .ui-status__dot {
    border: 1.5px solid var(--color-texto-medio);
    background: transparent;
  }
</style>
