<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '확인';
  export let message = '이 작업을 진행하시겠습니까?';
  export let confirmText = '확인';
  export let cancelText = '취소';
  export let isDangerous = false;

  const dispatch = createEventDispatcher();

  const handleConfirm = () => {
    dispatch('confirm');
  };

  const handleCancel = () => {
    dispatch('cancel');
  };
</script>

{#if open}
  <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="confirm-card">
      <header class="confirm-header">
        <h2 id="confirm-title" class="confirm-title">{title}</h2>
      </header>

      <section class="confirm-body">
        <p class="confirm-message">{message}</p>
      </section>

      <footer class="confirm-footer">
        <button
          type="button"
          class="confirm-button secondary"
          on:click={handleCancel}
        >
          {cancelText}
        </button>
        <button
          type="button"
          class="confirm-button {isDangerous ? 'danger' : 'primary'}"
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    --confirm-modal-shadow: 0 1.5rem 3.5rem rgba(0, 0, 0, 0.4);
  }

  .confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-right, env(safe-area-inset-right, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px))
      calc(var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-left, env(safe-area-inset-left, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px));
    background: rgba(10, 10, 12, 0.85);
    backdrop-filter: blur(0.8rem);
  }

  .confirm-card {
    width: min(calc(var(--app-vw, 100vw) * 0.82), 340px);
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: clamp(14px, calc(var(--app-vh, 100vh) * 0.022), 20px);
    padding: clamp(18px, calc(var(--app-vw, 100vw) * 0.048), 30px);
    border-radius: clamp(18px, calc(var(--app-vw, 100vw) * 0.042), 26px);
    background: rgba(20, 20, 26, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: var(--confirm-modal-shadow);
  }

  .confirm-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: clamp(6px, calc(var(--app-vh, 100vh) * 0.01), 10px);
  }

  .confirm-title {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    font-size: clamp(1.1rem, calc(var(--app-vw, 100vw) * 0.044), 1.6rem);
    text-align: center;
  }

  .confirm-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(8px, calc(var(--app-vh, 100vh) * 0.015), 14px) 0;
  }

  .confirm-message {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
    font-size: clamp(0.88rem, calc(var(--app-vw, 100vw) * 0.035), 1.05rem);
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.88);
    text-align: center;
    word-break: keep-all;
  }

  .confirm-footer {
    display: flex;
    gap: clamp(0.6rem, 2.2vw, 0.85rem);
    padding-top: clamp(6px, calc(var(--app-vh, 100vh) * 0.01), 10px);
  }

  .confirm-button {
    flex: 1;
    padding: clamp(11px, calc(var(--app-vh, 100vh) * 0.026), 17px);
    border-radius: clamp(11px, calc(var(--app-vw, 100vw) * 0.03), 15px);
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: rgba(40, 40, 48, 0.85);
    color: #ffffff;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 700;
    font-size: clamp(0.85rem, calc(var(--app-vw, 100vw) * 0.032), 1.02rem);
    letter-spacing: 0.01em;
    text-align: center;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.25s ease, border-color 0.25s ease;
  }

  .confirm-button:hover,
  .confirm-button:focus-visible {
    border-color: rgba(255, 255, 255, 0.7);
    transform: translateY(-2px);
  }

  .confirm-button:active {
    transform: translateY(1px);
  }

  .confirm-button.primary {
    background: linear-gradient(135deg, #4a8dff 0%, #6ba8ff 100%);
    color: #0c1330;
    border-color: transparent;
  }

  .confirm-button.primary:hover,
  .confirm-button.primary:focus-visible {
    background: linear-gradient(135deg, #76b5ff 0%, #97c9ff 100%);
  }

  .confirm-button.secondary {
    background: rgba(50, 50, 58, 0.88);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.92);
  }

  .confirm-button.secondary:hover,
  .confirm-button.secondary:focus-visible {
    background: rgba(60, 60, 70, 0.92);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .confirm-button.danger {
    background: rgba(110, 30, 30, 0.88);
    border-color: rgba(255, 127, 127, 0.65);
    color: #ffd7d7;
  }

  .confirm-button.danger:hover,
  .confirm-button.danger:focus-visible {
    background: rgba(140, 38, 38, 0.94);
    border-color: rgba(255, 127, 127, 0.85);
  }

  @media (max-height: 640px) {
    .confirm-card {
      gap: clamp(12px, calc(var(--app-vh, 100vh) * 0.02), 18px);
      padding: clamp(16px, calc(var(--app-vw, 100vw) * 0.042), 26px);
    }

    .confirm-button {
      padding: clamp(9px, calc(var(--app-vh, 100vh) * 0.022), 14px);
      font-size: clamp(0.8rem, calc(var(--app-vw, 100vw) * 0.03), 0.95rem);
    }
  }
</style>
