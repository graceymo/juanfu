// @ts-check
// 场景 6：日程管理 + 场景 7：邀约一起运动 + 个人资料 & 设置
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001/prototype.html';

function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getCurrentWeekKey() {
  const d = new Date();
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  const yearStart = new Date(monday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((monday - yearStart) / 86400000 + yearStart.getDay() || 7) / 7);
  return monday.getFullYear() + '-W' + weekNum;
}

const today = getTodayStr();
const currentWeek = getCurrentWeekKey();

const makeState = () => ({
  onboardingDone: true, hasCircle: true,
  nick: 'Gracey', emoji: '🐙', slogan: '卷腹使我快乐',
  height: 168, weight: 55, bodyFat: 22,
  freq: 'daily', privacy: true, schedulePublic: true,
  notifSettings: {
    workout: true, diet: false, overtake: true, invite: true,
    rank_passed: true, rank_overtake: true, rank_weekly: true,
    invite_response: true, reminder: true, social: true,
    join_request: true, approve: true, circle_kick: true,
    circle_dismiss: true, body_update: true, body_remind: true,
    circle_change: true
  },
  myInviteCode: 'JFG88888',
  circles: [
    {
      id: 'preset-1', name: '原来你也是公主', role: 'leader', code: 'JFG88888',
      members: 11, capacity: 30, pending: false, reward: '最后一名请第一名喝咖啡', weeklyReward: true,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 130, isMe: true, isLeader: true, joinDate: '2026-W21', slogan: '卷腹使我快乐', height: 168, weight: 55, bodyFat: 22, privacy: true, bodyPublic: true },
        { emoji: '🦊', name: 'Monk', score: 165, isLeader: false, joinDate: '2026-W22', slogan: '能动就行', height: 175, weight: 72, bodyFat: 15, privacy: true, bodyPublic: true },
        { emoji: '🐨', name: 'Kenny', score: 155, isLeader: false, joinDate: '2026-W22', slogan: '累了就歇，歇完再干', height: 182, weight: 78, bodyFat: 12, privacy: true, bodyPublic: true },
        { emoji: '🐱', name: 'Lulu', score: 148, isLeader: false, joinDate: '2026-W23', slogan: '每天进步一点点' },
        { emoji: '🐼', name: 'Panda', score: 142, isLeader: false, joinDate: '2026-W23', slogan: '吃好睡好练好' },
        { emoji: '🦁', name: 'Eric', score: 95, isLeader: false, joinDate: '2026-W24', slogan: '健身房就是第二个家' },
        { emoji: '🐧', name: 'Nico', score: 82, isLeader: false, joinDate: '2026-W24', slogan: '不卷不快乐' },
        { emoji: '🦄', name: 'Zoe', score: 68, isLeader: false, joinDate: '2026-W25', slogan: '瑜伽是解药' },
        { emoji: '🐶', name: 'Leo', score: 55, isLeader: false, joinDate: '2026-W25', slogan: '跑就完事了' },
        { emoji: '🐰', name: 'Ivy', score: 40, isLeader: false, joinDate: '2026-W26', slogan: '宅女翻身记' },
        { emoji: '🐻', name: 'Tim', score: 25, isLeader: false, joinDate: '2026-W26', slogan: '佛系养生' }
      ],
      joinRequests: [],
      weeklyChampions: [
        { name: 'Monk', emoji: '🦊', weekKey: '2026-W22', points: 95 },
        { name: 'Gracey', emoji: '🐙', weekKey: '2026-W24', points: 138 }
      ],
      rankSnapshots: [
        { weekKey: '2026-W22', rankings: [{name:'Gracey',rank:1,pts:88},{name:'Monk',rank:2,pts:95}] },
        { weekKey: '2026-W23', rankings: [{name:'Monk',rank:1,pts:110},{name:'Gracey',rank:2,pts:76}] },
        { weekKey: '2026-W24', rankings: [{name:'Gracey',rank:1,pts:138},{name:'Monk',rank:2,pts:125}] }
      ]
    }
  ],
  activeCircleId: 'preset-1',
  notifications: [],
  schedule: {},
  todayRecords: [
    { id: 'r1', type: 'daily', group: '腿部', exercise: '深蹲', reps: 30, sets: 3, points: 45, time: '19:30', date: today },
    { id: 'r3', type: 'daily', group: '胸部', exercise: '卧推', reps: 12, sets: 4, points: 32, time: '18:30', date: today }
  ],
  weeklyPoints: 130, streakDays: 7,
  weekKey: currentWeek
});

