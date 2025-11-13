/**
 * 플랫폼 감지 유틸리티
 * 토스 앱과 일반 안드로이드 앱을 구분
 */

/**
 * 현재 토스 앱에서 실행 중인지 확인
 */
export function isTossApp(): boolean {
  // 토스 앱에서만 사용 가능한 API가 있는지 확인
  if (typeof window !== 'undefined') {
    return !!(
      window.toss?.events?.onAudioFocusChanged ||
      window.onAudioFocusChanged ||
      window.TossWebBridge?.onAudioFocusChanged
    );
  }
  return false;
}

/**
 * 일반 안드로이드 앱에서 실행 중인지 확인
 */
export function isStandaloneAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  // Capacitor 환경 확인
  const isCapacitor = !!(window as any).Capacitor;
  const isAndroid = navigator.userAgent.toLowerCase().includes('android');

  return isCapacitor && isAndroid && !isTossApp();
}

/**
 * 리더보드 기능 사용 가능 여부
 */
export function isLeaderboardAvailable(): boolean {
  return isTossApp();
}

/**
 * 플랫폼 정보
 */
export function getPlatformInfo() {
  return {
    isToss: isTossApp(),
    isStandaloneAndroid: isStandaloneAndroid(),
    isLeaderboardAvailable: isLeaderboardAvailable(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
