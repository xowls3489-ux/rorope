import { Howl, Howler } from 'howler';
import { userManager } from '../managers/UserManager';
import { logger } from '../utils/logger';
import { GAME_CONFIG } from '../core/config';

// 사운드 효과 클래스
export class SoundSystem {
  private sounds: Map<string, Howl> = new Map();
  private masterVolume: number = 0.5;
  private isMuted: boolean = false;
  private audioContextUnlocked: boolean = false;
  private soundsInitialized: boolean = false; // 사운드 초기화 성공 여부
  private focusPausedSounds: Set<string> = new Set();
  private soundSeekPositions: Map<string, number> = new Map(); // 일시정지 시 재생 위치 저장
  // 중복 재생/스팸 방지를 위한 최근 재생 시각
  private lastPlayedAt: Map<string, number> = new Map();
  // 사운드별 최소 재생 간격(ms) - config에서 가져옴
  private get minIntervalMs(): Record<string, number> {
    return GAME_CONFIG.soundIntervals;
  }

  constructor() {
    // iOS 백그라운드 오디오 문제 해결을 위해 autoSuspend 비활성화
    Howler.autoSuspend = false;

    // 사운드 초기화를 지연시켜 AudioContext 경고 방지
    this.setupAudioContextUnlock();
    // initSounds는 첫 번째 사용자 상호작용 후에 호출됨

    // 사용자별 사운드 설정 불러오기
    const savedSoundMuted = userManager.loadData('soundMuted');
    if (savedSoundMuted !== '') {
      this.isMuted = savedSoundMuted === 'true';
    }
  }

