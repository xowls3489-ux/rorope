export const GAME_CONFIG = {
    width: 1920,  // 게임 로직 해상도 (고정)
    height: 1080, // 16:9 비율
    gravity: 15,
    ropeLength: 360, // 1080p 기준 2배
    damping: 0.995,
    runSpeed: 6, // 1080p 기준 2배
    runSpeedMax: 24, // 1080p 기준 2배
    runSpeedIncreasePerDistance: 0.003,
    platformWidth: { min: 200, max: 300 }, // 1080p 기준 2배
    platformHeight: 30, // 1080p 기준 2배
    platformSpacing: { min: 400, max: 600 }, // 1080p 기준 2배
    platformHeightVariation: 160, // 1080p 기준 2배
    // 그래플링 후크 파라미터
    grappleShootSpeed: 5000, // 1080p 기준 2배
    grappleMaxLength: 1500, // 1080p 기준 2배
    grappleBasePullSpeed: 4800, // 1080p 기준 2배
    grappleComboSpeedBonus: 300, // 1080p 기준 2배
    grappleEasingFactor: 0.35,
    grappleReboundDistance: 40, // 1080p 기준 2배
    grappleMomentumBoost: 1.2,
    grappleCameraZoom: 0.95,
    // 스크롤 방식 설정
    playerFixedX: 672, // 플레이어 고정 X 위치 (1920 * 0.35)
    baseScrollSpeed: 10, // 기본 스크롤 속도 (1080p 기준 2배)
};

export const COLORS = {
    background: 0x000000,
    primary: 0xFFFFFF,
    rope: 0xFFFFFF,
    ui: 0xFFFFFF,
    accent: 0x888888
};


