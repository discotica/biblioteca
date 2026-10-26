<script lang="ts">
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import { DEFAULT_PASSWORD_RULES, STRENGTH_LABELS, evaluatePassword, type PasswordRule } from './password';

  type Props = {
    label?: string;
    value?: string;
    /** new-password muestra reglas y fortaleza; current-password, no. */
    autocomplete?: 'new-password' | 'current-password';
    id?: string;
    name?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    rules?: PasswordRule[];
    /** Por defecto, solo con autocomplete="new-password". */
    showRules?: boolean;
    /** Se actualiza en vivo: true cuando se cumplen las reglas obligatorias. */
    valid?: boolean;
    class?: string;
    element?: HTMLInputElement;
    [attribute: string]: unknown;
  };

  let {
    label = 'Contraseña',
    value = $bindable(''),
    autocomplete = 'new-password',
    rules = DEFAULT_PASSWORD_RULES,
    showRules,
    valid = $bindable(false),
    element = $bindable(),
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const rulesId = `${uid}-rules`;
  const strengthId = `${uid}-strength`;
  const withRules = $derived(showRules ?? autocomplete === 'new-password');
  const evaluation = $derived(evaluatePassword(value ?? '', rules));
  let visible = $state(false);

  $effect(() => {
    valid = evaluation.valid;
  });
</script>

<Field
  bind:value
  bind:element
  {label}
  type={visible ? 'text' : 'password'}
  {autocomplete}
  autocapitalize="off"
  spellcheck="false"
  describedby={withRules ? `${rulesId} ${strengthId}` : undefined}
  {...rest}
>
  {#snippet end()}
    <IconButton
      icon={visible ? 'ojo-tachado' : 'ojo'}
      label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      size="sm"
      pressed={visible}
      tooltipAlign="end"
      disabled={!!rest.disabled}
      onclick={() => (visible = !visible)}
    />
  {/snippet}
  {#snippet below()}
    {#if withRules}
      <div class="ui-password">
        <div class="ui-password__strength" data-strength={evaluation.strength}>
          <span class="ui-password__meter" aria-hidden="true">
            {#each [1, 2, 3] as segment}
              <span class="ui-password__segment" class:ui-password__segment--on={evaluation.score >= segment}></span>
            {/each}
          </span>
          <span class="ui-password__strength-label" id={strengthId} aria-live="polite">
            {#if evaluation.strength !== 'vacia'}Fortaleza: {STRENGTH_LABELS[evaluation.strength]}{/if}
          </span>
        </div>
        <ul class="ui-password__rules" id={rulesId}>
          {#each evaluation.rules as rule (rule.id)}
            <li class="ui-password__rule" class:ui-password__rule--met={rule.met}>
              <span class="ui-password__mark">{#if rule.met}<Icon name="check" size="sm" />{:else}<span class="ui-password__pending"></span>{/if}</span>
              <span>
                {rule.label}{#if !rule.required}<span class="ui-password__advice">· recomendada</span>{/if}
                <span class="sr-only">{rule.met ? '(cumplida)' : '(pendiente)'}</span>
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/snippet}
</Field>

<style>
  .ui-password {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .ui-password__strength {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--space-4);
  }

  .ui-password__meter {
    display: grid;
    grid-template-columns: repeat(3, var(--space-6));
    gap: var(--space-1);
  }

  .ui-password__segment {
    height: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-3);
    transition: background var(--motion-base) var(--ease-standard);
  }
  [data-strength='debil'] .ui-password__segment--on { background: var(--color-danger); }
  [data-strength='aceptable'] .ui-password__segment--on { background: var(--color-aviso); }
  [data-strength='fuerte'] .ui-password__segment--on { background: var(--color-acento); }

  .ui-password__strength-label {
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
    font-weight: 600;
  }

  .ui-password__rules {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ui-password__rule {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    line-height: 1.45;
  }
  .ui-password__rule--met { color: var(--color-texto-alto); }
  .ui-password__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-sm);
    height: var(--icon-sm);
    color: var(--color-texto-tenue);
  }
  .ui-password__pending {
    width: var(--loader-dot-sm);
    height: var(--loader-dot-sm);
    border: 1.5px solid currentColor;
    border-radius: 50%;
  }
  .ui-password__rule--met .ui-password__mark { color: var(--color-acento); }
  .ui-password__advice { margin-left: .3em; color: var(--color-texto-tenue); }
</style>
