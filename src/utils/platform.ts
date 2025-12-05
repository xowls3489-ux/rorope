/**
 * 플랫폼 감지 유틸리티
 * 토스 앱과 일반 안드로이드 앱을 구분
 */

/**
 * 현재 토스 앱에서 실행 중인지 확인
 */
export function isTossApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 방법 1: Toss WebBridge API 존재 확인
  if (window.toss || window.TossWebBridge || window.onAudioFocusChanged) {
    console.log('✅ 토스 앱 감지됨 (WebBridge API)');
    return true;
  }

  // 방법 2: User Agent에서 토스 앱 확인
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('toss') || ua.includes('tossinapp')) {
    console.log('✅ 토스 앱 감지됨 (User Agent)');
    return true;
  }

  // 방법 3: @apps-in-toss/web-framework가 있으면 토스 환경으로 간주
  try {
    // 토스 프레임워크에서 제공하는 함수들이 정상 작동하는지 확인
    const hasFramework = typeof (window as any).__TOSS_WEB_FRAMEWORK__ !== 'undefined';
    if (hasFramework) {
      console.log('✅ 토스 앱 감지됨 (Framework)');
      return true;
    }
  } catch (e) {
    // ignore
  }

  console.log('❌ 토스 앱 아님');
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
 * iOS 플랫폼인지 확인
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

/**
 * 플랫폼 정보
 */
export function getPlatformInfo() {
  return {
    isToss: isTossApp(),
    isStandaloneAndroid: isStandaloneAndroid(),
    isLeaderboardAvailable: isLeaderboardAvailable(),
    isIOS: isIOS(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
