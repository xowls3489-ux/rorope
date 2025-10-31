import * as PIXI from 'pixi.js';
import { gameState, playerState, ropeState, gameActions, platforms } from '../stores/gameStore';
import { soundSystem } from '../systems/soundSystem';
import { animationSystem } from '../systems/animationSystem';
import { ropeSystem } from '../systems/ropeSystem';
import { vfxSystem } from '../systems/vfxSystem';
import { GAME_CONFIG, COLORS } from './config';

interface PlayerGraphics extends PIXI.Graphics { isOnPlatform?: boolean; platformY?: number; }
interface PlatformGraphics extends PIXI.Graphics { width: number; height: number; landed?: boolean; }

export class GameManager {
    private app!: PIXI.Application;
    private stage!: PIXI.Container;
    private world!: PIXI.Container;
    private bgLayer!: PIXI.Container;
    private fxLayer!: PIXI.Container;
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
    private landingGraceFrames: number = 0;
    private readonly maxSpeedX: number = 18;
    private readonly maxSpeedY: number = 80;
    
    private getCurrentRunSpeed(): number {
        const cameraX = gameState.get().cameraX;
        const distance = Math.max(0, cameraX);
        const speedIncrease = distance * GAME_CONFIG.runSpeedIncreasePerDistance;
        const currentSpeed = GAME_CONFIG.runSpeed + speedIncrease;
        return Math.min(currentSpeed, GAME_CONFIG.runSpeedMax);
    }

    constructor() { this.init(); }

