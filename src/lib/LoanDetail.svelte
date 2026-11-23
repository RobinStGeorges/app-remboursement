<script lang="ts">
  // Vue d'un remboursement : reste à payer, bouton « Nouveau paiement », liste des paiements.
  import LoanForm from './LoanForm.svelte';
  import PaymentForm from './PaymentForm.svelte';
  import { formatAmount } from './money';
  import { formatDate } from './dates';
  import { knownCreditors, paymentsOf, remainingMessage, summarize, type Loan, type Payment } from './loans';
  import type { Actions } from './cloud';

  let {
    loan,
    loans,
    payments,
    loading,
    actions,
    onback,
  }: {
    loan: Loan | null;
    loans: Loan[];
    payments: Payment[];
    loading: boolean;
    actions: Actions;
    onback: () => void;
  } = $props();

  const list = $derived(loan ? paymentsOf(payments, loan.id) : []);
  const s = $derived(loan ? summarize(loan, payments) : null);

  let editingLoan = $state(false);
  /** null : fenêtre fermée ; 'new' : nouveau paiement ; sinon le paiement à modifier. */
  let paymentDialog = $state.raw<'new' | Payment | null>(null);
  const editedPayment = $derived(paymentDialog && paymentDialog !== 'new' ? paymentDialog : null);
  // Reste à payer sans compter le paiement en cours de modification.
  const remainingForDialog = $derived(
    loan && s ? Math.max(0, loan.totalCents - s.paidCents + (editedPayment?.amountCents ?? 0)) : 0,
  );
</script>

<div class="page">
  <div class="topbar">
    <button class="link-btn" onclick={onback}>← Remboursements</button>
    {#if loan}
      <button class="fc-btn" aria-label="Modifier le remboursement" onclick={() => (editingLoan = true)}>✏️</button>
    {/if}
  </div>

  {#if !loan}
    {#if loading}
      <p class="center fc-muted">Chargement…</p>
    {:else}
      <div class="fc-card stack center">
        <p>Ce remboursement n'existe plus (il a peut-être été supprimé).</p>
        <button class="fc-btn fc-btn-primary fc-btn-block" onclick={onback}>Retour à la liste</button>
      </div>
    {/if}
  {:else if s}
    <section class="hero" class:done={s.done}>
      <p class="hero-text">{remainingMessage(loan, s)}</p>
      <span class="progress" aria-hidden="true">
        <span style:width={`${loan.totalCents ? Math.min(100, (s.paidCents / loan.totalCents) * 100) : 100}%`}></span>
      </span>
      <p class="small">
        <strong>{loan.libelle}</strong> · {formatAmount(s.paidCents)} remboursés sur {formatAmount(loan.totalCents)}
        {#if loan.datePret}<br />Prêté le {formatDate(loan.datePret)}{/if}
      </p>
    </section>

    <button class="fc-btn fc-btn-primary fc-btn-block big" onclick={() => (paymentDialog = 'new')}>＋ Nouveau paiement</button>

    <h2 class="section">Paiements déjà effectués</h2>
    {#if list.length === 0}
      <p class="fc-muted center">Aucun paiement pour l'instant.</p>
    {:else}
      <ul class="list">
        {#each list as p (p.id)}
          <li>
            <button class="item fc-card" onclick={() => (paymentDialog = p)}>
              <span class="item-top">
                <span class="item-title">{formatAmount(p.amountCents)}</span>
                <span class="fc-muted small">{formatDate(p.date)}</span>
              </span>
              {#if p.description}<span class="small">{p.description}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

{#if loan && editingLoan}
  <LoanForm
    {loan}
    paymentCount={list.length}
    creditors={knownCreditors(loans)}
    onsave={(v) => {
      actions.updateLoan(loan.id, v);
      editingLoan = false;
    }}
    ondelete={() => {
      actions.deleteLoan(loan.id, list.map((p) => p.id));
      editingLoan = false;
      onback();
    }}
    onclose={() => (editingLoan = false)}
  />
{/if}

{#if loan && paymentDialog}
  {#key paymentDialog}
  <PaymentForm
    payment={editedPayment}
    remainingCents={remainingForDialog}
    onsave={(v) => {
      if (editedPayment) actions.updatePayment(editedPayment.id, v);
      else actions.createPayment(loan.id, v);
      paymentDialog = null;
    }}
    ondelete={editedPayment
      ? () => {
          if (editedPayment) actions.deletePayment(editedPayment.id);
          paymentDialog = null;
        }
      : undefined}
    onclose={() => (paymentDialog = null)}
  />
  {/key}
{/if}
