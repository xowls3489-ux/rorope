import * as PIXI from 'pixi.js';
import { gameActions, playerState, ropeState, platforms, gameState } from '../stores/gameStore';
import { vfxSystem } from './vfxSystem';
import { soundSystem } from './soundSystem';
import { logger } from '../utils/logger';

export class RopeSystem {
    launchFromClick(app: PIXI.Application, world: PIXI.Container, clientX: number, clientY: number, shootSpeed: number = 2200, maxLength: number = 700): void {
        const playerPos = playerState.get();
        const rect = (app.view as HTMLCanvasElement).getBoundingClientRect();
        
        // 카메라 스케일 고려한 좌표 변환
        const scale = world.scale.x || 1.0;
        const worldClickX = (clientX - rect.left - world.x) / scale;
        const worldClickY = (clientY - rect.top - world.y) / scale;

        const dx = worldClickX - playerPos.x;
        const dy = worldClickY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 30) {
            logger.log('[로프] 클릭 거리 너무 가까움:', distance.toFixed(1));
            return;
        }
        logger.log('[로프] 발사:', { distance: distance.toFixed(1), dx: dx.toFixed(1), dy: dy.toFixed(1), worldX: world.x.toFixed(1), scale: scale.toFixed(2) });

        const dirLen = Math.max(1e-6, distance);
        const dirX = dx / dirLen;
        const dirY = dy / dirLen;

