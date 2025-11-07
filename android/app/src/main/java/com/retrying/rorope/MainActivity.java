package com.retrying.rorope;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // WebView 미디어 자동 재생 허용 (네이티브 앱)
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings webSettings = this.bridge.getWebView().getSettings();
            webSettings.setMediaPlaybackRequiresUserGesture(false); // 자동 재생 허용
            webSettings.setJavaScriptEnabled(true);
            webSettings.setDomStorageEnabled(true);
        }
    }
}
