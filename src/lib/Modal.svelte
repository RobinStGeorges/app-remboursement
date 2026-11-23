<script lang="ts">
  // Fenêtre par-dessus l'écran (formulaires). Échap ou un appui à côté la ferme.
  import type { Snippet } from 'svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

  const titleId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  let box = $state<HTMLDivElement>();

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    };
    window.addEventListener('keydown', onKey);
    box?.querySelector<HTMLElement>('input, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="sheet fc-card" role="dialog" aria-modal="true" aria-labelledby={titleId} bind:this={box}>
    <div class="sheet-head">
      <h2 id={titleId}>{title}</h2>
      <button type="button" class="icon-btn" aria-label="Fermer" onclick={onclose}>✕</button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(0 0 0 / 0.45);
    padding: 0.5rem;
  }
  .sheet {
    width: 100%;
    max-width: 480px;
    max-height: calc(100dvh - 1rem);
    overflow-y: auto;
  }
  @media (min-height: 640px) {
    .backdrop {
      align-items: center;
    }
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  h2 {
    font-size: 1.25rem;
  }
</style>
