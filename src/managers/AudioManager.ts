import { soundSystem } from '../systems/soundSystem';

/**
 * AudioManager
 * 사운드 재생 및 뮤트 설정 관리
 */
export class AudioManager {
    private isMuted: boolean = false;
    private volume: number = 0.5;

    constructor() {
        this.loadSettings();
    }

    /**
     * localStorage에서 사운드 설정 불러오기
     */
    private loadSettings(): void {
        const savedMuted = localStorage.getItem('soundMuted');
        const savedVolume = localStorage.getItem('soundVolume');

        if (savedMuted !== null) {
            this.isMuted = savedMuted === 'true';
            soundSystem.setMuted(this.isMuted);
        }

        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
            soundSystem.setVolume(this.volume);
        }
    }

    /**
     * 사운드 재생
     */
    public play(soundName: string): void {
        soundSystem.play(soundName);
    }

    /**
     * 사운드 정지
     */
    public stop(soundName: string): void {
        soundSystem.stop(soundName);
    }

    /**
     * 모든 사운드 정지
     */
    public stopAll(): void {
        soundSystem.stopAll();
    }

    /**
     * 뮤트 설정
     */
    public setMuted(muted: boolean): void {
        this.isMuted = muted;
        soundSystem.setMuted(muted);
        localStorage.setItem('soundMuted', muted.toString());
    }

    /**
     * 뮤트 토글
     */
    public toggleMute(): void {
        this.setMuted(!this.isMuted);
    }

    /**
     * 뮤트 상태 확인
     */
    public getMuted(): boolean {
        return this.isMuted;
    }

    /**
     * 볼륨 설정 (0.0 ~ 1.0)
     */
    public setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        soundSystem.setVolume(this.volume);
        localStorage.setItem('soundVolume', this.volume.toString());
    }

    /**
     * 볼륨 가져오기
     */
    public getVolume(): number {
        return this.volume;
    }

    /**
     * AudioContext 잠금 해제 (사용자 제스처 후 호출)
     */
    public async unlock(): Promise<void> {
        await soundSystem.unlock();
    }

    // 게임 이벤트별 사운드 재생 헬퍼 메서드
    
    public playRopeShoot(): void {
        this.play('ropeShoot');
    }

    public playRopeRelease(): void {
        this.play('ropeRelease');
    }

    public playLanding(): void {
        this.play('landing');
    }

    public playSwing(): void {
        this.play('swing');
    }

    public stopSwing(): void {
        this.stop('swing');
    }

    public playGameOver(): void {
        this.play('gameOver');
    }

    public playScore(): void {
        this.play('score');
    }

    public playJump(): void {
        this.play('jump');
    }
    
    public playHit(): void {
        this.play('hit');
    }
    
    public playComboUp(): void {
        this.play('comboUp');
    }

    public playBackground(): void {
        this.play('background');
    }

    public stopBackground(): void {
        this.stop('background');
    }
    
    /**
     * 배경음악 볼륨 별도 조절 (효과음과 독립적)
     */
    public setBackgroundVolume(volume: number): void {
        const bgSound = (soundSystem as any).sounds?.get('background');
        if (bgSound) {
            bgSound.volume(Math.max(0, Math.min(1, volume)));
        }
    }
    
    /**
     * 배경음악 페이드 인 (재생 + 페이드)
     */
    public fadeInBackground(duration: number = 1500): void {
        const bgSound = (soundSystem as any).sounds?.get('background');
        if (bgSound && !bgSound.playing()) {
            bgSound.volume(0); // 볼륨 0에서 시작
            bgSound.play();
            bgSound.fade(0, this.isMuted ? 0 : 0.15, duration); // 페이드 인
            console.log('배경음악 페이드 인 시작');
        }
    }
    
    /**
     * 배경음악 페이드 아웃
     */
    public fadeOutBackground(duration: number = 1000): void {
        const bgSound = (soundSystem as any).sounds?.get('background');
        if (bgSound) {
            bgSound.fade(0.15, 0, duration);
            setTimeout(() => {
                this.stopBackground();
            }, duration);
        }
    }
}

