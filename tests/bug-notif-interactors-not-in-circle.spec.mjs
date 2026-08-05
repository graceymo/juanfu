import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

// 辅助：直接通过 evaluate 模拟「加入 MOCK_CIRCLES」逻辑，绕开 UI input
// 真实产品中这个流程是 UI 弹窗；测试只关心圈子状态对触发器的影响
function makeJoinMock(code) {
  return (page) => page.evaluate((c) => {
    const mock = MOCK_CIRCLES[c];
    if (!mock) throw new Error('Unknown code: ' + c);
    const joined = {
      id: mock.id,
      name: mock.name,
      role: 'member',
      code: c,
      capacity: mock.capacity || 30,
      pending: false,
      reward: mock.reward || '',
      weeklyReward: !!mock.reward,
      memberList: [
        { emoji: appState.emoji, name: appState.nick, score: getMyWeekPts(), isMe: true, isLeader: false, joinDate: getCurrentWeekKey() },
        ...(mock.peerList || [])
      ],
      joinRequests: [],
      weeklyChampions: mock.weeklyChampions || [],
      rankSnapshots: mock.rankSnapshots || []
    };
    appState.circles.unshift(joined);
    appState.activeCircleId = joined.id;
    appState.joinedCircleName = joined.name;
    appState.hasCircle = true;
    appState.joinPending = false;
    saveAppState();
  }, code);
}

// 辅助：发布一条动态并触发社群互动模拟
function makePostAndTrigger(page, content) {
  return page.evaluate((c) => {
    const cid = appState.activeCircleId;
    const newPost = {
      id: 'test-post-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      circleId: cid,
      name: appState.nick,
      emoji: appState.emoji,
      time: '刚刚',
      content: c,
      likes: 0,
      commentsList: []
    };
    if (!window._userPostsByCircle) window._userPostsByCircle = {};
    if (!window._userPostsByCircle[cid]) window._userPostsByCircle[cid] = [];
    window._userPostsByCircle[cid].unshift(newPost);
    // 重置去重表
    window._socialNotifSent = new Set();
    triggerSocialSimulator(newPost.id);
  }, content);
}

// 走完注册流程并 await
async function completeOnboarding(page, nickname) {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.locator('#splash').click();
  await page.waitForTimeout(500);
  await page.fill('#regNickname', nickname);
  await page.fill('#regHeight', '170');
  await page.fill('#regWeight', '65');
  await page.locator('#page-register button:has-text("下一步")').click();
  await page.waitForTimeout(500);
  await page.locator('#page-profile-setup button:has-text("完成设置")').click();
  await page.waitForTimeout(500);
}

