import { Howl, Howler } from 'howler';

// 사운드 효과 클래스
export class SoundSystem {
  private sounds: Map<string, Howl> = new Map();
  private masterVolume: number = 0.5;
  private isMuted: boolean = false;
  private audioContextUnlocked: boolean = false;
  // 중복 재생/스팸 방지를 위한 최근 재생 시각
  private lastPlayedAt: Map<string, number> = new Map();
  // 사운드별 최소 재생 간격(ms) - 이 간격 내에서는 재생 안 함
  private minIntervalMs: Record<string, number> = {
    swing: 150, // 루프형: 자주 트리거되어도 150ms 내 중복 방지
    background: 2000, // 배경음: 사실상 한 번만
    landing: 120, // 착지 연타 방지
    score: 120, // 점수 연타 방지
    ropeShoot: 120,
    ropeRelease: 120,
    jump: 100,
    gameOver: 500
  };

  constructor() {
    // 사운드 초기화를 지연시켜 AudioContext 경고 방지
    this.setupAudioContextUnlock();
    // initSounds는 첫 번째 사용자 상호작용 후에 호출됨
    
    // localStorage에서 사운드 설정 불러오기
    const savedSoundEnabled = localStorage.getItem('soundEnabled');
    if (savedSoundEnabled !== null) {
      this.isMuted = savedSoundEnabled === 'false';
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
          console.log('AudioContext unlocked!');
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
  }

  private initSounds(): void {
    // 로프 발사 사운드 (더 역동적인 사운드)
    const ropeShootSound = new Howl({
      src: [this.generateTone(440, 0.1), this.generateTone(550, 0.1)], // A4 + C#5
      volume: 0.5,
      rate: 1.0
    });

    // 로프 해제 사운드
    const ropeReleaseSound = new Howl({
      src: [this.generateTone(330, 0.15), this.generateTone(440, 0.1)], // E4 + A4
      volume: 0.4,
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

    // 배경음악 (부드러운 루프)
    const backgroundMusic = new Howl({
      src: [this.generateTone(220, 0.5), this.generateTone(330, 0.5)], // A3 + E4
      volume: 0.2,
      rate: 1.0,
      loop: true
    });

    // 점프 사운드
    const jumpSound = new Howl({
      src: [this.generateTone(330, 0.1), this.generateTone(440, 0.1)], // E4 + A4
      volume: 0.3,
      rate: 1.0
    });

    this.sounds.set('ropeShoot', ropeShootSound);
    this.sounds.set('ropeRelease', ropeReleaseSound);
    this.sounds.set('landing', landingSound);
    this.sounds.set('swing', swingSound);
    this.sounds.set('gameOver', gameOverSound);
    this.sounds.set('score', scoreSound);
    this.sounds.set('background', backgroundMusic);
    this.sounds.set('jump', jumpSound);
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

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();

    // Blob URL 생성 (실제로는 사용하지 않지만 Howl이 요구함)
    return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWTgwOUarm7blmGgU0';
  }

  // 사운드 재생
  play(soundName: string): void {
    // 음소거 상태면 재생하지 않음
    if (this.isMuted) {
      return;
    }
    
    if (!this.audioContextUnlocked) {
      console.log('AudioContext not unlocked yet, skipping sound:', soundName);
      return;
    }
    
    const sound = this.sounds.get(soundName);
    if (sound) {
      try {
        // 배경/루프/단발음 중복 재생 방지: 이미 재생 중이면 스킵
        if (sound.playing()) {
          // 루프 사운드는 볼륨만 보정하고 종료
          if (soundName === 'background' || soundName === 'swing') {
            sound.volume(this.isMuted ? 0 : this.masterVolume);
          }
          return;
        }

        // 최소 재생 간격 체크
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
        console.log('AudioContext unlocked via unlock() method!');
        
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
  }
}

// 전역 사운드 시스템 인스턴스
export const soundSystem = new SoundSystem();
