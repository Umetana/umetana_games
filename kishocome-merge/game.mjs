import { clamp, config, horizontalRadius, levels, materials } from './config.mjs';
import { applySoftContact, prepareSoftCard, recordSoftSupport, soften, withinSoftContactGap } from './soft.mjs';

export function readComments(data) {
  const pools = new Map([...levels.map((_, index) => [index + 1, []]), ['ban', []]]);
  const ids = new Set();
  if (!Array.isArray(data)) throw new Error('Expected a list of comments');
  for (const entry of data) {
    if (!entry || !pools.has(entry.level) || typeof entry.id !== 'string' || !entry.id ||
        ids.has(entry.id) || typeof entry.category !== 'string' || !entry.category ||
        typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 100 ||
        !Number.isFinite(entry.weight) || entry.weight <= 0 || entry.weight > 1000) {
      throw new Error('Invalid comment entry');
    }
    pools.get(entry.level).push(entry);
    ids.add(entry.id);
  }
  if ([...pools.values()].some(pool => !pool.length)) throw new Error('Missing comment level');
  return pools;
}

function cardPairKey(a, b) {
  return a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
}

export class MergeGame {
  constructor(matter, comments, onMerge) {
    this.matter = matter;
    this.comments = comments;
    this.onMerge = onMerge;
    this.reset();
  }

  reset(materialId = 'classic') {
    this.material = materials[materialId] ?? null;
    this.softPairs = new Map();
    this.softBodyContacts = new Set();
    const { Engine, Bodies, Composite } = this.matter;
    const { width, height } = config;
    this.engine = Engine.create({ gravity: { y: config.gravity }, positionIterations: 9 });
    this.floor = Bodies.rectangle(width / 2, height + 48, width + 192, 96, { isStatic: true });
    Composite.add(this.engine.world, [
      this.floor,
      Bodies.rectangle(-48, height / 2, 96, height + 300, { isStatic: true }),
      Bodies.rectangle(width + 48, height / 2, 96, height + 300, { isStatic: true }),
    ]);
    this.cards = new Map();
    this.contacts = new Map();
    this.recent = new Map();
    this.effects = [];
    this.score = 0;
    this.time = 0;
    this.danger = 0;
    this.pending = null;
    this.over = false;
    this.current = this.roll();
    this.next = this.roll();
    this.x = width / 2;
    this.angle = 0;
  }

  choose(level) {
    const pool = this.comments.get(level);
    const last = this.recent.get(level);
    const candidates = pool.length > 1 ? pool.filter(entry => entry !== last) : pool;
    let roll = Math.random() * candidates.reduce((sum, entry) => sum + entry.weight, 0);
    const entry = candidates.find(item => (roll -= item.weight) < 0) ?? candidates.at(-1);
    this.recent.set(level, entry);
    return entry;
  }

  roll() {
    let roll = Math.random() * config.dropWeights.reduce((sum, weight) => sum + weight, 0);
    const index = config.dropWeights.findIndex(weight => (roll -= weight) < 0);
    return this.choose(index < 0 ? config.dropWeights.length : index + 1);
  }

  aim(distance, rotation = 0) {
    if (!this.current || this.over) return;
    this.angle = clamp(this.angle + rotation, -90, 90);
    const radius = horizontalRadius(this.current.level, this.angle * Math.PI / 180);
    this.x = clamp(this.x + distance, radius + 2, config.width - radius - 2);
  }

  addCard(entry, x, y, angle) {
    const { Bodies, Composite } = this.matter;
    const [width, height] = levels[entry.level - 1];
    const radius = horizontalRadius(entry.level, angle);
    const vertical = (width * Math.abs(Math.sin(angle)) + height * Math.abs(Math.cos(angle))) / 2;
    const body = Bodies.rectangle(clamp(x, radius, config.width - radius),
      Math.min(y, config.height - vertical), width, height, { ...config.body, angle });
    const card = { body, entry, support: 0 };
    if (this.material) soften(this.matter, card, this.material);
    this.cards.set(body.id, card);
    Composite.add(this.engine.world, body);
    return card;
  }

  drop() {
    if (!this.current || this.over) return false;
    const { body } = this.addCard(this.current, this.x, config.spawnY, this.angle * Math.PI / 180);
    this.pending = { id: body.id, entry: this.next, deadline: this.time + config.maxWaitMs };
    this.next = this.roll();
    this.current = null;
    return true;
  }

  merge(first, second) {
    const { Composite } = this.matter;
    const x = (first.body.position.x + second.body.position.x) / 2;
    const y = (first.body.position.y + second.body.position.y) / 2;
    const level = first.entry.level + 1;
    const ban = level > levels.length;
    const entry = this.choose(ban ? 'ban' : level);
    for (const { body } of [first, second]) {
      this.cards.delete(body.id);
      Composite.remove(this.engine.world, body);
    }
    if (!ban) {
      // The cards have 180-degree symmetry. Average their axes across the wrap.
      const difference = second.body.angle - first.body.angle;
      const angle = first.body.angle + Math.atan2(Math.sin(2 * difference), Math.cos(2 * difference)) / 4;
      this.addCard(entry, x, y, angle);
    }
    const points = ban ? config.banScore : levels[level - 1][3];
    this.score += points;
    this.effects.push({ x, y, entry, ban, points, started: this.time });
    this.onMerge?.(ban, this.score);
  }

