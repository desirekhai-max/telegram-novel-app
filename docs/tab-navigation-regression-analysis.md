# MainTabPagesHost 改造 — Tab 导航回归检查

> 检查基准：当前工作区 `MainTabPagesHost` 改造后代码（未 Push）  
> 检查日期：2026-07-02  
> 范围：仅分析，不含代码修改

---

## 1. 哪些页面进入后会错误跳回首页

### 根因

从主 Tab（`/`、`/vip`、`/account`）进入子页面时，`AppShell` 会挂载 swipe underlay。当上一页为主 Tab 时，underlay 使用 `includeMainTabs={false}`，`AppRoutes` **不包含** `/`、`/vip`、`/account`。此时 underlay 的 `location` 仍是上一页主 Tab 路径，无法匹配任何路由，落入通配符：

```jsx
<Route path="*" element={<Navigate to="/" replace />} />
```

underlay 与 foreground 共用同一 `BrowserRouter`，underlay 内的 `<Navigate to="/">` 会**将整个应用导航到首页**。

### 受影响页面（从主 Tab 进入时）

| 来源 | 目标路径 | 入口 |
|------|----------|------|
| `/` | `/notifications` | 顶栏通知图标 |
| `/account` | `/account/orders` | 订单记录 |
| `/account` | `/account/reading-history` | 阅读历史 |
| `/account` | `/account/saved` | 收藏 |
| `/account` | `/contact-us` | Contact Us |
| `/account` | `/about` | About Us |
| `/account` | `/terms-of-service` | 服务条款 |
| `/account` | `/privacy-policy` | 隐私政策 |
| `/vip` | `/refund-policy` | VIP 页脚链接 |
| 任意主 Tab | `/read/:id` | 首页点书等 |
| 任意主 Tab | `/vip/aba-khqr` 等支付子路由 | VIP 支付流程 |

### 不受影响

| 场景 | 原因 |
|------|------|
| 冷启动直开子路由（如 `/account/orders`） | 首屏 `previousLocationRef` 为 `null`，underlay 不挂载 |
| 主 Tab 互切（`/` ↔ `/vip` ↔ `/account`） | 走 `MainTabPagesHost`，不经过 underlay |
| 账户内 `to="/vip"` | 仍在主 Tab 壳内切换 pane |
| 外链 Telegram | 不走站内路由 |
| 未知路径 | 改造前即 `*` → `/`（非本次引入） |

---

## 2. 哪些账户功能页受到 MainTabPagesHost 改造影响

### 路由定义

账户子页路由**未删除**，仍在 `AppRoutes` 中注册。

### 行为变化

| 入口 | 路由 | 影响 |
|------|------|------|
| 购买 VIP | `/vip` | **正常**：主 Tab 内 pane 切换，shell 不卸载 |
| 订单 / 阅读 / 收藏 | `/account/*` | **高风险**：从 `/account` 点入可能误跳首页 |
| Contact / About / 条款 / 隐私 | 各子路由 | **高风险**：同上 |
| 客服 / 社区 Telegram | 外链 | **无影响** |
| 底栏从子页回账户 | `/account` | 能到达，但 `MainTabPagesHost` **整壳重挂**，页面状态重置 |
| `disabled={!rawUser}` 入口 | — | 逻辑未改 |

### 保活范围说明

- **已保活**：仅 `/`、`/vip`、`/account` 三页在 shell 内互保活
- **未保活**：进入任意子路由后 **整个 `MainTabPagesHost` 卸载**（符合「不扩大保活范围」约束，但带来状态丢失）

---

## 3. 哪些页面顶部仍会闪动

### 已改善

| 场景 | 说明 |
|------|------|
| `/` ↔ `/vip` ↔ `/account` 底栏切换 | 单顶栏实例 `AppMainTabToolbar`，中间区 CSS 显隐，无整页 header 重挂 |

### 仍会闪动

| 页面 / 场景 | 原因 |
|------------|------|
| 主 Tab → 子页（通知、账户子页、政策页等） | underlay 双渲染 + 可能误 `Navigate` 到 `/` |
| 子页 → 主 Tab（底栏返回） | `MainTabPagesHost` 整壳 mount，顶栏重新出现 |
| `/read/:id` | 整页 `AppRoutes`，阅读顶栏每次进入重挂 |
| `/vip/aba-khqr`、`/vip/payment-success` 等 | 独立页 + 自有 header / boot 样式 |
| `/notifications` | 独立 header；从首页点入可能先闪 underlay 或被踢回 `/` |
| `/account/orders` 等 | 独立 `BrandTabToolbar` 每次 mount |
| `/about`、`/contact-us` 等（`HomePageDom`） | 独立 toolbar + 边缘返回 underlay |
| 非主 Tab 路由切换 | `syncPortraitLockRoute`、`resetGesture` 仍会执行 |
| VIP / 账户 Tab 标题切换 | 搜索框 ↔ 标题面板 `display` 切换，可能有轻微视觉变化 |

---

## 4. 哪些页面 Header 已经正常保活

### 共用顶栏（设计目标，已生效）

| 路径 | 实现 |
|------|------|
| `/` | `AppMainTabToolbar`；`HomePage` 在 shell 内 `usesSharedToolbar` 时不渲染自有 header |
| `/vip` | 同上；中间显示「សមាជិកVIP」 |
| `/account` | 同上；中间显示「គណនី」 |

### 子页面（前景层仍用独立 Header，未误继承主 Tab 顶栏）

| 路径 | Header |
|------|--------|
| `/notifications` | `tg-notifications__toolbar` |
| `/account/orders` 等 | `BrandTabToolbar` + 返回 |
| `/read/:id` | 阅读页顶栏 |
| `/vip/aba-khqr` 等 | 各自独立顶栏 |

