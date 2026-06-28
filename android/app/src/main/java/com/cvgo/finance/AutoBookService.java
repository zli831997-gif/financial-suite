package com.cvgo.finance;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 通知监听自动记账 Service（仅安卓）。
 *
 * 监听微信/支付宝支付通知 → 解析 → 两条路投递：
 * 1. 实时：notifyBridge 推 JS（APP 在前台时立即记账）
 * 2. 持久化：写 SharedPreferences 队列（APP 被杀/未就绪时也能补）
 *    APP 前台时 AutoBookPlugin.fetchPendingNotifications() 拉取回放。
 *
 * 这样即使 APP 进程被系统杀掉、Service 重启时 Plugin 未就绪，
 * 通知也不会丢——下次 APP 前台会回放补记。
 *
 * 解析规则（基于公开示例，需真机验证微调）：
 *  - 微信 com.tencent.mm：标题/文本含"微信支付/收款"，金额 ¥XX.XX
 *  - 支付宝 com.eg.android.AlipayGphone：含"支付宝/付款/收款/成功"，金额 ¥XX.XX
 */
public class AutoBookService extends NotificationListenerService {

    private static final String PKG_WECHAT = "com.tencent.mm";
    private static final String PKG_ALIPAY = "com.eg.android.AlipayGphone";

    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("[¥￥]\\s*([\\d,]+\\.?\\d*)");

    /** 持久化队列的存储 key 与上限 */
    private static final String PREF_NAME = "autobook_queue";
    private static final String PREF_KEY_QUEUE = "queue";
    private static final String PREF_KEY_PROCESSED = "processed"; // 已推 JS 的 key（防重复回放）
    private static final int MAX_QUEUE = 100;

    // 内存级粗去重（同条通知多次 posted）
    private static final Set<String> RECENT_KEYS = new HashSet<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (!PKG_WECHAT.equals(pkg) && !PKG_ALIPAY.equals(pkg)) return;

            Notification n = sbn.getNotification();
            if (n == null) return;

            CharSequence titleCs = n.extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = n.extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextCs = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String title = titleCs == null ? "" : titleCs.toString();
            String text = textCs == null ? "" : textCs.toString();
            String bigText = bigTextCs == null ? "" : bigTextCs.toString();
            String fullText = (title + " " + text + " " + bigText).trim();

            String sourceApp = PKG_WECHAT.equals(pkg) ? "wechat" : "alipay";
            if (!isPaymentNotification(sourceApp, fullText)) return;

            Double amount = parseAmount(fullText);
            if (amount == null || amount <= 0) return;

            String type = isIncome(fullText) ? "income" : "expense";
            long postTime = sbn.getPostTime();
            String dedupeKey = pkg + "_" + postTime + "_" + amount + "_" + Math.abs(fullText.hashCode());

            synchronized (RECENT_KEYS) {
                if (RECENT_KEYS.contains(dedupeKey)) return;
                RECENT_KEYS.add(dedupeKey);
                if (RECENT_KEYS.size() > 200) {
                    RECENT_KEYS.clear();
                    RECENT_KEYS.add(dedupeKey);
                }
            }

            // 构造事件数据
            JSObject data = new JSObject();
            data.put("sourceApp", sourceApp);
            data.put("amount", amount);
            data.put("type", type);
            data.put("text", fullText);
            data.put("dedupeKey", dedupeKey);
            data.put("timestamp", postTime);

            // 1. 实时推 JS（前台立即生效；Plugin 未就绪时静默）
            notifyBridge("auto-book", data);

