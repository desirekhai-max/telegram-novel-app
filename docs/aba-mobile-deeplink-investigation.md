# ABA Mobile Deep Link 调研报告

> 整理日期：2026-06-10  
> 状态：调研与 POC 完成，**尚未正式开发方案 B**  
> 关联 POC 页：`/poc/aba-mobile-intent`  
> 关联代码：`src/lib/abaMobile.js`、`src/lib/abaMobileIntentPoc.js`（POC 专用）

---

## 1. 当前问题背景

本项目为 Telegram Mini App，VIP 支付使用 PayWay `generate-qr`（`payment_option: abapay_khqr`）。用户点击 **ABA Pay** 后的期望体验（方案 B）：

1. **优先**尝试打开 ABA Mobile App 完成支付  
2. 若成功唤醒 ABA，用户在 ABA 内确认支付  
3. 若无法唤醒 ABA，**自动回退**到现有 KHQR 二维码页  
4. 二维码流程作为完整兜底，支持 ABA Mobile 及其他 KHQR 银行 App 扫码  
5. **不影响**现有 `confirm-payment`、VIP 开通、订单逻辑  

### 已遇到的现象

- 在 Telegram Mini App 内使用 `tg.openLink(abapayDeeplink)` 或 `window.location.href = abamobilebank://...` 时，曾出现 **`ERR_UNKNOWN_URL_SCHEME`**  
- 从银行 App 返回 Telegram 时，KHQR 页存在闪屏问题（已通过 boot 预绘层等手段缓解，与 deeplink 调研并行进行）  
- `src/lib/abaMobile.js` 已实现 deeplink helper，但**未接入**正式 VIP UI  

### 调研目标

- 确认 PayWay 官方对 deeplink / QR 的规范  
- 确认 Telegram Mini App 内可行的打开方式  
- 通过 Android 真机 POC 验证 Intent URL、`openLink`、`location.href`  
- 为方案 B 正式开发提供依据  

---

## 2. PayWay 返回字段分析

接口：`POST /api/payment-gateway/v1/payments/generate-qr`（`payment_option: abapay_khqr`）

本项目封装：`server/payway.js` → `generateAbaKhqrPayment()` → `POST /api/vip-orders/aba-khqr`

### 2.1 成功响应关键字段（Sandbox 实测）

| 字段 | 说明 | 示例（敏感部分已缩写） |
|------|------|------------------------|
| `qrString` | KHQR EMV 原始字符串，可本地生成高清 QR | `00020101021230510016abaakhppxxx@abaa...6304AF97` |
| `qrImage` | Base64 PNG，PayWay 模板图（含金额/商户） | `data:image/png;base64,...` |
| `abapayDeeplink` | ABA Mobile 深链，用于自动打开 ABA 完成支付 | `abamobilebank://ababank.com?type=payway&qrcode=...` |
| `app_store` | 未安装 ABA 时跳转 iOS App Store | `https://itunes.apple.com/.../id968860649` |
| `play_store` | 未安装 ABA 时跳转 Google Play | `https://play.google.com/store/apps/details?id=com.paygo24.ibank` |

### 2.2 官方文档要点

