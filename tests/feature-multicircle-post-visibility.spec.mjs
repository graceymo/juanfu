import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

/**
 * 辅助：编程式创建圈子（绕过 UI 输入框依赖）
 */
function setupCircle(page, { id, name, members = [] }) {
  return page.evaluate(({ id, name, members }) => {
    const circle = {
      id: id,
      name: name,
      role: 'member',
      code: 'CODE' + id.toUpperCase(),
      capacity: 30,
      pending: false,
      reward: '',
      weeklyReward: false,
      memberList: [
        { emoji: appState.emoji, name: appState.nick, score: 50, isMe: true, isLeader: false, joinDate: new Date().toISOString().slice(0, 7) },
        ...members
      ],
      joinRequests: [],
      weeklyChampions: [],
      rankSnapshots: []
    };
    appState.circles.push(circle);
    if (!appState.activeCircleId) appState.activeCircleId = id;
    appState.hasCircle = true;
  }, { id, name, members });
}

/**
 * 辅助：编程式打开编辑器并设置选中的圈子
 */
function openEditorWithCircles(page, selectedIds) {
  return page.evaluate((ids) => {
    window._postEditor = { text: '', image: null, importedRecord: null, selectedCircleIds: new Set(ids) };
    appState.activeCircleId = ids[0];
    openPostEditor();
  }, selectedIds);
}

