<script lang="ts">
  export let legend: string;
  export let values: string[] = [''];
  export let required = false;
  export let help = '';
  export let error = '';
  export let addLabel = 'Añadir';
  export let placeholder = '';

  let inputs: HTMLInputElement[] = [];
  $: fieldId = legend.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');

  function update(index: number, value: string) {
    values = values.map((item, itemIndex) => itemIndex === index ? value : item);
  }

  function add() {
    values = [...values, ''];
    requestAnimationFrame(() => inputs.at(-1)?.focus());
  }

  function remove(index: number) {
    if (values.length === 1) {
      values = [''];
      inputs[0]?.focus();
      return;
    }
    values = values.filter((_, itemIndex) => itemIndex !== index);
    requestAnimationFrame(() => inputs[Math.min(index, inputs.length - 1)]?.focus());
  }
</script>

<fieldset class:error-state={error} aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}>
  <legend>{legend}{#if required}<span aria-hidden="true"> *</span><span class="sr-only"> obligatorio</span>{/if}</legend>
  {#if help}<p class="help" id={`${fieldId}-help`}>{help}</p>{/if}
  <div class="list">
    {#each values as value, index (index)}
      <div class="row">
        <label class="sr-only" for={`${fieldId}-${index}`}>{legend}, entrada {index + 1}</label>
        <input
          id={`${fieldId}-${index}`}
          bind:this={inputs[index]}
          value={value}
          on:input={(event) => update(index, event.currentTarget.value)}
          {placeholder}
          aria-invalid={error ? 'true' : undefined}
        />
        <button class="ui-icon-button remove" type="button" on:click={() => remove(index)} aria-label={`Quitar ${legend.toLowerCase()} ${index + 1}`}>×</button>
      </div>
    {/each}
  </div>
  <button class="ui-button ui-button--discreet add" type="button" on:click={add}>+ {addLabel}</button>
  {#if error}<p class="field-error" id={`${fieldId}-error`}>{error}</p>{/if}
</fieldset>

<style>
  fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  legend { margin-bottom: .55rem; font-size: var(--text-sm); font-weight: 750; }
  legend span:first-of-type { color: var(--color-acento); }
  .help { margin: -.3rem 0 .65rem; color: var(--color-texto-tenue); font-size: var(--text-2xs); line-height: 1.45; }
  .list { display: grid; gap: .55rem; }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) var(--target-touch); gap: .4rem; }
  input { box-sizing: border-box; width: 100%; min-height: var(--target-touch); padding: .7rem .8rem; border: 1px solid var(--color-linea-fuerte); border-radius: var(--radius-sm); background: var(--color-superficie-2); color: var(--color-texto); font: inherit; }
  input[aria-invalid="true"] { border-color: var(--color-danger); }
  .remove { color: var(--color-texto-tenue); font-size: var(--text-xl); }
  .add { margin-top: .35rem; padding-left: .15rem; color: var(--color-acento); }
  .field-error { margin: .35rem 0 0; color: var(--color-danger-texto); font-size: var(--text-2xs); }
</style>
