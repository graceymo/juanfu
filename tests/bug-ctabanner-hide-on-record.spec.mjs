import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');
const LS_KEY = 'juanfu_user';

// ============================================================
// 回归测试：Bug 「打卡后新用户引导 Banner 仍然显示」
//
// 背景：
//   原 updateCircleCard 只看"圈子成员只有自己"判定是否显示 banner
//   （prototype.html:3207）
//   即使新用户已经打卡，banner 仍持续展示
//
// 修复：
//   - 增加条件 `&& !hasRecordedToday` —— 今日已有记录则隐藏
//   - banner 引导文案"去打个卡吧"应该只在"还未打卡"时出现
//
// 验证：
//   1. 新用户注册 + 创建 1 人圈子 → banner 可见
//   2. 提交运动记录 → banner 自动隐藏
//   3. 多人圈子（CLIMB88 邀请码）即使没记录也不显示 banner
// ============================================================

test.describe('回归 #bug-0728-ctaBanner: 打卡后引导 Banner 消失', () => {

  // 通用：完成注册流程
  async function completeRegistration(page) {
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
  }

  test('H1: 创建 1 人圈子后 → banner 可见（未打卡）', async ({ page }) => {
    await completeRegistration(page);

    // 创建 1 人圈子
    await page.locator('button', { hasText: '创建圈子' }).first().click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '我的小队');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);

    // 验证 banner 可见
    const banner = page.locator('#ctaBanner');
    await expect(banner).toBeVisible();
  });

  test('H2: 打卡后 → banner 自动隐藏', async ({ page }) => {
    await completeRegistration(page);

    // 创建 1 人圈子
    await page.locator('button', { hasText: '创建圈子' }).first().click();
    await page.waitForTimeout(400);
    await page.fill('#createCircleName', '打卡测试');
    await page.locator('#btnCreateCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);

    // 此时 banner 应可见
    await expect(page.locator('#ctaBanner')).toBeVisible();

    // 直接通过 evaluate 提交一条记录（绕开 UI 选择器的不稳定性）
    await page.evaluate(() => {
      appState.todayRecords.push({
        id: 'test-rec-' + Date.now(),
        createdAt: Date.now(),
        type: 'special',
        sport: '室内抱石',
        minutes: 30,
        points: 60,
        shared: false
      });
      updateCircleCard(true);  // 触发 banner 显隐重新计算
    });
    await page.waitForTimeout(500);

    // 验证 banner 已隐藏
    const banner = page.locator('#ctaBanner');
    const display = await banner.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('H3: 多人圈子（CLIMB88）即使没记录也不显示 banner', async ({ page }) => {
    await completeRegistration(page);

    // 加入 5 人圈子
    await page.locator('button', { hasText: '加入圈子' }).first().click();
    await page.waitForTimeout(400);
    await page.fill('#joinCode', 'CLIMB88');
    await page.locator('#btnJoinCircle').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').click();
    await page.waitForTimeout(300);

    // 验证 banner 隐藏（成员 > 1 时本就不应显示）
    const banner = page.locator('#ctaBanner');
    const display = await banner.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });
});
