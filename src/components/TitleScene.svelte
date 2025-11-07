<script>
  import { onMount, onDestroy } from 'svelte';
  import { sceneActions } from '../stores/sceneStore';
  import { soundSystem } from '../systems/soundSystem';

  let soundEnabled = true;
  let audioUnlocked = false;

  // localStorage에서 사운드 설정 불러오기
  onMount(async () => {
    const savedSoundMuted = localStorage.getItem('soundMuted');
    if (savedSoundMuted !== null) {
      soundEnabled = savedSoundMuted === 'false'; // muted false = enabled true
      soundSystem.setMuted(!soundEnabled);
    }
    
    // 오디오 잠금 해제 및 배경음 재생 시도
    const tryPlayBgm = async () => {
      if (!audioUnlocked && soundEnabled) {
        try {
          await soundSystem.unlock();
          soundSystem.play('titleBgm');
          audioUnlocked = true;
          console.log('타이틀 배경음악 재생 시작');
        } catch (error) {
          console.log('자동 재생 실패 (브라우저 정책), 사용자 제스처 대기 중...');
        }
      }
    };
    
    // 즉시 시도 (네이티브 앱에서는 성공)
    await tryPlayBgm();
    
    // 실패하면 첫 클릭/터치 대기 (웹 브라우저)
    if (!audioUnlocked) {
      const unlockOnGesture = async () => {
        await tryPlayBgm();
      };
      document.addEventListener('click', unlockOnGesture, { once: true });
      document.addEventListener('touchstart', unlockOnGesture, { once: true });
    }
  });
  
  onDestroy(() => {
    // 타이틀씬 떠날 때 타이틀 배경음 정지
    soundSystem.stop('titleBgm');
  });

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundSystem.setMuted(!soundEnabled);
    // localStorage에 저장 (soundMuted 키로 통일)
    localStorage.setItem('soundMuted', (!soundEnabled).toString());
    console.log('사운드 토글:', soundEnabled ? '켜짐' : '꺼짐');
    
    // 사운드 켜짐: 타이틀 배경음 재생
    if (soundEnabled) {
      soundSystem.play('titleBgm');
    } else {
      // 사운드 꺼짐: 타이틀 배경음 정지
      soundSystem.stop('titleBgm');
    }
  }

  async function startGame() {
    console.log('Start Game 버튼 클릭됨!');
    
    // 1. AudioContext 재개 (user gesture)
    if (soundSystem && typeof soundSystem.unlock === 'function') {
      await soundSystem.unlock();
    }
    
    // 2. 타이틀 배경음 정지 (즉시)
    soundSystem.stop('titleBgm');
    
    // 3. 씬 전환
    sceneActions.goToGame();
  }
</script>

<div class="start-screen">
  <!-- 사운드 토글 버튼 (우측 상단) -->
  <button class="sound-toggle" on:click={toggleSound} aria-label="소리 켜기/끄기">
    {#if soundEnabled}
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    {:else}
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    {/if}
  </button>

  <div class="start-content">
    <h1>바밧줄</h1>
    <button class="start-btn" on:click={startGame}>
      Start
    </button>
  </div>
</div>

<style>
  .start-screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000000; /* 검정 배경 */
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
  }

  .sound-toggle {
    position: absolute;
    top: 20px;
    right: 20px;
    background: transparent;
    border: 2px solid #FFFFFF;
    color: #FFFFFF;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 10;
  }

  .sound-toggle:hover {
    background: #FFFFFF;
    color: #000000;
    transform: scale(1.1);
  }

  .sound-toggle:active {
    transform: scale(0.95);
  }

  .start-content {
    text-align: center;
    color: #FFFFFF; /* 흰색 텍스트 */
  }

  .start-content h1 {
    font-family: 'Pretendard', 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 4rem;
    font-weight: 800;
    margin: 0 0 40px 0;
    letter-spacing: -0.02em;
  }

  .start-btn {
    font-family: 'Pretendard', 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #FFFFFF; /* 흰색 배경 */
    border: 2px solid #FFFFFF;
    color: #000000; /* 검정 텍스트 */
    padding: 18px 40px;
    font-size: 1.3rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .start-btn:hover {
    background: #000000;
    color: #FFFFFF;
  }

  .start-btn:active {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    .sound-toggle {
      width: 48px;
      height: 48px;
      top: 16px;
      right: 16px;
    }

    .sound-toggle svg {
      width: 24px;
      height: 24px;
    }

    .start-content h1 {
      font-size: 2.5rem;
    }

    .start-btn {
      padding: 16px 32px;
      font-size: 1.1rem;
    }
  }
</style>

