#!/usr/bin/env python3
"""
验证两个 demo 流程：

1. 打开 ?qa=1&circles=1（老用户回访）→ dashboard 有 K800 + 公主两个圈子
2. 点击"设置 → 退出登录"→ 确认 → 直接跳到注册页（不是开屏）
3. 注册页表单字段为空，提示语正确
4. 完成注册 → dashboard 没有圈子（首次注册体验）

设计原则：先看截图判断 UI 行为，再用 Playwright 断言关键 DOM 状态。
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3456"
SCREENSHOTS_DIR = Path(__file__).parent.parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)

TEST_RESULTS = []


def log(name, ok, detail=""):
    """记录每条测试结果"""
    icon = "✅" if ok else "❌"
    msg = f"  {icon} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    TEST_RESULTS.append((name, ok, detail))


async def screenshot(page, name):
    """统一截图：全屏 + iPhone 14 Pro 视口"""
    await page.screenshot(path=str(SCREENSHOTS_DIR / f"{name}.png"), full_page=True)
    print(f"  📸 {name}.png")


async def test_returning_user_logout(page):
    """测试 1：老用户回访 → 退出登录 → 跳到注册页"""
    print("\n=== 测试 1: 老用户回访 → 退出登录 → 注册页 ===")

    # 1) 打开老用户 demo
    await page.goto(f"{BASE_URL}/prototype.html?qa=1&circles=1", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await screenshot(page, "t1_01_dashboard_with_circles")

    # 验证 appState.circles 包含 K800 + 公主（dashboard 只显示 active 圈子，K800 在 sidebar）
    state = await page.evaluate("""() => {
        return {
            circleNames: appState.circles.map(c => c.name),
            activeCircle: appState.circles.find(c => c.id === appState.activeCircleId)?.name,
            sidebarHtml: document.getElementById('sidebarCircleList')?.innerHTML || '',
        };
    }""")
    has_k800 = any("K800" in n for n in state["circleNames"])
    has_princess = any("公主" in n for n in state["circleNames"])
    log("appState 含 K800 圈子", has_k800, str(state["circleNames"]))
    log("appState 含'原来你也是公主'圈子", has_princess, str(state["circleNames"]))
    log("活跃圈子 = 原来你也是公主", state["activeCircle"] == "原来你也是公主", state["activeCircle"])

    # 验证 tabbar 可见
    tabbar_visible = await page.is_visible("#tabbar")
    log("Tabbar 可见", tabbar_visible)

    # 2) 打开设置页（通过 openPage('settings'），它用 recordModal 承载）
    await page.evaluate("openPage('settings')")
    await page.wait_for_timeout(500)
    await screenshot(page, "t1_02_settings_page")

    # 验证设置页（recordModal + modalTitle='设置'）打开
    settings_state = await page.evaluate("""() => {
        return {
            modalShown: document.getElementById('recordModal').classList.contains('show'),
            modalTitle: document.getElementById('modalTitle').textContent,
        };
    }""")
    log("设置页打开", settings_state["modalShown"] and settings_state["modalTitle"] == "设置", str(settings_state))

    # 3) 找到"退出登录"按钮并点击
    logout_clicked = await page.evaluate("""() => {
        const rows = document.querySelectorAll('.stat-row');
        for (const r of rows) {
            if (r.textContent.includes('退出登录') && r.onclick && r.onclick.toString().includes('doLogout')) {
                r.click();
                return true;
            }
        }
        return false;
    }""")
    log("点击退出登录", logout_clicked, "成功触发 doLogout" if logout_clicked else "未找到按钮")
    await page.wait_for_timeout(500)
    await screenshot(page, "t1_03_logout_confirm_modal")

    # 4) 验证确认弹窗出现（appConfirm 动态创建 #appConfirmOverlay）
    modal_state = await page.evaluate("""() => {
        const overlay = document.getElementById('appConfirmOverlay');
        return {
            exists: !!overlay,
            title: overlay ? overlay.querySelector('.modal-title')?.textContent : '',
            hasButtons: overlay ? overlay.querySelectorAll('button').length : 0,
        };
    }""")
    log("确认弹窗出现", modal_state["exists"] and "退出登录" in modal_state["title"], str(modal_state))

    # 5) 点击"退出"按钮
    clicked_exit = await page.evaluate("""() => {
        const overlay = document.getElementById('appConfirmOverlay');
        if (!overlay) return false;
        const btns = overlay.querySelectorAll('button');
        for (const b of btns) {
            if (b.textContent.trim() === '退出') {
                b.click();
                return true;
            }
        }
        return false;
    }""")
    log("点击'退出'按钮", clicked_exit, "成功触发" if clicked_exit else "未找到按钮")
    await page.wait_for_timeout(800)
    await screenshot(page, "t1_04_after_logout_should_be_register")

    # 6) 验证当前显示的是注册页（不是 splash 也不是 dashboard）
    page_state = await page.evaluate("""() => {
        return {
            registerVisible: document.getElementById('page-register').classList.contains('active'),
            registerDisplay: document.getElementById('page-register').style.display,
            splashVisible: document.getElementById('splash').style.display !== 'none' && !document.getElementById('splash').classList.contains('hide'),
            tabbarVisible: document.getElementById('tabbar').style.display !== 'none',
            nickValue: document.getElementById('regNickname').value,
            heightValue: document.getElementById('regHeight').value,
            weightValue: document.getElementById('regWeight').value,
        };
    }""")
    log("退出后显示注册页", page_state["registerVisible"], str(page_state))
    log("退出后隐藏 splash", not page_state["splashVisible"])
    log("退出后隐藏 tabbar", not page_state["tabbarVisible"])
    log("退出后昵称输入框为空", page_state["nickValue"] == "", f"value='{page_state['nickValue']}'")
    log("退出后身高输入框为空", page_state["heightValue"] == "", f"value='{page_state['heightValue']}'")
    log("退出后体重输入框为空", page_state["weightValue"] == "", f"value='{page_state['weightValue']}'")


async def test_registration_to_dashboard_no_circles(page):
    """测试 2：从注册页完成注册 → 进入 dashboard 但无圈子"""
    print("\n=== 测试 2: 完成注册 → dashboard 无圈子 ===")

    # 假设上一个测试结束后在注册页
    # 先确认在注册页
    on_register = await page.evaluate("document.getElementById('page-register').classList.contains('active')")
    if not on_register:
        # 如果不在注册页，重新打开 demo 并走一遍
        await page.goto(f"{BASE_URL}/prototype.html?qa=1&circles=1", wait_until="networkidle")
        await page.wait_for_timeout(500)
        await page.evaluate("openPage('settings')")
        await page.wait_for_timeout(300)
        await page.evaluate("""() => {
            const rows = document.querySelectorAll('.stat-row');
            for (const r of rows) {
                if (r.textContent.includes('退出登录') && r.onclick && r.onclick.toString().includes('doLogout')) {
                    r.click();
                    return;
                }
            }
        }""")
        await page.wait_for_timeout(500)
        await page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                if (b.textContent.trim() === '退出' && b.offsetParent !== null) {
                    b.click();
                    return;
                }
            }
        }""")
        await page.wait_for_timeout(800)

    await screenshot(page, "t2_01_register_page_empty")

    # 1) 填写注册表单
    await page.fill("#regNickname", "测试用户")
    await page.fill("#regHeight", "170")
    await page.fill("#regWeight", "60")
    await page.fill("#regBodyFat", "20")
    await page.wait_for_timeout(200)
    await screenshot(page, "t2_02_register_filled")

    # 2) 点击"下一步"
    await page.click("#btnRegister")
    await page.wait_for_timeout(500)
    await screenshot(page, "t2_03_profile_setup")

    # 3) 在资料设置页填写 slogan
    await page.fill("#regSlogan", "测试 Slogan")
    # 4) 点击"完成设置"
    clicked = await page.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
            if (b.textContent.trim() === '完成设置' && b.offsetParent !== null) {
                b.click();
                return true;
            }
        }
        return false;
    }""")
    log("点击'完成设置'按钮", clicked)
    await page.wait_for_timeout(800)
    await screenshot(page, "t2_04_dashboard_after_registration")

    # 5) 验证 dashboard 没有 K800 和公主圈
    body_text = await page.inner_text("body")
    has_k800 = "K800" in body_text
    has_princess = "原来你也是公主" in body_text
    log("新用户 dashboard 不含 K800 圈子", not has_k800, "✓" if not has_k800 else "× 仍然显示 K800")
    log("新用户 dashboard 不含公主圈", not has_princess, "✓" if not has_princess else "× 仍然显示公主圈")

    # 6) 验证"还没有圈子"空状态
    has_empty_state = "还没有" in body_text or "加入" in body_text or "创建" in body_text
    log("显示空状态/加入圈子提示", has_empty_state)

    # 7) 验证 localStorage 写入成功
    ls_state = await page.evaluate("""() => {
        const raw = localStorage.getItem('juanfu_user');
        if (!raw) return null;
        const data = JSON.parse(raw);
        return {
            onboardingDone: data.onboardingDone,
            nick: data.nick,
            circlesCount: data.circles ? data.circles.length : 0,
            hasCircle: data.hasCircle,
        };
    }""")
    log("localStorage 正确写入", ls_state is not None and ls_state["onboardingDone"], str(ls_state))
    log("新用户 localStorage 中 circles 为空", ls_state and ls_state["circlesCount"] == 0, str(ls_state))


async def test_qa1_without_circles_no_longer_special(page):
    """测试 3：?qa=1 单独使用不再跳到 dashboard，回归默认行为"""
    print("\n=== 测试 3: ?qa=1 单独使用应走默认行为 ===")

    # 清空 localStorage
    await page.goto(f"{BASE_URL}/prototype.html", wait_until="networkidle")
    await page.evaluate("localStorage.removeItem('juanfu_user')")

    # 打开 ?qa=1（不带 circles）
    await page.goto(f"{BASE_URL}/prototype.html?qa=1", wait_until="networkidle")
    await page.wait_for_timeout(500)
    await screenshot(page, "t3_qa1_without_circles")

    # 验证：splash 应该显示（默认行为），不应该直接跳到 dashboard
    splash_state = await page.evaluate("""() => {
        const s = document.getElementById('splash');
        return {
            display: s.style.display,
            hidden: s.classList.contains('hide')
        };
    }""")
    log("?qa=1（无 circles）显示 splash 开屏", splash_state["display"] != "none", str(splash_state))


async def main():
    print("🚀 开始 Playwright 自动化测试")
    print(f"   Base URL: {BASE_URL}")
    print(f"   Screenshots: {SCREENSHOTS_DIR}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 393, "height": 852},  # iPhone 14 Pro
            device_scale_factor=3,
        )
        page = await context.new_page()

        try:
            await test_returning_user_logout(page)
            await test_registration_to_dashboard_no_circles(page)
            await test_qa1_without_circles_no_longer_special(page)
        except Exception as e:
            print(f"\n❌ 测试异常: {e}")
            await screenshot(page, "ERROR")
            raise
        finally:
            await browser.close()

    # 汇总
    total = len(TEST_RESULTS)
    passed = sum(1 for _, ok, _ in TEST_RESULTS if ok)
    failed = total - passed
    print(f"\n{'='*50}")
    print(f"📊 测试结果: {passed}/{total} 通过" + (f"，{failed} 失败" if failed else ""))
    if failed:
        print("\n失败项：")
        for name, ok, detail in TEST_RESULTS:
            if not ok:
                print(f"  ❌ {name} — {detail}")
    print('='*50)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
