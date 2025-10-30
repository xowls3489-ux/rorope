import * as PIXI from 'pixi.js';
import { gameState, playerState, ropeState, gameActions, platforms } from './stores/gameStore';
import { soundSystem } from './systems/soundSystem';
import { animationSystem } from './systems/animationSystem';

// 타입 확장
interface PlayerGraphics extends PIXI.Graphics {
    isOnPlatform?: boolean;
    platformY?: number;
}

interface PlatformGraphics extends PIXI.Graphics {
    width: number;
    height: number;
    landed?: boolean;
}

// 게임 설정
const GAME_CONFIG = {
    width: 800,
    height: 600,
    gravity: 0.3,
    ropeLength: 180,
    damping: 0.995,
    platformWidth: { min: 100, max: 150 },
    platformHeight: 15,
    platformSpacing: { min: 200, max: 300 },
    platformHeightVariation: 80
};

// 미니멀 흑백 색상 팔레트
const COLORS = {
    background: 0x000000,
    primary: 0xFFFFFF,
    rope: 0xFFFFFF,
    ui: 0xFFFFFF,
    accent: 0x888888
};

// 게임 클래스
class RopeSwingGame {
    private app!: PIXI.Application;
    private stage!: PIXI.Container;
    private world!: PIXI.Container;
    private bgLayer!: PIXI.Container;
    private player!: PlayerGraphics;
    private rope!: PIXI.Graphics;
    private scoreText!: PIXI.Text;
    private gameOverText!: PIXI.Text;
    private isSwingSoundPlaying: boolean = false;
    
    // 카메라 설정
    private cameraCenterX: number = GAME_CONFIG.width * 0.35;
    private worldX: number = 0;
    private targetWorldX: number = 0;
    
    // 배경 타일
    private bgTiles: PIXI.Graphics[] = [];
    private bgTileWidth: number = 800;
    private bgSpeed: number = 0.4;

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        this.app = new PIXI.Application({
            width: GAME_CONFIG.width,
            height: GAME_CONFIG.height,
            backgroundColor: COLORS.background,
            resizeTo: window,
            antialias: true
        });

        const gameRoot = document.getElementById('game-root');
        if (gameRoot) {
            gameRoot.appendChild(this.app.view as unknown as Node);
        } else {
            document.body.appendChild(this.app.view as unknown as Node);
        }
        
        this.stage = this.app.stage;

        this.world = new PIXI.Container();
        this.world.name = 'world';
        this.stage.addChild(this.world);

        this.bgLayer = new PIXI.Container();
        this.bgLayer.name = 'bgLayer';
        this.stage.addChildAt(this.bgLayer, 0);
        
        this.initBackground();
        this.initGameObjects();
        this.initInput();
        
