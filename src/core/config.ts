// 화면 크기를 동적으로 계산
const getGameDimensions = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return { width, height };
};

export const GAME_CONFIG = {
    // 화면 설정
    get width() { return getGameDimensions().width; },
    get height() { return getGameDimensions().height; },
    
    // 물리 상수
    gravity: 15,
    maxSpeedX: 18, // 최대 수평 속도
    maxSpeedY: 80, // 최대 수직 속도
    damping: 0.995,
    
    // 로프 설정
    ropeLength: 180,
    
    // 주행 속도 설정
    runSpeed: 3,
    runSpeedMax: 12,
    runSpeedIncreasePerDistance: 0.003,
    
    // 플랫폼 설정
    platformWidth: { min: 100, max: 150 },
    platformHeight: 15,
    platformSpacing: { min: 200, max: 300 },
    platformHeightVariation: 80,
    platformPoolSize: 30, // 플랫폼 풀 크기
    
    // 그래플링 후크 파라미터
    grappleShootSpeed: 2500,
    grappleMaxLength: 750,
    grappleBasePullSpeed: 2400,
    grappleComboSpeedBonus: 150, // 콤보당 속도 부스트
    grappleEasingFactor: 0.35,
    grappleReboundDistance: 20,
    grappleMomentumBoost: 1.2,
    grappleCameraZoom: 0.95,
    
    // 카메라 설정
    baseCameraZoom: 0.85, // 기본 줌 레벨
    cameraDeadZoneY: 120, // Y축 데드존 (작을수록 빠르게 반응)
    cameraSpeedY: 0.25, // Y축 추적 속도 (클수록 빠름)
    
    // 스크롤 방식 설정
    get playerFixedX() { return Math.min(280, this.width * 0.35); },
    baseScrollSpeed: 5,
    
    // 배경 설정
    bgSpeed: 0.4, // 배경 스크롤 속도
    bgTileWidth: 800, // 배경 타일 너비
    
    // 슬로우 모션 설정
    slowMotionScale: 0.4,
    slowMotionDuration: 2000,
    slowMotionComboThreshold: 10,
    slowMotionDangerDistance: 100,
    
    // 무적 모드 설정
    invincibleDuration: 3000,
    invincibleSpeed: 15,
    invincibleTargetY: 0.5,
    starSpawnChance: 0.05,
    starMinDistance: 8000,
    
    // 게임오버 존 설정 (화면 밖으로 얼마나 나갈 수 있는지)
    gameOverBoundaryTop: -300, // 위쪽 (음수: 화면 위로 300px까지 허용)
    gameOverBoundaryBottom: 250, // 아래쪽 (양수: 화면 아래로 250px까지 허용) - 모바일 대응 ↑
    gameOverBoundaryLeft: -150, // 왼쪽 (음수: 화면 왼쪽으로 150px까지 허용)
    gameOverAbsoluteTop: -800, // 절대 Y 좌표 상한 (위로 너무 튕기지 않도록)
    gameOverAbsoluteBottom: 2500, // 절대 Y 좌표 하한 (아래로 떨어지는 것) - 여유 ↑
};

export const COLORS = {
    background: 0x000000,
    primary: 0xFFFFFF,
    rope: 0xFFFFFF,
    ui: 0xFFFFFF,
    accent: 0x888888
};


