<script lang="ts">
  // Affiché quand la session n'est pas prête : la connexion et le choix de famille se font sur le portail.
  import { signIn, toFrenchMessage } from 'famille-core';

  let { status }: { status: 'loading' | 'signedOut' | 'noFamily' } = $props();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function devSignIn(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      await signIn(email, password);
    } catch (err) {
      error = toFrenchMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page">
  <div class="title">
    <h1>Remboursements</h1>
    <p class="fc-muted">Qui doit combien, et à qui</p>
  </div>
  {#if status === 'loading'}
    <p class="center fc-muted">Chargement…</p>
  {:else}
    <div class="fc-card stack center">
      {#if status === 'signedOut'}
        <p>Connectez-vous depuis le portail pour suivre vos remboursements.</p>
      {:else}
        <p>Rejoignez ou créez une famille depuis le portail pour suivre vos remboursements.</p>
      {/if}
      <a class="fc-btn fc-btn-primary fc-btn-block" href="/">Aller au portail</a>
    </div>
    {#if import.meta.env.DEV && status === 'signedOut'}
      <form class="fc-card stack" onsubmit={devSignIn}>
        <p class="fc-muted">Connexion de développement</p>
        <input class="fc-input" type="email" placeholder="Adresse e-mail" bind:value={email} autocomplete="email" />
        <input class="fc-input" type="password" placeholder="Mot de passe" bind:value={password} autocomplete="current-password" />
        {#if error}<p class="fc-error">{error}</p>{/if}
        <button class="fc-btn fc-btn-block" disabled={busy}>Se connecter</button>
      </form>
    {/if}
  {/if}
</div>
