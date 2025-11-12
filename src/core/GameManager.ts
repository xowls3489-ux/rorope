import { GameScene } from '../managers/GameScene';

/**
 * GameManager
 * GameScene의 래퍼 클래스 - 기존 인터페이스 호환성 유지
 */
export class GameManager {
    private gameScene: GameScene;

    constructor() {
        this.gameScene = new GameScene();
    }

    /**
     * UI에서 게임 시작
     */
    public startGameFromUI(): void {
        this.gameScene.startGameFromUI();
    }

    /**
     * UI에서 게임 재시작
     */
    public restartGameFromUI(): void {
        this.gameScene.restartGameFromUI();
    }

    /**
     * PixiJS 앱 인스턴스 가져오기
     */
    public get app() {
        return this.gameScene.getApp();
    }

    /**
     * UI 매니저 접근
     */
    public getUIManager() {
        return this.gameScene.getUIManager();
    }

    /**
     * Audio 매니저 접근
     */
    public getAudioManager() {
        return this.gameScene.getAudioManager();
    }
}

let gameManagerInstance: GameManager | null = null;

export async function initGameManager(): Promise<GameManager> {
    if (!gameManagerInstance) {
        gameManagerInstance = new GameManager();
        await new Promise((r) => setTimeout(r, 100));
        window.gameInstance = gameManagerInstance;
    }
    return gameManagerInstance;
}
