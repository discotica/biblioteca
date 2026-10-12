<script lang="ts">
  import { tick } from 'svelte';
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import LoadingIndicator from './LoadingIndicator.svelte';
  import { anchoredLayer, layerFor } from './overlay';
  import { canCreate, filterOptions, type ComboboxOption } from './combobox';

  type Created = ComboboxOption | string | null | undefined | void;

  type Props = {
    /** Etiqueta visible; nombra el campo y la lista. */
    label: string;
    options: ComboboxOption[];
    /** Valores elegidos, en orden de alta. */
    value?: string[];
    /** Texto escrito. Bindable para buscar en el servidor. */
    query?: string;
    /** Ofrece "Añadir «texto»" cuando nada coincide exactamente. */
    allowCreate?: boolean;
    /** Texto de la opción de crear. */
    createLabel?: (text: string) => string;
    /**
     * Convierte el texto en la opción nueva (puede ser asíncrono, p. ej. crear un
     * género en el Estudio). Sin él, el valor y la etiqueta son el texto. Devolver
     * null cancela el alta.
     */
    oncreate?: (text: string) => Created | Promise<Created>;
    onchange?: (value: string[]) => void;
    /** false si quien lo usa ya filtra `options` (búsqueda en el servidor). */
    filter?: boolean;
    /** Muestra "Buscando…" en la lista. */
    loading?: boolean;
    /** Máximo de resultados visibles; el resto aparece al escribir. */
    maxResults?: number;
    placeholder?: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    required?: boolean;
    disabled?: boolean;
    hideLabel?: boolean;
    /** Nombre accesible del chip. Por defecto "Quitar {etiqueta}". */
    removeLabel?: (label: string) => string;
    /**
     * false: sin chips. El campo solo busca y elige; quien lo usa muestra lo
     * elegido (U16: los créditos del editor, en filas que se arrastran).
     */
    chips?: boolean;
    emptyText?: string;
    id?: string;
    class?: string;
    element?: HTMLInputElement;
  };

  let {
    label,
    options,
    value = $bindable([]),
    query = $bindable(''),
    allowCreate = false,
    createLabel = (text) => `Añadir «${text}»`,
    oncreate,
    onchange,
    filter = true,
    loading = false,
    maxResults = 50,
    placeholder,
    hint,
    error,
    optional = false,
    required = false,
    disabled = false,
    hideLabel = false,
    removeLabel = (text) => `Quitar ${text}`,
    chips: showChips = true,
    emptyText = 'Sin coincidencias',
    id,
    class: className = '',
    element = $bindable()
  }: Props = $props();

  const uid = $props.id();
  const inputId = $derived(id ?? `${uid}-input`);
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const helpId = `${uid}-help`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  type Entry = { kind: 'option'; option: ComboboxOption } | { kind: 'create'; text: string };

  let root = $state<HTMLElement>();
  let control = $state<HTMLElement>();
  let popup = $state<HTMLElement>();
  let open = $state(false);
  let active = $state(-1);
  let creating = $state(false);
  let announcement = $state('');
  // Etiquetas de los valores elegidos: sobreviven a que `options` cambie
  // (búsqueda en el servidor) y cubren los valores creados.
  let known = $state<Record<string, string>>({});

  const labelOf = (v: string) => options.find((option) => option.value === v)?.label ?? known[v] ?? v;
  const selectedLabels = $derived(value.map(labelOf));
  const results = $derived(filter ? filterOptions(options, query, maxResults) : options.slice(0, maxResults));
  const entries = $derived.by<Entry[]>(() => {
    const list: Entry[] = results.map((option) => ({ kind: 'option', option }));
    const text = query.trim();
    if (allowCreate && canCreate(options, selectedLabels, text)) list.push({ kind: 'create', text });
    return list;
  });
  const describedBy = $derived([hint && hintId, error && errorId, helpId].filter(Boolean).join(' '));

  function enabledIndex(from: number, step: 1 | -1) {
    for (let index = from; index >= 0 && index < entries.length; index += step) {
      const entry = entries[index];
      if (entry.kind === 'create' || !entry.option.disabled) return index;
    }
    return -1;
  }

  function show() {
    if (disabled || open) return;
    open = true;
    active = enabledIndex(0, 1);
  }

  function hide() {
    open = false;
    active = -1;
  }

  function setActive(index: number) {
    if (index < 0) return;
    active = index;
    tick().then(() => document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' }));
  }

  function commit(next: string[], message: string) {
    value = next;
    onchange?.(next);
    announcement = message;
  }

  async function choose(entry: Entry) {
    if (entry.kind === 'option') {
      if (entry.option.disabled) return;
      const { value: picked, label: text } = entry.option;
      const removing = value.includes(picked);
      known[picked] = text;
      commit(removing ? value.filter((v) => v !== picked) : [...value, picked], `${text} ${removing ? 'quitado' : 'añadido'}. ${countLabel(removing ? value.length - 1 : value.length + 1)}`);
      query = '';
      await tick();
      setActive(Math.max(0, entries.findIndex((item) => item.kind === 'option' && item.option.value === picked)));
      return;
    }

    creating = true;
    try {
      const created = oncreate ? await oncreate(entry.text) : entry.text;
      if (!created) return;
      const option = typeof created === 'string' ? { value: created, label: created } : created;
      known[option.value] = option.label;
      if (!value.includes(option.value)) commit([...value, option.value], `${option.label} añadido. ${countLabel(value.length + 1)}`);
      query = '';
    } finally {
      creating = false;
    }
  }

  function countLabel(count: number) {
    return count === 1 ? '1 elegido.' : `${count} elegidos.`;
  }

  function chips() {
    return Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-combobox-chip]') ?? []);
  }

  async function removeAt(index: number, focusAfter: 'previous' | 'next' | 'input') {
    const removed = value[index];
    if (removed === undefined) return;
    commit(value.filter((_, i) => i !== index), `${labelOf(removed)} quitado. ${countLabel(value.length - 1)}`);
    await tick();
    const remaining = chips();
    const target = focusAfter === 'input' ? null : focusAfter === 'previous' ? remaining[index - 1] ?? remaining[index] : remaining[index] ?? remaining[index - 1];
    (target ?? element)?.focus();
  }

  function onInputKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) show();
        else setActive(enabledIndex(active + 1, 1) >= 0 ? enabledIndex(active + 1, 1) : active);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) hide();
        else if (!open) show();
        else setActive(enabledIndex(active - 1, -1) >= 0 ? enabledIndex(active - 1, -1) : active);
        break;
      case 'Enter':
        if (open && entries[active]) {
          event.preventDefault();
          choose(entries[active]);
        } else if (!open && query) {
          event.preventDefault();
          show();
        }
        break;
      case 'Escape':
        // Con la lista abierta, overlay.ts deja pasar este Escape (no cierra el diálogo).
        if (open) {
          event.preventDefault();
          hide();
        } else if (query) {
          event.preventDefault();
          query = '';
        }
        break;
      case 'Tab':
        hide();
        break;
      case 'Backspace':
      case 'ArrowLeft': {
        const input = event.currentTarget as HTMLInputElement;
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
        if (showChips && atStart && value.length) {
          event.preventDefault();
          hide();
          chips().at(-1)?.focus();
        }
        break;
      }
    }
  }

  function onInput() {
    if (!open) open = true;
    active = enabledIndex(0, 1);
  }

  function onChipKeydown(event: KeyboardEvent, index: number) {
    const list = chips();
    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        removeAt(index, 'previous');
        break;
      case 'Delete':
        event.preventDefault();
        removeAt(index, 'next');
        break;
      case 'ArrowLeft':
        event.preventDefault();
        list[Math.max(0, index - 1)]?.focus();
        break;
      case 'ArrowRight':
        event.preventDefault();
        (list[index + 1] ?? element)?.focus();
        break;
      case 'Escape':
      case 'ArrowDown':
        event.preventDefault();
        element?.focus();
        break;
    }
  }

  // Cerrar al tocar fuera del campo y de la lista (que vive en el portal).
  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root?.contains(target) && !popup?.contains(target)) hide();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  });

  // Número de resultados para lectores de pantalla, cuando se deja de escribir.
  $effect(() => {
    if (!open || !query.trim()) return;
    const count = results.length;
    const timer = window.setTimeout(() => {
      announcement = count === 0 ? emptyText : count === 1 ? '1 resultado.' : `${count} resultados.`;
    }, 500);
    return () => window.clearTimeout(timer);
  });
