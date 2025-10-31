import * as PIXI from 'pixi.js';
import { gameActions, playerState, ropeState, platforms } from '../stores/gameStore';
import { vfxSystem } from './vfxSystem';

export class RopeSystem {
    launchFromClick(app: PIXI.Application, world: PIXI.Container, clientX: number, clientY: number, shootSpeed: number = 2200, maxLength: number = 700): void {
        const playerPos = playerState.get();
        const rect = (app.view as HTMLCanvasElement).getBoundingClientRect();
        const worldClickX = clientX - rect.left - world.x;
        const worldClickY = clientY - rect.top - world.y;

        const dx = worldClickX - playerPos.x;
        const dy = worldClickY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 30) {
            console.log('[로프] 클릭 거리 너무 가까움:', distance.toFixed(1));
            return;
        }
        console.log('[로프] 발사:', { distance: distance.toFixed(1), dx: dx.toFixed(1), dy: dy.toFixed(1) });

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
            gameActions.stopRopeFlight();
            return;
        }

        const currentPlatforms = platforms.get();
        let hitPoint: { x: number; y: number } | null = null;

        for (const platform of currentPlatforms) {
            const pg = platform as PIXI.Graphics & { width: number };
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
                        break;
                    }
                }
            }

            if (!hitPoint) {
                const tipX = nextX;
                const tipY = nextY;
                if (tipX >= left && tipX <= right && tipY >= top && tipY <= bottom) {
                    hitPoint = { x: Math.min(Math.max(tipX, left), right), y: top };
                    break;
                }
            }
        }

        if (hitPoint) {
            const anchorX = hitPoint.x;
            const anchorY = hitPoint.y;
            const length = Math.hypot(playerPos.x - anchorX, playerPos.y - anchorY);
            gameActions.attachRope(anchorX, anchorY, length);
            // 스윙 대신 풀링 시작
            // 풀링 시작 시 속도 안정화 (기존 속도 유지하되 제한)
            const currentVx = playerPos.velocityX;
            const currentVy = playerPos.velocityY;
            const stabilizedVx = Math.max(-8, Math.min(8, currentVx * 0.4));
            const stabilizedVy = Math.max(-12, Math.min(12, currentVy * 0.4));
            gameActions.updatePlayerVelocity(stabilizedVx, stabilizedVy);
            gameActions.startPull(1300);
            
            // 이벤트: 로프 연결 시 VFX 트리거
            vfxSystem.drawRopeAttachLine(playerPos.x, playerPos.y, anchorX, anchorY);
            
            return;
        }

        gameActions.updateRopeTip(nextX, nextY);
    }

    drawRope(graphics: PIXI.Graphics, ropeColor: number = 0xFFFFFF): void {
        const rope = ropeState.get();
        const playerPos = playerState.get();

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
        
        // 이중 라인 효과 (필터 없이): 외곽선 + 중심선
        if (rope.isFlying) {
            const tipX = rope.tipX ?? playerPos.x;
            const tipY = rope.tipY ?? playerPos.y;
            // 외곽선 (넓고 투명)
            graphics.lineStyle(6, ropeColor, 0.1);
            graphics.moveTo(playerPos.x, playerPos.y);
            graphics.lineTo(tipX, tipY);
            // 중심선 (얇고 선명)
            graphics.lineStyle(2, ropeColor, 1);
            graphics.moveTo(playerPos.x, playerPos.y);
            graphics.lineTo(tipX, tipY);
        } else if (rope.isActive) {
            // 외곽선 (넓고 투명)
            graphics.lineStyle(6, ropeColor, 0.1);
            graphics.moveTo(playerPos.x, playerPos.y);
            graphics.lineTo(rope.anchorX, rope.anchorY);
            // 중심선 (얇고 선명)
            graphics.lineStyle(2, ropeColor, 1);
            graphics.moveTo(playerPos.x, playerPos.y);
            graphics.lineTo(rope.anchorX, rope.anchorY);
        }
    }
}

export const ropeSystem = new RopeSystem();


