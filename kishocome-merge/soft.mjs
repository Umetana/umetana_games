import { clamp, config, levels, materials } from './config.mjs';

const stations = [-1, -0.88, -0.6, -0.3, 0, 0.3, 0.6, 0.88, 1];

export function softScale({ x, y }) {
  return { x: 1 - x + y * 0.85, y: 1 - y + x * 0.65 };
}

function reshape(matter, card, material) {
  const { Body, Bounds, Vertices } = matter;
  const { body, soft, entry } = card;
  const [width, height] = levels[entry.level - 1];
  const scale = softScale(soft);
  const top = [];
  const bottom = [];
  for (const [index, u] of stations.entries()) {
    const cap = 1 - material.roundness * Math.max(0, (Math.abs(u) - 0.85) / 0.15) ** 2;
    const x = u * width / 2 * scale.x;
    const y = soft.bend * u * u * height / 2;
    const sag = soft.sag[index];
    const half = cap * height / 2 * scale.y;
    top.push({ x, y: y - half + sag * material.topFollow });
    bottom.push({ x, y: y + half + sag });
  }
  soft.outline = [...top, ...bottom.slice().reverse()];

  // Convex strips follow a shared outline, allowing an indentation between supports.
  const origin = { x: 0, y: 0 };
  for (let i = 0; i < stations.length - 1; i++) {
    const strip = body.parts[i + 1];
    const points = [top[i], top[i + 1], bottom[i + 1], bottom[i]].map(point => ({ ...point }));
    Vertices.rotate(points, body.angle, origin);
    const center = Vertices.centre(points);
    Body.setVertices(strip, points);
    Body.setPosition(strip, { x: body.position.x + center.x, y: body.position.y + center.y });
  }

  const mass = soft.mass;
  const hull = Vertices.hull(soft.outline.map(point => ({ ...point })));
  Vertices.rotate(hull, body.angle, origin);
  const center = Vertices.centre(hull);
  Body.setVertices(body, hull);
  Vertices.translate(body.vertices, center);
  Bounds.update(body.bounds, body.vertices, body.velocity);
  Body.setMass(body, mass);
}

export function soften(matter, card, material) {
  const { Body, Bodies } = matter;
  const { body } = card;
  card.soft = {
    mass: body.mass, rounding: material.roundness * 0.32 + 0.08,
    x: 0, y: 0, bend: 0, impactX: 0, impactY: 0, impactBend: 0,
    loadX: 0, loadY: 0, loadBend: 0, vx: 0, vy: 0,
    sag: stations.map(() => 0), supports: [], previousSupports: [], supportGrace: 0, onFloor: false,
    neighbors: new Map(),
  };
  const parts = stations.slice(1).map(() =>
    Bodies.rectangle(body.position.x, body.position.y, 1, 1));
  Body.setParts(body, parts, false);
  reshape(matter, card, material);
}

export function recordSoftSupport(card, other, part, support, normal, floor, time) {
  if (normal.y < 0.35) return;
  const { soft, body, entry } = card;
  if (floor) {
    soft.onFloor = true;
    return;
  }
  if (!other || support.y < body.position.y) return;
  const [width] = levels[entry.level - 1];
  const radius = width / 2 * softScale(soft).x;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const offset = ((part.position.x - body.position.x) * cos +
    (part.position.y - body.position.y) * sin) / radius;
  soft.supports.push(clamp(offset, -1, 1));
  soft.neighbors.set(other.body, time);
}

