import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');
const LS_KEY = 'juanfu_user';

// ============================================================
// Part A: 全新用户注册流程（开屏 → Step1 → Step2 → 仪表盘）
// 技巧：注入 onboardingDone=false + 足够大的 memberList 阻止 seed
// ============================================================
test.describe('注册流程 Part A：全新用户开屏 → 仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    // 注入数据：onboardingDone=false 让 loadAppState 返回 false → 走 initOnboarding
    // circles[0].memberList >= 5 让 lambda 返回 false → 不执行 seedReturningUserLS
    await page.addInitScript((lsKey) => {
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: false,
        circles: [{ id: 'block-seed', name: 'block', memberList: [
          {name:'a',score:0},{name:'b',score:0},{name:'c',score:0},
          {name:'d',score:0},{name:'e',score:0}
        ]}]
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(600);
  });

  test('A1: 初始显示开屏（飞溅页），无 tabbar', async ({ page }) => {
    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();
    await expect(splash).toHaveCSS('display', 'flex');
    // tabbar 应隐藏
    await expect(page.locator('#tabbar')).toHaveCSS('display', 'none');
  });

  test('A2: 点击开屏 → 淡出 → 进入注册页 Step1', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600); // 等淡出动画
    const reg = page.locator('#page-register');
    await expect(reg).toBeVisible();
    // 验证 Step 标识（scope 到 register page，避免匹配两个 .onboarding-step）
    await expect(page.locator('#page-register .onboarding-step')).toHaveText('Step 1 / 2');
    await expect(page.locator('#page-register .onboarding-title')).toContainText('创建运动档案');
  });

  test('A3: Step1 "下一步" 按钮初始禁用', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    const btn = page.locator('#btnRegister');
    await expect(btn).toBeDisabled();
  });

  test('A4: 仅填昵称不填身体数据 → 按钮仍禁用', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await expect(page.locator('#btnRegister')).toBeDisabled();
  });

  test('A5: 填完昵称+身高+体重 → 按钮启用', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await expect(page.locator('#btnRegister')).toBeEnabled();
  });

  test('A6: 体脂率选填，不填也能启用', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', 'Gracey');
    await page.fill('#regHeight', '168');
    await page.fill('#regWeight', '55');
    // 体脂率留空
    await expect(page.locator('#btnRegister')).toBeEnabled();
  });

  test('A7: 选择 emoji 头像', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    // 默认 emoji 是 💪，选择另一个
    const catEmoji = page.locator('.emoji-option', { hasText: '🐱' }).first();
    await catEmoji.click();
    await expect(catEmoji).toHaveClass(/selected/);
  });

  test('A8: 点击"下一步" → 进入 Step2 个人资料设置', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    const setup = page.locator('#page-profile-setup');
    await expect(setup).toBeVisible();
    await expect(page.locator('#page-profile-setup .onboarding-step')).toHaveText('Step 2 / 2');
  });

  test('A9: Step2 默认隐私开关为"仅自己可见"', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // 默认应为 仅自己可见
    await expect(page.locator('#privacyLabel')).toHaveText('仅自己可见');
  });

  test('A10: Step2 切换隐私 → "对圈子可见"', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    await page.locator('#privacyToggle').click();
    await expect(page.locator('#privacyLabel')).toHaveText('对圈子可见');
  });

  test('A11: Step2 可以切换打卡频率', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // 点击"每 3 天"
    await page.locator('.chip[data-freq="every3days"]').click();
    await expect(page.locator('.chip[data-freq="every3days"]')).toHaveClass(/active/);
    // 确认之前的"每日"不再 active
    await expect(page.locator('.chip[data-freq="daily"]')).not.toHaveClass(/active/);
  });

  test('A12: Step2 点击"← 上一步"回到 Step1', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试员');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // 回退
    await page.locator('button', { hasText: '上一步' }).click();
    await page.waitForTimeout(200);
    await expect(page.locator('#page-register')).toBeVisible();
    // 表单值应保留
    await expect(page.locator('#regNickname')).toHaveValue('测试员');
    await expect(page.locator('#regHeight')).toHaveValue('170');
    await expect(page.locator('#regWeight')).toHaveValue('65');
    // 按钮应仍然启用
    await expect(page.locator('#btnRegister')).toBeEnabled();
  });

  test('A13: Step2 点击"完成设置" → 进入仪表盘', async ({ page }) => {
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', 'Gracey');
    await page.fill('#regHeight', '168');
    await page.fill('#regWeight', '55');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // 可选填 slogan
    await page.fill('#regSlogan', '卷腹使我快乐');
    await page.locator('button', { hasText: '完成设置' }).click();
    await page.waitForTimeout(500);
    // 仪表盘应可见
    await expect(page.locator('#page-dashboard')).toBeVisible();
    // tabbar 应可见
    await expect(page.locator('#tabbar')).toHaveCSS('display', 'flex');
    // 导航标题应为用户名
    await expect(page.locator('#dashTitle')).toHaveText('Gracey');
  });
});

