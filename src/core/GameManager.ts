import * as PIXI from 'pixi.js';
import { gameState, playerState, ropeState, gameActions, platforms } from '../stores/gameStore';
import { soundSystem } from '../systems/soundSystem';
import { animationSystem } from '../systems/animationSystem';
import { ropeSystem } from '../systems/ropeSystem';
import { GAME_CONFIG, COLORS } from './config';

interface PlayerGraphics extends PIXI.Graphics { isOnPlatform?: boolean; platformY?: number; }
interface PlatformGraphics extends PIXI.Graphics { width: number; height: number; landed?: boolean; }

export class GameManager {
    private app!: PIXI.Application;
    private stage!: PIXI.Container;
    private world!: PIXI.Container;
    private bgLayer!: PIXI.Container;
    private player!: PlayerGraphics;
    private rope!: PIXI.Graphics;
    private scoreText!: PIXI.Text;
    private gameOverText!: PIXI.Text;
    private isSwingSoundPlaying: boolean = false;
    private cameraCenterX: number = GAME_CONFIG.width * 0.35;
    private worldX: number = 0;
    private targetWorldX: number = 0;
    private bgTiles: PIXI.Graphics[] = [];
    private bgTileWidth: number = 800;
    private bgSpeed: number = 0.4;

    constructor() { this.init(); }

