// @ts-check
// 场景 5：社群发帖 — 端到端测试
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001/prototype.html';

function getCurrentWeekKey() {
  const d = new Date();
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  const yearStart = new Date(monday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((monday - yearStart) / 86400000 + yearStart.getDay() || 7) / 7);
  return monday.getFullYear() + '-W' + weekNum;
}

const currentWeek = getCurrentWeekKey();

const makeState = () => ({
  onboardingDone: true, hasCircle: true,
  nick: 'Gracey', emoji: '🐙', slogan: '卷腹使我快乐',
  height: 168, weight: 55, bodyFat: 22,
  freq: 'daily', privacy: true, schedulePublic: true,
  notifSettings: { workout: true, diet: false, overtake: true, invite: true },
  myInviteCode: 'JFG88888',
  circles: [
    {
      id: 'preset-1', name: '原来你也是公主', role: 'leader', code: 'JFG88888',
      members: 11, capacity: 30, pending: false, reward: '最后一名请第一名喝咖啡', weeklyReward: true,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 130, isMe: true, isLeader: true, joinDate: '2026-W21', slogan: '卷腹使我快乐' },
        { emoji: '🦊', name: 'Monk', score: 165, isLeader: false, joinDate: '2026-W22', slogan: '能动就行' },
        { emoji: '🐨', name: 'Kenny', score: 155, isLeader: false, joinDate: '2026-W22', slogan: '累了就歇，歇完再干' },
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
        { name: 'Monk', emoji: '🦊', weekKey: '2026-W23', points: 110 },
        { name: 'Gracey', emoji: '🐙', weekKey: '2026-W24', points: 138 },
        { name: 'Gracey', emoji: '🐙', weekKey: '2026-W25', points: 152 },
        { name: 'Gracey', emoji: '🐙', weekKey: '2026-W26', points: 161 }
      ],
      rankSnapshots: [
        { weekKey: '2026-W22', rankings: [{name:'Gracey',rank:1,pts:88},{name:'Monk',rank:2,pts:95}] },
        { weekKey: '2026-W23', rankings: [{name:'Monk',rank:1,pts:110},{name:'Gracey',rank:2,pts:76}] },
        { weekKey: '2026-W24', rankings: [{name:'Gracey',rank:1,pts:138},{name:'Monk',rank:2,pts:125}] },
        { weekKey: '2026-W25', rankings: [{name:'Gracey',rank:1,pts:152},{name:'Monk',rank:2,pts:140}] },
        { weekKey: '2026-W26', rankings: [{name:'Monk',rank:1,pts:158},{name:'Kenny',rank:2,pts:150},{name:'Gracey',rank:3,pts:142}] }
      ]
    },
    {
      id: 'preset-2', name: 'K800 品牌群', role: 'member', code: 'K800ABCD',
      members: 2, capacity: 30, pending: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 0, isMe: true, isLeader: false, joinDate: '2026-W26' },
        { emoji: '🐨', name: 'Kenny', score: 98, isLeader: true, joinDate: '2026-W22' }
      ],
      joinRequests: [],
      weeklyChampions: [
        { name: 'Kenny', emoji: '🐨', weekKey: '2026-W22', points: 88 },
        { name: 'Kenny', emoji: '🐨', weekKey: '2026-W23', points: 102 },
        { name: 'Kenny', emoji: '🐨', weekKey: '2026-W24', points: 95 },
        { name: 'Kenny', emoji: '🐨', weekKey: '2026-W25', points: 108 }
      ],
      rankSnapshots: [
        { weekKey: '2026-W22', rankings: [{name:'Kenny',rank:1,pts:88}] },
        { weekKey: '2026-W23', rankings: [{name:'Kenny',rank:1,pts:102}] },
        { weekKey: '2026-W24', rankings: [{name:'Kenny',rank:1,pts:95}] },
        { weekKey: '2026-W25', rankings: [{name:'Kenny',rank:1,pts:108}] },
        { weekKey: '2026-W26', rankings: [{name:'Kenny',rank:1,pts:98},{name:'Gracey',rank:2,pts:0}] }
      ]
    }
  ],
  activeCircleId: 'preset-1',
  notifications: [],
  rankAtLastEvent: { 'preset-1': { 'Gracey': 3 } },
  todayRecords: [
    { id: 'r1', type: 'daily', group: '腿部', exercise: '深蹲', reps: 30, sets: 3, points: 45, time: '19:30', date: getTodayStr() },
    { id: 'r2', type: 'special', sport: '跑步机', minutes: 30, points: 38, time: '20:00', date: getTodayStr() },
    { id: 'r3', type: 'daily', group: '胸部', exercise: '卧推', reps: 12, sets: 4, points: 32, time: '18:30', date: getTodayStr() }
  ],
  schedule: {},
  weeklyPoints: 130, streakDays: 7,
  quarterPoints: 0,
  weekKey: currentWeek,
  quarterKey: '',
  leaderboardCache: {},
  lastCircleRanks: {}
});

