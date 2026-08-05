# 数据同步设计文档

> **目的**：梳理卷腹 App 各板块的数据写入/读取/刷新逻辑，明确单一数据源、避免双字段不一致。
> **文件**：`public/prototype.html`（约 4856 行） + `tests/*.spec.mjs`（40 个 Playwright 测试）

---

## 1. 顶层架构

```
                 ┌────────────────────────────────────┐
                 │           localStorage             │
                 │  key: 'juanfu_user' (LS_KEY)       │
                 └──────────────┬─────────────────────┘
                                │ saveAppState / loadAppState
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                          appState                            │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐  │
│  │ user       │ │ circles  │ │ records    │ │ stats      │  │
│  │ nick/emoji │ │ memberList│ │ todayRds   │ │ weeklyPts  │  │
│  │ profile    │ │ activeId │ │ schedule   │ │ quarterPts │  │
│  │ notifSet   │ │ reward   │ │            │ │ streakDays │  │
│  └────────────┘ └──────────┘ └────────────┘ └────────────┘  │
│                                                              │
│  ┌────────────┐                                              │
│  │ meta       │   notifications []                          │
│  │ quarterKey │   leaderboardCache {}（未实际使用）          │
│  └────────────┘                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │ 写入入口（#3）
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                       渲染层（renderXxx）                    │
│  refreshDashboard │ refreshRecordPage │ renderLeaderboard    │
│  renderCommunityFeed │ renderSidebarCircles │ updateCircleCard│
│  generateHeatmap │ renderTrendChart │ updateTabbar           │
└──────────────────────────────────────────────────────────────┘
                           │ DOM 操作
                           ▼
                       4 个 tab + 模态框 + 侧边栏
```

**核心原则**：
1. **唯一数据源**：`appState`（localStorage 持久化）
2. **渲染 = 状态投影**：所有 UI 都从 `appState` 派生，不缓存 DOM 状态
3. **写入后必刷新**：`closeModal() → saveAppState() → refreshDashboard() → refreshRecordPage()`

---

## 2. appState 字段表

### 2.1 用户基础（注册时填写，10 字段）

| 字段 | 类型 | 默认值 | 写入函数 | 读取函数 |
|------|------|--------|----------|----------|
| `onboardingDone` | bool | `false` | `completeProfileSetup` | `loadAppState` |
| `hasCircle` | bool | `false` | `doCreateCircle`/`doJoinCircle`/`resetToRegistrationPage` | `hasJoinedCircles`/`updateCircleCard` |
| `nick` | str | `''` | `completeRegistration` | 头像/排行榜/Feed |
| `emoji` | str | `'💪'` | `selectEmoji` | 头像/Feed/圈子成员 |
| `height`/`weight`/`bodyFat` | num | `0` | `completeRegistration` | `profileBody` |
| `slogan` | str | `''` | `completeProfileSetup` | `profileBody` |
| `freq` | str | `'daily'` | `selectFreq` | `updateDashboardForOnboarding` |
| `privacy` | bool | `false` | `togglePrivacy`/`togglePrivacySetting` | `settingsBody` |
| `schedulePublic` | bool | `true` | `toggleSchedulePublic` | `settingsBody` |
| `notifSettings` | obj | `{workout:true,diet:false,overtake:true,invite:true}` | `toggleNotif` | `settingsBody` |

### 2.2 圈子（核心数据模型）

```js
circles: [
  {
    id: 'preset-1',                    // 唯一标识
    name: '八组卷王',                    // 圈子名
    role: 'leader',                    // 当前用户在圈中的角色
    code: 'GRP00001',                  // 邀请码
    members: 8,                        // 人数（与 memberList.length 同步）
    reward: '周末聚餐',                  // 奖惩设置
    weeklyReward: true,                // 周冠军奖励开关
    memberList: [                      // 成员列表（含本人）
      { emoji: '🐙', name: 'Gracey', score: 130, isMe: true,  isLeader: true  },
      { emoji: '🦊', name: 'Monk',   score: 72,  isMe: false, isLeader: false }
    ],
    joinRequests: []                   // 待处理邀请
  }
]
activeCircleId: 'preset-1'             // 当前查看的圈子
```

**关键设计**：
- `memberList[].isMe = true` 标记本人（排行榜特判）
- `score` 是圈子内成员的本季度积分（mock 数据由圈子数据预填；本人由 `finalizeSubmit` 同步）
- `activeCircleId` 决定排行榜/圈子卡片显示哪个圈子

