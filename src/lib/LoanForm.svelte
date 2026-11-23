<script lang="ts">
  // Création ou modification d'un prêt (somme totale, libellé, créditeur, date du prêt).
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';
  import { amountToInput } from './money';
  import { todayISO } from './dates';
  import { validateLoan, type Loan, type LoanInput } from './loans';

  let {
    loan = null,
    paymentCount = 0,
    creditors = [],
    onsave,
    ondelete,
    onclose,
  }: {
    loan?: Loan | null;
    paymentCount?: number;
    creditors?: string[];
    onsave: (v: LoanInput) => void;
    ondelete?: () => void;
    onclose: () => void;
  } = $props();

  // Valeurs de départ : copiées une fois à l'ouverture (la fenêtre est recréée à chaque ouverture).
  const start = untrack(() => loan);
  let montant = $state(start ? amountToInput(start.totalCents) : '');
  let libelle = $state(start?.libelle ?? '');
  let crediteur = $state(start?.crediteur ?? '');
  let date = $state(start?.datePret || todayISO());
  let errors = $state<Partial<Record<keyof LoanInput, string>>>({});
  let confirmDelete = $state(false);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const r = validateLoan({ montant, libelle, crediteur, date });
    if (!r.ok) {
      errors = r.errors;
      return;
    }
    onsave(r.value);
  }
</script>

<Modal title={loan ? 'Modifier le remboursement' : 'Nouveau remboursement'} {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <label class="field">
      <span>Somme totale à rembourser (€)</span>
      <input class="fc-input" inputmode="decimal" placeholder="ex. 500 ou 12,50" bind:value={montant} />
      {#if errors.totalCents}<span class="fc-error">{errors.totalCents}</span>{/if}
    </label>
    <label class="field">
      <span>Libellé</span>
      <input class="fc-input" placeholder="ex. Réparation voiture" bind:value={libelle} maxlength="80" />
      {#if errors.libelle}<span class="fc-error">{errors.libelle}</span>{/if}
    </label>
    <label class="field">
      <span>Créditeur (à qui rembourser)</span>
      <input class="fc-input" placeholder="ex. Maman" bind:value={crediteur} maxlength="60" list="creditors" autocomplete="off" />
      <datalist id="creditors">
        {#each creditors as c (c)}<option value={c}></option>{/each}
      </datalist>
      {#if errors.crediteur}<span class="fc-error">{errors.crediteur}</span>{/if}
    </label>
    <label class="field">
      <span>Date du prêt</span>
      <input class="fc-input" type="date" bind:value={date} />
      {#if errors.datePret}<span class="fc-error">{errors.datePret}</span>{/if}
    </label>
    <button class="fc-btn fc-btn-primary fc-btn-block">{loan ? 'Enregistrer' : 'Créer le remboursement'}</button>

    {#if loan && ondelete}
      {#if !confirmDelete}
        <button type="button" class="fc-btn fc-btn-block" onclick={() => (confirmDelete = true)}>Supprimer ce remboursement</button>
      {:else}
        <div class="confirm" role="alert">
          <p>
            Supprimer « {loan.libelle} »{paymentCount > 0
              ? ` et ses ${paymentCount} paiement${paymentCount > 1 ? 's' : ''}`
              : ''} ? C'est définitif, pour toute la famille.
          </p>
          <div class="row-btns">
            <button type="button" class="fc-btn" onclick={() => (confirmDelete = false)}>Annuler</button>
            <button type="button" class="fc-btn fc-btn-danger" onclick={ondelete}>Supprimer</button>
          </div>
        </div>
      {/if}
    {/if}
  </form>
</Modal>
