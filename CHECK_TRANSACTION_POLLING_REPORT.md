# Check Transaction API 轮询问题 — 完整报告

> 范围：仅 PayWay Check Transaction polling。未改 VIP 页、QR 页、deeplink、导航、Header、支付 UI。未 Push / 未 Deploy。

---

## 结论更新：基于 PayWay 后台真实时间戳

本次判断不使用模拟测试结果，按 PayWay 后台截图时间轴分析。

### PayWay 截图时间轴

```
14:30:44.5380

14:31:47.6130
14:31:47.6130
14:31:47.6140   ← 同秒三次

14:31:51.6180
14:31:52.6190   ← 约 1 秒后额外请求

14:31:56.6210
14:31:56.6220   ← 约 0.001 秒重复

14:31:59.6240
14:32:00.6260   ← 约 1 秒后额外请求
```

### 每个请求来源解释

| PayWay 时间 | 判断来源 | 原因 |
|-------------|----------|------|
| `14:31:47.6130` | `useVipAbaKhqrBankReturn` ABA 返回确认 | ABA App 回 Telegram 后 hook 立即确认 |
| `14:31:47.6130` | `useVipAbaKhqrPaymentConfirm` 首次 `pollOnce()` | VIP/QR 确认 hook 挂载后立即确认 |
| `14:31:47.6140` | `VipPage.jsx` visibility 单次探测 | `visibilitychange` 回前台时直接调用 `confirmViewerVipPayment()`，绕过 coordinator |
| `14:31:51.6180` | 第一条 4 秒轮询链 | 从 `14:31:47.6130` 起算约 4 秒 |
| `14:31:52.6190` | 第二条晚约 1 秒启动的轮询链 | ABA 返回/页面状态切换后重复启动或重新挂载的轮询实例 |
| `14:31:56.6210` | 轮询链 A 或 B 的下一次 | 独立计时器继续运行 |
| `14:31:56.6220` | 另一个同相位轮询实例 | 两个实例时间相差约 1ms，说明旧 polling 未统一收口 |
| `14:31:59.6240` | 轮询链 A 下一次 | 继续按自身节奏触发 |
| `14:32:00.6260` | 晚 1 秒轮询链下一次 | 继续复现 `+1s` 错位 |

### 确认的问题入口

| 问题 | 入口 |
|------|------|
| 同秒三次请求 | `useVipAbaKhqrBankReturn`、`useVipAbaKhqrPaymentConfirm`、`VipPage.jsx` visibility 单次探测同时触发 |
| 1 秒后额外请求 | ABA 返回后页面状态变化/重新挂载产生第二条轮询链 |
| 绕过 coordinator | `VipPage.jsx` L441 直接调用 `confirmViewerVipPayment()`；`PaymentReturnPage.jsx` 也直接调用但无轮询 |
| 重复启动 polling | 旧的 `setInterval` 与 `while + sleep(4000)` 是两套独立轮询 |
| ABA App 返回后新 polling | `useVipAbaKhqrBankReturn` 的返回处理会启动确认逻辑；修复后改为订阅同一个 coordinator |

### 最终防线

前端 coordinator 只能统一使用它的调用方，但截图证明还有直接 `confirmViewerVipPayment()` 入口。因此已在后端 `/api/vip-orders/confirm-payment` 内增加每个 `tran_id` 的 4 秒 gate：

```
confirmViewerVipPayment()
  ↓
/api/vip-orders/confirm-payment
  ↓
checkPayWayTransactionForConfirm(tranId)
  ↓
最多每 4 秒才允许一次真实 PayWay check-transaction-2
```

这样即使前端有同秒 3 次、1 秒后、3 秒后等重复请求，PayWay 后台也只会看到满足 4 秒 gate 的请求。

### 修复后真实 PayWay 日志验证

本地真实 API 压测按截图节奏发送：

```
A1/A2/A3: 同秒 3 次
B:        1 秒后 1 次
C1/C2:    3 秒后同秒 2 次
D:        3 秒后 1 次
E:        1 秒后 1 次
```

