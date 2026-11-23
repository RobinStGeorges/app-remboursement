<script lang="ts">
  // Ajout, modification ou suppression d'un paiement (somme, description, date).
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';
  import { amountToInput, formatAmount, parseAmount } from './money';
  import { todayISO } from './dates';
  import { validatePayment, type Payment, type PaymentInput } from './loans';

  let {
    payment = null,
    remainingCents,
    onsave,
    ondelete,
    onclose,
  }: {
    payment?: Payment | null;
    /** Reste à payer, hors ce paiement s'il est en cours de modification. */
    remainingCents: number;
    onsave: (v: PaymentInput) => void;
    ondelete?: () => void;
    onclose: () => void;
  } = $props();

  const start = untrack(() => payment);
  let montant = $state(start ? amountToInput(start.amountCents) : '');
  let description = $state(start?.description ?? '');
  let date = $state(start?.date || todayISO());
  let errors = $state<Partial<Record<keyof PaymentInput, string>>>({});
  let confirmDelete = $state(false);

  const typed = $derived(parseAmount(montant));
  const tooMuch = $derived(typed !== null && typed > remainingCents);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const r = validatePayment({ montant, description, date });
    if (!r.ok) {
      errors = r.errors;
      return;
    }
    onsave(r.value);
  }
</script>

<Modal title={payment ? 'Modifier le paiement' : 'Nouveau paiement'} {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <label class="field">
      <span>Somme remboursée (€)</span>
      <input class="fc-input" inputmode="decimal" placeholder="ex. 50" bind:value={montant} />
      {#if errors.amountCents}
        <span class="fc-error">{errors.amountCents}</span>
      {:else if tooMuch}
        <span class="fc-muted">Attention : c'est plus que le reste à rembourser ({formatAmount(remainingCents)}).</span>
      {/if}
    </label>
    {#if remainingCents > 0 && !payment}
      <button type="button" class="fc-btn" onclick={() => (montant = amountToInput(remainingCents))}>
        Tout le reste : {formatAmount(remainingCents)}
      </button>
    {/if}
    <label class="field">
      <span>Description <span class="fc-muted">(facultatif)</span></span>
      <input class="fc-input" placeholder="ex. Virement de mars" bind:value={description} maxlength="120" />
    </label>
    <label class="field">
      <span>Date du paiement</span>
      <input class="fc-input" type="date" bind:value={date} />
      {#if errors.date}<span class="fc-error">{errors.date}</span>{/if}
    </label>
    <button class="fc-btn fc-btn-primary fc-btn-block">{payment ? 'Enregistrer' : 'Ajouter le paiement'}</button>

    {#if payment && ondelete}
      {#if !confirmDelete}
        <button type="button" class="fc-btn fc-btn-block" onclick={() => (confirmDelete = true)}>Supprimer ce paiement</button>
      {:else}
        <div class="confirm" role="alert">
          <p>Supprimer ce paiement de {formatAmount(payment.amountCents)} ? C'est définitif.</p>
          <div class="row-btns">
            <button type="button" class="fc-btn" onclick={() => (confirmDelete = false)}>Annuler</button>
            <button type="button" class="fc-btn fc-btn-danger" onclick={ondelete}>Supprimer</button>
          </div>
        </div>
      {/if}
    {/if}
  </form>
</Modal>