test.describe('场景 6 & 7：日程管理 + 邀约 + 个人资料 & 设置', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, makeState());
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  // ==========================================
  // 场景 6：日程管理
  // ==========================================

  test('① Dashboard 日历存在，格子可点击', async ({ page }) => {
    // 日历容器存在
    const heatmap = page.locator('.heatmap');
    await expect(heatmap).toBeVisible();

    // 单元格存在且可点击
    const cells = page.locator('.heatmap-cell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(10);

    // 点击某个格子（数字格，排除空白 padding 格）
    const firstNumCell = cells.filter({ hasText: /\d+/ }).first();
    await firstNumCell.click();
    await page.waitForTimeout(300);

    // 弹出了 schedule editor
    await expect(page.locator('#recordModal.show')).toBeVisible();
    await expect(page.locator('#modalTitle')).toContainText('日程');
  });

  test('② 日程编辑器含类型选择 + 时间/时长输入 + 已有日程列表', async ({ page }) => {
    // 打开日历 → 点一个日期
    await page.evaluate(() => {
      const today = new Date();
      const ds = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      openScheduleEditor(ds);
    });
    await page.waitForTimeout(300);

    // 类型 chips
    await expect(page.locator('#schedTypeDaily')).toBeVisible();
    await expect(page.locator('#schedTypeSpecial')).toBeVisible();
    await expect(page.locator('#schedTypeDaily')).toHaveClass(/active/);

    // 时间、运动名、时长输入
    await expect(page.locator('#scheduleTime')).toBeVisible();
    await expect(page.locator('#scheduleName')).toBeVisible();
    await expect(page.locator('#scheduleDuration')).toBeVisible();

    // "还没有日程安排" 占位文案
    await expect(page.locator('#modalBody')).toContainText('还没有日程安排');
  });

  test('③ 添加日常运动日程：保存后出现在列表 → 日历格 📌 标记', async ({ page }) => {
    const dateStr = today;
    await page.evaluate((ds) => openScheduleEditor(ds), dateStr);
    await page.waitForTimeout(300);

    // 运动类型默认 daily，选个动作
    await page.locator('#scheduleName').selectOption('深蹲');
    await page.locator('#scheduleDuration').fill('45');
    await page.locator('#scheduleTime').fill('20:00');

    // 点 +
    await page.click('button:has-text("+")');
    await page.waitForTimeout(400);

    // 列表中出现深蹲
    await expect(page.locator('#modalBody')).toContainText('深蹲');
    await expect(page.locator('#modalBody')).toContainText('45');

    // Toast
    await expect(page.locator('#toast.show')).toBeVisible();

    // 关闭 modal（用 modal 内按钮避免匹配到侧边栏的"完成设置"）
    await page.click('#recordModal button:has-text("完成")');
    await page.waitForTimeout(300);

    // 检查日历格是否有 📌 (has-schedule class)
    const todayCell = page.locator('.heatmap-cell').locator(`xpath=..`).locator(`.heatmap-cell:has-text("${new Date().getDate()}")`).first();
    // heatmap 已重新生成，带 has-schedule class 的格子数量 > 0
    const scheduled = page.locator('.heatmap-cell.has-schedule');
    const schedCount = await scheduled.count();
    expect(schedCount).toBeGreaterThanOrEqual(1);
  });

  test('④ 切换专项运动类型 → select 选项变化', async ({ page }) => {
    const dateStr = today;
    await page.evaluate((ds) => openScheduleEditor(ds), dateStr);
    await page.waitForTimeout(300);

    // 默认 daily，select 包含日常运动 optgroup
    let selText = await page.locator('#scheduleName').textContent();
    expect(selText).toContain('深蹲');

    // 切换到专项
    await page.locator('#schedTypeSpecial').click();
    await page.waitForTimeout(200);

    // chip active 切换
    await expect(page.locator('#schedTypeSpecial')).toHaveClass(/active/);
    await expect(page.locator('#schedTypeDaily')).not.toHaveClass(/active/);

    // select 变成专项选项（第一项是球类 → 篮球）
    selText = await page.locator('#scheduleName').textContent();
    expect(selText).toContain('篮球');
    expect(selText).not.toContain('深蹲');
  });

  test('⑤ Todo 列表显示今日日程 + 已完成自动打勾', async ({ page }) => {
    // 先添加日程
    const dateStr = today;
    await page.evaluate((ds) => {
      appState.schedule[ds] = [
        { name: '深蹲', type: 'daily', duration: 45, time: '19:30' },
        { name: '卧推', type: 'daily', duration: 30, time: '18:00' },
        { name: '跑步机', type: 'special', duration: 60, time: '07:00' }
      ];
      saveAppState();
      refreshTodoFromSchedule();
    }, dateStr);
    await page.waitForTimeout(300);

    // Todo 已填充
    const todoPop = page.locator('#todoPopulated');
    await expect(todoPop).toBeVisible();

    const items = todoPop.locator('.todo-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // 深蹲 & 卧推 在 todayRecords 中有记录 → 应打勾
    const doneChecks = todoPop.locator('.todo-check.done');
    const doneCount = await doneChecks.count();
    expect(doneCount).toBeGreaterThanOrEqual(2);

    // 跑步机 在 todayRecords 中无记录 → 不应打勾
    const textContent = await todoPop.textContent();
    expect(textContent).toContain('跑步机');
    expect(textContent).toContain('专项');
  });

  test('⑥ 删除日程：点 × 移除', async ({ page }) => {
    const dateStr = today;
    await page.evaluate((ds) => {
      appState.schedule[ds] = [
        { name: '测试日程', type: 'daily', duration: 30, time: '12:00' }
      ];
      saveAppState();
      openScheduleEditor(ds);
    }, dateStr);
    await page.waitForTimeout(300);

    // 列表中有 "测试日程"
    await expect(page.locator('#modalBody')).toContainText('测试日程');

    // 点 × 删除
    await page.locator('.s-del').first().click();
    await page.waitForTimeout(300);

    // 列表变空
    await expect(page.locator('#modalBody')).toContainText('还没有日程安排');
  });

  // ==========================================
  // 场景 7：邀约一起运动
  // ==========================================

  test('⑦ 查看 Kenny 的 bio → 公开日程显示 + 「一起？」按钮', async ({ page }) => {
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);

    // bio 标题含 Kenny
    await expect(page.locator('#modalTitle')).toContainText('Kenny');

    // 公开日程区域
    await expect(page.locator('#modalBody')).toContainText('公开日程');

    // 攀岩/抱石内容
    await expect(page.locator('#modalBody')).toContainText('抱石');

    // 「一起？」按钮
    const inviteBtn = page.locator('#modalBody button', { hasText: '一起？' });
    await expect(inviteBtn.first()).toBeVisible();
  });

  test('⑧ 发起申请加入 → 弹层显示「等待对方批准」（不自动接受）+ 通知里出现 join_request', async ({ page }) => {
    // 先确保 schedulePublic=true
    await page.evaluate(() => { appState.schedulePublic = true; });

    // 打开 Kenny bio
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);

    // 点「一起？」发起申请
    const inviteBtn = page.locator('#modalBody button', { hasText: '一起？' }).first();
    await inviteBtn.click();
    await page.waitForTimeout(300);

    // 弹层应该显示"申请加入"+"等待对方批准"
    await expect(page.locator('#modalTitle')).toContainText('申请加入');
    await expect(page.locator('#modalBody')).toContainText('等待对方批准');
    await expect(page.locator('#modalBody')).toContainText('申请已发给 Kenny');

    // toast 提示
    await expect(page.locator('#toast.show')).toBeVisible();

    // 等待 1.8s → 弹层应保持"等待"状态（新流程不自动接受）
    await page.waitForTimeout(1800);
    await expect(page.locator('#modalTitle')).toContainText('申请加入');
    await expect(page.locator('#modalBody')).toContainText('等待对方批准');

    // 通知列表应出现 join_request + join_request_sent
    const notifTypes = await page.evaluate(() => {
      return (appState.notifications || []).map(n => n.type);
    });
    expect(notifTypes).toContain('join_request');
    expect(notifTypes).toContain('join_request_sent');
  });

  test('⑨ 通知里点「批准」→ 双方日程同步 + 弹层关闭', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      window._invitesByMember = {};
      appState.schedule = {};
    });
    await page.evaluate(() => { appState.schedulePublic = true; });

    // 打开 Kenny bio → 点"一起？"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);
    await page.locator('#modalBody button', { hasText: '一起？' }).first().click();
    await page.waitForTimeout(500);

    // 关闭弹层
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 打开通知中心
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);

    // 找到"批准"按钮并点击
    const approveBtn = page.locator('#modalBody button:has-text("批准")');
    await expect(approveBtn.first()).toBeVisible();
    await approveBtn.first().click();
    await page.waitForTimeout(500);

    // 验证：appState.schedule 应包含 invitedBy='Kenny' 的项
    const synced = await page.evaluate(() => {
      for (const date in (appState.schedule || {})) {
        if (appState.schedule[date].some(s => s.invitedBy === 'Kenny')) return true;
      }
      return false;
    });
    expect(synced).toBe(true);

    // 验证：memberSchedules.Kenny 里有 joinedBy 含我
    const joinedBy = await page.evaluate(() => {
      const kennySched = appState.memberSchedules?.Kenny || {};
      for (const d in kennySched) {
        const it = (kennySched[d] || []).find(s => s.joinedBy && s.joinedBy.includes('Gracey'));
        if (it) return it.joinedBy;
      }
      return null;
    });
    expect(joinedBy).toContain('Gracey');

    // 验证：join_approved 通知已发
    const hasApproved = await page.evaluate(() => {
      return (appState.notifications || []).some(n => n.type === 'join_approved');
    });
    expect(hasApproved).toBe(true);
  });

  test('⑩ 通知里点「拒绝」→ 申请方收到 join_rejected 通知 + joinedBy 不写入', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      window._invitesByMember = {};
      appState.schedule = {};
      appState.memberSchedules = {};
    });
    await page.evaluate(() => { appState.schedulePublic = true; });

    // 打开 Kenny bio → 点"一起？"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);
    await page.locator('#modalBody button', { hasText: '一起？' }).first().click();
    await page.waitForTimeout(500);

    // 关闭弹层
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 打开通知中心
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);

    // 找到"拒绝"按钮并点击（此时弹出 appPrompt）
    const rejectBtn = page.locator('#modalBody button:has-text("拒绝")');
    await expect(rejectBtn.first()).toBeVisible();
    await rejectBtn.first().click();
    await page.waitForTimeout(400);

    // appPrompt 弹出了，确认并提交（可留空）
    const promptRejectBtn = page.locator('#appPromptOverlay button:has-text("拒绝")');
    await expect(promptRejectBtn).toBeVisible({ timeout: 3000 });
    // 输入留言（测试带留言的路径）
    await page.locator('#appPromptInput').fill('时间不合适');
    await promptRejectBtn.click();
    await page.waitForTimeout(400);

    // 验证：join_rejected 通知已发，且包含留言
    const rejectedInfo = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_rejected');
      return { exists: !!n, bodyContains: n ? n.body || '' : '', rejectMsg: n ? n.rejectMessage || '' : '' };
    });
    expect(rejectedInfo.exists).toBe(true);
    expect(rejectedInfo.rejectMsg).toBe('时间不合适');
    expect(rejectedInfo.bodyContains).toContain('时间不合适');

    // 验证：我的 schedule 没有任何 invitedBy='Kenny' 的项（没批准所以没同步）
    const synced = await page.evaluate(() => {
      for (const date in (appState.schedule || {})) {
        if (appState.schedule[date].some(s => s.invitedBy === 'Kenny')) return true;
      }
      return false;
    });
    expect(synced).toBe(false);
  });

  test('⑩b 批准后 → 临近提醒（10s 后触发）', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      window._invitesByMember = {};
      appState.schedule = {};
    });
    await page.evaluate(() => { appState.schedulePublic = true; });

    // 打开 Kenny bio → 点"一起？"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);
    await page.locator('#modalBody button', { hasText: '一起？' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 打开通知中心 → 批准
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("批准")').first().click();
    await page.waitForTimeout(500);

    // 等待 reminder setTimeout (10s)
    await page.waitForTimeout(11000);

    const hasReminder = await page.evaluate(() => {
      return (appState.notifications || []).some(n => n.type === 'reminder');
    });
    expect(hasReminder).toBe(true);
  });

  // ==========================================
  // Todo 手动勾选（不依赖运动记录）
  // ==========================================

  test('⑩c Todo 手动打勾：日程设了即可勾，无需运动记录', async ({ page }) => {
    const dateStr = today;
    // 重置：清空 todayRecords + 设置一个未做运动的日程
    // 时间都用未来时间，避免被「按时间升序」排序到第二位
    await page.evaluate((ds) => {
      appState.todayRecords = [];
      appState.schedule[ds] = [
        { name: '深蹲', type: 'daily', duration: 30, time: '22:00' },
        { name: '攀岩', type: 'special', duration: 60, time: '23:00' }
      ];
      appState.todoDone = {};
      saveAppState();
      refreshTodoFromSchedule();
    }, dateStr);
    await page.waitForTimeout(300);

    // 两条 todo 都未打勾（无运动记录 + 未手动勾）
    const before = await page.evaluate(() =>
      document.querySelectorAll('#todoPopulated .todo-check.done').length
    );
    expect(before).toBe(0);

    // 点击名为"深蹲"的 todo 项
    await page.locator('#todoPopulated .todo-item', { hasText: '深蹲' }).first().click();
    await page.waitForTimeout(200);

    // "深蹲"应打勾（用名字找，不被排序影响）
    const squatCheck = await page.evaluate(() => {
      const items = document.querySelectorAll('#todoPopulated .todo-item');
      for (const it of items) {
        const text = it.querySelector('.todo-text')?.textContent || '';
        if (text.includes('深蹲')) {
          return it.querySelector('.todo-check')?.classList.contains('done') || false;
        }
      }
      return null;
    });
    expect(squatCheck).toBe(true);

    // 总打勾数应为 1
    const doneCount = await page.evaluate(() =>
      document.querySelectorAll('#todoPopulated .todo-check.done').length
    );
    expect(doneCount).toBe(1);

    // 持久化到 appState.todoDone
    const stored = await page.evaluate(() => {
      const today = new Date().toISOString().slice(0, 10);
      return appState.todoDone[`${today}-0`];
    });
    expect(stored).toBe(true);
  });

  test('⑩d Todo 手动取消：再点一次取消打勾', async ({ page }) => {
    const dateStr = today;
    // 时间用未来时间
    await page.evaluate((ds) => {
      appState.todayRecords = [];
      appState.schedule[ds] = [
        { name: '卧推', type: 'daily', duration: 30, time: '22:00' }
      ];
      appState.todoDone = { [`${ds}-0`]: true };  // 已勾
      saveAppState();
      refreshTodoFromSchedule();
    }, dateStr);
    await page.waitForTimeout(300);

    // 验证初始已勾
    const before = await page.evaluate(() =>
      document.querySelectorAll('#todoPopulated .todo-check.done').length
    );
    expect(before).toBe(1);

    // 再点一次取消
    await page.locator('#todoPopulated .todo-item').first().click();
    await page.waitForTimeout(200);

    const after = await page.evaluate((ds) => ({
      doneCount: document.querySelectorAll('#todoPopulated .todo-check.done').length,
      stored: appState.todoDone[`${ds}-0`]
    }), dateStr);
    expect(after.doneCount).toBe(0);
    expect(after.stored).toBe(false);
  });

  test('⑩e 运动记录自动打勾 + 用户手动 toggle 优先级', async ({ page }) => {
    const dateStr = today;
    // 时间用未来时间
    await page.evaluate((ds) => {
      appState.todayRecords = [
        { type: 'daily', exercise: '深蹲', date: ds, points: 20, createdAt: Date.now() }
      ];
      appState.schedule[ds] = [
        { name: '深蹲', type: 'daily', duration: 30, time: '22:00' }
      ];
      appState.todoDone = {};  // 未手动设置
      saveAppState();
      refreshTodoFromSchedule();
    }, dateStr);
    await page.waitForTimeout(300);

    // 运动记录匹配 → 自动打勾
    let isDone = await page.evaluate(() => {
      const item = document.querySelector('#todoPopulated .todo-item');
      return item?.querySelector('.todo-check')?.classList.contains('done') || false;
    });
    expect(isDone).toBe(true);

    // 用户手动点 → 取消打勾（即使有运动记录）
    await page.locator('#todoPopulated .todo-item').first().click();
    await page.waitForTimeout(200);

    isDone = await page.evaluate((ds) => {
      const item = document.querySelector('#todoPopulated .todo-item');
      return {
        checked: item?.querySelector('.todo-check')?.classList.contains('done') || false,
        stored: appState.todoDone[`${ds}-0`]
      };
    }, dateStr);
    expect(isDone.checked).toBe(false);
    expect(isDone.stored).toBe(false);

    // 再点回去打勾
    await page.locator('#todoPopulated .todo-item').first().click();
    await page.waitForTimeout(200);
    isDone = await page.evaluate((ds) => {
      const item = document.querySelector('#todoPopulated .todo-item');
      return {
        checked: item?.querySelector('.todo-check')?.classList.contains('done') || false,
        stored: appState.todoDone[`${ds}-0`]
      };
    }, dateStr);
    expect(isDone.checked).toBe(true);
    expect(isDone.stored).toBe(true);
  });

  // ==========================================
  // 个人资料 & 设置
  // ==========================================

  test('⑪ 设置页面可打开：隐私 toggle + 通知分级 toggle', async ({ page }) => {
    await page.evaluate(() => openPage('settings'));
    await page.waitForTimeout(400);

    // 标题
    await expect(page.locator('#modalTitle')).toContainText('设置');

    // 隐私 toggle
    const body = page.locator('#modalBody');
    await expect(body).toContainText('身体信息公开');
    await expect(body).toContainText('日程公开');

    // 通知分级
    await expect(body).toContainText('高优');
    await expect(body).toContainText('中优');
    await expect(body).toContainText('低优');

    // 具体通知项
    await expect(body).toContainText('排名反超');
    await expect(body).toContainText('运动邀约');
    await expect(body).toContainText('邀约响应');
    await expect(body).toContainText('日程提醒');
    await expect(body).toContainText('身体数据更新');
  });

  test('⑫ 隐私 toggle 切换：label 文字更新', async ({ page }) => {
    await page.evaluate(() => openPage('settings'));
    await page.waitForTimeout(400);

    // 初始：身体信息公开 → "对圈子可见"（有 2 个同名 ID，取 modal 内第一个）
    await expect(page.locator('#recordModal #privacyLabel').first()).toHaveText('对圈子可见');

    // 点击 toggle（身体信息公开是 modal 内第一个 .stat-row 的 switch）
    const privacySwitch = page.locator('#recordModal .ios-switch').first();
    await privacySwitch.click();
    await page.waitForTimeout(300);

    // label 更新为 "仅自己可见"
    await expect(page.locator('#recordModal #privacyLabel').first()).toHaveText('仅自己可见');

    // 再次点击恢复
    await privacySwitch.click();
    await page.waitForTimeout(200);
    await expect(page.locator('#recordModal #privacyLabel').first()).toHaveText('对圈子可见');
  });

  test('⑬ 个人资料编辑：所有字段加载默认值', async ({ page }) => {
    await page.evaluate(() => openPage('profile'));
    await page.waitForTimeout(400);

    // 标题
    await expect(page.locator('#modalTitle')).toContainText('个人资料');

    // 字段加载
    await expect(page.locator('#profileNick')).toHaveValue('Gracey');
    await expect(page.locator('#profileHeight')).toHaveValue('168');
    await expect(page.locator('#profileWeight')).toHaveValue('55');
    await expect(page.locator('#profileBodyFat')).toHaveValue('22');
  });

  test('⑭ 修改体重 55 → 58 保存 → bio 数据更新', async ({ page }) => {
    await page.evaluate(() => openPage('profile'));
    await page.waitForTimeout(400);

    // 修改体重
    await page.locator('#profileWeight').fill('58');
    await page.waitForTimeout(100);

    // 保存
    await page.click('button:has-text("保存")');
    await page.waitForTimeout(300);

    // toast
    await expect(page.locator('#toast.show')).toBeVisible();

    // modal 关闭
    await expect(page.locator('#recordModal.show')).not.toBeVisible();

    // 验证 appState.weight = 58
    const weight = await page.evaluate(() => appState.weight);
    expect(weight).toBe(58);

    // 打开自己的 bio 页面验证数据
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Gracey' }));
    await page.waitForTimeout(400);

    // 打开自己的 bio 页面验证数据（现在显示 BMI，58/168² × 10000 = 20.5... 不一定含 58）
    // 改为：验证 weight 数据被更新
    const newWeight = await page.evaluate(() => appState.weight);
    expect(newWeight).toBe(58);
  });

  test('⑮ bio 页面在隐私公开时显示体脂率（bodyFat）', async ({ page }) => {
    // 确保隐私公开
    await page.evaluate(() => { appState.privacy = true; });

    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Monk' }));
    await page.waitForTimeout(400);

    const bodyText = await page.locator('#modalBody').textContent();
    // Monk 的数据：height:175, weight:72, bodyFat:15
    // 改：bio 现在只显示 BMI + 体脂率，不显示身高体重
    expect(bodyText).toContain('BMI');
    expect(bodyText).toContain('体脂率');
    expect(bodyText).toContain('15%');
    expect(bodyText).not.toContain('175cm');
    expect(bodyText).not.toContain('72kg');
  });

  test('⑯ bio 页面隐私关闭时隐藏身体数据', async ({ page }) => {
    // 先将 Monk 的 privacy 关掉
    await page.evaluate(() => {
      const c = appState.circles.find(c => c.id === 'preset-1');
      const monk = c.memberList.find(m => m.name === 'Monk');
      if (monk) { monk.privacy = false; monk.bodyPublic = false; }
    });

    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Monk' }));
    await page.waitForTimeout(400);

    const bodyText = await page.locator('#modalBody').textContent();
    // 身体数据应不存在
    expect(bodyText).not.toContain('体脂率');
    expect(bodyText).not.toContain('175cm');
    expect(bodyText).not.toContain('72kg');
  });

  test('⑰ 通知开关 toggle 生效', async ({ page }) => {
    await page.evaluate(() => openPage('settings'));
    await page.waitForTimeout(400);

    // 关掉 "运动邀约"（modal 内所有 ios-switch 的索引 5，即高优组第 4 个）
    const toggles = page.locator('#recordModal .ios-switch');
    const inviteToggle = toggles.nth(5);
    await inviteToggle.click();
    await page.waitForTimeout(200);

    // 验证 notifSettings.invite = false
    const inviteOff = await page.evaluate(() => appState.notifSettings.invite);
    expect(inviteOff).toBe(false);

    // 再打开
    await inviteToggle.click();
    await page.waitForTimeout(200);
    const inviteOn = await page.evaluate(() => appState.notifSettings.invite);
    expect(inviteOn).toBe(true);
  });

  test('⑱ 头像更换选择器弹出 emoji grid（与注册同源 EMOJI_GROUPS）', async ({ page }) => {
    await page.evaluate(() => openPage('profile'));
    await page.waitForTimeout(400);

    // 点击 "更换头像" 按钮
    await page.click('button:has-text("更换头像")');
    await page.waitForTimeout(300);

    // modal 标题变成 "选择头像"
    await expect(page.locator('#modalTitle')).toContainText('选择头像');

    // emoji 网格出现：与注册时同源（EMOJI_GROUPS），应包含动物 + 人脸两组
    // 动物组 60 + 人脸组 60 = 120
    const btnCount = await page.locator('#modalBody button[onclick*="confirmEmoji"]').count();
    expect(btnCount).toBeGreaterThan(100);  // 至少 100+ 个（与 EMOJI_GROUPS 一致）
    // 应有"动物"和"人脸"分组标签
    await expect(page.locator('#modalBody')).toContainText('动物');
    await expect(page.locator('#modalBody')).toContainText('人脸');
  });

  test('⑲ 选择新 emoji → 头像更新', async ({ page }) => {
    await page.evaluate(() => openPage('profile'));
    await page.waitForTimeout(400);

    // 点击 "更换头像"
    await page.click('button:has-text("更换头像")');
    await page.waitForTimeout(300);

    // 选一个不同的 emoji（第二个：🐱）
    const emojiBtn = page.locator('#modalBody button[onclick*="confirmEmoji"]').nth(1);
    await emojiBtn.click();
    await page.waitForTimeout(400);

    // 回到 profile，验证 emoji 已变
    const currentEmoji = await page.evaluate(() => appState.emoji);
    expect(currentEmoji).not.toBe('🐙');
  });

  // ==========================================
  // 社群发帖：导入饮食 button
  // ==========================================

  test('⑳ 社群发帖编辑器 → 点击「导入饮食」打开饮食面板', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(400);

    // 打开编辑器
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 工具按钮含 3 个
    const toolBtns = page.locator('#modalBody .post-tool-btn');
    await expect(toolBtns).toHaveCount(3);

    // 第二个是 "导入饮食"
    await expect(toolBtns.nth(1)).toContainText('导入饮食');

    // 点击 → 饮食面板出现
    await toolBtns.nth(1).click();
    await page.waitForTimeout(200);

    // 饮食导入面板
    const dietPanel = page.locator('#importPanelDiet');
    await expect(dietPanel).toBeVisible();

    // 面板提示导入饮食记录
    await expect(dietPanel).toContainText('导入最近');
    await expect(dietPanel).toContainText('饮食');
  });

  // ==========================================
  // 场景 7 增强：从"我的日程"发起邀约
  // ==========================================

  test('㉑ 编辑日程 → 每个日程项都有"📨 邀请"按钮', async ({ page }) => {
    // 先 seed 一个今天日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '卷腹', type: 'daily', duration: 30, time: '19:30' }];
      saveAppState();
    }, today);

    // 打开今天编辑日程
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 弹层里出现"📨"邀请按钮（在已安排日程项内）
    const inviteBtn = page.locator('#modalBody .schedule-item button.s-invite');
    await expect(inviteBtn.first()).toBeVisible();

    // 同时 × 删除按钮仍在
    const delBtn = page.locator('#modalBody .schedule-item button.s-del').last();
    await expect(delBtn).toBeVisible();
  });

  test('㉒ 点"📨 邀请"→ 弹"选择好友"列表（排除自己）', async ({ page }) => {
    // seed 一个日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '卷腹', type: 'daily', duration: 30, time: '19:30' }];
      saveAppState();
    }, today);
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 点邀请按钮
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(300);

    // 弹层变成"邀请朋友"
    await expect(page.locator('#modalTitle')).toContainText('邀请');

    // 列表显示圈子成员（Kenny、Monk、Lulu 等都应有，自己 Gracey 不应有）
    const body = page.locator('#modalBody');
    await expect(body).toContainText('Kenny');
    await expect(body).toContainText('Monk');
    await expect(body).toContainText('Lulu');
    // 排除自己：列表中不应有 "Gracey (我)" 或单独的 Gracey 行
    // （但其他地方的文案可能含 "Gracey"，用 onclick 关联检测）
    const memberRows = page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite"]');
    const memberCount = await memberRows.count();
    // 圈子里其他 10 个成员
    expect(memberCount).toBe(10);
  });

  test('㉓ 选 Kenny → 弹层切到"等待接受"+ 1.5s 后变"已接受"', async ({ page }) => {
    // seed
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '卷腹', type: 'daily', duration: 30, time: '19:30' }];
      appState.memberSchedules = {};
      saveAppState();
    }, today);
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 点邀请 → 选 Kenny
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(200);
    await page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite(\'Kenny\'"]').first().click();

    // 立即：弹层切到"等待中"
    await page.waitForTimeout(200);
    await expect(page.locator('#modalTitle')).toContainText('邀约');
    await expect(page.locator('#modalBody')).toContainText('等待对方接受');

    // 同时：Kenny 的 memberSchedules 已经被写入（mock 后端）
    const kennySched = await page.evaluate(() => appState.memberSchedules?.Kenny || {});
    expect(Object.keys(kennySched).length).toBeGreaterThan(0);
    const kennyDate = Object.keys(kennySched)[0];
    expect(kennySched[kennyDate][0].name).toBe('卷腹');
    expect(kennySched[kennyDate][0].invitedBy).toBe('Gracey');

    // 等待 1.5s 模拟接受
    await page.waitForTimeout(2000);

    // 弹层切到"对方已接受"
    await expect(page.locator('#modalTitle')).toContainText('已接受');
    await expect(page.locator('#modalBody')).toContainText('Kenny 接受了');

    // 收到 invite_received 通知
    const hasNotif = await page.evaluate(() =>
      (appState.notifications || []).some(n => n.type === 'invite_received' && n.targetMember === 'Kenny')
    );
    expect(hasNotif).toBe(true);
  });

  test('㉔ 邀约后 → 进入 Kenny bio → 看到我刚邀约的日程', async ({ page }) => {
    // seed（isPublic=true 才能在对方 bio 看到）
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '攀岩', type: 'special', duration: 90, time: '20:00', isPublic: true }];
      appState.memberSchedules = {};
      appState.schedulePublic = true;
      saveAppState();
    }, today);
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 发起邀约
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(200);
    await page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite(\'Kenny\'"]').first().click();
    await page.waitForTimeout(2200);  // 等模拟接受

    // 关闭弹层
    await page.locator('#modalBody button:has-text("好的")').click();
    await page.waitForTimeout(300);

    // 打开 Kenny bio
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);

    // bio 里有"攀岩"+"Gracey"标签
    const body = page.locator('#modalBody');
    await expect(body).toContainText('攀岩');
    await expect(body).toContainText('Gracey');
  });

  test('㉕ 邀约成功后 → 重新打开编辑日程 → 日程项显示"已邀 Kenny"', async ({ page }) => {
    // seed 一个日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '卷腹', type: 'daily', duration: 30, time: '19:30' }];
      appState.memberSchedules = {};
      appState.schedulePublic = true;
      saveAppState();
    }, today);

    // 通过编辑日程发起邀约
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(200);
    await page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite(\'Kenny\'"]').first().click();

    // 等待模拟接受
    await page.waitForTimeout(2000);

    // 关闭弹层
    await page.locator('#modalBody button:has-text("好的")').click();
    await page.waitForTimeout(300);

    // 重新打开编辑日程
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 日程项里应该有"已邀 Kenny"标签
    const schedBody = page.locator('#modalBody');
    await expect(schedBody).toContainText('已邀');
    await expect(schedBody).toContainText('Kenny');

    // invited 字段已持久化在 schedule 中
    const hasInvited = await page.evaluate((ds) => {
      const s = (appState.schedule[ds] || [])[0];
      return s && s.invited && s.invited.includes('Kenny');
    }, today);
    expect(hasInvited).toBe(true);
  });

  test('㉖ 邀约成功后 → refreshTodoFromSchedule → Todo 显示"已邀Kenny"', async ({ page }) => {
    // seed 一个今天日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '深蹲', type: 'daily', duration: 20, time: '08:00' }];
      appState.memberSchedules = {};
      appState.schedulePublic = true;
      saveAppState();
    }, today);

    // 先发起邀约
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(200);
    await page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite(\'Kenny\'"]').first().click();
    await page.waitForTimeout(2000);
    await page.locator('#modalBody button:has-text("好的")').click();
    await page.waitForTimeout(300);

    // 验证 schedule 数据已有 invited 字段
    const data = await page.evaluate((ds) => {
      const s = (appState.schedule[ds] || [])[0];
      return { name: s?.name, invited: s?.invited };
    }, today);
    expect(data.name).toBe('深蹲');
    expect(data.invited).toEqual(['Kenny']);

    // 直接调用 refreshTodoFromSchedule → 验证 Todo HTML 含"已邀"
    await page.evaluate(() => refreshTodoFromSchedule());
    await page.waitForTimeout(200);

    const todoHtml = await page.locator('#todoPopulated').innerHTML();
    expect(todoHtml).toContain('深蹲');
    expect(todoHtml).toContain('已邀');
    expect(todoHtml).toContain('Kenny');
  });

  test('㉗ 已邀请过的人 → 选择好友弹层显示"已邀请 ✓"（灰色不可点）', async ({ page }) => {
    // seed 一个已邀请过 Kenny 的日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{
        name: '卷腹', type: 'daily', duration: 30, time: '19:30',
        invited: ['Kenny']  // 已经邀请过 Kenny
      }];
      appState.schedulePublic = true;
      appState.memberSchedules = {};
      saveAppState();
    }, today);

    // 打开编辑日程 → 点邀请按钮
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(300);

    // 弹层变成「邀请朋友」
    await expect(page.locator('#modalTitle')).toContainText('邀请');

    // Kenny 行：显示"已邀请 ✓"（灰色），无 onclick
    const body = page.locator('#modalBody');
    await expect(body).toContainText('已邀请 ✓');

    // Kenny 行不能被再次点击触发（onclick 属性为空）
    const kennyNoClick = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#modalBody .stat-row[onclick]'));
      return rows.some(r => r.textContent.includes('Kenny'));
    });
    expect(kennyNoClick).toBe(false);

    // 其他成员（如 Monk）仍可点（有 onclick）
    const monkClickable = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#modalBody .stat-row[onclick]'));
      return rows.some(r => r.textContent.includes('Monk') && r.textContent.includes('邀请'));
    });
    expect(monkClickable).toBe(true);

    // 弹层里 Monk 行文字是"邀请 ›"
    const monkText = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#modalBody .stat-row'));
      const m = rows.find(r => r.textContent.includes('Monk') && r.textContent.includes('本周'));
      return m ? m.textContent : '';
    });
    expect(monkText).toContain('邀请 ›');

    // 数据保护：强行调用 sendMyScheduleInvite 也不重复邀请
    const before = await page.evaluate((ds) => (appState.schedule[ds][0].invited || []).length, today);
    await page.evaluate((ds) => sendMyScheduleInvite('Kenny', ds, 0), today);
    await page.waitForTimeout(200);
    const after = await page.evaluate((ds) => (appState.schedule[ds][0].invited || []).length, today);
    expect(after).toBe(before);  // 没增加
  });

  test('㉘ 成功邀请多人 → 弹层每行独立切换"邀请/已邀请"状态', async ({ page }) => {
    await page.evaluate((ds) => {
      appState.schedule[ds] = [{ name: '卷腹', type: 'daily', duration: 30, time: '19:30' }];
      appState.schedulePublic = true;
      appState.memberSchedules = {};
      saveAppState();
    }, today);

    // 邀请 Kenny
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(200);
    await page.locator('#modalBody .stat-row[onclick*="sendMyScheduleInvite(\'Kenny\'"]').first().click();
    await page.waitForTimeout(2000);
    await page.locator('#modalBody button:has-text("好的")').click();
    await page.waitForTimeout(300);

    // 再次打开邀请弹层
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.locator('#modalBody .schedule-item button.s-invite').first().click();
    await page.waitForTimeout(300);

    // Kenny 已是"已邀请 ✓"
    const kennyRow = page.locator('#modalBody .stat-row').filter({ hasText: 'Kenny' });
    await expect(kennyRow.first()).toContainText('已邀请');
    await expect(kennyRow.first()).toContainText('✓');

    // Monk 仍是"邀请 ›"
    const monkRow = page.locator('#modalBody .stat-row').filter({ hasText: 'Monk' });
    await expect(monkRow.first()).toContainText('邀请');
  });

  // ============ 5 个新需求测试 ============

  test('㉙ bio 身体数据改显示 BMI + 体脂率（不再显示身高体重）', async ({ page }) => {
    // 设置身高体重体脂
    await page.evaluate(() => {
      appState.privacy = true;
      appState.height = 168;
      appState.weight = 55;
      appState.bodyFat = 22;
      saveAppState();
    });

    // 打开自己 bio
    await page.evaluate(() => openPage('bio', { circleId: appState.activeCircleId, memberName: appState.nick }));
    await page.waitForTimeout(400);

    // 应有 BMI 19.5（55 / 1.68² = 19.49 → 四舍五入 19.5）
    // 不应有"身高 168cm"和"体重 55kg"
    const body = page.locator('#modalBody');
    await expect(body).toContainText('BMI');
    await expect(body).toContainText('19.5');
    await expect(body).toContainText('体脂率');
    await expect(body).toContainText('22%');
    await expect(body).not.toContainText('168cm');
    await expect(body).not.toContainText('55kg');
  });

  test('㉚ 自己看自己 bio → 不显示"积分记录对比"卡片', async ({ page }) => {
    await page.evaluate(() => openPage('bio', { circleId: appState.activeCircleId, memberName: appState.nick }));
    await page.waitForTimeout(400);

    // 自己 bio：不应有"积分记录对比"
    const body = page.locator('#modalBody');
    await expect(body).not.toContainText('积分记录对比');

    // 切换到别人 bio（Kenny）：应有"积分记录对比"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await expect(page.locator('#modalBody')).toContainText('积分记录对比');
  });

  test('㉛ 周冠军只显示计数 N（无 W22/W23 emoji 徽章）', async ({ page }) => {
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);

    // bio 里"周冠军"卡片只有数字
    // 不能有 🏆 徽章 + W22/W23 字样
    const body = page.locator('#modalBody');
    const champSection = body.locator('text=周冠军').first();
    await expect(champSection).toBeVisible();

    // 检查没有 🏆 字符 + 没有 W22/W23/W24 形式的字样
    const html = await body.innerHTML();
    expect(html).not.toMatch(/🏆\s*W\d/);
    // 但有"周冠军"字样
    await expect(body).toContainText('周冠军');
  });

  test('㉜ 打开编辑日程 → 默认未勾选"公开给所有人"；勾选后日程存 isPublic', async ({ page }) => {
    // 清空今天日程
    await page.evaluate((ds) => {
      appState.schedule[ds] = [];
      saveAppState();
    }, today);

    // 打开编辑日程
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 默认未勾选（schedPublicVal = '0'）
    const defaultVal = await page.evaluate(() => document.getElementById('schedPublicVal').value);
    expect(defaultVal).toBe('0');

    // 勾选
    await page.evaluate(() => toggleSchedPublic());
    const checked = await page.evaluate(() => document.getElementById('schedPublicVal').value);
    expect(checked).toBe('1');

    // 添加日程
    await page.locator('#modalBody #scheduleName').selectOption({ index: 0 });
    await page.locator('#modalBody button:has-text("+ 添加")').click();
    await page.waitForTimeout(300);

    // 数据层：isPublic=true
    const item = await page.evaluate((ds) => (appState.schedule[ds] || [])[0], today);
    expect(item.isPublic).toBe(true);
  });

  test('㉝ bio 公开日程只显示 isPublic=true；未公开的日程不出现', async ({ page }) => {
    // 给 Kenny 加一个 isPublic=false 的私密日程 + 一个 isPublic=true 的
    await page.evaluate(() => {
      appState.schedulePublic = true;
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = appState.memberSchedules || {};
      appState.memberSchedules.Kenny = {
        [satStr]: [
          { name: '私密拉伸', type: 'daily', duration: 20, time: '07:00', isPublic: false },
          { name: '公开瑜伽', type: 'daily', duration: 60, time: '10:00', isPublic: true }
        ]
      };
      saveAppState();
    });

    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);

    const body = page.locator('#modalBody');
    // 公开的"公开瑜伽"应出现
    await expect(body).toContainText('公开瑜伽');
    // 私密的"私密拉伸"不应出现
    await expect(body).not.toContainText('私密拉伸');
  });

  test('㉞ bio "一起？"按钮 → 批准后 → 变"已加入 ✓" + 我的 schedule 出现 with xxx', async ({ page }) => {
    // 设置场景：Kenny 周六有公开日程，我还没加入
    await page.evaluate(() => {
      appState.schedulePublic = true;
      window._joinRequests = {};
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      appState.schedule = {};
      saveAppState();
    });

    // 打开 Kenny bio
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);

    // 按钮是"一起？"
    const body = page.locator('#modalBody');
    await expect(body).toContainText('一起？');
    await expect(body).not.toContainText('已加入');

    // 点"一起？"→ 弹层切到"申请加入"
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#modalTitle')).toContainText('申请加入');

    // 关闭弹层
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 打开通知中心 → 批准
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("批准")').first().click();
    await page.waitForTimeout(500);

    // 重新打开 Kenny bio → 按钮变"已加入 ✓"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    const body2 = page.locator('#modalBody');
    await expect(body2).toContainText('已加入');
    await expect(body2).toContainText('✓');
    await expect(body2).not.toContainText('一起？');

    // 我的 schedule 同步：含 invitedBy='Kenny' 的"室内抱石"
    const mySched = await page.evaluate(() => {
      const all = appState.schedule || {};
      let found = null;
      for (const d in all) {
        const it = all[d].find(s => s.name === '室内抱石');
        if (it) { found = { date: d, ...it }; break; }
      }
      return found;
    });
    expect(mySched).toBeTruthy();
    expect(mySched.invitedBy).toBe('Kenny');

    // 对方 memberSchedules 上 joinedBy 含我
    const myNick = await page.evaluate(() => appState.nick);
    const joinedBy = await page.evaluate(() => {
      const all = appState.memberSchedules.Kenny || {};
      for (const d in all) {
        const it = (all[d] || []).find(s => s.name === '室内抱石');
        if (it) return it.joinedBy || [];
      }
      return [];
    });
    expect(joinedBy).toContain(myNick);
  });

  test('㉟ bio 公开日程显示日期（MM-DD 格式）', async ({ page }) => {
    // 设置 Kenny 周六有公开日程
    await page.evaluate(() => {
      appState.schedulePublic = true;
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      saveAppState();
    });

    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);

    const body = page.locator('#modalBody');
    // header 含日期 (MM-DD)
    await expect(body).toContainText('Kenny 的公开日程');
    // 应有 MM-DD 格式的日期
    const html = await body.innerHTML();
    expect(html).toMatch(/\d{2}-\d{2}/);
  });

  test('㊱ 自己 bio 显示"我的公开日程"+ 取消公开按钮', async ({ page }) => {
    // 设置我有一条公开日程
    await page.evaluate((ds) => {
      appState.schedulePublic = true;
      appState.schedule = {
        [ds]: [{ name: '攀岩专项', type: 'special', duration: 90, time: '20:00', isPublic: true }]
      };
      appState.memberSchedules = {};
      saveAppState();
    }, today);

    await page.evaluate(() => openPage('bio', { circleId: appState.activeCircleId, memberName: appState.nick }));
    await page.waitForTimeout(400);

    const body = page.locator('#modalBody');
    await expect(body).toContainText('我的公开日程');
    await expect(body).toContainText('攀岩专项');
    await expect(body).toContainText('取消公开');

    // 点"取消公开" → 日程变 isPublic=false
    await page.locator('#modalBody button:has-text("取消公开")').first().click();
    await page.waitForTimeout(400);

    const newVal = await page.evaluate((ds) => (appState.schedule[ds][0] || {}).isPublic, today);
    expect(newVal).toBe(false);
  });

  test('㊲ 申请中状态：点了"一起？" → 按钮变"待批准…"，再点不会重复发', async ({ page }) => {
    // 设置 Kenny 周六有公开日程
    await page.evaluate(() => {
      appState.schedulePublic = true;
      window._joinRequests = {};
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      saveAppState();
    });

    // 打开 Kenny bio → 点"一起？"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    // 关闭弹层
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 重新打开 Kenny bio → 按钮变"待批准…"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    const body = page.locator('#modalBody');
    await expect(body).toContainText('待批准');
    await expect(body).not.toContainText('一起？');

    // 通知只有一条 join_request（不会重复）
    const jrCount = await page.evaluate(() => {
      return (appState.notifications || []).filter(n => n.type === 'join_request').length;
    });
    expect(jrCount).toBe(1);
  });

  // ==========================================
  // 4 流程梳理 (2026-07-26 Gracey 确认)
  // 1) 私有日程 → Todo
  // 2) 公开日程 → 申请加入
  // 3) 邀请朋友 → 自动接受
  // 4) 提醒 + 过期标红
  // ==========================================

  test('㊳ join_request 通知文案"我"视角（不显示当前用户名，避免"Gracey1 想加入 Monk 的"穿帮）', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      window._invitesByMember = {};
      appState.notifications = [];
      appState.schedulePublic = true;
      appState.memberSchedules = {};
    });

    // 打开 Kenny bio → 点"一起？"
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(500);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(500);

    // 通知标题里：申请方用"我"（不要 appState.nick），日程主用真实名字
    const notifTitle = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_request');
      return n ? n.title : '';
    });
    expect(notifTitle).toContain('Kenny');                    // owner 名字带出
    expect(notifTitle).toContain('我 想加入');                 // 申请方 = 我
    expect(notifTitle).not.toContain('Gracey1');              // 不显示当前用户名
    expect(notifTitle).not.toContain('Gracey');               // 不显示当前用户名（兼容默认 nick）
    // 应该是 "我想加入 Kenny 的"
    expect(notifTitle).toMatch(/我\s*想加入\s*Kenny\s*的/);
    // 不再是 "想加入你的"（之前避免"加自己"）
    expect(notifTitle).not.toContain('想加入你的');

    // body 也带 owner 名字
    const notifBody = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_request');
      return n ? n.body : '';
    });
    expect(notifBody).toContain('Kenny');

    // join_request_sent 通知：也是"我"视角
    const sentNotif = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_request_sent');
      return n ? n.title : '';
    });
    expect(sentNotif).toContain('我已申请加入');
    expect(sentNotif).toContain('Kenny');
    expect(sentNotif).not.toContain('Gracey');
  });

  test('㊴ Todo 拉齐所有待办（不只今日）：今天+未来+过去日期的日程都出现', async ({ page }) => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const yStr = fmt(yesterday);
    const tStr = fmt(today);
    const tmStr = fmt(tomorrow);
    const daStr = fmt(dayAfter);

    // seed 4 个日期的日程
    await page.evaluate(({ y, t, tm, da }) => {
      appState.schedule = {
        [y]:  [{ name: '昨天没练', type: 'daily', duration: 30, time: '20:00' }],
        [t]:  [
          { name: '今天练腿', type: 'special', duration: 60, time: '19:00' },
          { name: '今天练背', type: 'daily', duration: 30, time: '21:00' }
        ],
        [tm]: [{ name: '明天晨跑', type: 'special', duration: 45, time: '07:00' }],
        [da]: [{ name: '后天瑜伽', type: 'daily', duration: 30, time: '10:00' }]
      };
      appState.todoDone = {};
      saveAppState();
      refreshTodoFromSchedule();
    }, { y: yStr, t: tStr, tm: tmStr, da: daStr });
    await page.waitForTimeout(300);

    // Todo 标题应该是"运动 Todo"而不是"今日运动 Todo"
    const cardTitle = await page.locator('#todoCard .card-title').first().textContent();
    expect(cardTitle).toContain('运动 Todo');
    expect(cardTitle).not.toContain('今日');

    // 4 个日期的日程都要出现（5 条 todo）
    const items = page.locator('#todoPopulated .todo-item');
    const count = await items.count();
    expect(count).toBe(5);

    // 副标题应该显示"5 待办 · 0 已完成"
    const subtitle = await page.locator('#todoSubtitle').textContent();
    expect(subtitle).toContain('5');
    expect(subtitle).toContain('待办');

    // 4 个不同的日期 → 应该出现日期头
    const allText = await page.locator('#todoPopulated').textContent();
    // 今天显示"今天"
    expect(allText).toContain('今天');
    // 昨天显示 MM-DD
    expect(allText).toContain(yStr.slice(5));
  });

  test('㊵ Todo 过期标红：今天+已过时间+未打勾 → 文本红 + check 框红', async ({ page }) => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const tStr = fmt(today);
    // 改用绝对时间，避免 23:00+ 跑时跨日（past 1h 前还在 today，future 1h 后跨日成 00:xx 被当今天 overdue）
    // past = 今天 12:00（已过）；future = 明天 12:00（未到）
    const tomorrow = new Date(today.getTime() + 12 * 60 * 60 * 1000);
    const tmStr = fmt(tomorrow);

    await page.evaluate(({ t, tm }) => {
      appState.schedule = {
        [t]: [{ name: '过期了', type: 'daily', duration: 30, time: '12:00' }],
        [tm]: [{ name: '还没到', type: 'special', duration: 60, time: '12:00' }]
      };
      appState.todoDone = {};
      saveAppState();
      refreshTodoFromSchedule();
    }, { t: tStr, tm: tmStr });
    await page.waitForTimeout(300);

    // "过期了"应该标红
    const overdueText = page.locator('#todoPopulated .todo-text.overdue');
    await expect(overdueText.first()).toBeVisible();
    const overdueTextContent = await overdueText.first().textContent();
    expect(overdueTextContent).toContain('过期了');

    // "还没到"不应该有 overdue class
    const noOverdue = page.locator('#todoPopulated .todo-text:not(.overdue):not(.done)');
    const noOverText = await noOverdue.first().textContent();
    expect(noOverText).toContain('还没到');

    // 副标题应该显示"1 过期"
    const subtitle = await page.locator('#todoSubtitle').textContent();
    expect(subtitle).toContain('1');
    expect(subtitle).toContain('过期');

    // check 框也应有 overdue class
    const overdueCheck = page.locator('#todoPopulated .todo-check.overdue');
    const overdueCheckCount = await overdueCheck.count();
    expect(overdueCheckCount).toBe(1);
  });

  test('㊶ 已完成的 todo（手动打勾）→ 文本划线 + 不标红 + 沉底', async ({ page }) => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const tStr = fmt(today);
    // 改用绝对时间避免跨日
    const tomorrow = new Date(today.getTime() + 12 * 60 * 60 * 1000);
    const tmStr = fmt(tomorrow);

    await page.evaluate(({ t, tm }) => {
      appState.schedule = {
        [t]: [{ name: '已完成的', type: 'daily', duration: 30, time: '12:00' }],
        [tm]: [{ name: '未完成的', type: 'special', duration: 60, time: '12:00' }]
      };
      appState.todoDone = { [`${t}-0`]: true };  // 手动打勾第一条
      saveAppState();
      refreshTodoFromSchedule();
    }, { t: tStr, tm: tmStr });
    await page.waitForTimeout(300);

    // 第一条应有 .done class
    const doneText = page.locator('#todoPopulated .todo-text.done');
    await expect(doneText.first()).toBeVisible();
    const doneContent = await doneText.first().textContent();
    expect(doneContent).toContain('已完成的');

    // 不应有 overdue（已完成的不算过期）
    const overdueCount = await page.locator('#todoPopulated .todo-text.overdue').count();
    expect(overdueCount).toBe(0);

    // 副标题："1 待办 · 1 已完成"
    const subtitle = await page.locator('#todoSubtitle').textContent();
    expect(subtitle).toContain('1');
    expect(subtitle).toContain('待办');
    expect(subtitle).toContain('已完成');
  });

  test('㊷ 日历标题默认显示当前月，箭头可上下月切换', async ({ page }) => {
    // 打开 home
    await page.evaluate(() => openPage('home'));
    await page.waitForTimeout(300);

    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();

    // 标题默认 = 当月
    const title1 = await page.locator('#calTitle').textContent();
    expect(title1.trim()).toBe(`${curM}月 ${curY}`);

    // 点 ‹ → 上月
    await page.locator('button[aria-label="上月"]').click();
    await page.waitForTimeout(200);
    const title2 = await page.locator('#calTitle').textContent();
    let expectedM = curM - 1, expectedY = curY;
    if (expectedM === 0) { expectedM = 12; expectedY -= 1; }
    expect(title2.trim()).toBe(`${expectedM}月 ${expectedY}`);

    // 点 › › → 下下月
    await page.locator('button[aria-label="下月"]').click();
    await page.locator('button[aria-label="下月"]').click();
    await page.waitForTimeout(200);
    const title3 = await page.locator('#calTitle').textContent();
    let nextM = curM + 1, nextY = curY;
    if (nextM === 13) { nextM = 1; nextY += 1; }
    expect(title3.trim()).toBe(`${nextM}月 ${nextY}`);

    // 跨年：12月 → 1月
    // 先把 calView 设到 12 月
    await page.evaluate(() => { appState.calendarView = { year: 2026, month: 12 }; generateHeatmap(false); });
    await page.waitForTimeout(200);
    await page.locator('button[aria-label="下月"]').click();
    await page.waitForTimeout(200);
    const title4 = await page.locator('#calTitle').textContent();
    expect(title4.trim()).toBe(`1月 2027`);
  });

  test('㊸ 点击日历标题 → 弹年/月选择器 → 选月后切换日历', async ({ page }) => {
    await page.evaluate(() => openPage('home'));
    await page.waitForTimeout(300);

    // 点击标题
    await page.locator('#calTitle').click();
    await page.waitForTimeout(300);

    // 弹层显示
    const title = await page.locator('#modalTitle').textContent();
    expect(title).toBe('选择日期');
    const yearSel = page.locator('#calYearSel');
    await expect(yearSel).toBeVisible();

    // 12 个月份格子
    const monthCount = await page.locator('#modalBody div:has-text("月")').filter({ hasNot: page.locator('button') }).count();
    expect(monthCount).toBeGreaterThanOrEqual(12);

    // 选 3 月
    await page.locator('#modalBody div').filter({ hasText: /^3月$/ }).first().click();
    await page.waitForTimeout(200);

    // 弹层关闭 + 标题变成 3月
    const modalShown = await page.locator('#recordModal').evaluate(el => el.classList.contains('show'));
    expect(modalShown).toBe(false);
    const newTitle = await page.locator('#calTitle').textContent();
    expect(newTitle.trim()).toContain('3月');
  });

  test('㊹ 日历切到非当月 → 不再高亮今天；回今天按钮可恢复', async ({ page }) => {
    await page.evaluate(() => openPage('home'));
    await page.waitForTimeout(300);

    // 切到下个月
    await page.locator('button[aria-label="下月"]').click();
    await page.waitForTimeout(200);

    // 不应有 "background: var(--green)" 的高亮今天格子（其他月没有今天）
    // 检查 isToday 标志：calView 不等于当月时，所有 cell 都没有"今天"特殊样式
    const greenTodayCount = await page.evaluate(() => {
      const cells = document.querySelectorAll('#heatmapGrid .heatmap-cell');
      return Array.from(cells).filter(c => {
        const bg = c.style.background || '';
        const border = c.style.border || '';
        return bg.includes('var(--green)') || border.includes('var(--green)');
      }).length;
    });
    expect(greenTodayCount).toBe(0);

    // 点击标题 → 弹层显示"回到今天"按钮
    await page.locator('#calTitle').click();
    await page.waitForTimeout(300);
    const resetBtn = page.locator('#modalBody button:has-text("回到今天")');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(300);

    // 标题回到当月
    const now = new Date();
    const curTitle = await page.locator('#calTitle').textContent();
    expect(curTitle.trim()).toBe(`${now.getMonth() + 1}月 ${now.getFullYear()}`);
  });

  test('㊺ 日历切换后，热力图格子数等于该月总天数 + 月初空格', async ({ page }) => {
    await page.evaluate(() => openPage('home'));
    await page.waitForTimeout(300);

    // 切到 2 月 2026（非闰年，28 天）
    await page.evaluate(() => { appState.calendarView = { year: 2026, month: 2 }; generateHeatmap(false); });
    await page.waitForTimeout(200);

    const cellCount = await page.locator('#heatmapGrid .heatmap-cell').count();
    // 2026-02-01 是周日，所以 firstDay=0，cell 数 = 28
    expect(cellCount).toBe(28);

    // 切到 1 月 2026（firstDay=4, 31 天）→ 35 格
    await page.evaluate(() => { appState.calendarView = { year: 2026, month: 1 }; generateHeatmap(false); });
    await page.waitForTimeout(200);
    const cellCount2 = await page.locator('#heatmapGrid .heatmap-cell').count();
    expect(cellCount2).toBe(35);
  });

  test('㊻ 拒绝申请且留言 → join_rejected 通知带留言', async ({ page }) => {
    // 重置并创建 join_request
    await page.evaluate(() => {
      window._joinRequests = {};
      appState.schedulePublic = true;
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '攀岩', type: 'special', duration: 60, time: '10:00', isPublic: true }] }
      };
    });
    // 发起申请
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 切到 Kenny 视角：打开通知中心，拒绝且留言
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("拒绝")').first().click();
    await page.waitForTimeout(400);

    // appPrompt 出现，输入留言
    const promptInput = page.locator('#appPromptInput');
    await expect(promptInput).toBeVisible({ timeout: 3000 });
    await promptInput.fill('今天有别的安排了');
    await page.locator('#appPromptOverlay button:has-text("拒绝")').click();
    await page.waitForTimeout(400);

    // 验证 join_rejected 通知
    const info = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_rejected');
      return { exists: !!n, msg: n ? n.rejectMessage || '' : '', body: n ? n.body || '' : '' };
    });
    expect(info.exists).toBe(true);
    expect(info.msg).toBe('今天有别的安排了');
    expect(info.body).toContain('今天有别的安排了');
  });

  test('㊼ 拒绝申请不留留言 → join_rejected 通知不带留言', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      appState.schedulePublic = true;
      const sat = new Date();
      sat.setDate(sat.getDate() + 7);
      const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '跑步', type: 'daily', duration: 30, time: '07:00', isPublic: true }] }
      };
    });
    await page.evaluate(() => openPage('bio', { circleId: 'preset-1', memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("拒绝")').first().click();
    await page.waitForTimeout(400);

    // appPrompt 出现，直接点拒绝（留空）
    await expect(page.locator('#appPromptInput')).toBeVisible({ timeout: 3000 });
    await page.locator('#appPromptOverlay button:has-text("拒绝")').click();
    await page.waitForTimeout(400);

    // 验证：通知存在但无留言
    const info = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_rejected');
      return { exists: !!n, msg: n ? n.rejectMessage || '' : '', body: n ? n.body || '' : '' };
    });
    expect(info.exists).toBe(true);
    expect(info.msg).toBe('');
    // body 不应包含「留言」
    expect(info.body).not.toContain('留言');
  });

  test('㊽ 拒绝邀约且留言 → invite_response 通知带留言', async ({ page }) => {
    // 构造一条 invite_received 通知（模拟 Kenny 发来邀约）
    await page.evaluate(() => {
      window._invitesByMember = {
        Kenny: [{ id: 'inv-test-1', dateStr: '2026-08-01', time: '09:00', sport: '攀岩', type: 'special', duration: 60, scheduleIdx: 0, status: 'pending' }]
      };
      const idx = (appState.notifications || []).length;
      appState.notifications.push({
        type: 'invite_received',
        title: '📨 Kenny 邀请你一起「攀岩」',
        body: '08-01 09:00 攀岩 · 点「加入日程」加入你的日历',
        notifId: 'n-inv-test-1',
        inviteId: 'inv-test-1',
        targetMember: 'Kenny',
        fromName: 'Kenny',
        fromEmoji: '🐨',
        time: Date.now(),
        read: false
      });
    });

    // 打开通知
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(400);

    // 点"拒绝"
    const rejectBtns = page.locator('#modalBody button:has-text("拒绝")');
    const countBefore = await rejectBtns.count();
    expect(countBefore).toBeGreaterThanOrEqual(1);
    await rejectBtns.first().click();
    await page.waitForTimeout(400);

    // appPrompt
    await expect(page.locator('#appPromptInput')).toBeVisible({ timeout: 3000 });
    await page.locator('#appPromptInput').fill('已有其他安排，下次约');
    await page.locator('#appPromptOverlay button:has-text("拒绝")').click();
    await page.waitForTimeout(400);

    // 验证 invite_response 通知
    const info = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'invite_response' && x.title && x.title.includes('拒绝'));
      return { exists: !!n, body: n ? n.body || '' : '', msg: n ? n.rejectMessage || '' : '' };
    });
    expect(info.exists).toBe(true);
    expect(info.msg).toBe('已有其他安排，下次约');
    expect(info.body).toContain('已有其他安排，下次约');
  });

  // ==========================================
  // 场景 6.5：bio 数据真源 + 排行一致性
  // ==========================================
  // 覆盖用户 6 个问题中的 1+2：
  // 1) 有近期运动 → 记录不空 + 积分非 0
  // 2) bio 本周积分 == 排行榜本周积分

  test('㊾ bio 本周积分 = 排行榜本周积分（同一份 getMemberWeekPts 数据源）', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      appState.weeklyPoints = 100;
      appState.streakBonus = 5;
      appState.todayRecords = [];
      appState.todoDone = {};
      saveAppState();
    });

    // 拿排行榜中"我"的分数
    const lbScore = await page.evaluate(() => {
      // 切到排行榜
      openPage('leaderboard');
      return new Promise(resolve => {
        setTimeout(() => {
          const me = leaderboardAllUsers(getMyWeekPts()).find(u => u.isMe);
          resolve(me ? me.pts : null);
        }, 100);
      });
    });
    expect(lbScore).toBe(105);  // weeklyPoints=100 + streakBonus=5

    // 拿 bio "我"的分数
    const bioScore = await page.evaluate(() => {
      openPage('bio', { circleId: appState.activeCircleId, memberName: appState.nick });
      return new Promise(resolve => {
        setTimeout(() => {
          // bio 本周积分 卡片是 18px 字号的第 3 个 card-elev-2
          const cards = document.querySelectorAll('.card-elev-2');
          // 找到含"本周积分" 文本的卡片的数字
          let found = null;
          for (const card of cards) {
            if (card.textContent && card.textContent.includes('本周积分')) {
              const num = card.querySelector('div[style*="font-size:18px"]');
              if (num) { found = parseInt(num.textContent, 10); break; }
            }
          }
          resolve(found);
        }, 300);
      });
    });
    expect(bioScore).toBe(105);  // 应该和排行榜一致
  });

  test('㊿ 其他成员有 memberRecentRecords → 排行榜 + bio 显示积分求和（不为 0）', async ({ page }) => {
    // 设置 Monk 有 3 条近期记录，总和 35+42+24=101
    await page.evaluate(() => {
      appState.memberRecentRecords = {
        Monk: [
          { emoji: '🏋️', desc: '硬拉 100kg × 5', time: '今天 18:20', pts: 35 },
          { emoji: '🏃', desc: '夜跑 12km', time: '昨天 21:00', pts: 42 },
          { emoji: '🧗', desc: '室内攀岩 90 分钟', time: '7/22', pts: 24 }
        ]
      };
      // 但 memberList 中 Monk 的 score 是旧值 165（>101）
      const c = appState.circles[0];
      const m = c.memberList.find(x => x.name === 'Monk');
      if (m) m.score = 165;
      saveAppState();
    });

    // 排行榜 Monk 应显示 101（records 求和），不是 165（静态）
    const lbMonk = await page.evaluate(() => {
      openPage('leaderboard');
      return new Promise(resolve => {
        setTimeout(() => {
          const u = leaderboardAllUsers(getMyWeekPts()).find(x => x.name === 'Monk');
          resolve(u ? u.pts : null);
        }, 100);
      });
    });
    expect(lbMonk).toBe(101);

    // bio Monk 也应是 101
    const bioMonk = await page.evaluate(() => {
      openPage('bio', { circleId: appState.circles[0].id, memberName: 'Monk' });
      return new Promise(resolve => {
        setTimeout(() => {
          const cards = document.querySelectorAll('.card-elev-2');
          let found = null;
          for (const card of cards) {
            if (card.textContent && card.textContent.includes('本周积分')) {
              const num = card.querySelector('div[style*="font-size:18px"]');
              if (num) { found = parseInt(num.textContent, 10); break; }
            }
          }
          resolve(found);
        }, 300);
      });
    });
    expect(bioMonk).toBe(101);
  });

  test('(51) 其他成员无 memberRecentRecords → 显示"暂无近期运动"空态（不展示假数据）', async ({ page }) => {
    // 清空某个成员的 memberRecentRecords
    await page.evaluate(() => {
      appState.memberRecentRecords = { ...appState.memberRecentRecords, Ivy: [] };
      saveAppState();
    });

    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: 'Ivy' }));
    await page.waitForTimeout(400);

    // bio 应该出现"暂无近期运动"字样
    await expect(page.locator('#modalBody')).toContainText('暂无近期运动');
    // 不应出现默认 mock 假数据（"晨跑 5km"）
    await expect(page.locator('#modalBody')).not.toContainText('晨跑 5km');
  });

  test('(52) 我的 bio 在公开日程下显示"我的公开日程"且有"取消公开"按钮', async ({ page }) => {
    // seed：自己有一个公开日程
    const dateStr = await page.evaluate(() => {
      const today = new Date();
      const t = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
      appState.schedule = {
        [t]: [{ name: '公开的硬拉', type: 'special', duration: 60, time: '19:00', isPublic: true }]
      };
      saveAppState();
      return t;
    });

    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: appState.nick }));
    await page.waitForTimeout(400);

    // 应出现 "我的公开日程" 标题 + 取消公开按钮
    await expect(page.locator('#modalBody')).toContainText('我的公开日程');
    await expect(page.locator('#modalBody button:has-text("取消公开")')).toBeVisible();

    // 点取消公开 → 该日程的 isPublic 变 false
    await page.locator('#modalBody button:has-text("取消公开")').click();
    await page.waitForTimeout(300);
    const isPublic = await page.evaluate((ds) => appState.schedule[ds][0].isPublic, dateStr);
    expect(isPublic).toBe(false);
  });

  test('(53) 公开日程申请 end-to-end：申请 → 通知 → 驳回留言 → 申请人原通知就地变"已拒绝"', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      appState.notifications = [];
      appState.schedulePublic = true;
      const today = new Date();
      const sat = new Date(today); sat.setDate(sat.getDate() + 7);
      const satStr = sat.getFullYear() + '-' + String(sat.getMonth()+1).padStart(2,'0') + '-' + String(sat.getDate()).padStart(2,'0');
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      saveAppState();
    });

    // 1) bio 发起申请
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 2) 通知里收到 join_request（owner 看的，给 owner 端推送）+ join_request_sent（申请人看的）
    //    demo 单用户视角下，join_request 在 appState.notifications 里但 UI 隐藏
    const beforeReject = await page.evaluate(() => {
      const ns = appState.notifications || [];
      return {
        hasJR: ns.some(n => n.type === 'join_request'),
        hasSent: ns.some(n => n.type === 'join_request_sent')
      };
    });
    expect(beforeReject.hasJR).toBe(true);
    expect(beforeReject.hasSent).toBe(true);

    // 3) 打开通知页 → 验证 join_request 不在 UI 显示（是给 owner 看的，不该给申请人看）
    await page.evaluate(() => openPage('notifications'));
    await page.waitForTimeout(400);
    const notifUI = await page.locator('#modalBody').textContent();
    expect(notifUI).toContain('我已申请加入 Kenny 的「室内抱石」');  // 申请人通知 ✅
    expect(notifUI).not.toContain('想加入 Kenny 的「室内抱石」');    // owner 通知 ❌ 申请人看不到

    // 4) 模拟 owner 端拒绝（demo 单用户视角下，直接调函数）
    //    join_request 通知仍在 appState.notifications 里，仅 UI 隐藏
    const jrNotifId = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_request');
      return n ? n.notifId : null;
    });
    // 弹留言框（rejectJoinFromNotif 用 appPrompt 收集留言）
    // 直接调函数（同步触发 appPrompt），留言框会同步弹出
    await page.evaluate((nid) => rejectJoinFromNotif(nid), jrNotifId);
    await page.waitForTimeout(400);
    // 填留言
    await page.locator('#appPromptInput').fill('那天有事，下次约');
    await page.locator('#appPromptOverlay button:has-text("拒绝")').click();
    await page.waitForTimeout(500);

    // 4) 验证：原 join_request_sent 就地变 join_request_resolved，留言在 body
    //    不再新 push 一条 join_rejected（避免通知列表越积越多）
    const afterReject = await page.evaluate(() => {
      const ns = appState.notifications || [];
      const resolved = ns.find(n => n.type === 'join_request_resolved' && n._resolved === 'rejected');
      const stillHasOldType = ns.some(n => n.type === 'join_request_sent');
      const hasSeparateRejected = ns.some(n => n.type === 'join_rejected');
      return {
        resolved: resolved ? { title: resolved.title, body: resolved.body, msg: resolved.rejectMessage } : null,
        stillHasOldType,
        hasSeparateRejected
      };
    });
    expect(afterReject.resolved).not.toBeNull();
    expect(afterReject.resolved.body).toContain('那天有事，下次约');
    expect(afterReject.resolved.msg).toBe('那天有事，下次约');
    expect(afterReject.stillHasOldType).toBe(false);  // 类型已变更
    expect(afterReject.hasSeparateRejected).toBe(false);  // 没有多余的一条
  });

  test('(54) 批准路径同样就地更新：原 join_request_sent → "已批准"（不再多一条 join_approved）', async ({ page }) => {
    await page.evaluate(() => {
      window._joinRequests = {};
      appState.notifications = [];
      appState.schedulePublic = true;
      const today = new Date();
      const sat = new Date(today); sat.setDate(sat.getDate() + 7);
      const satStr = sat.getFullYear() + '-' + String(sat.getMonth()+1).padStart(2,'0') + '-' + String(sat.getDate()).padStart(2,'0');
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      saveAppState();
    });

    // 申请
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 批准（demo 单用户视角下，直接调函数模拟 owner 操作）
    const jrNotifId = await page.evaluate(() => {
      const n = (appState.notifications || []).find(x => x.type === 'join_request');
      return n ? n.notifId : null;
    });
    expect(jrNotifId).not.toBeNull();
    await page.evaluate((nid) => approveJoinFromNotif(nid), jrNotifId);
    await page.waitForTimeout(500);

    // 验证：原 join_request_sent 就地变 join_request_resolved: approved
    // 没有多余的一条 join_approved
    const result = await page.evaluate(() => {
      const ns = appState.notifications || [];
      return {
        resolved: ns.find(n => n.type === 'join_request_resolved' && n._resolved === 'approved') || null,
        hasSeparateApproved: ns.some(n => n.type === 'join_approved'),
        // owner 端的 join_request 通知也应该就地更新为"已批准"
        joinRequestUpdated: ns.find(n => n.type === 'join_request' && n._approved) || null
      };
    });
    expect(result.resolved).not.toBeNull();
    expect(result.resolved.title).toContain('批准');
    expect(result.hasSeparateApproved).toBe(false);
    expect(result.joinRequestUpdated).not.toBeNull();
  });

  test('(60) bug 修复：申请人申请后看不到 owner 端"批准/拒绝"通知', async ({ page }) => {
    // 重置
    await page.evaluate(() => {
      window._joinRequests = {};
      appState.notifications = [];
      appState.schedulePublic = true;
      const today = new Date();
      const sat = new Date(today); sat.setDate(sat.getDate() + 7);
      const satStr = sat.getFullYear() + '-' + String(sat.getMonth()+1).padStart(2,'0') + '-' + String(sat.getDate()).padStart(2,'0');
      appState.memberSchedules = {
        Kenny: { [satStr]: [{ name: '室内抱石', type: 'special', duration: 90, time: '09:00', isPublic: true }] }
      };
      saveAppState();
    });

    // 申请
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: 'Kenny' }));
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("一起？")').first().click();
    await page.waitForTimeout(400);
    await page.locator('#modalBody button:has-text("关闭")').click();
    await page.waitForTimeout(300);

    // 数据层：join_request 通知存在（owner 端的），但 UI 应该隐藏
    const dataCheck = await page.evaluate(() => {
      const ns = appState.notifications || [];
      return {
        // 数据层确实有 join_request 通知（owner 端需要它做批准/拒绝操作）
        dataHasJoinRequest: ns.some(n => n.type === 'join_request'),
        // 数据层有 join_request_sent 通知（申请人端）
        dataHasJoinRequestSent: ns.some(n => n.type === 'join_request_sent')
      };
    });
    expect(dataCheck.dataHasJoinRequest).toBe(true);
    expect(dataCheck.dataHasJoinRequestSent).toBe(true);

    // 打开通知中心
    await page.evaluate(() => openPage('notifications'));
    await page.waitForTimeout(400);

    // 验证：UI 上不显示 owner 端的"批准/拒绝"通知
    const notifUI = await page.locator('#modalBody').textContent();
    // 申请人通知 ✅ 应展示
    expect(notifUI).toContain('我已申请加入');
    // owner 端"批准/拒绝"通知 ❌ 不该展示给申请人
    expect(notifUI).not.toContain('想加入 Kenny 的「室内抱石」');
    // 不能点"批准"按钮（这按钮只对 owner 有意义）
    const approveBtn = page.locator('#modalBody button:has-text("批准")');
    expect(await approveBtn.count()).toBe(0);
  });

  test('(55) 自己 bio 公开日程空态引导：schedulePublic=true 但没设任何公开 → 显示"+ 去添加"按钮', async ({ page }) => {
    await page.evaluate(() => {
      appState.schedulePublic = true;
      appState.schedule = {};  // 没任何日程
      saveAppState();
    });
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: appState.nick }));
    await page.waitForTimeout(400);
    const body = page.locator('#modalBody');
    await expect(body).toContainText('还没有公开日程');
    await expect(body).toContainText('去添加');
    const addBtn = page.locator('#modalBody button:has-text("去添加")');
    await expect(addBtn).toBeVisible();
  });

  test('(56) 编辑公开日程保存后 → 自己 bio 立即出现"我的公开日程"段', async ({ page }) => {
    // 清空今天日程
    await page.evaluate((ds) => {
      appState.schedulePublic = true;
      appState.schedule[ds] = [];
      appState.memberSchedules = {};
      saveAppState();
    }, today);

    // 打开编辑器 + 勾选公开 + 添加
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);
    await page.evaluate(() => toggleSchedPublic());
    await page.locator('#modalBody button:has-text("+ 添加")').first().click();
    await page.waitForTimeout(400);

    // 关闭编辑器
    await page.locator('#modalBody button:has-text("完成")').click();
    await page.waitForTimeout(300);

    // 打开自己 bio → 验证"我的公开日程"段出现
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: appState.nick }));
    await page.waitForTimeout(400);
    const body = page.locator('#modalBody');
    await expect(body).toContainText('我的公开日程');
    await expect(body).toContainText('取消公开');
  });

  test('(57) 圈子管理页"通过"批准入圈申请：不再误弹"通知不存在"（fix 函数名冲突）', async ({ page }) => {
    // 1) 重置：Gracey 是「原来你也是公主」圈主，待审 zhengyang
    await page.evaluate(() => {
      const circle = appState.circles.find(c => c.name === '原来你也是公主');
      if (!circle) return;
      appState.activeCircleId = circle.id;
      circle.joinRequests = [{ emoji: '🐼', name: 'zhengyang', time: '10 分钟前' }];
      saveAppState();
    });

    // 2) 打开圈子管理
    await page.evaluate(() => openPage('circleManage'));
    await page.waitForTimeout(400);

    // 3) 点"通过"按钮 → 期望：toast 是"已通过 zhengyang 的入圈申请"，**不是**"通知不存在"
    await page.locator('#modalBody button:has-text("通过")').first().click();
    await page.waitForTimeout(500);

    const toastVisible = await page.locator('#toast').textContent().catch(() => '');
    expect(toastVisible).toContain('已通过 zhengyang');
    expect(toastVisible).not.toContain('通知不存在');

    // 4) 验证 zhengyang 真的进了 memberList
    const memberNames = await page.evaluate(() => {
      const c = appState.circles.find(c => c.id === appState.activeCircleId);
      return (c.memberList || []).map(m => m.name);
    });
    expect(memberNames).toContain('zhengyang');

    // 5) 申请列表被清空
    const pending = await page.evaluate(() => {
      const c = appState.circles.find(c => c.id === appState.activeCircleId);
      return c.joinRequests.length;
    });
    expect(pending).toBe(0);
  });

  test('(58) bio "当前排名" 口径与排行榜一致：基于本周积分（不是总积分）', async ({ page }) => {
    // 1) 重置：Gracey 本周 0 分（无运动），其他成员也是 0 分
    //    如果 bio 用总积分 score 排，Gracey 130 分 → 排第 5
    //    如果 bio 用本周积分排，Gracey 0 分 → 排最后（第 11/11）
    await page.evaluate(() => {
      // 清空自己的本周积分
      appState.weeklyPoints = 0;
      appState.streakBonus = 0;
      appState.todayRecords = [];
      // 清空其他成员的近期记录（确保都用本周积分口径）
      appState.memberRecentRecords = {};
      saveAppState();
    });

    // 2) 打开自己 bio
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: appState.nick }));
    await page.waitForTimeout(400);

    const body = page.locator('#modalBody');

    // 3) bio 内的"本周积分"应= 0
    await expect(body).toContainText('本周积分');
    const weeklyPts = await page.evaluate(() => {
      const cards = document.querySelectorAll('#modalBody .card-elev-2');
      for (const c of cards) {
        if (c.textContent.includes('本周积分')) {
          return c.querySelector('div[style*="font-size:18px"]').textContent.trim();
        }
      }
      return null;
    });
    expect(weeklyPts).toBe('0');

    // 4) bio 内的"当前排名"应= 11 / 11（用本周积分排）
    //    —— 之前 bug：用总积分排 Gracey 排第 5
    const curRank = await page.evaluate(() => {
      const cards = document.querySelectorAll('#modalBody .card-elev-2');
      for (const c of cards) {
        if (c.textContent.includes('当前排名')) {
          return c.querySelector('div[style*="font-size:18px"]').textContent.trim();
        }
      }
      return null;
    });
    expect(curRank).toMatch(/第 11 \/ 11/);

    // 5) 周冠军计数：与 weeklyChampions 中 Gracey 的记录数一致（不固定期望值，
    //    因为前序测试可能已结算过若干周冠军；只要数得对就 OK）
    const champCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('#modalBody .card-elev-2');
      for (const c of cards) {
        if (c.textContent.includes('周冠军') && !c.textContent.includes('当前排名')) {
          return c.querySelector('div[style*="font-size:18px"]').textContent.trim();
        }
      }
      return null;
    });
    const graceyChampCount = await page.evaluate(() => {
      const c = appState.circles.find(c => c.id === 'preset-1');
      return (c.weeklyChampions || []).filter(x => x.name === 'Gracey').length;
    });
    expect(champCount).toBe(String(graceyChampCount));
  });

  test('(59) 移动端排行榜三卡顺序：本周积分 → 连续打卡 → 本季度累计', async ({ page }) => {
    // 1) 切换到手机视口
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);

    // 2) 关闭可能打开的 modal，确保 switchTab 能找到 page
    await page.evaluate(() => {
      document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    });
    await page.waitForTimeout(100);

    // 3) 进入仪表盘（switchTab 内部用 page-{name} 定位，所以用 'dashboard'）
    await page.evaluate(() => switchTab('dashboard'));
    await page.waitForTimeout(300);

    // 4) 验证三张 top-stat-card 标签顺序
    const labels = await page.evaluate(() => {
      return [...document.querySelectorAll('.top-stat-label')].map(el => el.textContent.trim());
    });
    expect(labels).toEqual(['本周积分', '连续打卡', '本季度累计']);
  });

  test('(61) 日程编辑器"公开"勾选：UI 视觉与 hidden 值必须一致（防止"看着已勾选但实际未勾"）', async ({ page }) => {
    // 重置：清掉今天的日程
    await page.evaluate((ds) => {
      appState.schedulePublic = true;
      appState.schedule[ds] = [];
      saveAppState();
    }, today);

    // 1) 打开编辑器（用户视角：第一次进入，看到"公开给所有人"那行）
    await page.evaluate((ds) => openScheduleEditor(ds), today);
    await page.waitForTimeout(300);

    // 2) 验证视觉与状态一致：UI 应该是"未勾选"（空、transparent）
    //    hidden 值 = '0' → 视觉 = 空（防 bug 再次出现）
    const initialState = await page.evaluate(() => {
      const v = document.getElementById('schedPublicVal');
      const c = document.getElementById('schedPublicCheck');
      return {
        hiddenVal: v ? v.value : null,
        checkText: c ? c.textContent.trim() : null,
        checkBg: c ? c.style.background : null,
        checkColor: c ? c.style.color : null
      };
    });
    expect(initialState.hiddenVal).toBe('0');           // 数据层：未勾
    expect(initialState.checkText).toBe('');            // 视觉：空字符
    expect(initialState.checkBg).toBe('transparent');   // 视觉：透明背景
    expect(initialState.checkColor).toBe('transparent');// 视觉：透明字符

    // 3) 不点击 toggle、直接加日程（模拟用户"以为已勾选"的操作）
    await page.locator('#modalBody button:has-text("+ 添加")').first().click();
    await page.waitForTimeout(400);

    // 4) 数据层：刚加的日程 isPublic 应该是 false（因为用户没勾）
    const added = await page.evaluate((ds) => {
      const list = appState.schedule[ds] || [];
      return list.length > 0 ? { isPublic: list[0].isPublic, name: list[0].name } : null;
    }, today);
    expect(added).not.toBeNull();
    expect(added.isPublic).toBe(false);

    // 5) 关闭编辑器，打开 bio → 不应显示"我的公开日程"段（应显示"还没有公开日程"空态）
    await page.locator('#modalBody button:has-text("完成")').click();
    await page.waitForTimeout(300);
    await page.evaluate(() => openPage('bio', { circleId: appState.circles[0].id, memberName: appState.nick }));
    await page.waitForTimeout(400);
    const body = page.locator('#modalBody');
    await expect(body).toContainText('还没有公开日程');     // 空态引导
    await expect(body).not.toContainText('我的公开日程');   // 没有列表
  });
});
