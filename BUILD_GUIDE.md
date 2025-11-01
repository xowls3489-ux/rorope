# 바밧줄 - Android 빌드 가이드

## 📱 로컬에서 AAB 빌드하기

### 1. 사전 요구사항
- Node.js 20+
- Java JDK 17+
- Android Studio (선택사항)

### 2. 빌드 단계

```bash
# 의존성 설치
npm install

# 웹 앱 빌드 + Capacitor 동기화
npm run cap:sync

# Android AAB 빌드
npm run android:build
```

### 3. AAB 파일 위치
빌드 완료 후 AAB 파일은 다음 경로에 생성됩니다:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## 🤖 GitHub Actions로 자동 빌드

### 1. 자동 빌드 트리거
- `main` 브랜치에 push
- `v*` 태그 생성 (예: `v1.0.0`)
- 수동 실행 (Actions 탭에서)

### 2. AAB 다운로드
1. GitHub 저장소 → Actions 탭
2. 최신 워크플로우 실행 선택
3. Artifacts에서 `app-release` 다운로드

## 📝 Google Play 업로드 전 체크리스트

### 서명 키 생성 (최초 1회)
```bash
# 키스토어 생성
keytool -genkey -v -keystore my-release-key.keystore \
  -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# 키스토어 경로 설정
# android/app/build.gradle에 서명 설정 추가 필요
```

### 버전 관리
`android/app/build.gradle` 파일에서:
```gradle
versionCode 1    // 매 업데이트마다 +1
versionName "1.0.0"
```

## 🚀 빠른 시작

```bash
# 1. 웹 개발 서버 실행
npm run dev

# 2. Android 빌드 (로컬)
npm run android:build

# 3. Android 에뮬레이터/기기에서 테스트
npm run cap:sync
npm run cap:open
# Android Studio에서 Run 클릭
```

## 📌 참고사항

- AAB 파일은 Google Play Console에서만 사용 가능
- 직접 설치하려면 APK 빌드 필요: `./gradlew assembleRelease`
- 서명되지 않은 AAB는 Google Play에서 거부됨 (서명 키 필요)

## 🔒 서명 설정 (프로덕션)

`android/app/build.gradle`에 추가:
```gradle
android {
    signingConfigs {
        release {
            storeFile file('my-release-key.keystore')
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

GitHub Secrets에 추가:
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `KEYSTORE_FILE` (Base64 인코딩)