function updateSag(card, material, time) {
  const { body, entry, soft } = card;
  const [width, height] = levels[entry.level - 1];
  const down = Math.cos(body.angle);
  if (soft.onFloor) {
    soft.supportGrace = 0;
  } else if (soft.supports.length) {
    soft.previousSupports = soft.supports.slice();
    soft.supportGrace = 8;
  }
  const supports = soft.supportGrace > 0 ? soft.previousSupports : [];
  soft.supportGrace = Math.max(0, soft.supportGrace - 1);
  const ranges = [];
  const radius = width / 2 * softScale(soft).x;
  const sin = Math.sin(body.angle);
  for (const [neighbor, touchedAt] of soft.neighbors) {
    if (soft.onFloor || time - touchedAt > 140) {
      soft.neighbors.delete(neighbor);
      continue;
    }
    if (!material.bridgeSag) continue;
    const offsets = neighbor.vertices.map(vertex =>
      ((vertex.x - body.position.x) * down + (vertex.y - body.position.y) * sin) / radius);
    ranges.push([Math.min(...offsets), Math.max(...offsets)]);
  }
  let changed = false;
  for (const [index, u] of stations.entries()) {
    let target = 0;
    if (supports.length) {
      const nearest = Math.min(...supports.map(point => Math.abs(point - u)));
      const span = Math.max(0, nearest - material.supportWidth);
      target = span * width / 2 * material.sag * (material.edgeSag ?? 1);
    }
    if (ranges.length > 1 && !ranges.some(([left, right]) => u >= left && u <= right)) {
      const left = Math.max(...ranges.filter(([, right]) => right < u).map(([, right]) => right));
      const right = Math.min(...ranges.filter(([left]) => left > u).map(([left]) => left));
      if (Number.isFinite(left) && Number.isFinite(right)) {
        target = Math.max(target, Math.min(u - left, right - u) * radius * material.bridgeSag);
      }
    }
    target = Math.min(target, height * material.maxSag) * down;
    const difference = target - soft.sag[index];
    if (Math.abs(difference) > 0.08 || (target === 0 && soft.sag[index] !== 0)) {
      soft.sag[index] = Math.abs(difference) <= 0.08 ? target : soft.sag[index] + difference * material.sagResponse;
      changed = true;
    }
  }
  soft.supports.length = 0;
  soft.onFloor = false;
  return changed;
}

export function prepareSoftCard(matter, card, material, time) {
  const { soft, body } = card;
  let changed = updateSag(card, material, time);
  for (const [axis, load, impact, max] of [
    ['x', 'loadX', 'impactX', material.squash],
    ['y', 'loadY', 'impactY', material.squash],
    ['bend', 'loadBend', 'impactBend', material.bend],
  ]) {
    const target = clamp(soft[load] + soft[impact], axis === 'bend' ? -max : 0, max);
    const difference = target - soft[axis];
    if (Math.abs(difference) > 0.001 || (target === 0 && soft[axis] !== 0)) {
      soft[axis] = Math.abs(difference) <= 0.001 ? target : soft[axis] + difference * material.response;
      changed = true;
    }
    soft[impact] *= material.rebound;
    if (Math.abs(soft[impact]) < 0.001) soft[impact] = 0;
    soft[load] = 0;
  }
  if (changed) reshape(matter, card, material);
  soft.vx = body.velocity.x;
  soft.vy = body.velocity.y;
}

export function withinSoftContactGap(a, b) {
  const gap = config.softContactGap;
  const { min, max } = a.bounds;
  if (max.x + gap < b.bounds.min.x || b.bounds.max.x + gap < min.x ||
      max.y + gap < b.bounds.min.y || b.bounds.max.y + gap < min.y) return false;

  // Keep existing contacts through tiny gaps caused by the changing hull.
  for (const { x, y } of [...a.axes, ...b.axes]) {
    let minA = Infinity, maxA = -Infinity;
    let minB = Infinity, maxB = -Infinity;
    for (const vertex of a.vertices) {
      const point = vertex.x * x + vertex.y * y;
      minA = Math.min(minA, point);
      maxA = Math.max(maxA, point);
    }
    for (const vertex of b.vertices) {
      const point = vertex.x * x + vertex.y * y;
      minB = Math.min(minB, point);
      maxB = Math.max(maxB, point);
    }
    if (maxA + gap < minB || maxB + gap < minA) return false;
  }
  return true;
}

export function applySoftContact(card, other, normal, support, fresh, material) {
  const { body, soft, entry } = card;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const along = normal.x * cos + normal.y * sin;
  const across = -normal.x * sin + normal.y * cos;
  const [width] = levels[entry.level - 1];
  const offset = clamp(((support.x - body.position.x) * cos +
    (support.y - body.position.y) * sin) / (width / 2), -1, 1);
  const weight = other && other.body.position.y < body.position.y
    ? clamp(other.body.mass / body.mass, 0, 2) : 0;
  const pressure = other ? 0.08 + weight * 0.52 : material.floorPressure ?? 0.19;
  soft.loadX += material.squash * pressure * along ** 2;
  soft.loadY += material.squash * pressure * across ** 2;
  soft.loadBend += material.bend * weight * across * (0.7 + 0.6 * Math.abs(offset));

  if (fresh) {
    const speed = (soft.vx - (other?.soft.vx ?? 0)) * normal.x +
      (soft.vy - (other?.soft.vy ?? 0)) * normal.y;
    const strength = clamp((speed - 1) / (config.maxSpeed - 1), 0, 1);
    soft.impactX += material.squash * strength * along ** 2;
    soft.impactY += material.squash * strength * across ** 2;
    soft.impactBend += material.bend * strength * across * (0.45 + 0.55 * Math.abs(offset));
  }
}
