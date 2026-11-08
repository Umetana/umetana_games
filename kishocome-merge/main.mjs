import { config } from './config.mjs';
import { MergeGame, readComments } from './game.mjs';
import { createNextRenderer, createRenderer } from './render.mjs';

const ui = Object.fromEntries([
  'field', 'overlay', 'state', 'message', 'primary', 'secondary', 'score',
  'best', 'nextCard', 'gameModes', 'pause', 'restart', 'sound',
].map(id => [id, document.getElementById(id)]));

const storagePrefix = 'kishocome-merge:';
function load(key) {
  try { return localStorage.getItem(storagePrefix + key); } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(storagePrefix + key, String(value)); } catch { /* Play without storage. */ }
}

function bestKey(material) {
  return material === 'classic' ? 'best' : 'best:' + material;
}

function loadBest(material) {
  const value = Number(load(bestKey(material)));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
let soundEnabled = load('sound') !== 'off';
let audio;
function unlockAudio() {
  if (!soundEnabled || !window.AudioContext) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function playEffect(ban) {
  if (!soundEnabled || audio?.state !== 'running') return;
  const at = audio.currentTime;
  const voice = audio.createOscillator();
  const gain = audio.createGain();
  voice.type = ban ? 'triangle' : 'sine';
  voice.frequency.setValueAtTime(ban ? 210 : 490, at);
  voice.frequency.exponentialRampToValueAtTime(ban ? 65 : 840, at + 0.13);
  gain.gain.setValueAtTime(config.volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.19);
  voice.connect(gain).connect(audio.destination);
  voice.start(at);
  voice.stop(at + 0.2);
}

function refreshSound() {
  ui.sound.textContent = soundEnabled ? 'SE オン' : 'SE オフ';
  ui.sound.setAttribute('aria-pressed', String(soundEnabled));
}

ui.sound.onclick = () => {
  soundEnabled = !soundEnabled;
  save('sound', soundEnabled ? 'on' : 'off');
  refreshSound();
  unlockAudio();
};
refreshSound();
ui.best.textContent = loadBest('classic');

function menu(title, message, primary, secondary) {
  ui.overlay.hidden = false;
  ui.gameModes.hidden = true;
  ui.state.textContent = title;
  ui.message.textContent = message;
  for (const [button, action] of [[ui.primary, primary], [ui.secondary, secondary]]) {
    button.hidden = !action;
    button.textContent = action?.[0] ?? '';
    button.onclick = action?.[1] ?? null;
  }
  if (primary) ui.primary.focus();
}

async function init() {
  const response = await fetch(new URL('./comments.json', import.meta.url));
  if (!response.ok) throw new Error('Comment data could not be loaded');
  const comments = readComments(await response.json());
  const draw = createRenderer(ui.field);
  const drawNext = createNextRenderer(ui.nextCard);
  let material = 'classic';
  let best = loadBest(material);
  const game = new MergeGame(window.Matter, comments, (ban, score) => {
    if (score > best) {
      best = score;
      save(bestKey(material), best);
      ui.best.textContent = best;
    }
    ui.score.textContent = score;
    playEffect(ban);
  });

  const pressed = new Set();
  const left = ['ArrowLeft', 'KeyA'];
  const right = ['ArrowRight', 'KeyD'];
  let mode = 'title';
  let displayedNext;
  let elapsed = 0;
  let previousTime;

  function refreshNext() {
    const next = mode === 'title' ? null : game.next;
    if (displayedNext === next) return;
    displayedNext = next;
    drawNext(next);
  }

  function changeMode(nextMode) {
    mode = nextMode;
    pressed.clear();
    elapsed = 0;
    ui.pause.disabled = !['playing', 'paused'].includes(mode);
    ui.restart.disabled = ui.pause.disabled;
    ui.pause.textContent = mode === 'paused' ? '再開' : '一時停止';
    ui.overlay.hidden = mode === 'playing';
    refreshNext();
    if (mode === 'playing' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function start() {
    unlockAudio();
    if (mode === 'title') material = ui.gameModes.querySelector('input:checked').value;
    best = loadBest(material);
    ui.best.textContent = best;
    game.reset(material);
    ui.score.textContent = '0';
    changeMode('playing');
  }

  function title() {
    game.reset();
    ui.score.textContent = '0';
    changeMode('title');
    menu('キショコメ・マージ', '角度をつけて落とし、Lv.8をふたつ育てよう。', ['スタート', start]);
    ui.gameModes.hidden = false;
    ui.best.textContent = loadBest(ui.gameModes.querySelector('input:checked').value);
    ui.gameModes.querySelector('input:checked').focus();
  }

  function pause() {
    if (mode === 'paused') {
      changeMode('playing');
    } else if (mode === 'playing') {
      changeMode('paused');
      menu('一時停止', '再開すると、ここからプレイを続けられます。', ['再開', pause]);
    }
  }

  function restart() {
    if (mode !== 'playing' && mode !== 'paused') return;
    const before = mode;
    changeMode('confirm');
    const cancel = () => {
      changeMode('playing');
      if (before === 'paused') pause();
    };
    menu('最初からやり直す？', '現在の盤面とスコアはリセットされます。', ['やり直す', start], ['戻る', cancel]);
    ui.secondary.focus();
  }

  ui.gameModes.onchange = () => {
    ui.best.textContent = loadBest(ui.gameModes.querySelector('input:checked').value);
  };
  ui.pause.onclick = pause;
  ui.restart.onclick = restart;
  const gameKeys = new Set([...left, ...right, 'KeyQ', 'KeyE', 'Space', 'Escape', 'KeyR']);
  window.addEventListener('keydown', event => {
    if (!gameKeys.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
    if (mode !== 'playing' && mode !== 'paused' && mode !== 'confirm') return;
    event.preventDefault();
    pressed.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') {
      if (mode === 'confirm') ui.secondary.click();
      else pause();
    }
    if (event.code === 'KeyR') restart();
    if (mode !== 'playing') return;
    if (event.code === 'KeyQ') game.aim(0, -config.rotateDegrees);
    if (event.code === 'KeyE') game.aim(0, config.rotateDegrees);
    if (event.code === 'Space') {
      unlockAudio();
      game.drop();
      refreshNext();
    }
  });
  window.addEventListener('keyup', event => pressed.delete(event.code));
  window.addEventListener('blur', () => pressed.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') pause();
  });

  function frame(now) {
    const delta = Math.min(now - (previousTime ?? now), 80);
    previousTime = now;
    if (mode === 'playing') {
      elapsed += delta;
      const direction = Number(right.some(key => pressed.has(key))) - Number(left.some(key => pressed.has(key)));
      while (elapsed >= config.stepMs && !game.over) {
        game.step(direction);
        elapsed -= config.stepMs;
      }
      refreshNext();
      if (game.over) {
        changeMode('over');
        menu('ゲームオーバー', '最終スコア ' + game.score, ['もう一度', start], ['タイトルへ', title]);
      }
    }
    draw(game);
    requestAnimationFrame(frame);
  }

  title();
  requestAnimationFrame(frame);
}

init().catch(error => {
  console.error(error);
  menu('読み込めませんでした', 'ローカルのHTTPサーバーか、公開ページから開いてください。', ['再読み込み', () => location.reload()]);
});