客户端请求日志：

```
Test TranId: V65487983105686120
A1_same_second client=2026-07-06T17:54:21.581Z status=402
A2_same_second client=2026-07-06T17:54:21.678Z status=402
A3_same_second client=2026-07-06T17:54:21.680Z status=402
B_plus_1s     client=2026-07-06T17:54:23.183Z status=402
C1_plus_4s    client=2026-07-06T17:54:26.201Z status=402
C2_same_second client=2026-07-06T17:54:26.202Z status=402
D_plus_3s     client=2026-07-06T17:54:29.560Z status=402
E_plus_4s     client=2026-07-06T17:54:30.581Z status=402
```

后端真实 PayWay 调用日志：

```
[payway] check-transaction tran_id=V65487983105686120 at=2026-07-06T17:54:21.703Z
[payway] check-transaction tran_id=V65487983105686120 at=2026-07-06T17:54:26.204Z
[payway] check-transaction tran_id=V65487983105686120 at=2026-07-06T17:54:30.585Z
```

验证结论：同秒 3 次、1 秒后额外请求、同秒 2 次请求都没有进入 PayWay；PayWay 后台只收到被 gate 放行的请求。

---

## 一、问题现象（PayWay 反馈）

后台日志间隔不稳定：

```
14:31:47
14:31:47
14:31:47      ← 同秒 3 次
14:31:51 (+4s)
14:31:52 (+1s)
14:31:56 (+4s)
14:31:56      ← 同秒重复
14:31:59 (+3s)
14:32:00 (+1s)
```

怀疑：多个 polling 同时运行 / 重复启动 / ABA 返回后又新建实例。

---

## 二、所有调用点（A）

### 实际 PayWay `check-transaction-2`（仅 1 处）

| 文件 | 函数 | 调用链 |
|------|------|--------|
| `server/payway.js` | `checkPayWayTransaction(tranId)` | 直接 POST PayWay API |
| `server/presence-server.js` | `POST /api/vip-orders/confirm-payment` | `checkPayWayTransaction(tranId)`（`strictVerify=true` 时） |

### 前端触发 confirm-payment（间接调 Check Transaction）

| 文件 | 位置 | 轮询角色 |
|------|------|----------|
| `src/lib/viewerProfileApi.js` | `confirmViewerVipPayment()` | 统一入口 |
| `src/hooks/useVipAbaKhqrPaymentConfirm.js` | coordinator 订阅 | QR 页 + VIP 页 |
| `src/pages/VipAbaKhqrPage.jsx` | 挂载上述 hook | QR 流程 |
| `src/pages/VipPage.jsx` | 挂载上述 hook | 回跳确认 UI |
| `src/pages/VipPage.jsx` L441 | visibility 直接 `confirmViewerVipPayment` | 回跳瞬间单次（未改） |
| `src/hooks/useVipAbaKhqrBankReturn.js` | coordinator 订阅 | ABA deeplink 冷启动 |
| `src/App.jsx` | 挂载 bank return hook | 全局 |
| `src/pages/PaymentReturnPage.jsx` | 单次调用 | 无轮询，非本次问题 |

### 本次新增

| 文件 | 作用 |
|------|------|
| `src/lib/vipCheckTransactionPollCoordinator.js` | 每个 `tran_id` 唯一 active polling |

---

## 三、根因（B）— 为何 14:31:47 同秒 3 次

ABA App 返回 Telegram 时，同一 `tran_id` 三条路径同时首次检查：

```
visibilitychange（从 ABA 回到 Mini App）
    │
    ├─① useVipAbaKhqrBankReturn.js
    │     while 循环 → 立即 confirmViewerVipPayment()     ← 第 1 次
    │
    ├─② useVipAbaKhqrPaymentConfirm.js（VipPage）
    │     useEffect → 立即 pollOnce()                    ← 第 2 次
    │     + setInterval(4000)
    │
    └─③ VipPage.jsx L441 onVisibility
          confirmViewerVipPayment()                        ← 第 3 次
```

