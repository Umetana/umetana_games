import { clamp, config, levels } from './config.mjs';
import { softScale } from './soft.mjs';

function linesFor(ctx, text, width) {
  const lines = [''];
  for (const character of text) {
    if (ctx.measureText(lines.at(-1) + character).width > width) lines.push('');
    lines[lines.length - 1] += character;
  }
  return lines;
}

function drawCard(ctx, entry, x, y, angle, aiming = false, geometry) {
  const [w, h, color] = levels[entry.level - 1];
  ctx.save();
  ctx.beginPath();
  if (geometry) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(geometry.body.angle);
    const outline = geometry.soft.outline;
    const rounding = geometry.soft.rounding;
    const first = outline[0];
    const last = outline.at(-1);
    ctx.moveTo(first.x + (last.x - first.x) * rounding, first.y + (last.y - first.y) * rounding);
    for (const [index, point] of outline.entries()) {
      const previous = outline[(index + outline.length - 1) % outline.length];
      const next = outline[(index + 1) % outline.length];
      ctx.lineTo(point.x + (previous.x - point.x) * rounding, point.y + (previous.y - point.y) * rounding);
      ctx.quadraticCurveTo(point.x, point.y,
        point.x + (next.x - point.x) * rounding, point.y + (next.y - point.y) * rounding);
    }
    ctx.closePath();
    ctx.restore();
  } else {
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = aiming ? '#fff' : '#251835';
  ctx.lineWidth = aiming ? 2 : 1;
  ctx.stroke();
  if (geometry) {
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const scale = softScale(geometry.soft);
    ctx.scale(scale.x, scale.y);
  }
  ctx.fillStyle = '#2e2041';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 8px system-ui';
  ctx.fillText('Lv.' + entry.level, -w / 2 + 5, -h / 2 + 3);
  ctx.textAlign = 'center';
  let size = entry.level < 3 ? 10 : 13;
  let lines;
  do {
    ctx.font = 'bold ' + size + 'px system-ui';
    lines = linesFor(ctx, entry.text, w - 10);
    if (lines.length * (size + 1) <= h - 13 || size === 8) break;
    size--;
  } while (true);
  const count = Math.floor((h - 12) / (size + 1));
  if (lines.length > count) {
    lines.length = count;
    lines[count - 1] = lines[count - 1].slice(0, -1) + '…';
  }
  lines.forEach((line, i) => ctx.fillText(line, 0, -h / 2 + 12 + i * (size + 1)));
  ctx.restore();
}

function prepareCanvas(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.scale(canvas.width / width, canvas.height / height);
  return ctx;
}

export function createNextRenderer(canvas) {
  const dropSizes = levels.slice(0, config.dropWeights.length);
  const width = Math.max(...dropSizes.map(([w]) => w)) + 18;
  const height = Math.max(...dropSizes.map(([, h]) => h)) + 10;
  const ctx = prepareCanvas(canvas, width, height);
  return function drawNext(entry) {
    ctx.clearRect(0, 0, width, height);
    if (entry) {
      drawCard(ctx, entry, width / 2, height / 2, 0);
      canvas.setAttribute('aria-label', '次のカード Lv.' + entry.level + ' ' + entry.text);
    } else {
      ctx.fillStyle = '#d0c2df';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('—', width / 2, height / 2);
      canvas.setAttribute('aria-label', '次のカードなし');
    }
  };
}

export function createRenderer(canvas) {
  const { width, height, dangerY, spawnY } = config;
  const ctx = prepareCanvas(canvas, width, height);

  const flippedByBody = new WeakMap();
  // Keep the current text orientation within eight degrees of vertical.
  const flipThreshold = Math.sin(8 * Math.PI / 180);

  function effect(effect, time) {
    const { x, y, entry, ban, points, started } = effect;
    const progress = clamp((time - started) / (ban ? config.banEffectMs : config.mergeEffectMs), 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = ban ? '#ff6295' : levels[entry.level - 1][2];
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const distance = 8 + 62 * progress;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = Math.min(1, (1 - progress) * 2.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ban) {
      const bx = clamp(x, 130, width - 130);
      const by = clamp(y - 25, 42, height - 54);
      ctx.fillStyle = '#21162f';
      ctx.beginPath();
      ctx.roundRect(bx - 126, by - 31, 252, 74, 10);
      ctx.fill();
      ctx.strokeStyle = '#ff6295';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui';
      linesFor(ctx, entry.text, 232).forEach((line, i) => ctx.fillText(line, bx, by - 17 + i * 15));
      ctx.font = '900 19px system-ui';
      ctx.fillStyle = '#ff8bb1';
      ctx.fillText('BAN  +' + points, bx, by + 27);
    } else {
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('+' + points, clamp(x, 28, width - 28), clamp(y - 25 - progress * 23, 15, height - 15));
    }
    ctx.restore();
  }

  return function draw(game) {
    ctx.fillStyle = '#201a33';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#2c2040';
    ctx.fillRect(0, 0, width, dangerY);
    for (let x = 18; x < width; x += 24) {
      for (let y = dangerY + 16; y < height; y += 24) {
        ctx.fillStyle = '#35294c';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    if (game.current) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#bfb0d5';
      ctx.beginPath();
      ctx.moveTo(game.x, spawnY);
      ctx.lineTo(game.x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const card of game.cards.values()) {
      const { body, entry, soft } = card;
      const facing = Math.cos(body.angle);
      const wasFlipped = flippedByBody.get(body);
      const flipped = wasFlipped ? facing <= flipThreshold : facing < -flipThreshold;
      flippedByBody.set(body, flipped);
      drawCard(ctx, entry, body.position.x, body.position.y,
        body.angle + (flipped ? Math.PI : 0), false, soft ? card : undefined);
    }
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = game.danger ? '#ff749f' : '#aa729a';
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(width, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd2e6';
    ctx.font = 'bold 11px system-ui';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText('危険ライン', 9, dangerY - 6);
    if (game.danger) {
      const remaining = Math.max(0, config.dangerMs - game.danger) / 1000;
      ctx.fillStyle = '#ff749f';
      ctx.fillRect(0, dangerY + 1, width * remaining * 1000 / config.dangerMs, 4);
      ctx.textAlign = 'right';
      ctx.fillText(remaining.toFixed(1) + '秒', width - 10, dangerY - 6);
    }
    if (game.current) drawCard(ctx, game.current, game.x, spawnY, game.angle * Math.PI / 180, true);
    for (const burst of game.effects) effect(burst, game.time);
  };
}
