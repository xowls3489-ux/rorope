# GitHub Secrets 설정 가이드

## 📋 설정해야 할 Secrets

GitHub 저장소에 다음 4개의 Secrets를 추가해야 합니다:

### 1. KEYSTORE_FILE
- **값**: `rorope_key_base64.txt` 파일의 전체 내용
- **설명**: Base64로 인코딩된 키스토어 파일

### 2. KEY_ALIAS
- **값**: `rorope_key`
- **설명**: 키스토어 별칭

### 3. KEY_PASSWORD
- **값**: `gudwls0203`
- **설명**: 키 비밀번호

### 4. KEYSTORE_PASSWORD
- **값**: `gudwls0203`
- **설명**: 키스토어 비밀번호

## 🔧 GitHub Secrets 추가 방법

### 1단계: GitHub 저장소로 이동
```
https://github.com/xowls3489-ux/rorope
```

### 2단계: Settings → Secrets and variables → Actions

1. **Settings** 탭 클릭
2. 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭
3. **New repository secret** 버튼 클릭

### 3단계: Secrets 추가

각 Secret마다:

#### KEYSTORE_FILE 추가:
1. Name: `KEYSTORE_FILE`
2. Secret: `rorope_key_base64.txt` 파일 전체 내용 복사/붙여넣기
3. **Add secret** 클릭

#### KEY_ALIAS 추가:
1. Name: `KEY_ALIAS`
2. Secret: `rorope_key`
3. **Add secret** 클릭

#### KEY_PASSWORD 추가:
1. Name: `KEY_PASSWORD`
2. Secret: `gudwls0203`
3. **Add secret** 클릭

#### KEYSTORE_PASSWORD 추가:
1. Name: `KEYSTORE_PASSWORD`
2. Secret: `gudwls0203`
3. **Add secret** 클릭

## ✅ 확인

모든 Secrets가 추가되면 다음과 같이 표시됩니다:
- ✓ KEYSTORE_FILE
- ✓ KEY_ALIAS
- ✓ KEY_PASSWORD
- ✓ KEYSTORE_PASSWORD

## 🚀 GitHub Actions로 빌드

Secrets 설정 완료 후:

1. **Actions** 탭으로 이동
2. **Android Build** 워크플로우 선택
3. **Run workflow** 버튼 클릭
4. 빌드 완료 후 **Artifacts**에서 `app-release` 다운로드

## ⚠️ 중요 사항

- **rorope_key.keystore** 파일은 안전한 곳에 백업하세요!
- 이 파일을 분실하면 앱 업데이트가 불가능합니다!
- 절대 Git에 커밋하지 마세요! (`.gitignore`에 이미 추가됨)
- 키스토어 비밀번호를 절대 공개하지 마세요!

## 📝 Base64 내용 확인

`rorope_key_base64.txt` 파일을 텍스트 에디터로 열어서 전체 내용을 복사하세요.

```bash
cat rorope_key_base64.txt | pbcopy  # macOS: 클립보드에 복사
```

