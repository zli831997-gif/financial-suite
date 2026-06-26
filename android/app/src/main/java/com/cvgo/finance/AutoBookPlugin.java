package com.cvgo.finance;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 自动记账 Capacitor 插件（仅安卓）。
 *
 * 暴露给 JS：
 *  - checkPermission()  → 查询是否已授予通知使用权
 *  - openPermissionSettings() → 跳转系统「通知使用权」设置页
 *  - 事件 auto-book → AutoBookService 解析到支付通知时推送
 *
 * 同时作为 Service ↔ JS 桥：AutoBookService 通过 getInstance() 拿到桥引用，
 * 用 notifyAllListeners 把通知数据推给前端。
 */
@CapacitorPlugin(name = "AutoBook")
public class AutoBookPlugin extends Plugin {

    // 单例：Service（独立 Service 实例）需要拿到 Plugin 持有的 bridge
    private static AutoBookPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    /** Service 侧调用：取当前插件实例（含 bridge）。 */
    public static AutoBookPlugin getInstance() {
        return instance;
    }

    public com.getcapacitor.Bridge getBridgePublic() {
        return getBridge();
    }

    /**
     * 查询本 app 是否已获得通知监听权限。
     * resolve({ enabled: boolean })
     */
    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean enabled = isNotificationListenerEnabled(getContext());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /**
     * 跳转系统「通知使用权」设置页，引导用户授权。
     */
    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开通知使用权设置: " + e.getMessage());
        }
    }

    /** 当前包是否在系统的通知监听授权列表里。 */
    private boolean isNotificationListenerEnabled(Context context) {
        try {
            String flat = android.provider.Settings.Secure.getString(
                    context.getContentResolver(),
                    "enabled_notification_listeners");
            if (flat == null || flat.isEmpty()) return false;
            return flat.contains(context.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }
}
