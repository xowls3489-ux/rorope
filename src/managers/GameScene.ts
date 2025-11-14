import * as PIXI from 'pixi.js';
import { gameState, playerState, ropeState, gameActions, platforms } from '../stores/gameStore';
import { animationSystem } from '../systems/animationSystem';
import { ropeSystem } from '../systems/ropeSystem';
import { vfxSystem } from '../systems/vfxSystem';
import { GAME_CONFIG, COLORS } from '../core/config';
import { UIManager } from './UIManager';
import { AudioManager } from './AudioManager';
import { submitGameCenterLeaderBoardScore, isMinVersionSupported } from '@apps-in-toss/web-framework';
import { isLeaderboardAvailable } from '../utils/platform';
import { logger } from '../utils/logger';

interface PlayerGraphics extends PIXI.Graphics {
    isOnPlatform?: boolean;
    platformY?: number;
}

interface PlatformGraphics extends PIXI.Graphics {
    width: number;
    height: number;
    landed?: boolean;
    isMoving?: boolean;
    moveType?: 'horizontal' | 'vertical';
    moveSpeed?: number;
    moveRange?: number;
    moveDirection?: number;
    initialX?: number;
    initialY?: number;
    comboGiven?: boolean; // 이미 콤보를 부여했는지 여부
    inUse?: boolean; // 현재 사용 중인 플랫폼인지 여부
}

type StarGraphics = PIXI.Graphics & {
    baseX?: number;
    twinklePhase?: number;
};

type CloudSprite = PIXI.Sprite & {
    baseX?: number;
};

/**
 * GameScene
 * 핵심 게임 로직 담당 (물리, 플랫폼, 로프 등)
 */
export class GameScene {
    private app!: PIXI.Application;
    private stage!: PIXI.Container;
    private world!: PIXI.Container;
    private bgLayer!: PIXI.Container;
    private fxLayer!: PIXI.Container;
    
    private player!: PlayerGraphics;
    private rope!: PIXI.Graphics;
    
    private uiManager!: UIManager;
    private audioManager!: AudioManager;
    
    // 배경 요소
    private bgTiles: PIXI.Graphics[] = [];
    private stars: Array<{
        graphic: StarGraphics;
        baseAlpha: number;
        twinkleSpeed: number;
        twinklePhase: number;
    }> = [];
    private clouds: Array<{ sprite: CloudSprite; speed: number }> = [];
    
    // 물리 및 카메라
    private readonly maxSpeedX: number = GAME_CONFIG.maxSpeedX;
    private readonly maxSpeedY: number = GAME_CONFIG.maxSpeedY;
    private cameraZoom: number = GAME_CONFIG.baseCameraZoom;
    private targetCameraZoom: number = GAME_CONFIG.baseCameraZoom;
    private baseCameraZoom: number = GAME_CONFIG.baseCameraZoom;
    
    // 오브젝트 풀링
    private platformPool: PlatformGraphics[] = [];
    private readonly platformPoolSize: number = GAME_CONFIG.platformPoolSize;
    
    // 파워업 아이템
    private powerupStars: Array<{ graphic: PIXI.Graphics; collected: boolean }> = [];
    
    // 스크롤 및 프레임 카운터
    private scrollOffsetX: number = 0;
    private frameCounter: number = 0;
    private trailParticleCounter: number = 0;
    private comboVfxCounter: number = 0;
    private landingGraceFrames: number = 0;
    
