// 回归测试：站内信模态框的计数必须与渲染的列表保持一致
// 修复前：openNotifications 用 notifs.length 显示「共 N 条」，但渲染用 visibleNotifs（已过滤）
//        → 如果 notifs.length=1 但 visibleNotifs=0，会出现「共 1 条」但 body 为空的不一致
// 修复后：统一使用 visibleNotifs 计算 count / empty state / items

import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

async function freshLoad(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.waitForTimeout(500);
}

async function completeOnboarding(page) {
  await page.locator('#splash').click();
  await page.waitForTimeout(600);
  await page.fill('#regNickname', '测试用户');
  await page.fill('#regHeight', '170');
  await page.fill('#regWeight', '65');
  await page.locator('#page-register button:has-text("下一步")').click();
  await page.waitForTimeout(300);
  // Step2 默认值都填好，直接点完成
  await page.locator('#page-profile-setup button:has-text("完成设置")').click();
  await page.waitForTimeout(500);
}

test.describe('站内信模态框计数与渲染一致性', () => {

  test('I1: 全新用户打开站内信 → 显示「共 0 条」+ 空状态', async ({ page }) => {
    await freshLoad(page);
    await completeOnboarding(page);

    // 打开站内信模态
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(300);

    // 标题应该是「共 0 条」而不是「共 N 条」
    const countText = await page.locator('#modalBody').textContent();
    expect(countText).toContain('共 0 条');

    // 应该显示空状态
    expect(countText).toContain('还没有通知');
  });

  test('I2: 注入一条 targetMember !== 当前用户的通知 → 计数应为 0 + 不显示', async ({ page }) => {
    await freshLoad(page);
    await completeOnboarding(page);

    // 直接注入一条"给别人的"通知（模拟 join_request 给 owner 看的情况）
    await page.evaluate(() => {
      if (!appState.notifications) appState.notifications = [];
      appState.notifications.push({
        id: 'test-hidden-' + Date.now(),
        type: 'join_request',
        title: '🤝 我想加入 Jane 的「晨跑」',
        body: '点「批准」同步双方日程',
        time: Date.now(),
        read: false,
        targetMember: 'Jane'  // 不是当前用户「测试用户」
      });
    });

    // 打开站内信模态
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(300);

    // 关键断言：计数应该是 0（不是 1），且显示空状态
    const countText = await page.locator('#modalBody').textContent();
    expect(countText).toContain('共 0 条');
    expect(countText).toContain('还没有通知');
    // 隐藏的通知不应该显示在 body 中
    expect(countText).not.toContain('我想加入 Jane');
  });

  test('I3: 注入一条当前用户的 rank_down 通知 → 计数 1 + 正常渲染', async ({ page }) => {
    await freshLoad(page);
    await completeOnboarding(page);

    await page.evaluate(() => {
      if (!appState.notifications) appState.notifications = [];
      appState.notifications.push({
        id: 'test-visible-' + Date.now(),
        type: 'rank_down',
        title: '📉 排名下降',
        body: '在「测试圈子」中你被反超了，当前第 3 名',
        time: Date.now(),
        read: false
        // 不设 targetMember → 对所有当前用户可见
      });
    });

    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(300);

    const countText = await page.locator('#modalBody').textContent();
    expect(countText).toContain('共 1 条');
    expect(countText).toContain('排名下降');
    expect(countText).toContain('测试圈子');
  });

  test('I4: 角标 (notifBadge) 也应只算当前用户可见的通知', async ({ page }) => {
    await freshLoad(page);
    await completeOnboarding(page);

    // 注入 1 条给别人的通知
    await page.evaluate(() => {
      if (!appState.notifications) appState.notifications = [];
      appState.notifications.push({
        id: 'test-hidden-2-' + Date.now(),
        type: 'join_request',
        title: '🤝 隐式通知',
        body: '应该不显示',
        time: Date.now(),
        read: false,
        targetMember: 'someone-else'
      });
      // 触发角标更新
      updateNotificationBadge();
    });

    // 角标应该是 hidden（display: none），不显示数字
    const badgeDisplay = await page.evaluate(() => {
      const badge = document.getElementById('notifBadge');
      return badge ? badge.style.display : 'missing';
    });
    expect(badgeDisplay).toBe('none');
  });

  test('I5: 混合可见 + 隐藏通知 → 计数 = 可见数（不包含隐藏）', async ({ page }) => {
    await freshLoad(page);
    await completeOnboarding(page);

    await page.evaluate(() => {
      if (!appState.notifications) appState.notifications = [];
      // 2 条隐藏（targetMember != current）
      appState.notifications.push({
        id: 'h1', type: 'join_request', title: '隐藏1', body: 'hide me',
        time: Date.now(), read: false, targetMember: 'Jane'
      });
      appState.notifications.push({
        id: 'h2', type: 'join_request', title: '隐藏2', body: 'hide me too',
        time: Date.now(), read: false, targetMember: '老鹰'
      });
      // 1 条可见
      appState.notifications.push({
        id: 'v1', type: 'rank_up', title: '可见1', body: 'show me',
        time: Date.now(), read: false
      });
    });

    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(300);

    const countText = await page.locator('#modalBody').textContent();
    // 关键：count=1 (只算可见的)，不是 3
    expect(countText).toContain('共 1 条');
    expect(countText).toContain('可见1');
    expect(countText).not.toContain('隐藏1');
    expect(countText).not.toContain('隐藏2');
  });
});
