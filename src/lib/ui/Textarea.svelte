<script lang="ts">
  type Props = {
    label: string;
    value?: string;
    id?: string;
    name?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    optional?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
    rows?: number;
    /** Con maxlength se muestra el contador de caracteres. */
    maxlength?: number;
    hideLabel?: boolean;
    class?: string;
    element?: HTMLTextAreaElement;
    [attribute: string]: unknown;
  };

  let {
    label,
    value = $bindable(''),
    id,
    name,
    hint,
    error,
    required = false,
    optional = false,
    disabled = false,
    readonly = false,
    placeholder,
    rows = 4,
    maxlength,
    hideLabel = false,
    class: className = '',
    element = $bindable(),
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const inputId = $derived(id ?? `${uid}-textarea`);
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const countId = `${uid}-count`;
  const describedBy = $derived(
    [hint && hintId, error && errorId, maxlength && countId].filter(Boolean).join(' ') || undefined
  );
  const length = $derived(value?.length ?? 0);
</script>

<div class="ui-textarea {className}" class:ui-textarea--error={!!error} class:ui-textarea--disabled={disabled}>
  <label class="ui-textarea__label" class:sr-only={hideLabel} for={inputId}>
    {label}{#if optional}<span class="ui-textarea__optional">(opcional)</span>{/if}
  </label>
  <textarea
    bind:this={element}
    bind:value
    class="ui-textarea__input"
    id={inputId}
    {name}
    {rows}
    {required}
    {disabled}
    {readonly}
    {placeholder}
    {maxlength}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}
    {...rest}
  ></textarea>
  {#if hint || maxlength}
    <div class="ui-textarea__meta">
      {#if hint}<p class="ui-textarea__hint" id={hintId}>{hint}</p>{/if}
      {#if maxlength}
        <p class="ui-textarea__count" id={countId} class:ui-textarea__count--limit={length >= maxlength}>
          {length} de {maxlength}
        </p>
      {/if}
    </div>
  {/if}
  {#if error}<p class="ui-textarea__error" id={errorId}>{error}</p>{/if}
</div>

<style>
  .ui-textarea {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .ui-textarea__label {
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.3;
  }
  .ui-textarea__optional { margin-left: .3em; color: var(--color-texto-tenue); font-weight: 400; }

  .ui-textarea__input {
    width: 100%;
    min-height: calc(var(--field-h-md) * 2);
    box-sizing: border-box;
    padding: var(--space-3) var(--control-px-md);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--control-radius);
    background: var(--color-superficie-1);
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    line-height: 1.5;
    resize: vertical;
    transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard);
  }
  .ui-textarea__input::placeholder { color: var(--color-texto-tenue); opacity: 1; }
  .ui-textarea__input:hover:not(:disabled):not(:read-only) { border-color: var(--color-acento-border); }
  .ui-textarea__input:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    border-color: var(--color-acento-border);
    box-shadow: var(--focus-ring);
    background: var(--color-superficie-2);
  }
  .ui-textarea__input:read-only { background: transparent; border-style: dashed; resize: none; }
  .ui-textarea__input:disabled {
    border-color: var(--color-linea-sutil);
    background: transparent;
    color: var(--color-texto-desactivado);
    cursor: not-allowed;
    resize: none;
  }
  .ui-textarea--disabled .ui-textarea__label { color: var(--color-texto-tenue); }
  .ui-textarea--error .ui-textarea__input { border-color: var(--color-danger); }

  .ui-textarea__meta {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .ui-textarea__hint,
  .ui-textarea__count,
  .ui-textarea__error {
    margin: 0;
    font-size: var(--text-2xs);
    line-height: 1.45;
  }
  .ui-textarea__hint { color: var(--color-texto-tenue); }
  .ui-textarea__count { margin-left: auto; color: var(--color-texto-tenue); font-variant-numeric: tabular-nums; }
  .ui-textarea__count--limit { color: var(--color-aviso); }
  .ui-textarea__error { color: var(--color-danger-texto); font-weight: 600; }
</style>
