<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from 'famille-core';
  import { registerSW } from 'virtual:pwa-register';
  import Gate from './lib/Gate.svelte';
  import LoanList from './lib/LoanList.svelte';
  import LoanDetail from './lib/LoanDetail.svelte';
  import { makeActions, watchLoans, watchPayments } from './lib/cloud';
  import { sortLoans, type Loan, type Payment } from './lib/loans';

  // ---------- Navigation par #/… ----------
  const parseHash = (): { route: 'liste' | 'pret'; id: string } => {
    const [head, id = ''] = location.hash.replace(/^#\/?/, '').split('/');
    return head === 'pret' && id ? { route: 'pret', id: decodeURIComponent(id) } : { route: 'liste', id: '' };
  };
  let nav = $state(parseHash());
  const goList = () => (location.hash = '#/');
  const goLoan = (id: string) => (location.hash = `#/pret/${encodeURIComponent(id)}`);

  // ---------- Session et données de la famille ----------
  const ready = $derived($session.status === 'ready' ? $session : null);
  const familyId = $derived(ready?.familyId ?? '');
  const uid = $derived(ready?.user.uid ?? '');

  let loans = $state.raw<Loan[]>([]);
  let payments = $state.raw<Payment[]>([]);
  let loansLoaded = $state(false);
  let paymentsLoaded = $state(false);
  let cloudError = $state('');

  // Réabonnement à chaque changement de famille (choisie sur le portail).
  $effect(() => {
    if (!familyId) return;
    loans = [];
    payments = [];
    loansLoaded = false;
    paymentsLoaded = false;
    const onError = (m: string) => {
      cloudError = m;
      loansLoaded = true;
      paymentsLoaded = true;
    };
    const stopLoans = watchLoans(familyId, (l) => ((loans = l), (loansLoaded = true)), onError);
    const stopPayments = watchPayments(familyId, (p) => ((payments = p), (paymentsLoaded = true)), onError);
    return () => {
      stopLoans();
      stopPayments();
    };
  });

  const actions = $derived(makeActions(familyId, uid, (m) => (cloudError = m)));
  const sorted = $derived(sortLoans(loans, payments));
  const loading = $derived(!loansLoaded || !paymentsLoaded);
  const current = $derived(nav.route === 'pret' ? (loans.find((l) => l.id === nav.id) ?? null) : null);

  // ---------- Bandeaux : mise à jour et hors connexion ----------
  let needRefresh = $state(false);
  let online = $state(navigator.onLine);
  let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

  onMount(() => {
    const onHash = () => (nav = parseHash());
    const onOnline = () => (online = true);
    const onOffline = () => (online = false);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    updateSW = registerSW({ onNeedRefresh: () => (needRefresh = true) });
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  });
</script>

{#if needRefresh}
  <div class="banner" role="status">
    <span>Nouvelle version disponible</span>
    <button class="fc-btn fc-btn-primary" onclick={() => updateSW?.(true)}>Mettre à jour</button>
  </div>
{/if}
{#if !online}
  <div class="banner offline" role="status">Hors connexion · vos modifications partiront au retour du réseau</div>
{/if}
{#if cloudError}
  <div class="banner" role="alert">
    <span class="fc-error">{cloudError}</span>
    <button class="fc-btn" onclick={() => (cloudError = '')}>OK</button>
  </div>
{/if}

{#if $session.status !== 'ready'}
  <Gate status={$session.status} />
{:else if nav.route === 'pret'}
  <LoanDetail loan={current} {loans} {payments} {loading} {actions} onback={goList} />
{:else}
  <LoanList loans={sorted} {payments} {loading} familyName={$session.familyName} {actions} onopen={goLoan} />
{/if}