### 2.3 记录与日程

| 字段 | 类型 | 默认值 | 写入函数 | 读取函数 |
|------|------|--------|----------|----------|
| `todayRecords` | array | `[]` | `finalizeSubmit`/`deleteRecord` | `refreshDashboard`/`refreshRecordPage`/`generateHeatmap` |
| `schedule` | obj | `{}` | `addSchedule`/`removeSchedule` | `generateHeatmap`/`refreshTodoFromSchedule` |

记录结构：
```js
{ id, type, points, createdAt, date, time, ...typeSpecificFields }
// type: 'daily' | 'special' | 'diet'
// daily:   { group, exercise, reps, sets }
// special: { sport, minutes }
// diet:    { food, qty, kcal }
```

### 2.4 统计积分（核心数据源）

| 字段 | 类型 | 重置时机 | 写入函数 | 读取函数 |
|------|------|----------|----------|----------|
| `weeklyPoints` | num | 每周一 | `finalizeSubmit` | `refreshDashboard` |
| `streakDays` | num | 断签 | `finalizeSubmit` | `refreshDashboard` |
| `quarterPoints` | num | 每季度初 | `finalizeSubmit`（季度切换） | `refreshDashboard`/`leaderboardAllUsers` |
| `quarterKey` | str | — | `finalizeSubmit`（季度切换） | `getCurrentQuarterKey` |

**唯一数据源 = `appState.quarterPoints`**
- `memberList[isMe].score` 是**冗余副本**，由 `finalizeSubmit` 同步写入（避免 UI 与全局数据脱节）

### 2.5 通知（站内信）

```js
notifications: [
  { id, type, title, body, time, read }
// type: 'rank_up' | 'rank_down' | 'circle_invite' | 'circle_remove' | 'reward' | 'join_request'
```

> ⚠️ 注意：appState 初始化时 `notifications` 字段声明了两次（#1624 和 #1639）。`addNotification()` 和 `pushNotification()` 写入格式不统一（前者带 `id/title/body/read`，后者只有 `text/type/time`）。建议合并为单一函数。

---

## 3. 数据写入入口

### 3.1 记录提交（最复杂流程）

```
FAB [+] → openRecordModal('daily'|'special'|'diet')
       → 用户填表 → submitXxxRecord() 构建 record
       → finalizeSubmit(record)  ★ 唯一的数据写入入口
```

**`finalizeSubmit` 完整流程**（#3376）：

| 步骤 | 行号 | 操作 | 涉及字段 |
|------|------|------|----------|
| 1 | #3378-3389 | 季度切换检测 + 同步清零 memberList | `quarterKey`/`quarterPoints`/`memberList[isMe].score` |
| 2 | #3397 | push 记录 | `todayRecords` |
| 3 | #3399 | 周积分累加 | `weeklyPoints` |
| 4 | #3402 | 季度积分累加 | `quarterPoints` |
| 5 | #3404-3408 | **同步到 memberList（防双字段不一致）** | `memberList[isMe].score` |
| 6 | #3412-3413 | 连续打卡 +1 | `streakDays` |
| 7 | #3417-3439 | 排名变动检测 + addNotification | `notifications` |
| 8 | #3442-3456 | 若分享 → 写入 Feed | `window._feedPosts` |
| 9 | #3458 | 关闭模态框 | — |
| 10 | #3459 | **saveAppState()** | localStorage |
| 11 | #3460 | refreshDashboard() | 仪表盘全量刷新 |
| 12 | #3461 | refreshRecordPage() | 记录页刷新 |
| 13 | #3465 | showToast() | 用户反馈 |

**关键点**：
- **不变量**：`appState.quarterPoints === memberList[isMe].score`（本人）
- **同步刷新**：刷新仪表盘时同时刷新排行榜（`renderLeaderboard` 嵌入 `refreshDashboard` 内部 #3502）

### 3.2 圈子操作（均不触发 saveAppState ⚠️）

| 操作 | 函数 | 修改字段 | saveAppState? | 备注 |
|------|------|----------|---------------|------|
| 创建圈子 | `doCreateCircle` | `circles`+`activeCircleId`+`myInviteCode`+`hasCircle` | ❌ | 刷新时只更新 UI，未持久化 |
| 加入圈子 | `doJoinCircle` | `circles`+`activeCircleId`+`hasCircle`+`joinPending` | ❌ | 同上 |
| 退出圈子 | `leaveCircle` | `circles`+`activeCircleId` | ❌ | 组长转交时同步调整 memberList.isLeader |
| 接受邀请 | `approveJoinRequest` | `circles[active].memberList`+`joinRequests`+`notifications` | ❌ | |
| 拒绝邀请 | `rejectJoinRequest` | `circles[active].joinRequests` | ❌ | |
| 移除成员 | `removeMember` | `circles[active].memberList`+`members` | ❌ | |
| 改奖惩 | `editReward`/`toggleWeeklyReward` | `circles[active].reward`/`weeklyReward`+`notifications` | ❌ | |

