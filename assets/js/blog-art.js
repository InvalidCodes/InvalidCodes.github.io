/* Decorative layer for the notebook: the hero word cloud and sky, the opening drop cap,
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

// Silhouettes in a 440×360 design box: filled parts, cut-out holes, and where the biggest word starts.
const round = (x, y, w, h, r) => (px, py) => {
  const dx = Math.max(x + r - px, 0, px - (x + w - r)), dy = Math.max(y + r - py, 0, py - (y + h - r));
  return px >= x && px <= x + w && py >= y && py <= y + h && dx * dx + dy * dy <= r * r;
};
const capsule = (x1, y1, x2, y2, r) => (px, py) => {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2 <= r * r;
};
const oval = (cx, cy, rx, ry) => (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
const polygon = (points) => (px, py) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const page = [[220, 64], [184, 36], [136, 22], [84, 22], [26, 40], [26, 292], [84, 274], [136, 274], [184, 288], [220, 314]];
const SHAPES = {
  // A robot arm reaching down for a small cup, as in the first article.
  robot: {
    fill: [round(28, 312, 164, 34, 11), round(72, 258, 76, 62, 12), oval(110, 242, 50, 50),
      capsule(110, 242, 226, 64, 50), oval(226, 64, 46, 46), capsule(226, 64, 354, 150, 39),
      oval(354, 150, 27, 27), capsule(354, 150, 370, 204, 20), capsule(370, 204, 344, 258, 11),
      capsule(370, 204, 404, 256, 11)],
    holes: [oval(110, 242, 13, 13), oval(226, 64, 12, 12), oval(354, 150, 8, 8)],
    center: [170, 156],
    marks: `<circle cx="110" cy="242" r="6"/><circle cx="226" cy="64" r="5.5"/><circle cx="354" cy="150" r="4"/><path class="cup" d="M350 278h44l-5 58h-34z M394 290c15 0 15 28 -3 28"/>`,
  },
  book: {
    fill: [polygon(page), polygon(page.map(([x, y]) => [440 - x, y])), round(290, 278, 16, 62, 2)],
    holes: [round(218, 20, 4, 310, 2)],
    center: [220, 170],
    marks: `<path d="M220 68V310" class="spine"/>`,
  },
};

async function drawCloud(host) {
  const shape = SHAPES[host.dataset.shape] || SHAPES.robot;
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

  const W = 440, H = 360, CELL = 2, GW = W / CELL, GH = H / CELL;
  const inside = (px, py) => shape.fill.some((part) => part(px, py)) && !shape.holes.some((hole) => hole(px, py));
  const mask = new Uint8Array(GW * GH);
  const used = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const px = (x + 0.5) * CELL, py = (y + 0.5) * CELL;
    mask[y * GW + x] = inside(px, py) ? 1 : 0;
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
    placed.push({ text, face, size, cx: (x0 + b.width / CELL / 2) * CELL, cy: (y0 + b.height / CELL / 2) * CELL, x: x0 * CELL - b.left + (Math.ceil(b.width / CELL) * CELL - b.width) / 2,
      y: y0 * CELL + b.ascent + (Math.ceil(b.height / CELL) * CELL - b.height) / 2, className, color });
  };

  // Major words spiral outward from the center of the cloud, largest first.
  const top = words[0][1], floor = words[Math.min(words.length, 36) - 1][1];
  words.slice(0, 36).forEach(([text, count], rank) => {
    const face = rank < 3 ? faces.bold : [faces.serif, faces.sans, faces.note, faces.serif, faces.note][rank % 5];
    let size = 10 + 34 * ((count - floor) / Math.max(1, top - floor)) ** 0.75;
    for (let attempt = 0; attempt < 4; attempt++, size *= 0.84) {
      const b = box(text, face, size);
      const w = Math.ceil(b.width / CELL), h = Math.ceil(b.height / CELL);
      const phase = rand() * Math.PI * 2;
      for (let t = 0, r = 0; r < GW; t += Math.max(0.02, 1.2 / (r + 1)), r = 0.55 * t) {
        const x0 = Math.round(shape.center[0] / CELL + r * 1.25 * Math.cos(t + phase) - w / 2);
        const y0 = Math.round(shape.center[1] / CELL + r * Math.sin(t + phase) - h / 2);
        if (!fits(x0, y0, w, h)) continue;
        claim(x0, y0, w, h, 3);
        place(text, face, size, x0, y0, b, "cloud-major", INK[rank % INK.length]);
        return;
      }
    }
  });

  // Tiny repeated words fill the silhouette like the grain of a cloud.
  const pool = words.slice(4);
  const cells = mask.reduce((list, on, i) => (on && !used[i] && list.push(i), list), []);
  for (let misses = 0, n = 0; misses < 260 && n < 520; n++) {
    const [text] = pool[n % pool.length];
    const face = rand() < 0.6 ? faces.note : faces.sans;
    const size = 4.6 + rand() * 3.6;
    const b = box(text, face, size);
    const w = Math.ceil(b.width / CELL), h = Math.ceil(b.height / CELL);
    let spot = null;
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const cell = cells[Math.floor(rand() * cells.length)];
      const x0 = cell % GW - (w >> 1), y0 = Math.floor(cell / GW) - (h >> 1);
      if (fits(x0, y0, w, h)) spot = [x0, y0];
    }
    if (!spot) { misses++; continue; }
    misses = 0;
    claim(spot[0], spot[1], w, h, 1);
    place(text, face, size, spot[0], spot[1], b, "cloud-dust", DUST[n % DUST.length]);
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // A soft paper backing makes the silhouette legible behind the words.
  const paper = document.createElement("canvas");
  paper.width = W;
  paper.height = H;
  const pixels = paper.getContext("2d").createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inside(x + 0.5, y + 0.5)) pixels.data.set([255, 253, 250, 255], (y * W + x) * 4);
  }
  paper.getContext("2d").putImageData(pixels, 0, 0);
  const backing = document.createElementNS(NS, "image");
  backing.setAttribute("href", paper.toDataURL());
  backing.setAttribute("width", W);
  backing.setAttribute("height", H);
  backing.setAttribute("class", "cloud-backing");
  svg.append(backing);
  if (shape.marks) {
    const marks = document.createElementNS(NS, "g");
    marks.setAttribute("class", "cloud-marks");
    marks.innerHTML = shape.marks;
    svg.append(marks);
  }
  placed.forEach((word, index) => {
    const node = document.createElementNS(NS, "text");
    node.textContent = word.text;
    node.setAttribute("x", word.x.toFixed(1));
    node.setAttribute("y", word.y.toFixed(1));
    node.setAttribute("class", word.className);
    node.style.font = font(word.face, word.size.toFixed(2));
    node.style.fill = word.color;
    node.style.setProperty("--i", index);
    node.center = [word.cx, word.cy];
    svg.append(node);
  });
  host.append(svg);
  host.classList.add("is-ready");
}

// A click on a cloud word searches the archive for every post that uses it.
document.querySelectorAll(".hero-cloud[data-words]").forEach((host) => {
  drawCloud(host);
  host.addEventListener("click", (event) => {
    const word = event.target.closest(".cloud-major");
    const search = document.querySelector("#blog-search");
    if (!word || !search) return;
    search.value = word.textContent.toLowerCase();
    search.dispatchEvent(new Event("input"));
    document.querySelector(".archive-tools").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
});

// The hero sky: stars that join into constellations around the pointer, a slow parallax,
// cloud grain that parts as the pointer passes, and the occasional shooting star.
document.querySelectorAll(".blog-hero").forEach((hero) => {
  const sky = document.createElement("canvas");
  sky.className = "hero-sky";
  hero.querySelector(".hero-landscape").append(sky);
  const ctx = sky.getContext("2d");
  const rand = random(20260926);
  const tones = ["#6a4a88", "#6a4a88", "#8f6aa8", "#b07a9a", "#c49a5a", "#6f79ad", "#fffaf2"];
  const stars = Array.from({ length: 190 }, () => ({ x: rand(), y: rand(), r: 0.6 + rand() ** 3 * 2.2,
    depth: 0.3 + rand() * 0.7, phase: rand() * 6.3, speed: 0.4 + rand(), tone: tones[Math.floor(rand() * tones.length)] }));
  let width = 0, height = 0, count = 0, frame = 0, visible = true, previous = 0, meteor = null, nextMeteor = 2600;
  const pointer = { x: 0, y: 0, active: false }, lamp = { x: 0, y: 0, strength: 0 }, tilt = { x: 0, y: 0 };

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    count = Math.min(stars.length, Math.round(width * height / 4600));  // Keep the same density on every screen.
    sky.width = width * ratio;
    sky.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (reduceMotion) draw(0);
  };
  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    const reach = Math.min(230, width * 0.22), near = [];
    if (lamp.strength > 0.01) {  // A soft pool of light where the pointer is.
      const light = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, reach);
      light.addColorStop(0, "#fffaf0");
      light.addColorStop(1, "#fffaf000");
      ctx.globalAlpha = 0.5 * lamp.strength;
      ctx.fillStyle = light;
      ctx.fillRect(lamp.x - reach, lamp.y - reach, reach * 2, reach * 2);
    }
    for (const star of stars.slice(0, count)) {
      let x = star.x * width + tilt.x * 14 * star.depth + Math.sin(time / 4200 * star.speed + star.phase) * 5;
      let y = star.y * height + tilt.y * 10 * star.depth + Math.cos(time / 5100 * star.speed + star.phase) * 4;
      const d = Math.hypot(x - lamp.x, y - lamp.y), glow = lamp.strength * Math.max(0, 1 - d / reach);
      if (glow > 0) {
        x += (lamp.x - x) * glow * 0.1;
        y += (lamp.y - y) * glow * 0.1;
        near.push([x, y, glow]);
      }
      const twinkle = 0.55 + 0.45 * Math.sin(time / 900 * star.speed + star.phase);
      ctx.globalAlpha = Math.min(1, 0.3 + 0.4 * twinkle + glow * 0.7);
      ctx.fillStyle = star.tone;
      ctx.beginPath();
      ctx.arc(x, y, star.r * (1 + glow * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = "#6a4a88";
    // Each lit star reaches for its two nearest lit neighbours, which reads as constellations, not a mesh.
    const links = new Set();
    near.forEach(([ax, ay], i) => {
      near.map(([bx, by], j) => [Math.hypot(ax - bx, ay - by), j]).filter(([d, j]) => j !== i && d < 120)
        .sort((p, q) => p[0] - q[0]).slice(0, 2).forEach(([, j]) => links.add(i < j ? i * 1000 + j : j * 1000 + i));
    });
    for (const link of links) {
      const [ax, ay, ag] = near[Math.floor(link / 1000)], [bx, by, bg] = near[link % 1000], d = Math.hypot(ax - bx, ay - by);
      ctx.globalAlpha = Math.min(1, (1 - d / 150) * Math.min(ag, bg) * 1.6);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    if (meteor) {
      const k = (time - meteor.start) / 1100;
      if (k >= 1) meteor = null;
      else {
        const hx = meteor.x - k * 420, hy = meteor.y + k * 170;
        const tail = ctx.createLinearGradient(hx, hy, hx + 120, hy - 48);
        tail.addColorStop(0, "#fffaf2");
        tail.addColorStop(1, "#fffaf200");
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 120, hy - 48);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function tick(time) {
    const step = Math.min(48, time - (previous || time)) || 16;
    previous = time;
    // With no pointer in the hero, the lamp wanders slowly across the open sky on the left.
    const goal = pointer.active ? pointer : { x: width * (0.3 + 0.2 * Math.sin(time / 6100)), y: height * (0.72 + 0.14 * Math.sin(time / 3700)) };
    const ease = 1 - 0.9 ** (step / 16);
    lamp.x += (goal.x - lamp.x) * ease;
    lamp.y += (goal.y - lamp.y) * ease;
    lamp.strength += ((pointer.active ? 1 : 0.7) - lamp.strength) * ease * 0.5;
    const tx = pointer.active ? pointer.x / width - 0.5 : 0, ty = pointer.active ? pointer.y / height - 0.5 : 0;
    tilt.x += (tx - tilt.x) * ease * 0.6;
    tilt.y += (ty - tilt.y) * ease * 0.6;
    hero.style.setProperty("--tilt-x", tilt.x.toFixed(4));
    hero.style.setProperty("--tilt-y", tilt.y.toFixed(4));
    nextMeteor -= step;
    if (nextMeteor <= 0 && !meteor) {
      meteor = { start: time, x: width * (0.55 + rand() * 0.4), y: height * (0.02 + rand() * 0.25) };
      nextMeteor = 7000 + rand() * 6000;
    }
    draw(time);
    frame = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    if (!frame) previous = 0;
  }
  const start = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); };

  resize();
  new ResizeObserver(resize).observe(hero);
  if (reduceMotion) return;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }).observe(hero);
  document.addEventListener("visibilitychange", start);

  let dust = [];
  hero.addEventListener("pointermove", (event) => {
    const box = hero.getBoundingClientRect();
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
    pointer.active = true;
    const svg = hero.querySelector(".hero-cloud svg");
    if (!svg) return;
    const frameBox = svg.getBoundingClientRect(), scale = 440 / frameBox.width;
    const px = (event.clientX - frameBox.left) * scale, py = (event.clientY - frameBox.top) * scale;
    if (!dust.length) dust = [...svg.querySelectorAll(".cloud-dust")];
    for (const node of dust) {
      const dx = node.center[0] - px, dy = node.center[1] - py, d = Math.hypot(dx, dy);
      const push = d < 46 ? ((1 - d / 46) ** 2 * 14) / Math.max(d, 1) : 0;
      node.style.translate = push ? `${(dx * push).toFixed(1)}px ${(dy * push).toFixed(1)}px` : "";
    }
  }, { passive: true });
  hero.addEventListener("pointerleave", () => {
    pointer.active = false;
    dust.forEach((node) => { node.style.translate = ""; });
  });
});

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
    const target = event.target.closest?.("a, button, summary, .cloud-major");
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
