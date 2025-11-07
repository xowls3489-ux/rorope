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
    private uiLayer!: PIXI.Container; // UI 전용 레이어 (클릭 이벤트 완전 차단)
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
    
    // 일시정지 UI 요소들
    private pauseButton!: PIXI.Container;
    private pausePanel!: PIXI.Container;
    private pauseOverlay!: PIXI.Graphics;
    private onPauseCallback?: () => void;
    private onResumeCallback?: () => void;
    private onSoundToggleCallback?: (enabled: boolean) => void;

    constructor(stage: PIXI.Container) {
        this.stage = stage;
        this.init();
        this.setupResizeHandler();
    }

    private init(): void {
        // UI 전용 레이어 생성 (클릭 이벤트 완전 차단!)
        this.uiLayer = new PIXI.Container();
        this.uiLayer.name = 'uiLayer';
        (this.uiLayer as any).eventMode = 'none';
        this.uiLayer.interactive = false;
        this.uiLayer.interactiveChildren = false;
        this.stage.addChild(this.uiLayer);
        
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
        this.uiLayer.addChild(this.scoreText);

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
        this.uiLayer.addChild(this.comboText);

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
        
        // 일시정지 UI 초기화
        this.initPauseUI();
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
        this.pauseButton.visible = true; // 일시정지 버튼 표시
        this.pausePanel.visible = false; // 일시정지 패널 숨김
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
        const centerY = GAME_CONFIG.height / 2; // 항상 중앙
        const isMobile = GAME_CONFIG.height < 800;
        
        // 오버레이 크기 조정
        this.gameOverOverlay.clear();
        this.gameOverOverlay.beginFill(0x000000, 0.85);
        this.gameOverOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.gameOverOverlay.endFill();
        
        // 메인 카드 배경 (모바일 대응 - 화면 크기에 맞춤)
        const cardWidth = Math.min(400, GAME_CONFIG.width - 80);
        // 신기록 여부와 모바일 여부에 따라 높이 조정
        let cardHeightBase: number;
        if (isNewRecord && isMobile) {
            cardHeightBase = 440; // 모바일 + 신기록: 더 여유있게
        } else if (isNewRecord) {
            cardHeightBase = 420; // 데스크톱 + 신기록
        } else if (isMobile) {
            cardHeightBase = 360; // 모바일 기본
        } else {
            cardHeightBase = 380; // 데스크톱 기본
        }
        const cardHeight = Math.min(cardHeightBase, GAME_CONFIG.height - 80); // 여유 공간 확대 (100 → 80)
        
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
        
        // 타이틀 위치 (동적 조정)
        const titleOffsetY = Math.min(160, cardHeight / 2 - 30);
        this.gameOverTitle.x = centerX;
        this.gameOverTitle.y = centerY - titleOffsetY;
        
        // 타이틀 폰트 크기도 모바일에서 작게
        this.gameOverTitle.style.fontSize = isMobile ? 32 : 48;
        
        // yOffset 동적 조정
        let yOffset = centerY - Math.min(80, cardHeight / 2 - 60);
        
        // 신기록 배지
        this.newRecordBadge.removeChildren();
        if (isNewRecord) {
            const badgeWidth = isMobile ? 140 : 160;
            const badgeHeight = isMobile ? 35 : 40;
            
            const badgeBg = new PIXI.Graphics();
            badgeBg.beginFill(0xFFD700, 1);
            badgeBg.drawRoundedRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 20);
            badgeBg.endFill();
            
            const badgeText = new PIXI.Text('✨ NEW RECORD ✨', {
                fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
                fontSize: isMobile ? 14 : 18,
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
            
            yOffset += isMobile ? 48 : 50; // 모바일에서 간격 약간 확대
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
        
        // 재시도 버튼 (모바일 대응)
        this.retryButton.removeChildren();
        const btnWidth = cardWidth - 40;
        const btnHeight = isMobile ? 50 : 60;
        const btnX = centerX - btnWidth / 2;
        const btnBottomMargin = isMobile ? 20 : 20; // 모바일 하단 마진 약간 확대
        const btnY = centerY + cardHeight / 2 - btnHeight - btnBottomMargin;
        
        const btnBg = new PIXI.Graphics();
        btnBg.lineStyle(2, 0xFFFFFF, 1);
        btnBg.beginFill(0x333333, 1);
        btnBg.drawRoundedRect(0, 0, btnWidth, btnHeight, 15);
        btnBg.endFill();
        
        const btnText = new PIXI.Text('TAP TO RETRY', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: isMobile ? 20 : 24,
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
        this.pauseButton.visible = false; // 게임오버 시 일시정지 버튼 숨김
        this.pausePanel.visible = false; // 일시정지 패널도 숨김
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
        // 모바일 대응
        const isMobile = GAME_CONFIG.height < 800;
        const boxHeight = isMobile ? 95 : 120; // 모바일에서 약간 줄임
        
        // 박스 배경
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, isNew ? 0xFFD700 : 0x666666, 1);
        bg.beginFill(0x2a2a2a, 1);
        bg.drawRoundedRect(0, 0, width, boxHeight, 10);
        bg.endFill();
        container.addChild(bg);
        
        // 라벨
        const labelText = new PIXI.Text(label, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: isMobile ? 12 : 14,
            fill: 0x999999,
            align: 'center',
        });
        labelText.anchor.set(0.5, 0);
        labelText.x = width / 2;
        labelText.y = isMobile ? 8 : 10;
        container.addChild(labelText);
        
        // 현재 값
        const currentText = new PIXI.Text(`${current}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: isMobile ? 26 : 32, // 모바일에서 폰트 약간 줄임
            fill: isNew ? 0xFFD700 : 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        currentText.anchor.set(0.5, 0);
        currentText.x = width / 2;
        currentText.y = isMobile ? 30 : 35;
        container.addChild(currentText);
        
        // 최고 기록
        const bestText = new PIXI.Text(`Best: ${best}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: isMobile ? 12 : 14,
            fill: 0x888888,
            align: 'center',
        });
        bestText.anchor.set(0.5, 0);
        bestText.x = width / 2;
        bestText.y = isMobile ? 67 : 85; // 모바일에서 위치 조정
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
    
    // 일시정지 UI 초기화
    private initPauseUI(): void {
        // 일시정지 버튼 (우측 상단)
        this.pauseButton = new PIXI.Container();
        this.pauseButton.x = GAME_CONFIG.width - 70;
        this.pauseButton.y = 20;
        
        const pauseBtnBg = new PIXI.Graphics();
        pauseBtnBg.lineStyle(2, 0xFFFFFF, 1);
        pauseBtnBg.beginFill(0x000000, 0.5);
        pauseBtnBg.drawRoundedRect(0, 0, 50, 50, 10);
        pauseBtnBg.endFill();
        
        // 일시정지 아이콘 (두 개의 막대)
        const pauseIcon = new PIXI.Graphics();
        pauseIcon.beginFill(0xFFFFFF);
        pauseIcon.drawRect(15, 15, 6, 20);
        pauseIcon.drawRect(29, 15, 6, 20);
        pauseIcon.endFill();
        
        this.pauseButton.addChild(pauseBtnBg);
        this.pauseButton.addChild(pauseIcon);
        this.pauseButton.interactive = true;
        this.pauseButton.cursor = 'pointer';
        this.pauseButton.on('pointerdown', () => {
            if (this.onPauseCallback) {
                this.onPauseCallback();
            }
        });
        
        this.stage.addChild(this.pauseButton);
        
        // 일시정지 패널
        this.pausePanel = new PIXI.Container();
        this.pausePanel.visible = false;
        
        // 반투명 오버레이
        this.pauseOverlay = new PIXI.Graphics();
        this.pauseOverlay.beginFill(0x000000, 0.85);
        this.pauseOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.pauseOverlay.endFill();
        this.pausePanel.addChild(this.pauseOverlay);
        
        // 패널 배경
        const panelWidth = Math.min(380, GAME_CONFIG.width - 80);
        const panelHeight = 320;
        const panelX = GAME_CONFIG.width / 2 - panelWidth / 2;
        const panelY = GAME_CONFIG.height / 2 - panelHeight / 2;
        
        const panelBg = new PIXI.Graphics();
        panelBg.lineStyle(2, 0x444444, 1);
        panelBg.beginFill(0x1a1a1a, 0.95);
        panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panelBg.endFill();
        this.pausePanel.addChild(panelBg);
        
        // PAUSED 타이틀
        const pauseTitle = new PIXI.Text('PAUSED', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 42,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        pauseTitle.anchor.set(0.5, 0);
        pauseTitle.x = GAME_CONFIG.width / 2;
        pauseTitle.y = panelY + 30;
        this.pausePanel.addChild(pauseTitle);
        
        // 사운드 토글 버튼
        const soundToggleBtn = new PIXI.Container();
        const btnWidth = panelWidth - 40;
        const btnHeight = 60;
        const btnX = panelX + 20;
        let btnY = panelY + 100;
        
        const soundBtnBg = new PIXI.Graphics();
        soundBtnBg.lineStyle(2, 0x666666, 1);
        soundBtnBg.beginFill(0x2a2a2a, 1);
        soundBtnBg.drawRoundedRect(0, 0, btnWidth, btnHeight, 12);
        soundBtnBg.endFill();
        
        const soundBtnText = new PIXI.Text('🔊 SOUND: ON', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 20,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        soundBtnText.anchor.set(0.5, 0.5);
        soundBtnText.x = btnWidth / 2;
        soundBtnText.y = btnHeight / 2;
        
        soundToggleBtn.addChild(soundBtnBg);
        soundToggleBtn.addChild(soundBtnText);
        soundToggleBtn.x = btnX;
        soundToggleBtn.y = btnY;
        soundToggleBtn.interactive = true;
        soundToggleBtn.cursor = 'pointer';
        
        // 사운드 토글 클릭 이벤트
        soundToggleBtn.on('pointerdown', () => {
            const currentMuted = localStorage.getItem('soundMuted') === 'true';
            const newMuted = !currentMuted;
            
            if (this.onSoundToggleCallback) {
                this.onSoundToggleCallback(!newMuted); // enabled = !muted
            }
            
            // 버튼 텍스트 업데이트
            soundBtnText.text = newMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
        });
        
        this.pausePanel.addChild(soundToggleBtn);
        
        // Resume 버튼
        btnY += btnHeight + 20;
        const resumeBtn = new PIXI.Container();
        
        const resumeBtnBg = new PIXI.Graphics();
        resumeBtnBg.lineStyle(2, 0xFFFFFF, 1);
        resumeBtnBg.beginFill(0x333333, 1);
        resumeBtnBg.drawRoundedRect(0, 0, btnWidth, btnHeight, 12);
        resumeBtnBg.endFill();
        
        const resumeBtnText = new PIXI.Text('▶ RESUME', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        resumeBtnText.anchor.set(0.5, 0.5);
        resumeBtnText.x = btnWidth / 2;
        resumeBtnText.y = btnHeight / 2;
        
        resumeBtn.addChild(resumeBtnBg);
        resumeBtn.addChild(resumeBtnText);
        resumeBtn.x = btnX;
        resumeBtn.y = btnY;
        resumeBtn.interactive = true;
        resumeBtn.cursor = 'pointer';
        resumeBtn.on('pointerdown', () => {
            if (this.onResumeCallback) {
                this.onResumeCallback();
            }
        });
        
        this.pausePanel.addChild(resumeBtn);
        
        this.stage.addChild(this.pausePanel);
    }
    
    // 일시정지 콜백 설정
    public setPauseCallbacks(
        onPause: () => void,
        onResume: () => void,
        onSoundToggle: (enabled: boolean) => void
    ): void {
        this.onPauseCallback = onPause;
        this.onResumeCallback = onResume;
        this.onSoundToggleCallback = onSoundToggle;
    }
    
    // 일시정지 패널 표시
    public showPausePanel(): void {
        this.pausePanel.visible = true;
        this.pauseButton.visible = false;
    }
    
    // 일시정지 패널 숨기기
    public hidePausePanel(): void {
        this.pausePanel.visible = false;
        this.pauseButton.visible = true;
    }
    
    // 일시정지 버튼 표시/숨기기
    public setPauseButtonVisible(visible: boolean): void {
        this.pauseButton.visible = visible;
    }
    
    // pauseButton과 pausePanel을 맨 위로 올리기 (world보다 위에)
    public bringPauseUIToFront(): void {
        this.stage.removeChild(this.pauseButton);
        this.stage.removeChild(this.pausePanel);
        this.stage.addChild(this.pauseButton);
        this.stage.addChild(this.pausePanel);
    }
}