    private async init(): Promise<void> {
        this.app = new PIXI.Application({ width: GAME_CONFIG.width, height: GAME_CONFIG.height, backgroundColor: COLORS.background, resizeTo: window, antialias: true });
        const gameRoot = document.getElementById('game-root');
        (gameRoot ?? document.body).appendChild(this.app.view as unknown as Node);
        this.stage = this.app.stage;
        this.world = new PIXI.Container(); this.world.name = 'world'; this.stage.addChild(this.world);
        ;(this.world as any).eventMode = 'static'; this.world.interactive = true; this.world.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);
        this.bgLayer = new PIXI.Container(); this.bgLayer.name = 'bgLayer'; this.stage.addChildAt(this.bgLayer, 0);
        this.initBackground(); this.initGameObjects(); this.initInput();
        this.app.ticker.add(this.update.bind(this)); this.app.ticker.maxFPS = 60;
    }

    private initBackground(): void { for (let i = 0; i < 2; i++) { const tile = new PIXI.Graphics(); tile.beginFill(COLORS.background); tile.drawRect(0, 0, this.bgTileWidth, GAME_CONFIG.height); tile.endFill(); tile.x = i * this.bgTileWidth; this.bgTiles.push(tile); this.bgLayer.addChild(tile); } }

    private initGameObjects(): void {
        this.player = new PIXI.Graphics() as PlayerGraphics; this.player.beginFill(0xFFFFFF); this.player.drawCircle(0, 0, 15); this.player.endFill(); this.world.addChild(this.player);
        this.player.x = 100; this.player.y = GAME_CONFIG.height - 180;
        this.rope = new PIXI.Graphics(); this.rope.visible = true; this.world.addChild(this.rope);
        this.scoreText = new PIXI.Text('Score: 0', { fontFamily: 'Pretendard, Inter, Roboto Mono, monospace', fontSize: 20, fill: COLORS.ui, align: 'center' });
        this.scoreText.x = GAME_CONFIG.width / 2; this.scoreText.y = 30; this.scoreText.anchor.set(0.5, 0.5); this.stage.addChild(this.scoreText);
        this.gameOverText = new PIXI.Text('GAME OVER\nTAP TO RETRY', { fontFamily: 'Pretendard, Inter, Roboto Mono, monospace', fontSize: 28, fill: COLORS.ui, align: 'center' });
        this.gameOverText.x = GAME_CONFIG.width / 2; this.gameOverText.y = GAME_CONFIG.height / 2; this.gameOverText.anchor.set(0.5, 0.5); this.gameOverText.visible = false; this.stage.addChild(this.gameOverText);
    }

    private initInput(): void {
        this.world.interactive = true;
        this.world.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            if (!currentState.isPlaying) { if (currentState.gameOver) { this.restartGame(); } return; }
            if (currentState.isSwinging) { this.releaseRope(); } else { this.shootRopeTowardPoint(event.clientX, event.clientY); }
        });
    }

    private shootRopeTowardPoint(clientX: number, clientY: number): void { ropeSystem.launchFromClick(this.app, this.world, clientX, clientY); if (this.player) { this.player.isOnPlatform = false; } soundSystem.play('ropeShoot'); }

    private releaseRope(): void {
        const currentState = gameState.get(); if (!currentState.isSwinging) return;
        gameActions.setSwinging(false);
        const playerPos = playerState.get(); const ropePos = ropeState.get(); const ropeLength = Math.max(1, ropePos.length || GAME_CONFIG.ropeLength);
        const swingSpeed = Math.sqrt(playerPos.angularVelocity * playerPos.angularVelocity * ropeLength);
        const velocityX = Math.sin(playerPos.swingAngle) * swingSpeed; const velocityY = Math.cos(playerPos.swingAngle) * swingSpeed;
        gameActions.updatePlayerVelocity(velocityX, velocityY);
        animationSystem.ropeReleaseAnimation(this.player, this.rope); soundSystem.play('ropeRelease');
    }

    private createPlatform(x: number, y: number): PlatformGraphics { const platform = new PIXI.Graphics() as PlatformGraphics; const width = GAME_CONFIG.platformWidth.min + Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min); platform.beginFill(COLORS.primary); platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0); platform.endFill(); platform.x = x; platform.y = y; platform.width = width; platform.height = GAME_CONFIG.platformHeight; this.world.addChild(platform); gameActions.addPlatform(platform); animationSystem.platformSpawnAnimation(platform); return platform; }

    private generateInitialPlatforms(): void { gameActions.clearPlatforms(); gameActions.updateCamera(0); const startingPlatform = this.createPlatform(50, GAME_CONFIG.height - 165); gameActions.updateCamera(50 + startingPlatform.width); let lastX = 50 + startingPlatform.width; for (let i = 0; i < 4; i++) { const gap = 250 + Math.random() * 100; lastX = lastX + gap; const y = 50 + Math.random() * 350; const platform = this.createPlatform(lastX, y); lastX = lastX + platform.width; gameActions.updateCamera(lastX); } }

    private startGame(): void { gameActions.startGame(); if (!this.player) { this.initGameObjects(); } this.player.x = 100; this.player.y = GAME_CONFIG.height - 180; gameActions.updatePlayerPosition(100, GAME_CONFIG.height - 180); gameActions.updatePlayerVelocity(0, 0); gameActions.updateSwingPhysics(0, 0); this.worldX = 0; this.targetWorldX = 0; this.world.x = 0; this.world.y = 0; this.generateInitialPlatforms(); this.updateScore(); this.gameOverText.visible = false; animationSystem.fadeInUI(this.scoreText); }
    public startGameFromUI(): void { this.startGame(); }
    public restartGameFromUI(): void { this.restartGame(); }
    private restartGame(): void { const currentPlatforms = platforms.get(); currentPlatforms.forEach(p => { this.world.removeChild(p); }); gameActions.clearPlatforms(); this.isSwingSoundPlaying = false; this.startGame(); }

    private updateScore(): void { const currentState = gameState.get(); this.scoreText.text = `Score: ${currentState.score}`; animationSystem.scoreAnimation(this.scoreText); }

    private update(): void {
        const currentState = gameState.get(); if (!currentState.isPlaying) return;
        try {
            const rope = ropeState.get(); if (rope.isFlying) { ropeSystem.updateFlight(GAME_CONFIG.platformHeight, 700, 0.016); } else if (rope.isPulling) { this.updatePullToAnchor(); } else if (currentState.isSwinging) { this.updateSwingPhysics(); } else { this.updateFreeFallPhysics(); }
            this.updatePlayerGraphics(); this.updateCamera(); this.updateBackground(); this.managePlatforms(); this.drawRope();
        } catch (e) { console.error('게임 업데이트 중 오류 발생:', e); gameActions.pauseGame(); }
        this.checkGameOver();
    }

    private updatePlayerGraphics(): void { if (!this.player) return; const playerPos = playerState.get(); this.player.x = playerPos.x; this.player.y = playerPos.y; this.player.visible = true; this.player.alpha = 1; try { (this.player as any).scale?.set?.(1, 1); } catch {} }

    private updateCamera(): void {
        const playerPos = playerState.get();
        this.targetWorldX = -(playerPos.x - this.cameraCenterX); this.targetWorldX = Math.max(this.targetWorldX, 0); this.worldX += (this.targetWorldX - this.worldX) * 0.12;
        const viewH = GAME_CONFIG.height; const deadZoneY = 120; const currentWorldY = this.world.y || 0; let targetWorldY = currentWorldY; const playerScreenY = playerPos.y + currentWorldY; const topBound = viewH / 2 - deadZoneY; const bottomBound = viewH / 2 + deadZoneY; if (playerScreenY < topBound) { targetWorldY += (topBound - playerScreenY); } else if (playerScreenY > bottomBound) { targetWorldY -= (playerScreenY - bottomBound); } const newWorldY = currentWorldY + (targetWorldY - currentWorldY) * 0.1;
        this.world.x = this.worldX; this.world.y = newWorldY; gameActions.updateCamera(-this.worldX);
    }

    private updateBackground(): void { const scrollX = this.worldX * this.bgSpeed; for (let i = 0; i < this.bgTiles.length; i++) { const tile = this.bgTiles[i]; const baseX = (i % 2) * this.bgTileWidth; tile.x = baseX - (scrollX % (this.bgTileWidth * 2)); } }

    private updatePullToAnchor(): void {
        const ropePos = ropeState.get(); const playerPos = playerState.get(); const dt = 0.016; const speed = ropePos.pullSpeed || 1200; const dx = ropePos.anchorX - playerPos.x; const dy = ropePos.anchorY - playerPos.y; const dist = Math.hypot(dx, dy);
        if (dist < Math.max(1, speed * dt)) { const targetX = ropePos.anchorX; const targetY = ropePos.anchorY - 15; gameActions.updatePlayerPosition(targetX, targetY); const runVx = Math.max(playerPos.velocityX, GAME_CONFIG.runSpeed); gameActions.updatePlayerVelocity(runVx, 0); gameActions.stopPull(); gameActions.setSwinging(false); ropeState.setKey('isActive', false); if (this.player) { this.player.isOnPlatform = true; this.player.platformY = targetY; } animationSystem.landingAnimation(this.player); soundSystem.play('landing'); gameActions.addScore(); this.updateScore(); return; }
        const stepX = (dx / dist) * speed * dt; const stepY = (dy / dist) * speed * dt; gameActions.updatePlayerPosition(playerPos.x + stepX, playerPos.y + stepY); gameActions.updatePlayerVelocity(stepX / dt, stepY / dt);
    }

    private updateSwingPhysics(): void {
        const playerPos = playerState.get(); const ropePos = ropeState.get(); const dt = 0.016; const ropeLength = Math.max(1, ropePos.length || GAME_CONFIG.ropeLength); const gravityForce = -GAME_CONFIG.gravity / ropeLength * Math.sin(playerPos.swingAngle); const dampingForce = -playerPos.angularVelocity * 0.995; const angularAcceleration = gravityForce + dampingForce; const newAngularVelocity = playerPos.angularVelocity + angularAcceleration * dt; const newSwingAngle = playerPos.swingAngle + newAngularVelocity * dt; const newX = ropePos.anchorX + Math.sin(newSwingAngle) * ropeLength; const newY = ropePos.anchorY + Math.cos(newSwingAngle) * ropeLength; gameActions.updatePlayerPosition(newX, newY); gameActions.updateSwingPhysics(newSwingAngle, newAngularVelocity); if (Math.abs(newAngularVelocity) > 0.5 && !this.isSwingSoundPlaying) { soundSystem.play('swing'); this.isSwingSoundPlaying = true; } else if (Math.abs(newAngularVelocity) <= 0.3) { this.isSwingSoundPlaying = false; } animationSystem.swingAnimation(this.player); this.checkPlatformLanding();
    }

    private updateFreeFallPhysics(): void {
        const playerPos = playerState.get();
        if (this.player && this.player.isOnPlatform && this.player.platformY !== undefined) {
            const currentPlatforms = platforms.get();
            const onPlatform = currentPlatforms.find(p => { const pg = p as PlatformGraphics; const onX = playerPos.x + 15 > p.x && playerPos.x - 15 < p.x + pg.width; const onY = Math.abs(this.player!.platformY! - (p.y - 15)) <= 2; return onX && onY; });
            if (onPlatform) { const vx = playerPos.velocityX !== 0 ? playerPos.velocityX : GAME_CONFIG.runSpeed; const newX = playerPos.x + vx; gameActions.updatePlayerPosition(newX, this.player.platformY); gameActions.updatePlayerVelocity(vx, 0); return; } else { this.player.isOnPlatform = false; this.player.platformY = undefined; }
        }
        const gravity = GAME_CONFIG.gravity * 0.016; const airResistance = 0.99; const newVelocityY = (playerPos.velocityY + gravity) * airResistance; const newVelocityX = playerPos.velocityX * airResistance; const newX = playerPos.x + newVelocityX; const newY = playerPos.y + newVelocityY; gameActions.updatePlayerPosition(newX, newY); gameActions.updatePlayerVelocity(newVelocityX, newVelocityY); animationSystem.stopSwingAnimation(this.player); this.checkPlatformLanding();
    }

    private checkPlatformLanding(): void {
        const currentPlatforms = platforms.get(); const playerPos = playerState.get();
        currentPlatforms.forEach(platform => {
            const platformCast = platform as PlatformGraphics; const isHorizontallyAligned = playerPos.x + 15 > platform.x && playerPos.x - 15 < platform.x + platformCast.width; const platformTop = platform.y; const playerBottom = playerPos.y + 15; const isOnTop = playerBottom >= platformTop - 5 && playerBottom <= platformTop + 20; const isFallingDown = playerPos.velocityY > 0;
            if (isHorizontallyAligned && isOnTop && isFallingDown && !platformCast.landed) {
                gameActions.updatePlayerPosition(playerPos.x, platform.y - 15); const runVx = Math.max(playerPos.velocityX, GAME_CONFIG.runSpeed); gameActions.updatePlayerVelocity(runVx, 0); gameActions.setSwinging(false);
                if (!this.player) return; this.player.isOnPlatform = true; this.player.platformY = platform.y - 15; platformCast.landed = true; gameActions.addScore(); this.updateScore(); animationSystem.landingAnimation(this.player); soundSystem.play('landing');
            }
        });
    }

    private managePlatforms(): void {
        const currentPlatforms = platforms.get(); const cameraLeft = gameState.get().cameraX;
        const filteredPlatforms = currentPlatforms.filter(platform => { if (platform.x + platform.width < cameraLeft - 200) { this.world.removeChild(platform); return false; } return true; }); platforms.set(filteredPlatforms);
        const cameraRight = cameraLeft + GAME_CONFIG.width; const spawnThreshold = 600; let rightmostPlatformEnd = gameState.get().lastPlatformX;
        filteredPlatforms.forEach(platform => { const platformCast = platform as PlatformGraphics; const platformEnd = platform.x + platformCast.width; if (platformEnd > rightmostPlatformEnd) { rightmostPlatformEnd = platformEnd; } });
        if (rightmostPlatformEnd < cameraRight + spawnThreshold) { const gap = 250 + Math.random() * 150; const x = rightmostPlatformEnd + gap; const y = 50 + Math.random() * 350; const platform = this.createPlatform(x, y); const newRightmost = x + platform.width; gameActions.updateCamera(newRightmost); }
    }

    private drawRope(): void { ropeSystem.drawRope(this.rope, COLORS.rope); const topIndex = this.world.children.length - 1; this.world.setChildIndex(this.rope, topIndex); if (this.player) { const ropeIndex = this.world.getChildIndex(this.rope); const desired = Math.max(0, ropeIndex - 1); this.world.setChildIndex(this.player, desired); } }

    private checkGameOver(): void { const playerPos = playerState.get(); const screenX = playerPos.x + this.world.x; const screenY = playerPos.y + this.world.y; const outBottom = screenY > GAME_CONFIG.height + 80; const outTop = screenY < -120; const outLeft = screenX < -200; if (outBottom || outTop || outLeft) { gameActions.endGame(); this.gameOverText.visible = true; animationSystem.gameOverAnimation(this.gameOverText); soundSystem.play('gameOver'); } }
}

let gameManagerInstance: GameManager | null = null;
export async function initGameManager(): Promise<GameManager> { if (!gameManagerInstance) { gameManagerInstance = new GameManager(); await new Promise(r => setTimeout(r, 100)); (window as any).gameInstance = gameManagerInstance; } return gameManagerInstance; }