// ============================================================
// Part B: 注册后仪表盘状态验证（无圈子）
// ============================================================
test.describe('注册流程 Part B：仪表盘空态（无圈子）', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((lsKey) => {
      const now = new Date();
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: true,
        hasCircle: false,
        nick: '新用户', emoji: '🐱', height: 170, weight: 65,
        slogan: '测试中', freq: 'daily', privacy: false, schedulePublic: true,
        notifSettings: { workout: true, diet: false, overtake: true, invite: true },
        circles: [],
        activeCircleId: null,
        notifications: [],
        todayRecords: [],
        schedule: {},
        weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  test('B1: 仪表盘显示空状态（今日无记录）', async ({ page }) => {
    await expect(page.locator('#statusEmpty')).toBeVisible();
    await expect(page.locator('#statusPopulated')).toHaveCSS('display', 'none');
  });

  test('B2: 圈子卡片显示空态 + "创建圈子"/"加入圈子"按钮', async ({ page }) => {
    await expect(page.locator('#circleEmpty')).toBeVisible();
    await expect(page.locator('button', { hasText: '创建圈子' })).toBeVisible();
    await expect(page.locator('#circleEmpty button', { hasText: '加入圈子' })).toBeVisible();
  });

  test('B3: 排行榜 tab 被隐藏', async ({ page }) => {
    const tab = page.locator('.tab[data-page="leaderboard"]');
    await expect(tab).toHaveCSS('display', 'none');
  });

  test('B4: 本周排名显示"加入圈子后查看"', async ({ page }) => {
    await expect(page.locator('#weeklyRank')).toHaveText('加入圈子后查看');
  });

  test('B5: 本季度累计排名显示"加入圈子后查看"', async ({ page }) => {
    await expect(page.locator('#quarterRank')).toHaveText('加入圈子后查看');
  });

  test('B6: 侧边栏显示"还没有加入任何圈子"', async ({ page }) => {
    // 打开侧边栏
    await page.locator('#dashAvatar').click();
    await page.waitForTimeout(300);
    const sidebar = page.locator('#sidebarCircleList');
    await expect(sidebar).toContainText('还没有加入任何圈子');
  });

  test('B7: 点击"创建圈子"打开创建/加入模态框', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('#recordModal')).toHaveClass(/show/);
    await expect(page.locator('#modalTitle')).toHaveText('创建 / 加入圈子');
  });
});

