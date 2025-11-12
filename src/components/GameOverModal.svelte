<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let score = 0;
  export let bestScore = 0;
  export let combo = 0;
  export let bestCombo = 0;
  export let isNewRecord = false;

  const dispatch = createEventDispatcher();

  const handleRetry = () => dispatch('retry');
</script>

{#if open}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="게임 오버 패널">
    <div class="modal-card">
      <header class="modal-header">
        <h2 class="modal-title">
          Game Over
        </h2>
        {#if isNewRecord}
          <p class="record-badge">✨ New Record ✨</p>
        {/if}
      </header>

      <section class="stats-grid">
        <article class="stat-card">
          <h3 class="stat-label">Score</h3>
          <p class="stat-value">{score} m</p>
          <p class="stat-sub">Best: {bestScore} m</p>
        </article>
        <article class="stat-card">
          <h3 class="stat-label">Max Combo</h3>
          <p class="stat-value">{combo}</p>
          <p class="stat-sub">Best: {bestCombo}</p>
        </article>
      </section>

      <footer class="modal-footer">
        <button type="button" class="modal-button primary" on:click={handleRetry}>
          Tap to Retry
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    --gameover-shadow: 0 1.6rem 4rem rgba(0, 0, 0, 0.4);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-right, env(safe-area-inset-right, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px))
      calc(var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-left, env(safe-area-inset-left, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px));
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(0.7rem);
  }

  .modal-card {
    width: min(calc(var(--app-vw, 100vw) * 0.85), 360px);
    max-width: 360px;
    max-height: 100%;
    padding: clamp(16px, calc(var(--app-vw, 100vw) * 0.045), 28px);
    border-radius: clamp(16px, calc(var(--app-vw, 100vw) * 0.04), 24px);
    background: rgba(22, 22, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: var(--gameover-shadow);
    display: flex;
    flex-direction: column;
    gap: clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 20px);
    align-items: center;
    overflow-y: auto;
  }

  .modal-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, calc(var(--app-vh, 100vh) * 0.015), 14px);
    text-align: center;
  }

  .modal-title {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #ffffff;
    font-size: clamp(1.3rem, calc(var(--app-vw, 100vw) * 0.055), 2rem);
  }

  .record-badge {
    margin: 0;
    padding: clamp(6px, calc(var(--app-vw, 100vw) * 0.02), 10px) clamp(14px, calc(var(--app-vw, 100vw) * 0.03), 20px);
    border-radius: clamp(12px, calc(var(--app-vw, 100vw) * 0.03), 18px);
    background: linear-gradient(135deg, #f7ce46 0%, #ffd867 100%);
    color: #2c2300;
    font-weight: 700;
    font-size: clamp(0.75rem, calc(var(--app-vw, 100vw) * 0.028), 0.9rem);
    box-shadow: 0 0.35rem 0.9rem rgba(247, 206, 70, 0.36);
  }

  .stats-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(10px, calc(var(--app-vw, 100vw) * 0.025), 16px);
  }

  .stat-card {
    padding: clamp(12px, calc(var(--app-vw, 100vw) * 0.03), 18px);
    border-radius: clamp(12px, calc(var(--app-vw, 100vw) * 0.03), 16px);
    background: rgba(32, 32, 40, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.12);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, calc(var(--app-vh, 100vh) * 0.01), 8px);
  }

  .stat-label {
    margin: 0;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.7);
    font-size: clamp(0.7rem, calc(var(--app-vw, 100vw) * 0.025), 0.85rem);
  }

  .stat-value {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    color: #ffffff;
    font-size: clamp(1.2rem, calc(var(--app-vw, 100vw) * 0.048), 1.8rem);
  }

  .stat-sub {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: clamp(0.7rem, calc(var(--app-vw, 100vw) * 0.025), 0.85rem);
  }

  .modal-footer {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .modal-button {
    width: 100%;
    max-width: 100%;
    padding: clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 16px);
    border-radius: clamp(12px, calc(var(--app-vw, 100vw) * 0.03), 16px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    background: rgba(55, 55, 65, 0.85);
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #ffffff;
    font-size: clamp(0.85rem, calc(var(--app-vw, 100vw) * 0.033), 1.05rem);
    cursor: pointer;
    transition: transform 0.18s ease, background 0.25s ease, border-color 0.25s ease;
  }

  .modal-button.primary {
    background: linear-gradient(135deg, #3a3a48 0%, #4a4a58 100%);
    border-color: rgba(255, 255, 255, 0.35);
  }

  .modal-button.primary:hover,
  .modal-button.primary:focus-visible {
    transform: translateY(-2px);
    background: linear-gradient(135deg, #515165 0%, #62627a 100%);
  }

  .modal-button.primary:active {
    transform: translateY(1px);
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