  private setupAudioContextUnlock(): void {
    // 사용자 제스처로 AudioContext 잠금 해제
    const unlockAudio = async () => {
      if (!this.audioContextUnlocked) {
        try {
          // 사운드 초기화 (첫 번째 사용자 상호작용에서)
          this.initSounds();

          // Howler.js의 AudioContext 잠금 해제
          if (Howler.ctx && Howler.ctx.state === 'suspended') {
            await Howler.ctx.resume();
          }
          this.audioContextUnlocked = true;
          logger.log('AudioContext unlocked!');
        } catch (error) {
          console.warn('Failed to unlock AudioContext:', error);
        }
      }
    };

    // 단순하고 효과적인 이벤트 리스너
    const unlockOnce = () => {
      unlockAudio();
      // 이벤트 리스너 제거
      document.removeEventListener('click', unlockOnce);
      document.removeEventListener('touchstart', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
    };

    // 여러 이벤트에 리스너 추가
    document.addEventListener('click', unlockOnce, { once: true });
    document.addEventListener('touchstart', unlockOnce, { once: true });
    document.addEventListener('keydown', unlockOnce, { once: true });

    // iOS 백그라운드 복귀 후 AudioContext 및 사운드 재개를 위한 추가 리스너
    const resumeAudioOnTouch = () => {
      // iOS는 동기적 콜스택 내에서 AudioContext.resume()을 호출해야 함
      // 사용자 제스처 이벤트 핸들러에서 동기적으로 resume() 호출 시작

      if (!this.audioContextUnlocked || !Howler.ctx || this.isMuted) {
        return;
      }

      const ctxState = Howler.ctx.state as string;

      // AudioContext가 running이 아니면 먼저 재개
      if (ctxState !== 'running') {
        // Promise를 반환하지만 동기적으로 호출 시작 (iOS 제스처 컨텍스트 유지)
        Howler.ctx.resume().then(() => {
          // AudioContext 재개 성공 후 일시정지된 사운드 재생
          if (this.focusPausedSounds.size > 0) {
            const successfullyResumed: string[] = [];
            this.focusPausedSounds.forEach(name => {
              const sound = this.sounds.get(name);
              if (sound && !sound.playing()) {
                try {
                  sound.play();
                  successfullyResumed.push(name);
                } catch (error) {
                  // 재생 실패 시 focusPausedSounds에 유지
                }
              }
            });
            // 성공한 사운드만 제거
            successfullyResumed.forEach(name => this.focusPausedSounds.delete(name));
          }
        }).catch(() => {
          // resume 실패는 무시
        });
      } else if (this.focusPausedSounds.size > 0) {
        // AudioContext는 이미 running - 사운드만 재생
        const successfullyResumed: string[] = [];
        this.focusPausedSounds.forEach(name => {
          const sound = this.sounds.get(name);
          if (sound && !sound.playing()) {
            try {
              sound.play();
              successfullyResumed.push(name);
            } catch (error) {
              // 재생 실패 시 focusPausedSounds에 유지
            }
          }
        });
        // 성공한 사운드만 제거
        successfullyResumed.forEach(name => this.focusPausedSounds.delete(name));
      }
    };

    // 터치/클릭 시마다 AudioContext 상태 확인 및 재개 시도
    // passive를 제거하여 동기적 콜스택 유지
    document.addEventListener('touchstart', resumeAudioOnTouch);
    document.addEventListener('touchend', resumeAudioOnTouch);
    document.addEventListener('click', resumeAudioOnTouch);
  }

  private initSounds(): void {
    try {
      // 로프 발사 사운드 (swing.wav)
      const ropeShootSound = new Howl({
      src: ['/sounds/sfx/swing.wav'],
      volume: 0.4,
      preload: true,
      html5: false,
    });

    // 플랫폼 히트 사운드 (hit.wav)
    const hitSound = new Howl({
      src: ['/sounds/sfx/hit.wav'],
      volume: 0.5,
      preload: true,
      html5: false,
    });
    
    // 콤보 증가 사운드 (comboup.wav)
    const comboUpSound = new Howl({
      src: ['/sounds/sfx/comboup.wav'],
      volume: 0.4,
      preload: true,
      html5: false,
    });
    
    // 10콤보 특별 사운드 (바밧~ 소리)
    const babat10ComboSound = new Howl({
      src: ['/sounds/sfx/babat.wav'],
      volume: 0.6,
      preload: true,
      html5: false,
      onloaderror: (_id, error) => {
        console.warn('babat.wav 로드 실패:', error);
      }
    });

    // 로프 해제 사운드 (프로그래매틱)
    const ropeReleaseSound = new Howl({
      src: [this.generateTone(330, 0.15), this.generateTone(440, 0.1)], // E4 + A4
      volume: 0.3,
      rate: 1.0
    });

    // 착지 사운드 (더 만족스러운 사운드)
    const landingSound = new Howl({
      src: [this.generateTone(220, 0.2), this.generateTone(330, 0.15)], // A3 + E4
      volume: 0.6,
      rate: 1.0
    });

    // 스윙 사운드 (더 부드러운 사운드)
    const swingSound = new Howl({
      src: [this.generateTone(110, 0.3)], // A2 음
      volume: 0.3,
      rate: 1.0,
      loop: true
    });

    // 게임 오버 사운드 (더 드라마틱한 사운드)
    const gameOverSound = new Howl({
      src: [this.generateTone(165, 0.5), this.generateTone(110, 0.3)], // E3 + A2
      volume: 0.7,
      rate: 0.8
    });

    // 점수 획득 사운드 (더 기쁜 사운드)
    const scoreSound = new Howl({
      src: [this.generateTone(440, 0.1), this.generateTone(550, 0.1), this.generateTone(660, 0.1)], // A4 + C#5 + E5
      volume: 0.4,
      rate: 1.2
    });

    // 게임 배경음악
    const backgroundMusic = new Howl({
      src: ['/sounds/bgm/loopbgm.wav'],
      volume: 0.15,
      loop: true,
      preload: true,
      autoplay: false,
      html5: false,
      onload: () => {
        logger.log('게임 배경음악 로드 완료');
      },
      onloaderror: (_id, error) => {
        console.warn('게임 배경음악 로드 실패:', error);
      }
    });
    
    // 타이틀 배경음악
    const titleMusic = new Howl({
      src: ['/sounds/bgm/titlebgm.mp3'],
      volume: 0.2,
      loop: true,
      preload: true,
      autoplay: false,
      html5: false,
      onload: () => {
        logger.log('타이틀 배경음악 로드 완료');
      },
      onloaderror: (_id, error) => {
        console.warn('타이틀 배경음악 로드 실패:', error);
      }
    });

    // 점프 사운드
    const jumpSound = new Howl({
      src: [this.generateTone(330, 0.1), this.generateTone(440, 0.1)], // E4 + A4
      volume: 0.3,
      rate: 1.0
    });

    // 파워업 사운드 (별 먹을 때)
    const powerupSound = new Howl({
      src: ['/sounds/sfx/powerup.wav'],
      volume: 0.6,
      preload: true,
      html5: false,
      onloaderror: (_id, error) => {
        console.warn('powerup.wav 로드 실패:', error);
      }
    });

      this.sounds.set('ropeShoot', ropeShootSound);
      this.sounds.set('hit', hitSound); // 플랫폼 히트
      this.sounds.set('comboUp', comboUpSound); // 콤보 증가
      this.sounds.set('babat10', babat10ComboSound); // 10콤보 특별 사운드
      this.sounds.set('ropeRelease', ropeReleaseSound);
      this.sounds.set('landing', landingSound);
      this.sounds.set('swing', swingSound);
      this.sounds.set('gameOver', gameOverSound);
      this.sounds.set('score', scoreSound);
      this.sounds.set('background', backgroundMusic); // 게임 배경음
      this.sounds.set('titleBgm', titleMusic); // 타이틀 배경음
      this.sounds.set('jump', jumpSound);
      this.sounds.set('powerup', powerupSound); // 파워업 별 수집

      this.soundsInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize sounds:', error);
      this.soundsInitialized = false;
    }
  }

  // 프로그래매틱 톤 생성 (Web Audio API 사용)
  private generateTone(frequency: number, duration: number): string {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
    }

    // 주의: source.start()를 호출하면 즉시 재생되므로 제거!
    // Howl이 나중에 재생할 것이므로 여기서는 데이터만 반환
    
    // Blob URL 생성 (실제로는 사용하지 않지만 Howl이 요구함)
    return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU0';
  }