    // 슬로우 모션 및 무적 모드
    private slowMotionEndTime: number = 0;
    private invincibleEndTime: number = 0;
    private tutorialRequestedFromPause: boolean = false;

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        try {
            // PixiJS 앱 초기화
            this.app = new PIXI.Application({
                width: GAME_CONFIG.width,
                height: GAME_CONFIG.height,
                backgroundColor: COLORS.background,
                resizeTo: window,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            const gameRoot = document.getElementById('game-root');
            (gameRoot ?? document.body).appendChild(this.app.view as unknown as Node);

            this.stage = this.app.stage;

            // 레이어 초기화 (뒤에서 앞 순서)
            this.bgLayer = new PIXI.Container();
            this.bgLayer.name = 'bgLayer';
            this.stage.addChild(this.bgLayer);

            // fxLayer를 bgLayer 다음에 추가 (world보다 뒤에)
            this.fxLayer = vfxSystem.initialize(this.stage);

            // UI 매니저를 먼저 초기화 (uiLayer가 먼저 추가됨)
            this.uiManager = new UIManager(this.stage);
            this.audioManager = new AudioManager();

            // world를 uiLayer 위에 추가 (클릭 이벤트를 받을 수 있도록)
            this.world = new PIXI.Container();
            this.world.name = 'world';
            this.stage.addChild(this.world);
            this.world.eventMode = 'static';
            this.world.interactive = true;
            this.world.hitArea = new PIXI.Rectangle(-50000, -10000, 100000, 20000);

            // pauseButton과 pausePanel을 world 위로 올리기 (클릭 가능하도록)
            this.uiManager.bringPauseUIToFront();

            // 사운드 설정 확인 및 적용
            try {
                const savedMuted = localStorage.getItem('soundMuted');
                if (savedMuted !== null) {
                    const isMuted = savedMuted === 'true';
                    this.audioManager.setMuted(isMuted);
                    logger.log('게임 시작 시 사운드 설정:', isMuted ? '뮤트' : '활성');
                }
            } catch (error) {
                console.warn('사운드 설정 로드 실패:', error);
            }

            // 일시정지 콜백 설정
            this.uiManager.setPauseCallbacks(
                () => this.pauseGame(),
                () => this.resumeGame(),
                (enabled: boolean) => this.toggleSound(enabled),
                () => this.requestTutorialReplay(),
                () => this.handleResetRecords()
            );

            window.addEventListener('tutorial-dismissed', this.handleTutorialDismissed);

            // 배경, 플랫폼 풀, 게임 오브젝트, 입력 초기화
            await this.initBackground();
            this.initPlatformPool();
            this.initGameObjects();
            this.initInput();

            // 게임 루프 시작
            this.app.ticker.add(this.update.bind(this));
            this.app.ticker.maxFPS = 60;
        } catch (error) {
            console.error('게임 초기화 실패:', error);
            // 사용자에게 에러 표시
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#ff0000;color:#fff;padding:20px;border-radius:8px;font-family:sans-serif;text-align:center;z-index:9999;';
            errorMsg.innerHTML = `<h3>게임 초기화 실패</h3><p>${error instanceof Error ? error.message : '알 수 없는 오류'}</p>`;
            document.body.appendChild(errorMsg);
        }
    }

    private initPlatformPool(): void {
        for (let i = 0; i < this.platformPoolSize; i++) {
            const platform = new PIXI.Graphics() as PlatformGraphics;
            platform.visible = false;
            platform.width = 0;
            platform.height = GAME_CONFIG.platformHeight;
            platform.inUse = false;
            this.world.addChild(platform);
            this.platformPool.push(platform);
        }
    }

    private async initBackground(): Promise<void> {
        // 배경 타일
        for (let i = 0; i < 2; i++) {
            const tile = new PIXI.Graphics();
            tile.beginFill(COLORS.background);
            tile.drawRect(0, 0, GAME_CONFIG.bgTileWidth, GAME_CONFIG.height);
            tile.endFill();
            tile.x = i * GAME_CONFIG.bgTileWidth;
            this.bgTiles.push(tile);
            this.bgLayer.addChild(tile);
        }

        // 별 추가
        for (let i = 0; i < 15; i++) {
            const star = new PIXI.Graphics() as StarGraphics;
            const size = Math.random() * 2 + 1;
            star.beginFill(0xffffff);
            star.drawCircle(0, 0, size);
            star.endFill();
            const startX = Math.random() * GAME_CONFIG.width * 2;
            star.x = startX;
            star.y = Math.random() * GAME_CONFIG.height;
            const baseAlpha = 0.3 + Math.random() * 0.7;
            star.alpha = baseAlpha;
            star.baseX = startX;
            this.bgLayer.addChild(star);
            this.stars.push({
                graphic: star,
                baseAlpha: baseAlpha,
                twinkleSpeed: 0.5 + Math.random() * 2,
                twinklePhase: Math.random() * Math.PI * 2,
            });
        }

        // 구름 추가
        try {
            const cloudTexture = await PIXI.Assets.load('/src/sprites/cloud.png');
            for (let i = 0; i < 4; i++) {
                const cloud = new PIXI.Sprite(cloudTexture) as CloudSprite;
                const scale = 0.3 + Math.random() * 0.4;
                cloud.scale.set(scale);
                const startX = Math.random() * GAME_CONFIG.width * 2;
                cloud.x = startX;
                cloud.y = 50 + Math.random() * (GAME_CONFIG.height * 0.4);
                cloud.alpha = 0.2 + Math.random() * 0.3;
                cloud.anchor.set(0.5, 0.5);
                cloud.baseX = startX;
                this.bgLayer.addChild(cloud);
                const speed = 0.3 + Math.random() * 0.4;
                this.clouds.push({ sprite: cloud, speed });
            }
        } catch (error) {
            console.error('구름 텍스처 로드 실패:', error);
        }
    }

    private drawStickman(armAngle?: number, velocityY?: number): void {
        this.player.clear();
        this.player.lineStyle(2.5, 0xffffff, 1);

        // 머리
        this.player.beginFill(0xffffff);
        this.player.drawCircle(0, -10, 5);
        this.player.endFill();

        // 몸통
        this.player.moveTo(0, -5);
        this.player.lineTo(0, 8);

        // 팔 애니메이션
        if (armAngle !== undefined) {
            const armLength = GAME_CONFIG.playerArmLength;
            const armX = Math.cos(armAngle) * armLength;
            const armY = Math.sin(armAngle) * armLength;
            this.player.moveTo(0, 0);
            this.player.lineTo(armX, armY);
            this.player.moveTo(0, 0);
            this.player.lineTo(-7, -3);
        } else if (velocityY !== undefined) {
            if (velocityY < -2) {
                this.player.moveTo(0, 0);
                this.player.lineTo(-6, -8);
                this.player.moveTo(0, 0);
                this.player.lineTo(6, -8);
            } else if (velocityY > 2) {
                this.player.moveTo(0, 0);
                this.player.lineTo(-9, 0);
                this.player.moveTo(0, 0);
                this.player.lineTo(9, 0);
            } else {
                this.player.moveTo(0, 0);
                this.player.lineTo(-7, -3);
                this.player.moveTo(0, 0);
                this.player.lineTo(7, -3);
            }
        } else {
            this.player.moveTo(0, 0);
            this.player.lineTo(-7, -3);
            this.player.moveTo(0, 0);
            this.player.lineTo(7, -3);
        }

        // 다리 애니메이션
        if (velocityY !== undefined && armAngle === undefined) {
            if (velocityY < -2) {
                this.player.moveTo(0, 8);
                this.player.lineTo(-3, 14);
                this.player.moveTo(0, 8);
                this.player.lineTo(3, 14);
            } else if (velocityY > 2) {
                this.player.moveTo(0, 8);
                this.player.lineTo(-6, 16);
                this.player.moveTo(0, 8);
                this.player.lineTo(6, 16);
            } else {
                this.player.moveTo(0, 8);
                this.player.lineTo(-5, 16);
                this.player.moveTo(0, 8);
                this.player.lineTo(5, 16);
            }
        } else {
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
        this.player.x = -100;
        this.player.y = -100;

        this.rope = new PIXI.Graphics();
        this.rope.visible = true;
        this.world.addChild(this.rope);
    }

    private initInput(): void {
        // Stage 레벨 이벤트 (게임오버 재시작)
        this.stage.interactive = true;
        this.stage.hitArea = new PIXI.Rectangle(0, 0, 10000, 10000);
        this.stage.on('pointerdown', (_event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            if (currentState.gameOver) {
                this.restartGame();
                return;
            }
        });

        // World 레벨 이벤트 (게임 플레이)
        this.world.interactive = true;
        this.world.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            if (currentState.gameOver) return;

            if (!currentState.isPlaying) {
                this.shootRopeTowardPoint(event.clientX, event.clientY);
                return;
            }

            this.shootRopeTowardPoint(event.clientX, event.clientY);
        });
    }

