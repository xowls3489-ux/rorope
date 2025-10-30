import { atom } from 'nanostores';

export type SceneState = 'title' | 'game' | 'gameover';

export const sceneState = atom<SceneState>('title');

export const sceneActions = {
    goToTitle: () => sceneState.set('title'),
    goToGame: () => sceneState.set('game'),
    goToGameOver: () => sceneState.set('gameover'),
    restartGame: () => sceneState.set('game')
};