            // 2. 持久化到队列（无论 JS 是否收到，都存一份；APP 前台时回放）
            enqueueNotification(this, data);
        } catch (Exception e) {
            // 静默
        }
    }

    private boolean isPaymentNotification(String sourceApp, String text) {
        if (TextUtils.isEmpty(text)) return false;
        if ("wechat".equals(sourceApp)) {
            return text.contains("微信支付") || text.contains("收款")
                    || (text.contains("¥") && (text.contains("支付") || text.contains("到账")));
        } else {
            return (text.contains("支付") || text.contains("付款") || text.contains("收款"))
                    && text.contains("¥");
        }
    }

    private Double parseAmount(String text) {
        if (TextUtils.isEmpty(text)) return null;
        Matcher m = AMOUNT_PATTERN.matcher(text);
        if (!m.find()) return null;
        try {
            return Double.parseDouble(m.group(1).replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isIncome(String text) {
        return text.contains("收款") || text.contains("到账")
                || text.contains("转入") || text.contains("退款")
                || text.contains("返还") || text.contains("红包");
    }

    private void notifyBridge(String eventName, JSObject data) {
        AutoBookPlugin plugin = AutoBookPlugin.getInstance();
        if (plugin != null) {
            plugin.notifyFromService(eventName, data);
            // JS 已收到，标记为已处理（回放时跳过）
            markProcessed(this, data.getString("dedupeKey"));
        }
    }

    /* ─────────── 持久化队列（SharedPreferences）─────────── */

    /** 把解析好的通知存入队列（防丢）。 */
    static void enqueueNotification(Context ctx, JSObject data) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            Set<String> processed = getStringSet(sp, PREF_KEY_PROCESSED);
            String key = data.getString("dedupeKey");
            if (processed.contains(key)) return; // 已推过，不重复入队

            JSONArray queue = getQueue(sp);
            JSONObject item = new JSONObject();
            item.put("sourceApp", data.getString("sourceApp"));
            item.put("amount", data.optDouble("amount"));
            item.put("type", data.getString("type"));
            item.put("text", data.getString("text"));
            item.put("dedupeKey", key);
            item.put("timestamp", data.optLong("timestamp"));
            queue.put(item);
            // 截断到上限（丢最早的）
            while (queue.length() > MAX_QUEUE) {
                JSONArray na = new JSONArray();
                for (int i = 1; i < queue.length(); i++) na.put(queue.get(i));
                queue = na;
            }
            sp.edit().putString(PREF_KEY_QUEUE, queue.toString()).apply();
        } catch (JSONException e) {
            // 静默
        }
    }

    /** 标记某 dedupeKey 已推送给 JS（回放时跳过）。 */
    static void markProcessed(Context ctx, String dedupeKey) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            Set<String> processed = getStringSet(sp, PREF_KEY_PROCESSED);
            processed.add(dedupeKey);
            // 已处理列表上限（防膨胀）
            if (processed.size() > 500) {
                processed.clear();
                processed.add(dedupeKey);
            }
            putStringSet(sp.edit(), PREF_KEY_PROCESSED, processed).apply();
        } catch (Exception e) {
            // 静默
        }
    }

    /** 读取待回放的通知队列（APP 前台时 Plugin 调用）。 */
    static JSONArray fetchPending(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        return getQueue(sp);
    }

    /** 回放完成后清空队列（保留 processed 列表防重复）。 */
    static void clearQueue(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        sp.edit().putString(PREF_KEY_QUEUE, "[]").apply();
    }

    private static JSONArray getQueue(SharedPreferences sp) {
        try {
            return new JSONArray(sp.getString(PREF_KEY_QUEUE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static Set<String> getStringSet(SharedPreferences sp, String key) {
        Set<String> set = new HashSet<>();
        try {
            JSONArray arr = new JSONArray(sp.getString(key, "[]"));
            for (int i = 0; i < arr.length(); i++) set.add(arr.getString(i));
        } catch (JSONException e) {
            // 静默
        }
        return set;
    }

    private static SharedPreferences.Editor putStringSet(SharedPreferences.Editor ed, String key, Set<String> set) {
        try {
            JSONArray arr = new JSONArray();
            for (String s : set) arr.put(s);
            return ed.putString(key, arr.toString());
        } catch (Exception e) {
            return ed;
        }
    }
}
