import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';

// GSAP에 PixiJS 플러그인 등록
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

// 애니메이션 시스템 클래스
export class AnimationSystem {
  private timeline: gsap.core.Timeline;

  constructor() {
    this.timeline = gsap.timeline();
  }

  // 로프 발사 애니메이션
  ropeShootAnimation(player: PIXI.Graphics, rope: PIXI.Graphics): void {
    // 플레이어 약간 확대
    gsap.to(player, {
      pixi: { scale: 1.2 },
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.out"
    });

    // 로프 나타나는 애니메이션
    gsap.fromTo(rope, 
      { pixi: { alpha: 0, scale: 0.8 } },
      { 
        pixi: { alpha: 1, scale: 1 },
        duration: 0.2,
        ease: "back.out(1.7)"
      }
    );
  }

  // 로프 해제 애니메이션
  ropeReleaseAnimation(player: PIXI.Graphics, rope: PIXI.Graphics): void {
    // 로프 사라지는 애니메이션
    gsap.to(rope, {
      pixi: { alpha: 0, scale: 0.8 },
      duration: 0.15,
      ease: "power2.in"
    });

    // 플레이어 약간 회전
    gsap.to(player, {
      pixi: { rotation: 0.3 },
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.out"
    });
  }

  // 착지 애니메이션
  landingAnimation(player: PIXI.Graphics): void {
    // 안전장치: 플레이어가 사라지지 않도록 알파/스케일 복구
    gsap.set(player, { pixi: { alpha: 1, scale: 1, rotation: 0 } });
    // 착지 시 플레이어 바운스
    gsap.fromTo(player, 
      { pixi: { scale: 1.15 } },
      { 
        pixi: { scale: 1 },
        duration: 0.22,
        ease: "bounce.out"
      }
    );

    // 착지 효과: 전체 화면 플래시 대신 플레이어 주변 링 이펙트
    const ring = new PIXI.Graphics();
    ring.lineStyle(6, 0xFFFFFF, 0.7);
    ring.drawCircle(0, 0, 24);
    ring.endFill?.();
    ring.x = player.x;
    ring.y = player.y;
    ring.alpha = 0.8;
    player.parent.addChild(ring);

    gsap.fromTo(ring,
      { pixi: { scale: 0.8, alpha: 0.8 } },
      {
        pixi: { scale: 1.6, alpha: 0 },
        duration: 0.25,
        ease: "power2.out",
        onComplete: () => {
          player.parent.removeChild(ring);
          // 안전장치: 애니메이션 종료 후에도 플레이어 표시 상태 유지
          gsap.set(player, { pixi: { alpha: 1, scale: 1, rotation: 0 } });
        }
      }
    );
  }

  // 카메라 흔들림 애니메이션
  cameraShake(stage: PIXI.Container): void {
    gsap.to(stage.pivot, {
      x: stage.pivot.x + 10,
      duration: 0.05,
      yoyo: true,
      repeat: 3,
      ease: "power2.inOut"
    });
  }

  // 점수 증가 애니메이션
  scoreAnimation(scoreText: PIXI.Text): void {
    gsap.fromTo(scoreText, 
      { pixi: { scale: 1.5, alpha: 0.8 } },
      { 
        pixi: { scale: 1, alpha: 1 },
        duration: 0.3,
        ease: "back.out(1.7)"
      }
    );
  }

  // 게임 오버 애니메이션
  gameOverAnimation(gameOverText: PIXI.Text): void {
    gsap.fromTo(gameOverText, 
      { pixi: { scale: 0, alpha: 0, rotation: -0.5 } },
      { 
        pixi: { scale: 1, alpha: 1, rotation: 0 },
        duration: 0.5,
        ease: "back.out(1.7)"
      }
    );
  }

  // 플랫폼 생성 애니메이션
  platformSpawnAnimation(platform: PIXI.Graphics): void {
    gsap.fromTo(platform, 
      { pixi: { alpha: 0, scale: 0.8, y: platform.y + 50 } },
      { 
        pixi: { alpha: 1, scale: 1, y: platform.y },
        duration: 0.4,
        ease: "back.out(1.7)"
      }
    );
  }

  // 플레이어 스윙 애니메이션 (지속적)
  swingAnimation(player: PIXI.Graphics): void {
    gsap.to(player, {
      pixi: { rotation: 0.1 },
      duration: 0.5,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    });
  }

  // 스윙 애니메이션 정지
  stopSwingAnimation(player: PIXI.Graphics): void {
    gsap.killTweensOf(player);
    gsap.to(player, {
      pixi: { rotation: 0 },
      duration: 0.2,
      ease: "power2.out"
    });
  }

  // UI 페이드 인
  fadeInUI(element: PIXI.Container): void {
    gsap.fromTo(element, 
      { pixi: { alpha: 0, y: element.y - 20 } },
      { 
        pixi: { alpha: 1, y: element.y },
        duration: 0.3,
        ease: "power2.out"
      }
    );
  }

  // UI 페이드 아웃
  fadeOutUI(element: PIXI.Container): void {
    gsap.to(element, {
      pixi: { alpha: 0, y: element.y + 20 },
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        element.visible = false;
      }
    });
  }

  // 모든 애니메이션 정리
  cleanup(): void {
    this.timeline.kill();
    gsap.killTweensOf("*");
  }
}

// 전역 애니메이션 시스템 인스턴스
export const animationSystem = new AnimationSystem();