  step(direction = 0) {
    if (this.over) return;
    const { Body, Engine } = this.matter;
    this.time += config.stepMs;
    this.aim(direction * config.movePixelsPerSecond * config.stepMs / 1000);
    for (const card of this.cards.values()) {
      const { body } = card;
      if (body.speed > config.maxSpeed) {
        const scale = config.maxSpeed / body.speed;
        Body.setVelocity(body, { x: body.velocity.x * scale, y: body.velocity.y * scale });
      }
      if (this.material) prepareSoftCard(this.matter, card, this.material, this.time);
    }
    Engine.update(this.engine, config.stepMs);

    const neighbors = new Map();
    const link = (id, other) => {
      if (!neighbors.has(id)) neighbors.set(id, []);
      neighbors.get(id).push(other);
    };
    const nextContacts = new Map();
    const ready = [];
    const softPairs = new Map();
    const activePairs = this.engine.pairs.list.filter(pair => pair.isActive);
    if (this.material) {
      for (const pair of activePairs) softPairs.set(pair.id, pair);
      for (const [id, pair] of this.softPairs) {
        if (softPairs.has(id)) continue;
        const { bodyA, bodyB } = pair;
        if ((!bodyA.parent.isStatic && !this.cards.has(bodyA.parent.id)) ||
            (!bodyB.parent.isStatic && !this.cards.has(bodyB.parent.id))) continue;
        if (withinSoftContactGap(bodyA, bodyB)) {
          activePairs.push(pair);
          softPairs.set(id, pair);
        }
      }
    }
    const softBodyContacts = new Set();
    for (const pair of activePairs) {
      const { bodyA: partA, bodyB: partB } = pair;
      const bodyA = partA.parent;
      const bodyB = partB.parent;
      const a = this.cards.get(bodyA.id);
      const b = this.cards.get(bodyB.id);
      if (this.pending && (bodyA.id === this.pending.id || bodyB.id === this.pending.id) &&
          ((a && b) || bodyA === this.floor || bodyB === this.floor)) {
        this.pending.deadline = Math.min(this.pending.deadline, this.time + config.nextDelayMs);
      }
      if ((a && b) || bodyA === this.floor || bodyB === this.floor) {
        link(bodyA.id, bodyB.id);
        link(bodyB.id, bodyA.id);
      }
      const key = this.material ? cardPairKey(bodyA, bodyB) : pair.id;
      if (this.material && (a || b)) {
        const { normal, supports } = pair.collision;
        const dx = partB.position.x - partA.position.x;
        const dy = partB.position.y - partA.position.y;
        const sign = normal.x * dx + normal.y * dy < 0 ? -1 : 1;
        const towardB = { x: sign * normal.x, y: sign * normal.y };
        const towardA = { x: -towardB.x, y: -towardB.y };
        const support = supports[0] ?? { x: partA.position.x + dx / 2, y: partA.position.y + dy / 2 };
        if (a) recordSoftSupport(a, b, partA, support, towardB, bodyB === this.floor, this.time);
        if (b) recordSoftSupport(b, a, partB, support, towardA, bodyA === this.floor, this.time);
        if (!softBodyContacts.has(key)) {
          const fresh = !this.softBodyContacts.has(key);
          if (a) applySoftContact(a, b, towardB, support, fresh, this.material);
          if (b) applySoftContact(b, a, towardA, support, fresh, this.material);
          softBodyContacts.add(key);
        }
      }
      if (!a || !b || a.entry.level !== b.entry.level || nextContacts.has(key)) continue;
      const since = this.contacts.get(key) ?? this.time - config.stepMs;
      nextContacts.set(key, since);
      if (this.time - since >= config.mergeMs - 0.001) ready.push({ a, b, since });
    }

    // A connected path to the floor distinguishes the pile from incoming cards.
    const supported = new Set([this.floor.id]);
    for (const id of supported) {
      for (const other of neighbors.get(id) ?? []) supported.add(other);
    }
    for (const card of this.cards.values()) {
      card.support = supported.has(card.body.id) ? card.support + config.stepMs : 0;
    }

    ready.sort((a, b) => a.since - b.since || a.a.body.id - b.a.body.id || a.b.body.id - b.b.body.id);
    for (const { a, b } of ready) {
      if (this.cards.has(a.body.id) && this.cards.has(b.body.id)) this.merge(a, b);
    }
    this.contacts = nextContacts;
    this.softPairs = softPairs;
    this.softBodyContacts = softBodyContacts;

    if (this.pending && this.time >= this.pending.deadline) {
      this.current = this.pending.entry;
      this.pending = null;
      this.angle = 0;
      this.aim(0);
    }

    const overflowing = [...this.cards.values()].some(({ body, support }) =>
      support >= config.supportMs && body.vertices.some(vertex => vertex.y < config.dangerY));
    this.danger = overflowing ? this.danger + config.stepMs : 0;
    this.over = this.danger >= config.dangerMs - 0.001;
    this.effects = this.effects.filter(effect =>
      this.time - effect.started < (effect.ban ? config.banEffectMs : config.mergeEffectMs));
  }
}
