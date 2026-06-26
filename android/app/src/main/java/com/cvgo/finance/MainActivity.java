package com.cvgo.finance;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册自动记账插件（通知监听，仅安卓）
        registerPlugin(AutoBookPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