  // 사운드 재생
  play(soundName: string): void {
    // 음소거 상태면 재생하지 않음
    if (this.isMuted) {
      return;
    }

    // 사운드 초기화 실패 시 재생하지 않음
    if (!this.soundsInitialized) {
      logger.log('Sounds not initialized, skipping sound:', soundName);
      return;
    }

    if (!this.audioContextUnlocked) {
      logger.log('AudioContext not unlocked yet, skipping sound:', soundName);
      return;
    }

    const sound = this.sounds.get(soundName);
    if (sound) {
      try {
        // 배경음악 특별 처리 (최적화)
        if (soundName === 'background' || soundName === 'titleBgm') {
          // 이미 재생 중이면 스킵 (중복 방지)
          if (sound.playing()) {
            logger.log(`${soundName} 이미 재생 중`);
            return;
          }
          // 배경음은 낮은 볼륨으로 재생
          const bgVolume = soundName === 'titleBgm' ? 0.2 : 0.15;
          sound.volume(this.isMuted ? 0 : bgVolume);
          sound.play();
          logger.log(`${soundName} 재생 시작`);
          return;
        }
        
        // 루프 사운드 중복 재생 방지
        if (sound.playing()) {
          if (soundName === 'swing') {
            sound.volume(this.isMuted ? 0 : this.masterVolume);
          }
          return;
        }

        // 최소 재생 간격 체크 (효과음)
        const now = performance.now();
        const last = this.lastPlayedAt.get(soundName) ?? 0;
        const minGap = this.minIntervalMs[soundName] ?? 80;
        if (now - last < minGap) {
          return; // 너무 짧은 간격의 중복 호출 차단
        }

        this.lastPlayedAt.set(soundName, now);

        sound.volume(this.isMuted ? 0 : this.masterVolume);
        sound.play();
      } catch (error) {
        console.warn('Failed to play sound:', soundName, error);
      }
    } else {
      console.warn('Sound not found:', soundName);
    }
  }

  // 사운드 정지
  stop(soundName: string): void {
    const sound = this.sounds.get(soundName);
    if (sound) {
      try {
        sound.stop();
      } catch (error) {
        console.warn('Failed to stop sound:', soundName, error);
      }
    }
  }