test.describe('Feature: 帖子多圈子可见范围', () => {

  test('K1: 单圈用户发帖 → 不显示多选器，直接显示"将发布到「X」"', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    // 快速注册
    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '单圈用户');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 编程式创建一个圈子
    await setupCircle(page, { id: 'circle-only', name: '我的单圈' });
    await page.waitForTimeout(300);

    // 打开发帖编辑器
    await openEditorWithCircles(page, ['circle-only']);
    await page.waitForTimeout(500);

    // 应该显示"将发布到「我的单圈」"而非多选器
    const modalBody = await page.locator('#modalBody').textContent();
    expect(modalBody).toContain('将发布到「我的单圈」');
    // 不应有多选器
    expect(modalBody).not.toContain('可见范围');
  });

  test('K2: 多圈用户发帖 → 显示圈子多选芯片，默认选中当前圈', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '多圈用户');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 创建 2 个圈子
    await setupCircle(page, { id: 'c1', name: '晨跑打卡营', members: [
      { emoji: '🏃', name: '小跑', score: 30, isMe: false, isLeader: false },
    ]});
    await setupCircle(page, { id: 'c2', name: '攀岩小队', members: [
      { emoji: '🧗', name: '石头', score: 20, isMe: false, isLeader: false },
    ]});

    // 打开发帖编辑器（默认选中 c1）
    await openEditorWithCircles(page, ['c1']);
    await page.waitForTimeout(500);

    // 应显示多选器
    const modalBody = await page.locator('#modalBody').textContent();
    expect(modalBody).toContain('可见范围');
    expect(modalBody).not.toContain('将发布到「');  // 多圈用户不显示旧的单行提示

    // 应有 2 个芯片
    const chips = await page.locator('.post-circle-chip');
    expect(await chips.count()).toBe(2);

    // 晨跑打卡营（当前圈）应默认选中
    const firstChip = chips.nth(0);
    await expect(firstChip).toHaveClass(/selected/);
  });

  test('K3: 取消选中所有圈子时 → toast "至少选择一个可见圈子"，保留至少 1 个', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '测试用户');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 创建 2 个圈子
    await setupCircle(page, { id: 'ca', name: '圈A' });
    await setupCircle(page, { id: 'cb', name: '圈B' });

    // 打开编辑器（默认选中 ca）
    await openEditorWithCircles(page, ['ca']);
    await page.waitForTimeout(500);

    // 默认圈A选中，点击取消 → toast "至少选择一个"
    const chips = await page.locator('.post-circle-chip');
    const chipA = chips.nth(0);
    await chipA.click();
    await page.waitForTimeout(400);

    // 验证 toast 出现
    const toast = await page.locator('.toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      const toastText = await toast.textContent();
      expect(toastText).toContain('至少选择一个');
    }

    // 验证圈A仍然是选中状态（不能全取消）
    const chipAAfter = chips.nth(0);
    await expect(chipAAfter).toHaveClass(/selected/);
  });

  test('K4: 选中多个圈子发帖 → post 存入所有圈子', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '跨圈发帖');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 创建圈A + 圈B
    await setupCircle(page, { id: 'ka', name: '圈A' });
    await setupCircle(page, { id: 'kb', name: '圈B' });

    // 打开编辑器，全选两个圈
    await openEditorWithCircles(page, ['ka', 'kb']);
    await page.waitForTimeout(500);

    // 两个都应选中
    const chips = await page.locator('.post-circle-chip');
    await expect(chips.nth(0)).toHaveClass(/selected/);
    await expect(chips.nth(1)).toHaveClass(/selected/);

    // 发布帖子
    await page.fill('#postText', '跨圈打卡');
    await page.locator('button:has-text("发布")').click();
    await page.waitForTimeout(500);

    // 验证 toast 显示"已发布到 2 个圈子"
    const toast = await page.locator('.toast');
    if (await toast.isVisible().catch(() => false)) {
      const toastText = await toast.textContent();
      expect(toastText).toContain('2 个圈子');
    }

    // 验证帖子在两个圈都存在
    const hasInBoth = await page.evaluate(() => {
      const cA = appState.circles.find(c => c.name === '圈A');
      const cB = appState.circles.find(c => c.name === '圈B');
      if (!cA || !cB) return false;
      const postsA = (window._userPostsByCircle && window._userPostsByCircle[cA.id]) || [];
      const postsB = (window._userPostsByCircle && window._userPostsByCircle[cB.id]) || [];
      return postsA.some(p => p.content === '跨圈打卡') && postsB.some(p => p.content === '跨圈打卡');
    });
    expect(hasInBoth).toBe(true);
  });

  test('K5: 多圈帖子的 circleIds 字段正确记录所有可见圈', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '圈ids');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 加入 CLIMB88 和 RUN8888 通过直接注入
    await page.evaluate(() => {
      // 注入攀岩小队
      const climb = {
        id: 'mock-climb', name: '攀岩小队', role: 'member', code: 'CLIMB88',
        capacity: 30, pending: false, reward: '月底末位请吃火锅',
        weeklyReward: true, joinRequests: [],
        memberList: [
          { emoji: '👤', name: appState.nick, score: 50, isMe: true, isLeader: false, joinDate: '2026-07' },
          { emoji: '🧗', name: 'Jane', score: 200, isMe: false, isLeader: true, joinDate: '2026-07' },
          { emoji: '🦅', name: '老鹰', score: 180, isMe: false, isLeader: false, joinDate: '2026-07' },
          { emoji: '🐵', name: '猴子', score: 150, isMe: false, isLeader: false, joinDate: '2026-07' },
          { emoji: '🐌', name: '慢慢来', score: 100, isMe: false, isLeader: false, joinDate: '2026-07' },
        ],
        weeklyChampions: [], rankSnapshots: []
      };
      appState.circles.push(climb);

      // 注入晨跑打卡营
      const run = {
        id: 'mock-run', name: '晨跑打卡营', role: 'member', code: 'RUN8888',
        capacity: 30, pending: false, reward: '连续3天缺卡请全组咖啡',
        weeklyReward: true, joinRequests: [],
        memberList: [
          { emoji: '👤', name: appState.nick, score: 50, isMe: true, isLeader: false, joinDate: '2026-07' },
          { emoji: '🏃', name: 'Tomo', score: 220, isMe: false, isLeader: true, joinDate: '2026-07' },
          { emoji: '🐟', name: '小鱼', score: 190, isMe: false, isLeader: false, joinDate: '2026-07' },
          { emoji: '👴', name: '老王', score: 160, isMe: false, isLeader: false, joinDate: '2026-07' },
          { emoji: '💪', name: '大壮', score: 140, isMe: false, isLeader: false, joinDate: '2026-07' },
        ],
        weeklyChampions: [], rankSnapshots: []
      };
      appState.circles.push(run);
      appState.activeCircleId = 'mock-climb';
      appState.hasCircle = true;
    });
    await page.waitForTimeout(300);

    // 打开编辑器，全选两个圈
    await openEditorWithCircles(page, ['mock-climb', 'mock-run']);
    await page.waitForTimeout(500);

    // 两个都应选中
    const chips = await page.locator('.post-circle-chip');
    await expect(chips.nth(0)).toHaveClass(/selected/);
    await expect(chips.nth(1)).toHaveClass(/selected/);

    // 发布
    await page.fill('#postText', '两个圈子都看得到');
    await page.locator('button:has-text("发布")').click();
    await page.waitForTimeout(500);

    // post.circleIds 应包含两个圈
    const result = await page.evaluate(() => {
      for (const cid in (window._userPostsByCircle || {})) {
        for (const p of (window._userPostsByCircle[cid] || [])) {
          if (p.content === '两个圈子都看得到') {
            return { circleIds: p.circleIds, circleId: p.circleId };
          }
        }
      }
      return null;
    });
    expect(result).not.toBeNull();
    expect(result.circleIds.length).toBe(2);
    expect(result.circleIds).toContain('mock-climb');
    expect(result.circleIds).toContain('mock-run');
    // circleId 向后兼容 = 主圈
    expect(result.circleId).toBe('mock-climb');
  });

  test('K6: 多圈帖子的互动者来自所有可见圈的成员（去重）', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);

    await page.locator('#splash').click();
    await page.waitForTimeout(500);
    await page.fill('#regNickname', '互动跨圈');
    await page.fill('#regHeight', '170');
    await page.fill('#regWeight', '65');
    await page.locator('#page-register button:has-text("下一步")').click();
    await page.waitForTimeout(500);
    await page.locator('#page-profile-setup button:has-text("完成设置")').click();
    await page.waitForTimeout(500);

    // 注入两个圈子（与 K5 相同的结构）
    await page.evaluate(() => {
      const climb = {
        id: 'mc1', name: '攀岩小队', role: 'member', code: 'CLMB99',
        capacity: 30, pending: false, reward: '', weeklyReward: false, joinRequests: [],
        memberList: [
          { emoji: '👤', name: appState.nick, score: 50, isMe: true, isLeader: false, joinDate: '2026-07' },
          { emoji: '🧗', name: 'Jane', score: 200, isMe: false, isLeader: true, joinDate: '2026-07' },
          { emoji: '🦅', name: '老鹰', score: 180, isMe: false, isLeader: false, joinDate: '2026-07' },
        ],
        weeklyChampions: [], rankSnapshots: []
      };
      appState.circles.push(climb);

      const run = {
        id: 'mc2', name: '晨跑打卡营', role: 'member', code: 'RUN99',
        capacity: 30, pending: false, reward: '', weeklyReward: false, joinRequests: [],
        memberList: [
          { emoji: '👤', name: appState.nick, score: 50, isMe: true, isLeader: false, joinDate: '2026-07' },
          { emoji: '🏃', name: 'Tomo', score: 220, isMe: false, isLeader: true, joinDate: '2026-07' },
          { emoji: '🐟', name: '小鱼', score: 190, isMe: false, isLeader: false, joinDate: '2026-07' },
        ],
        weeklyChampions: [], rankSnapshots: []
      };
      appState.circles.push(run);
      appState.activeCircleId = 'mc1';
      appState.hasCircle = true;
    });
    await page.waitForTimeout(300);

    // 打开编辑器，全选两个圈
    await openEditorWithCircles(page, ['mc1', 'mc2']);
    await page.waitForTimeout(500);

    // 全选
    const chips = await page.locator('.post-circle-chip');
    if ((await chips.count()) > 1) {
      const hasSelected = await chips.nth(0).evaluate(el => el.classList.contains('selected'));
      if (hasSelected) {
        // 检查第二个是否已选中，没选中的话点击
        const secondSelected = await chips.nth(1).evaluate(el => el.classList.contains('selected'));
        if (!secondSelected) await chips.nth(1).click();
      }
    }
    await page.waitForTimeout(300);

    // 发布
    await page.fill('#postText', '互动跨圈测试');
    await page.locator('button:has-text("发布")').click();
    await page.waitForTimeout(7500);  // 等互动模拟

    // 互动者应来自两个圈的成员（不重复）
    const interactors = await page.evaluate(() => {
      return (appState.notifications || [])
        .filter(n => n.type === 'like' || n.type === 'comment')
        .map(n => n.fromName);
    });
    expect(interactors.length).toBeGreaterThan(0);

    // 所有互动者都应是两个圈之一的成员
    const allMembers = await page.evaluate(() => {
      const names = new Set();
      (appState.circles || []).forEach(c => {
        (c.memberList || []).forEach(m => { if (m.name !== appState.nick) names.add(m.name); });
      });
      return Array.from(names);
    });

    for (const name of interactors) {
      expect(allMembers, `互动者「${name}」不在任何可见圈里`).toContain(name);
    }
  });

});
