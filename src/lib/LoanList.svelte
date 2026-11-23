<script lang="ts">
  // Accueil : liste des remboursements, en cours d'abord.
  import LoanForm from './LoanForm.svelte';
  import { formatAmount } from './money';
  import { formatDate } from './dates';
  import { knownCreditors, summarize, type Loan, type Payment } from './loans';
  import type { Actions } from './cloud';

  let {
    loans,
    payments,
    loading,
    familyName,
    actions,
    onopen,
  }: {
    loans: Loan[];
    payments: Payment[];
    loading: boolean;
    familyName: string;
    actions: Actions;
    onopen: (id: string) => void;
  } = $props();

  let creating = $state(false);
  const creditors = $derived(knownCreditors(loans));
</script>

<div class="page">
  <div class="topbar">
    <a class="link-btn" href="/">← Portail</a>
    <span class="chip">🏠 {familyName}</span>
  </div>
  <div class="title">
    <h1>Remboursements</h1>
    <p class="fc-muted">Qui doit combien, et à qui</p>
  </div>

  <button class="fc-btn fc-btn-primary fc-btn-block big" onclick={() => (creating = true)}>＋ Nouveau remboursement</button>

  {#if loading}
    <p class="center fc-muted">Chargement…</p>
  {:else if loans.length === 0}
    <div class="fc-card center">
      <p>Aucun remboursement pour l'instant.</p>
      <p class="fc-muted">Créez-en un pour suivre ce qu'il reste à rendre.</p>
    </div>
  {:else}
    <ul class="list">
      {#each loans as loan (loan.id)}
        {@const s = summarize(loan, payments)}
        <li>
          <button class="item fc-card" class:done={s.done} onclick={() => onopen(loan.id)}>
            <span class="item-top">
              <span class="item-title">{loan.libelle}</span>
              {#if s.done}
                <span class="badge">✅ Remboursé</span>
              {:else}
                <span class="amount">{formatAmount(s.remainingCents)}</span>
              {/if}
            </span>
            <span class="fc-muted small">
              À {loan.crediteur}{loan.datePret ? ` · prêté le ${formatDate(loan.datePret)}` : ''}
            </span>
            <span class="progress" aria-hidden="true">
              <span style:width={`${loan.totalCents ? Math.min(100, (s.paidCents / loan.totalCents) * 100) : 100}%`}></span>
            </span>
            <span class="fc-muted small">{formatAmount(s.paidCents)} remboursés sur {formatAmount(loan.totalCents)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if creating}
  <LoanForm
    {creditors}
    onsave={(v) => {
      const id = actions.createLoan(v);
      creating = false;
      onopen(id);
    }}
    onclose={() => (creating = false)}
  />
{/if}
