import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

const LS_KEY = 'juanfu_user';

// 构造本周 records 列表，让 isMe 的 records 本周求和 = 目标分数
// 设计：仪表盘 #weeklyPoints / 排行榜 isMe 同源 = 本周 records.points 之和（不含 streak）
const makeWeekRecords = (myScore) => {
  // 在 Node.js 端直接生成"今天"日期字符串（避免依赖浏览器全局 nowDateStr）
  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  return [{
    id: 'r-mock', type: 'special', sport: '攀岩', minutes: 60, points: myScore,
    time: '10:00', date: today, createdAt: Date.now() - 1000
  }];
};

// 共享一个 BASE 模板（isMe 分数靠 records 求和决定）
const fakeWithOverTake = (myScore, monkScore) => {
  const now = new Date();
  const qKey = now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3);
  return {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c-princess', name: '原来你也是公主', role: 'leader', code: 'PRN00001',
      memberList: [
        { name: 'Monk', isLeader: true, isMe: false, score: monkScore },
        { name: 'Gracey', isLeader: false, isMe: true, score: myScore }
      ]
    }],
    activeCircleId: 'c-princess',
    todayRecords: makeWeekRecords(myScore),
    records: [],
    weekKey: '', quarterKey: qKey,
    weeklyPoints: myScore, quarterPoints: myScore,
    notifBellSeen: true, notifications: []
  };
};

test.describe('排行榜超越后的视觉更新', () => {
  test('本来 Monk 第一 → Gracey 超越后排名 + 视觉（金/银）都变化', async ({ page }) => {
    // 场景 1: Monk 第一（130）> Gracey（100）
    await page.addInitScript(({ lsKey, data }) => {
      localStorage.setItem(lsKey, JSON.stringify(data));
    }, { lsKey: LS_KEY, data: fakeWithOverTake(100, 130) });
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // Monk 应在 .first（中间，金牌）位置
    let items = await page.locator('.podium-item').all();
    expect(items.length).toBe(2);
    let firstName = await items[1].locator('.podium-name').textContent();
    expect(firstName).toContain('Monk');
    let firstBarCls = await items[1].locator('.podium-bar').getAttribute('class');
    expect(firstBarCls).toContain('gold');
    let secondBarCls = await items[0].locator('.podium-bar').getAttribute('class');
    expect(secondBarCls).toContain('silver');
  });

  test('Gracey 超过 Monk → Gracey 应变金（rank=1）+ Monk 变银（rank=2）', async ({ page }) => {
    // 场景 2: Gracey（171）> Monk（72），用户当前看到的场景
    await page.addInitScript(({ lsKey, data }) => {
      localStorage.setItem(lsKey, JSON.stringify(data));
    }, { lsKey: LS_KEY, data: fakeWithOverTake(171, 72) });
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    const items = await page.locator('.podium-item').all();
    expect(items.length).toBe(2);

    // items[1] = .first（中间，金牌）= Gracey
    const firstName = await items[1].locator('.podium-name').textContent();
    expect(firstName).toContain('Gracey');
    const firstBarCls = await items[1].locator('.podium-bar').getAttribute('class');
    expect(firstBarCls).toContain('gold');

    // items[0] = #2 Monk，应为银
    const secondName = await items[0].locator('.podium-name').textContent();
    expect(secondName).toContain('Monk');
    const secondBarCls = await items[0].locator('.podium-bar').getAttribute('class');
    expect(secondBarCls).toContain('silver');
  });

  test('手动输入数字：表单 number input 不应该有原生上下箭头（CSS 隐藏）', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 通过 openRecordModal 直接拉起专项记录弹窗（含分钟数 + 手表卡路里 number 输入）
    await page.evaluate(() => openRecordModal('special'));
    await page.waitForTimeout(500);
    // 至少找到一个 number input
    const minutesInput = page.locator('input.form-input[type="number"]').first();
    await minutesInput.waitFor({ timeout: 5000 });
    const appearance = await minutesInput.evaluate(el => getComputedStyle(el).appearance);
    // appearance 应该是 'textfield' 或 'none'，而不是 'auto'（auto 会显示原生箭头）
    expect(['textfield', 'none']).toContain(appearance);
    // 也验证 input 的高度 ≥ 期望值（隐藏 spin button 后 input 高度应保持）
    const bbox = await minutesInput.boundingBox();
    expect(bbox.height).toBeGreaterThan(30);
  });
});