来源：[QR API](https://developer.payway.com.kh/qr-api-14530840e0)、[ABA QR API](https://developer.payway.com.kh/aba-qr-api-3158158f0)、[Credentials on File](https://developer.payway.com.kh/credentials-on-file-3158155f0)

| 要点 | 内容 |
|------|------|
| `abapay_deeplink` | 用于 **automatically open ABA Mobile**，供用户在 App 内确认支付 |
| `qrString` / `qrImage` | 必须提供 QR 展示 UI；桌面端以扫码为主 |
| 未安装 fallback | 官方字段说明：打开 deeplink 失败时可跳转 `play_store` / `app_store` |
| Android WebView | CoF 文档示例使用 **Intent URL** + `window.location`，而非裸 `abamobilebank://` |
| iOS | 直接使用 API 返回的 `deeplink`（`abamobilebank://...`） |
| 原生 Android App | 使用 `Intent(ACTION_VIEW, Uri.parse("abamobilebank://..."))`，异常时跳 Play Store |

### 2.3 官方并未严格要求的 UX

- **并非**「未安装 ABA → 只显示 QR、不跳商店」的硬性规定；官方写的是应用商店链接  
- **并非**页面加载时自动 deeplink；需在合适时机（通常为用户点击后）调用  
- API **同时返回** QR 与 deeplink，商户自行决定 UI 流程  

### 2.4 本项目数据流（已具备）

```
VipPage → POST /api/vip-orders/aba-khqr
       → session 保存 qrImage / qrString / abapayDeeplink / appStore / playStore
       → VipAbaKhqrPage 展示 QR（当前 100% 走二维码路径）
```

---

## 3. Telegram Mini App 限制分析

来源：[Telegram Bot API — WebApp](https://core.telegram.org/bots/webapps)、本项目 `src/lib/telegramWebApp.js`

| 能力 | 行为 |
|------|------|
| `tg.openLink(url)` | 设计用于在**外部浏览器**打开 **http/https**；须在用户手势后调用 |
| `tg.openTelegramLink(url)` | 仅用于 `https://t.me/...` |
| WebView 内 `location.href` | 对 `mailto:`、`abamobilebank://` 等自定义 scheme 可能报 **`ERR_UNKNOWN_URL_SCHEME`** |
| 自定义 scheme | 社区长期反馈：`whatsapp://`、`abamobilebank://` 等在 `openLink` / `href` 下行为不一致 |

本项目对邮件链接的既有结论：**Telegram 内禁止 WebView 裸跳 `mailto:`，须用 `openLink`**——说明团队已知 WebView 对非 http(s) scheme 的处理限制。

**Telegram 文档未覆盖** `intent://` 与 `abamobilebank://` 在 Mini App 内的行为，需以真机 POC 为准。

---

## 4. Android 真机测试环境

| 项 | 说明 |
|----|------|
| 平台 | Android |
| 容器 | Telegram Mini App（WebView） |
| 设备要求 | 已安装 ABA Mobile（`com.paygo24.ibank`） |
| POC 页 | `/poc/aba-mobile-intent` |
| 公网入口 | `https://tribunal-basis-following-wayne.trycloudflare.com/poc/aba-mobile-intent`（cloudflared，重启会变） |
| 样本数据 | `GET /api/poc/aba-khqr-sample`（Sandbox，不写 VIP 订单） |

### Intent URL 构造（PayWay Android WebView 格式）

```
intent://ababank.com?type=payway&qrcode=<URL 编码后的 qrString>#Intent;scheme=abamobilebank;end;
```

Sandbox 实测示例（`tranId=V99900181063838818`，内容已缩写）：

```
intent://ababank.com?type=payway&qrcode=00020101021230510016abaakhppxxx%40abaa…630490C0#Intent;scheme=abamobilebank;end;
```

对照 `abapayDeeplink`：

```
abamobilebank://ababank.com?type=payway&qrcode=00020101021230510016abaakhppxxx%40abaa…630490C0
```

---

## 5. `tg.openLink(Intent URL)` 测试结果

| 项 | 结果 |
|----|------|
| 调用方式 | 用户点击 POC 按钮「1. tg.openLink(Intent URL) — 主测」 |
| **真机结果** | **无任何反应** |
| `openLink` 返回值 | 调用未抛错，但 ABA Mobile 未被唤起 |
| 结论 | **不可作为 Android Telegram 打开 ABA 的主路径** |

---

## 6. `tg.openLink(abapayDeeplink)` 测试结果

| 项 | 结果 |
|----|------|
| 调用方式 | 用户点击 POC 按钮「2. tg.openLink(abapayDeeplink) — 对照」 |
| URL 形式 | `abamobilebank://ababank.com?type=payway&qrcode=...` |
| **真机结果** | **无任何反应** |
| 结论 | 与 Intent URL 相同，`openLink` 对自定义 scheme **无效**；`abaMobile.js` 中优先 `openLink` 的策略在 TG Android 上**不可用** |

---

## 7. `location.href(Intent URL)` 测试结果

| 项 | 结果 |
|----|------|
| 调用方式 | 用户点击 POC 按钮「3. location.href(Intent) — ERR 对照」 |
| **真机结果** | **有反应**；Android 能识别 Intent 并**尝试打开 ABA** |
| `ERR_UNKNOWN_URL_SCHEME` | 使用 Intent URL 时**未报告**此错误（与裸 `abamobilebank://` 不同） |
| 待进一步确认 | ① 是否**直接进入** ABA 支付页，还是仅弹出系统「打开方式」选择器；② Event log 中 `visibility → hidden` 是否在唤起时触发 |
| 结论 | **当前唯一在 Android TG 内验证有效的唤起方式** |

### 可选优化（尚未 POC）

在 Intent fragment 中增加 `package=com.paygo24.ibank`，降低出现系统选择器的概率：

```
#Intent;scheme=abamobilebank;package=com.paygo24.ibank;end;
```

---

## 8. `ERR_UNKNOWN_URL_SCHEME` 原因分析

### 定义

Telegram（或 Chrome）WebView 试图在 **WebView 内部**加载其无法识别的 URL scheme，且未将请求交给 Android 系统 Intent 解析器时触发。

### 常见触发场景

1. `window.location.href = 'abamobilebank://...'`（裸自定义 scheme）  
2. `<a href="abamobilebank://...">` 在 WebView 内默认导航  
3. 同类：`mailto:`、`googlegmail://`（本项目 `telegramWebApp.js` 已文档化）

### 为何 Intent URL 可能避免该错误

`intent://...` 是 Android 专用包装格式，WebView 的 URL 拦截逻辑可将其转交 `Intent.parseUri()`，由系统选择/启动目标 App，而不是在 WebView 内加载页面。

### 与 POC 的关系

| 方式 | ERR_UNKNOWN_URL_SCHEME |
|------|------------------------|
| `tg.openLink(abapayDeeplink)` | 无反应，未必报 ERR |
| `location.href(abamobilebank://)` | 高概率报错（历史现象；本次 POC 主测为 Intent） |
| `location.href(intent://...)` | **本次真机未报告 ERR** |

---

## 9. 方案对比

### 方案 A：纯二维码（当前生产路径）

```
用户选套餐 → 生成 KHQR → 进入 /vip/aba-khqr → 扫码支付 → 轮询 confirm-payment → 成功页
```

| 优点 | 缺点 |
|------|------|
| 已上线、最稳定 | 已装 ABA 的用户多一步扫码 |
| 兼容所有 KHQR 银行 App | 未利用 PayWay 提供的 deeplink |
| 无 WebView scheme 风险 | |
| 不受 TG 版本影响 | |

### 方案 B：ABA 优先 + QR 兜底（已确认采用，待开发）

```
用户点 ABA Pay
    ↓
尝试唤起 ABA Mobile（Android：location.href(Intent URL)）
    ↓
┌─ 成功（visibility hidden）→ 用户在 ABA 支付 → 返回 TG → 轮询 → 2 秒后成功页
└─ 失败（2s 内仍 visible / 未安装）→ 自动展示现有 KHQR 二维码页 → 扫码兜底
```

| 优点 | 缺点 |
|------|------|
| 已装 ABA 用户体验更短 | 依赖 TG WebView 非公开行为 |
| 失败自动落 QR，不丢单 | 需处理 2s 超时误判 |
| 不改后端订单逻辑 | iOS 路径尚未真机验证 |
| 符合 PayWay「移动端正用 deeplink」方向 | `openLink` 在 Android 已证伪，不能作备选 |

### 方案 C：`tg.openLink` 为主（已否定）

POC 证明 Android Telegram 上对 Intent URL 与 `abapayDeeplink` 均无反应，**不采用**。

### 方案 D：页面加载自动 deeplink（已否定）

- 违反 Telegram 用户手势要求  
- 破坏从银行返回时的 QR 页体验  
- 失败难以检测  

---

## 10. 当前项目代码现状

| 模块 | 状态 |
|------|------|
| `server/payway.js` | ✅ 解析并返回 `abapayDeeplink` |
| `server/presence-server.js` | ✅ 透传至前端 session |
| `src/lib/vipAbaKhqrSession.js` | ✅ 持久化 deeplink 与商店链接 |
| `src/lib/abaMobile.js` | ⚠️ 存在但未接入 UI；优先 `openLink` 策略与 POC 结论冲突 |
| `src/pages/VipAbaKhqrPage.jsx` | ✅ QR 页 + 轮询；无 deeplink 入口 |
| `src/lib/abaMobileIntentPoc.js` | ✅ POC 专用（Intent 构造、visibility 探测） |
| `src/pages/AbaMobileIntentPocPage.jsx` | ✅ POC 页 |
| `GET /api/poc/aba-khqr-sample` | ✅ Sandbox 样本（默认启用，`ENABLE_ABA_INTENT_POC=0` 可关闭） |

---

## 11. 推荐方案

**采用方案 B，且 Android Telegram 主路径限定为：**

```text
用户点击 ABA Pay
  → window.location.href = buildPayWayAndroidIntentUrl(qrString)
  → 监听 visibilitychange：hidden 即视为唤起成功
  → 若 2~3 秒内仍 visible → 自动 navigate 至现有 /vip/aba-khqr（session 已存在，同一 tranId）
  → 全程保持 confirm-payment 轮询逻辑不变
```

### 平台分流（正式开发时）

| 平台 | 唤起方式 | 备注 |
|------|----------|------|
| Android Telegram | `location.href(Intent URL)` | POC 已验证 |
| iOS Telegram | 待 POC：`location.href(abapayDeeplink)` | 不可用 Android Intent |
| Desktop | 仅 QR | 符合 PayWay 桌面规范 |

### 不建议

- ❌ `tg.openLink` 打开 `intent://` 或 `abamobilebank://`  
- ❌ WebView 内裸跳 `abamobilebank://`  
- ❌ 去掉 QR 页或自动 deeplink 无用户点击  
- ❌ deeplink 失败跳空白页或离开支付流程  

---

## 12. 风险评估

| 风险 | 等级 | 说明 | 缓解 |
|------|------|------|------|
| `openLink` 无效 | 已发生 | Android POC 已确认 | 正式方案不使用 `openLink` 唤起 ABA |
| TG 未来禁用 `intent://` | 中 | 非 Bot API 保证行为 | 保留 QR 兜底；关注 TG 更新 |
| 2s 超时假阴性 | 高 | ABA 冷启动慢 → 误展示 QR | 延长至 2.5~3s；`hidden` 立即取消计时 |
| 2s 超时假阳性 | 低 | 少见 | 以 `hidden` + 轮询支付状态为准 |
| 系统选择器非直达 | 中 | 未加 `package=` 时可能弹窗 | Intent 增加 `package=com.paygo24.ibank` 再 POC |
| WebView 闪屏/错误页 | 中 | `location.href` 副作用 | 复用现有 KHQR boot handoff |
| iOS 未验证 | 高 | 方案 B 不能全平台同逻辑 | iOS 单独 POC 后再上线 |
| 订单一致性 | 低 | 同一 tranId 先 Intent 后 QR | PayWay QR 仍有效，confirm-payment 不变 |

---

## 13. 下一步开发计划

### 阶段 0：POC 收尾（开发前）

- [ ] 确认按钮 3 后是否进入 **ABA 支付确认页**（非仅选择器）  
- [ ] 确认 Event log 中 `visibility → hidden` / `→ visible` 计数  
- [ ] 可选：Intent 增加 `package=com.paygo24.ibank` 后再测  
- [ ] **iOS Telegram POC**（`location.href(abapayDeeplink)`）  

### 阶段 1：方案 B 正式实现（POC 门槛通过后）

1. 扩展 `abaMobile.js`：Intent URL 构造、平台分流、`location.href` 唤起、visibility 超时检测  
2. `VipPage` / 支付入口：用户点 ABA Pay 后先尝试 Intent，失败自动进 `/vip/aba-khqr`  
3. 复用 `vipAbaKhqrSession` 与 boot handoff，避免失败回退时闪屏  
4. **不修改** `confirm-payment`、订单 store、VIP 履约逻辑  

### 阶段 2：真机回归

- Android TG + 已装 ABA：一键进 ABA → 支付 → 回 TG → 2 秒进成功页  
- Android TG + 未装 ABA：2~3 秒内自动落 QR 页  
- 其他银行 App 扫 QR：路径不受影响  
- iOS TG：待阶段 0 完成后执行  

### 阶段 3：清理

- 评估是否保留 `/poc/aba-mobile-intent`（建议生产环境用 `ENABLE_ABA_INTENT_POC=0` 关闭样本 API）  
- 更新 `abaMobile.js` 移除无效的 `openLink` 优先策略（Android）  

---

## 附录 A：POC 真机结果摘要

| 测试项 | 结果 |
|--------|------|
| `tg.openLink(Intent URL)` | ❌ 无反应 |
| `tg.openLink(abapayDeeplink)` | ❌ 无反应 |
| `location.href(Intent URL)` | ✅ 有反应，Android 识别并尝试打开 ABA |

## 附录 B：参考链接

- [PayWay QR API](https://developer.payway.com.kh/qr-api-14530840e0)  
- [PayWay ABA QR API 集成指南](https://developer.payway.com.kh/aba-qr-api-3158158f0)  
- [PayWay Credentials on File（Intent URL 示例）](https://developer.payway.com.kh/credentials-on-file-3158155f0)  
- [Telegram Mini Apps — WebApp](https://core.telegram.org/bots/webapps)  
- [PayWay v2 Sandbox PDF](https://checkout-sandbox.payway.com.kh/plugins/payway-v2-sandbox.pdf)  

## 附录 C：相关文件索引

| 文件 | 说明 |
|------|------|
| `docs/aba-mobile-deeplink-investigation.md` | 本文档 |
| `docs/aba-sandbox-phase1-implementation-plan.md` | Sandbox 阶段计划 |
| `src/lib/abaMobile.js` | Deeplink helper（未接入） |
| `src/lib/abaMobileIntentPoc.js` | POC 工具 |
| `src/pages/AbaMobileIntentPocPage.jsx` | POC 页面 |
| `scripts/aba-intent-poc-sample.mjs` | 命令行生成 Intent URL 样本 |
| `server/payway.js` | `generateAbaKhqrPayment()` |
| `src/lib/telegramWebApp.js` | TG WebView / `openLink` 说明 |