### 隐藏 pane（保活但未显示）

切离某主 Tab 时，其他 Tab 的页面 DOM 仍在（`hidden`），且不再渲染各自 header（`usesSharedToolbar === true`），避免双顶栏。

---

## 5. 哪些路由返回逻辑发生变化

| 行为 | 改造前 | 改造后 |
|------|--------|--------|
| 主 Tab 互切 | 整页换路由 + header 重挂 | 单顶栏 + pane 显隐；跳过 underlay、`resetGesture`、搜索状态重置 |
| 主 Tab → 子页 | 普通路由 + underlay | 可能触发 underlay 误导航 `/` |
| 子页 → 主 Tab | 普通挂载 | `MainTabPagesHost` 重新挂载，保活状态清空 |
| 子页边缘右滑返回 | `navigate(-1)` + underlay | 仍 `navigate(-1)`；回主 Tab 时 shell 重挂 |
| 主 Tab 间手势 | 每次 `resetGesture()` | 主 Tab 互切**不**执行 |
| 离开主 Tab | 清空搜索/筛选聚焦 | 仍清空；主 Tab 互切**不清** |
| Logo 点击 | `window.location.reload()` | 未改 |

---

## 6. 修复方案

### P0 — 修复误跳首页（必须）

**问题**：underlay 在 `backLocation` 为主 Tab 且 `includeMainTabs=false` 时，`*` 路由触发 `<Navigate to="/">`。

**方案（择一，推荐 A）**：

- **A. 主 Tab 作为 underlay 上一页时不挂 underlay**  
  扩展 `shouldMountSwipeBackUnderlay`：若 `prev` 为主 Tab 路径，返回 `false`（主 Tab 走 `MainTabPagesHost` 渲染，underlay 无法复现，不应挂载）。

- **B. underlay 渲染主 Tab 时用 `MainTabPagesHost` 快照**  
  复杂度高，易与 foreground 双实例冲突，不推荐。

- **C. 通配符改为 `null` 而非 `<Navigate to="/">`**  
  仅缓解 underlay 内跳转，不解决 underlay 空白；需配合 A。

### P1 — 保持主 Tab 顶栏不闪（已基本达成）

- 维持 `MainTabPagesHost` + `AppMainTabToolbar`
- 主 Tab 互切继续跳过 `resetGesture` 与搜索状态重置

### P2 — 减闪动（可选，不扩大保活）

- 子页 → 主 Tab 时 shell 重挂属预期；若需保留滚动位置，可后续单独做 session 级 restore（**不扩大 pane 保活范围**）
- 评估 `syncPortraitLockRoute` 在主 Tab 互切时是否可跳过

### 明确不做

- 不把账户子页、通知页等纳入 `MainTabPagesHost` 保活
- 不改动 ABA KHQR / 支付页逻辑（除非 underlay 修复涉及 `App.jsx` 路由壳）

---

## 7. 预计修改文件列表

| 文件 | 改动 |
|------|------|
| `src/lib/bottomNavRoutes.js` | `shouldMountSwipeBackUnderlay`：上一页为主 Tab 时返回 `false` |
| `src/App.jsx` | 核对 underlay 条件；必要时移除或调整 `includeMainTabs` 逻辑 |
| `src/components/MainTabPagesHost.jsx` | 通常无需改（P0 修 underlay 即可） |
| `src/components/AppMainTabToolbar.jsx` | 通常无需改 |
| `docs/tab-navigation-regression-analysis.md` | 本文档（已生成） |

**P2 可选**：`src/App.jsx`（`syncPortraitLockRoute` 跳过主 Tab 互切）

---

## 8. 风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| 从主 Tab 进子页误回首页 | **高** | 通知、账户子页、支付入口可能不可用 |
| 子页回主 Tab 状态丢失 | 中 | shell 卸载重挂，滚动/表单状态不保留 |
| 边缘返回 underlay 与主 Tab 不同步 | 中 | P0 修后 underlay 减少，返回动画可能略变 |
| 主 Tab 顶栏中间区切换轻微跳动 | 低 | 可接受或 CSS 微调 |
| 支付 / 阅读流程回归 | 中 | 修 underlay 后需回归 `/vip/aba-khqr`、`/read/:id` |
| 扩大保活范围引入新问题 | 低（若遵守约束） | 不把子页纳入 shell 可避免 |

### 建议测试清单（修复后）

1. 首页 → 通知 → 底栏回首页  
2. 账户 → 订单 / 阅读 / 收藏 → 返回 / 底栏回账户  
3. 主 Tab 三向切换顶栏是否静止  
4. VIP → 退款政策 → 返回  
5. 冷启动直开 `/account/orders`  
6. VIP 支付进 `/vip/aba-khqr`（仅导航，不改支付逻辑）

---

## 问题统计摘要

| 类别 | 数量 |
|------|------|
| 误跳首页受影响路径（从主 Tab 进入） | 11+ |
| 账户功能页受影响入口 | 7（站内） |
| 仍会闪动场景 | 9 |
| Header 已正常保活 | 3（主 Tab） |
| 返回逻辑变化项 | 7 |

| 风险等级 | 数量 |
|----------|------|
| 高 | 1（underlay 误导航） |
| 中 | 3 |
| 低 | 2 |

### 建议优先级

1. **P0**：修复 underlay + `includeMainTabs` 导致的误跳首页  
2. **P1**：验证主 Tab 顶栏保活（当前实现保留）  
3. **P2**：子页闪动与 `syncPortraitLockRoute` 优化（可选）
