package com.anaru.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge TTS only serves its WebSocket to a desktop-Chrome-like user
        // agent; the app needs it for word pronunciation when the device has
        // no Japanese TTS voice.
        getBridge()
                .getWebView()
                .getSettings()
                .setUserAgentString(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                                + " (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0");
    }
}