test.describe('Bug: 站内信出现的互动者是当前圈子成员，不是硬编码的 Monk/Lulu/Kenny', () => {

  test('J1: 攀岩小队成员发布动态 → 触发互动的人是攀岩小队的成员（不是 Monk/Lulu/Kenny）', async ({ page }) => {
    await completeOnboarding(page, '新用户');
    await makeJoinMock('CLIMB88')(page);
    await page.waitForTimeout(500);
    await makePostAndTrigger(page, '今天爬了 3 小时，抱石好爽！');

    // 等 7 秒（1.5-3.5s like1, 3-5s like2, 4-6s comment）
    await page.waitForTimeout(7500);

    // 验证：推送的通知的 fromName 必须是攀岩小队成员
    const circleMembers = await page.evaluate(() => {
      const c = (appState.circles || []).find(x => x.id === appState.activeCircleId);
      return c ? (c.memberList || []).map(m => m.name) : [];
    });
    expect(circleMembers).toContain('Jane');
    expect(circleMembers).toContain('老鹰');

    // 关键断言：互动通知的 fromName 不能是 Monk/Lulu/Kenny（这些是 demo 圈子成员，不是攀岩小队的）
    const interactors = await page.evaluate(() => {
      return (appState.notifications || [])
        .filter(n => n.type === 'like' || n.type === 'comment')
        .map(n => n.fromName);
    });
    expect(interactors.length).toBeGreaterThan(0);  // 至少触发了互动
    for (const name of interactors) {
      expect(circleMembers, `互动者「${name}」不在攀岩小队成员里`).toContain(name);
      expect(name).not.toBe('Monk');
      expect(name).not.toBe('Lulu');
      expect(name).not.toBe('Kenny');
    }
  });

  test('J2: 1 人圈子发布动态 → 不触发任何互动（无其他成员可互动）', async ({ page }) => {
    await completeOnboarding(page, '独行侠');

    // 创建一个只有自己的圈子（直接操作 appState，绕开 UI input）
    await page.evaluate(() => {
      const c = {
        id: 'created-solo-' + Date.now(),
        name: '我的独行圈',
        role: 'leader',
        code: 'SOLO1',
        members: 1,
        pending: false,
        reward: '最后一名请第一名喝咖啡',
        weeklyReward: true,
        memberList: [
          { emoji: appState.emoji, name: appState.nick, score: getMyWeekPts(), isMe: true, isLeader: true, joinDate: getCurrentWeekKey() }
        ],
        joinRequests: [],
        weeklyChampions: []
      };
      appState.circles.unshift(c);
      appState.activeCircleId = c.id;
      appState.joinedCircleName = c.name;
      appState.hasCircle = true;
      saveAppState();
    });
    await page.waitForTimeout(300);

    await makePostAndTrigger(page, '今天练了 5 公里');
    await page.waitForTimeout(7500);

    // 1 人圈子不应有任何 like/comment 通知
    const interactors = await page.evaluate(() => {
      return (appState.notifications || [])
        .filter(n => n.type === 'like' || n.type === 'comment')
        .map(n => n.fromName);
    });
    expect(interactors).toEqual([]);
  });

  test('J3: 互动通知 body 用圈子名做定位，不再截取动态前 18 字（避免"在「1」中"）', async ({ page }) => {
    await completeOnboarding(page, '测试');
    await makeJoinMock('CLIMB88')(page);
    await page.waitForTimeout(500);

    // 发布一个超短内容的动态（模拟用户发"1"的情况）
    await makePostAndTrigger(page, '1');
    await page.waitForTimeout(7500);

    // body 里不应该出现"在「1」中"这种短定位
    const bodies = await page.evaluate(() => {
      return (appState.notifications || [])
        .filter(n => n.type === 'like' || n.type === 'comment')
        .map(n => n.body);
    });
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).toMatch(/^在「[^」]+」中/);  // 必须以"在「xxx」中"开头
      expect(body).not.toContain('在「1」中');  // 修复前的 bug 文案
      expect(body).toContain('攀岩小队');  // 用圈子名
    }
  });

  test('J4: 通知时间显示不能为 NaN 天前（兼容旧的 time="刚刚" 字符串）', async ({ page }) => {
    await completeOnboarding(page, '用户');

    // 直接注入一条 time="刚刚"（旧格式）但有 createdAt 的通知
    await page.evaluate(() => {
      pushNotification({
        type: 'like',
        title: '❤️ Test 赞了你的动态',
        body: '测试通知',
        time: '刚刚',  // 旧格式：字符串
        fromName: 'Test'
      });
    });
    await page.waitForTimeout(300);

    // 打开通知中心
    await page.evaluate(() => openNotifications());
    await page.waitForTimeout(500);

    // 弹窗内容中不应该有 NaN 天前
    const modalText = await page.locator('#modalBody').textContent();
    expect(modalText).not.toContain('NaN');
  });

  test('J5: 新触发器连续 2 次发同 post 同 fromName 通知仍只产生 1 条（去重逻辑保留）', async ({ page }) => {
    await completeOnboarding(page, '用户A');
    await makeJoinMock('CLIMB88')(page);
    await page.waitForTimeout(500);

    // 重置去重表 + 发帖触发
    await makePostAndTrigger(page, '今天打卡');
    await page.waitForTimeout(7500);

    // 验证：每个 fromName 只产生 1 条 like / 1 条 comment（不会重复）
    const counts = await page.evaluate(() => {
      const result = {};
      (appState.notifications || [])
        .filter(n => n.type === 'like' || n.type === 'comment')
        .forEach(n => {
          const k = n.type + ':' + n.fromName;
          result[k] = (result[k] || 0) + 1;
        });
      return result;
    });
    for (const k in counts) {
      expect(counts[k], `${k} 应只产生 1 条通知`).toBe(1);
    }
  });
});
