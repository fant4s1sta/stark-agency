const WIDTH = 1600;
const HEIGHT = 1000;
const surface = document.querySelector('#game-shell');
const button = document.querySelector('#fullscreen-toggle');

function fitDisplay() {
  const scale = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  document.documentElement.style.setProperty('--display-scale', scale);
  surface.style.zoom = scale;
  surface.style.left = `${(innerWidth / scale - WIDTH) / 2}px`;
  surface.style.top = `${(innerHeight / scale - HEIGHT) / 2}px`;
}
fitDisplay();
addEventListener('resize', fitDisplay);

function reflectFullscreen(active) {
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '⛶ 窗口模式' : '⛶ 全屏';
}
async function toggleFullscreen() {
  try {
    if (window.starkDesktop) {
      reflectFullscreen(await window.starkDesktop.toggleFullscreen());
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error('切换全屏失败', error);
    button.title = '无法切换全屏，请使用系统窗口按钮';
  }
}
button.addEventListener('click', toggleFullscreen);
if (window.starkDesktop) {
  window.starkDesktop.onFullscreenChange(reflectFullscreen);
} else {
  document.addEventListener('fullscreenchange', () => reflectFullscreen(Boolean(document.fullscreenElement)));

}
// Keep long activity feeds keyboard-accessible inside their fixed panel.
const panel = document.querySelector('#panel-content');
panel.tabIndex = 0;
panel.setAttribute('aria-label', '办公室内容，可使用方向键翻阅');

addEventListener('keydown', event => {
  if (event.repeat) return;
  const desktop = Boolean(window.starkDesktop);
  const toggle = event.key === 'F11' || (desktop && event.key.toLowerCase() === 'f' && event.ctrlKey && event.metaKey);
  if (event.key === 'Escape' && document.querySelector('#modal').open) return;
  if (event.key === 'Escape') {
    if (!document.querySelector('#task-composer').hidden) { setComposerOpen(false); event.preventDefault(); return; }
    if (!document.querySelector('#inspector').hidden) { setPanelOpen(false); event.preventDefault(); return; }
  }
  const leave = desktop && event.key === 'Escape' && button.getAttribute('aria-pressed') === 'true';
  if (toggle || leave) { event.preventDefault(); void toggleFullscreen(); }
});

export function setPanelOpen(open) {
  document.querySelector('#inspector').hidden = !open;
  if (open) {
    document.querySelector('#task-composer').hidden = true;
    document.querySelector('#mission-toggle').setAttribute('aria-expanded', 'false');
  }
  if (!open) {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === 'office'));
    document.querySelector('#office-game').focus({preventScroll:true});
  }
}
export function setComposerOpen(open) {
  document.querySelector('#task-composer').hidden = !open;
  document.querySelector('#mission-toggle').setAttribute('aria-expanded', String(open));
  if (open) { setPanelOpen(false); document.querySelector('#task-input').focus({preventScroll:true}); }
  else document.querySelector('#mission-toggle').focus({preventScroll:true});
}
document.querySelector('#panel-close').onclick = () => setPanelOpen(false);
document.querySelector('#composer-close').onclick = () => setComposerOpen(false);
document.querySelector('#mission-toggle').onclick = () => setComposerOpen(document.querySelector('#task-composer').hidden);
addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('#modal').open || event.target.closest('input,textarea,[contenteditable]')) return;
  if (event.key.toLowerCase() === 'm') { event.preventDefault(); setComposerOpen(document.querySelector('#task-composer').hidden); }
  if (/^[1-7]$/.test(event.key)) document.querySelectorAll('.agent-card')[Number(event.key)-1]?.click();
});