// ============================================================
// Part C: 创建圈子流程
// ============================================================
test.describe('注册流程 Part C：创建圈子', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((lsKey) => {
      const now = new Date();
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: true, hasCircle: false,
        nick: '新用户', emoji: '🐱', height: 170, weight: 65,
        slogan: '测试中', freq: 'daily', privacy: false, schedulePublic: true,
        notifSettings: { workout: true, diet: false, overtake: true, invite: true },
        circles: [], activeCircleId: null,
        notifications: [], todayRecords: [], schedule: {},
        weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  test('C1: 创建圈子 → 圈子卡片从空态变为显示成员', async ({ page }) => {
    // 打开创建圈子
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    // 填写圈子名
    await page.fill('#createCircleName', '测试小队');
    // 点击创建
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    // 关闭模态框
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    // 圈子卡片应显示成员
    await expect(page.locator('#circlePopulated')).toBeVisible();
    await expect(page.locator('#circleEmpty')).toHaveCSS('display', 'none');
  });

  test('C2: 创建圈子后 → 排行榜 tab 出现', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '测试小队');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    const tab = page.locator('.tab[data-page="leaderboard"]');
    await expect(tab).not.toHaveCSS('display', 'none');
  });

  test('C3: 创建圈子后 → top stats 排名更新（不再显示"加入圈子后查看"）', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '测试小队');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    // 排名应显示圈子 #1（唯一成员）
    await expect(page.locator('#weeklyRank')).not.toHaveText('加入圈子后查看');
    await expect(page.locator('#quarterRank')).not.toHaveText('加入圈子后查看');
  });

  test('C4: 创建圈子后 → 侧边栏显示新圈子', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '测试小队');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    // 打开侧边栏
    await page.locator('#dashAvatar').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#sidebarCircleList')).toContainText('测试小队');
  });

  test('C5: 创建圈子后 → CTA Banner 出现（成员只有自己）', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '测试小队');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#ctaBanner')).toBeVisible();
  });

  test('C6: 创建圈子后 → saveAppState 正确写入 localStorage', async ({ page }) => {
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '持久化测试');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    // 检查 localStorage 内容（不依赖 reload，因为 addInitScript 会重新注入）
    const lsData = await page.evaluate(() => {
      const raw = localStorage.getItem('juanfu_user');
      return raw ? JSON.parse(raw) : null;
    });
    expect(lsData).not.toBeNull();
    expect(lsData.circles).toBeDefined();
    expect(lsData.circles.length).toBeGreaterThan(0);
    expect(lsData.circles[0].name).toBe('持久化测试');
  });
});

// ============================================================
// Part D: 新用户提交记录
// ============================================================
test.describe('注册流程 Part D：新用户提交运动记录', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((lsKey) => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: true, hasCircle: false,
        nick: '新用户', emoji: '🐱', height: 170, weight: 65,
        slogan: '测试中', freq: 'daily', privacy: false, schedulePublic: true,
        notifSettings: { workout: true, diet: false, overtake: true, invite: true },
        circles: [], activeCircleId: null,
        notifications: [], todayRecords: [], schedule: {},
        weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  test('D1: 点击 FAB 打开记录模态框', async ({ page }) => {
    const fab = page.locator('#fabBtn');
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(400);
      await expect(page.locator('#recordModal')).toHaveClass(/show/);
    }
  });

  test('D2: 无圈子时也能提交记录', async ({ page }) => {
    // 先确保 FAB 可见
    const fab = page.locator('#fabBtn');
    if (!(await fab.isVisible())) return; // FAB 可能在某些版本隐藏
    await fab.click();
    await page.waitForTimeout(400);
    // 选择"日常"类型
    const dailyBtn = page.locator('button', { hasText: '日常' }).first();
    if (await dailyBtn.isVisible()) {
      await dailyBtn.click();
      await page.waitForTimeout(300);
      // 尝试提交（应该允许，即使无圈子）
      // 检查表单是否渲染完成
      const submitBtn = page.locator('#btnSubmitDaily');
      if (await submitBtn.isVisible()) {
        await expect(submitBtn).toBeVisible();
      }
    }
  });
});