> **风险**：刷新页面后，圈子数据会从 localStorage 恢复（因为 `loadAppState` 会读 `circles`），但**只有当 finalizeSubmit 触发了 saveAppState 时**，circles 才会被保存。实际行为：circles 字段在 `saveAppState` 序列化列表内（#4384），所以**任何**触发 `saveAppState` 的入口（提交记录、删记录、改设置、点通知）都会顺带持久化 circles。这是**隐式契约**，易破坏。

### 3.3 其他写入

| 操作 | 函数 | 修改字段 |
|------|------|----------|
| 删除记录 | `deleteRecord` | `todayRecords`（**不回退分数** ⚠️） |
| 编辑记录 | `openEditRecordModal` → `submitXxxRecord`（含 `_editingRecordId`） | `todayRecords[idx]` 原地替换 |
| 隐私/日程公开 | `togglePrivacySetting`/`toggleSchedulePublic` | `privacy`/`schedulePublic` |
| 通知已读 | `markAllRead`/`openNotifications` | `notifications[].read = true` |
| 添加/删除日程 | `addSchedule`/`removeSchedule` | `schedule` |

---

## 4. UI 刷新路径

### 4.1 refreshDashboard 内部调用链

```
refreshDashboard()                                #3470
  ├─ read: todayRecords, weeklyPoints, streakDays, quarterPoints, nick, freq, circles
  ├─ write: #quarterPoints, #quarterRank, #weeklyRank
  ├─ renderLeaderboard()                          #1773 (嵌入!)
  ├─ updateNotificationBadge()                    #1706
  ├─ updateTabbar()                               #2345 (无圈子时隐藏排行榜 tab)
  ├─ renderTrendChart()                           #3608 (8 周净积分折线)
  ├─ generateHeatmap(false)                       #2232 (今日→绿色高亮)
  └─ 重建 #statusEmpty / #statusPopulated
```

**嵌入设计**：`renderLeaderboard` 嵌入 `refreshDashboard` 内部（#3502），确保任何仪表盘刷新都会同步更新排行榜。但**反向不成立**——`renderLeaderboard` 不会触发 `refreshDashboard`。

### 4.2 切换 tab 时的刷新策略

```js
switchTab(name)                                   #2768
  ├─ 切换 .page.active 状态
  ├─ closeFab()
  └─ 调用对应刷新函数
      ├─ 'dashboard'   → refreshDashboard()  (含排行榜)
      ├─ 'record'      → refreshRecordPage()
      ├─ 'community'   → renderCommunityFeed()
      └─ 'leaderboard' → renderLeaderboard()
      └─ 'leaderboard' 但 !hasJoinedCircles() → 跳回 dashboard + toast
```

**问题**：`switchTab` 不知道圈子变化，依赖 `updateTabbar` 提前隐藏 tab。如果 `updateTabbar` 未被调用，tab 仍可见但点击会触发 toast。

### 4.3 排行榜数据源（修复后）

```js
leaderboardAllUsers(myQuarterPts)                 #1659
  ├─ if (!hasJoinedCircles()) return []           // 无圈子 → 空数组
  ├─ 找 active = circles[activeCircleId] ?? circles[0]
  ├─ 本人分数：myQuarterPts ?? appState.quarterPoints
  └─ 其他成员：memberList[].score（mock 或预填）
```

**数据源优先级**（本人）：
1. 调用方传入的 `myQuarterPts`（用于排名检测）
2. `appState.quarterPoints`（全局本季度积分）
3. ~~`memberList[isMe].score`~~（已被 #1/#2 覆盖，仅在过渡期作 fallback）

**为何不直接用 memberList？**：memberList 在 mock 圈子中是硬编码（如 Monk=72），与全局 quarterPoints 是独立数据源。本人的 `memberList[isMe].score` 始终等于 `quarterPoints`（由 `finalizeSubmit` 同步），但**读取时优先 quarterPoints** 保证单一数据源。

---

