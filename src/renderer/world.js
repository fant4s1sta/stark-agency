// World coordinates are tile based. Foot positions, collision and rendering share this map.
export const TILE = 32, COLS = 26, ROWS = 18;
export const WIDTH = COLS * TILE, HEIGHT = ROWS * TILE;
export const objects = [
  { id: 'bookcase', type: 'books', x: 1, y: 3, w: 3, h: 1 },
  { id: 'whiteboard', type: 'board', x: 6, y: 3, w: 4, h: 1 },
  { id: 'plant-north', type: 'plant', x: 11, y: 3, w: 1, h: 1 },
  { id: 'coffee', type: 'coffee', x: 13, y: 3, w: 3, h: 1 },
  { id: 'server', type: 'server', x: 18, y: 3, w: 2, h: 1 },
  { id: 'tools', type: 'tools', x: 22, y: 3, w: 3, h: 1 },
  { id: 'ultron-desk', type: 'desk', x: 2, y: 6, w: 3, h: 1, color: '#c67664', owner: 'ultron' },
  { id: 'friday-desk', type: 'desk', x: 7, y: 6, w: 3, h: 1, color: '#72ad96', owner: 'friday' },
  { id: 'edith-desk', type: 'desk', x: 15, y: 6, w: 3, h: 1, color: '#ae8abb', owner: 'edith' },
  { id: 'u-desk', type: 'desk', x: 21, y: 7, w: 3, h: 1, color: '#84b4c7', owner: 'u' },
  { id: 'plant-west', type: 'plant', x: 1, y: 9, w: 1, h: 1 },
  { id: 'sofa', type: 'sofa', x: 2, y: 11, w: 4, h: 1 },
  { id: 'side-table', type: 'lowtable', x: 3, y: 13, w: 2, h: 1 },
  { id: 'reading-desk', type: 'desk', x: 8, y: 12, w: 3, h: 1, color: '#8fa1bb', owner: 'jarvis', paper: true },
  { id: 'meeting', type: 'meeting', x: 15, y: 11, w: 4, h: 2 },
  { id: 'plant-meeting', type: 'plant', x: 20, y: 11, w: 1, h: 1 },
  { id: 'cabinet', type: 'cabinet', x: 23, y: 12, w: 2, h: 2 },
  { id: 'plant-south', type: 'plant', x: 22, y: 15, w: 1, h: 1 }
];
export const stations = {
  vision: { x: 7, y: 4, facing: 'up', action: 'planning', object: 'whiteboard', label: '在白板前整理想法' },
  ultron: { x: 3, y: 7, facing: 'up', action: 'work', object: 'ultron-desk', label: '坐下审查方案' },
  friday: { x: 8, y: 7, facing: 'up', action: 'work', object: 'friday-desk', label: '坐下编写代码' },
  edith: { x: 16, y: 7, facing: 'up', action: 'work', object: 'edith-desk', label: '检查运行状态' },
  jarvis: { x: 9, y: 13, facing: 'up', action: 'read', object: 'reading-desk', label: '翻阅工作笔记' },
  dume: { x: 23, y: 4, facing: 'up', action: 'repair', object: 'tools', label: '整理工具' },
  u: { x: 22, y: 8, facing: 'up', action: 'work', object: 'u-desk', label: '归档新的观察' },
  coffee: { x: 14, y: 4, facing: 'up', action: 'coffee', object: 'coffee', label: '泡一杯咖啡' },
  books: { x: 2, y: 4, facing: 'up', action: 'read', object: 'bookcase', label: '在书架前阅读' },
  lounge: { x: 3, y: 12, facing: 'down', action: 'rest', object: 'sofa', label: '在休息区放松' },
  plants: { x: 21, y: 15, facing: 'right', action: 'water', object: 'plant-south', label: '给绿植浇水' },
  meeting: { x: 16, y: 13, facing: 'up', action: 'talk', object: 'meeting', label: '在圆桌旁讨论' }
};
export const gathering = [
  { x: 16, y: 10, facing: 'down' }, { x: 17, y: 10, facing: 'down' },
  { x: 14, y: 11, facing: 'right' }, { x: 14, y: 12, facing: 'right' },
  { x: 16, y: 13, facing: 'up' }, { x: 17, y: 13, facing: 'up' }, { x: 19, y: 12, facing: 'left' }
];
export function key(x, y) { return `${x},${y}`; }
export function createGrid() {
  const grid = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => x >= 1 && x <= 24 && y >= 3 && y <= 16));
  for (const o of objects) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) grid[y][x] = false;
  return grid;
}
export function walkable(grid, x, y, blocked = new Set()) { return Boolean(grid[y]?.[x]) && !blocked.has(key(x, y)); }
export function findPath(grid, start, goal, blocked = new Set()) {
  if (!walkable(grid, goal.x, goal.y, blocked)) return null;
  const startKey = key(start.x, start.y), goalKey = key(goal.x, goal.y);
  const frontier = [{ ...start, score: 0 }], previous = new Map(), costs = new Map([[startKey, 0]]);
  while (frontier.length) {
    frontier.sort((a, b) => a.score - b.score);
    const current = frontier.shift(), currentKey = key(current.x, current.y);
    if (currentKey === goalKey) {
      const path = []; let cursor = currentKey;
      while (cursor !== startKey) { const [x, y] = cursor.split(',').map(Number); path.unshift({ x, y }); cursor = previous.get(cursor); }
      return path;
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = current.x + dx, y = current.y + dy, nextKey = key(x, y);
      if (!walkable(grid, x, y, blocked)) continue;
      const cost = costs.get(currentKey) + 1;
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, cost); previous.set(nextKey, currentKey);
      frontier.push({ x, y, score: cost + Math.abs(x - goal.x) + Math.abs(y - goal.y) });
    }
  }
  return null;
}
export function nearestFree(grid, target, blocked = new Set(), radius = 4) {
  for (let distance = 0; distance <= radius; distance++) for (let dy = -distance; dy <= distance; dy++) for (let dx = -distance; dx <= distance; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== distance) continue;
    const x = target.x + dx, y = target.y + dy;
    if (walkable(grid, x, y, blocked)) return { x, y };
  }
  return null;
}
export function depth(entity) { return entity.kind === 'actor' ? entity.y : (entity.y + entity.h) * TILE - 2; }