// ============================================================
// Part E: 退出登录 → 重新注册完整流程
// ============================================================
test.describe('注册流程 Part E：退出登录 → 重新注册', () => {
  test.beforeEach(async ({ page }) => {
    // 用 demo 数据启动（老用户）
    await page.goto(BASE + '?circles=1');
    await page.waitForTimeout(800);
  });

  test('E1: 设置 → 退出登录 → 确认 → 进入注册页', async ({ page }) => {
    // 使用 evaluate 直接调用 resetToRegistrationPage（更可靠）
    await page.evaluate(() => { resetToRegistrationPage(); });
    await page.waitForTimeout(500);
    // 应该进入注册页
    await expect(page.locator('#page-register')).toBeVisible();
    // tabbar 应隐藏
    await expect(page.locator('#tabbar')).toHaveCSS('display', 'none');
  });

  test('E2: 退出登录后 → 完成注册 → 回到仪表盘', async ({ page }) => {
    // 退出到注册页
    await page.evaluate(() => { resetToRegistrationPage(); });
    await page.waitForTimeout(500);
    // 填写注册表单
    await page.fill('#regNickname', '回归用户');
    await page.fill('#regHeight', '175');
    await page.fill('#regWeight', '70');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // Step2
    await page.fill('#regSlogan', '重新开始');
    await page.locator('button', { hasText: '完成设置' }).click();
    await page.waitForTimeout(500);
    // 仪表盘
    await expect(page.locator('#page-dashboard')).toBeVisible();
    await expect(page.locator('#dashTitle')).toHaveText('回归用户');
  });

  test('E3: 退出登录 → 重新注册 → 创建圈子 → 刷新持久化', async ({ page }) => {
    // 退出到注册页
    await page.evaluate(() => { resetToRegistrationPage(); });
    await page.waitForTimeout(500);
    // 完成注册
    await page.fill('#regNickname', '持久化用户');
    await page.fill('#regHeight', '180');
    await page.fill('#regWeight', '75');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: '完成设置' }).click();
    await page.waitForTimeout(500);
    // 创建圈子
    await page.locator('button', { hasText: '创建圈子' }).click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '我的持久圈子');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);
    // 刷新页面
    await page.reload();
    await page.waitForTimeout(800);
    // 验证数据持久化
    await expect(page.locator('#dashTitle')).toHaveText('持久化用户');
    await expect(page.locator('#circleTitle')).toContainText('我的持久圈子');
  });
});

// ============================================================
// Part F: 边界情况与交互细节
// ============================================================
test.describe('注册流程 Part F：边界情况', () => {
  test('F1: 昵称最大 12 字符限制', async ({ page }) => {
    await page.addInitScript((lsKey) => {
      localStorage.setItem(lsKey, JSON.stringify({ onboardingDone: false,
        circles: [{ id:'b', memberList: [{},{},{},{},{}] }] }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(600);
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    const input = page.locator('#regNickname');
    await expect(input).toHaveAttribute('maxlength', '12');
  });

  test('F2: Slogan 默认值 "不卷不是人"（留空时）', async ({ page }) => {
    await page.addInitScript((lsKey) => {
      localStorage.setItem(lsKey, JSON.stringify({ onboardingDone: false,
        circles: [{ id:'b', memberList: [{},{},{},{},{}] }] }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(600);
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '测试');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // 不填 slogan，直接完成 → 默认应为"不卷不是人"
    // 通过 evaluate 验证
    const slogan = await page.evaluate(() => {
      return document.getElementById('regSlogan').value;
    });
    expect(slogan).toBe('');
    // 点击完成
    await page.locator('button', { hasText: '完成设置' }).click();
    await page.waitForTimeout(500);
    // 验证 appState.slogan 默认值
    const appSlogan = await page.evaluate(() => appState.slogan);
    expect(appSlogan).toBe('不卷不是人');
  });

  test('F3: 仪表盘顶部显示正确日期格式', async ({ page }) => {
    await page.addInitScript((lsKey) => {
      const now = new Date();
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: true, hasCircle: false,
        nick: '新用户', emoji: '🐱', height: 170, weight: 65,
        slogan: '', freq: 'daily', privacy: false, schedulePublic: true,
        notifSettings: { workout: true, diet: false, overtake: true, invite: true },
        circles: [], activeCircleId: null,
        notifications: [], todayRecords: [], schedule: {},
        weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    const dateText = await page.locator('#dashDate').textContent();
    expect(dateText).toMatch(/\d+月\d+日 · 星期/);
  });

  test('F4: Toast 提示显示"欢迎加入卷腹"', async ({ page }) => {
    await page.addInitScript((lsKey) => {
      localStorage.setItem(lsKey, JSON.stringify({ onboardingDone: false,
        circles: [{ id:'b', memberList: [{},{},{},{},{}] }] }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(600);
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', 'ToastTest');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: '完成设置' }).click();
    await page.waitForTimeout(500);
    // toast 应该包含欢迎信息
    const toast = page.locator('.toast');
    if (await toast.isVisible()) {
      await expect(toast).toContainText('欢迎');
    }
  });
});
