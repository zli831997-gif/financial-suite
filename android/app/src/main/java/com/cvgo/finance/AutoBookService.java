package com.cvgo.finance;

import android.app.Notification;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 通知监听自动记账 Service（仅安卓）。
 *
 * 监听微信/支付宝的支付通知，解析金额+类型，通过 Capacitor 桥推送到 JS 层。
 * 小程序/H5 无此能力，功能自动失效。
 *
 * 解析规则（基于公开通知示例，需真机验证微调）：
 *  - 微信 com.tencent.mm：标题/文本含"微信支付/收款"，金额 ¥XX.XX
 *  - 支付宝 com.eg.android.AlipayGphone：含"支付宝/付款/收款/成功"，金额 ¥XX.XX
 *
 * 去重：native 侧记最近处理的 key（postTime+text 哈希），避免通知更新重复触发；
 *      JS 侧还有 fin_notif_log 跨重启幂等（见 records.addRecordFromNotification）。
 */
public class AutoBookService extends NotificationListenerService {

    // 微信、支付宝包名
    private static final String PKG_WECHAT = "com.tencent.mm";
    private static final String PKG_ALIPAY = "com.eg.android.AlipayGphone";

    // 金额正则：匹配 ¥12.50 / ￥1,234.00 / ¥ 35 等（去掉千分位逗号）
    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("[¥￥]\\s*([\\d,]+\\.?\\d*)");

    // 最近处理过的 dedupeKey（内存级，防同条通知的 posted 多次触发）
    private static final Set<String> RECENT_KEYS = new HashSet<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            // 只处理微信、支付宝
            if (!PKG_WECHAT.equals(pkg) && !PKG_ALIPAY.equals(pkg)) return;

            Notification n = sbn.getNotification();
            if (n == null) return;

            // 提取通知文本（title + text + extras）
            CharSequence titleCs = n.extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = n.extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextCs = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String title = titleCs == null ? "" : titleCs.toString();
            String text = textCs == null ? "" : textCs.toString();
            String bigText = bigTextCs == null ? "" : bigTextCs.toString();
            String fullText = (title + " " + text + " " + bigText).trim();

            // 通知必须是支付相关关键词
            String sourceApp = PKG_WECHAT.equals(pkg) ? "wechat" : "alipay";
            if (!isPaymentNotification(sourceApp, fullText)) return;

            // 解析金额
            Double amount = parseAmount(fullText);
            if (amount == null || amount <= 0) return;

            // 判断收支：含收款/到账/转入/退款 → 收入；含支付/付款/消费/支出 → 支出
            String type = isIncome(fullText) ? "income" : "expense";

            // 去重 key：packageName + postTime + 金额 + 文本哈希
            long postTime = sbn.getPostTime();
            String dedupeKey = pkg + "_" + postTime + "_" + amount + "_" + Math.abs(fullText.hashCode());

            // native 侧粗去重：同一 key 近期已处理则跳过
            synchronized (RECENT_KEYS) {
                if (RECENT_KEYS.contains(dedupeKey)) return;
                RECENT_KEYS.add(dedupeKey);
                // 防内存无限增长，超过 200 条清掉最早一半
                if (RECENT_KEYS.size() > 200) {
                    RECENT_KEYS.clear();
                    RECENT_KEYS.add(dedupeKey);
                }
            }

            // 推送到 JS 层
            JSObject data = new JSObject();
            data.put("sourceApp", sourceApp);
            data.put("amount", amount);
            data.put("type", type);
            data.put("text", fullText);
            data.put("dedupeKey", dedupeKey);
            data.put("timestamp", postTime);
            notifyBridge("auto-book", data);
        } catch (Exception e) {
            // 解析异常静默丢弃，不影响系统通知
        }
    }

    /** 判断是否为支付/收款相关通知（避免误抓聊天消息等）。 */
    private boolean isPaymentNotification(String sourceApp, String text) {
        if (TextUtils.isEmpty(text)) return false;
        if ("wechat".equals(sourceApp)) {
            return text.contains("微信支付") || text.contains("收款")
                    || (text.contains("¥") && (text.contains("支付") || text.contains("到账")));
        } else { // alipay
            return (text.contains("支付") || text.contains("付款") || text.contains("收款"))
                    && text.contains("¥");
        }
    }

    /** 从文本提取第一个金额。 */
    private Double parseAmount(String text) {
        if (TextUtils.isEmpty(text)) return null;
        Matcher m = AMOUNT_PATTERN.matcher(text);
        if (!m.find()) return null;
        try {
            // 去千分位逗号
            String numStr = m.group(1).replace(",", "");
            return Double.parseDouble(numStr);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 判断是收入类通知（收款/到账/转入/退款）。 */
    private boolean isIncome(String text) {
        return text.contains("收款") || text.contains("到账")
                || text.contains("转入") || text.contains("退款")
                || text.contains("返还") || text.contains("红包");
    }

    /**
     * 通过 Capacitor 桥推送事件到 JS 层。
     * 桥在 BridgeActivity 里，通过 ApplicationContext 找到 Plugin 实例。
     * Service 运行在独立进程，需借助 AutoBookPlugin 持有的 bridge 引用。
     */
    /**
     * 通过 AutoBookPlugin 把通知数据推送给 JS 层。
     * Bridge 类无 notifyAllListeners，推送能力在 Plugin 上（notifyListeners），
     * 故经 Plugin 单例转发。
     */
    private void notifyBridge(String eventName, JSObject data) {
        AutoBookPlugin plugin = AutoBookPlugin.getInstance();
        if (plugin != null) {
            plugin.notifyFromService(eventName, data);
        }
    }
}