    private async init(): Promise<void> {
        this.app = new PIXI.Application({ width: GAME_CONFIG.width, height: GAME_CONFIG.height, backgroundColor: COLORS.background, resizeTo: window, antialias: true });
        const gameRoot = document.getElementById('game-root');
        (gameRoot ?? document.body).appendChild(this.app.view as unknown as Node);
        this.stage = this.app.stage;
        this.bgLayer = new PIXI.Container(); this.bgLayer.name = 'bgLayer'; this.stage.addChildAt(this.bgLayer, 0);
        this.world = new PIXI.Container(); this.world.name = 'world'; this.stage.addChild(this.world);
        ;(this.world as any).eventMode = 'static'; this.world.interactive = true; this.world.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);
        this.fxLayer = vfxSystem.initialize(this.stage); // FX 레이어 초기화 및 추가
        this.initBackground(); this.initGameObjects(); this.initInput();
        this.app.ticker.add(this.update.bind(this)); this.app.ticker.maxFPS = 60;
    }

    private initBackground(): void { for (let i = 0; i < 2; i++) { const tile = new PIXI.Graphics(); tile.beginFill(COLORS.background); tile.drawRect(0, 0, this.bgTileWidth, GAME_CONFIG.height); tile.endFill(); tile.x = i * this.bgTileWidth; this.bgTiles.push(tile); this.bgLayer.addChild(tile); } }

    private initGameObjects(): void {
        this.player = new PIXI.Graphics() as PlayerGraphics; this.player.beginFill(0xFFFFFF); this.player.drawCircle(0, 0, 15); this.player.endFill(); this.world.addChild(this.player);
        // 초기 위치는 나중에 startGame()에서 플랫폼 위에 정확히 배치됨
        // 여기서는 임시 위치만 설정 (화면 밖에 숨김)
        this.player.x = -100;
        this.player.y = -100;
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
            
            // 게임 오버 상태면 재시작
            if (currentState.gameOver) {
                this.restartGame();
                return;
            }
            
            // 게임이 아직 시작되지 않았으면 로프 발사로 게임 시작
            if (!currentState.isPlaying) {
                this.shootRopeTowardPoint(event.clientX, event.clientY);
                return;
            }
            
            // 게임 진행 중: 로프가 스윙 중이면 해제만
            if (currentState.isSwinging) {
                this.releaseRope();
            } else {
                // 스윙 중이 아니면 새 로프 발사
                this.shootRopeTowardPoint(event.clientX, event.clientY);
            }
        });
    }

    private shootRopeTowardPoint(clientX: number, clientY: number): void {
        const currentState = gameState.get();
        
        // 첫 로프 발사 시 게임 시작 (플랫폼은 이미 생성되어 있으므로 isPlaying만 true로 설정)
        if (!currentState.isPlaying) {
            gameState.setKey('isPlaying', true);
        }
        
        // 로프 상태 완전히 리셋 (발사 전 상태 정리)
        const rope = ropeState.get();
        const wasRopeActive = rope.isFlying || rope.isPulling || rope.isActive;
        if (wasRopeActive) {
            ropeState.setKey('isFlying', false);
            ropeState.setKey('isPulling', false);
            ropeState.setKey('isActive', false);
        }
        if (currentState.isSwinging) {
            gameActions.setSwinging(false);
        }
        // 스윙 물리 상태 리셋 (기존 각속도/각도 초기화)
        gameActions.updateSwingPhysics(0, 0);
        // 로프가 연결되어 있었으면 속도를 완전히 리셋 (가속 버그 방지)
        const playerPos = playerState.get();
        if (wasRopeActive) {
            // 기존 로프가 활성화되어 있었으면 속도를 거의 0으로 리셋
            gameActions.updatePlayerVelocity(playerPos.velocityX * 0.05, playerPos.velocityY * 0.05);
        } else {
            // 로프가 없었으면 기존 속도 유지 (약간 감쇠)
            const dampenedVx = playerPos.velocityX * 0.7;
            const dampenedVy = playerPos.velocityY * 0.7;
            gameActions.updatePlayerVelocity(dampenedVx, dampenedVy);
        }
        ropeSystem.launchFromClick(this.app, this.world, clientX, clientY);
        if (this.player) { this.player.isOnPlatform = false; }
        soundSystem.play('ropeShoot');
        
        // 로프 발사 시 스파크 효과
        const rect = (this.app.view as HTMLCanvasElement).getBoundingClientRect();
        const worldClickX = clientX - rect.left - this.world.x;
        const worldClickY = clientY - rect.top - this.world.y;
        const dx = worldClickX - playerPos.x;
        const dy = worldClickY - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 50) {
            const dirLen = Math.max(1e-6, dist);
            const dirX = dx / dirLen;
            const dirY = dy / dirLen;
            vfxSystem.spawnRopeShootSpark(playerPos.x, playerPos.y, dirX, dirY);
        }
    }

    private releaseRope(): void {
        const currentState = gameState.get(); if (!currentState.isSwinging) return;
        gameActions.setSwinging(false);
        ropeState.setKey('isActive', false); ropeState.setKey('isFlying', false); ropeState.setKey('isPulling', false);
        const playerPos = playerState.get(); const ropePos = ropeState.get(); const ropeLength = Math.max(1, ropePos.length || GAME_CONFIG.ropeLength);
        const swingSpeed = Math.sqrt(playerPos.angularVelocity * playerPos.angularVelocity * ropeLength);
        let velocityX = Math.sin(playerPos.swingAngle) * swingSpeed; let velocityY = Math.cos(playerPos.swingAngle) * swingSpeed;
        // 속도 캡
        velocityX = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, velocityX));
        velocityY = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, velocityY));
        gameActions.updatePlayerVelocity(velocityX, velocityY);
        animationSystem.ropeReleaseAnimation(this.player, this.rope); soundSystem.play('ropeRelease');
        
        // 이벤트: 로프 해제 시 파티클 효과
        vfxSystem.spawnReleaseParticles(playerPos.x, playerPos.y, velocityX, velocityY);
    }

    private createPlatform(x: number, y: number): PlatformGraphics { const platform = new PIXI.Graphics() as PlatformGraphics; const width = GAME_CONFIG.platformWidth.min + Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min); platform.beginFill(COLORS.primary); platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0); platform.endFill(); platform.x = x; platform.y = y; platform.width = width; platform.height = GAME_CONFIG.platformHeight; this.world.addChild(platform); gameActions.addPlatform(platform); animationSystem.platformSpawnAnimation(platform); return platform; }

    private generateInitialPlatforms(): void { 
        gameActions.clearPlatforms(); 
        gameActions.updateCamera(0); 
        
        // 시작 플랫폼은 애니메이션 없이 즉시 생성 (플레이어가 위에 서 있어야 하므로)
        const startingPlatform = this.createPlatformNoAnimation(50, GAME_CONFIG.height - 165); 
        gameActions.updateCamera(50 + startingPlatform.width); 
        let lastX = 50 + startingPlatform.width; 
        
        // 나머지 플랫폼은 애니메이션 적용
        for (let i = 0; i < 4; i++) { 
            const gap = 250 + Math.random() * 100; 
            lastX = lastX + gap; 
            const y = 50 + Math.random() * 350; 
            const platform = this.createPlatform(lastX, y); 
            lastX = lastX + platform.width; 
            gameActions.updateCamera(lastX); 
        } 
    }
    
    private createPlatformNoAnimation(x: number, y: number): PlatformGraphics { 
        const platform = new PIXI.Graphics() as PlatformGraphics; 
        const width = GAME_CONFIG.platformWidth.min + Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min); 
        platform.beginFill(COLORS.primary); 
        platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0); 
        platform.endFill(); 
        platform.x = x; 
        platform.y = y; 
        platform.width = width; 
        platform.height = GAME_CONFIG.platformHeight; 
        this.world.addChild(platform); 
        gameActions.addPlatform(platform); 
        // 애니메이션 없이 즉시 표시
        return platform; 
    }

    private startGame(): void {
        // 게임 초기화만 수행 (isPlaying은 false로 시작 - 로프 발사 시 시작됨)
        // 플레이어 위치는 플랫폼 생성 후 설정하므로 초기화만
        gameActions.startGame();
        gameState.setKey('isPlaying', false); // 로프 발사 전까지 게임 대기 상태
        
        if (!this.player) {
            this.initGameObjects();
        }
        
        // 플랫폼을 먼저 생성 (플레이어보다 먼저)
        this.generateInitialPlatforms();
        
        // 시작 플랫폼 찾기
        const currentPlatforms = platforms.get();
        const startingPlatform = currentPlatforms[0];
        
        if (startingPlatform) {
            const pg = startingPlatform as PlatformGraphics;
            // 플랫폼의 y 좌표는 플랫폼의 상단 위치
            // 플랫폼 상단 = startingPlatform.y
            // 플레이어 중심이 플랫폼 상단보다 15px 위에 있어야 함 (플레이어 반지름 15)
            // 플레이어 하단 = 플레이어 중심 + 15 = 플랫폼 상단과 맞춤
            const platformTopY = startingPlatform.y;
            const playerY = platformTopY - 15; // 플레이어 중심 위치
            const playerX = 50 + (pg.width / 2); // 플랫폼 중앙에 배치
            
            console.log('플레이어 배치:', { 
                platformTopY, 
                playerY, 
                playerX, 
                platformWidth: pg.width,
                playerBottom: playerY + 15,
                platformHeight: GAME_CONFIG.platformHeight
            });
            
            // 플레이어를 플랫폼 위에 정확히 배치 (렌더링 순서 고려)
            this.player.x = playerX;
            this.player.y = playerY;
            gameActions.updatePlayerPosition(playerX, playerY);
            gameActions.updatePlayerVelocity(0, 0);
            gameActions.updateSwingPhysics(0, 0);
            
            // 플레이어를 플랫폼 위에 고정
            this.player.isOnPlatform = true;
            this.player.platformY = playerY;
            
            // 플레이어를 렌더링 최상단으로 이동 (플랫폼 위에 보이도록)
            const playerIndex = this.world.children.indexOf(this.player);
            if (playerIndex >= 0 && playerIndex < this.world.children.length - 1) {
                this.world.setChildIndex(this.player, this.world.children.length - 1);
            }
        } else {
            // 플랫폼이 없으면 기본 위치
            this.player.x = 100;
            this.player.y = GAME_CONFIG.height - 180;
            gameActions.updatePlayerPosition(100, GAME_CONFIG.height - 180);
            gameActions.updatePlayerVelocity(0, 0);
        }
        
        this.worldX = 0;
        this.targetWorldX = 0;
        this.world.x = 0;
        this.world.y = 0;
        if (this.fxLayer) {
            this.fxLayer.x = 0;
            this.fxLayer.y = 0;
        }
        this.updateScore();
        this.gameOverText.visible = false;
        animationSystem.fadeInUI(this.scoreText);
        vfxSystem.reset();
    }
    public startGameFromUI(): void { this.startGame(); }
    public restartGameFromUI(): void { this.restartGame(); }
    private restartGame(): void { const currentPlatforms = platforms.get(); currentPlatforms.forEach(p => { this.world.removeChild(p); }); gameActions.clearPlatforms(); this.isSwingSoundPlaying = false; this.startGame(); }

    private updateScore(): void { const currentState = gameState.get(); this.scoreText.text = `Score: ${currentState.score}`; animationSystem.scoreAnimation(this.scoreText); }

    private update(): void {
        const currentState = gameState.get(); if (!currentState.isPlaying) return;
        try {
            const rope = ropeState.get(); if (rope.isFlying) { ropeSystem.updateFlight(GAME_CONFIG.platformHeight, 700, 0.016); this.updateFreeFallPhysics(); } else if (rope.isPulling) { this.updatePullToAnchor(); } else if (currentState.isSwinging) { this.updateSwingPhysics(); } else { this.updateFreeFallPhysics(); }
            this.updatePlayerGraphics(); this.updateCamera(); this.updateBackground(); this.managePlatforms(); this.drawRope();
            vfxSystem.update(); // VFX 시스템 업데이트 (파티클 이동, fxLayer 페이드)
        } catch (e) { console.error('게임 업데이트 중 오류 발생:', e); gameActions.pauseGame(); }
        this.checkGameOver();
    }

    private updatePlayerGraphics(): void { if (!this.player) return; const playerPos = playerState.get(); this.player.x = playerPos.x; this.player.y = playerPos.y; this.player.visible = true; this.player.alpha = 1; try { (this.player as any).scale?.set?.(1, 1); } catch {} }

    private updateCamera(): void {
        const playerPos = playerState.get();
        // 카메라가 플레이어를 따라가도록 계산 (플레이어가 화면 중앙보다 앞에 있으면 추적)
        this.targetWorldX = -(playerPos.x - this.cameraCenterX);
        // 왼쪽으로는 이동하지 않도록 제한 (게임은 오른쪽으로만 진행)
        this.targetWorldX = Math.min(this.targetWorldX, 0);
        // 추적 속도 향상 (0.12 -> 0.25)으로 빠른 이동에도 대응
        this.worldX += (this.targetWorldX - this.worldX) * 0.25;
        
        // Y축 추적 (수직)
        const viewH = GAME_CONFIG.height;
        const deadZoneY = 100; // 150 -> 100으로 줄여서 더 민감하게 반응
        const currentWorldY = this.world.y || 0;
        let targetWorldY = currentWorldY;
        const playerScreenY = playerPos.y + currentWorldY;
        const topBound = viewH / 2 - deadZoneY; // 화면 중앙 기준 상한선
        const bottomBound = viewH / 2 + deadZoneY; // 화면 중앙 기준 하한선
        
        // 플레이어가 상한선 위에 있으면 카메라를 위로 이동
        if (playerScreenY < topBound) {
            const offset = topBound - playerScreenY;
            targetWorldY += offset;
        } else if (playerScreenY > bottomBound) {
            // 하한선: 플레이어가 아래로 떨어질 때만 제한적으로 추적
            // 하지만 화면 하단을 넘어서면 카메라 추적 중단 (게임 오버를 위해)
            const offset = playerScreenY - bottomBound;
            // 플레이어가 화면 밖으로 나가면 카메라 추적 중단
            if (playerScreenY > viewH + 50) {
                // 카메라를 더 내리지 않음 (현재 위치 유지)
                targetWorldY = currentWorldY;
            } else {
                targetWorldY -= offset;
            }
        }
        
        // Y축 추적 속도 향상 (0.15 -> 0.25로 더 빠르게)
        const newWorldY = currentWorldY + (targetWorldY - currentWorldY) * 0.25;
        this.world.x = this.worldX;
        this.world.y = newWorldY;
        // fxLayer 위치도 world와 동기화 (카메라 이동 반영)
        if (this.fxLayer) {
            this.fxLayer.x = this.worldX;
            this.fxLayer.y = newWorldY;
        }
        gameActions.updateCamera(-this.worldX);
    }

    private updateBackground(): void { const scrollX = this.worldX * this.bgSpeed; for (let i = 0; i < this.bgTiles.length; i++) { const tile = this.bgTiles[i]; const baseX = (i % 2) * this.bgTileWidth; tile.x = baseX - (scrollX % (this.bgTileWidth * 2)); } }

    private updatePullToAnchor(): void {
        const ropePos = ropeState.get(); const playerPos = playerState.get(); const dt = 0.016; const speed = ropePos.pullSpeed || 1200; const dx = ropePos.anchorX - playerPos.x; const dy = ropePos.anchorY - playerPos.y; const dist = Math.hypot(dx, dy);
        if (dist < Math.max(1, speed * dt)) { const targetX = ropePos.anchorX; const targetY = ropePos.anchorY - 15; gameActions.updatePlayerPosition(targetX, targetY); const runVx = this.getCurrentRunSpeed(); gameActions.updatePlayerVelocity(runVx, 0); gameActions.stopPull(); gameActions.setSwinging(false); ropeState.setKey('isActive', false); ropeState.setKey('isFlying', false); ropeState.setKey('isPulling', false); if (this.player) { this.player.isOnPlatform = true; this.player.platformY = targetY; this.player.visible = true; this.player.alpha = 1; } animationSystem.stopSwingAnimation(this.player); animationSystem.landingAnimation(this.player); soundSystem.play('landing'); gameActions.addScore(); this.updateScore();
            // 이벤트: 착지 시 VFX 트리거
            vfxSystem.spawnDustParticles(targetX, targetY, 5);
            vfxSystem.spawnLandingRipple(targetX, targetY);
            vfxSystem.spawnScoreBurst(targetX, targetY - 30); // 점수 위치에 버스트
            vfxSystem.triggerScreenShake(this.stage);
            return; }
        const stepX = (dx / dist) * speed * dt; const stepY = (dy / dist) * speed * dt; const nextX = playerPos.x + stepX; const nextY = playerPos.y + stepY;
        // 풀 이동 선분이 플랫폼 상단을 관통하는지 검사 → 즉시 착지로 스냅
        const currentPlatforms = platforms.get();
        for (const platform of currentPlatforms) {
            const pg = platform as PlatformGraphics; const left = platform.x; const right = platform.x + pg.width; const top = platform.y; const targetTopY = top - 15;
            const crossesTop = playerPos.y > targetTopY && nextY <= targetTopY; const withinX = (Math.max(playerPos.x, nextX) >= left - 14) && (Math.min(playerPos.x, nextX) <= right + 14);
            if (crossesTop && withinX) {
                const snapX = nextX; const snapY = targetTopY; gameActions.updatePlayerPosition(snapX, snapY); const runVx = this.getCurrentRunSpeed(); gameActions.updatePlayerVelocity(runVx, 0); gameActions.stopPull(); gameActions.setSwinging(false); ropeState.setKey('isActive', false); ropeState.setKey('isFlying', false); ropeState.setKey('isPulling', false); if (this.player) { this.player.isOnPlatform = true; this.player.platformY = snapY; this.player.visible = true; this.player.alpha = 1; }
                animationSystem.stopSwingAnimation(this.player); animationSystem.landingAnimation(this.player); soundSystem.play('landing'); gameActions.addScore(); this.updateScore();
                // 이벤트: 착지 시 VFX 트리거
                vfxSystem.spawnDustParticles(snapX, snapY, 5);
                vfxSystem.spawnLandingRipple(snapX, snapY);
                vfxSystem.spawnScoreBurst(snapX, snapY - 30); // 점수 위치에 버스트
                vfxSystem.triggerScreenShake(this.stage);
                return;
            }
        }
        gameActions.updatePlayerPosition(nextX, nextY); gameActions.updatePlayerVelocity(stepX / dt, stepY / dt);
    }

    private updateSwingPhysics(): void {
        const playerPos = playerState.get(); const ropePos = ropeState.get(); const dt = 0.016; const ropeLength = Math.max(1, ropePos.length || GAME_CONFIG.ropeLength); const gravityForce = -GAME_CONFIG.gravity / ropeLength * Math.sin(playerPos.swingAngle); const dampingForce = -playerPos.angularVelocity * 0.995; const angularAcceleration = gravityForce + dampingForce; const newAngularVelocity = playerPos.angularVelocity + angularAcceleration * dt; const newSwingAngle = playerPos.swingAngle + newAngularVelocity * dt; const newX = ropePos.anchorX + Math.sin(newSwingAngle) * ropeLength; const newY = ropePos.anchorY + Math.cos(newSwingAngle) * ropeLength; gameActions.updatePlayerPosition(newX, newY); gameActions.updateSwingPhysics(newSwingAngle, newAngularVelocity); if (Math.abs(newAngularVelocity) > 0.5 && !this.isSwingSoundPlaying) { soundSystem.play('swing'); this.isSwingSoundPlaying = true; } else if (Math.abs(newAngularVelocity) <= 0.3) { this.isSwingSoundPlaying = false; } animationSystem.swingAnimation(this.player); this.checkPlatformLanding();
    }

    private updateFreeFallPhysics(): void {
        const playerPos = playerState.get();
        if (this.player && this.player.isOnPlatform && this.player.platformY !== undefined) {
            const currentPlatforms = platforms.get();
            const onPlatform = currentPlatforms.find(p => { const pg = p as PlatformGraphics; const onX = playerPos.x + 15 > p.x && playerPos.x - 15 < p.x + pg.width; const onY = Math.abs(this.player!.platformY! - (p.y - 15)) <= 2; return onX && onY; });
            if (onPlatform) { const vx = this.getCurrentRunSpeed(); const newX = playerPos.x + vx; gameActions.updatePlayerPosition(newX, this.player.platformY); gameActions.updatePlayerVelocity(vx, 0); return; } else { this.player.isOnPlatform = false; this.player.platformY = undefined; }
        }
        const gravity = GAME_CONFIG.gravity * 0.016; const dragX = 0.985; let newVelocityY = playerPos.velocityY + gravity; let newVelocityX = playerPos.velocityX * dragX; newVelocityX = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, newVelocityX)); newVelocityY = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, newVelocityY)); const newX = playerPos.x + newVelocityX; const newY = playerPos.y + newVelocityY; gameActions.updatePlayerPosition(newX, newY); gameActions.updatePlayerVelocity(newVelocityX, newVelocityY); animationSystem.stopSwingAnimation(this.player); this.checkPlatformLanding();
    }

    private checkPlatformLanding(): void {
        const currentPlatforms = platforms.get(); const playerPos = playerState.get();
        currentPlatforms.forEach(platform => {
            const platformCast = platform as PlatformGraphics; const isHorizontallyAligned = playerPos.x + 14 > platform.x && playerPos.x - 14 < platform.x + platformCast.width; const platformTop = platform.y; const playerBottom = playerPos.y + 15; const isOnTop = playerBottom >= platformTop - 4 && playerBottom <= platformTop + 10; const isFallingDown = playerPos.velocityY > 0.2;
            if (isHorizontallyAligned && isOnTop && isFallingDown && !platformCast.landed) {
                const snapY = platform.y - 15;
                gameActions.updatePlayerPosition(playerPos.x, snapY);
                const runVx = this.getCurrentRunSpeed();
                gameActions.updatePlayerVelocity(runVx, 0);
                gameActions.setSwinging(false);
                ropeState.setKey('isActive', false); ropeState.setKey('isFlying', false); ropeState.setKey('isPulling', false);
                if (!this.player) return; this.player.isOnPlatform = true; this.player.platformY = snapY; this.player.visible = true; this.player.alpha = 1;
                platformCast.landed = true; this.landingGraceFrames = 12;
                gameActions.addScore(); this.updateScore(); animationSystem.landingAnimation(this.player); soundSystem.play('landing');
                
                // 이벤트: 착지 시 VFX 트리거
                vfxSystem.spawnDustParticles(playerPos.x, snapY, 5);
                vfxSystem.spawnLandingRipple(playerPos.x, snapY);
                vfxSystem.spawnScoreBurst(playerPos.x, snapY - 30); // 점수 위치에 버스트
                vfxSystem.triggerScreenShake(this.stage);
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

    private drawRope(): void {
        ropeSystem.drawRope(this.rope, COLORS.rope);
        const topIndex = this.world.children.length - 1;
        if (this.player) { this.world.setChildIndex(this.player, topIndex); }
        const ropeTargetIndex = Math.max(0, this.world.children.length - 2);
        this.world.setChildIndex(this.rope, ropeTargetIndex);
    }

    private checkGameOver(): void {
        const playerPos = playerState.get();
        if (this.landingGraceFrames > 0) {
            this.landingGraceFrames -= 1;
            return;
        }
        
        // 간단한 게임 오버 체크: 플레이어 Y 좌표가 너무 크면 (바닥으로 떨어짐)
        const playerYTooLow = playerPos.y > 2000;
        
        // 화면 좌표 계산: world.x와 world.y는 카메라 오프셋
        const screenX = playerPos.x + this.world.x;
        const screenY = playerPos.y + this.world.y;
        
        // 게임 오버 조건:
        // - 플레이어 Y 좌표가 3000 이상 (바닥으로 너무 떨어짐)
        // - 아래쪽: 화면 높이를 크게 벗어남
        const outBottom = screenY > GAME_CONFIG.height + 50;
        // - 위쪽: 화면 위로 너무 많이 나감
        const outTop = screenY < -50;
        // - 왼쪽: 화면 왼쪽으로 나감
        const outLeft = screenX < -50;
        
        if (playerYTooLow || outBottom || outTop || outLeft) {
            console.log('GAME OVER!', {
                playerY: playerPos.y.toFixed(1),
                playerYTooLow,
                outBottom,
                outTop,
                outLeft
            });
            gameActions.endGame();
            this.gameOverText.visible = true;
            animationSystem.gameOverAnimation(this.gameOverText);
            soundSystem.play('gameOver');
        }
    }
}

let gameManagerInstance: GameManager | null = null;
export async function initGameManager(): Promise<GameManager> { if (!gameManagerInstance) { gameManagerInstance = new GameManager(); await new Promise(r => setTimeout(r, 100)); (window as any).gameInstance = gameManagerInstance; } return gameManagerInstance; }