</script>

<div class="ui-combobox {className}" class:ui-combobox--error={!!error} class:ui-combobox--disabled={disabled} bind:this={root}>
  <label class="ui-combobox__label" class:sr-only={hideLabel} for={inputId}>
    {label}{#if optional}<span class="ui-combobox__optional">(opcional)</span>{/if}
  </label>
  <!-- Tocar cualquier punto del borde enfoca el campo; el teclado no lo necesita. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="ui-combobox__control"
    bind:this={control}
    role="presentation"
    onclick={(event) => {
      const target = event.target as Element;
      if (target.closest('[data-combobox-chip]')) return;
      element?.focus();
      // En el texto solo abre (para colocar el cursor sin cerrar); en el resto alterna.
      if (target === element || !open) show();
      else hide();
    }}
  >
    {#if showChips && value.length}
      <ul class="ui-combobox__chips" aria-label={`${label}: elegidos`}>
        {#each value as v, index (v)}
          <li>
            <Chip
              kind="filter"
              label={labelOf(v)}
              removeLabel={removeLabel(labelOf(v))}
              {disabled}
              tabindex="-1"
              data-combobox-chip
              onremove={(event: MouseEvent) => removeAt(index, event.detail === 0 ? 'previous' : 'input')}
              onkeydown={(event: KeyboardEvent) => onChipKeydown(event, index)}
            />
          </li>
        {/each}
      </ul>
    {/if}
    <input
      bind:this={element}
      bind:value={query}
      class="ui-combobox__input"
      id={inputId}
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      aria-required={required ? 'true' : undefined}
      {placeholder}
      {disabled}
      oninput={onInput}
      onkeydown={onInputKeydown}
    />
    <span class="ui-combobox__chevron" class:ui-combobox__chevron--open={open} aria-hidden="true"><Icon name="chevron-abajo" size="sm" /></span>
  </div>
  {#if hint}<p class="ui-combobox__hint" id={hintId}>{hint}</p>{/if}
  {#if error}<p class="ui-combobox__error" id={errorId}>{error}</p>{/if}
  <p class="sr-only" id={helpId}>Usa las flechas para recorrer las opciones e Intro para elegir.{#if showChips} Con el campo vacío, Retroceso lleva a los elegidos.{/if}</p>
  <div class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>

  {#if open && control}
    <div class="ui-combobox__popup" bind:this={popup} use:anchoredLayer={{ target: layerFor(control), trigger: control, matchWidth: true, gutter: 4 }}>
      <ul class="ui-combobox__list" id={listId} role="listbox" aria-label={label} aria-multiselectable="true">
        {#each entries as entry, index (entry.kind === 'option' ? `o:${entry.option.value}` : 'create')}
          {#if entry.kind === 'option'}
            {@const selected = value.includes(entry.option.value)}
            <!-- El teclado vive en el campo (aria-activedescendant); el clic es solo para puntero. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li
              class="ui-combobox__option"
              class:ui-combobox__option--active={index === active}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              aria-disabled={entry.option.disabled ? 'true' : undefined}
              onpointerdown={(event) => event.preventDefault()}
              onpointermove={() => !entry.option.disabled && active !== index && (active = index)}
              onclick={() => choose(entry)}
            >
              <span class="ui-combobox__check" aria-hidden="true">{#if selected}<Icon name="check" size="sm" />{/if}</span>
              <span class="ui-combobox__option-label">{entry.option.label}</span>
              {#if entry.option.hint}<span class="sr-only">, </span><span class="ui-combobox__option-hint">{entry.option.hint}</span>{/if}
            </li>
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li
              class="ui-combobox__option ui-combobox__option--create"
              class:ui-combobox__option--active={index === active}
              id={optionId(index)}
              role="option"
              aria-selected="false"
              aria-busy={creating ? 'true' : undefined}
              onpointerdown={(event) => event.preventDefault()}
              onpointermove={() => active !== index && (active = index)}
              onclick={() => choose(entry)}
            >
              <span class="ui-combobox__check" aria-hidden="true"><Icon name="agregar" size="sm" /></span>
              <span class="ui-combobox__option-label">{createLabel(entry.text)}</span>
            </li>
          {/if}
        {/each}
      </ul>
      {#if loading}
        <div class="ui-combobox__status"><LoadingIndicator size="sm" label="Buscando" /></div>
      {:else if !entries.length}
        <p class="ui-combobox__status">{query.trim() ? emptyText : 'No hay opciones.'}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ui-combobox { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }

  .ui-combobox__label { color: var(--color-texto-alto); font-size: var(--text-sm); font-weight: 600; line-height: 1.3; }
  .ui-combobox__optional { margin-left: .3em; color: var(--color-texto-tenue); font-weight: 400; }

  /* Mismo aspecto que Field. Los chips (32) dejan 5 px arriba y abajo dentro de 44. */
  .ui-combobox__control {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-2);
    min-height: var(--field-h-md);
    box-sizing: border-box;
    padding: calc((var(--field-h-md) - 2px - var(--chip-h-md)) / 2) calc(var(--space-3) + var(--icon-sm) + var(--space-2)) calc((var(--field-h-md) - 2px - var(--chip-h-md)) / 2) var(--space-2);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--control-radius);
    background: var(--color-superficie-1);
    cursor: text;
    transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard);
  }
  .ui-combobox__control:hover { border-color: var(--color-acento-border); }
  .ui-combobox__control:focus-within {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    border-color: var(--color-acento-border);
    box-shadow: var(--focus-ring);
    background: var(--color-superficie-2);
  }
  .ui-combobox--error .ui-combobox__control { border-color: var(--color-danger); }
  .ui-combobox--disabled .ui-combobox__control { border-color: var(--color-linea-sutil); background: transparent; cursor: not-allowed; }
  .ui-combobox--disabled .ui-combobox__label { color: var(--color-texto-tenue); }

  .ui-combobox__chips { display: contents; margin: 0; padding: 0; list-style: none; }
  .ui-combobox__chips li { display: flex; min-width: 0; max-width: 100%; }

  /* Ocupa la fila de un chip (32) pero su área llega a 44: el margen negativo la
     extiende sobre el padding del borde sin cambiar la altura del campo. */
  .ui-combobox__input {
    flex: 1 1 8rem;
    min-width: 8rem;
    height: var(--target-touch);
    margin-block: calc((var(--chip-h-md) - var(--target-touch)) / 2);
    padding: 0 0 0 var(--space-2);
    border: 0;
    background: transparent;
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    outline: none;
  }
  .ui-combobox__input::placeholder { color: var(--color-texto-tenue); opacity: 1; }
  .ui-combobox__input:disabled { color: var(--color-texto-desactivado); cursor: not-allowed; }

  /* Fuera del flujo: nunca baja de línea con los chips. Centrado en la primera fila. */
  .ui-combobox__chevron {
    position: absolute;
    top: calc((var(--field-h-md) - 2px - var(--icon-sm)) / 2);
    right: var(--space-3);
    display: flex;
    color: var(--color-texto-tenue);
    pointer-events: none;
    transition: transform var(--motion-fast) var(--ease-standard);
  }
  .ui-combobox__chevron--open { transform: rotate(180deg); color: var(--color-acento); }

  .ui-combobox__hint,
  .ui-combobox__error { margin: 0; font-size: var(--text-2xs); line-height: 1.45; }
  .ui-combobox__hint { color: var(--color-texto-tenue); }
  .ui-combobox__error { color: var(--color-danger-texto); font-weight: 600; }

  /* Lista en el portal (layerFor): nunca la recorta un contenedor con overflow. */
  .ui-combobox__popup {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    max-height: var(--listbox-max-h);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-1);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    background: var(--color-panel-raised);
    box-shadow: var(--shadow-flotante);
  }
  .ui-combobox__list { margin: 0; padding: 0; list-style: none; }

  .ui-combobox__option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-touch);
    padding: 0 var(--space-3) 0 var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-texto);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .ui-combobox__option--active { background: var(--color-superficie-2); box-shadow: inset 0 0 0 1px var(--color-acento-border); }
  .ui-combobox__option[aria-selected='true'] { color: var(--color-acento); }
  .ui-combobox__option[aria-disabled='true'] { color: var(--color-texto-tenue); cursor: default; }
  .ui-combobox__option--create { color: var(--color-acento-texto); }
  .ui-combobox__check { display: flex; flex: none; width: var(--icon-sm); }
  .ui-combobox__option-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .ui-combobox__option-hint { flex: none; color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  .ui-combobox__status { margin: 0; padding: var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); }

  @media (prefers-reduced-motion: reduce) {
    .ui-combobox__chevron { transition: none; }
  }
</style>
