/**
 * 환경에 따라 로깅을 제어하는 유틸리티
 */

const isDevelopment = (import.meta as any).env?.DEV ?? false;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn(...args);
  },

  error: (...args: any[]) => {
    console.error(...args);
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};
