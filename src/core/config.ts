// 화면 크기를 동적으로 계산
const getGameDimensions = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return { width, height };
};

export const GAME_CONFIG = {
    get width() { return getGameDimensions().width; },
    get height() { return getGameDimensions().height; },
    gravity: 15,
    ropeLength: 180,
    damping: 0.995,
    runSpeed: 3,
    runSpeedMax: 12,
    runSpeedIncreasePerDistance: 0.003,
    platformWidth: { min: 100, max: 150 },
    platformHeight: 15,
    platformSpacing: { min: 200, max: 300 },
    platformHeightVariation: 80,
    // 그래플링 후크 파라미터
    grappleShootSpeed: 2500,
    grappleMaxLength: 750,
    grappleBasePullSpeed: 2400,
    grappleComboSpeedBonus: 150,
    grappleEasingFactor: 0.35,
    grappleReboundDistance: 20,
    grappleMomentumBoost: 1.2,
    grappleCameraZoom: 0.95,
    // 스크롤 방식 설정
    get playerFixedX() { return Math.min(280, this.width * 0.35); }, // 화면 크기에 비례
    baseScrollSpeed: 5, // 기본 스크롤 속도
    // 슬로우 모션 설정
    slowMotionScale: 0.4, // 슬로우 모션 시 게임 속도 (0.4 = 40% 속도)
    slowMotionDuration: 2000, // 슬로우 모션 지속 시간 (밀리초)
    slowMotionComboThreshold: 10, // 슬로우 모션 활성화 콤보 수
    slowMotionDangerDistance: 100, // 화면 밖으로 이 거리만큼 가까워지면 위험
};

export const COLORS = {
    background: 0x000000,
    primary: 0xFFFFFF,
    rope: 0xFFFFFF,
    ui: 0xFFFFFF,
    accent: 0x888888
};


