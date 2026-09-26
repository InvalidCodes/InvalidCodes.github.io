/* Decorative layer for the notebook: the hero word cloud, the opening drop cap,
   and cursor stardust. Everything here is visual only and safe to skip. */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const INK = ["#4a3264", "#6a4a88", "#9a6f9f", "#7e5d9f", "#b07a9a", "#6f79ad", "#c49a5a", "#5d4b86", "#a784c0"];
const DUST = ["#a784c0", "#b9a3cf", "#c7a9c1", "#d2b48a", "#9aa0cc", "#b596c8"];

// Seeded so the cloud keeps the same composition on every visit.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function drawCloud(host) {
  const words = JSON.parse(host.dataset.words);
  const style = getComputedStyle(document.body);
  const faces = {
    bold: { family: style.getPropertyValue("--font-heading"), weight: 600, italic: false },
    sans: { family: style.getPropertyValue("--font-heading"), weight: 500, italic: false },
    note: { family: style.getPropertyValue("--font-note"), weight: 600, italic: false },
    serif: { family: style.getPropertyValue("--font-prose"), weight: 400, italic: true },
  };
  const font = (face, size) => `${face.italic ? "italic " : ""}${face.weight} ${size}px ${face.family}`;
  await Promise.all([faces.bold, faces.sans, faces.note].map((face) => document.fonts.load(font(face, 20)))).catch(() => {});

  // A cumulus silhouette built from overlapping ellipses in a 440×230 design box.
  const W = 440, H = 230, CELL = 2, GW = W / CELL, GH = H / CELL;
  const puffs = [[220, 150, 205, 56], [120, 128, 80, 62], [215, 98, 98, 82], [318, 115, 82, 66],
    [392, 150, 44, 40], [58, 160, 52, 40], [160, 70, 60, 50], [280, 72, 56, 48]];
  const mask = new Uint8Array(GW * GH);
  const used = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const px = (x + 0.5) * CELL, py = (y + 0.5) * CELL;
    mask[y * GW + x] = puffs.some(([cx, cy, rx, ry]) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1) ? 1 : 0;
  }
  const fits = (x0, y0, w, h) => {
    if (x0 < 0 || y0 < 0 || x0 + w > GW || y0 + h > GH) return false;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = y * GW + x;
      if (!mask[i] || used[i]) return false;
    }
    return true;
  };
  const claim = (x0, y0, w, h, pad) => {
    for (let y = Math.max(0, y0 - pad); y < Math.min(GH, y0 + h + pad); y++)
      for (let x = Math.max(0, x0 - pad); x < Math.min(GW, x0 + w + pad); x++) used[y * GW + x] = 1;
  };

  const ctx = document.createElement("canvas").getContext("2d");
  const box = (text, face, size) => {
    ctx.font = font(face, size);
    const m = ctx.measureText(text);
    return { left: m.actualBoundingBoxLeft, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      ascent: m.actualBoundingBoxAscent, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
  };
  const rand = random(words.length * 7919 + words[0][1]);
  const placed = [];
  const place = (text, face, size, x0, y0, b, className, color) => {
    placed.push({ text, face, size, x: x0 * CELL - b.left + (Math.ceil(b.width / CELL) * CELL - b.width) / 2,
      y: y0 * CELL + b.ascent + (Math.ceil(b.height / CELL) * CELL - b.height) / 2, className, color });
  };

  // Major words spiral outward from the center of the cloud, largest first.
  const top = words[0][1], floor = words[Math.min(words.length, 32) - 1][1];
  words.slice(0, 32).forEach(([text, count], rank) => {
    const face = rank < 3 ? faces.bold : [faces.serif, faces.sans, faces.note, faces.serif, faces.note][rank % 5];
    let size = 10 + 30 * ((count - floor) / Math.max(1, top - floor)) ** 0.75;
    for (let attempt = 0; attempt < 4; attempt++, size *= 0.84) {
      const b = box(text, face, size);
      const w = Math.ceil(b.width / CELL), h = Math.ceil(b.height / CELL);
      const phase = rand() * Math.PI * 2;
      for (let t = 0, r = 0; r < GW; t += Math.max(0.02, 1.2 / (r + 1)), r = 0.55 * t) {
        const x0 = Math.round(GW * 0.5 + r * 1.9 * Math.cos(t + phase) - w / 2);
        const y0 = Math.round(GH * 0.56 + r * 1.05 * Math.sin(t + phase) - h / 2);
        if (!fits(x0, y0, w, h)) continue;
        claim(x0, y0, w, h, 1);
        place(text, face, size, x0, y0, b, "cloud-major", INK[rank % INK.length]);
        return;
      }
    }
  });

  // Tiny repeated words fill the silhouette like the grain of a cloud.
  const pool = words.slice(4);
  for (let misses = 0, n = 0; misses < 200 && n < 700; n++) {
    const [text] = pool[n % pool.length];
    const face = rand() < 0.6 ? faces.note : faces.sans;
    const size = 4.2 + rand() * 3.4;
    const b = box(text, face, size);
    const w = Math.ceil(b.width / CELL), h = Math.ceil(b.height / CELL);
    let spot = null;
    for (let tries = 0; tries < 36 && !spot; tries++) {
      const x0 = Math.floor(rand() * (GW - w)), y0 = Math.floor(rand() * (GH - h));
      if (fits(x0, y0, w, h)) spot = [x0, y0];
    }
    if (!spot) { misses++; continue; }
    misses = 0;
    claim(spot[0], spot[1], w, h, 0);
    place(text, face, size, spot[0], spot[1], b, "cloud-dust", DUST[n % DUST.length]);
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  placed.forEach((word, index) => {
    const node = document.createElementNS(NS, "text");
    node.textContent = word.text;
    node.setAttribute("x", word.x.toFixed(1));
    node.setAttribute("y", word.y.toFixed(1));
    node.setAttribute("class", word.className);
    node.style.font = font(word.face, word.size.toFixed(2));
    node.style.fill = word.color;
    node.style.setProperty("--i", index);
    svg.append(node);
  });
  host.append(svg);
  host.classList.add("is-ready");
}

document.querySelectorAll(".hero-cloud[data-words]").forEach((host) => drawCloud(host));

// An editorial initial on an opening paragraph, never one buried mid-article.
if (document.documentElement.lang.startsWith("en")) {
  [...(document.querySelector(".prose")?.children || [])].slice(0, 4)
    .find((p) => p.matches("p") && p.firstChild?.nodeType === Node.TEXT_NODE && /^[A-Za-z]/.test(p.firstChild.textContent))
    ?.classList.add("has-initial");
}

// Stardust: a faint trail behind the pointer and a small burst over anything clickable.
if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
  const canvas = document.createElement("canvas");
  canvas.className = "stardust";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#8f6aa8", "#b07a9a", "#c49a5a", "#a784c0", "#6f79ad", "#c790c0"];
  const particles = [];
  let frame = 0, lastX = 0, lastY = 0, travelled = 0, hovered = null, previous = 0;

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const spawn = (x, y, angle, speed, life, size, ring = false) => {
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life, size, ring,
      spin: Math.random() * Math.PI, color: colors[Math.floor(Math.random() * colors.length)] });
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const sparkle = (x, y, radius, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, radius);
    ctx.quadraticCurveTo(0, 0, -radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, -radius);
    ctx.fill();
    ctx.restore();
  };
  function tick(now) {
    const step = Math.min(48, now - (previous || now)) || 16;
    previous = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += step;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      const k = step / 16, fade = 1 - p.age / p.life;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vx *= 0.95 ** k;
      p.vy = p.vy * 0.95 ** k + 0.018 * k;
      ctx.globalAlpha = Math.min(1, fade * 1.5);
      ctx.fillStyle = ctx.strokeStyle = ctx.shadowColor = p.color;
      if (p.ring) {
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - fade * fade * fade), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.shadowBlur = 8;
        sparkle(p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(p.age / 90 + p.spin) ** 2), p.spin + p.age / 500);
      }
    }
    frame = particles.length ? requestAnimationFrame(tick) : 0;
    if (!frame) previous = 0;
  }

  resize();
  addEventListener("resize", resize);
  addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    travelled += Math.hypot(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
    if (travelled < 22) return;
    travelled = 0;
    spawn(lastX, lastY, Math.random() * Math.PI * 2, 0.25 + Math.random() * 0.35, 700 + Math.random() * 400, 3 + Math.random() * 2.6);
  }, { passive: true });
  addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest?.("a, button, summary, .hero-note, .cloud-major");
    if (target === hovered) return;
    hovered = target;
    if (!target) return;
    const count = 12;
    for (let i = 0; i < count; i++) {
      spawn(event.clientX, event.clientY, (i / count) * Math.PI * 2 + Math.random() * 0.4,
        1.8 + Math.random() * 1.6, 700 + Math.random() * 350, 3 + Math.random() * 2.4);
    }
    spawn(event.clientX, event.clientY, 0, 0, 520, 24, true);
  }, { passive: true });
}