    private shootRopeTowardPoint(clientX: number, clientY: number): void {
        const currentState = gameState.get();

        if (currentState.isInvincible) return;

        if (!currentState.isPlaying) {
            gameState.setKey('isPlaying', true);
        }

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
        
        gameActions.updateSwingPhysics(0, 0);

        const playerPos = playerState.get();
        const onPlatform = this.player?.isOnPlatform || false;

        if (wasRopeActive) {
            gameActions.updatePlayerVelocity(0, 0);
        } else if (onPlatform) {
            gameActions.updatePlayerVelocity(0, 0);
        } else {
            const clampedVx = Math.max(-10, Math.min(10, playerPos.velocityX * 0.5));
            const clampedVy = Math.max(-15, Math.min(15, playerPos.velocityY * 0.5));
            gameActions.updatePlayerVelocity(clampedVx, clampedVy);
        }

        ropeSystem.launchFromClick(this.app, this.world, clientX, clientY);
        if (this.player) this.player.isOnPlatform = false;
        
        this.audioManager.playRopeShoot();

        // 스파크 효과
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


    /**
     * 플랫폼 풀에서 사용 가능한 플랫폼 가져오기 (없으면 새로 생성)
     */
    private getPlatformFromPool(): PlatformGraphics {
        const platform = this.platformPool.find((p) => !p.inUse);
        if (!platform) {
            logger.warn('플랫폼 풀 부족! 새로 생성합니다.');
            const newPlatform = new PIXI.Graphics() as PlatformGraphics;
            this.world.addChild(newPlatform);
            this.platformPool.push(newPlatform);
            return newPlatform;
        }
        return platform;
    }

    /**
     * 플랫폼 기본 설정 (공통 로직 추출)
     */
    private setupPlatformBase(
        platform: PlatformGraphics,
        x: number,
        y: number,
        width: number,
        options?: {
            color?: number;
            isMoving?: boolean;
            moveType?: 'horizontal' | 'vertical';
            moveSpeed?: number;
            moveRange?: number;
            initialX?: number;
            initialY?: number;
        }
    ): PlatformGraphics {
        const color = options?.color ?? COLORS.primary;

        platform.clear();
        platform.beginFill(color);
        platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0);
        platform.endFill();

        // 테두리 추가 (회색 플랫폼만)
        if (color !== COLORS.primary) {
            const borderColor = color === 0x888888 ? 0xcccccc : 0x999999;
            platform.lineStyle(2, borderColor, 0.4);
            platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0);
        }

        platform.x = x;
        platform.y = y;
        platform.width = width;
        platform.height = GAME_CONFIG.platformHeight;
        platform.visible = true;
        platform.landed = false;
        platform.comboGiven = false;
        platform.inUse = true;

        // 이동 설정
        platform.isMoving = options?.isMoving ?? false;
        platform.moveType = options?.moveType;
        platform.moveSpeed = options?.moveSpeed;
        platform.moveRange = options?.moveRange;
        platform.moveDirection = options?.isMoving ? 1 : undefined;
        platform.initialX = options?.initialX;
        platform.initialY = options?.initialY;

