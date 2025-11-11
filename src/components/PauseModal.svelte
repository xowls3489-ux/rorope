<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let soundEnabled = true;

  const dispatch = createEventDispatcher();

  const handleResume = () => dispatch('resume');
  const handleSoundToggle = () => dispatch('toggle-sound');
  const handleShowTutorial = () => dispatch('show-tutorial');
  const handleResetRecords = () => dispatch('reset-records');
</script>

{#if open}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="게임 일시정지 패널">
    <div class="modal-card">
      <header class="modal-header">
        <h2 class="modal-title">Paused</h2>
      </header>

      <section class="modal-body">
        <button type="button" class="modal-button" on:click={handleSoundToggle}>
          {soundEnabled ? '🔊 Sound: On' : '🔇 Sound: Off'}
        </button>
        <button type="button" class="modal-button secondary" on:click={handleShowTutorial}>
          📘 튜토리얼 다시보기
        </button>
        <button type="button" class="modal-button danger" on:click={handleResetRecords}>
          🗑️ 기록 초기화
        </button>
      </section>

      <footer class="modal-footer">
        <button type="button" class="modal-button primary" on:click={handleResume}>
          ▶ 게임 계속하기
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    --pause-modal-shadow: 0 1.5rem 3.5rem rgba(0, 0, 0, 0.35);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + clamp(16px, calc(var(--app-vh, 100vh) * 0.04), 36px))
      calc(var(--app-safe-right, env(safe-area-inset-right, 0px)) + clamp(16px, calc(var(--app-vw, 100vw) * 0.04), 36px))
      calc(var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)) + clamp(16px, calc(var(--app-vh, 100vh) * 0.04), 36px))
      calc(var(--app-safe-left, env(safe-area-inset-left, 0px)) + clamp(16px, calc(var(--app-vw, 100vw) * 0.04), 36px));
    background: rgba(10, 10, 12, 0.8);
    backdrop-filter: blur(0.6rem);
  }

  .modal-card {
    width: min(calc(var(--app-vw, 100vw) * 0.72), 360px);
    max-width: 360px;
    max-height: min(calc(var(--app-vh, 100vh) * 0.9), 90%);
    display: flex;
    flex-direction: column;
    gap: clamp(16px, calc(var(--app-vh, 100vh) * 0.035), 28px);
    padding: clamp(20px, calc(var(--app-vw, 100vw) * 0.06), 36px);
    border-radius: clamp(18px, calc(var(--app-vw, 100vw) * 0.045), 26px);
    background: rgba(20, 20, 26, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: var(--pause-modal-shadow);
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .modal-title {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    text-transform: uppercase;
    font-size: clamp(1.35rem, calc(var(--app-vw, 100vw) * 0.055), 2.1rem);
  }

  .modal-button {
    width: min(calc(var(--app-vw, 100vw) * 0.66), 320px);
    max-width: 100%;
    padding: clamp(14px, calc(var(--app-vh, 100vh) * 0.04), 22px);
    border-radius: clamp(12px, calc(var(--app-vw, 100vw) * 0.035), 18px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(40, 40, 48, 0.85);
    color: #ffffff;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 700;
    font-size: clamp(0.95rem, calc(var(--app-vw, 100vw) * 0.035), 1.15rem);
    letter-spacing: 0.01em;
    text-align: center;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.25s ease, border-color 0.25s ease;
  }

  .modal-button:hover,
  .modal-button:focus-visible {
    border-color: rgba(255, 255, 255, 0.75);
    transform: translateY(-2px);
  }

  .modal-button:active {
    transform: translateY(1px);
  }

  .modal-button.primary {
    background: linear-gradient(135deg, #4a8dff 0%, #6ba8ff 100%);
    color: #0c1330;
    border-color: transparent;
  }

  .modal-button.primary:hover,
  .modal-button.primary:focus-visible {
    background: linear-gradient(135deg, #76b5ff 0%, #97c9ff 100%);
  }

  .modal-button.secondary {
    background: rgba(44, 74, 128, 0.8);
    border-color: rgba(110, 157, 255, 0.6);
  }

  .modal-button.danger {
    background: rgba(96, 28, 28, 0.82);
    border-color: rgba(255, 127, 127, 0.6);
    color: #ffd7d7;
  }

  .modal-button.danger:hover,
  .modal-button.danger:focus-visible {
    background: rgba(120, 36, 36, 0.9);
  }

  @media (max-height: 640px) {
    .modal-card {
      gap: clamp(14px, calc(var(--app-vh, 100vh) * 0.03), 24px);
      padding: clamp(18px, calc(var(--app-vw, 100vw) * 0.055), 32px);
    }
  }
</style>