## 5. 持久化

### 5.1 saveAppState 序列化字段

```js
// #4371-4393
{
  onboardingDone, hasCircle, nick, emoji, height, weight, bodyFat,
  slogan, freq, privacy, schedulePublic, notifSettings,
  circles, activeCircleId, myInviteCode,
  todayRecords, schedule,
  weeklyPoints, streakDays, quarterPoints, quarterKey,
  notifications
}
```

**不持久化**：`circleName`/`joinedCircleName`/`joinPending`（仅内存缓存）、`leaderboardCache`（未使用）

### 5.2 loadAppState 兜底默认值

```js
// #4407-4424
notifSettings ??= { workout:true, diet:false, overtake:true, invite:true }
schedulePublic ??= true
circles ??= []
if (circles.length > 0) hasCircle = true
todayRecords ??= []
schedule ??= {}
weeklyPoints ??= 0
streakDays ??= 0
quarterPoints ??= 0
quarterKey ??= getCurrentQuarterKey()
notifications ??= []
```

**关键迁移点**：老版本数据中 `circles` 可能不存在（#4413 注释），loadAppState 会自动补空数组。`onboardingDone` 不为真则返回 `false`（#4403），进入新用户注册流。

### 5.3 LS_KEY

```js
const LS_KEY = 'juanfu_user'                       // #4368
```

> ⚠️ 之前测试用 `localStorage.setItem('appState', ...)` 是错的，必须用 `'juanfu_user'`。

---

## 6. 关键同步时序：提交一条日常记录

```
用户点击 [+] 日常
  ↓
openRecordModal('daily')                            #2938
  ├─ _dailyForm = { group:'下肢', exercise:'深蹲', reps:30, sets:3, date, time }
  └─ 渲染表单到 modalBody
  ↓
用户修改/确认 → submitDailyRecord()                 #3111
  ├─ points = ceil(30*3*0.15) = 14
  └─ finalizeSubmit(record)
  ↓
finalizeSubmit(record)                              #3376
  ├─ 季度检测
  ├─ todayRecords.push(record)
  ├─ weeklyPoints += 14
  ├─ quarterPoints += 14
  ├─ memberList[isMe].score = quarterPoints (同步)
  ├─ streakDays++ (首次记录)
  ├─ 排名变动检测 → addNotification (如有)
  ├─ closeModal()
  ├─ saveAppState()         ← localStorage
  ├─ refreshDashboard()     ← UI 刷新 (含排行榜)
  ├─ refreshRecordPage()    ← 记录页刷新
  └─ showToast('打卡成功 +14')
```

**UI 同步点**（一次提交触发）：

| DOM 元素 | 数据来源 | 刷新函数 |
|----------|----------|----------|
| `#weeklyPoints` | `appState.weeklyPoints` | refreshDashboard |
| `#streakDays` | `appState.streakDays` | refreshDashboard |
| `#quarterPoints` | `appState.quarterPoints` | refreshDashboard |
| `#statusPopulated` | `appState.todayRecords` | refreshDashboard |
| `#heatmapGrid` | `todayRecords`+`schedule` | generateHeatmap |
| `#trendCard` SVG | `todayRecords` | renderTrendChart |
| `#lbPodium`/`#lbList` | `circles[active].memberList` | renderLeaderboard |
| `#notifBadge` | `appState.notifications` | updateNotificationBadge |
| 记录页 3 张卡 | `appState.todayRecords` | refreshRecordPage |

---

## 7. 已修复的同步问题

### 7.1 排行榜数据源脱节（本次修复）

**症状**：Gracey 提交记录后，仪表盘"本季度积分"显示正确，但排行榜仍显示 0 分。

**根因**：
- `leaderboardAllUsers` 中本人分数用 `m.isMe ? myPts : (m.score || 0)`，`myPts` 来自 `appState.quarterPoints`
- 但 `memberList[isMe].score` 是另一个独立字段，`finalizeSubmit` 从不更新它
- 当 mock 圈子初始化 `memberList[Gracey].score = 0` 时，会出现"两个分数"认知错乱

**修复**（`public/prototype.html`）：
1. `finalizeSubmit` 同步写入 `memberList[isMe].score = appState.quarterPoints`（#3404-3408）
2. 季度切换时同步清零 `memberList[isMe].score`（#3386-3388）
3. `leaderboardAllUsers` 明确"本人优先 quarterPoints"的优先级（#1659-1681）