        return platform;
    }

    /**
     * 랜덤 너비 계산
     */
    private randomPlatformWidth(): number {
        return GAME_CONFIG.platformWidth.min +
            Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min);
    }

    private createPlatform(x: number, y: number): PlatformGraphics {
        const platform = this.getPlatformFromPool();
        const width = this.randomPlatformWidth();
        this.setupPlatformBase(platform, x, y, width);
        gameActions.addPlatform(platform);
        animationSystem.platformSpawnAnimation(platform);
        return platform;
    }

    private createMovingPlatform(
        x: number,
        y: number,
        moveRange: number = 100,
        moveSpeed: number = 1.5
    ): PlatformGraphics {
        const platform = this.getPlatformFromPool();
        const width = this.randomPlatformWidth();
        this.setupPlatformBase(platform, x, y, width, {
            color: 0x888888,
            isMoving: true,
            moveType: 'horizontal',
            moveSpeed,
            moveRange,
            initialX: x
        });
        gameActions.addPlatform(platform);
        animationSystem.platformSpawnAnimation(platform);
        return platform;
    }

    private createVerticalMovingPlatform(
        x: number,
        y: number,
        moveRange: number = 100,
        moveSpeed: number = 1.5
    ): PlatformGraphics {
        const platform = this.getPlatformFromPool();
        const width = this.randomPlatformWidth();
        this.setupPlatformBase(platform, x, y, width, {
            color: 0x666666,
            isMoving: true,
            moveType: 'vertical',
            moveSpeed,
            moveRange,
            initialY: y
        });
        gameActions.addPlatform(platform);
        animationSystem.platformSpawnAnimation(platform);
        return platform;
    }

    private createRandomMovingPlatform(x: number, y: number): PlatformGraphics {
        const options = [
            { range: 80, speed: 1.5 },
            { range: 100, speed: 1.8 },
            { range: 120, speed: 2.0 },
            { range: 150, speed: 2.2 },
            { range: 180, speed: 1.6 },
            { range: 200, speed: 2.5 },
        ];
        const randomOption = options[Math.floor(Math.random() * options.length)];
        return this.createMovingPlatform(x, y, randomOption.range, randomOption.speed);
    }

    private createRandomVerticalMovingPlatform(x: number, y: number): PlatformGraphics {
        const options = [
            { range: 100, speed: 1.2 },
            { range: 120, speed: 1.4 },
            { range: 140, speed: 1.6 },
            { range: 160, speed: 1.8 },
            { range: 180, speed: 1.5 },
            { range: 200, speed: 2.0 },
        ];
        const randomOption = options[Math.floor(Math.random() * options.length)];
        return this.createVerticalMovingPlatform(x, y, randomOption.range, randomOption.speed);
    }

    private generateInitialPlatforms(): void {
        gameActions.clearPlatforms();
        gameActions.updateCamera(0);

        const playerX = GAME_CONFIG.playerFixedX;
        const startingPlatform = this.createPlatformNoAnimation(
            playerX - 50,
            GAME_CONFIG.height - 165
        );
        let lastX = startingPlatform.x + startingPlatform.width;

        for (let i = 0; i < 8; i++) {
            const gap = 180 + Math.random() * 70;
            lastX = lastX + gap;

            const yTop = 80 + Math.random() * 200;
            const platformTop = this.createPlatform(lastX, yTop);

            const yBottom = 350 + Math.random() * 170;
            const platformBottom = this.createPlatform(lastX + 20, yBottom);

            lastX = lastX + Math.max(platformTop.width, platformBottom.width);
        }
    }

    private createPlatformNoAnimation(x: number, y: number): PlatformGraphics {
        const platform = this.getPlatformFromPool();
        const width = this.randomPlatformWidth();
        this.setupPlatformBase(platform, x, y, width);
        gameActions.addPlatform(platform);
        return platform;
    }

    private startGame(): void {
        gameActions.startGame();
        gameState.setKey('isPlaying', false);

        if (!this.player) {
            this.initGameObjects();
        }

        this.generateInitialPlatforms();

        const currentPlatforms = platforms.get();
        const startingPlatform = currentPlatforms[0];

        if (startingPlatform) {
            const platformTopY = startingPlatform.y;
            const playerY = platformTopY - 15;
            const playerX = GAME_CONFIG.playerFixedX;

            this.player.x = playerX;
            this.player.y = playerY;
            gameActions.updatePlayerPosition(playerX, playerY);
            gameActions.updatePlayerVelocity(0, 0);
            gameActions.updateSwingPhysics(0, 0);

            this.player.isOnPlatform = true;
            this.player.platformY = playerY;

            const playerIndex = this.world.children.indexOf(this.player);
            if (playerIndex >= 0 && playerIndex < this.world.children.length - 1) {
                this.world.setChildIndex(this.player, this.world.children.length - 1);
            }
        } else {
            this.player.x = GAME_CONFIG.playerFixedX;
            this.player.y = GAME_CONFIG.height - 180;
            gameActions.updatePlayerPosition(GAME_CONFIG.playerFixedX, GAME_CONFIG.height - 180);
            gameActions.updatePlayerVelocity(0, 0);
        }

        this.scrollOffsetX = 0;
        this.world.x = 0;
        this.world.y = 0;

        this.cameraZoom = this.baseCameraZoom;
        this.targetCameraZoom = this.baseCameraZoom;
        this.world.scale.set(this.baseCameraZoom);

        if (this.fxLayer) {
            this.fxLayer.x = 0;
            this.fxLayer.y = 0;
            this.fxLayer.scale.set(this.baseCameraZoom);
        }

        this.world.hitArea = new PIXI.Rectangle(-50000, -10000, 100000, 20000);

        this.uiManager.setScrollOffset(this.scrollOffsetX);
        this.uiManager.updateScore();
        this.uiManager.onGameStart();
        vfxSystem.reset();
        
        // 배경음악 페이드 인 (부드러운 시작)
        this.audioManager.fadeInBackground(1500);
    }

    public startGameFromUI(): void {
        this.startGame();
    }

    public restartGameFromUI(): void {
        this.restartGame();
    }

    private restartGame(): void {
        const currentPlatforms = platforms.get();
        currentPlatforms.forEach((p) => {
            const pg = p as PlatformGraphics;
            pg.visible = false;
            pg.inUse = false;
            pg.isMoving = false;
            pg.moveType = undefined;
            pg.moveSpeed = undefined;
            pg.moveRange = undefined;
            pg.moveDirection = undefined;
            pg.initialX = undefined;
            pg.initialY = undefined;
        });
        gameActions.clearPlatforms();

        // 파워업 스타 정리
        this.powerupStars.forEach((starData) => {
            this.world.removeChild(starData.graphic);
            starData.graphic.destroy();
        });
        this.powerupStars = [];

        this.startGame();
    }

    /**
     * 게임 종료 시 리소스 정리
     */
    public destroy(): void {
        // 배경 타일 정리
        this.bgTiles.forEach(tile => {
            this.bgLayer.removeChild(tile);
            tile.destroy();
        });
        this.bgTiles = [];

        // 별 정리
        this.stars.forEach(starData => {
            this.bgLayer.removeChild(starData.graphic);
            starData.graphic.destroy();
        });
        this.stars = [];

        // 구름 정리
        this.clouds.forEach(cloudData => {
            this.bgLayer.removeChild(cloudData.sprite);
            cloudData.sprite.destroy();
        });
        this.clouds = [];

        // 파워업 스타 정리
        this.powerupStars.forEach(starData => {
            this.world.removeChild(starData.graphic);
            starData.graphic.destroy();
        });
        this.powerupStars = [];

        // 플랫폼 풀 정리
        this.platformPool.forEach(platform => {
            this.world.removeChild(platform);
            platform.destroy();
        });
        this.platformPool = [];

        // PIXI 오브젝트 정리
        this.player.destroy();
        this.rope.destroy();

        logger.log('GameScene 리소스 정리 완료');
    }

    private updatePullToAnchor(dt: number = 0.016): void {
        const ropePos = ropeState.get();
        const playerPos = playerState.get();
        const game = gameState.get();

        const combo = game.combo || 0;
        const baseSpeed = GAME_CONFIG.grappleBasePullSpeed;
        const comboBonus = combo * GAME_CONFIG.grappleComboSpeedBonus;
        const speed = baseSpeed + comboBonus;

        const dx = ropePos.anchorX - playerPos.x;
        const dy = ropePos.anchorY - playerPos.y;
        const dist = Math.hypot(dx, dy);

        this.trailParticleCounter++;
        if (this.trailParticleCounter >= 5) {
            this.trailParticleCounter = 0;
            vfxSystem.spawnRopeTrailParticles(
                playerPos.x,
                playerPos.y,
                ropePos.anchorX,
                ropePos.anchorY,
                combo
            );
        }

        const reboundDist = GAME_CONFIG.grappleReboundDistance;

        if (dist < 30) {
            gameActions.stopPull();
            gameActions.setSwinging(false);
            ropeState.setKey('isActive', false);
            ropeState.setKey('isFlying', false);
            ropeState.setKey('isPulling', false);

            this.targetCameraZoom = this.baseCameraZoom;

            const safeVx = Math.max(-15, Math.min(15, playerPos.velocityX));
            const safeVy = Math.max(-10, Math.min(10, playerPos.velocityY));
            gameActions.updatePlayerVelocity(safeVx, safeVy);

            return;
        }

        const easingFactor = GAME_CONFIG.grappleEasingFactor;
        const pullForce = dist * easingFactor;
        const minSpeed = speed * 0.7;
        const acceleration = Math.max(minSpeed, Math.min(speed, pullForce));

        let finalAccel = acceleration;
        if (dist < reboundDist) {
            const reboundFactor = 1.0 - (dist / reboundDist) * 0.2;
            finalAccel *= reboundFactor;
        }

        const stepX = (dx / dist) * finalAccel * dt;
        const stepY = (dy / dist) * finalAccel * dt;
        const nextX = playerPos.x + stepX;
        const nextY = playerPos.y + stepY;

        gameActions.updatePlayerPosition(nextX, nextY);

        const velocityMagnitude = finalAccel;
        const dirVx = (dx / dist) * velocityMagnitude;
        const dirVy = (dy / dist) * velocityMagnitude;
        const pullMaxSpeedX = GAME_CONFIG.pullMaxSpeedX;
        const pullMaxSpeedY = GAME_CONFIG.pullMaxSpeedY;
        const clampedVx = Math.max(-pullMaxSpeedX, Math.min(pullMaxSpeedX, dirVx));
        const clampedVy = Math.max(-pullMaxSpeedY, Math.min(pullMaxSpeedY, dirVy));
        gameActions.updatePlayerVelocity(clampedVx, clampedVy);
    }

    private updateFreeFallPhysics(dt: number = 0.016): void {
        const playerPos = playerState.get();

        if (this.player && this.player.isOnPlatform && this.player.platformY !== undefined) {
            const currentPlatforms = platforms.get();
            const onPlatform = currentPlatforms.find((p) => {
                const pg = p as PlatformGraphics;
                const onX =
                    GAME_CONFIG.playerFixedX + 15 > p.x &&
                    GAME_CONFIG.playerFixedX - 15 < p.x + pg.width;
                const onY = Math.abs(this.player!.platformY! - (p.y - 15)) <= 2;
                return onX && onY;
            });
            
            if (onPlatform) {
                gameActions.updatePlayerPosition(GAME_CONFIG.playerFixedX, this.player.platformY);
                gameActions.updatePlayerVelocity(0, 0);
                return;
            } else {
                this.player.isOnPlatform = false;
                this.player.platformY = undefined;
            }
        }

        const gravity = GAME_CONFIG.gravity * dt;
        const dragX = 0.985;
        let newVelocityY = playerPos.velocityY + gravity;
        let newVelocityX = playerPos.velocityX * dragX;
        newVelocityX = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, newVelocityX));
        newVelocityY = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, newVelocityY));
        const newX = playerPos.x + newVelocityX;
        const newY = playerPos.y + newVelocityY;
        gameActions.updatePlayerPosition(newX, newY);
        gameActions.updatePlayerVelocity(newVelocityX, newVelocityY);
        animationSystem.stopSwingAnimation(this.player);
    }

    private updatePlayerGraphics(): void {
        if (!this.player) return;
        const playerPos = playerState.get();
        const rope = ropeState.get();
        const game = gameState.get();

        this.player.x = GAME_CONFIG.playerFixedX;
        this.player.y = playerPos.y;
        this.player.visible = true;

        if (game.isInvincible) {
            const time = performance.now() * 0.01;
            this.player.alpha = 0.7 + Math.sin(time) * 0.3;
        } else {
            this.player.alpha = 1;
        }

        if (rope.isFlying || rope.isPulling || rope.isActive) {
            const dx = rope.anchorX - playerPos.x;
            const dy = rope.anchorY - playerPos.y;
            const armAngle = Math.atan2(dy, dx);
            this.drawStickman(armAngle);
        } else {
            this.drawStickman(undefined, playerPos.velocityY);
        }

        const velocityX = playerPos.velocityX;
        const velocityY = playerPos.velocityY;
        const angle = Math.atan2(velocityY, velocityX);
        this.player.rotation = angle * 0.3;

        try {
            this.player.scale?.set?.(1, 1);
        } catch {}
    }

    private updateCameraZoom(): void {
        this.cameraZoom += (this.targetCameraZoom - this.cameraZoom) * 0.1;
        this.world.scale.set(this.cameraZoom);
        if (this.fxLayer) {
            this.fxLayer.scale.set(this.cameraZoom);
        }
    }

    private updateCamera(): void {
        const playerPos = playerState.get();
        const rope = ropeState.get();

        const targetPlayerX = GAME_CONFIG.playerFixedX;
        const deltaX = playerPos.x - targetPlayerX;

        if (Math.abs(deltaX) > 1) {
            const currentPlatforms = platforms.get();
            currentPlatforms.forEach((platform) => {
                platform.x -= deltaX;
            });

            if (rope.isActive || rope.isPulling) {
                ropeState.setKey('anchorX', rope.anchorX - deltaX);
            }
            if (rope.isFlying && rope.tipX !== undefined) {
                ropeState.setKey('tipX', rope.tipX - deltaX);
            }

            this.scrollOffsetX += deltaX;

            gameActions.updatePlayerPosition(targetPlayerX, playerPos.y);
        }

        const worldX = 0;

        const viewH = GAME_CONFIG.height;
        const deadZoneY = GAME_CONFIG.cameraDeadZoneY; // 월드 좌표 기준 데드존
        const currentWorldY = this.world.y || 0;
        
        // 카메라가 추적하는 목표 Y 위치 (월드 좌표)
        // 화면 중앙에 플레이어를 배치하기 위한 목표 world.y 값
        const idealCameraY = -(playerPos.y - viewH / 2);
        
        // 현재 카메라 위치와 이상적인 위치의 차이 (월드 좌표 기준)
        const cameraOffset = idealCameraY - currentWorldY;
        
        let targetWorldY = currentWorldY;
        
        // 데드존을 월드 좌표 기준으로 체크
        if (cameraOffset > deadZoneY) {
            // 플레이어가 화면 아래로 멀어짐 → 카메라 아래로
            targetWorldY = idealCameraY - deadZoneY;
        } else if (cameraOffset < -deadZoneY) {
            // 플레이어가 화면 위로 멀어짐 → 카메라 위로
            targetWorldY = idealCameraY + deadZoneY;
        }

        const cameraSpeedY = GAME_CONFIG.cameraSpeedY;
        const newWorldY = currentWorldY + (targetWorldY - currentWorldY) * cameraSpeedY;

        this.world.x = worldX;
        this.world.y = newWorldY;

        this.world.hitArea = new PIXI.Rectangle(-1000, -1000, 3000, 3000);

        if (this.fxLayer) {
            this.fxLayer.x = 0;
            this.fxLayer.y = newWorldY;
        }

        this.uiManager.setScrollOffset(this.scrollOffsetX);
        gameActions.updateCamera(this.scrollOffsetX);
    }

    private updateBackground(): void {
        const scrollX = this.scrollOffsetX * GAME_CONFIG.bgSpeed;

        for (let i = 0; i < this.bgTiles.length; i++) {
            const tile = this.bgTiles[i];
            const baseX = (i % 2) * GAME_CONFIG.bgTileWidth;
            tile.x = baseX - (scrollX % (GAME_CONFIG.bgTileWidth * 2));
        }

        this.frameCounter++;

        const updateTwinkle = this.frameCounter % 5 === 0;
        const time = updateTwinkle ? performance.now() * 0.001 : 0;

        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            const graphic = star.graphic;

            if (updateTwinkle) {
                const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
                graphic.alpha = star.baseAlpha * (0.7 + twinkle * 0.3);
            }

            const baseX = graphic.baseX ?? 0;
            graphic.x = baseX - scrollX;

            if (graphic.x < -50) {
                graphic.baseX = (graphic.baseX ?? 0) + GAME_CONFIG.bgTileWidth * 2;
            } else if (graphic.x > GAME_CONFIG.width + 50) {
                graphic.baseX = (graphic.baseX ?? 0) - GAME_CONFIG.bgTileWidth * 2;
            }
        }

        if (this.frameCounter % 2 === 0) {
            for (let i = 0; i < this.clouds.length; i++) {
                const cloudData = this.clouds[i];
                const cloud = cloudData.sprite;

                const baseX = cloud.baseX ?? 0;
                cloud.x = baseX - scrollX;

                if (cloud.x < -200) {
                    cloud.baseX = (cloud.baseX ?? 0) + GAME_CONFIG.bgTileWidth * 2;
                } else if (cloud.x > GAME_CONFIG.width + 200) {
                    cloud.baseX = (cloud.baseX ?? 0) - GAME_CONFIG.bgTileWidth * 2;
                }
            }
        }
    }

    private updateMovingPlatforms(): void {
        const currentPlatforms = platforms.get();

        currentPlatforms.forEach((platform) => {
            const pg = platform as PlatformGraphics;

            if (
                !pg.isMoving ||
                !pg.moveSpeed ||
                !pg.moveRange ||
                pg.moveDirection === undefined
            ) {
                return;
            }

            if (pg.moveType === 'horizontal' && pg.initialX !== undefined) {
                const currentDistance = pg.x - pg.initialX;

                if (currentDistance >= pg.moveRange) {
                    pg.moveDirection = -1;
                } else if (currentDistance <= 0) {
                    pg.moveDirection = 1;
                }

                pg.x += pg.moveSpeed * pg.moveDirection;
            }

            if (pg.moveType === 'vertical' && pg.initialY !== undefined) {
                const currentDistance = pg.y - pg.initialY;

                if (currentDistance >= pg.moveRange) {
                    pg.moveDirection = -1;
                } else if (currentDistance <= 0) {
                    pg.moveDirection = 1;
                }

                pg.y += pg.moveSpeed * pg.moveDirection;
            }
        });
    }

    private spawnPowerupStar(x: number, y: number): void {
        const star = new PIXI.Graphics();

        star.beginFill(0xffffff);
        const points: number[] = [];
        const outerRadius = GAME_CONFIG.playerOuterRadius;
        const innerRadius = GAME_CONFIG.playerInnerRadius;

        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        star.drawPolygon(points);
        star.endFill();

        star.lineStyle(3, 0xffffff, 0.5);
        star.drawPolygon(points);

        star.x = x;
        star.y = y;
        star.baseX = x;

        this.world.addChild(star);
        this.powerupStars.push({ graphic: star, collected: false });

        star.twinklePhase = Math.random() * Math.PI * 2;
    }

    private updatePowerupStars(): void {
        const playerPos = playerState.get();
        const time = performance.now() * 0.001;

        for (let i = this.powerupStars.length - 1; i >= 0; i--) {
            const starData = this.powerupStars[i];
            const star = starData.graphic;

            if (starData.collected) continue;

            const baseX = (star as any).baseX || star.x;
            star.x = baseX - this.scrollOffsetX;

            const twinkle = Math.sin(time * 3 + (star as any).twinklePhase);
            star.alpha = 0.7 + twinkle * 0.3;
            star.scale.set(1 + twinkle * 0.1);

            const dx = playerPos.x - star.x;
            const dy = playerPos.y - star.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 30) {
                starData.collected = true;
                star.visible = false;
                this.activateInvincibleMode();
                this.audioManager.playRopeShoot();
            }

            if (star.x < -100) {
                this.world.removeChild(star);
                this.powerupStars.splice(i, 1);
            }
        }
    }

    private managePlatforms(): void {
        const currentPlatforms = platforms.get();

        // 최적화: filter 대신 단일 루프에서 카운트
        if (this.scrollOffsetX >= GAME_CONFIG.starMinDistance &&
            Math.random() < GAME_CONFIG.starSpawnChance) {
            let uncollectedCount = 0;
            for (let i = 0; i < this.powerupStars.length; i++) {
                if (!this.powerupStars[i].collected && ++uncollectedCount >= 3) break;
            }
            if (uncollectedCount < 3) {
                const starX = GAME_CONFIG.width + 400 + Math.random() * 200;
                const starY = 100 + Math.random() * (GAME_CONFIG.height - 300);
                this.spawnPowerupStar(starX, starY);
            }
        }

        // 최적화: filter 대신 역방향 반복으로 제거
        for (let i = currentPlatforms.length - 1; i >= 0; i--) {
            const platform = currentPlatforms[i];
            if (platform.x + (platform as PlatformGraphics).width < -200) {
                const pg = platform as PlatformGraphics;
                pg.visible = false;
                pg.inUse = false;
                pg.isMoving = false;
                pg.moveType = undefined;
                pg.moveSpeed = undefined;
                pg.moveRange = undefined;
                pg.moveDirection = undefined;
                pg.initialX = undefined;
                pg.initialY = undefined;
                currentPlatforms.splice(i, 1);
            }
        }

        const filteredPlatforms = currentPlatforms;
        platforms.set(filteredPlatforms);

        let rightmostPlatformEnd = 0;
        filteredPlatforms.forEach((platform) => {
            const platformCast = platform as PlatformGraphics;
            const platformEnd = platform.x + platformCast.width;
            if (platformEnd > rightmostPlatformEnd) {
                rightmostPlatformEnd = platformEnd;
            }
        });

        const spawnThreshold = GAME_CONFIG.width + 600;
        if (rightmostPlatformEnd < spawnThreshold) {
            const gap = 180 + Math.random() * 70;
            const x = rightmostPlatformEnd + gap;

            const distance = this.scrollOffsetX;
            const shouldSpawnHorizontal = distance >= 5000 && Math.random() < 0.15;
            const shouldSpawnVertical = distance >= 10000 && Math.random() < 0.15;

            const yTop = 80 + Math.random() * 200;

            if (shouldSpawnVertical) {
                this.createRandomVerticalMovingPlatform(x, yTop);
            } else if (shouldSpawnHorizontal) {
                this.createRandomMovingPlatform(x, yTop);
            } else {
                this.createPlatform(x, yTop);
            }

            const yBottom = 350 + Math.random() * 170;
            this.createPlatform(x + 20, yBottom);
        }
    }

    private drawRope(): void {
        ropeSystem.drawRope(this.rope, COLORS.rope);
        const topIndex = this.world.children.length - 1;
        if (this.player) {
            this.world.setChildIndex(this.player, topIndex);
        }
        const ropeTargetIndex = Math.max(0, this.world.children.length - 2);
        this.world.setChildIndex(this.rope, ropeTargetIndex);
    }

    private updateSlowMotion(): void {
        const game = gameState.get();
        const combo = game.combo || 0;

        if (game.isSlowMotion && Date.now() > this.slowMotionEndTime) {
            gameActions.deactivateSlowMotion();
            vfxSystem.hideSlowMotionOverlay();
            logger.log('[슬로우 모션] 종료');
        }

        if (
            combo >= GAME_CONFIG.slowMotionComboThreshold &&
            Math.floor(combo / GAME_CONFIG.slowMotionComboThreshold) >
                Math.floor(game.lastComboMilestone / GAME_CONFIG.slowMotionComboThreshold)
        ) {
            this.activateSlowMotionEffect();
            gameActions.updateComboMilestone(combo);
            logger.log(`[슬로우 모션] ${combo} 콤보 달성!`);
        }

        if (!game.isSlowMotion && combo >= GAME_CONFIG.slowMotionComboThreshold) {
            const playerPos = playerState.get();
            const screenX = playerPos.x + this.world.x;
            const screenY = playerPos.y + this.world.y;

            const dangerLeft = screenX < GAME_CONFIG.slowMotionDangerDistance;
            const dangerRight = screenX > GAME_CONFIG.width - GAME_CONFIG.slowMotionDangerDistance;
            const dangerTop = screenY < GAME_CONFIG.slowMotionDangerDistance;
            const dangerBottom =
                screenY > GAME_CONFIG.height - GAME_CONFIG.slowMotionDangerDistance;

            if (dangerLeft || dangerRight || dangerTop || dangerBottom) {
                this.activateSlowMotionEffect();
                logger.log('[슬로우 모션] 위험 감지! 활성화');
            }
        }
    }

    private activateSlowMotionEffect(): void {
        gameActions.activateSlowMotion();
        this.slowMotionEndTime = Date.now() + GAME_CONFIG.slowMotionDuration;

        const playerPos = playerState.get();
        vfxSystem.spawnComboShockwave(playerPos.x, playerPos.y, 10);
        vfxSystem.showSlowMotionOverlay();
    }

    private activateInvincibleMode(): void {
        gameActions.activateInvincible();
        this.invincibleEndTime = Date.now() + GAME_CONFIG.invincibleDuration;

        gameActions.setSwinging(false);
        ropeState.setKey('isActive', false);
        ropeState.setKey('isFlying', false);
        ropeState.setKey('isPulling', false);

        const playerPos = playerState.get();
        vfxSystem.spawnComboParticleBurst(playerPos.x, playerPos.y, 15);
        vfxSystem.spawnComboShockwave(playerPos.x, playerPos.y, 15);

        logger.log('[무적 모드] 활성화!');
    }

    private updateInvincibleMode(): void {
        const game = gameState.get();

        if (game.isInvincible && Date.now() > this.invincibleEndTime) {
            gameActions.deactivateInvincible();
            logger.log('[무적 모드] 종료');
        }

        if (game.isInvincible) {
            const playerPos = playerState.get();

            const targetY = GAME_CONFIG.height * GAME_CONFIG.invincibleTargetY;
            const dy = targetY - playerPos.y;
            const smoothY = playerPos.y + dy * 0.1;

            const newX = playerPos.x + GAME_CONFIG.invincibleSpeed;

            gameActions.updatePlayerPosition(newX, smoothY);
            gameActions.updatePlayerVelocity(GAME_CONFIG.invincibleSpeed, 0);

            this.destroyPlatformsInPath(playerPos.x, playerPos.y);

            if (this.frameCounter % 2 === 0) {
                vfxSystem.spawnComboRisingParticles(playerPos.x, playerPos.y, 10);
            }
        }
    }

    private destroyPlatformsInPath(playerX: number, playerY: number): void {
        const currentPlatforms = platforms.get();
        const destroyRadius = GAME_CONFIG.starDestroyRadius;

        currentPlatforms.forEach((platform) => {
            const pg = platform as PlatformGraphics;
            if (!pg.visible) return;

            const platformCenterX = pg.x + pg.width / 2;
            const platformCenterY = pg.y + pg.height / 2;

            const dx = playerX - platformCenterX;
            const dy = playerY - platformCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < destroyRadius) {
                vfxSystem.spawnPlatformExplosion(platformCenterX, platformCenterY);
                vfxSystem.triggerScreenShake(this.stage);

                pg.visible = false;
                pg.inUse = false;
                pg.isMoving = false;
                pg.moveType = undefined;
            }
        });

        const activePlatforms = currentPlatforms.filter((p) => p.visible);
        platforms.set(activePlatforms);
    }

    /**
     * 토스 리더보드에 점수 제출
     */
    private async submitScoreToLeaderboard(score: number): Promise<void> {
        // 토스 앱이 아니면 리더보드 제출 건너뛰기
        if (!isLeaderboardAvailable()) {
            logger.log('⚠️ 토스 앱이 아니므로 리더보드 제출을 건너뜁니다.');
            return;
        }

        try {
            // 리더보드 지원 여부 확인
            const isSupported = isMinVersionSupported({
                android: "5.221.0",
                ios: "5.221.0",
            });

            if (!isSupported) {
                logger.log('리더보드를 지원하지 않는 토스 앱 버전입니다.');
                return;
            }

            // 점수를 문자열로 변환하여 제출
            const result = await submitGameCenterLeaderBoardScore({ score: score.toString() });

            if (result?.statusCode === 'SUCCESS') {
                logger.log('✅ 리더보드 점수 제출 성공:', score);
            } else if (result === undefined) {
                logger.log('⚠️ 리더보드 지원하지 않음 (낮은 앱 버전)');
            } else {
                console.warn('⚠️ 리더보드 점수 제출 실패:', result);
            }
        } catch (error) {
            // 브라우저 환경이거나 미니앱 승인 전일 수 있음
            logger.log('리더보드 점수 제출 건너뜀 (브라우저 또는 승인 전):', error);
        }
    }

    private checkGameOver(): void {
        const playerPos = playerState.get();
        
        if (this.landingGraceFrames > 0) {
            this.landingGraceFrames -= 1;
            return;
        }

        // 절대 Y 좌표 체크 (너무 위/아래로 벗어나는 경우)
        const playerYTooLow = playerPos.y > GAME_CONFIG.gameOverAbsoluteBottom;
        const playerYTooHigh = playerPos.y < GAME_CONFIG.gameOverAbsoluteTop;

        // 화면 기준 상대 좌표 체크
        const screenX = playerPos.x + this.world.x;
        const screenY = playerPos.y + this.world.y;

        const outBottom = screenY > GAME_CONFIG.height + GAME_CONFIG.gameOverBoundaryBottom;
        const outTop = screenY < GAME_CONFIG.gameOverBoundaryTop; // -300 (위로 300px까지 여유)
        const outLeft = screenX < GAME_CONFIG.gameOverBoundaryLeft;

        if (playerYTooLow || playerYTooHigh || outBottom || outTop || outLeft) {
            logger.log('GAME OVER!', {
                playerY: playerPos.y.toFixed(1),
                screenY: screenY.toFixed(1),
                playerYTooLow,
                playerYTooHigh,
                outBottom,
                outTop,
                outLeft,
            });

            // 최종 점수 계산 (미터 단위)
            const finalScore = Math.floor(Math.max(0, this.scrollOffsetX) / 100);

            // 토스 리더보드에 점수 제출
            this.submitScoreToLeaderboard(finalScore);

            gameActions.endGame(finalScore); // 실제 점수 전달
            gameActions.resetCombo();
            this.uiManager.onGameOver();

            // 배경음 페이드 아웃 후 게임오버 사운드 재생
            this.audioManager.fadeOutBackground(500);
            setTimeout(() => {
                this.audioManager.playGameOver();
            }, 300);

            // 신기록 달성 시 축하 효과
            const game = gameState.get();
            if (game.isNewRecord) {
                const centerX = GAME_CONFIG.width / 2;
                const centerY = GAME_CONFIG.height / 2;

                // 대폭발 파티클 효과
                vfxSystem.spawnComboParticleBurst(centerX, centerY, 20);
                vfxSystem.spawnComboShockwave(centerX, centerY, 20);

                logger.log('🎉 신기록 달성!');
            }
        }
    }

    private update(): void {
        const currentState = gameState.get();
        if (!currentState.isPlaying) return;
        if (currentState.isPaused) return; // 일시정지 중이면 업데이트 건너뛰기

        this.updateSlowMotion();
        this.updateInvincibleMode();

        const timeScale =
            !currentState.isInvincible && currentState.isSlowMotion
                ? GAME_CONFIG.slowMotionScale
                : 1.0;
        const dt = 0.016 * timeScale;

        try {
            if (!currentState.isInvincible) {
                const rope = ropeState.get();
                if (rope.isFlying) {
                    ropeSystem.updateFlight(GAME_CONFIG.platformHeight, 700, dt);
                    this.updateFreeFallPhysics(dt);
                } else if (rope.isPulling) {
                    this.updatePullToAnchor(dt);
                    this.targetCameraZoom = this.baseCameraZoom * GAME_CONFIG.grappleCameraZoom;
                } else {
                    this.updateFreeFallPhysics(dt);
                    this.targetCameraZoom = this.baseCameraZoom;
                }
            }

            this.updateCameraZoom();
            this.updatePlayerGraphics();
            this.updateCamera();
            this.updateBackground();
            this.updateMovingPlatforms();
            this.updatePowerupStars();
            this.managePlatforms();

            if (!currentState.isInvincible) {
                this.drawRope();
            }

            this.uiManager.updateScore();
            this.uiManager.updateCombo();
            this.updateComboVFX();
            vfxSystem.update();
        } catch (e) {
            console.error('게임 업데이트 중 오류 발생:', e);
            gameActions.pauseGame();
        }

        if (!currentState.isInvincible) {
            this.checkGameOver();
        }
    }

    private updateComboVFX(): void {
        const game = gameState.get();
        const combo = game.combo || 0;

        if (combo >= 2) {
            this.comboVfxCounter++;
            if (this.comboVfxCounter >= 6) {
                this.comboVfxCounter = 0;
                const playerPos = playerState.get();
                vfxSystem.spawnComboRisingParticles(playerPos.x, playerPos.y, combo);
            }
        } else {
            this.comboVfxCounter = 0;
        }
    }

    // Public API
    public getApp(): PIXI.Application {
        return this.app;
    }

    public getUIManager(): UIManager {
        return this.uiManager;
    }

    public getAudioManager(): AudioManager {
        return this.audioManager;
    }
    
    // 일시정지
    private pauseGame(): void {
        gameActions.pauseGame();
        this.uiManager.showPausePanel();
        
        // 배경음 볼륨 낮춤
        this.audioManager.setBackgroundVolume(0.05);
        
        logger.log('게임 일시정지');
    }
    
    // 재개
    private resumeGame(): void {
        gameActions.resumeGame();
        this.uiManager.hidePausePanel();
        this.tutorialRequestedFromPause = false;
        
        // 배경음 볼륨 복구
        this.audioManager.setBackgroundVolume(0.15);
        
        logger.log('게임 재개');
    }
    
    // 사운드 토글
    private toggleSound(enabled: boolean): void {
        this.audioManager.setMuted(!enabled);
        logger.log('사운드 토글:', enabled ? '켜짐' : '꺼짐');
    }

    private handleResetRecords(): void {
        const confirmed = window.confirm('정말로 최고 기록과 최고 콤보를 초기화할까요?');
        if (!confirmed) {
            return;
        }
        gameActions.resetRecords();
        logger.log('최고 기록 초기화 완료');
    }

    private requestTutorialReplay(): void {
        this.tutorialRequestedFromPause = true;
        this.uiManager.hidePausePanel();
        window.dispatchEvent(new CustomEvent('tutorial-show', { detail: { mode: 'replay' } }));
    }

    private handleTutorialDismissed = (event: Event): void => {
        const detail = (event as CustomEvent<{ mode?: 'intro' | 'replay' }>).detail;
        if (detail?.mode === 'replay' && this.tutorialRequestedFromPause) {
            this.tutorialRequestedFromPause = false;
            this.resumeGame();
        }
    };
}

