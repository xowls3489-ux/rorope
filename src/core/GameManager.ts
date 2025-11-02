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
    private bgTiles: PIXI.Graphics[] = [];
    private bgTileWidth: number = 800;
    private bgSpeed: number = 0.4;
    private landingGraceFrames: number = 0;
    // 배경 요소들
    private stars: Array<{graphic: PIXI.Graphics, baseAlpha: number, twinkleSpeed: number, twinklePhase: number}> = [];
    private readonly maxSpeedX: number = 18;
    private readonly maxSpeedY: number = 80;
    private cameraZoom: number = 0.85;
    private targetCameraZoom: number = 0.85;
    private baseCameraZoom: number = 0.85; // 기본 줌 레벨 (모바일 대응)
    private trailParticleCounter: number = 0;
    // 스크롤 방식 변수
    private scrollOffsetX: number = 0; // 누적 스크롤 거리 (플레이어가 "이동한" 거리)
    
    private getCurrentRunSpeed(): number {
        // 스크롤 방식: scrollOffsetX 사용
        const distance = Math.max(0, this.scrollOffsetX);
        const speedIncrease = distance * GAME_CONFIG.runSpeedIncreasePerDistance;
        const currentSpeed = GAME_CONFIG.runSpeed + speedIncrease;
        return Math.min(currentSpeed, GAME_CONFIG.runSpeedMax);
    }

    constructor() { this.init(); }

    private async init(): Promise<void> {
        this.app = new PIXI.Application({ 
            width: GAME_CONFIG.width, 
            height: GAME_CONFIG.height, 
            backgroundColor: COLORS.background, 
            resizeTo: window, 
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
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
        this.setupResizeHandler(); // 화면 크기 변경 대응
        this.app.ticker.add(this.update.bind(this)); this.app.ticker.maxFPS = 60;
    }

    private updateGameOverPosition(): void {
        if (this.gameOverText) {
            this.gameOverText.x = GAME_CONFIG.width / 2;
            // 하단에서부터 고정 거리로 배치
            // 모바일: 하단에서 200px 위 (더 아래로)
            // 데스크톱: 중앙
            const isMobileSize = GAME_CONFIG.height < 800;
            const yPosition = isMobileSize 
                ? GAME_CONFIG.height - 200 
                : GAME_CONFIG.height / 2;
            this.gameOverText.y = yPosition;
        }
    }

    private setupResizeHandler(): void {
        const handleResize = () => {
            // 배경 타일 크기 조정
            this.bgTiles.forEach(tile => {
                tile.clear();
                tile.beginFill(COLORS.background);
                tile.drawRect(0, 0, this.bgTileWidth, GAME_CONFIG.height);
                tile.endFill();
            });
            
            // UI 요소 위치 재조정
            if (this.scoreText) {
                this.scoreText.x = GAME_CONFIG.width / 2;
                this.scoreText.y = 30;
            }
            this.updateGameOverPosition();
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    private initBackground(): void { 
        // 배경 타일
        for (let i = 0; i < 2; i++) { 
            const tile = new PIXI.Graphics(); 
            tile.beginFill(COLORS.background); 
            tile.drawRect(0, 0, this.bgTileWidth, GAME_CONFIG.height); 
            tile.endFill(); 
            tile.x = i * this.bgTileWidth; 
            this.bgTiles.push(tile); 
            this.bgLayer.addChild(tile); 
        }
        
        // 별 추가 (100개)
        for (let i = 0; i < 100; i++) {
            const star = new PIXI.Graphics();
            const size = Math.random() * 2 + 1; // 1-3px
            star.beginFill(0xFFFFFF);
            star.drawCircle(0, 0, size);
            star.endFill();
            star.x = Math.random() * GAME_CONFIG.width * 2;
            star.y = Math.random() * GAME_CONFIG.height;
            const baseAlpha = 0.3 + Math.random() * 0.7; // 0.3-1.0
            star.alpha = baseAlpha;
            this.bgLayer.addChild(star);
            this.stars.push({
                graphic: star,
                baseAlpha: baseAlpha,
                twinkleSpeed: 0.5 + Math.random() * 2, // 깜빡이는 속도
                twinklePhase: Math.random() * Math.PI * 2 // 초기 위상
            });
        }
    }

    private drawStickman(armAngle?: number, velocityY?: number): void {
        this.player.clear();
        this.player.lineStyle(2.5, 0xFFFFFF, 1);
        
        // 머리
        this.player.beginFill(0xFFFFFF);
        this.player.drawCircle(0, -10, 5);
        this.player.endFill();
        
        // 몸통
        this.player.moveTo(0, -5);
        this.player.lineTo(0, 8);
        
        if (armAngle !== undefined) {
            // 로프 발사 중: 한쪽 팔을 로프 방향으로 뻗기
            const armLength = 10;
            const armX = Math.cos(armAngle) * armLength;
            const armY = Math.sin(armAngle) * armLength;
            
            // 발사하는 팔 (로프 방향)
            this.player.moveTo(0, 0);
            this.player.lineTo(armX, armY);
            
            // 반대쪽 팔 (기본 위치)
            this.player.moveTo(0, 0);
            this.player.lineTo(-7, -3);
        } else if (velocityY !== undefined) {
            // 공중 애니메이션
            if (velocityY < -2) {
                // 상승 중: 팔을 위로
                this.player.moveTo(0, 0);
                this.player.lineTo(-6, -8);
                this.player.moveTo(0, 0);
                this.player.lineTo(6, -8);
            } else if (velocityY > 2) {
                // 낙하 중: 팔을 양옆으로 펼치기
                this.player.moveTo(0, 0);
                this.player.lineTo(-9, 0);
                this.player.moveTo(0, 0);
                this.player.lineTo(9, 0);
            } else {
                // 기본 팔 (느린 이동)
                this.player.moveTo(0, 0);
                this.player.lineTo(-7, -3);
                this.player.moveTo(0, 0);
                this.player.lineTo(7, -3);
            }
        } else {
            // 기본 팔 (좌우)
            this.player.moveTo(0, 0);
            this.player.lineTo(-7, -3);
            this.player.moveTo(0, 0);
            this.player.lineTo(7, -3);
        }
        
        // 다리 (공중 애니메이션)
        if (velocityY !== undefined && armAngle === undefined) {
            if (velocityY < -2) {
                // 상승 중: 다리 모으기
                this.player.moveTo(0, 8);
                this.player.lineTo(-3, 14);
                this.player.moveTo(0, 8);
                this.player.lineTo(3, 14);
            } else if (velocityY > 2) {
                // 낙하 중: 다리 펼치기
                this.player.moveTo(0, 8);
                this.player.lineTo(-6, 16);
                this.player.moveTo(0, 8);
                this.player.lineTo(6, 16);
            } else {
                // 기본 다리
                this.player.moveTo(0, 8);
                this.player.lineTo(-5, 16);
                this.player.moveTo(0, 8);
                this.player.lineTo(5, 16);
            }
        } else {
            // 기본 다리 (좌우)
            this.player.moveTo(0, 8);
            this.player.lineTo(-5, 16);
            this.player.moveTo(0, 8);
            this.player.lineTo(5, 16);
        }
    }

    private initGameObjects(): void {
        this.player = new PIXI.Graphics() as PlayerGraphics;
        this.drawStickman();
        this.world.addChild(this.player);
        // 초기 위치는 나중에 startGame()에서 플랫폼 위에 정확히 배치됨
        // 여기서는 임시 위치만 설정 (화면 밖에 숨김)
        this.player.x = -100;
        this.player.y = -100;
        this.rope = new PIXI.Graphics(); this.rope.visible = true; this.world.addChild(this.rope);
        this.scoreText = new PIXI.Text('0 m', { fontFamily: 'Pretendard, Inter, Roboto Mono, monospace', fontSize: 20, fill: COLORS.ui, align: 'center' });
        this.scoreText.x = GAME_CONFIG.width / 2; this.scoreText.y = 30; this.scoreText.anchor.set(0.5, 0.5); this.stage.addChild(this.scoreText);
        this.gameOverText = new PIXI.Text('GAME OVER\nTAP TO RETRY', { fontFamily: 'Pretendard, Inter, Roboto Mono, monospace', fontSize: 28, fill: COLORS.ui, align: 'center' });
        this.gameOverText.anchor.set(0.5, 0.5); 
        this.updateGameOverPosition(); // 초기 위치 설정
        this.gameOverText.visible = false; 
        this.stage.addChild(this.gameOverText);
    }

    private initInput(): void {
        // stage 레벨 이벤트 (UI 요소 클릭용)
        this.stage.interactive = true;
        this.stage.hitArea = new PIXI.Rectangle(0, 0, 10000, 10000);
        this.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            
            // 게임 오버 상태면 재시작 (stage 레벨에서 처리)
            if (currentState.gameOver) {
                this.restartGame();
                return;
            }
        });
        
        // world 레벨 이벤트 (게임 플레이용)
        this.world.interactive = true;
        this.world.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            
            // 게임 오버 상태는 stage에서 처리
            if (currentState.gameOver) {
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
        
        // pointerup 제거 - 모바일용 (탭만으로 로프 발사)
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
        this.targetCameraZoom = this.baseCameraZoom;
        
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
        
        // 스크롤 방식: 시작 플랫폼을 플레이어 고정 위치 근처에 배치
        const playerX = GAME_CONFIG.playerFixedX;
        const startingPlatform = this.createPlatformNoAnimation(playerX - 50, GAME_CONFIG.height - 165); 
        let lastX = startingPlatform.x + startingPlatform.width; 
        
        // 나머지 플랫폼은 화면 오른쪽까지 배치
        for (let i = 0; i < 8; i++) {
            const gap = 180 + Math.random() * 70;
            lastX = lastX + gap;
            
            // 상단 플랫폼
            const yTop = 80 + Math.random() * 200;
            const platformTop = this.createPlatform(lastX, yTop);
            
            // 하단 플랫폼
            const yBottom = 350 + Math.random() * 170;
            const platformBottom = this.createPlatform(lastX + 20, yBottom);
            
            lastX = lastX + Math.max(platformTop.width, platformBottom.width);
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
            const playerY = platformTopY - 15;
            // 스크롤 방식: 플레이어는 고정 위치
            const playerX = GAME_CONFIG.playerFixedX;
            
            console.log('플레이어 배치:', { 
                platformTopY, 
                playerY, 
                playerX, 
                platformWidth: pg.width,
                playerBottom: playerY + 15,
                platformHeight: GAME_CONFIG.platformHeight
            });
            
            // 플레이어를 플랫폼 위에 정확히 배치
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
            // 플랫폼이 없으면 기본 위치 (스크롤 방식: 고정 X)
            this.player.x = GAME_CONFIG.playerFixedX;
            this.player.y = GAME_CONFIG.height - 180;
            gameActions.updatePlayerPosition(GAME_CONFIG.playerFixedX, GAME_CONFIG.height - 180);
            gameActions.updatePlayerVelocity(0, 0);
        }
        
        // 스크롤 초기화
        this.scrollOffsetX = 0;
        this.world.x = 0;
        this.world.y = 0;
        
        // 카메라 줌 초기화
        this.cameraZoom = this.baseCameraZoom;
        this.targetCameraZoom = this.baseCameraZoom;
        this.world.scale.set(this.baseCameraZoom);
        
        if (this.fxLayer) {
            this.fxLayer.x = 0;
            this.fxLayer.y = 0;
            this.fxLayer.scale.set(this.baseCameraZoom);
        }
        
        // hitArea 초기화
        this.world.hitArea = new PIXI.Rectangle(-50000, -10000, 100000, 20000);
        
        this.updateScore();
        this.gameOverText.visible = false;
        animationSystem.fadeInUI(this.scoreText);
        vfxSystem.reset();
    }
    public startGameFromUI(): void { this.startGame(); }
    public restartGameFromUI(): void { this.restartGame(); }
    private restartGame(): void { const currentPlatforms = platforms.get(); currentPlatforms.forEach(p => { this.world.removeChild(p); }); gameActions.clearPlatforms(); this.isSwingSoundPlaying = false; this.startGame(); }

    private updateScore(): void { 
        // 스크롤 방식: scrollOffsetX를 미터로 변환 (100px = 1m)
        const meters = Math.floor(Math.max(0, this.scrollOffsetX) / 100);
        this.scoreText.text = `${meters} m`;
        animationSystem.scoreAnimation(this.scoreText);
    }

    private update(): void {
        const currentState = gameState.get(); if (!currentState.isPlaying) return;
        try {
            const rope = ropeState.get(); 
            if (rope.isFlying) { 
                ropeSystem.updateFlight(GAME_CONFIG.platformHeight, 700, 0.016); 
                this.updateFreeFallPhysics(); 
            } else if (rope.isPulling) { 
                this.updatePullToAnchor(); 
                // 풀링 중 카메라 줌인 (기본 줌에서 약간만)
                this.targetCameraZoom = this.baseCameraZoom * GAME_CONFIG.grappleCameraZoom;
            } else { 
                this.updateFreeFallPhysics(); 
                // 풀링 중이 아니면 카메라 줌 복구
                this.targetCameraZoom = this.baseCameraZoom;
            }
            this.updateCameraZoom();
            this.updatePlayerGraphics(); this.updateCamera(); this.updateBackground(); this.managePlatforms(); this.drawRope();
            this.updateScore(); // 매 프레임마다 거리 업데이트
            vfxSystem.update(); // VFX 시스템 업데이트 (파티클 이동, fxLayer 페이드)
        } catch (e) { console.error('게임 업데이트 중 오류 발생:', e); gameActions.pauseGame(); }
        this.checkGameOver();
    }

    private updatePlayerGraphics(): void { 
        if (!this.player) return; 
        const playerPos = playerState.get(); 
        const rope = ropeState.get();
        
        // 스크롤 방식: 플레이어는 항상 고정 X 위치에 렌더링
        this.player.x = GAME_CONFIG.playerFixedX; 
        this.player.y = playerPos.y; 
        this.player.visible = true; 
        this.player.alpha = 1; 
        
        // 로프 발사/당기기 중일 때 팔 애니메이션
        if (rope.isFlying || rope.isPulling || rope.isActive) {
            // 로프 방향으로 팔 뻗기
            const dx = rope.anchorX - playerPos.x;
            const dy = rope.anchorY - playerPos.y;
            const armAngle = Math.atan2(dy, dx);
            this.drawStickman(armAngle);
        } else {
            // 공중 애니메이션 (상승/하강 포즈)
            this.drawStickman(undefined, playerPos.velocityY);
        }
        
        // 속도에 따라 스틱맨 회전 (역동적인 느낌)
        const velocityX = playerPos.velocityX;
        const velocityY = playerPos.velocityY;
        const angle = Math.atan2(velocityY, velocityX);
        this.player.rotation = angle * 0.3; // 살짝만 회전
        
        try { (this.player as any).scale?.set?.(1, 1); } catch {} 
    }

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
        
        // 스크롤 방식: 플레이어가 고정 위치를 벗어나면 월드를 스크롤
        const targetPlayerX = GAME_CONFIG.playerFixedX;
        const deltaX = playerPos.x - targetPlayerX;
        
        // 플레이어가 고정 위치에서 벗어났으면
        if (Math.abs(deltaX) > 1) {
            // 플랫폼과 로프 앵커를 반대 방향으로 이동
            const currentPlatforms = platforms.get();
            currentPlatforms.forEach(platform => {
                platform.x -= deltaX;
            });
            
            // 로프 앵커도 이동
            if (rope.isActive || rope.isPulling) {
                ropeState.setKey('anchorX', rope.anchorX - deltaX);
            }
            if (rope.isFlying && rope.tipX !== undefined) {
                ropeState.setKey('tipX', rope.tipX - deltaX);
            }
            
            // 스크롤 누적
            this.scrollOffsetX += deltaX;
            
            // 플레이어를 고정 위치로 되돌림
            gameActions.updatePlayerPosition(targetPlayerX, playerPos.y);
        }
        
        // 카메라 X축은 고정 (이동하지 않음)
        const worldX = 0;
        
        // Y축 추적 (수직)
        const viewH = GAME_CONFIG.height;
        const deadZoneY = 150;
        const currentWorldY = this.world.y || 0;
        let targetWorldY = currentWorldY;
        const playerScreenY = playerPos.y + currentWorldY;
        const topBound = viewH / 2 - deadZoneY;
        const bottomBound = viewH / 2 + deadZoneY;
        
        if (playerScreenY < topBound) {
            const offset = topBound - playerScreenY;
            targetWorldY += offset;
        } else if (playerScreenY > bottomBound) {
            const offset = playerScreenY - bottomBound;
            if (playerScreenY > viewH + 50) {
                targetWorldY = currentWorldY;
            } else {
                targetWorldY -= offset;
            }
        }
        
        // Y축 스무스 추적
        const cameraSpeedY = 0.15;
        const newWorldY = currentWorldY + (targetWorldY - currentWorldY) * cameraSpeedY;
        
        // world 위치 설정 (X는 0 고정)
        this.world.x = worldX;
        this.world.y = newWorldY;
        
        // hitArea 설정
        const scale = this.world.scale.x || 1.0;
        this.world.hitArea = new PIXI.Rectangle(-1000, -1000, 3000, 3000);
        
        // fxLayer 동기화 (X는 0)
        if (this.fxLayer) {
            this.fxLayer.x = 0;
            this.fxLayer.y = newWorldY;
        }
        
        // 거리 업데이트 (scrollOffsetX 사용)
        gameActions.updateCamera(this.scrollOffsetX);
    }

    private updateBackground(): void { 
        // 스크롤 방식: scrollOffsetX 사용
        const scrollX = this.scrollOffsetX * this.bgSpeed; 
        
        // 배경 타일 스크롤
        for (let i = 0; i < this.bgTiles.length; i++) { 
            const tile = this.bgTiles[i]; 
            const baseX = (i % 2) * this.bgTileWidth; 
            tile.x = baseX - (scrollX % (this.bgTileWidth * 2)); 
        }
        
        // 별 깜빡임 애니메이션 (최적화)
        const time = performance.now() * 0.001; // 초 단위
        
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            
            // 깜빡임 (매 프레임)
            const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
            star.graphic.alpha = star.baseAlpha * (0.7 + twinkle * 0.3);
            
            // 별 위치 계산 (배경과 같은 속도로 스크롤)
            const baseX = (star.graphic as any).baseX || star.graphic.x;
            if (!(star.graphic as any).baseX) {
                (star.graphic as any).baseX = star.graphic.x;
            }
            star.graphic.x = baseX - scrollX;
            
            // 화면 밖으로 나가면 반대편에서 재등장
            if (star.graphic.x < -50) {
                (star.graphic as any).baseX += this.bgTileWidth * 2;
            } else if (star.graphic.x > GAME_CONFIG.width + 50) {
                (star.graphic as any).baseX -= this.bgTileWidth * 2;
            }
        }
    }

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
        
        // 앵커에 가까워지면 자동으로 로프 해제
        if (dist < 30) {
            // 로프 해제
            gameActions.stopPull();
            gameActions.setSwinging(false);
            ropeState.setKey('isActive', false);
            ropeState.setKey('isFlying', false);
            ropeState.setKey('isPulling', false);
            
            // 카메라 줌 복구
            this.targetCameraZoom = this.baseCameraZoom;
            
            // 현재 속도를 안전하게 제한
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
            // 스크롤 방식: 플레이어는 고정 X
            const onPlatform = currentPlatforms.find(p => { 
                const pg = p as PlatformGraphics; 
                const onX = GAME_CONFIG.playerFixedX + 15 > p.x && GAME_CONFIG.playerFixedX - 15 < p.x + pg.width; 
                const onY = Math.abs(this.player!.platformY! - (p.y - 15)) <= 2; 
                return onX && onY; 
            });
            if (onPlatform) { 
                // 플레이어는 고정 위치 유지
                gameActions.updatePlayerPosition(GAME_CONFIG.playerFixedX, this.player.platformY); 
                gameActions.updatePlayerVelocity(0, 0); 
                return; 
            } else { 
                this.player.isOnPlatform = false; 
                this.player.platformY = undefined; 
            }
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
            // 스크롤 방식: 플레이어는 고정 X
            const isHorizontallyAligned = GAME_CONFIG.playerFixedX >= left && GAME_CONFIG.playerFixedX <= right;
            const platformTop = platform.y;
            const playerBottom = playerPos.y + 15;
            const isOnTop = playerBottom >= platformTop - 4 && playerBottom <= platformTop + 10;
            const isFallingDown = playerPos.velocityY > 0.2;
            
            if (isHorizontallyAligned && isOnTop && isFallingDown && !platformCast.landed) {
                const snapY = platform.y - 15;
                // 스크롤 방식: X는 고정 위치
                const snapX = GAME_CONFIG.playerFixedX;
                
                gameActions.updatePlayerPosition(snapX, snapY);
                gameActions.updatePlayerVelocity(0, 0); // 스크롤 방식: 속도는 0
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
                
                // 점수는 매 프레임마다 거리로 자동 업데이트됨
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
        const currentPlatforms = platforms.get();
        
        // 화면 왼쪽 밖으로 나간 플랫폼 제거
        const filteredPlatforms = currentPlatforms.filter(platform => { 
            if (platform.x + (platform as PlatformGraphics).width < -200) { 
                this.world.removeChild(platform); 
                return false; 
            } 
            return true; 
        });
        platforms.set(filteredPlatforms);
        
        // 가장 오른쪽 플랫폼 찾기
        let rightmostPlatformEnd = 0;
        filteredPlatforms.forEach(platform => { 
            const platformCast = platform as PlatformGraphics; 
            const platformEnd = platform.x + platformCast.width; 
            if (platformEnd > rightmostPlatformEnd) { 
                rightmostPlatformEnd = platformEnd; 
            } 
        });
        
        // 화면 오른쪽에 플랫폼이 부족하면 생성
        const spawnThreshold = GAME_CONFIG.width + 600;
        if (rightmostPlatformEnd < spawnThreshold) { 
            const gap = 180 + Math.random() * 70;
            const x = rightmostPlatformEnd + gap;
            
            // 상단과 하단에 모두 플랫폼 생성
            const yTop = 80 + Math.random() * 200;
            const platformTop = this.createPlatform(x, yTop);
            
            const yBottom = 350 + Math.random() * 170;
            const platformBottom = this.createPlatform(x + 20, yBottom);
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


