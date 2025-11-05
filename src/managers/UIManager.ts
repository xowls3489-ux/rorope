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
    
    // 게임오버 UI 요소들
    private gameOverContainer!: PIXI.Container;
    private gameOverOverlay!: PIXI.Graphics;
    private gameOverBg!: PIXI.Graphics;
    private gameOverTitle!: PIXI.Text;
    private newRecordBadge!: PIXI.Container;
    private scoreBox!: PIXI.Container;
    private comboBox!: PIXI.Container;
    private retryButton!: PIXI.Container;

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

        // 게임오버 UI (레거시 호환용)
        this.gameOverText = new PIXI.Text('', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 24,
            fill: COLORS.ui,
            align: 'center',
        });
        this.gameOverText.visible = false;
        
        // 새로운 게임오버 UI 초기화
        this.initGameOverUI();
    }
    
    private initGameOverUI(): void {
        // 게임오버 컨테이너
        this.gameOverContainer = new PIXI.Container();
        this.gameOverContainer.visible = false;
        (this.gameOverContainer as any).eventMode = 'none';
        this.gameOverContainer.interactive = false;
        
        // 반투명 오버레이
        this.gameOverOverlay = new PIXI.Graphics();
        this.gameOverOverlay.beginFill(0x000000, 0.85);
        this.gameOverOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.gameOverOverlay.endFill();
        this.gameOverContainer.addChild(this.gameOverOverlay);
        
        // 메인 카드 배경
        this.gameOverBg = new PIXI.Graphics();
        this.gameOverContainer.addChild(this.gameOverBg);
        
        // 타이틀
        this.gameOverTitle = new PIXI.Text('GAME OVER', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 48,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        this.gameOverTitle.anchor.set(0.5, 0.5);
        this.gameOverContainer.addChild(this.gameOverTitle);
        
        // 신기록 배지 컨테이너
        this.newRecordBadge = new PIXI.Container();
        this.newRecordBadge.visible = false;
        this.gameOverContainer.addChild(this.newRecordBadge);
        
        // 점수 박스
        this.scoreBox = new PIXI.Container();
        this.gameOverContainer.addChild(this.scoreBox);
        
        // 콤보 박스
        this.comboBox = new PIXI.Container();
        this.gameOverContainer.addChild(this.comboBox);
        
        // 재시도 버튼
        this.retryButton = new PIXI.Container();
        this.gameOverContainer.addChild(this.retryButton);
        
        this.stage.addChild(this.gameOverContainer);
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
        this.gameOverContainer.visible = false;
        animationSystem.fadeInUI(this.scoreText);
    }

    /**
     * 게임 오버 시 UI 업데이트
     */
    public onGameOver(): void {
        const game = gameState.get();
        const currentScore = game.score; // endGame에서 이미 설정된 최종 점수 사용
        const highScore = game.highScore;
        const roundMaxCombo = game.roundMaxCombo; // 이번 라운드 최고 콤보
        const maxCombo = game.maxCombo; // 역대 최고 콤보
        const isNewRecord = game.isNewRecord;

        const centerX = GAME_CONFIG.width / 2;
        const centerY = GAME_CONFIG.height / 2;
        
        // 오버레이 크기 조정
        this.gameOverOverlay.clear();
        this.gameOverOverlay.beginFill(0x000000, 0.85);
        this.gameOverOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.gameOverOverlay.endFill();
        
        // 메인 카드 배경 (둥근 사각형)
        const cardWidth = Math.min(400, GAME_CONFIG.width - 80);
        const cardHeight = 420;
        this.gameOverBg.clear();
        this.gameOverBg.lineStyle(2, 0x444444, 1);
        this.gameOverBg.beginFill(0x1a1a1a, 0.95);
        this.gameOverBg.drawRoundedRect(
            centerX - cardWidth / 2,
            centerY - cardHeight / 2,
            cardWidth,
            cardHeight,
            20
        );
        this.gameOverBg.endFill();
        
        // 타이틀 위치
        this.gameOverTitle.x = centerX;
        this.gameOverTitle.y = centerY - 160;
        
        let yOffset = centerY - 80;
        
        // 신기록 배지
        this.newRecordBadge.removeChildren();
        if (isNewRecord) {
            const badgeBg = new PIXI.Graphics();
            badgeBg.beginFill(0xFFD700, 1);
            badgeBg.drawRoundedRect(-80, -20, 160, 40, 20);
            badgeBg.endFill();
            
            const badgeText = new PIXI.Text('✨ NEW RECORD ✨', {
                fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
                fontSize: 18,
                fill: 0x000000,
                align: 'center',
                fontWeight: 'bold',
            });
            badgeText.anchor.set(0.5, 0.5);
            
            this.newRecordBadge.addChild(badgeBg);
            this.newRecordBadge.addChild(badgeText);
            this.newRecordBadge.x = centerX;
            this.newRecordBadge.y = yOffset;
            this.newRecordBadge.visible = true;
            
            yOffset += 50;
        } else {
            this.newRecordBadge.visible = false;
        }
        
        // 점수 박스
        this.scoreBox.removeChildren();
        this.drawStatBox(
            this.scoreBox,
            'SCORE',
            currentScore,
            highScore,
            'm',
            centerX - cardWidth / 2 + 20,
            yOffset,
            (cardWidth - 60) / 2,
            currentScore > highScore
        );
        
        // 콤보 박스 (이번 라운드 최고 콤보 vs 역대 최고 콤보)
        this.comboBox.removeChildren();
        this.drawStatBox(
            this.comboBox,
            'MAX COMBO',
            roundMaxCombo,
            maxCombo,
            '',
            centerX + 20,
            yOffset,
            (cardWidth - 60) / 2,
            roundMaxCombo > maxCombo
        );
        
        // 재시도 버튼
        this.retryButton.removeChildren();
        const btnWidth = cardWidth - 40;
        const btnHeight = 60;
        const btnX = centerX - btnWidth / 2;
        const btnY = centerY + cardHeight / 2 - btnHeight - 20;
        
        const btnBg = new PIXI.Graphics();
        btnBg.lineStyle(2, 0xFFFFFF, 1);
        btnBg.beginFill(0x333333, 1);
        btnBg.drawRoundedRect(0, 0, btnWidth, btnHeight, 15);
        btnBg.endFill();
        
        const btnText = new PIXI.Text('TAP TO RETRY', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        btnText.anchor.set(0.5, 0.5);
        btnText.x = btnWidth / 2;
        btnText.y = btnHeight / 2;
        
        this.retryButton.addChild(btnBg);
        this.retryButton.addChild(btnText);
        this.retryButton.x = btnX;
        this.retryButton.y = btnY;
        
        this.gameOverContainer.visible = true;
        animationSystem.gameOverAnimation(this.gameOverTitle);
    }
    
    private drawStatBox(
        container: PIXI.Container,
        label: string,
        current: number,
        best: number,
        unit: string,
        x: number,
        y: number,
        width: number,
        isNew: boolean
    ): void {
        // 박스 배경
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, isNew ? 0xFFD700 : 0x666666, 1);
        bg.beginFill(0x2a2a2a, 1);
        bg.drawRoundedRect(0, 0, width, 120, 10);
        bg.endFill();
        container.addChild(bg);
        
        // 라벨
        const labelText = new PIXI.Text(label, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 14,
            fill: 0x999999,
            align: 'center',
        });
        labelText.anchor.set(0.5, 0);
        labelText.x = width / 2;
        labelText.y = 10;
        container.addChild(labelText);
        
        // 현재 값
        const currentText = new PIXI.Text(`${current}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 32,
            fill: isNew ? 0xFFD700 : 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        currentText.anchor.set(0.5, 0);
        currentText.x = width / 2;
        currentText.y = 35;
        container.addChild(currentText);
        
        // 최고 기록
        const bestText = new PIXI.Text(`Best: ${best}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 14,
            fill: 0x888888,
            align: 'center',
        });
        bestText.anchor.set(0.5, 0);
        bestText.x = width / 2;
        bestText.y = 85;
        container.addChild(bestText);
        
        container.x = x;
        container.y = y;
    }
    
    private drawBestOnlyBox(
        container: PIXI.Container,
        label: string,
        value: number,
        unit: string,
        x: number,
        y: number,
        width: number
    ): void {
        // 박스 배경
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, 0x666666, 1);
        bg.beginFill(0x2a2a2a, 1);
        bg.drawRoundedRect(0, 0, width, 120, 10);
        bg.endFill();
        container.addChild(bg);
        
        // 라벨
        const labelText = new PIXI.Text(label, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 14,
            fill: 0x999999,
            align: 'center',
        });
        labelText.anchor.set(0.5, 0);
        labelText.x = width / 2;
        labelText.y = 20;
        container.addChild(labelText);
        
        // 값 (중앙에 크게)
        const valueText = new PIXI.Text(`${value}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 42,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        valueText.anchor.set(0.5, 0.5);
        valueText.x = width / 2;
        valueText.y = 70;
        container.addChild(valueText);
        
        container.x = x;
        container.y = y;
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

