import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');
const LS_KEY = 'juanfu_user';

// ============================================================
// 回归测试：Bug 「新用户首启看到 Panda 反超通知」
//
// 背景：
//   原 seed 条件包含 `!localStorage.getItem('juanfu_user')`（无 localStorage）
//   导致每个新用户首次打开 app 时被 seed 完整的 demo 数据
//   demo 数据含 `notifications: [n-preset-1]` 「在「原来你也是公主」中Panda刚刚反超了你」
//   → loadAppState 返回 true → 直接进 dashboard → 看到不该看到的通知
//
// 修复：
//   - seed 条件移除「无 localStorage」分支
//   - 只保留显式 QA (?circles=1) + 数据损坏两个分支
//   - initOnboarding() / resetToRegistrationPage() 清空 notifications
//
// 验证：
//   全新用户（无 localStorage）首次打开 app 必须走注册流程
//   完成后进入 dashboard，通知系统为空
// ============================================================

test.describe('回归 #bug-0728: 新用户不应看到 demo 通知', () => {

  test('G1: 全新用户（无 localStorage）打开 app → 进入注册页（不进 dashboard）', async ({ page }) => {
    // 完全不注入任何 localStorage，模拟全新用户
    await page.goto(BASE);
    await page.waitForTimeout(500);

    // 应该看到开屏
    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();

    // 点击进入注册
    await splash.click();
    await page.waitForTimeout(600);

    // 应该进入注册页，不是 dashboard
    await expect(page.locator('#page-register')).toBeVisible();
    // tabbar 应隐藏
    await expect(page.locator('#tabbar')).toHaveCSS('display', 'none');
    // dashboard 应不可见
    await expect(page.locator('#page-dashboard')).not.toBeVisible();
  });

  test('G2: 全新用户完成注册 → dashboard 无 demo 通知', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    // 走完注册流程
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '新用户');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    // Step2 默认 slogan/频率就有值，直接点完成
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 已进入 dashboard
    await expect(page.locator('#page-dashboard')).toBeVisible();

    // localStorage 中不应该有 demo 通知（n-preset-1）
    const lsData = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);
    expect(lsData).not.toBeNull();
    expect(lsData.onboardingDone).toBe(true);
    // 关键断言：notifications 应该为空数组，不应包含 n-preset-1
    expect(lsData.notifications).toEqual([]);

    // UI 验证：通知徽章应该不可见（0 条未读）
    const notifBadge = page.locator('#notifBadge');
    await expect(notifBadge).toBeHidden();
  });

  test('G3: 全新用户完成注册后刷新页面 → 仍无 demo 通知（不被 seed 覆盖）', async ({ page }) => {
    // 先注册
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.locator('#splash').click();
    await page.waitForTimeout(600);
    await page.fill('#regNickname', '新用户');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#btnRegister').click();
    await page.waitForTimeout(300);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 刷新页面（关键：此时 localStorage 已有真实数据，不能被 seed 覆盖）
    await page.reload();
    await page.waitForTimeout(500);

    // 应该直接进 dashboard（因为 onboardingDone=true）
    await expect(page.locator('#page-dashboard')).toBeVisible();

    // 验证：localStorage 仍应是用户真实数据，无 demo 圈子/通知
    const lsData = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);
    expect(lsData).not.toBeNull();
    expect(lsData.nick).toBe('新用户');
    // 不应被 seed 覆盖成 Gracey
    expect(lsData.nick).not.toBe('Gracey');
    // 通知应为空
    expect(lsData.notifications).toEqual([]);
    // circles 应为空（新用户还没加圈子）
    expect(lsData.circles).toEqual([]);
  });

  test('G4: 退出登录后重新注册 → 不应看到上一次的 demo 通知', async ({ page }) => {
    // 模拟一个有 demo 通知的旧 localStorage（类似种子污染过的状态）
    await page.addInitScript((lsKey) => {
      localStorage.setItem(lsKey, JSON.stringify({
        onboardingDone: true,
        nick: '旧用户',
        emoji: '🐙',
        circles: [{ id: 'demo', name: 'demo', memberList: [
          {name:'a',score:0},{name:'b',score:0},{name:'c',score:0},
          {name:'d',score:0},{name:'e',score:0}
        ]}],
        // 关键的污染：残留了 demo 通知
        notifications: [
          { id: 'n-polluted', type: 'rank_down', title: '📉 排名下降', body: '在「demo」中Panda反超了你', time: Date.now() - 1000, read: false }
        ]
      }));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(500);

    // 走设置 → 退出登录（模拟）
    await page.evaluate(() => {
      // 直接调用 resetToRegistrationPage（不依赖 UI）
      resetToRegistrationPage();
    });
    await page.waitForTimeout(500);

    // 应该清空通知
    const lsData = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);
    // localStorage 已被 removeItem，所以应该是 null
    expect(lsData).toBeNull();

    // appState.notifications 应该是空数组
    const inMemoryNotifs = await page.evaluate(() => appState.notifications);
    expect(inMemoryNotifs).toEqual([]);
  });

  test('G5: 显式 demo 模式 (?circles=1) 仍然能 seed（QA 测试不受影响）', async ({ page }) => {
    await page.goto(BASE + '?qa=1&circles=1');
    await page.waitForTimeout(500);

    // 应该直接进 dashboard（seed 后 onboardingDone=true）
    await expect(page.locator('#page-dashboard')).toBeVisible();

    // localStorage 应该有 demo 数据
    const lsData = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);
    expect(lsData).not.toBeNull();
    expect(lsData.nick).toBe('Gracey');
    expect(lsData.circles.length).toBeGreaterThan(0);
    // 通知应该被 seed 进来
    expect(lsData.notifications.length).toBeGreaterThan(0);
  });
});
