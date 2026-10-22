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
