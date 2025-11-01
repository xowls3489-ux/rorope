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
    private cameraZoom: number = 1.0;
    private targetCameraZoom: number = 1.0;
    private trailParticleCounter: number = 0;
    private previousPlayerX: number = 0;
    private previousPlayerY: number = 0;
    
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
        ;(this.world as any).eventMode = 'static'; this.world.interactive = true; 
        // hitArea를 매우 크게 설정 (게임이 오른쪽으로 계속 진행되므로)
        this.world.hitArea = new PIXI.Rectangle(-50000, -10000, 100000, 20000);
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
            
            // 게임 진행 중: 로프 발사
            this.shootRopeTowardPoint(event.clientX, event.clientY);
        });
        
        this.world.on('pointerup', () => {
            const currentState = gameState.get();
            const rope = ropeState.get();
            
            // 게임 진행 중이고 풀링 중이면 로프 해제
            if (currentState.isPlaying && rope.isPulling) {
                this.releaseRopeFromPull();
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
        
        // 로프 발사 시 항상 속도를 안전하게 리셋
        const playerPos = playerState.get();
        const onPlatform = this.player?.isOnPlatform || false;
        
        if (wasRopeActive) {
            // 기존 로프가 활성화되어 있었으면 속도를 완전히 0으로 리셋
            gameActions.updatePlayerVelocity(0, 0);
        } else if (onPlatform) {
            // 플랫폼에서 로프 발사 시 속도를 0으로 리셋 (안전)
            gameActions.updatePlayerVelocity(0, 0);
        } else {
            // 공중에서 로프 발사 시에만 기존 속도를 유지하되 제한
            const clampedVx = Math.max(-10, Math.min(10, playerPos.velocityX * 0.5));
            const clampedVy = Math.max(-15, Math.min(15, playerPos.velocityY * 0.5));
            gameActions.updatePlayerVelocity(clampedVx, clampedVy);
        }
        
        ropeSystem.launchFromClick(this.app, this.world, clientX, clientY);
        if (this.player) { this.player.isOnPlatform = false; }
        soundSystem.play('ropeShoot');
        
        // 로프 발사 시 스파크 효과
        const rect = (this.app.view as HTMLCanvasElement).getBoundingClientRect();
        const scale = this.world.scale.x || 1.0;
        const worldClickX = (clientX - rect.left - this.world.x) / scale;
        const worldClickY = (clientY - rect.top - this.world.y) / scale;
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

    private releaseRopeFromPull(): void {
        const playerPos = playerState.get();
        const ropePos = ropeState.get();
        
        // 현재 속도에 모멘텀 부스트 적용
        const boostFactor = GAME_CONFIG.grappleMomentumBoost;
        let velocityX = playerPos.velocityX * boostFactor;
        let velocityY = playerPos.velocityY * boostFactor;
        
        // 속도 캡 (더 안전하게)
        const safeMaxSpeedX = 15; // 18 -> 15로 감소
        const safeMaxSpeedY = 5; // 25 -> 5로 감소 (위로 튕기는 것 방지)
        velocityX = Math.max(-safeMaxSpeedX, Math.min(safeMaxSpeedX, velocityX));
        velocityY = Math.max(-safeMaxSpeedY, Math.min(safeMaxSpeedY, velocityY));
        
        gameActions.updatePlayerVelocity(velocityX, velocityY);
        
        // 로프 상태 리셋
        gameActions.setSwinging(false);
        ropeState.setKey('isActive', false);
        ropeState.setKey('isFlying', false);
        ropeState.setKey('isPulling', false);
        
        // 카메라 줌 복구
        this.targetCameraZoom = 1.0;
        
        animationSystem.ropeReleaseAnimation(this.player, this.rope);
        soundSystem.play('ropeRelease');
        
        // 이벤트: 로프 해제 시 파티클 효과
        vfxSystem.spawnReleaseParticles(playerPos.x, playerPos.y, velocityX, velocityY);
    }
    
    private releaseRope(): void {
        // 레거시 스윙 릴리즈 (사용하지 않음, 호환성 유지)
        this.releaseRopeFromPull();
    }

    private createPlatform(x: number, y: number): PlatformGraphics { const platform = new PIXI.Graphics() as PlatformGraphics; const width = GAME_CONFIG.platformWidth.min + Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min); platform.beginFill(COLORS.primary); platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0); platform.endFill(); platform.x = x; platform.y = y; platform.width = width; platform.height = GAME_CONFIG.platformHeight; this.world.addChild(platform); gameActions.addPlatform(platform); animationSystem.platformSpawnAnimation(platform); return platform; }

    private generateInitialPlatforms(): void { 
        gameActions.clearPlatforms(); 
        gameActions.updateCamera(0); 
        
        // 시작 플랫폼은 애니메이션 없이 즉시 생성 (플레이어가 위에 서 있어야 하므로)
        const startingPlatform = this.createPlatformNoAnimation(50, GAME_CONFIG.height - 165); 
        gameActions.updateCamera(50 + startingPlatform.width); 
        let lastX = 50 + startingPlatform.width; 
        
        // 나머지 플랫폼은 애니메이션 적용 (각 위치마다 상단과 하단에 모두 배치)
        for (let i = 0; i < 8; i++) { // 8세트 생성
            const gap = 180 + Math.random() * 70; // 간격: 180~250
            lastX = lastX + gap;
            
            // 상단 플랫폼 생성 (80 ~ 280)
            const yTop = 80 + Math.random() * 200;
            const platformTop = this.createPlatform(lastX, yTop);
            
            // 하단 플랫폼 생성 (350 ~ 520)
            const yBottom = 350 + Math.random() * 170;
            const platformBottom = this.createPlatform(lastX + 20, yBottom); // X 위치 약간 어긋나게
            
            lastX = lastX + Math.max(platformTop.width, platformBottom.width);
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
            
            // 카메라 위치 초기화 (첫 프레임에 급격한 변화 방지)
            this.previousPlayerX = playerX;
            this.previousPlayerY = playerY;
            
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
            this.previousPlayerX = 100;
            this.previousPlayerY = GAME_CONFIG.height - 180;
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
            const rope = ropeState.get(); 
            if (rope.isFlying) { 
                ropeSystem.updateFlight(GAME_CONFIG.platformHeight, 700, 0.016); 
                this.updateFreeFallPhysics(); 
            } else if (rope.isPulling) { 
                this.updatePullToAnchor(); 
                // 풀링 중 카메라 줌인
                this.targetCameraZoom = GAME_CONFIG.grappleCameraZoom;
            } else { 
                this.updateFreeFallPhysics(); 
                // 풀링 중이 아니면 카메라 줌 복구
                this.targetCameraZoom = 1.0;
            }
            this.updateCameraZoom();
            this.updatePlayerGraphics(); this.updateCamera(); this.updateBackground(); this.managePlatforms(); this.drawRope();
            vfxSystem.update(); // VFX 시스템 업데이트 (파티클 이동, fxLayer 페이드)
        } catch (e) { console.error('게임 업데이트 중 오류 발생:', e); gameActions.pauseGame(); }
        this.checkGameOver();
    }

    private updatePlayerGraphics(): void { if (!this.player) return; const playerPos = playerState.get(); this.player.x = playerPos.x; this.player.y = playerPos.y; this.player.visible = true; this.player.alpha = 1; try { (this.player as any).scale?.set?.(1, 1); } catch {} }

    private updateCameraZoom(): void {
        // 카메라 줌 스무스 전환
        this.cameraZoom += (this.targetCameraZoom - this.cameraZoom) * 0.1;
        this.world.scale.set(this.cameraZoom);
        if (this.fxLayer) {
            this.fxLayer.scale.set(this.cameraZoom);
        }
    }

    private updateCamera(): void {
        const playerPos = playerState.get();
        const rope = ropeState.get();
        
        // 플레이어 위치 변화량 계산
        const deltaX = Math.abs(playerPos.x - this.previousPlayerX);
        const deltaY = Math.abs(playerPos.y - this.previousPlayerY);
        
        // 급격한 위치 변화 감지 (착지, 순간이동 등)
        const suddenChange = deltaX > 50 || deltaY > 50;
        
        // 카메라가 플레이어를 따라가도록 계산 (플레이어가 화면 중앙보다 앞에 있으면 추적)
        this.targetWorldX = -(playerPos.x - this.cameraCenterX);
        // 왼쪽으로는 이동하지 않도록 제한 (게임은 오른쪽으로만 진행)
        this.targetWorldX = Math.min(this.targetWorldX, 0);
        
        // X축 추적 속도 동적 조정
        let cameraSpeedX = 0.15; // 기본 속도 (0.25 -> 0.15로 감소)
        if (rope.isPulling) {
            cameraSpeedX = 0.12; // 풀링 중에는 더 느리게 (부드럽게)
        } else if (suddenChange) {
            cameraSpeedX = 0.6; // 급격한 변화 시 빠르게 따라가기
        }
        
        this.worldX += (this.targetWorldX - this.worldX) * cameraSpeedX;
        
        // Y축 추적 (수직)
        const viewH = GAME_CONFIG.height;
        const deadZoneY = 150; // 100 -> 150으로 증가 (더 여유있게)
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
        
        // Y축 추적 속도 동적 조정
        let cameraSpeedY = 0.12; // 기본 속도 (0.25 -> 0.12로 감소)
        if (rope.isPulling) {
            cameraSpeedY = 0.1; // 풀링 중에는 더 느리게
        } else if (suddenChange) {
            cameraSpeedY = 0.5; // 급격한 변화 시 빠르게 따라가기
        }
        
        const newWorldY = currentWorldY + (targetWorldY - currentWorldY) * cameraSpeedY;
        this.world.x = this.worldX;
        this.world.y = newWorldY;
        
        // 이전 플레이어 위치 저장
        this.previousPlayerX = playerPos.x;
        this.previousPlayerY = playerPos.y;
        
        // hitArea를 카메라 위치에 맞춰 동적으로 업데이트
        const scale = this.world.scale.x || 1.0;
        const hitAreaX = -this.worldX / scale - 1000;
        const hitAreaY = -newWorldY / scale - 1000;
        const hitAreaWidth = GAME_CONFIG.width / scale + 2000;
        const hitAreaHeight = GAME_CONFIG.height / scale + 2000;
        this.world.hitArea = new PIXI.Rectangle(hitAreaX, hitAreaY, hitAreaWidth, hitAreaHeight);
        
        // fxLayer 위치도 world와 동기화 (카메라 이동 반영)
        if (this.fxLayer) {
            this.fxLayer.x = this.worldX;
            this.fxLayer.y = newWorldY;
        }
        gameActions.updateCamera(-this.worldX);
    }

    private updateBackground(): void { const scrollX = this.worldX * this.bgSpeed; for (let i = 0; i < this.bgTiles.length; i++) { const tile = this.bgTiles[i]; const baseX = (i % 2) * this.bgTileWidth; tile.x = baseX - (scrollX % (this.bgTileWidth * 2)); } }

    private updatePullToAnchor(): void {
        const ropePos = ropeState.get();
        const playerPos = playerState.get();
        const game = gameState.get();
        const dt = 0.016;
        
        // 콤보에 따른 풀 속도 증가
        const combo = game.combo || 0;
        const baseSpeed = GAME_CONFIG.grappleBasePullSpeed;
        const comboBonus = combo * GAME_CONFIG.grappleComboSpeedBonus;
        const speed = baseSpeed + comboBonus;
        
        const dx = ropePos.anchorX - playerPos.x;
        const dy = ropePos.anchorY - playerPos.y;
        const dist = Math.hypot(dx, dy);
        
        // 로프 트레일 파티클 생성 (매 프레임마다가 아니라 간헐적으로)
        this.trailParticleCounter++;
        if (this.trailParticleCounter >= 3) {
            this.trailParticleCounter = 0;
            vfxSystem.spawnRopeTrailParticles(playerPos.x, playerPos.y, ropePos.anchorX, ropePos.anchorY, combo);
        }
        
        // 리바운드 거리 체크
        const reboundDist = GAME_CONFIG.grappleReboundDistance;
        
        // 앵커에 매우 가까우면 로프 자동 해제 (착지 없음)
        if (dist < 10) {
            // 로프만 해제, 착지는 하지 않음
            gameActions.stopPull();
            gameActions.setSwinging(false);
            ropeState.setKey('isActive', false);
            ropeState.setKey('isFlying', false);
            ropeState.setKey('isPulling', false);
            
            // 카메라 줌 복구
            this.targetCameraZoom = 1.0;
            
            // 속도를 안전하게 제한하며 자유낙하 전환
            const safeVx = Math.max(-15, Math.min(15, playerPos.velocityX));
            const safeVy = Math.max(-10, Math.min(10, playerPos.velocityY));
            gameActions.updatePlayerVelocity(safeVx, safeVy);
            
            return;
        }
        
        // 이징 적용 (거리에 비례하여 부드럽게 가속/감속)
        const easingFactor = GAME_CONFIG.grappleEasingFactor;
        const pullForce = dist * easingFactor;
        // 최소 속도 보장: 거리가 멀어도 최소한 speed의 70%는 유지
        const minSpeed = speed * 0.7;
        const acceleration = Math.max(minSpeed, Math.min(speed, pullForce));
        
        // 리바운드 효과 (앵커 근처에서 약간 튕기는 효과)
        let finalAccel = acceleration;
        if (dist < reboundDist) {
            const reboundFactor = 1.0 - (dist / reboundDist) * 0.2; // 0.3 -> 0.2로 약화
            finalAccel *= reboundFactor;
        }
        
        const stepX = (dx / dist) * finalAccel * dt;
        const stepY = (dy / dist) * finalAccel * dt;
        const nextX = playerPos.x + stepX;
        const nextY = playerPos.y + stepY;
        
        // 플랫폼 충돌 무시 - 플레이어는 모든 플랫폼을 통과
        gameActions.updatePlayerPosition(nextX, nextY);
        // 속도 계산 수정: 방향 벡터에 속도를 곱하되, 너무 크지 않게 제한
        const velocityMagnitude = finalAccel; // 이미 계산된 가속도 사용
        const dirVx = (dx / dist) * velocityMagnitude;
        const dirVy = (dy / dist) * velocityMagnitude;
        // 속도 제한 추가 (풀링 중에는 훨씬 작게 제한)
        const pullMaxSpeedX = 20; // X축은 조금 여유있게
        const pullMaxSpeedY = 10; // Y축은 매우 제한적으로 (위로 솟구치는 것 방지)
        const clampedVx = Math.max(-pullMaxSpeedX, Math.min(pullMaxSpeedX, dirVx));
        const clampedVy = Math.max(-pullMaxSpeedY, Math.min(pullMaxSpeedY, dirVy));
        gameActions.updatePlayerVelocity(clampedVx, clampedVy);
    }

    private updateSwingPhysics(): void {
        // 스윙 물리는 그래플링 후크 시스템으로 대체되어 더 이상 사용되지 않음
        // 호환성 유지를 위해 메서드는 남겨두되 프리폴로 전환
        this.updateFreeFallPhysics();
    }

    private updateFreeFallPhysics(): void {
        const playerPos = playerState.get();
        const rope = ropeState.get();
        
        // 공중에서 로프가 활성화되지 않은 상태가 일정 시간 이상 지속되면 콤보 리셋
        if (!this.player?.isOnPlatform && !rope.isActive && !rope.isFlying && !rope.isPulling) {
            // 공중에서 자유낙하 중이면서 플랫폼에서 떨어진 경우
            // 속도가 너무 빨라지거나 너무 오래 떨어지면 콤보 리셋
            if (playerPos.velocityY > 30) {
                // 일정 속도 이상 낙하 중이면 콤보 리셋 (실패로 간주)
                const game = gameState.get();
                if (game.combo > 0) {
                    gameActions.resetCombo();
                }
            }
        }
        
        if (this.player && this.player.isOnPlatform && this.player.platformY !== undefined) {
            const currentPlatforms = platforms.get();
            const onPlatform = currentPlatforms.find(p => { const pg = p as PlatformGraphics; const onX = playerPos.x + 15 > p.x && playerPos.x - 15 < p.x + pg.width; const onY = Math.abs(this.player!.platformY! - (p.y - 15)) <= 2; return onX && onY; });
            if (onPlatform) { const vx = this.getCurrentRunSpeed(); const newX = playerPos.x + vx; gameActions.updatePlayerPosition(newX, this.player.platformY); gameActions.updatePlayerVelocity(vx, 0); return; } else { this.player.isOnPlatform = false; this.player.platformY = undefined; }
        }
        const gravity = GAME_CONFIG.gravity * 0.016; const dragX = 0.985; let newVelocityY = playerPos.velocityY + gravity; let newVelocityX = playerPos.velocityX * dragX; newVelocityX = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, newVelocityX)); newVelocityY = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, newVelocityY)); const newX = playerPos.x + newVelocityX; const newY = playerPos.y + newVelocityY; gameActions.updatePlayerPosition(newX, newY); gameActions.updatePlayerVelocity(newVelocityX, newVelocityY); animationSystem.stopSwingAnimation(this.player); 
        // 자유낙하 착지 비활성화 (로프로만 착지 가능)
        // this.checkPlatformLanding();
    }

    private checkPlatformLanding(): void {
        const currentPlatforms = platforms.get();
        const playerPos = playerState.get();
        
        for (const platform of currentPlatforms) {
            const platformCast = platform as PlatformGraphics;
            const left = platform.x - 5;
            const right = platform.x + platformCast.width + 5;
            const isHorizontallyAligned = playerPos.x >= left && playerPos.x <= right;
            const platformTop = platform.y;
            const playerBottom = playerPos.y + 15;
            const isOnTop = playerBottom >= platformTop - 4 && playerBottom <= platformTop + 10;
            const isFallingDown = playerPos.velocityY > 0.2;
            
            if (isHorizontallyAligned && isOnTop && isFallingDown && !platformCast.landed) {
                const snapY = platform.y - 15;
                // X는 현재 위치 유지 (강제로 플랫폼 안으로 당기지 않음)
                const snapX = playerPos.x;
                
                gameActions.updatePlayerPosition(snapX, snapY);
                const runVx = this.getCurrentRunSpeed();
                gameActions.updatePlayerVelocity(runVx, 0); // Y 속도를 명시적으로 0으로
                gameActions.setSwinging(false);
                ropeState.setKey('isActive', false);
                ropeState.setKey('isFlying', false);
                ropeState.setKey('isPulling', false);
                
                if (!this.player) return;
                this.player.isOnPlatform = true;
                this.player.platformY = snapY;
                this.player.visible = true;
                this.player.alpha = 1;
                
                platformCast.landed = true;
                this.landingGraceFrames = 12;
                
                // 콤보 증가 (자유낙하 착지 시에도 콤보 유지)
                gameActions.addCombo();
                
                gameActions.addScore();
                this.updateScore();
                animationSystem.landingAnimation(this.player);
                soundSystem.play('landing');
                
                // 이벤트: 착지 시 VFX 트리거
                vfxSystem.spawnDustParticles(snapX, snapY, 5);
                vfxSystem.spawnLandingRipple(snapX, snapY);
                vfxSystem.spawnScoreBurst(snapX, snapY - 30);
                vfxSystem.triggerScreenShake(this.stage);
                return; // 착지했으면 루프 종료
            }
        }
    }

    private managePlatforms(): void {
        const currentPlatforms = platforms.get(); const cameraLeft = gameState.get().cameraX;
        const filteredPlatforms = currentPlatforms.filter(platform => { if (platform.x + platform.width < cameraLeft - 200) { this.world.removeChild(platform); return false; } return true; }); platforms.set(filteredPlatforms);
        const cameraRight = cameraLeft + GAME_CONFIG.width; const spawnThreshold = 600; let rightmostPlatformEnd = gameState.get().lastPlatformX;
        filteredPlatforms.forEach(platform => { const platformCast = platform as PlatformGraphics; const platformEnd = platform.x + platformCast.width; if (platformEnd > rightmostPlatformEnd) { rightmostPlatformEnd = platformEnd; } });
        if (rightmostPlatformEnd < cameraRight + spawnThreshold) { 
            const gap = 180 + Math.random() * 70;
            const x = rightmostPlatformEnd + gap;
            
            // 상단과 하단에 모두 플랫폼 생성
            const yTop = 80 + Math.random() * 200; // 상단: 80~280
            const platformTop = this.createPlatform(x, yTop);
            
            const yBottom = 350 + Math.random() * 170; // 하단: 350~520
            const platformBottom = this.createPlatform(x + 20, yBottom);
            
            const newRightmost = x + Math.max(platformTop.width, platformBottom.width);
            gameActions.updateCamera(newRightmost);
        }
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
        
        // 게임 오버 체크: 플레이어 Y 좌표 직접 체크
        const playerYTooLow = playerPos.y > 2000; // 바닥으로 너무 떨어짐
        const playerYTooHigh = playerPos.y < -500; // 위로 너무 솟구침
        
        // 화면 좌표 계산: world.x와 world.y는 카메라 오프셋
        const screenX = playerPos.x + this.world.x;
        const screenY = playerPos.y + this.world.y;
        
        // 게임 오버 조건:
        // - 플레이어 Y 좌표가 2000 이상 (바닥으로 너무 떨어짐)
        // - 플레이어 Y 좌표가 -500 미만 (위로 너무 솟구침)
        // - 아래쪽: 화면 높이를 크게 벗어남
        const outBottom = screenY > GAME_CONFIG.height + 50;
        // - 위쪽: 화면 위로 너무 많이 나감
        const outTop = screenY < -50;
        // - 왼쪽: 화면 왼쪽으로 나감
        const outLeft = screenX < -50;
        
        if (playerYTooLow || playerYTooHigh || outBottom || outTop || outLeft) {
            console.log('GAME OVER!', {
                playerY: playerPos.y.toFixed(1),
                playerYTooLow,
                playerYTooHigh,
                outBottom,
                outTop,
                outLeft
            });
            gameActions.endGame();
            gameActions.resetCombo(); // 게임 오버 시 콤보 리셋
            this.gameOverText.visible = true;
            animationSystem.gameOverAnimation(this.gameOverText);
            soundSystem.play('gameOver');
        }
    }
}

let gameManagerInstance: GameManager | null = null;
export async function initGameManager(): Promise<GameManager> { if (!gameManagerInstance) { gameManagerInstance = new GameManager(); await new Promise(r => setTimeout(r, 100)); (window as any).gameInstance = gameManagerInstance; } return gameManagerInstance; }


