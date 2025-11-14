import * as PIXI from 'pixi.js';
import { getSafeAreaInsets as fetchSafeAreaInsets } from '@apps-in-toss/web-framework';
import { gameState } from '../stores/gameStore';
import { GAME_CONFIG, COLORS } from '../core/config';
import { animationSystem } from '../systems/animationSystem';
import { userManager } from './UserManager';
import { logger } from '../utils/logger';

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
    private gameOverContent!: PIXI.Container;
    private gameOverBg!: PIXI.Graphics;
    private gameOverTitle!: PIXI.Text;
    private newRecordBadge!: PIXI.Container;
    private scoreBox!: PIXI.Container;
    private comboBox!: PIXI.Container;
    private retryButton!: PIXI.Container;
    
    // 일시정지 UI 요소들
    private pauseButton!: PIXI.Container;
    private pauseButtonBg!: PIXI.Graphics;
    private pausePanel!: PIXI.Container;
    private pauseOverlay!: PIXI.Graphics;
    private pauseContent!: PIXI.Container;
    private pausePanelBg!: PIXI.Graphics;
    private pauseTitleText!: PIXI.Text;
    private soundToggleBtn!: PIXI.Container;
    private soundBtnBg!: PIXI.Graphics;
    private soundBtnText!: PIXI.Text;
    private tutorialBtn!: PIXI.Container;
    private tutorialBtnBg!: PIXI.Graphics;
    private tutorialBtnText!: PIXI.Text;
    private resetRecordsBtn!: PIXI.Container;
    private resetRecordsBg!: PIXI.Graphics;
    private resetRecordsText!: PIXI.Text;
    private resumeBtn!: PIXI.Container;
    private resumeBtnBg!: PIXI.Graphics;
    private resumeBtnText!: PIXI.Text;
    private onPauseCallback?: () => void;
    private onResumeCallback?: () => void;
    private onSoundToggleCallback?: (enabled: boolean) => void;
    private onTutorialCallback?: () => void;
    private onResetRecordsCallback?: () => void;
    private soundEnabled: boolean = true;
    private resizeHandler?: () => void;
    private orientationChangeHandler?: () => void;

    constructor(stage: PIXI.Container) {
        this.stage = stage;
        this.init();
        this.setupResizeHandler();
    }

    private emitUIEvent<T extends Record<string, unknown> | undefined = undefined>(
        name: string,
        detail?: T
    ): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.dispatchEvent(new CustomEvent(`game-ui:${name}`, { detail }));
    }

    private init(): void {
        // UI 전용 레이어 생성 (클릭 이벤트 완전 차단!)
        this.uiLayer = new PIXI.Container();
        this.uiLayer.name = 'uiLayer';
        this.uiLayer.eventMode = 'none';
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

        try {
            const storedMuted = userManager.loadData('soundMuted') === 'true';
            this.applySoundSetting(!storedMuted, { skipCallback: true, emitEvent: false });
        } catch (error) {
            console.warn('Failed to read soundMuted setting', error);
            this.applySoundSetting(true, { skipCallback: true, emitEvent: false });
        }
    }
    
    private initGameOverUI(): void {
        // 게임오버 컨테이너
        this.gameOverContainer = new PIXI.Container();
        this.gameOverContainer.visible = false;
        this.gameOverContainer.eventMode = 'none';
        this.gameOverContainer.interactive = false;
        
        // 반투명 오버레이
        this.gameOverOverlay = new PIXI.Graphics();
        this.gameOverOverlay.beginFill(0x000000, 0.85);
        this.gameOverOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.gameOverOverlay.endFill();
        this.gameOverContainer.addChild(this.gameOverOverlay);
        
        // 게임오버 콘텐츠 컨테이너 (오버레이 제외)
        this.gameOverContent = new PIXI.Container();
        this.gameOverContent.eventMode = 'none';
        this.gameOverContent.interactive = false;
        this.gameOverContainer.addChild(this.gameOverContent);
        
        // 메인 카드 배경
        this.gameOverBg = new PIXI.Graphics();
        this.gameOverContent.addChild(this.gameOverBg);
        
        // 타이틀
        this.gameOverTitle = new PIXI.Text('GAME OVER', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 48,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        this.gameOverTitle.anchor.set(0.5, 0.5);
        this.gameOverContent.addChild(this.gameOverTitle);
        
        // 신기록 배지 컨테이너
        this.newRecordBadge = new PIXI.Container();
        this.newRecordBadge.visible = false;
        this.gameOverContent.addChild(this.newRecordBadge);
        
        // 점수 박스
        this.scoreBox = new PIXI.Container();
        this.gameOverContent.addChild(this.scoreBox);
        
        // 콤보 박스
        this.comboBox = new PIXI.Container();
        this.gameOverContent.addChild(this.comboBox);
        
        // 재시도 버튼
        this.retryButton = new PIXI.Container();
        this.gameOverContent.addChild(this.retryButton);
        
        this.stage.addChild(this.gameOverContainer);
    }

    private setupResizeHandler(): void {
        this.resizeHandler = () => {
            this.refreshUILayout();
        };
        this.orientationChangeHandler = this.resizeHandler;

        window.addEventListener('resize', this.resizeHandler);
        window.addEventListener('orientationchange', this.orientationChangeHandler);
        this.refreshUILayout();
    }

    public destroy(): void {
        // 이벤트 리스너 정리
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.orientationChangeHandler) {
            window.removeEventListener('orientationchange', this.orientationChangeHandler);
        }

        // PIXI 객체 정리
        this.gameOverContainer.destroy({ children: true });
        this.pausePanel.destroy({ children: true });
        this.pauseButton.destroy({ children: true });
        this.uiLayer.destroy({ children: true });
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
        this.emitUIEvent('pause-close');
        this.emitUIEvent('gameover-close');
    }

    /**
     * 게임 오버 시 UI 업데이트
     */
    public onGameOver(): void {
        this.refreshUILayout();
        const game = gameState.get();
        const currentScore = game.score; // endGame에서 이미 설정된 최종 점수 사용
        const highScore = game.highScore;
        const roundMaxCombo = game.roundMaxCombo; // 이번 라운드 최고 콤보
        const maxCombo = game.maxCombo; // 역대 최고 콤보
        const isNewRecord = game.isNewRecord;

        const { top, bottom, left, right } = this.getEffectiveInsets();
        const safeWidth = Math.max(0, GAME_CONFIG.width - left - right);
        const safeHeight = Math.max(0, GAME_CONFIG.height - top - bottom);
        const effectiveWidth = Math.max(320, safeWidth);
        const effectiveHeight = Math.max(320, safeHeight);
        const isPortrait = GAME_CONFIG.height >= GAME_CONFIG.width;
        const isSmallHeight = effectiveHeight < 720;
        const isMobile = isPortrait && isSmallHeight;

        const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
        
        // 오버레이 크기 조정
        this.gameOverOverlay.clear();
        this.gameOverOverlay.beginFill(0x000000, 0.85);
        this.gameOverOverlay.drawRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        this.gameOverOverlay.endFill();
        
        // 메인 카드 배경 (기본 레이아웃 크기 계산)
        const maxCardWidth = Math.max(260, Math.min(360, effectiveWidth - 32));
        const cardWidth = clamp(
            effectiveWidth * 0.7,
            260,
            maxCardWidth
        );
        
        let cardHeightBase: number;
        if (isNewRecord && isPortrait) {
            cardHeightBase = Math.min(effectiveHeight * 0.78, isSmallHeight ? 390 : 420);
        } else if (isNewRecord) {
            cardHeightBase = Math.min(effectiveHeight * 0.7, 360);
        } else if (isPortrait) {
            cardHeightBase = isSmallHeight ? 320 : 340;
        } else {
            cardHeightBase = 300;
        }

        const minimumCardHeight = isPortrait ? 300 : 280;
        const maxCardHeight = Math.max(minimumCardHeight, effectiveHeight * 0.86);
        const cardHeight = clamp(cardHeightBase, minimumCardHeight, maxCardHeight);

        this.gameOverBg.clear();
        this.gameOverBg.lineStyle(2, 0x444444, 1);
        this.gameOverBg.beginFill(0x1a1a1a, 0.95);
        this.gameOverBg.drawRoundedRect(0, 0, cardWidth, cardHeight, 20);
        this.gameOverBg.endFill();
        
        const contentMargin = Math.max(32, cardHeight * 0.1);
        let layoutCursor = contentMargin;
        const titleBlockHeight = Math.max(36, cardHeight * 0.15);
        const titleCenterY = layoutCursor + titleBlockHeight / 2;
        layoutCursor += titleBlockHeight;
        this.gameOverTitle.x = cardWidth / 2;
        this.gameOverTitle.y = titleCenterY;
        this.gameOverTitle.style.fontSize = isMobile ? 32 : 42;
        
        const spacingSmall = Math.max(18, cardHeight * 0.05);
        const spacingMedium = Math.max(22, cardHeight * 0.06);
        
        // 신기록 배지
        this.newRecordBadge.removeChildren();
        if (isNewRecord) {
            const badgeWidth = (isPortrait ? 150 : 170);
            const badgeHeight = (isPortrait ? 44 : 48);
            
            const badgeBg = new PIXI.Graphics();
            badgeBg.beginFill(0xFFD700, 1);
            badgeBg.drawRoundedRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 20);
            badgeBg.endFill();
            
            const badgeText = new PIXI.Text('✨ NEW RECORD ✨', {
                fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
                fontSize: isMobile ? 16 : 20,
                fill: 0x000000,
                align: 'center',
                fontWeight: 'bold',
            });
            badgeText.anchor.set(0.5, 0.5);
            
            this.newRecordBadge.addChild(badgeBg);
            this.newRecordBadge.addChild(badgeText);
            this.newRecordBadge.x = cardWidth / 2;
            this.newRecordBadge.y = layoutCursor + badgeHeight / 2;
            this.newRecordBadge.visible = true;
            layoutCursor += badgeHeight + spacingSmall;
        } else {
            this.newRecordBadge.visible = false;
        }
        
        const statsBoxBase = GAME_CONFIG.height < 800 ? 118 : 150;
        const statsBoxHeight = clamp(
            statsBoxBase,
            Math.min(120, cardHeight * 0.42),
            Math.max(statsBoxBase, cardHeight * 0.48)
        );
        const innerWidth = cardWidth - contentMargin * 2;
        const statsGap = Math.max(20, innerWidth * 0.09);
        const statsWidth = Math.max(128, (innerWidth - statsGap) / 2);
        const statsTop = layoutCursor;
        layoutCursor += statsBoxHeight;
        layoutCursor += spacingMedium;
        
        // 점수 박스
        this.scoreBox.removeChildren();
        this.drawStatBox(
            this.scoreBox,
            'SCORE',
            currentScore,
            highScore,
            'm',
            contentMargin,
            statsTop,
            statsWidth,
            currentScore > highScore,
            statsBoxHeight
        );
        
        // 콤보 박스 (이번 라운드 최고 콤보 vs 역대 최고 콤보)
        this.comboBox.removeChildren();
        this.drawStatBox(
            this.comboBox,
            'MAX COMBO',
            roundMaxCombo,
            maxCombo,
            '',
            contentMargin + statsWidth + statsGap,
            statsTop,
            statsWidth,
            roundMaxCombo > maxCombo,
            statsBoxHeight
        );
        
        // 재시도 버튼 (모바일 대응)
        this.retryButton.removeChildren();
        const btnWidth = Math.max(innerWidth, cardWidth * 0.72);
        const btnHeight = isMobile ? 60 : 68;
        layoutCursor += spacingSmall;
        const maxButtonOffset = cardHeight - contentMargin - btnHeight;
        const btnOffset = Math.min(layoutCursor, maxButtonOffset);
        const btnX = contentMargin + Math.max(0, (innerWidth - btnWidth) / 2);
        const btnY = Math.max(
            contentMargin,
            Math.min(btnOffset, Math.max(contentMargin, maxButtonOffset))
        );
        
        const btnBg = new PIXI.Graphics();
        btnBg.lineStyle(2, 0xFFFFFF, 1);
        btnBg.beginFill(0x333333, 1);
        btnBg.drawRoundedRect(0, 0, btnWidth, btnHeight, 15);
        btnBg.endFill();
        
        const btnText = new PIXI.Text('TAP TO RETRY', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: isMobile ? 22 : 26,
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

        // 콘텐츠 컨테이너 스케일 및 위치 조정 (모바일 화면 대응)
        const modalInsets = { top, bottom, left, right };
        const position = this.calculateModalScaleAndPosition(cardWidth, cardHeight, modalInsets, GAME_CONFIG.uiMarginLarge);
        this.gameOverContent.scale.set(position.scale);
        this.gameOverContent.position.set(position.x, position.y);

        this.gameOverContainer.visible = false;
        this.pauseButton.visible = false; // 게임오버 시 일시정지 버튼 숨김
        this.pausePanel.visible = false; // 일시정지 패널도 숨김
        this.emitUIEvent('gameover-open', {
            score: currentScore,
            bestScore: highScore,
            combo: roundMaxCombo,
            bestCombo: maxCombo,
            isNewRecord,
        });
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
        isNew: boolean,
        boxHeight: number
    ): void {
        const effectiveHeight = Math.max(60, boxHeight);
        const scale = effectiveHeight / 120;
        
        // 박스 배경
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, isNew ? 0xFFD700 : 0x666666, 1);
        bg.beginFill(0x2a2a2a, 1);
        bg.drawRoundedRect(0, 0, width, effectiveHeight, Math.max(8, 12 * scale));
        bg.endFill();
        container.addChild(bg);
        
        // 라벨
        const labelText = new PIXI.Text(label, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: Math.max(11, Math.round(14 * scale)),
            fill: 0x999999,
            align: 'center',
        });
        labelText.anchor.set(0.5, 0);
        labelText.x = width / 2;
        labelText.y = Math.max(6, effectiveHeight * 0.08);
        container.addChild(labelText);
        
        // 현재 값
        const currentText = new PIXI.Text(`${current}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: Math.max(22, Math.round(32 * scale)),
            fill: isNew ? 0xFFD700 : 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        currentText.anchor.set(0.5, 0);
        currentText.x = width / 2;
        const minGapAfterLabel = Math.max(12, effectiveHeight * 0.09);
        const minGapCurrentBest = Math.max(18, effectiveHeight * 0.14);
        const maxBottomPadding = Math.max(22, effectiveHeight * 0.16);
        const minBottomPadding = Math.max(14, effectiveHeight * 0.1);
        const topPadding = labelText.y;

        let currentY = labelText.y + labelText.height + minGapAfterLabel;
        const bestText = new PIXI.Text(`Best: ${best}${unit}`, {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: Math.max(11, Math.round(14 * scale)),
            fill: 0x888888,
            align: 'center',
        });
        bestText.anchor.set(0.5, 0);
        bestText.x = width / 2;

        let bestBottomPadding = maxBottomPadding;
        let bestY = effectiveHeight - bestBottomPadding - bestText.height;
        let gap = bestY - (currentY + currentText.height);

        if (gap < minGapCurrentBest) {
            const deficit = minGapCurrentBest - gap;
            const liftCurrent = Math.min(deficit * 0.6, Math.max(0, currentY - (topPadding + minGapAfterLabel)));
            currentY -= liftCurrent;

            const remaining = deficit - liftCurrent;
            if (remaining > 0) {
                const reducePadding = Math.min(remaining, bestBottomPadding - minBottomPadding);
                bestBottomPadding -= reducePadding;
                bestY = effectiveHeight - bestBottomPadding - bestText.height;
            }

            gap = bestY - (currentY + currentText.height);
            if (gap < minGapCurrentBest) {
                const finalLift = minGapCurrentBest - gap;
                currentY = Math.max(topPadding + minGapAfterLabel, currentY - finalLift);
            }
        }

        const currentMaxY = bestY - minGapCurrentBest - currentText.height;
        currentY = Math.min(currentY, currentMaxY);
        currentText.y = currentY;
        container.addChild(currentText);

        const bestMinY = currentText.y + currentText.height + minGapCurrentBest;
        bestY = Math.max(bestMinY, effectiveHeight - bestBottomPadding - bestText.height);
        bestY = Math.min(bestY, effectiveHeight - minBottomPadding - bestText.height);
        bestText.y = bestY;
        container.addChild(bestText);
        
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
        this.pauseButtonBg = new PIXI.Graphics();
        this.pauseButtonBg.lineStyle(2, 0xFFFFFF, 1);
        this.pauseButtonBg.beginFill(0x000000, 0.5);
        this.pauseButtonBg.drawRoundedRect(0, 0, 50, 50, 10);
        this.pauseButtonBg.endFill();
        
        // 일시정지 아이콘 (두 개의 막대)
        const pauseIcon = new PIXI.Graphics();
        pauseIcon.beginFill(0xFFFFFF);
        pauseIcon.drawRect(15, 15, 6, 20);
        pauseIcon.drawRect(29, 15, 6, 20);
        pauseIcon.endFill();
        
        this.pauseButton.addChild(this.pauseButtonBg);
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
        this.pausePanel.addChild(this.pauseOverlay);
        
        this.pauseContent = new PIXI.Container();
        this.pausePanel.addChild(this.pauseContent);

        // 패널 배경
        this.pausePanelBg = new PIXI.Graphics();
        this.pauseContent.addChild(this.pausePanelBg);
        
        // PAUSED 타이틀
        this.pauseTitleText = new PIXI.Text('PAUSED', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 42,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        this.pauseTitleText.anchor.set(0.5, 0);
        this.pauseContent.addChild(this.pauseTitleText);
        
        // 사운드 토글 버튼
        this.soundToggleBtn = new PIXI.Container();
        this.soundBtnBg = new PIXI.Graphics();
        this.soundToggleBtn.addChild(this.soundBtnBg);
        
        this.soundBtnText = new PIXI.Text('🔊 SOUND: ON', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 20,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        this.soundBtnText.anchor.set(0.5, 0.5);
        this.soundToggleBtn.addChild(this.soundBtnText);
        this.soundToggleBtn.interactive = true;
        this.soundToggleBtn.cursor = 'pointer';
        
        // 사운드 토글 클릭 이벤트
        this.soundToggleBtn.on('pointerdown', () => {
            this.applySoundSetting(!this.soundEnabled);
        });
        
        this.pauseContent.addChild(this.soundToggleBtn);
        
    // 튜토리얼 다시보기 버튼
    this.tutorialBtn = new PIXI.Container();
    this.tutorialBtnBg = new PIXI.Graphics();
    this.tutorialBtn.addChild(this.tutorialBtnBg);

        this.tutorialBtnText = new PIXI.Text('📘 튜토리얼 다시보기', {
        fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
        fontSize: 18,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold',
    });
    this.tutorialBtnText.anchor.set(0.5, 0.5);
    this.tutorialBtn.addChild(this.tutorialBtnText);
    this.tutorialBtn.interactive = true;
    this.tutorialBtn.cursor = 'pointer';
    this.tutorialBtn.on('pointerdown', () => {
        if (this.onTutorialCallback) {
            this.onTutorialCallback();
        }
    });

    this.pauseContent.addChild(this.tutorialBtn);

        // 기록 초기화 버튼
        this.resetRecordsBtn = new PIXI.Container();
        this.resetRecordsBg = new PIXI.Graphics();
        this.resetRecordsBtn.addChild(this.resetRecordsBg);

        this.resetRecordsText = new PIXI.Text('🗑️ 기록 초기화', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 18,
            fill: 0xFF6F61,
            align: 'center',
            fontWeight: 'bold',
        });
        this.resetRecordsText.anchor.set(0.5, 0.5);
        this.resetRecordsBtn.addChild(this.resetRecordsText);
        this.resetRecordsBtn.interactive = true;
        this.resetRecordsBtn.cursor = 'pointer';
        this.resetRecordsBtn.on('pointerdown', () => {
            if (this.onResetRecordsCallback) {
                this.onResetRecordsCallback();
            }
        });

        this.pauseContent.addChild(this.resetRecordsBtn);

        // Resume 버튼
        this.resumeBtn = new PIXI.Container();
        
        this.resumeBtnBg = new PIXI.Graphics();
        this.resumeBtn.addChild(this.resumeBtnBg);
        
        this.resumeBtnText = new PIXI.Text('▶ RESUME', {
            fontFamily: 'Pretendard, Inter, Roboto Mono, monospace',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
        });
        this.resumeBtnText.anchor.set(0.5, 0.5);
        this.resumeBtn.addChild(this.resumeBtnText);
        this.resumeBtn.interactive = true;
        this.resumeBtn.cursor = 'pointer';
        this.resumeBtn.on('pointerdown', () => {
            if (this.onResumeCallback) {
                this.onResumeCallback();
            }
        });
        
        this.pauseContent.addChild(this.resumeBtn);
        
        this.stage.addChild(this.pausePanel);
        this.refreshUILayout();
    }
    
    private applySoundSetting(
        enabled: boolean,
        options: { skipCallback?: boolean; emitEvent?: boolean } = {}
    ): void {
        this.soundEnabled = enabled;
        if (this.soundBtnText) {
            this.soundBtnText.text = enabled ? '🔊 SOUND: ON' : '🔇 SOUND: OFF';
        }

        try {
            userManager.saveData('soundMuted', (!enabled).toString());
        } catch (error) {
            console.warn('Failed to persist soundMuted setting', error);
        }

        if (!options.skipCallback && this.onSoundToggleCallback) {
            this.onSoundToggleCallback(enabled);
        }

        if (options.emitEvent !== false) {
            this.emitUIEvent('sound-changed', { soundEnabled: enabled });
        }
    }
    
    // 일시정지 콜백 설정
    public setPauseCallbacks(
        onPause: () => void,
        onResume: () => void,
        onSoundToggle: (enabled: boolean) => void,
        onTutorial?: () => void,
        onResetRecords?: () => void
    ): void {
        this.onPauseCallback = onPause;
        this.onResumeCallback = onResume;
        this.onSoundToggleCallback = onSoundToggle;
        this.onTutorialCallback = onTutorial;
        this.onResetRecordsCallback = onResetRecords;
    }
    
    public requestResumeFromOverlay(): void {
        if (this.onResumeCallback) {
            this.onResumeCallback();
        } else {
            this.hidePausePanel();
        }
    }

    public requestSoundToggleFromOverlay(): void {
        this.applySoundSetting(!this.soundEnabled);
    }

    public requestTutorialFromOverlay(): void {
        if (this.onTutorialCallback) {
            this.onTutorialCallback();
        }
    }

    public requestResetRecordsFromOverlay(): void {
        if (this.onResetRecordsCallback) {
            this.onResetRecordsCallback();
        }
    }
    
    // 일시정지 패널 표시
    public showPausePanel(): void {
        this.pausePanel.visible = false;
        this.pauseButton.visible = false;
        this.emitUIEvent('pause-open', { soundEnabled: this.soundEnabled });
    }
    
    // 일시정지 패널 숨기기
    public hidePausePanel(): void {
        this.pausePanel.visible = false;
        this.pauseButton.visible = true;
        this.emitUIEvent('pause-close');
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

    private readSafeArea(): { top: number; right: number; bottom: number; left: number } {
        try {
            const insets = fetchSafeAreaInsets() as
                | { top?: number; right?: number; bottom?: number; left?: number }
                | undefined;
            if (insets) {
                return {
                    top: insets.top ?? 0,
                    right: insets.right ?? 0,
                    bottom: insets.bottom ?? 0,
                    left: insets.left ?? 0,
                };
            }
        } catch (error) {
            console.warn('Failed to get safe-area insets from Toss bridge', error);
        }

        const styles = window.getComputedStyle(document.documentElement);
        const cssTop = parseFloat(styles.getPropertyValue('--safe-area-inset-top') || '0') || 0;
        const cssRight = parseFloat(styles.getPropertyValue('--safe-area-inset-right') || '0') || 0;
        const cssBottom = parseFloat(styles.getPropertyValue('--safe-area-inset-bottom') || '0') || 0;
        const cssLeft = parseFloat(styles.getPropertyValue('--safe-area-inset-left') || '0') || 0;
        return { top: cssTop, right: cssRight, bottom: cssBottom, left: cssLeft };
    }

    private getEffectiveInsets(): { top: number; right: number; bottom: number; left: number } {
        const raw = this.readSafeArea();
        const viewport = window.visualViewport;
        const viewportTop = viewport ? viewport.offsetTop : 0;
        const viewportLeft = viewport ? viewport.offsetLeft : 0;
        const viewportRight = viewport
            ? Math.max(0, window.innerWidth - viewport.width - viewport.offsetLeft)
            : 0;
        const viewportBottom = viewport
            ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
            : 0;

        const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        const navFallback = orientation === 'landscape' ? 64 : 48;

        const top = Math.max(raw.top, viewportTop, navFallback);
        const left = Math.max(raw.left, viewportLeft);
        const right = Math.max(raw.right, viewportRight);
        const bottom = Math.max(raw.bottom, viewportBottom);

        return { top, right, bottom, left };
    }

    /**
     * 모달 스케일 및 위치 계산 (공통 로직)
     */
    private calculateModalScaleAndPosition(
        contentWidth: number,
        contentHeight: number,
        insets: { top: number; right: number; bottom: number; left: number },
        margin: number = GAME_CONFIG.uiMarginMedium
    ): { scale: number; x: number; y: number } {
        const { top, right, bottom, left } = insets;
        const availableWidth = Math.max(0, GAME_CONFIG.width - left - right);
        const availableHeight = Math.max(0, GAME_CONFIG.height - top - bottom);

        if (availableWidth <= 0 || availableHeight <= 0) {
            logger.warn('Available modal area is invalid', { availableWidth, availableHeight });
            return {
                scale: 1,
                x: left + 16,
                y: top + Math.max(16, availableHeight * 0.12)
            };
        }

        // 스케일 후보 계산
        const scaleCandidates: number[] = [
            1,
            availableWidth / contentWidth,
            availableHeight / contentHeight
        ];

        if (availableWidth > margin) {
            scaleCandidates.push((availableWidth - margin) / contentWidth);
        }
        if (availableHeight > margin) {
            scaleCandidates.push((availableHeight - margin) / contentHeight);
        }

        const scale = Math.max(0.5, Math.min(1, Math.min(...scaleCandidates)));
        const scaledWidth = contentWidth * scale;
        const scaledHeight = contentHeight * scale;

        // 중앙 정렬 with upward lift
        const x = left + Math.max(0, (availableWidth - scaledWidth) / 2);
        const lift = Math.min(scaledHeight * 0.12, Math.max(20, availableHeight * 0.08));
        const y = top + Math.max(0, (availableHeight - scaledHeight) / 2 - lift);

        return { scale, x, y };
    }

    private refreshUILayout(): void {
        const width = GAME_CONFIG.width;
        const height = GAME_CONFIG.height;
        const insets = this.getEffectiveInsets();
        const top = insets.top;
        const right = insets.right;
        const bottom = insets.bottom;
        const left = insets.left;
        const margin = 10;

        const scoreTop = 0;

        if (this.scoreText) {
            this.scoreText.x = left + 10;
            this.scoreText.y = scoreTop + 10;
        }

        if (this.comboText) {
            this.comboText.x = width / 2;
            this.comboText.y = top + 32;
        }

        if (this.pauseButton) {
            this.pauseButton.x = Math.max(left + margin, width - right - margin - this.pauseButton.width);
            this.pauseButton.y = top + margin;
        }

        if (this.pauseOverlay) {
            this.pauseOverlay.clear();
            this.pauseOverlay.beginFill(0x000000, 0.85);
            this.pauseOverlay.drawRect(0, top, width, Math.max(0, height - top - bottom));
            this.pauseOverlay.endFill();
        }

        if (
            this.pauseContent &&
            this.pausePanelBg &&
            this.soundToggleBtn &&
            this.resumeBtn &&
            this.tutorialBtn &&
            this.resetRecordsBtn
        ) {
            const availableWidth = Math.max(0, width - left - right);
            const availableHeight = Math.max(0, height - top - bottom);
            const fallbackWidth = Math.max(320, Math.min(380, width * 0.55));
            const fallbackHeight = Math.max(360, Math.min(440, height * 0.7));
            const panelWidth = availableWidth > 0
                ? Math.min(380, Math.max(260, availableWidth - 24))
                : fallbackWidth;
            const panelHeight = availableHeight > 0
                ? Math.min(440, Math.max(320, availableHeight - 16))
                : fallbackHeight;

            this.pausePanelBg.clear();
            this.pausePanelBg.lineStyle(2, 0x444444, 1);
            this.pausePanelBg.beginFill(0x1a1a1a, 0.95);
            this.pausePanelBg.drawRoundedRect(0, 0, panelWidth, panelHeight, 20);
            this.pausePanelBg.endFill();

            this.pauseTitleText.x = panelWidth / 2;
            this.pauseTitleText.y = Math.min(32, panelHeight * 0.1);

            const buttonWidth = panelWidth - 40;
            const soundHeight = Math.min(60, Math.max(48, panelHeight * 0.2));
            const tutorialHeight = Math.min(58, Math.max(46, panelHeight * 0.18));
            const resetHeight = Math.min(54, Math.max(44, panelHeight * 0.17));
            const resumeHeight = soundHeight;

            const spacingAfterTitle = Math.max(20, panelHeight * 0.08);
            const spacingPrimary = Math.max(16, panelHeight * 0.05);
            const spacingSecondary = Math.max(12, panelHeight * 0.04);
            const spacingBeforeResume = Math.max(18, panelHeight * 0.055);
            const bottomPadding = Math.max(22, panelHeight * 0.065);

            this.soundBtnBg.clear();
            this.soundBtnBg.lineStyle(2, 0x666666, 1);
            this.soundBtnBg.beginFill(0x2a2a2a, 1);
            this.soundBtnBg.drawRoundedRect(0, 0, buttonWidth, soundHeight, 12);
            this.soundBtnBg.endFill();

            this.soundToggleBtn.x = 20;
            this.soundToggleBtn.y = this.pauseTitleText.y + this.pauseTitleText.height + spacingAfterTitle;
            this.soundBtnText.x = buttonWidth / 2;
            this.soundBtnText.y = soundHeight / 2;

            this.tutorialBtnBg.clear();
            this.tutorialBtnBg.lineStyle(2, 0x3182F6, 1);
            this.tutorialBtnBg.beginFill(0x1f1f24, 1);
            this.tutorialBtnBg.drawRoundedRect(0, 0, buttonWidth, tutorialHeight, 12);
            this.tutorialBtnBg.endFill();

            this.tutorialBtn.x = 20;
            this.tutorialBtn.y = this.soundToggleBtn.y + soundHeight + spacingPrimary;
            this.tutorialBtnText.x = buttonWidth / 2;
            this.tutorialBtnText.y = tutorialHeight / 2;

            this.resetRecordsBg.clear();
            this.resetRecordsBg.lineStyle(2, 0xFF6F61, 1);
            this.resetRecordsBg.beginFill(0x1f1515, 1);
            this.resetRecordsBg.drawRoundedRect(0, 0, buttonWidth, resetHeight, 12);
            this.resetRecordsBg.endFill();

            this.resetRecordsBtn.x = 20;
            this.resetRecordsBtn.y = this.tutorialBtn.y + tutorialHeight + spacingSecondary;
            this.resetRecordsText.x = buttonWidth / 2;
            this.resetRecordsText.y = resetHeight / 2;

            this.resumeBtnBg.clear();
            this.resumeBtnBg.lineStyle(2, 0xFFFFFF, 1);
            this.resumeBtnBg.beginFill(0x333333, 1);
            this.resumeBtnBg.drawRoundedRect(0, 0, buttonWidth, resumeHeight, 12);
            this.resumeBtnBg.endFill();

            this.resumeBtn.x = 20;
            this.resumeBtn.y = this.resetRecordsBtn.y + resetHeight + spacingBeforeResume;
            this.resumeBtnText.x = buttonWidth / 2;
            this.resumeBtnText.y = resumeHeight / 2;

            const bottomExtent = this.resumeBtn.y + resumeHeight + bottomPadding;
            if (bottomExtent > panelHeight) {
                const shift = bottomExtent - panelHeight;
                this.soundToggleBtn.y = Math.max(this.pauseTitleText.y + this.pauseTitleText.height + 12, this.soundToggleBtn.y - shift);
                this.tutorialBtn.y = Math.max(this.soundToggleBtn.y + soundHeight + 8, this.tutorialBtn.y - shift);
                this.resetRecordsBtn.y = Math.max(this.tutorialBtn.y + tutorialHeight + 6, this.resetRecordsBtn.y - shift);
                this.resumeBtn.y = Math.max(this.resetRecordsBtn.y + resetHeight + 8, this.resumeBtn.y - shift);
            }

            // 일시정지 모달 위치 및 스케일 계산
            const pausePosition = this.calculateModalScaleAndPosition(panelWidth, panelHeight, { top, right, bottom, left });
            this.pauseContent.scale.set(pausePosition.scale);
            this.pauseContent.position.set(pausePosition.x, pausePosition.y);
        }

        this.updateGameOverPosition();
    }
}

