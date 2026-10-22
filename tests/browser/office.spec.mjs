import { test, expect } from '@playwright/test';

test('3D 渲染、旋转、缩放与镜头复位', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');const canvas=page.locator('#office-game');await expect(canvas).toHaveAttribute('data-view','3d');
  await page.locator('#life-toggle').click();
  const r=await canvas.boundingBox(), before=await canvas.getAttribute('data-azimuth');
  await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.75,r.y+r.height*.55,{steps:12});await page.mouse.up();
  await expect.poll(()=>canvas.getAttribute('data-azimuth')).not.toBe(before);
  await expect(page.locator('#game-hint')).toHaveText('拖动旋转 · 滚轮缩放 · 点击伙伴或家具互动');
  await page.mouse.wheel(0,-500);await expect.poll(async()=>Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.locator('#reset-camera').click();await expect(canvas).toHaveAttribute('data-zoom','1.00');
  await expect.poll(async()=>Math.abs(Number(await canvas.getAttribute('data-azimuth'))-Number(before))).toBeLessThan(.02);
  await expect(page.locator('.game-actor')).toHaveCount(7);expect(errors).toEqual([]);
});

test('场景中的角色可点选并沿网格移动', async ({page}) => {
  await page.goto('/');const canvas=page.locator('#office-game');await expect(canvas).toHaveAttribute('data-view','3d');
  await page.locator('#life-toggle').click();
  // Read the projected head anchor from the rendered accessible actor overlay.
  const actor=page.locator('.game-actor[aria-label="Vision · 团队协调"]');
  const head=await actor.boundingBox();await page.mouse.click(head.x+head.width/2,head.y+head.height+14);
  await expect(page.locator('[data-tab="profile"]')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#panel-content h3')).toHaveText('Vision');
  const before=await actor.getAttribute('data-tile');
  // Keyboard navigation uses the same collision-aware simulation in 3D.
  await canvas.press('ArrowDown');await page.locator('#life-toggle').click();
  await expect.poll(()=>actor.getAttribute('data-tile'),{timeout:10000}).not.toBe(before);
});

test('手机布局可以放大和复位且没有横向溢出', async ({page}) => {
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  const canvas=page.locator('#office-game');await expect(canvas).toHaveAttribute('data-view','3d');
  await page.locator('#zoom-in').click();await expect(canvas).toHaveAttribute('data-zoom','1.20');
  await page.locator('#reset-camera').click();await expect(canvas).toHaveAttribute('data-zoom','1.00');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('游戏界面按固定比例缩放，所有主区域始终在同一屏内', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#office-game')).toHaveAttribute('data-view', '3d');
  for (const viewport of [{width:1600,height:1000},{width:960,height:600},{width:1920,height:1080},{width:1000,height:900}]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => {
      const root = document.querySelector('#game-shell').getBoundingClientRect();
      return Math.abs(root.width / root.height - 1.6) < .001 && root.bottom <= innerHeight + 1 && root.right <= innerWidth + 1;
    })).toBe(true);
    const layout = await page.evaluate(() => {
      const root = document.querySelector('#game-shell').getBoundingClientRect();
      const selectors = ['.rail', '.topbar', '.office-panel', '.squad-dock', '.mission-launch', '.page-footer'];
      return {
        overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
        contained: selectors.every(selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return r.left >= root.left - 1 && r.top >= root.top - 1 && r.right <= root.right + 1 && r.bottom <= root.bottom + 1;
        }),
        canvasRatio: (() => { const r = document.querySelector('#office-game').getBoundingClientRect(); return r.width / root.width; })(),
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.contained).toBe(true);
    expect(layout.canvasRatio).toBeCloseTo(1, 2);
  }
  await page.locator('#settings').click();
  await expect(page.locator('#modal')).toBeVisible();
  const modal = await page.locator('#modal').boundingBox();
  expect(modal.y).toBeGreaterThanOrEqual(0);
  expect(modal.y + modal.height).toBeLessThanOrEqual(901);
  await page.locator('#modal-close').click();
});


test('游戏 HUD 可以展开任务、选择伙伴并回到完整场景', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#office-game')).toHaveAttribute('data-view', '3d');
  await expect(page.locator('#inspector')).toBeHidden();
  await expect(page.locator('#task-composer')).toBeHidden();
  await page.keyboard.press('m');
  await expect(page.locator('#task-input')).toBeFocused();
  await page.locator('#task-input').fill('为办公室设计一个新任务');
  await page.keyboard.press('Escape');
  await expect(page.locator('#task-composer')).toBeHidden();
  await page.locator('#mission-toggle').click();
  await expect(page.locator('#task-input')).toHaveValue('为办公室设计一个新任务');
  await page.locator('#composer-close').click();
  await page.keyboard.press('2');
  await expect(page.locator('#panel-content h3')).toHaveText('Jarvis');
  await page.locator('#panel-close').click();
  await expect(page.locator('#inspector')).toBeHidden();
  await page.getByRole('button', {name:'任务记录', exact:true}).click();
  await expect(page.locator('[data-tab="tasks"]')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', {name:'办公室', exact:true}).click();
  await expect(page.locator('#inspector')).toBeHidden();
});
