import { getUserKeyForGame } from '@apps-in-toss/web-framework';
import { logger } from '../utils/logger';

/**
 * UserManager
 * 토스 게임 미니앱에서 사용자 식별 및 데이터 관리
 */
export class UserManager {
  private static instance: UserManager | null = null;
  private userKey: string | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  /**
   * 사용자 키 초기화
   * 앱 시작 시 한 번만 호출
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const result = await getUserKeyForGame();

      if (!result) {
        console.warn('⚠️ 지원하지 않는 토스 앱 버전입니다 (5.232.0 미만)');
        // fallback: 로컬 전용 모드
        this.userKey = 'local_user';
      } else if (result === 'INVALID_CATEGORY') {
        console.error('❌ 게임 카테고리가 아닌 미니앱입니다');
        this.userKey = 'local_user';
      } else if (result === 'ERROR') {
        console.error('❌ 사용자 키 조회 중 오류 발생');
        this.userKey = 'local_user';
      } else if (result.type === 'HASH') {
        this.userKey = result.hash;
        logger.log('✅ 사용자 인증 완료:', this.userKey.substring(0, 8) + '...');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('사용자 키 초기화 실패:', error);
      this.userKey = 'local_user'; // fallback
      this.isInitialized = true;
    }
  }

  /**
   * 현재 사용자 키 가져오기
   */
  public getUserKey(): string {
    if (!this.isInitialized) {
      console.warn('UserManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
      return 'local_user';
    }
    return this.userKey || 'local_user';
  }

  /**
   * 사용자별 localStorage 키 생성
   */
  private getStorageKey(key: string): string {
    return `${this.getUserKey()}_${key}`;
  }

  /**
   * 사용자별 데이터 저장
   */
  public saveData(key: string, value: string | number): void {
    try {
      const storageKey = this.getStorageKey(key);
      localStorage.setItem(storageKey, value.toString());
    } catch (error) {
      console.error(`데이터 저장 실패 (${key}):`, error);
    }
  }

  /**
   * 사용자별 데이터 불러오기
   */
  public loadData(key: string, defaultValue: string = ''): string {
    try {
      const storageKey = this.getStorageKey(key);
      return localStorage.getItem(storageKey) || defaultValue;
    } catch (error) {
      console.error(`데이터 불러오기 실패 (${key}):`, error);
      return defaultValue;
    }
  }

  /**
   * 사용자별 숫자 데이터 불러오기
   */
  public loadNumber(key: string, defaultValue: number = 0): number {
    try {
      const value = this.loadData(key);
      return value ? parseInt(value, 10) : defaultValue;
    } catch (error) {
      console.error(`숫자 데이터 불러오기 실패 (${key}):`, error);
      return defaultValue;
    }
  }

  /**
   * 사용자별 데이터 삭제
   */
  public removeData(key: string): void {
    try {
      const storageKey = this.getStorageKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`데이터 삭제 실패 (${key}):`, error);
    }
  }

  /**
   * 현재 사용자의 모든 데이터 삭제
   */
  public clearUserData(): void {
    try {
      const userPrefix = `${this.getUserKey()}_`;
      const keysToRemove: string[] = [];

      // localStorage에서 현재 사용자의 키만 찾기
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(userPrefix)) {
          keysToRemove.push(key);
        }
      }

      // 찾은 키들 삭제
      keysToRemove.forEach(key => localStorage.removeItem(key));
      logger.log(`사용자 데이터 ${keysToRemove.length}개 삭제 완료`);
    } catch (error) {
      console.error('사용자 데이터 삭제 실패:', error);
    }
  }

  /**
   * 초기화 상태 확인
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

// 싱글톤 인스턴스 export
export const userManager = UserManager.getInstance();