        gameActions.launchRope(playerPos.x, playerPos.y, dirX, dirY, shootSpeed, maxLength);
    }

    updateFlight(platformTopHeight: number, maxLengthFallback: number = 700, dt: number = 0.016): void {
        const rope = ropeState.get();
        const playerPos = playerState.get();

        const speed = rope.speed || 1200;
        const stepX = (rope.dirX || 0) * speed * dt;
        const stepY = (rope.dirY || 0) * speed * dt;

        const prevX = (rope.tipX ?? playerPos.x);
        const prevY = (rope.tipY ?? playerPos.y);
        const nextX = prevX + stepX;
        const nextY = prevY + stepY;

        const originX = playerPos.x;
        const originY = playerPos.y;
        const distFromOrigin = Math.hypot(nextX - originX, nextY - originY);
        if (distFromOrigin > (rope.maxLength || maxLengthFallback)) {
            // 로프가 최대 거리 도달 = 빗맞춤 → 콤보 리셋
            gameActions.resetCombo();
            gameActions.stopRopeFlight();
            return;
        }

        const currentPlatforms = platforms.get();
        let hitPoint: { x: number; y: number } | null = null;
        let hitPlatform: (PIXI.Graphics & { width: number; comboGiven?: boolean }) | null = null; // 히트한 플랫폼 추적

        for (const platform of currentPlatforms) {
            const pg = platform as PIXI.Graphics & { width: number; comboGiven?: boolean };
            const left = platform.x;
            const right = platform.x + pg.width;
            const top = platform.y;
            const bottom = platform.y + platformTopHeight;

            const denom = (nextY - prevY);
            if (Math.abs(denom) > 1e-6) {
                const t = (top - prevY) / denom;
                if (t >= 0 && t <= 1) {
                    const ix = prevX + (nextX - prevX) * t;
                    if (ix >= left && ix <= right) {
                        hitPoint = { x: ix, y: top };
                        hitPlatform = pg; // 히트한 플랫폼 저장
                        break;
                    }
                }
            }

            if (!hitPoint) {
                const tipX = nextX;
                const tipY = nextY;
                if (tipX >= left && tipX <= right && tipY >= top && tipY <= bottom) {
                    hitPoint = { x: Math.min(Math.max(tipX, left), right), y: top };
                    hitPlatform = pg; // 히트한 플랫폼 저장
                    break;
                }
            }
        }

        if (hitPoint && hitPlatform) {
            const anchorX = hitPoint.x;
            const anchorY = hitPoint.y;
            const length = Math.hypot(playerPos.x - anchorX, playerPos.y - anchorY);
            gameActions.attachRope(anchorX, anchorY, length);
            
            // 플랫폼 히트 사운드 재생
            soundSystem.play('hit');
            
            // 콤보 증가 (같은 플랫폼에는 1번만!)
            let shouldGiveCombo = false;
            if (!hitPlatform.comboGiven) {
                // 이 플랫폼에서 처음 콤보를 얻음
                hitPlatform.comboGiven = true;
                gameActions.addCombo();
                shouldGiveCombo = true;

                const game = gameState.get();
                const newCombo = game.combo || 0;

                // 콤보에 따른 점수 배율 계산
                // 1-9: x1, 10-19: x2, 20-29: x3, 30+: x4
                const scoreMultiplier = Math.min(4, Math.floor(newCombo / 10) + 1);
                const baseScore = 10;
                const earnedScore = baseScore * scoreMultiplier;
                gameActions.addScore(earnedScore);

                logger.log(`+${earnedScore}점 (${newCombo}콤보, x${scoreMultiplier})`);

                // 콤보 사운드 재생 (10의 배수일 때 특별 사운드)
                if (newCombo % 10 === 0 && newCombo > 0) {
                    // 10, 20, 30... 콤보 달성 시 "바밧~" 사운드
                    soundSystem.play('babat10');
                    logger.log(`🎉 ${newCombo} 콤보! x${scoreMultiplier} 배율!`);
                } else {
                    // 일반 콤보 증가 사운드
                    soundSystem.play('comboUp');
                }
            } else {
                // 이미 콤보를 받은 플랫폼
                logger.log('이미 콤보를 받은 플랫폼 - 콤보 증가 없음');
            }
            
            const game = gameState.get();
            const currentCombo = game.combo || 0;
            
            // 풀링 시작 시 속도를 0으로 리셋 (안전)
            // 풀링 로직이 속도를 올바르게 계산할 것임
            gameActions.updatePlayerVelocity(0, 0);
            gameActions.startPull(1300);
            
            // 이벤트: 로프 연결 시 VFX 트리거
            vfxSystem.drawRopeAttachLine(playerPos.x, playerPos.y, anchorX, anchorY);
            vfxSystem.spawnRopeHitFlash(anchorX, anchorY);
            
            // 콤보 VFX 효과 (콤보를 받았을 때만)
            if (shouldGiveCombo) {
                vfxSystem.spawnComboParticleBurst(playerPos.x, playerPos.y, currentCombo);
                vfxSystem.spawnComboShockwave(playerPos.x, playerPos.y, currentCombo);
            }
            
            return;
        }

        gameActions.updateRopeTip(nextX, nextY);
    }

    drawRope(graphics: PIXI.Graphics, _ropeColor: number = 0xFFFFFF): void {
        const rope = ropeState.get();
        const playerPos = playerState.get();
        const game = gameState.get();

        // 로프 가시성/알파 복구 (애니메이션에서 0으로 바뀐 경우 대비)
        const shouldShow = !!(rope.isFlying || rope.isActive);
        graphics.visible = shouldShow;
        if (!shouldShow) {
            graphics.clear();
            return;
        }

        graphics.alpha = 1;
        try {
            // 일부 환경에서 scale이 undefined일 수 있어 보호
            (graphics as any).scale?.set?.(1, 1);
        } catch {}

        graphics.clear();
        
        // 흑백 디자인: 콤보에 따라 두께와 글로우 강도만 증가
        const combo = game.combo || 0;
        const glowIntensity = 0.1 + combo * 0.02;
        const glowSize = 8 + combo * 1.5;
        
        // 그리기 (다층 글로우 효과 - 흑백)
        const drawRopeLine = (fromX: number, fromY: number, toX: number, toY: number) => {
            // 외곽 글로우 (흰색, 투명도로 강도 조절)
            graphics.lineStyle(glowSize, 0xFFFFFF, glowIntensity);
            graphics.moveTo(fromX, fromY);
            graphics.lineTo(toX, toY);
            
            graphics.lineStyle(glowSize * 0.7, 0xFFFFFF, glowIntensity * 1.5);
            graphics.moveTo(fromX, fromY);
            graphics.lineTo(toX, toY);
            
            // 중심선 (선명한 흰색)
            graphics.lineStyle(2 + combo * 0.3, 0xFFFFFF, 1);
            graphics.moveTo(fromX, fromY);
            graphics.lineTo(toX, toY);
        };
        
        if (rope.isFlying) {
            const tipX = rope.tipX ?? playerPos.x;
            const tipY = rope.tipY ?? playerPos.y;
            drawRopeLine(playerPos.x, playerPos.y, tipX, tipY);
        } else if (rope.isActive) {
            drawRopeLine(playerPos.x, playerPos.y, rope.anchorX, rope.anchorY);
            
            // 앵커 포인트 (심플하게)
            const anchorSize = 6 + combo * 0.5;
            
            // 외곽 글로우
            graphics.beginFill(0xFFFFFF, glowIntensity);
            graphics.drawCircle(rope.anchorX, rope.anchorY, anchorSize * 2);
            graphics.endFill();
            
            // 중심 점
            graphics.beginFill(0xFFFFFF, 1);
            graphics.drawCircle(rope.anchorX, rope.anchorY, anchorSize);
            graphics.endFill();
        }
    }
}

export const ropeSystem = new RopeSystem();