异常间隔（+1s、+3s、同秒重复）原因：

| 原因 | 代码位置 |
|------|----------|
| 两套独立 4s 计时器 | `setInterval` vs `while + sleep(4000)`，启动时刻不同 |
| setInterval 不等 async 完成 | `pollOnce` 异步，可能与上次 in-flight 重叠 |
| visibilitychange 重复启动 | bank return `onVisible → run()`；payment confirm 也有 visibility |
| effect 重跑 | bank return 依赖 `viewerProfile.role`，profile 刷新重建轮询 |
| QR + ABA 重叠 | `VipAbaKhqrPage` 与 bank return 各跑一套 |

---

## 四、修复方案（C）— 如何保证严格 4 秒

### 改动文件

| 文件 | 内容 |
|------|------|
| `src/lib/vipCheckTransactionPollCoordinator.js` | **新建**：每 tran_id 一个 session；`setTimeout` 链；`inFlight` 锁；最长 5 分钟 |
| `src/hooks/useVipAbaKhqrPaymentConfirm.js` | 去掉 `setInterval`，改订阅 coordinator |
| `src/hooks/useVipAbaKhqrBankReturn.js` | 去掉 `while+sleep`，改订阅 coordinator |
| `src/lib/viewerProfileApi.js` | 同 tran_id in-flight 去重（覆盖 VipPage L441，无需改 VIP 页） |
| `server/payway.js` | 增加 `[payway] check-transaction tran_id=... at=...` 日志 |

### 机制

```
每个 tran_id：
  sessions.get(tranId) === 唯一 session
  inFlight === true 时不再发请求
  本次完成后 setTimeout(4000) 再下一次
```

预期时间线：

```
14:31:47  Poll #1
14:31:51  Poll #2  (+4s)
14:31:55  Poll #3
14:31:59  Poll #4
14:32:03  Poll #5
```

---

## 五、测试日志（D）

### 测试 1 — Coordinator 模拟（3 订阅者同 tran_id）

```
Test TranId:
SIM-TRAN-001

First burst API calls: 1 (expect 1)

Poll #1
01:33:44.553

Poll #2
01:33:48.643
Δ 4.090s

Poll #3
01:33:52.742
Δ 4.099s

Poll #4
01:33:56.844
Δ 4.102s
```

命令：`node scripts/verify-poll-coordinator-sim.mjs`

### 测试 2 — 真实 API（pending 订单 V65487983105686120）

```
Test TranId:
V65487983105686120

Poll #1
01:34:16.360

Poll #2
01:34:20.369
Δ 4.009s

Poll #3
01:34:24.383
Δ 4.014s

Poll #4
01:34:28.390
Δ 4.007s

Poll #5
01:34:32.402
Δ 4.012s
```

命令：`node scripts/verify-check-transaction-polling.mjs V65487983105686120 8707054926`

---

## 六、ABA App 返回流程（E）

```
ABA Open
  └─ abaMobile.js（未改）

Payment Success

Return Deeplink
  └─ Telegram 冷启动
       └─ App.jsx → useVipAbaKhqrBankReturn()
            └─ resolveVipAbaKhqrBankReturnContext()
                 └─ subscribeVipCheckTransactionPoll(tranId, ...)
                      └─ coordinator.tick() 立即执行

Polling Started（已有 session 则复用）

Check Transaction #1
  └─ confirmViewerVipPayment({ strictVerify: true })
       └─ POST /api/vip-orders/confirm-payment
            └─ checkPayWayTransaction(tranId)

并行保护：
  · VipPage payment confirm hook 订阅同一 tran_id → 不新建 polling
  · VipPage visibility L441 → in-flight 去重合并为一次请求
```

---

## 七、未修改项

- `VipPage.jsx`、`VipAbaKhqrPage.jsx`
- return_deeplink、ABA deeplink、导航、Header、页面缓存、支付 UI

---

## 八、建议下一步

Telegram 真机走完整 ABA App 支付返回，对照后台 `[payway] check-transaction` 日志确认间隔均为 ~4s、无同秒重复。
