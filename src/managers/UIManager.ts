import * as PIXI from 'pixi.js';
import { gameState } from '../stores/gameStore';
import { GAME_CONFIG, COLORS } from '../core/config';
import { animationSystem } from '../systems/animationSystem';

/**
 * UIManager
 * 게임 UI 요소 관리 (점수, 콤보, 게임오버 텍스트 등)
 */
export class UIManager {
    private stage: PIXI.Container;
    private scoreText!: PIXI.Text;
    private comboText!: PIXI.Text;
    private gameOverText!: PIXI.Text;
    private scrollOffsetX: number = 0;

    constructor(stage: PIXI.Container) {
        this.stage = stage;
        this.init();
        this.setupResizeHandler();
    }

    private init(): void {
        // 점수 텍스트
        this.scoreText = new PIXI.Text('0 m', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 20,
            fill: COLORS.ui,
            align: 'left'
        });
        this.scoreText.x = 20;
        this.scoreText.y = 20;
        this.scoreText.anchor.set(0, 0);
        this.stage.addChild(this.scoreText);

        // 콤보 텍스트
        this.comboText = new PIXI.Text('', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 28,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold'
        });
        this.comboText.x = GAME_CONFIG.width / 2;
        this.comboText.y = 70;
        this.comboText.anchor.set(0.5, 0.5);
        this.comboText.visible = false;
        this.stage.addChild(this.comboText);

        // 게임오버 텍스트
        this.gameOverText = new PIXI.Text('GAME OVER\nTAP TO RETRY', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 24,
            fill: COLORS.ui,
            align: 'center',
            lineHeight: 32
        });
        this.gameOverText.anchor.set(0.5, 0.5);
        this.updateGameOverPosition();
        this.gameOverText.visible = false;
        this.stage.addChild(this.gameOverText);
    }

    private setupResizeHandler(): void {
        const handleResize = () => {
            // 점수 텍스트 위치
            if (this.scoreText) {
                this.scoreText.x = 20;
                this.scoreText.y = 20;
            }

            // 콤보 텍스트 위치
            if (this.comboText) {
                this.comboText.x = GAME_CONFIG.width / 2;
                this.comboText.y = 70;
            }

            // 게임오버 텍스트 위치
            this.updateGameOverPosition();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    private updateGameOverPosition(): void {
        if (this.gameOverText) {
            this.gameOverText.x = GAME_CONFIG.width / 2;
            const isMobileSize = GAME_CONFIG.height < 800;
            const yPosition = isMobileSize
                ? GAME_CONFIG.height - 200
                : GAME_CONFIG.height / 2;
            this.gameOverText.y = yPosition;
        }
    }

    /**
     * 스크롤 오프셋 업데이트
     */
    public setScrollOffset(offset: number): void {
        this.scrollOffsetX = offset;
    }

    /**
     * 점수 업데이트
     */
    public updateScore(): void {
        const meters = Math.floor(Math.max(0, this.scrollOffsetX) / 100);
        this.scoreText.text = `${meters} m`;
        animationSystem.scoreAnimation(this.scoreText);
    }

    /**
     * 콤보 UI 업데이트
     */
    public updateCombo(): void {
        const game = gameState.get();
        const combo = game.combo || 0;

        if (combo > 0) {
            this.comboText.text = `${combo} COMBO`;
            this.comboText.visible = true;
            this.comboText.style.fill = 0xFFFFFF;

            // 콤보가 높을수록 크기 증가
            const baseSize = 28;
            const sizeBoost = Math.min(12, combo * 1.5);
            this.comboText.style.fontSize = baseSize + sizeBoost;
        } else {
            this.comboText.visible = false;
        }
    }

    /**
     * 게임 시작 시 UI 초기화
     */
    public onGameStart(): void {
        this.gameOverText.visible = false;
        animationSystem.fadeInUI(this.scoreText);
    }

    /**
     * 게임 오버 시 UI 업데이트
     */
    public onGameOver(): void {
        const game = gameState.get();
        const currentScore = Math.floor(Math.max(0, this.scrollOffsetX) / 100);
        const highScore = game.highScore;
        const currentCombo = game.combo;
        const maxCombo = game.maxCombo;
        const isNewRecord = game.isNewRecord;

        // 게임오버 텍스트 구성
        let gameOverMessage = 'GAME OVER\n\n';
        
        if (isNewRecord) {
            gameOverMessage += '🎉 NEW RECORD! 🎉\n\n';
        }
        
        gameOverMessage += `Score: ${currentScore} m\n`;
        gameOverMessage += `Best: ${highScore} m\n\n`;
        gameOverMessage += `Combo: ${currentCombo}\n`;
        gameOverMessage += `Max Combo: ${maxCombo}\n\n`;
        gameOverMessage += 'TAP TO RETRY';

        this.gameOverText.text = gameOverMessage;
        this.gameOverText.visible = true;
        animationSystem.gameOverAnimation(this.gameOverText);
    }

    /**
     * 텍스트 요소 getter (외부에서 접근 필요 시)
     */
    public getScoreText(): PIXI.Text {
        return this.scoreText;
    }

    public getComboText(): PIXI.Text {
        return this.comboText;
    }

    public getGameOverText(): PIXI.Text {
        return this.gameOverText;
    }
}

