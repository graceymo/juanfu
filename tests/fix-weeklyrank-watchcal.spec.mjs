// 仪表盘"暂无排名"删除 + 手表卡路里即时输入提示
import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

function fakeStateWithCircle({ onboarded = true, withCircle = true, todayRecords = [] } = {}) {
  const state = {
    onboarded,
    onboardingDone: onboarded,
    nick: 'Gracey',
    circles: withCircle ? [{
      id: 'c1', name: '原来你也是公主', inviteCode: 'NW7R5DWY',
      members: ['Gracey', 'Monk'],
      memberList: [
        { name: 'Gracey', isMe: true, isLeader: true, score: 117 },
        { name: 'Monk', isMe: false, isLeader: false, score: 72 },
        { name: 'Coyote', isMe: false, isLeader: false, score: 50 }
      ]
    }] : [],
    activeCircleId: withCircle ? 'c1' : null,
    quarterKey: '2026Q3',
    quarterPoints: 117,
    weeklyPoints: 23,
    streakDays: 1,
    todayRecords
  };
  return state;
}

test('仪表盘：本季度 #1 + 本周积分卡也显示圈子排名（无"暂无排名"）', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeStateWithCircle({ withCircle: true }));
  await page.goto(BASE);
  await page.waitForTimeout(1000);

  const weeklyRank = (await page.locator('#weeklyRank').textContent()).trim();
  // 有圈子时显示真实排名，不应出现"暂无排名"
  expect(weeklyRank).not.toContain('暂无排名');
  expect(weeklyRank).toMatch(/圈子 #\d+/);
});

test('仪表盘：无圈子时本周积分卡显示"加入圈子后查看"', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeStateWithCircle({ withCircle: false }));
  await page.goto(BASE);
  await page.waitForTimeout(1000);

  const weeklyRank = (await page.locator('#weeklyRank').textContent()).trim();
  expect(weeklyRank).toBe('加入圈子后查看');
});

test('手表卡路里输入：1 位数（<50）显示橙色警告"不像手表实际数值"', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => openRecordModal('special'));
  await page.waitForTimeout(500);

  const watchInput = page.locator('input.form-input[placeholder*="例如"]');
  await watchInput.waitFor({ timeout: 3000 });
  await watchInput.fill('1');
  await page.waitForTimeout(300);

  // 1 kcal 不像手表实际数值 → 警告
  const warn = page.locator('.form-hint-warn');
  await expect(warn).toContainText('不像手表');
  // 同时不应该有 ✓ 提示
  await expect(page.locator('.form-hint-ok')).toHaveCount(0);
});

test('手表卡路里输入：2 位数（23，<50）显示橙色警告', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => openRecordModal('special'));
  await page.waitForTimeout(500);

  const watchInput = page.locator('input.form-input[placeholder*="例如"]');
  await watchInput.waitFor({ timeout: 3000 });
  await watchInput.fill('23');
  await page.waitForTimeout(300);

  await expect(page.locator('.form-hint-warn')).toContainText('不像手表');
  await expect(page.locator('.form-hint-ok')).toHaveCount(0);
});

test('手表卡路里输入：合理值（566）显示"✓ 已记录 566 kcal"', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => openRecordModal('special'));
  await page.waitForTimeout(500);

  const watchInput = page.locator('input.form-input[placeholder*="例如"]');
  await watchInput.waitFor({ timeout: 3000 });
  await watchInput.fill('566');
  await page.waitForTimeout(300);

  await expect(page.locator('.form-hint-ok')).toContainText('已记录 566 kcal');
});

test('手表卡路里输入：4 位数（>999）显示橙色警告', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => openRecordModal('special'));
  await page.waitForTimeout(500);

  const watchInput = page.locator('input.form-input[placeholder*="例如"]');
  await watchInput.waitFor({ timeout: 3000 });
  await watchInput.fill('1500');
  await page.waitForTimeout(300);

  const warn = page.locator('.form-hint-warn');
  await expect(warn).toContainText('数值过大');
});