  // 볼륨 설정
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume(this.masterVolume);
    });
  }

  // 볼륨 가져오기
  getVolume(): number {
    return this.masterVolume;
  }

  // 음소거/해제
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.sounds.forEach(sound => sound.volume(0));
      this.focusPausedSounds.clear();
    } else {
      this.sounds.forEach(sound => sound.volume(this.masterVolume));
    }
  }

  // 음소거 상태 확인
  isMutedState(): boolean {
    return this.isMuted;
  }

  // AudioContext 잠금 해제 (외부에서 호출용)
  async unlock(): Promise<void> {
    if (!this.audioContextUnlocked) {
      try {
        // 사운드 초기화
        this.initSounds();
        
        // Howler.js의 AudioContext 잠금 해제
        if (Howler.ctx && Howler.ctx.state === 'suspended') {
          await Howler.ctx.resume();
        }
        this.audioContextUnlocked = true;
        logger.log('AudioContext unlocked via unlock() method!');
        
        // 음소거 상태 재적용
        if (this.isMuted) {
          this.sounds.forEach(sound => sound.volume(0));
        }
      } catch (error) {
        console.warn('Failed to unlock AudioContext:', error);
      }
    }
  }

  // 모든 사운드 정지
  stopAll(): void {
    this.sounds.forEach(sound => {
      sound.stop();
    });
    this.focusPausedSounds.clear();
  }

  private shouldAutoResume(name: string): boolean {
    return name === 'background' || name === 'titleBgm' || name === 'swing';
  }

  pauseForFocusLoss(): void {
    this.focusPausedSounds.clear();
    this.soundSeekPositions.clear();

    this.sounds.forEach((sound, name) => {
      if (sound.playing()) {
        try {
          if (this.shouldAutoResume(name)) {
            // iOS에서 pause()가 제대로 작동하지 않으므로 stop() 사용
            // loop 사운드는 재생 위치를 저장할 필요 없음 (어차피 처음부터 재생)
            sound.stop();
            this.focusPausedSounds.add(name);
          } else {
            // 자동 재개하지 않는 사운드는 그냥 pause
            sound.pause();
          }
        } catch (error) {
          console.warn('Failed to stop/pause sound on focus loss:', name, error);
        }
      }
    });
  }

  async resumeAfterFocusGain(): Promise<void> {
    if (this.isMuted) {
      this.focusPausedSounds.clear();
      return;
    }

    // iOS의 경우 visibilitychange 이벤트는 사용자 제스처가 아니므로
    // AudioContext.resume()과 sound.play()가 실패할 수 있음
    // focusPausedSounds를 유지하여 resumeAudioOnTouch에서 재시도하도록 함

    // AudioContext 재개 시도 (Android에서는 작동, iOS에서는 실패 가능)
    try {
      if (Howler.ctx) {
        const ctxState = Howler.ctx.state as string;

        // suspended 또는 interrupted 상태면 재개 시도
        if (ctxState === 'suspended' || ctxState === 'interrupted') {
          await Howler.ctx.resume();
        }
      }
    } catch (error) {
      // iOS에서는 실패 예상 - resumeAudioOnTouch에서 처리
    }

    // AudioContext가 running 상태라면 사운드 재생 시도 (Android용)
    // iOS에서는 실패하더라도 focusPausedSounds를 유지하여 터치 시 재시도
    if (Howler.ctx && Howler.ctx.state === 'running' && this.focusPausedSounds.size > 0) {
      const successfullyResumed: string[] = [];

      this.focusPausedSounds.forEach(name => {
        const sound = this.sounds.get(name);
        if (!sound) {
          return;
        }
        try {
          if (!sound.playing()) {
            sound.play();
            successfullyResumed.push(name);
          }
        } catch (error) {
          // iOS에서 실패 시 focusPausedSounds에 유지하여 터치 시 재시도
        }
      });

      // 성공적으로 재생된 사운드만 제거 (Android)
      successfullyResumed.forEach(name => {
        this.focusPausedSounds.delete(name);
      });
    }

    // focusPausedSounds에 남아있는 사운드는 resumeAudioOnTouch에서 재시도
  }
}

// 전역 사운드 시스템 인스턴스
export const soundSystem = new SoundSystem();