**测试**：`tests/data-sync.spec.mjs`（4 个）：
- 提交后 memberList[isMe].score 同步
- leaderboard 反映 quarterPoints
- 季度切换时 memberList 清零
- 多次提交累加正确

### 7.2 新用户注册后残留预设圈子

**症状**：新用户注册时，appState.circles 仍残留默认 K800 数据。

**修复**（#2059-2061）：在 `initOnboarding` 显式 `appState.circles = []` + `appState.activeCircleId = null`。

### 7.3 无圈子时的逻辑一致性

**症状**：无圈子时排行榜 tab 仍可见，点击会跳到空页。

**修复**（上一轮）：
- `updateTabbar()` 动态隐藏"排行榜" tab（#2345）
- `switchTab('leaderboard')` 在无圈子时跳回 dashboard + toast
- `renderLeaderboard` 显示空态（加入圈子引导）
- `hasJoinedCircles()` 作为统一守卫

---

## 8. 已知缺陷

| 缺陷 | 行号 | 风险 | 建议 |
|------|------|------|------|
| 删除记录不回退分数 | #3964-3974 | `weeklyPoints`/`quarterPoints`/`streakDays`/`memberList.score` 全部偏高 | 在 `deleteRecord` 中 `-= record.points`（diet 为正数，提交时是 `+= record.points` 负值） |
| 圈子操作不触发 `saveAppState` | #2642, #2694, #2517, #2415, #2434 等 | 仅靠 finalizeSubmit 顺带持久化，刷新页面时若无记录提交则会丢失 | 每个圈子操作结尾加 `saveAppState()` |
| `notifications` 字段重复声明 | #1624, #1639 | JS 不会报错（第二次覆盖），但易混淆 | 删 #1624 行的空数组声明 |
| 通知写入格式不统一 | `addNotification`(#1695) vs `pushNotification`(#2016) | 老数据格式无 `id`/`read` 字段 | 统一为 `addNotification` |
| profile "保存" 按钮无 onclick | #4247 | profileBody 渲染了表单但无保存逻辑 | 补充 `onclick="saveProfile()"` |
| `leaderboardCache` 字段未使用 | #1641, #4424 | 死代码 | 删除字段声明和兜底 |
| 排行榜副标题硬编码 "Q3" | #1685 | 当前季度应是动态 | 改为 `Math.ceil((d.getMonth()+1)/3)`（已修） |

---

## 9. 扩展指南

### 9.1 新增一种记录类型

1. 在 `finalizeSubmit` 中扩展 type 分支（#3144 附近）
2. 在 `dailyBody`/`specialBody`/`dietBody` 旁边新增 `xxxBody()` 渲染表单
3. 在 `FAB` 菜单添加按钮（`openRecordModal('xxx')`）
4. 在 `statusPopulated` 渲染分支（#3555-3594）添加对应类型
5. 补 Playwright 测试

### 9.2 新增圈子字段

1. 在 appState 初始化时（#1596-1619 数组第一个元素）添加字段
2. 在 `saveAppState` (#4384) 和 `loadAppState` 兜底中处理
3. 在 `doCreateCircle` (#2642) 构造新圈子时赋值
4. 在圈子卡片/`updateCircleCard` 中渲染

### 9.3 新增 UI 刷新函数

1. 函数命名：`refreshXxx`（写时用）或 `renderXxx`（读时用）
2. 必须在写入入口末尾调用（finalizeSubmit 已有标准模式）
3. 若与仪表盘相关，嵌入 `refreshDashboard` 内部；否则在 `switchTab` 中按需调用

---

## 10. 测试矩阵

| spec 文件 | 测试数 | 覆盖 |
|-----------|--------|------|
| `exercise-system.spec.mjs` | 10 | 运动字典、记录 CRUD、统计 |
| `new-features.spec.mjs` | 7 | 任务 50-54（饮食 5 分/时间排序/趋势图/滑动删除） |
| `trend-xaxis.spec.mjs` | 1 | 趋势图横轴日期 |
| `bugfixes-batch2.spec.mjs` | 6 | 5 项 bug 修复 + 季度积分/排行榜/通知 |
| `no-circles.spec.mjs` | 11 | 无圈子场景（tab 隐藏/空态/不产通知） |
| `data-sync.spec.mjs` | 4 | 数据源同步（本次新增） |
| **合计** | **39** | 全通过 ✅ |

每个测试都用 `addInitScript` 注入 `localStorage.setItem('juanfu_user', ...)` 预设 appState，绕过注册流程直接进入主界面。