function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

test.describe('场景 5：社群发帖', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, makeState());
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  // ============== 基础渲染 ==============
  test('① 社群 Tab 显示：mock 帖子 + fab 按钮', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(500);

    // 至少 5 条 mock 帖子
    const posts = await page.locator('.post').count();
    expect(posts).toBeGreaterThanOrEqual(5);

    // fab 按钮存在
    const fab = page.locator('#page-community .fab');
    await expect(fab).toBeVisible();
  });

  // ============== 打开编辑器 ==============
  test('② 点击 fab 打开发帖编辑器：含 textarea + 工具栏（导入运动/饮食 + 上传照片）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    const title = await page.locator('#modalTitle').textContent();
    expect(title).toBe('发布动态');

    const ta = page.locator('#postText');
    await expect(ta).toBeVisible();

    // 工具栏 3 个按钮：导入运动 + 导入饮食 + 上传照片
    const toolBtns = page.locator('#modalBody .post-tool-btn');
    await expect(toolBtns).toHaveCount(3);
    await expect(toolBtns.nth(0)).toContainText('导入运动');
    await expect(toolBtns.nth(1)).toContainText('导入饮食');
    await expect(toolBtns.nth(2)).toContainText('上传照片');

    // 验证：工具栏按钮是透明气泡样式（背景透明 + 圆角≥16px）
    const styles = await toolBtns.nth(0).evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        borderRadius: cs.borderRadius,
        border: cs.borderColor
      };
    });
    expect(styles.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(parseInt(styles.borderRadius)).toBeGreaterThanOrEqual(16);
  });

  // ============== 一键导入运动 ==============
  test('③ 从运动记录一键导入：展开面板 + 点击后填充到 textarea', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 展开导入运动面板
    await page.click('.post-tool-btn:has-text("导入运动")');
    await page.waitForTimeout(200);
    const panel = page.locator('#importPanelSport');
    await expect(panel).toBeVisible();

    // 显示 3 条记录
    const rows = await page.locator('#importPanelSport .post-import-row').count();
    expect(rows).toBe(3);

    // 点击第一条「深蹲 30×3」
    await page.locator('#importPanelSport .post-import-row').first().click();
    await page.waitForTimeout(200);

    const text = await page.locator('#postText').inputValue();
    expect(text).toContain('深蹲');
    expect(text).toContain('30');
  });

  // ============== 写文字 + 发布 ==============
  test('④ 输入自定义文字 + 发布：帖子出现在 feed 顶部', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 填入文字
    await page.locator('#postText').fill('今天腿已废🦵');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 帖子出现在 dynamic 区域
    const dynamicPosts = await page.locator('#communityFeedDynamic .post').count();
    expect(dynamicPosts).toBe(1);

    const content = await page.locator('#communityFeedDynamic .post .post-content').first().textContent();
    expect(content).toContain('今天腿已废');
  });

  // ============== 切圈子后用户帖子不丢 ==============
  test('⑤ 切圈子：自己的帖子不丢；feed 内容跟随圈子变化', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('圈子 1 测试帖子');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 切到 K800 群
    await page.evaluate(() => switchActiveCircle('preset-2'));
    await page.waitForTimeout(400);

    // 圈子 2 没有这条帖子
    const circle2Posts = await page.locator('#communityFeedDynamic .post').count();
    expect(circle2Posts).toBe(0);

    // 但 mock 帖子换了（K800 只有 Kenny 帖）
    const mockNames = await page.locator('#communityFeedMock .post-name').allTextContents();
    expect(mockNames.every(n => n.trim() === 'Kenny')).toBe(true);

    // 切回圈子 1，帖子还在
    await page.evaluate(() => switchActiveCircle('preset-1'));
    await page.waitForTimeout(400);
    const back = await page.locator('#communityFeedDynamic .post-content').first().textContent();
    expect(back).toContain('圈子 1 测试帖子');
  });

  // ============== 点赞交互 ==============
  test('⑥ 点赞：未点赞 → 红实心 + 数字 +1；再点取消', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 第一条 mock 帖子：Monk
    const firstLike = page.locator('#communityFeedMock .post-like-btn').first();
    const before = parseInt(await firstLike.locator('.post-like-count').textContent());
    await firstLike.click();
    await page.waitForTimeout(200);
    const after = parseInt(await firstLike.locator('.post-like-count').textContent());
    expect(after).toBe(before + 1);
    await expect(firstLike).toHaveClass(/liked/);

    // 再点取消
    await firstLike.click();
    await page.waitForTimeout(200);
    const after2 = parseInt(await firstLike.locator('.post-like-count').textContent());
    expect(after2).toBe(before);
    await expect(firstLike).not.toHaveClass(/liked/);
  });

  // ============== 评论交互 ==============
  test('⑦ 评论：展开输入框 + 发送后评论 + 1', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 第一条 mock 帖子 Monk（已有 2 条 mock 评论）
    const firstPost = page.locator('#communityFeedMock .post').first();
    const before = await firstPost.locator('.post-comment-count').textContent();

    // 展开评论
    await firstPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(200);
    const panel = firstPost.locator('.post-comments');
    await expect(panel).toHaveClass(/open/);

    // 看到 Monk 帖子原有的 mock 评论
    const beforeRows = await panel.locator('.post-comment-row').count();
    expect(beforeRows).toBeGreaterThanOrEqual(1);

    // 输入新评论
    const inputId = await firstPost.getAttribute('data-post-id');
    await page.locator('#comment-input-' + inputId).fill('加油💪');
    await page.locator('.post-comment-send').first().click();
    await page.waitForTimeout(300);

    // 评论数 +1
    const after = await firstPost.locator('.post-comment-count').textContent();
    expect(parseInt(after)).toBe(parseInt(before) + 1);

    // 新评论出现
    const afterText = await panel.locator('.post-comment-text').allTextContents();
    expect(afterText.join(' ')).toContain('加油');
  });

  // ============== 模拟：Kenny 延迟评论 + 通知 ==============
  test('⑧ 用户发新帖后 1.5-7s 内：收到 Monk/Lulu 点赞 + Kenny 评论 + 角标', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('测试延迟评论');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 等 7 秒让所有模拟触发完（Monk 1.5-3.5s / Lulu 3-5s / Kenny 4-6s）
    await page.waitForTimeout(7500);

    // 用户帖子的 likes ≥ 2（Monk + Lulu 至少 1 个）
    const myPost = page.locator('#communityFeedDynamic .post').first();
    const likeText = await myPost.locator('.post-like-count').textContent();
    expect(parseInt(likeText)).toBeGreaterThanOrEqual(2);

    // 评论数 ≥ 1（Kenny 评论）
    const cmtText = await myPost.locator('.post-comment-count').textContent();
    expect(parseInt(cmtText)).toBeGreaterThanOrEqual(1);

    // 通知中心：包含 Kenny 评论通知
    const notifBadge = await page.locator('#notifBadge').textContent();
    expect(parseInt(notifBadge || '0')).toBeGreaterThanOrEqual(1);

    // 展开评论：包含 Kenny 名字
    await myPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(300);
    const names = await myPost.locator('.post-comment-name').allTextContents();
    expect(names).toContain('Kenny');
  });

  // ============== 评论样式：透明气泡 + 深色文字 ==============
  test('⑨ 评论气泡是透明 + 左侧细边框（深色模式可读）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // Monk 帖子已有 2 条 mock 评论
    const firstPost = page.locator('#communityFeedMock .post').first();
    await firstPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(200);

    const body = firstPost.locator('.post-comment-body').first();
    await expect(body).toBeVisible();

    // 背景必须透明（深色主题下不应是浅色）
    const bg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    // 透明 = rgba(0,0,0,0) 或接近
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBeTruthy();

    // 左边框应该存在
    const borderLeft = await body.evaluate(el => getComputedStyle(el).borderLeftWidth);
    expect(parseFloat(borderLeft)).toBeGreaterThanOrEqual(1);

    // 评论文字颜色应该是亮色（深色主题下用 var(--text) = #FFFFFF）
    const textColor = await firstPost.locator('.post-comment-text').first().evaluate(el => getComputedStyle(el).color);
    // rgb(255, 255, 255) 或非常接近白色
    const m = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      // 亮度均值应 > 200（接近白色）
      expect((r + g + b) / 3).toBeGreaterThan(200);
    }
  });

  // ============== 评论输入框：深色背景 + 浅色文字 + 可读 placeholder ==============
  test('⑩ 评论输入框是深色背景（深色模式下可读）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    const firstPost = page.locator('#communityFeedMock .post').first();
    await firstPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(200);

    const inputId = await firstPost.getAttribute('data-post-id');
    const input = page.locator('#comment-input-' + inputId);

    // 背景应该用 var(--bg-elev-2) = #2C2C2E（深色），不是浅色 fallback
    const bg = await input.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(44, 44, 46)'); // #2C2C2E

    // 文字颜色应该是白色
    const textColor = await input.evaluate(el => getComputedStyle(el).color);
    expect(textColor).toBe('rgb(255, 255, 255)');
  });

  // ============== 发帖编辑器：照片按钮 + 图片预览 + 发布 ==============
  test('⑪ 发帖编辑器支持上传照片：按钮 → 选图 → 预览 → 发布后帖子含图片', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 打开编辑器
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 工具栏 3 个按钮：导入运动 + 导入饮食 + 上传照片
    const toolBtns = page.locator('#modalBody .post-tool-btn');
    await expect(toolBtns).toHaveCount(3);

    // 照片按钮文本为「上传照片」
    await expect(toolBtns.nth(2)).toContainText('上传照片');

    // 直接通过 applyPhotoData 模拟选图（避免真实 file picker）
    await page.evaluate(() => applyPhotoData('post', 'album', null, null));
    await page.waitForTimeout(200);

    // 预览区应显示
    const preview = page.locator('#postImagePreview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('相册');

    // 按钮文本应改为「换照片」
    await expect(toolBtns.nth(2)).toContainText('换照片');

    // 移除图片
    await page.locator('.post-image-remove').click();
    await page.waitForTimeout(100);
    await expect(preview).toBeHidden();

    // 再选一次（这次选 camera）
    await page.evaluate(() => applyPhotoData('post', 'camera', null, null));
    await page.waitForTimeout(200);
    await expect(preview).toContainText('拍摄');

    // 写文字 + 发布
    await page.locator('#postText').fill('今天破 PR 了，附上训练照');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 新帖子含 image
    const newPost = page.locator('#communityFeedDynamic .post').first();
    const imageArea = newPost.locator('.post-image');
    await expect(imageArea).toBeVisible();
    await expect(imageArea).toContainText('拍摄');

    // 编辑器状态应清空（重开发帖不应残留）
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    const previewAfter = page.locator('#postImagePreview');
    await expect(previewAfter).toBeHidden();
  });

  // ============== 评论：点赞 + 回复 ==============
  test('⑫ 评论支持点赞：点击 ❤️ 数字 +1，再点取消', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 找到 Monk 帖子（已包含 mock 评论），展开评论
    const monkPost = page.locator('.post').filter({ hasText: 'Monk' }).first();
    await monkPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(200);

    // 第一条评论的 like 按钮
    const firstLike = monkPost.locator('.post-comment-like').first();
    const beforeText = await firstLike.textContent();
    const before = parseInt((beforeText.match(/\d+/) || [0])[0]);
    await firstLike.click();
    await page.waitForTimeout(200);

    // 重新查找（DOM 重建）
    const afterLike = monkPost.locator('.post-comment-like').first();
    const afterText = await afterLike.textContent();
    const after = parseInt((afterText.match(/\d+/) || [0])[0]);
    expect(after).toBe(before + 1);

    // 验证样式：.liked 类应该存在
    const hasLikedClass = await afterLike.evaluate(el => el.classList.contains('liked'));
    expect(hasLikedClass).toBe(true);

    // 再次点击应该取消
    await afterLike.click();
    await page.waitForTimeout(200);
    const afterUnlike = monkPost.locator('.post-comment-like').first();
    const finalText = await afterUnlike.textContent();
    const final = parseInt((finalText.match(/\d+/) || [0])[0]);
    expect(final).toBe(before);
  });

  test('⑬ 评论支持回复：点回复 → 出现输入框 → 提交后显示在父评论下', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // Monk 帖子展开评论
    const monkPost = page.locator('.post').filter({ hasText: 'Monk' }).first();
    await monkPost.locator('.post-comment-btn').click();
    await page.waitForTimeout(200);

    // 点第一条评论的「回复」
    const firstReply = monkPost.locator('.post-comment-reply').first();
    await firstReply.click();
    await page.waitForTimeout(200);

    // 输入框应可见
    const input = page.locator('.post-comment-reply-input').first();
    await expect(input).toBeVisible();

    // 输入回复文本
    await input.fill('我也来加练');
    await page.locator('.post-comment-reply-send').first().click();
    await page.waitForTimeout(200);

    // 父评论下应出现回复
    const replyRow = page.locator('.post-comment-reply-row').first();
    await expect(replyRow).toBeVisible();
    await expect(replyRow).toContainText('我也来加练');
    // 当前用户昵称
    const myNick = await page.evaluate(() => appState.nick);
    await expect(replyRow).toContainText(myNick);
  });

  // ============== 上传照片：点击按钮弹选择器 ==============
  test('⑭ 点击「上传照片」按钮弹出选择器：拍摄 / 相册 / 取消', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 打开编辑器
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 点击「上传照片」（第 3 个工具按钮，索引 2）
    const photoBtn = page.locator('#modalBody .post-tool-btn').nth(2);
    await expect(photoBtn).toContainText('上传照片');
    await photoBtn.click();
    await page.waitForSelector('#photoSourceOverlay', { timeout: 3000 });

    // 选择器应包含 3 个按钮：拍摄 / 从相册选择 / 取消
    const overlay = page.locator('#photoSourceOverlay');
    const btns = overlay.locator('button');
    await expect(btns).toHaveCount(3);

    const btnTexts = await btns.allTextContents();
    expect(btnTexts.some(t => t.includes('拍摄'))).toBe(true);
    expect(btnTexts.some(t => t.includes('从相册选择'))).toBe(true);
    expect(btnTexts.some(t => t.includes('取消'))).toBe(true);

    // 点「从相册选择」→ 模拟上传完成 → 预览区出现
    await overlay.locator('button', { hasText: '从相册选择' }).click();
    await page.waitForTimeout(300);

    const preview = page.locator('#postImagePreview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('相册');
  });

  // ============== 导入运动面板：透明 + 虚线边框 ==============
  test('⑮ 导入运动面板是透明背景 + 虚线边框（深色模式可读）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');

    // 展开导入面板
    await page.click('#modalBody .post-tool-btn:first-child');
    await page.waitForTimeout(200);

    const panel = page.locator('#importPanelSport');
    await expect(panel).toBeVisible();

    // 验证 CSS：背景透明 + 虚线边框
    const css = await panel.evaluate(el => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, border: s.borderStyle };
    });
    // 透明背景的 backgroundColor 应该是 rgba(0,0,0,0)
    expect(css.background).toBe('rgba(0, 0, 0, 0)');
    expect(css.border).toBe('dashed');
  });

  // ============== 导入运动时间显示：友好时间格式 ==============
  test('⑯ 导入运动时间显示友好格式（刚刚/分钟前/今天 HH:MM）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);

    // 注入 3 条不同时间的测试记录
    await page.evaluate(() => {
      const now = Date.now();
      appState.todayRecords = [
        { id: 't1', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 30,
          date: new Date().toISOString().slice(0, 10), time: '17:13', createdAt: now },
        { id: 't2', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 30,
          date: new Date().toISOString().slice(0, 10), time: '17:12', createdAt: now - 5 * 60 * 1000 },
        { id: 't3', type: 'special', category: '攀岩', sport: '室内抱石', minutes: 90, points: 60,
          date: new Date().toISOString().slice(0, 10), time: '16:30', createdAt: now - 80 * 60 * 1000 }
      ];
    });

    // 打开编辑器 → 展开导入面板
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.click('#modalBody .post-tool-btn:first-child');
    await page.waitForTimeout(200);

    const times = await page.locator('.post-import-time').allTextContents();
    expect(times.length).toBe(3);
    // 第 1 条 < 1 分钟 → "刚刚"
    expect(times[0]).toBe('刚刚');
    // 第 2 条 5 分钟前
    expect(times[1]).toBe('5 分钟前');
    // 第 3 条 80 分钟前（同一天，>= 60min）→ "今天 HH:MM"
    expect(times[2]).toBe('今天 16:30');
  });

  // ============== 别人点赞/评论：收到通知提醒 ==============
  test('⑰ 别人点赞和评论我的帖子，都收到通知提醒（like + comment）', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('来测通知');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 等 9 秒让所有模拟触发完（Monk 1.5-3.5s / Lulu 3-5s / Kenny 4-6s，最坏 6s）
    await page.waitForTimeout(9000);

    // 通知中心：至少 3 条未读（Monk 点赞 + Lulu 点赞 + Kenny 评论）
    const notifList = await page.evaluate(() => appState.notifications || []);
    const unread = notifList.filter(n => !n.read);
    expect(unread.length).toBeGreaterThanOrEqual(3);

    // 含 Monk 点赞通知
    const monkLike = notifList.find(n => n.type === 'like' && n.fromName === 'Monk');
    expect(monkLike).toBeTruthy();
    expect(monkLike.title).toContain('Monk');
    expect(monkLike.title).toContain('赞了');

    // 含 Lulu 点赞通知
    const luluLike = notifList.find(n => n.type === 'like' && n.fromName === 'Lulu');
    expect(luluLike).toBeTruthy();
    expect(luluLike.title).toContain('Lulu');

    // 含 Kenny 评论通知
    const kennyComment = notifList.find(n => n.type === 'comment' && n.fromName === 'Kenny');
    expect(kennyComment).toBeTruthy();
    expect(kennyComment.title).toContain('Kenny');
    expect(kennyComment.title).toContain('评论');

    // 角标数 ≥ 3
    const notifBadge = await page.locator('#notifBadge').textContent();
    expect(parseInt(notifBadge || '0')).toBeGreaterThanOrEqual(3);
  });

  // ============== 圈子副标题：跟随 active circle 更新 ==============
  test('⑱ 社群副标题显示当前 active circle 名称 + 动态数', async ({ page }) => {
    // 切到社群 Tab
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(400);

    // 副标题应显示预设圈子 1 的名字（"原来你也是公主"）
    const sub1 = await page.locator('#communitySubtitle').textContent();
    expect(sub1).toContain('原来你也是公主');
    expect(sub1).toContain('条动态');
    // 应包含具体数字（mock 帖子数 ≥ 5）
    const m1 = sub1.match(/(\d+)\s*条动态/);
    expect(m1).toBeTruthy();
    expect(parseInt(m1[1])).toBeGreaterThanOrEqual(5);

    // 切到圈子 2
    await page.evaluate(() => switchActiveCircle('preset-2'));
    await page.waitForTimeout(400);

    // 副标题应跟随切换
    const sub2 = await page.locator('#communitySubtitle').textContent();
    expect(sub2).toContain('K800 品牌群');
    expect(sub2).toContain('条动态');
    const m2 = sub2.match(/(\d+)\s*条动态/);
    expect(m2).toBeTruthy();
    // 圈子 2 mock 帖：Kenny 的 2 条
    expect(parseInt(m2[1])).toBe(2);

    // 在圈子 1 发一条帖子，验证动态数 +1
    await page.evaluate(() => switchActiveCircle('preset-1'));
    await page.waitForTimeout(400);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('验证动态数');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 副标题动态数 = 之前的 +1
    const sub3 = await page.locator('#communitySubtitle').textContent();
    const m3 = sub3.match(/(\d+)\s*条动态/);
    expect(m3).toBeTruthy();
    expect(parseInt(m3[1])).toBe(parseInt(m1[1]) + 1);
  });

  // ============== 帖子：显示所属圈子标签 ==============
  test('⑲ 用户发的帖子带「圈子」标签，标齐所选圈子', async ({ page }) => {
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('测试圈子标签');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 帖子应有 .post-circle-tag
    const tag = page.locator('#communityFeedDynamic .post-circle-tag').first();
    await expect(tag).toBeVisible();
    const tagText = await tag.textContent();
    expect(tagText).toContain('原来你也是公主');

    // 切到圈子 2
    await page.evaluate(() => switchActiveCircle('preset-2'));
    await page.waitForTimeout(400);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('圈子 2 测试');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    // 圈子 2 的用户帖子带 K800 品牌群 标签
    const tag2 = page.locator('#communityFeedDynamic .post-circle-tag').first();
    await expect(tag2).toBeVisible();
    const tag2Text = await tag2.textContent();
    expect(tag2Text).toContain('K800 品牌群');
  });

  // ============== 排行榜：用户头像拉齐用户设置（emoji + 绿渐变）==============
  test('⑳ 排行榜 + 社群：所有成员头像都拉齐到各自 emoji（不仅是用户自己）', async ({ page }) => {
    // 准备测试圈子（含 4+ 成员，每个有 emoji）
    await page.evaluate(() => {
      const active = appState.circles.find(c => c.id === appState.activeCircleId);
      if (active && active.memberList.length < 4) {
        active.memberList = [
          { emoji: '🐙', name: 'Gracey', score: 135, isMe: true, isLeader: true, joinDate: '2026-W21' },
          { emoji: '🦊', name: 'Monk', score: 165, isLeader: false, joinDate: '2026-W22' },
          { emoji: '🐨', name: 'Kenny', score: 155, isLeader: false, joinDate: '2026-W22' },
          { emoji: '🐱', name: 'Lulu', score: 148, isLeader: false, joinDate: '2026-W23' },
          { emoji: '🐼', name: 'Panda', score: 142, isLeader: false, joinDate: '2026-W23' }
        ];
      }
    });

    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // 1) 排行榜列表：所有人的 lb-avatar 都显示 emoji（不是字母）
    const allLbs = await page.locator('.lb-avatar-emoji').allTextContents();
    expect(allLbs.length).toBeGreaterThanOrEqual(4);
    // 至少不能是单个字母（'M'、'K' 这种纯字母）— Emoji 长度 > 1 或包含非 ASCII
    for (const txt of allLbs) {
      const trimmed = txt.trim();
      // Emoji 在 JS 字符串中通常 > 1 字节（不一定 > 1 char），但能区分 emoji vs 字母
      // 简化判断：长度 > 1 或包含非 ASCII 字符
      const isEmoji = trimmed.length > 1 || /[^\x00-\x7F]/.test(trimmed);
      expect(isEmoji).toBe(true);
    }

    // 2) 用户的行：有 (我) 标识，背景是绿渐变
    const meRow = page.locator('.lb-row').filter({ hasText: '(我)' });
    expect(await meRow.count()).toBeGreaterThanOrEqual(1);
    const meAvatar = meRow.locator('.lb-avatar').first();
    expect(await meAvatar.evaluate(el => el.classList.contains('lb-avatar-me'))).toBe(true);
    const meAvatarText = (await meAvatar.textContent()).trim();
    const myEmoji = await page.evaluate(() => appState.emoji);
    expect(meAvatarText).toBe(myEmoji);

    // 3) 社群里用户自己的帖子头像也应是 appState.emoji + 绿渐变
    await page.evaluate(() => switchTab('community'));
    await page.waitForTimeout(300);
    await page.click('#page-community .fab');
    await page.waitForSelector('#recordModal.show');
    await page.locator('#postText').fill('验证头像');
    await page.click('#modalBody button:has-text("发布")');
    await page.waitForTimeout(400);

    const myPostAvatar = page.locator('#communityFeedDynamic .post-avatar').first();
    const postAvatarText = (await myPostAvatar.textContent()).trim();
    expect(postAvatarText).toBe(myEmoji);

    const postBg = await myPostAvatar.evaluate(el => getComputedStyle(el).background);
    expect(postBg).toContain('linear-gradient');
    // 绿色主色：rgb 通道 G > R 且 G > B（取第一个 rgb 颜色即可）
    const postRgb = postBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (postRgb) {
      const r = parseInt(postRgb[1]), g = parseInt(postRgb[2]), b = parseInt(postRgb[3]);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });
});
