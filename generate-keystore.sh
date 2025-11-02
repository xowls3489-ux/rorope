#!/bin/bash

# 바밧줄 앱 키스토어 생성 스크립트
# 실행 전 Java JDK 17+ 설치 필요: brew install openjdk@17

echo "🔑 키스토어 생성 중..."

keytool -genkey -v \
  -keystore rorope_key.keystore \
  -alias rorope_key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass gudwls0203 \
  -keypass gudwls0203 \
  -dname "CN=Retrying, OU=Development, O=Retrying, L=Seoul, ST=Seoul, C=KR"

if [ $? -eq 0 ]; then
    echo "✅ 키스토어 생성 완료: rorope_key.keystore"
    echo ""
    echo "🔐 Base64 인코딩 중..."
    
    # Base64 인코딩 (줄바꿈 없이)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        base64 -i rorope_key.keystore -o rorope_key.keystore.base64
    else
        # Linux
        base64 -w 0 rorope_key.keystore > rorope_key.keystore.base64
    fi
    
    echo "✅ Base64 인코딩 완료: rorope_key.keystore.base64"
    echo ""
    echo "📋 GitHub Secrets에 추가할 내용:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "KEYSTORE_FILE:"
    cat rorope_key.keystore.base64
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "KEY_ALIAS: rorope_key"
    echo "KEY_PASSWORD: gudwls0203"
    echo "KEYSTORE_PASSWORD: gudwls0203"
    echo ""
    echo "⚠️  보안 주의:"
    echo "- rorope_key.keystore 파일은 안전한 곳에 백업하세요!"
    echo "- 절대 Git에 커밋하지 마세요!"
    echo "- 분실 시 앱 업데이트 불가능합니다!"
else
    echo "❌ 키스토어 생성 실패"
    echo "Java JDK가 설치되어 있는지 확인하세요:"
    echo "  brew install openjdk@17"
    exit 1
fi

