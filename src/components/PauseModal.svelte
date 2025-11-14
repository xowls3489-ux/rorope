<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { openGameCenterLeaderboard, isMinVersionSupported } from '@apps-in-toss/web-framework';
  import { isLeaderboardAvailable } from '../utils/platform';
  import { logger } from '../utils/logger';

  export let open = false;
  export let soundEnabled = true;

  const dispatch = createEventDispatcher();

  const handleResume = () => dispatch('resume');
  const handleSoundToggle = () => dispatch('toggle-sound');
  const handleShowTutorial = () => dispatch('show-tutorial');
  const handleResetRecords = () => dispatch('reset-records');

  // 리더보드 사용 가능 여부 확인 (토스 앱에서만 true)
  let isLeaderboardSupported = false;

  const leaderboardAvailable = isLeaderboardAvailable();
  console.log('🔍 리더보드 디버그:', {
    isLeaderboardAvailable: leaderboardAvailable,
    hasTossEvents: !!(typeof window !== 'undefined' && window.toss?.events),
    hasOnAudioFocusChanged: !!(typeof window !== 'undefined' && window.onAudioFocusChanged),
    hasTossWebBridge: !!(typeof window !== 'undefined' && window.TossWebBridge),
  });

  if (leaderboardAvailable) {
    try {
      isLeaderboardSupported = isMinVersionSupported({
        android: "5.221.0",
        ios: "5.221.0",
      });
      console.log('✅ 리더보드 지원 여부:', isLeaderboardSupported);
    } catch (error) {
      console.error('❌ 리더보드 버전 확인 실패:', error);
    }
  } else {
    console.log('❌ 토스 앱이 아님 - 리더보드 버튼 숨김');
  }

  const handleOpenLeaderboard = async () => {
    if (!isLeaderboardSupported) {
      console.warn('리더보드를 지원하지 않는 환경입니다.');
      return;
    }

    try {
      await openGameCenterLeaderboard();
      logger.log('리더보드 열림');
    } catch (error) {
      console.error('리더보드 열기 실패:', error);
    }
  };
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
        {#if isLeaderboardSupported}
          <button type="button" class="modal-button success" on:click={handleOpenLeaderboard}>
            🏆 리더보드
          </button>
        {/if}
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
      calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-right, env(safe-area-inset-right, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px))
      calc(var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)) + clamp(12px, calc(var(--app-vh, 100vh) * 0.025), 24px))
      calc(var(--app-safe-left, env(safe-area-inset-left, 0px)) + clamp(12px, calc(var(--app-vw, 100vw) * 0.025), 24px));
    background: rgba(10, 10, 12, 0.8);
    backdrop-filter: blur(0.6rem);
  }

  .modal-card {
    width: min(calc(var(--app-vw, 100vw) * 0.85), 360px);
    max-width: 360px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, calc(var(--app-vh, 100vh) * 0.02), 18px);
    padding: clamp(16px, calc(var(--app-vw, 100vw) * 0.045), 28px);
    border-radius: clamp(16px, calc(var(--app-vw, 100vw) * 0.04), 24px);
    background: rgba(20, 20, 26, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: var(--pause-modal-shadow);
    overflow-y: auto;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(0.65rem, 2.5vw, 1rem);
  }

  .modal-title {
    margin: 0;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    text-transform: uppercase;
    font-size: clamp(1.2rem, calc(var(--app-vw, 100vw) * 0.048), 1.8rem);
  }

  .modal-button {
    width: 100%;
    max-width: 100%;
    padding: clamp(10px, calc(var(--app-vh, 100vh) * 0.025), 16px);
    border-radius: clamp(10px, calc(var(--app-vw, 100vw) * 0.028), 14px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(40, 40, 48, 0.85);
    color: #ffffff;
    font-family: 'Pretendard', 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 700;
    font-size: clamp(0.82rem, calc(var(--app-vw, 100vw) * 0.03), 1rem);
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

  .modal-button.success {
    background: rgba(28, 96, 48, 0.82);
    border-color: rgba(127, 255, 159, 0.6);
    color: #d7ffe0;
  }

  .modal-button.success:hover,
  .modal-button.success:focus-visible {
    background: rgba(36, 120, 60, 0.9);
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
      gap: clamp(10px, calc(var(--app-vh, 100vh) * 0.02), 16px);
      padding: clamp(14px, calc(var(--app-vw, 100vw) * 0.04), 24px);
    }

    .modal-button {
      padding: clamp(8px, calc(var(--app-vh, 100vh) * 0.02), 12px);
      font-size: clamp(0.75rem, calc(var(--app-vw, 100vw) * 0.028), 0.9rem);
    }
  }
</style>

