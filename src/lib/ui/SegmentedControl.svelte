<script module lang="ts">
  export type SegmentedOption = {
    value: string;
    label: string;
    /** Qué incluye o cuántos hay: tooltip (guía de voz, regla 3), no texto en pantalla. */
    title?: string;
  };
</script>

<script lang="ts">
  type Props = {
    /** Nombre accesible del grupo («Mostrar»). No se ve. */
    label: string;
    options: SegmentedOption[];
    value: string;
    onchange?: (value: string) => void;
    class?: string;
  };

  let { label, options, value, onchange, class: className = '' }: Props = $props();

  // Un nombre por instancia: los radios de dos controles no se mezclan.
  const name = `ui-seg-${Math.random().toString(36).slice(2, 8)}`;
</script>

<!-- Filtro segmentado (U21): una opción activa a la vez, sobre radios nativos,
     así que Tab entra al grupo y las flechas cambian de opción. Mide 36 en el
     Estudio (--density-control-h). -->
<div class="ui-seg {className}" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label class="ui-seg__option" title={option.title}>
      <input
        class="ui-seg__input"
        type="radio"
        {name}
        value={option.value}
        checked={option.value === value}
        onchange={() => onchange?.(option.value)}
      />
      <span class="ui-seg__label">{option.label}</span>
    </label>
  {/each}
</div>

<style>
  /* Caja visible de --density-control-h (36 en el Estudio) con 44 de área
     táctil: el marco se dibuja en ::before, centrado, y cada opción mide
     --target-touch (la misma solución que Field y Select compactos, U20). */
  .ui-seg {
    --seg-pad: calc((var(--target-touch) - var(--density-control-h)) / 2);
    position: relative;
    display: inline-flex;
    max-width: 100%;
    min-height: var(--target-touch);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ui-seg::before {
    content: '';
    position: absolute;
    inset: var(--seg-pad) 0;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    pointer-events: none;
  }

  .ui-seg__option {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    cursor: pointer;
  }
  /* Separador entre opciones, de la altura de la caja visible. */
  .ui-seg__option + .ui-seg__option::before {
    content: '';
    position: absolute;
    inset: var(--seg-pad) auto var(--seg-pad) 0;
    width: 1px;
    background: var(--color-borde);
  }

  /* Visualmente oculto, pero enfocable: el foco se dibuja en la etiqueta. */
  .ui-seg__input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .ui-seg__label {
    display: flex;
    align-items: center;
    height: var(--target-touch);
    padding: 0 var(--density-control-px);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .ui-seg__option:hover .ui-seg__label { color: var(--color-texto); }
  /* La opción activa pinta solo la banda visible, no los 44. */
  .ui-seg__input:checked + .ui-seg__label {
    background: linear-gradient(var(--color-superficie-2), var(--color-superficie-2)) center / 100% var(--density-control-h) no-repeat;
    color: var(--color-texto);
  }
  .ui-seg__input:focus-visible + .ui-seg__label { outline: 2px solid var(--color-acento); outline-offset: calc(var(--seg-pad) * -1 - 2px); }
</style>
