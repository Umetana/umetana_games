(() => {
  const canvas = document.querySelector('#comment-rain');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const toggle = document.querySelector('#motion-toggle');
  let playing = true;
  const comments = [
    ['俺だけ特別扱いして？', '#f6a0cd'],
    ['なんで俺のコメ飛ばすの？', '#f9b882'],
    ['毎日来てるんだから覚えてよ', '#c1a4ff'],
    ['他の人にファンサしないで', '#91d8ff'],
    ['返事くれるまで連投するね', '#ff9e9e'],
  ];
  const cardWidth = 196;
  const cardHeight = 42;
  const fragmentShapes = [
    [[0, 0], [62, 0], [49, 20], [0, 26]],
    [[62, 0], [133, 0], [119, 23], [49, 20]],
    [[133, 0], [196, 0], [196, 18], [119, 23]],
    [[0, 26], [49, 20], [69, 42], [0, 42]],
    [[49, 20], [119, 23], [142, 42], [69, 42]],
    [[119, 23], [196, 18], [196, 42], [142, 42]],
  ];
  const fragmentCenters = fragmentShapes.map(points => ({
    x: points.reduce((sum, point) => sum + point[0], 0) / points.length - cardWidth / 2,
    y: points.reduce((sum, point) => sum + point[1], 0) / points.length - cardHeight / 2,
  }));
  const random = (min, max) => min + Math.random() * (max - min);
  const cards = [];
  const bursts = [];
  let width, height, scale;
  let frame = 0;
  let lastTime = 0;
  let untilNext = 0;
  let commentIndex = Math.floor(random(0, comments.length));

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    scale = Math.min(1, width / 470);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (!playing) drawStillCards();
  }

  function drawCard(card) {
    const left = -cardWidth / 2;
    const top = -cardHeight / 2;
    ctx.beginPath();
    ctx.roundRect(left + 1, top + 1, cardWidth - 2, cardHeight - 2, 7);
    ctx.fillStyle = '#211a39';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = card.color;
    ctx.stroke();
    ctx.fillStyle = card.color;
    ctx.fillRect(left + 9, -3, 6, 6);
    ctx.fillStyle = '#f7eaff';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.text, left + 23, 1, cardWidth - 32);
  }

  function drawStillCards() {
    ctx.clearRect(0, 0, width, height);
    for (const [index, x, y, angle] of [
      [0, 0.23, 0.25, -0.16],
      [2, 0.77, 0.48, 0.12],
      [4, 0.43, 0.79, -0.09],
    ]) {
      const [text, color] = comments[index];
      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.translate(width * x, height * y);
      ctx.scale(scale, scale);
      ctx.rotate(angle);
      drawCard({ text, color });
      ctx.restore();
    }
  }

  function spawnCard() {
    const [text, color] = comments[commentIndex];
    commentIndex = (commentIndex + 1) % comments.length;
    const margin = cardWidth * scale / 2;
    cards.push({
      text, color, x: random(margin, width - margin), y: -cardHeight,
      angle: random(-0.27, 0.27), spin: random(-0.14, 0.14),
      drift: random(-15, 15), speed: height * random(0.23, 0.31),
      burstAt: random(0.57, 0.72),
    });
  }

  function drawBurst({ card, age, pieces }) {
    ctx.globalAlpha = 0.64 * (1 - age / 0.85);
    for (const { points, x, y, vx, vy, spin } of pieces) {
      ctx.save();
      ctx.translate(card.x + vx * age, card.y + vy * age + 195 * age ** 2);
      ctx.scale(scale, scale);
      ctx.rotate(card.angle);
      ctx.translate(x, y);
      ctx.rotate(spin * age);
      ctx.translate(-x, -y);
      ctx.beginPath();
      points.forEach(([px, py], index) => {
        const drawPoint = index === 0 ? 'moveTo' : 'lineTo';
        ctx[drawPoint](px - cardWidth / 2, py - cardHeight / 2);
      });
      ctx.closePath();
      ctx.clip();
      drawCard(card);
      ctx.restore();
    }
  }

  function animate(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    ctx.clearRect(0, 0, width, height);
    untilNext -= dt;
    if (untilNext <= 0) {
      spawnCard();
      untilNext = random(0.95, 1.55);
    }

    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];
      card.x += card.drift * dt;
      card.y += card.speed * dt;
      card.angle += card.spin * dt;
      if (card.y >= height * card.burstAt) {
        cards.splice(i, 1);
        const pieces = fragmentShapes.map((points, index) => {
          const { x, y } = fragmentCenters[index];
          return { points, x, y, vx: x * random(1.5, 2.5), vy: y * 5 + random(-100, -50), spin: random(-5, 5) };
        });
        bursts.push({ card, age: 0, pieces });
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.translate(card.x, card.y);
      ctx.scale(scale, scale);
      ctx.rotate(card.angle);
      drawCard(card);
      ctx.restore();
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.age += dt;
      if (burst.age >= 0.85) {
        bursts.splice(i, 1);
      } else {
        drawBurst(burst);
      }
    }
    ctx.globalAlpha = 1;
    frame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    lastTime = 0;
    toggle.textContent = playing ? '背景演出を停止' : '背景演出を再生';
    if (!playing) {
      drawStillCards();
      cards.length = bursts.length = 0;
      untilNext = 0;
    } else if (!document.hidden) {
      frame = requestAnimationFrame(animate);
    }
  }

  resize();
  addEventListener('resize', resize);
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    playing = !playing;
    syncAnimation();
  });
  document.addEventListener('visibilitychange', syncAnimation);
  syncAnimation();
})();
