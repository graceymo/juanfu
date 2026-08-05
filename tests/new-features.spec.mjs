// 新功能验证测试：4项改动
import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

test.describe('新需求验证', () => {
  test('Task 54: 饮食记录表单不再有 +/- 按钮', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForTimeout(800);

    // 打开记录弹窗
    await page.evaluate(() => openRecordModal('diet'));
    await page.waitForTimeout(300);

    // 验证：饮食表单中 input 数量为 number 类型
    const inputs = await page.locator('#modalBody input[type="number"]').count();
    expect(inputs).toBeGreaterThan(0);

    // 验证：没有"−"或"+"字符作为按钮文本（在 qty 区域）
    const minusBtn = page.locator('#modalBody button:has-text("−")');
    const plusBtn = page.locator('#modalBody button:has-text("+")');
    expect(await minusBtn.count()).toBe(0);
    expect(await plusBtn.count()).toBe(0);

    // 验证：直接输入 3 后扣分变为 -15
    const qtyInput = page.locator('#modalBody input[type="number"][min="1"]');
    await qtyInput.fill('3');
    await page.waitForTimeout(200);
    const deductText = await page.locator('#modalBody .pi-value').textContent();
    expect(deductText).toContain('-15');
  });

  test('Task 54: 饮食记录每件固定 -5 分', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 注入测试数据
    await page.evaluate(() => {
      appState.todayRecords = [{
        id: 'test-diet-1',
        type: 'diet',
        food: '奶茶',
        qty: 2,
        points: -10,
        time: '15:00',
        createdAt: Date.now()
      }];
      saveAppState();
    });
    // 打开弹窗
    await page.evaluate(() => openRecordModal('diet'));
    await page.waitForTimeout(300);
    // 直接改 qty = 4 → 应 -20
    const qtyInput = page.locator('#modalBody input[type="number"][min="1"]');
    await qtyInput.fill('4');
    await page.waitForTimeout(200);
    const deductText = await page.locator('#modalBody .pi-value').textContent();
    expect(deductText).toContain('-20');
  });

  test('Task 51: 记录页按时间倒序', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 注入 3 条不同时间的记录
    await page.evaluate(() => {
      const now = Date.now();
      appState.todayRecords = [
        { id: 'r1', type: 'daily', group: '核心/腹部', exercise: '卷腹', reps: 10, sets: 2, points: 4, time: '10:39', createdAt: now - 3600 * 1000 },
        { id: 'r2', type: 'special', sport: '跑步', minutes: 60, points: 42, time: '10:39', createdAt: now - 3600 * 1000 },
        { id: 'r3', type: 'daily', group: '核心/腹部', exercise: '悬挂举腿', reps: 10, sets: 2, points: 9, time: '23:38', createdAt: now }
      ];
      saveAppState();
      switchTab('record');
      refreshRecordPage();
    });
    await page.waitForTimeout(500);
    // 第一条 stat-name 应该是 "23:38" 时间的那条（核心/腹部·悬挂举腿）
    const firstName = await page.locator('#recordDailyList .record-row-clickable .stat-name').first().textContent();
    expect(firstName).toContain('悬挂举腿');
  });

  // Task 52 趋势图相关已删除（板块下线 2026-07-22）

  test('Task 53: 右滑删除容器存在', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      appState.todayRecords = [{
        id: 'r-swipe-1', type: 'daily', group: '核心/腹部', exercise: '卷腹',
        reps: 10, sets: 2, points: 4, time: '10:00', createdAt: Date.now()
      }];
      saveAppState();
      switchTab('record');
      refreshRecordPage();
    });
    await page.waitForTimeout(500);
    // 验证 .record-swipe-wrap 容器存在
    const wrapCount = await page.locator('.record-swipe-wrap').count();
    expect(wrapCount).toBeGreaterThan(0);
    // 验证内部含删除按钮
    const delBtnText = await page.locator('.record-swipe-delete').first().textContent();
    expect(delBtnText).toContain('删除');
  });

  test('Task 50: 日常/专项运动表单无 +/- 按钮', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 打开 daily
    await page.evaluate(() => openRecordModal('daily'));
    await page.waitForTimeout(300);
    // 验证：个数 + 组数 都是 input
    const numberInputs = await page.locator('#modalBody input[type="number"]').count();
    expect(numberInputs).toBeGreaterThanOrEqual(2);
    // 没有 − + 按钮
    const btnMinus = page.locator('#modalBody button:has-text("−")');
    expect(await btnMinus.count()).toBe(0);
  });

  test('无 JS 错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });
});
