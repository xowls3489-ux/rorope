import * as PIXI from 'pixi.js';

interface Particle {
    graphics: PIXI.Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    visible: boolean;
    alpha: number;
    color?: number;
    size?: number;
    scale?: number;
}

/**
 * VFX 시스템: 필터 없이 가벼운 시각 효과 제공
 * - FX 전용 레이어로 렌더링 분리
 * - 파티클 풀 재사용
 * - 이벤트 기반 트리거
 */
export class VFXSystem {
    private fxLayer!: PIXI.Container;
    private particles: Particle[] = [];
    private readonly particlePoolSize = 50; // 30 -> 50으로 증가
    private stageAlpha: number = 1.0;

    /**
     * FX 레이어 초기화
     */
    initialize(stage: PIXI.Container): PIXI.Container {
        this.fxLayer = new PIXI.Container();
        this.fxLayer.name = 'fxLayer';
        (this.fxLayer as any).zIndex = 100;
        this.fxLayer.alpha = 1.0;
        stage.addChild(this.fxLayer);

        // 파티클 풀 생성
        this.createParticlePool();
        
        return this.fxLayer;
    }

    /**
     * 파티클 풀 생성 (재사용 가능한 30개의 점들)
     */
    private createParticlePool(): void {
        if (!this.fxLayer) return;

        this.particles = Array.from({ length: this.particlePoolSize }, () => {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xffffff);
            graphics.drawCircle(0, 0, 3); // 크기 증가: 2 -> 3
            graphics.endFill();
            graphics.visible = false;
            
            if (this.fxLayer) {
                this.fxLayer.addChild(graphics);
            }

            return {
                graphics,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                visible: false,
                alpha: 1.0,
                color: 0xffffff,
                size: 3,
                scale: 1.0
            };
        });
    }

    /**
     * 사용 가능한 파티클 찾기 및 스폰
     */
    spawnParticle(x: number, y: number, vx: number, vy: number, color: number = 0xffffff, size: number = 3): void {
        // fxLayer가 초기화되지 않았으면 리턴
        if (!this.fxLayer || !this.particles || this.particles.length === 0) return;

        const particle = this.particles.find(p => !p.visible && p.graphics);
        if (!particle || !particle.graphics) {
            // 사용 가능한 파티클이 없음 (모두 사용 중)
            return;
        }

        particle.x = x;
        particle.y = y;
        particle.vx = vx;
        particle.vy = vy;
        particle.alpha = 1.0;
        particle.color = color;
        particle.size = size;
        particle.scale = 1.0;
        particle.visible = true;
        
        // graphics 객체 설정 및 색상/크기 업데이트
        if (particle.graphics) {
            particle.graphics.clear();
            particle.graphics.beginFill(color);
            particle.graphics.drawCircle(0, 0, size);
            particle.graphics.endFill();
            particle.graphics.visible = true;
            particle.graphics.alpha = 1.0;
            particle.graphics.x = x;
            particle.graphics.y = y;
            particle.graphics.scale.set(1.0);
        }
    }

    /**
     * 여러 파티클 스폰 (착지 시 먼지 효과)
     */
    spawnDustParticles(x: number, y: number, count: number = 5): void {
        // fxLayer가 초기화되지 않았으면 리턴
        if (!this.fxLayer || !this.particles || this.particles.length === 0) {
            console.warn('[VFX] fxLayer 또는 particles가 초기화되지 않음');
            return;
        }

        console.log(`[VFX] 먼지 파티클 ${count}개 스폰:`, x, y);
        const colors = [0xffffff, 0xcccccc, 0xaaaaaa]; // 흰색 계열 다양한 톤
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 2 + Math.random() * 3;
            this.spawnParticle(x, y, vx, vy, color, size);
        }
    }

    /**
     * 로프 해제 시 파티클 효과
     */
    spawnReleaseParticles(x: number, y: number, vx: number, vy: number): void {
        // fxLayer가 초기화되지 않았으면 리턴
        if (!this.fxLayer || !this.particles || this.particles.length === 0) {
            console.warn('[VFX] fxLayer 또는 particles가 초기화되지 않음');
            return;
        }

        const count = 5 + Math.floor(Math.random() * 4); // 5~8개로 증가
        console.log(`[VFX] 로프 해제 파티클 ${count}개 스폰:`, x, y);
        const baseAngle = Math.atan2(vy, vx);
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.random() - 0.5) * 1.2;
            const speed = 4 + Math.random() * 5;
            const pvx = Math.cos(angle) * speed;
            const pvy = Math.sin(angle) * speed;
            const color = 0xffffff; // 흰색
            const size = 3 + Math.random() * 2;
            this.spawnParticle(x, y, pvx, pvy, color, size);
        }
    }

    /**
     * 로프 연결 시 "슉" 선 효과 (fxLayer에 그리기)
     */
    drawRopeAttachLine(fromX: number, fromY: number, toX: number, toY: number): void {
        // fxLayer가 초기화되지 않았으면 리턴
        if (!this.fxLayer) {
            console.warn('[VFX] fxLayer가 초기화되지 않음');
            return;
        }
        console.log('[VFX] 로프 연결 선 효과:', fromX, fromY, '->', toX, toY);

        const line = new PIXI.Graphics();
        
        // 외곽선 (넓고 투명)
        line.lineStyle(6, 0xffffff, 0.3);
        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        
        // 중심선 (얇고 선명)
        line.lineStyle(2, 0xffffff, 1.0);
        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        
        line.alpha = 1.0;
        this.fxLayer.addChild(line);

        // 페이드 아웃 후 제거
        const fadeDuration = 8; // 프레임 수
        let frames = 0;
        const fadeTick = () => {
            frames++;
            if (!line.parent) return; // 이미 제거된 경우
            line.alpha = Math.max(0, 1.0 - frames / fadeDuration);
            if (frames >= fadeDuration && this.fxLayer) {
                if (line.parent) {
                    this.fxLayer.removeChild(line);
                }
                line.destroy();
            }
        };

        // 애니메이션을 위한 커스텀 업데이트
        (line as any).vfxFade = fadeTick;
    }

    /**
     * 착지 시 원형 파동 효과
     */
    spawnLandingRipple(x: number, y: number): void {
        if (!this.fxLayer) return;

        const ripple = new PIXI.Graphics();
        ripple.lineStyle(3, 0xffffff, 0.8);
        ripple.drawCircle(0, 0, 10);
        ripple.x = x;
        ripple.y = y;
        ripple.alpha = 1.0;
        this.fxLayer.addChild(ripple);

        let frames = 0;
        const maxFrames = 20;
        const rippleTick = () => {
            frames++;
            if (!ripple.parent) return;
            
            const progress = frames / maxFrames;
            const scale = 1 + progress * 3; // 1 -> 4배 확대
            ripple.scale.set(scale);
            ripple.alpha = Math.max(0, 1.0 - progress);
            ripple.clear();
            ripple.lineStyle(3 * (1 - progress * 0.5), 0xffffff, 0.8 * (1 - progress));
            ripple.drawCircle(0, 0, 10);

            if (frames >= maxFrames) {
                if (ripple.parent) {
                    this.fxLayer.removeChild(ripple);
                }
                ripple.destroy();
            }
        };

        (ripple as any).vfxRipple = rippleTick;
    }

    /**
     * 로프 발사 시 스파크 효과
     */
    spawnRopeShootSpark(x: number, y: number, dirX: number, dirY: number): void {
        if (!this.fxLayer || !this.particles || this.particles.length === 0) return;

        const count = 4 + Math.floor(Math.random() * 3); // 4~6개
        for (let i = 0; i < count; i++) {
            const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.6;
            const speed = 5 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = 0xffff00; // 노란색 스파크
            const size = 2 + Math.random() * 2;
            this.spawnParticle(x, y, vx, vy, color, size);
        }
    }

    /**
     * 점수 획득 시 파티클 버스트 효과
     */
    spawnScoreBurst(x: number, y: number): void {
        if (!this.fxLayer || !this.particles || this.particles.length === 0) return;

        const count = 8 + Math.floor(Math.random() * 5); // 8~12개
        const colors = [0xffff00, 0xffaa00, 0xffffff, 0xffdd00]; // 노란색 계열
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 3 + Math.random() * 2;
            this.spawnParticle(x, y, vx, vy, color, size);
        }
    }

    /**
     * 로프 히트 플래시 (앵커 부착 시)
     */
    spawnRopeHitFlash(x: number, y: number): void {
        if (!this.fxLayer) return;

        // 중심 밝은 원 + 외곽 파동 효과
        const flash = new PIXI.Graphics();
        flash.beginFill(0xffffff, 1.0);
        flash.drawCircle(0, 0, 8);
        flash.endFill();
        flash.lineStyle(2, 0xffffff, 0.8);
        flash.drawCircle(0, 0, 12);
        flash.x = x;
        flash.y = y;
        flash.alpha = 1.0;
        this.fxLayer.addChild(flash);

        // 방사형 파티클 효과
        if (this.particles && this.particles.length > 0) {
            const count = 6;
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count;
                const speed = 6 + Math.random() * 4;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                const color = 0xffffff;
                const size = 3 + Math.random() * 2;
                this.spawnParticle(x, y, vx, vy, color, size);
            }
        }

        // 플래시 페이드 아웃
        let frames = 0;
        const maxFrames = 10;
        const flashTick = () => {
            frames++;
            if (!flash.parent) return;
            
            const progress = frames / maxFrames;
            flash.alpha = Math.max(0, 1.0 - progress);
            flash.scale.set(1 + progress * 2);

            if (frames >= maxFrames) {
                if (flash.parent) {
                    this.fxLayer.removeChild(flash);
                }
                flash.destroy();
            }
        };

        (flash as any).vfxFlash = flashTick;
    }

    /**
     * 로프 트레일 파티클 (풀링 중 로프를 따라 생성)
     */
    spawnRopeTrailParticles(playerX: number, playerY: number, anchorX: number, anchorY: number, combo: number = 0): void {
        if (!this.fxLayer || !this.particles || this.particles.length === 0) return;

        // 로프를 따라 2-3개의 파티클 생성
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const t = Math.random(); // 로프 상의 위치 (0 = 플레이어, 1 = 앵커)
            const x = playerX + (anchorX - playerX) * t;
            const y = playerY + (anchorY - playerY) * t;
            
            // 로프에 수직인 방향으로 약간 퍼지는 속도
            const dx = anchorX - playerX;
            const dy = anchorY - playerY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / len;
            const perpY = dx / len;
            
            const speed = 1 + Math.random() * 2;
            const vx = perpX * speed * (Math.random() - 0.5) * 2;
            const vy = perpY * speed * (Math.random() - 0.5) * 2;
            
            // 콤보가 높을수록 밝은 색상
            const brightness = Math.min(255, 200 + combo * 10);
            const color = (brightness << 16) | (brightness << 8) | brightness;
            const size = 2 + Math.random() * 1.5;
            
            this.spawnParticle(x, y, vx, vy, color, size);
        }
    }

    /**
     * 화면 흔들림 효과 (stage alpha 조절)
     */
    triggerScreenShake(stage: PIXI.Container): void {
        stage.alpha = 0.9;
        const restore = () => {
            stage.alpha = 1.0;
        };
        setTimeout(restore, 100);
    }

    /**
     * 콤보 성공 시 화면 깜빡임
     */
    triggerComboFlash(stage: PIXI.Container): void {
        stage.alpha = 0.85;
        const restore = () => {
            stage.alpha = 1.0;
        };
        setTimeout(restore, 150);
    }

    /**
     * 매 프레임 업데이트: 파티클 이동 및 페이드
     */
    update(): void {
        // fxLayer가 초기화되지 않았으면 리턴
        if (!this.fxLayer || !this.particles) return;

        // 파티클 업데이트
        for (const particle of this.particles) {
            if (!particle.visible || !particle.graphics) continue;

            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= 0.05;
            particle.vx *= 0.98; // 점진적 감속
            particle.vy *= 0.98;

            if (particle.alpha <= 0) {
                particle.visible = false;
                if (particle.graphics) {
                    particle.graphics.visible = false;
                }
            } else if (particle.graphics) {
                // 크기 변화 효과 (점진적으로 작아짐)
                if (particle.scale !== undefined) {
                    particle.scale = Math.max(0.3, particle.scale - 0.02);
                    particle.graphics.scale.set(particle.scale);
                }
                particle.graphics.x = particle.x;
                particle.graphics.y = particle.y;
                particle.graphics.alpha = particle.alpha;
            }
        }

        // fxLayer는 항상 완전히 불투명하게 유지 (개별 효과만 페이드)
        this.fxLayer.alpha = 1.0;

        // 레이어 내 모든 자식의 커스텀 업데이트 실행 (선 효과 페이드, 파동 효과 등)
        if (this.fxLayer.children) {
            this.fxLayer.children.forEach(child => {
                if ((child as any).vfxFade) {
                    (child as any).vfxFade();
                }
                if ((child as any).vfxRipple) {
                    (child as any).vfxRipple();
                }
                if ((child as any).vfxFlash) {
                    (child as any).vfxFlash();
                }
            });
        }
    }

    /**
     * 모든 VFX 초기화
     */
    reset(): void {
        if (!this.fxLayer || !this.particles) return;

        // 모든 파티클 숨기기
        this.particles.forEach(p => {
            p.visible = false;
            if (p.graphics) {
                p.graphics.visible = false;
            }
        });

        // fxLayer의 모든 자식 제거 (선 효과 등, 파티클은 유지)
        const particleGraphics = this.particles.map(p => p.graphics);
        this.fxLayer.children.slice().forEach(child => {
            if (!particleGraphics.includes(child as PIXI.Graphics)) {
                this.fxLayer.removeChild(child);
                child.destroy();
            }
        });

        this.fxLayer.alpha = 1.0;
    }

    /**
     * fxLayer 반환
     */
    getFxLayer(): PIXI.Container {
        return this.fxLayer;
    }
}

export const vfxSystem = new VFXSystem();