        this.app.ticker.add(this.update.bind(this));
        this.app.ticker.maxFPS = 60;
    }

    private initBackground(): void {
        for (let i = 0; i < 2; i++) {
            const tile = new PIXI.Graphics();
            tile.beginFill(COLORS.background);
            tile.drawRect(0, 0, this.bgTileWidth, GAME_CONFIG.height);
            tile.endFill();
            tile.x = i * this.bgTileWidth;
            this.bgTiles.push(tile);
            this.bgLayer.addChild(tile);
        }
    }

    private initGameObjects(): void {
        this.player = new PIXI.Graphics() as PlayerGraphics;
        this.player.beginFill(0xFFFFFF);
        this.player.drawCircle(0, 0, 15);
        this.player.endFill();
        this.world.addChild(this.player);
        
        this.player.x = 100;
        this.player.y = GAME_CONFIG.height - 180;

        this.rope = new PIXI.Graphics();
        this.rope.visible = true;
        this.world.addChild(this.rope);

        this.scoreText = new PIXI.Text('Score: 0', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 20,
            fill: COLORS.ui,
            align: 'center'
        });
        this.scoreText.x = GAME_CONFIG.width / 2;
        this.scoreText.y = 30;
        this.scoreText.anchor.set(0.5, 0.5);
        this.stage.addChild(this.scoreText);

        this.gameOverText = new PIXI.Text('GAME OVER\nTAP TO RETRY', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 28,
            fill: COLORS.ui,
            align: 'center'
        });
        this.gameOverText.x = GAME_CONFIG.width / 2;
        this.gameOverText.y = GAME_CONFIG.height / 2;
        this.gameOverText.anchor.set(0.5, 0.5);
        this.gameOverText.visible = false;
        this.stage.addChild(this.gameOverText);
    }

    private initInput(): void {
        this.world.interactive = true;
        this.world.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const currentState = gameState.get();
            
            if (!currentState.isPlaying) {
                if (currentState.gameOver) {
                    this.restartGame();
                }
                return;
            }

            if (currentState.isSwinging) {
                this.releaseRope();
            } else {
                this.shootRopeTowardPoint(event.clientX, event.clientY);
            }
        });
    }

    private shootRopeTowardPoint(clientX: number, clientY: number): void {
        const playerPos = playerState.get();
        const rect = (this.app.view as HTMLCanvasElement).getBoundingClientRect();
        const worldClickX = clientX - rect.left - this.world.x;
        const worldClickY = clientY - rect.top - this.world.y;

        const dx = worldClickX - playerPos.x;
        const dy = worldClickY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 50) {
            return;
        }

        const currentPlatforms = platforms.get();
        let closestIntersection: { platform: PlatformGraphics; x: number; y: number; dist: number } | null = null;

        currentPlatforms.forEach(platform => {
            const platformCast = platform as PlatformGraphics;
            const platformLeft = platform.x;
            const platformRight = platform.x + platformCast.width;
            const platformTop = platform.y;
            const platformBottom = platform.y + GAME_CONFIG.platformHeight;

            const intersection = this.rayIntersectPlatform(
                playerPos.x, playerPos.y,
                worldClickX, worldClickY,
                platformLeft, platformTop,
                platformRight, platformBottom
            );

            if (intersection) {
                const dist = Math.sqrt(
                    Math.pow(intersection.x - playerPos.x, 2) +
                    Math.pow(intersection.y - playerPos.y, 2)
                );

                if (!closestIntersection || dist < closestIntersection.dist) {
                    closestIntersection = {
                        platform: platformCast,
                        x: intersection.x,
                        y: intersection.y,
                        dist
                    };
                }
            }
        });

        if (closestIntersection && closestIntersection.dist < 500) {
            const currentPlayerPos = playerState.get();
            
            gameActions.setRopeAnchor(closestIntersection.x, closestIntersection.y);
            
            const dx = currentPlayerPos.x - closestIntersection.x;
            const dy = currentPlayerPos.y - closestIntersection.y;
            const swingAngle = Math.atan2(dx, dy);
            
            const initialAngularVelocity = Math.abs(dx) / GAME_CONFIG.ropeLength * 2;
            
            gameActions.updateSwingPhysics(swingAngle, initialAngularVelocity);
            gameActions.setSwinging(true);
            
            if (this.player) {
                this.player.isOnPlatform = false;
            }
            
            soundSystem.play('ropeShoot');
        }
    }

    private rayIntersectPlatform(
        x1: number, y1: number,
        x2: number, y2: number,
        left: number, top: number,
        right: number, bottom: number
    ): { x: number; y: number } | null {
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;

        const dx = cx - x1;
        const dy = cy - y1;
        const t = Math.min(1, 400 / Math.sqrt(dx * dx + dy * dy));
        const endX = x1 + dx * t;
        const endY = y1 + dy * t;

        const minX = Math.min(x1, endX);
        const maxX = Math.max(x1, endX);
        const minY = Math.min(y1, endY);
        const maxY = Math.max(y1, endY);

        if (maxX >= left && minX <= right && maxY >= top && minY <= bottom) {
            return { x: cx, y: top };
        }

        return null;
    }

    private releaseRope(): void {
        const currentState = gameState.get();
        if (currentState.isSwinging) {
            gameActions.setSwinging(false);
            
            const playerPos = playerState.get();
            const swingSpeed = Math.sqrt(playerPos.angularVelocity * playerPos.angularVelocity * GAME_CONFIG.ropeLength);
            const velocityX = Math.sin(playerPos.swingAngle) * swingSpeed;
            const velocityY = Math.cos(playerPos.swingAngle) * swingSpeed;
            
            gameActions.updatePlayerVelocity(velocityX, velocityY);
            
            animationSystem.ropeReleaseAnimation(this.player, this.rope);
            soundSystem.play('ropeRelease');
        }
    }

    private createPlatform(x: number, y: number): PlatformGraphics {
        const platform = new PIXI.Graphics() as PlatformGraphics;
        const width = GAME_CONFIG.platformWidth.min + 
            Math.random() * (GAME_CONFIG.platformWidth.max - GAME_CONFIG.platformWidth.min);
        
        platform.beginFill(COLORS.primary);
        platform.drawRoundedRect(0, 0, width, GAME_CONFIG.platformHeight, 0);
        platform.endFill();
        
        platform.x = x;
        platform.y = y;
        platform.width = width;
        platform.height = GAME_CONFIG.platformHeight;
        
        this.world.addChild(platform);
        gameActions.addPlatform(platform);
        
        animationSystem.platformSpawnAnimation(platform);
        
        return platform;
    }

    private generateInitialPlatforms(): void {
        gameActions.clearPlatforms();
        gameActions.updateCamera(0);
        
        const startingPlatform = this.createPlatform(50, GAME_CONFIG.height - 165);
        gameActions.updateCamera(50 + startingPlatform.width);
        let lastX = 50 + startingPlatform.width;
        
        for (let i = 0; i < 4; i++) {
            const gap = 250 + Math.random() * 100;
            lastX = lastX + gap;
            
            const y = 50 + Math.random() * 350;
            
            const platform = this.createPlatform(lastX, y);
            
            lastX = lastX + platform.width;
            gameActions.updateCamera(lastX);
        }
    }

    private startGame(): void {
        gameActions.startGame();
        
        if (!this.player) {
            this.initGameObjects();
        }
        
        this.player.x = 100;
        this.player.y = GAME_CONFIG.height - 180;
        
        gameActions.updatePlayerPosition(100, GAME_CONFIG.height - 180);
        gameActions.updatePlayerVelocity(0, 0);
        gameActions.updateSwingPhysics(0, 0);
        
        this.worldX = 0;
        this.targetWorldX = 0;
        this.world.x = 0;
        
        this.generateInitialPlatforms();
        
        this.updateScore();
        this.gameOverText.visible = false;
        
        animationSystem.fadeInUI(this.scoreText);
    }

    public startGameFromUI(): void {
        this.startGame();
    }

    public restartGameFromUI(): void {
        this.restartGame();
    }

    private restartGame(): void {
        const currentPlatforms = platforms.get();
        currentPlatforms.forEach(platform => {
            this.world.removeChild(platform);
        });
        gameActions.clearPlatforms();
        
        this.isSwingSoundPlaying = false;
        
        this.startGame();
    }

    private updateScore(): void {
        const currentState = gameState.get();
        this.scoreText.text = `Score: ${currentState.score}`;
        animationSystem.scoreAnimation(this.scoreText);
    }

    private update(): void {
        const currentState = gameState.get();
        if (!currentState.isPlaying) return;

        try {
            if (currentState.isSwinging) {
                this.updateSwingPhysics();
            } else {
                this.updateFreeFallPhysics();
            }

            this.updatePlayerGraphics();
            this.updateCamera();
            this.updateBackground();
            this.managePlatforms();
            this.drawRope();
        } catch (error) {
            console.error('게임 업데이트 중 오류 발생:', error);
            gameActions.pauseGame();
        }

        this.checkGameOver();
    }

    private updatePlayerGraphics(): void {
        if (!this.player) return;
        
        const playerPos = playerState.get();
        this.player.x = playerPos.x;
        this.player.y = playerPos.y;
    }

    private updateCamera(): void {
        const playerPos = playerState.get();
        
        this.targetWorldX = -(playerPos.x - this.cameraCenterX);
        this.targetWorldX = Math.max(this.targetWorldX, 0);
        
        this.worldX += (this.targetWorldX - this.worldX) * 0.12;
        
        this.world.x = this.worldX;
        
        gameActions.updateCamera(-this.worldX);
    }

    private updateBackground(): void {
        const scrollX = this.worldX * this.bgSpeed;
        
        for (let i = 0; i < this.bgTiles.length; i++) {
            const tile = this.bgTiles[i];
            const baseX = (i % 2) * this.bgTileWidth;
            tile.x = baseX - (scrollX % (this.bgTileWidth * 2));
        }
    }

    private updateSwingPhysics(): void {
        const playerPos = playerState.get();
        const ropePos = ropeState.get();
        
        const dt = 0.016;
        const gravityForce = -GAME_CONFIG.gravity / GAME_CONFIG.ropeLength * Math.sin(playerPos.swingAngle);
        const dampingForce = -playerPos.angularVelocity * 0.995;
        
        const angularAcceleration = gravityForce + dampingForce;
        const newAngularVelocity = playerPos.angularVelocity + angularAcceleration * dt;
        const newSwingAngle = playerPos.swingAngle + newAngularVelocity * dt;

        const newX = ropePos.anchorX + Math.sin(newSwingAngle) * GAME_CONFIG.ropeLength;
        const newY = ropePos.anchorY + Math.cos(newSwingAngle) * GAME_CONFIG.ropeLength;

        gameActions.updatePlayerPosition(newX, newY);
        gameActions.updateSwingPhysics(newSwingAngle, newAngularVelocity);

        if (Math.abs(newAngularVelocity) > 0.5 && !this.isSwingSoundPlaying) {
            soundSystem.play('swing');
            this.isSwingSoundPlaying = true;
        } else if (Math.abs(newAngularVelocity) <= 0.3) {
            this.isSwingSoundPlaying = false;
        }

        animationSystem.swingAnimation(this.player);
        this.checkPlatformLanding();
    }

    private updateFreeFallPhysics(): void {
        const playerPos = playerState.get();
        
        if (this.player && this.player.isOnPlatform && this.player.platformY !== undefined) {
            gameActions.updatePlayerPosition(playerPos.x, this.player.platformY);
            gameActions.updatePlayerVelocity(0, 0);
            return;
        }
        
        const gravity = GAME_CONFIG.gravity * 0.016;
        const airResistance = 0.99;
        
        const newVelocityY = (playerPos.velocityY + gravity) * airResistance;
        const newVelocityX = playerPos.velocityX * airResistance;
        
        const newX = playerPos.x + newVelocityX;
        const newY = playerPos.y + newVelocityY;

        gameActions.updatePlayerPosition(newX, newY);
        gameActions.updatePlayerVelocity(newVelocityX, newVelocityY);

        animationSystem.stopSwingAnimation(this.player);
        this.checkPlatformLanding();
    }

    private checkPlatformLanding(): void {
        const currentPlatforms = platforms.get();
        const playerPos = playerState.get();
        
        currentPlatforms.forEach(platform => {
            const platformCast = platform as PlatformGraphics;
            
            const isHorizontallyAligned = playerPos.x + 15 > platform.x && 
                                          playerPos.x - 15 < platform.x + platformCast.width;
            
            const platformTop = platform.y;
            const playerBottom = playerPos.y + 15;
            const isOnTop = playerBottom >= platformTop - 5 && 
                           playerBottom <= platformTop + 20;
            
            const isFallingDown = playerPos.velocityY > 0;
            
            if (isHorizontallyAligned && isOnTop && isFallingDown && !platformCast.landed) {
                gameActions.updatePlayerPosition(playerPos.x, platform.y - 15);
                gameActions.updatePlayerVelocity(0, 0);
                gameActions.setSwinging(false);
                
                if (!this.player) return;
                this.player.isOnPlatform = true;
                this.player.platformY = platform.y - 15;
                
                platformCast.landed = true;
                
                gameActions.addScore();
                this.updateScore();
                
                animationSystem.landingAnimation(this.player);
                soundSystem.play('landing');
            }
        });
    }

    private managePlatforms(): void {
        const currentPlatforms = platforms.get();
        
        const cameraLeft = gameState.get().cameraX;
        const filteredPlatforms = currentPlatforms.filter(platform => {
            if (platform.x + platform.width < cameraLeft - 200) {
                this.world.removeChild(platform);
                return false;
            }
            return true;
        });
        platforms.set(filteredPlatforms);

        const cameraRight = cameraLeft + GAME_CONFIG.width;
        const spawnThreshold = 600;
        
        let rightmostPlatformEnd = gameState.get().lastPlatformX;
        filteredPlatforms.forEach(platform => {
            const platformCast = platform as PlatformGraphics;
            const platformEnd = platform.x + platformCast.width;
            if (platformEnd > rightmostPlatformEnd) {
                rightmostPlatformEnd = platformEnd;
            }
        });
        
        if (rightmostPlatformEnd < cameraRight + spawnThreshold) {
            const gap = 250 + Math.random() * 150;
            const x = rightmostPlatformEnd + gap;
            
            const y = 50 + Math.random() * 350;
            
            const platform = this.createPlatform(x, y);
            
            const newRightmost = x + platform.width;
            gameActions.updateCamera(newRightmost);
        }
    }

    private drawRope(): void {
        this.rope.clear();
        
        const ropePos = ropeState.get();
        const playerPos = playerState.get();
        
        if (ropePos.isActive) {
            this.rope.lineStyle(6, COLORS.rope, 1);
            this.rope.moveTo(playerPos.x, playerPos.y);
            this.rope.lineTo(ropePos.anchorX, ropePos.anchorY);
        }
        
        this.world.setChildIndex(this.rope, this.world.children.length - 1);
    }

    private checkGameOver(): void {
        const playerPos = playerState.get();
        if (playerPos.y > GAME_CONFIG.height + 50) {
            gameActions.endGame();
            this.gameOverText.visible = true;
            animationSystem.gameOverAnimation(this.gameOverText);
            soundSystem.play('gameOver');
        }
    }
}

let gameInstance: RopeSwingGame | null = null;

export async function initGame(): Promise<RopeSwingGame> {
    if (!gameInstance) {
        gameInstance = new RopeSwingGame();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        (window as any).gameInstance = gameInstance;
    }
    return gameInstance;
}

