export const GAME_CONFIG = {
    width: 800,
    height: 600,
    gravity: 15,
    ropeLength: 180,
    damping: 0.995,
    runSpeed: 3,
    runSpeedMax: 12,
    runSpeedIncreasePerDistance: 0.003, // 진행 거리 1000마다 속도 3 증가
    platformWidth: { min: 100, max: 150 },
    platformHeight: 15,
    platformSpacing: { min: 200, max: 300 },
    platformHeightVariation: 80,
    // 그래플링 후크 파라미터
    grappleShootSpeed: 2500,
    grappleMaxLength: 750,
    grappleBasePullSpeed: 2400, // 1200 -> 2400으로 증가
    grappleComboSpeedBonus: 150, // 콤보당 속도 증가량 (100 -> 150)
    grappleEasingFactor: 0.35, // 이징 팩터 (0.08 -> 0.35로 증가, 더 빠른 가속)
    grappleReboundDistance: 20, // 앵커 근처 리바운드 거리
    grappleMomentumBoost: 1.2, // 릴리즈 시 모멘텀 부스트
    grappleCameraZoom: 0.95, // 풀링 중 카메라 줌 (1.0 = 100%, 0.95 = 95% 줌인)
};

export const COLORS = {
    background: 0x000000,
    primary: 0xFFFFFF,
    rope: 0xFFFFFF,
    ui: 0xFFFFFF,
    accent: 0x888888
};


