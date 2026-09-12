/* Инженерная биология — интерактивные модели.
   Vanilla JS, без зависимостей и сборки. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;

  let _seed = 0x2f6e2b1;
  function rnd() {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 4294967296;
  }

  function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 1, h = 1;
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    return {
      ctx,
      get w() { return w; },
      get h() { return h; },
      resize,
    };
  }

  function pointer(canvas, opts) {
    const st = { x: 0, y: 0, down: false };
    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      st.x = e.clientX - r.left;
      st.y = e.clientY - r.top;
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      st.down = true;
      toLocal(e);
      opts.down && opts.down(st);
    });
    canvas.addEventListener('pointermove', (e) => {
      toLocal(e);
      opts.move && opts.move(st);
    });
    const up = () => {
      if (!st.down) return;
      st.down = false;
      opts.up && opts.up(st);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return st;
  }

  function createLoop(canvas, step) {
    let running = false, visible = true, raf = 0, last = 0, acc = 0;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
    io.observe(canvas);
    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible) { last = t; acc = 0; return; }
      const elapsed = last ? Math.min(50, t - last) : 16.6667;
      last = t;
      acc += elapsed / 16.6667;
      let n = Math.floor(acc);
      acc -= n;
      if (n > 4) n = 4;
      if (n < 0) n = 0;
      for (let i = 0; i < n; i++) step(1, t);
    }
    return {
      start() { if (!running) { running = true; last = 0; acc = 0; raf = requestAnimationFrame(frame); } },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
  }

  function observeResize(canvas, view, rebuild) {
    let first = true, pending = false;
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return; }
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        view.resize();
        rebuild();
      });
    });
    ro.observe(canvas);
  }

  /* ============================================================
     00 · МОРФОГЕНЕЗ — Neural Cellular Automaton
     ============================================================ */
  function initNCA() {
    const canvas = document.getElementById('c-nca');
    if (!canvas) return;
    const view = setupCanvas(canvas);

    let GW = 0, GH = 0, N = 0;
    let target, alive, alive2, scar, noise;
    let off, octx, img, data;
    let regen = true, frame = 0, prevCount = 0, stable = 0;
    const elAlive = document.querySelector('[data-nca="alive"]');
    const elState = document.querySelector('[data-nca="state"]');

    function buildTarget() {
      const cx = GW / 2, cy = GH / 2, s = GH * 0.46;
      const shapes = [
        [0, -0.70, 0, -0.68, 0.155],        // голова
        [0, -0.56, 0, 0.26, 0.125],         // тело
        [0, 0.26, 0.03, 0.84, 0.04],        // хвост
        [-0.07, -0.42, -0.46, -0.54, 0.05], // передняя лапа L
        [0.07, -0.42, 0.46, -0.54, 0.05],   // передняя лапа R
        [-0.07, 0.20, -0.46, 0.38, 0.055],  // задняя лапа L
        [0.07, 0.20, 0.46, 0.38, 0.055],    // задняя лапа R
      ];
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const wx = (x - cx) / s, wy = (y - cy) / s;
          let t = 0;
          for (let k = 0; k < shapes.length; k++) {
            const sh = shapes[k];
            const dx = sh[2] - sh[0], dy = sh[3] - sh[1];
            const len2 = dx * dx + dy * dy;
            let d2;
            if (len2 < 1e-9) {
              const ax = wx - sh[0], ay = wy - sh[1];
              d2 = ax * ax + ay * ay;
            } else {
              let u = ((wx - sh[0]) * dx + (wy - sh[1]) * dy) / len2;
              u = clamp(u, 0, 1);
              const px = sh[0] + dx * u, py = sh[1] + dy * u;
              const ax = wx - px, ay = wy - py;
              d2 = ax * ax + ay * ay;
            }
            if (d2 <= sh[4] * sh[4]) { t = 1; break; }
          }
          target[y * GW + x] = t;
        }
      }
    }

    function seed() {
      alive.fill(0);
      scar.fill(0);
      const cx = GW / 2, cy = GH / 2, s = GH * 0.46;
      const sx = cx, sy = cy - 0.70 * s, r = 3;
      for (let y = Math.floor(sy - r); y <= sy + r; y++) {
        for (let x = Math.floor(sx - r); x <= sx + r; x++) {
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if ((x - sx) ** 2 + (y - sy) ** 2 <= r * r) alive[y * GW + x] = 1;
        }
      }
    }

    function buildGrid() {
      const w = view.w, h = view.h;
      GW = Math.round(clamp(w / 3.2, 120, 230));
      GH = Math.max(64, Math.round(GW * h / w));
      N = GW * GH;
      target = new Float32Array(N);
      alive = new Float32Array(N);
      alive2 = new Float32Array(N);
      scar = new Float32Array(N);
      noise = new Float32Array(N);
      for (let i = 0; i < N; i++) noise[i] = rnd();
      buildTarget();
      seed();
      off = document.createElement('canvas');
      off.width = GW; off.height = GH;
      octx = off.getContext('2d');
      img = octx.createImageData(GW, GH);
      data = img.data;
      frame = 0; prevCount = 0; stable = 0;
    }

    function damage(gx, gy, rad) {
      const r2 = rad * rad;
      for (let y = Math.floor(gy - rad); y <= gy + rad; y++) {
        for (let x = Math.floor(gx - rad); x <= gx + rad; x++) {
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if ((x - gx) ** 2 + (y - gy) ** 2 <= r2) {
            alive[y * GW + x] = 0;
            if (!regen) scar[y * GW + x] = 1;
          }
        }
      }
    }

    function stepNCA() {
      frame++;
      const grow = 0.16, shrink = 0.30;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          const a = alive[i];
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
              if (alive[yy * GW + xx] > 0.5) s++;
            }
          }
          let na = a;
          if (target[i] > 0.5) {
            if (a < 1 && scar[i] < 0.5 && s >= 2) na = Math.min(1, a + grow);
            else if (a > 0 && a < 1) na = Math.min(1, a + 0.03);
          } else if (a > 0) {
            na = Math.max(0, a - shrink);
          }
          alive2[i] = na;
        }
      }
      const tmp = alive; alive = alive2; alive2 = tmp;

      if (regen) {
        for (let i = 0; i < N; i++) if (scar[i] > 0) scar[i] = Math.max(0, scar[i] - 0.02);
      }

      if (frame % 5 === 0) {
        let c = 0;
        for (let i = 0; i < N; i++) if (alive[i] > 0.5) c++;
        if (elAlive) elAlive.textContent = c;
        stable = Math.abs(c - prevCount) < 2 ? stable + 1 : 0;
        prevCount = c;
        if (elState) {
          elState.textContent = stable > 20 ? 'форма собрана' : (frame < 40 ? 'рост' : 'регенерация');
        }
      }
    }

    function renderNCA() {
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x, o = i * 4;
          const a = alive[i];
          if (a <= 0.03) {
            data[o] = 8; data[o + 1] = 12; data[o + 2] = 16; data[o + 3] = 255;
            continue;
          }
          const t = y / GH;
          const r0 = 90 + 40 * t;
          const g0 = 235 - 25 * t;
          const b0 = 200 - 70 * t;
          const core = Math.min(1, a * 1.2);
          const edge = Math.max(0, 1 - Math.abs(a - 0.5) * 2.4);
          const seg = 0.86 + 0.14 * Math.sin(x * 0.9);
          const val = (core * 0.85 + edge * 0.5) * seg * (0.92 + 0.16 * noise[i]);
          data[o] = clamp(r0 * val + edge * 40, 0, 255);
          data[o + 1] = clamp(g0 * val + edge * 55, 0, 255);
          data[o + 2] = clamp(b0 * val + edge * 45, 0, 255);
          data[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      const ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(off, 0, 0, w, h);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.restore();
    }

    const toGX = (px) => (px / view.w) * GW;
    const toGY = (py) => (py / view.h) * GH;

    pointer(canvas, {
      down: (s) => damage(toGX(s.x), toGY(s.y), 5),
      move: (s) => { if (s.down) damage(toGX(s.x), toGY(s.y), 4); },
    });

    document.querySelectorAll('[data-nca]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.nca;
        if (act === 'damage') {
          for (let k = 0; k < 4; k++) damage(GW * (0.35 + rnd() * 0.3), GH * (0.3 + rnd() * 0.4), 4 + rnd() * 4);
        } else if (act === 'regen') {
          regen = !regen;
          btn.setAttribute('aria-pressed', String(regen));
          btn.textContent = 'Регенерация: ' + (regen ? 'вкл' : 'выкл');
        } else if (act === 'reset') {
          seed();
          frame = 0; prevCount = 0; stable = 0;
        }
      });
    });

    buildGrid();
    observeResize(canvas, view, buildGrid);
    createLoop(canvas, () => { stepNCA(); renderNCA(); }).start();
  }

  /* ============================================================
     01 · КОНСТРУКЦИИ — самосборка белка
     ============================================================ */
  function initProtein() {
    const canvas = document.getElementById('c-protein');
    if (!canvas) return;
    const view = setupCanvas(canvas);
    const N = 60;
    let pts = [], u = 100, cx = 0, cy = 0, grabbed = -1, chargesOn = true;

    function layout() {
      u = Math.min(view.w, view.h);
      cx = view.w / 2;
      cy = view.h / 2;
      const R = u * 0.21;
      pts = [];
      for (let i = 0; i < N; i++) {
        let type;
        if (i % 7 === 0) type = 'plus';
        else if (i % 7 === 3) type = 'minus';
        else if (rnd() < 0.55) type = 'hydro';
        else type = 'polar';
        const f = i / (N - 1);
        const ang = f * TAU * 2.2;
        const rad = R * Math.sqrt(f + 0.08);
        pts.push({
          x: cx + Math.cos(ang) * rad,
          y: cy + Math.sin(ang) * rad,
          vx: 0, vy: 0,
          ax: 0, ay: 0,
          type,
          r: u * 0.012,
        });
      }
      grabbed = -1;
    }

    function step() {
      const rest = u * 0.042;
      const soft = u * 0.046;
      for (const p of pts) { p.ax = 0; p.ay = 0; }

      for (const p of pts) {
        if (p.type === 'hydro') {
          p.ax += (cx - p.x) * 0.0017;
          p.ay += (cy - p.y) * 0.0017;
        } else {
          p.ax += (cx - p.x) * 0.0002;
          p.ay += (cy - p.y) * 0.0002;
        }
      }

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i], b = pts[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1e-6) { dx = 0.01; dy = 0; d2 = 1e-4; }
          const d = Math.sqrt(d2);
          if (d < soft) {
            const f = (1 - d / soft) * 0.5;
            const nx = dx / d, ny = dy / d;
            a.ax -= nx * f; a.ay -= ny * f;
            b.ax += nx * f; b.ay += ny * f;
          }
          if (chargesOn) {
            const ca = a.type === 'plus' ? 1 : a.type === 'minus' ? -1 : 0;
            const cb = b.type === 'plus' ? 1 : b.type === 'minus' ? -1 : 0;
            if (ca && cb) {
              const R = u * 0.20;
              if (d < R) {
                const f = ca * cb * (1 - d / R) * 0.02;
                const nx = dx / d, ny = dy / d;
                a.ax += nx * f; a.ay += ny * f;
                b.ax -= nx * f; b.ay -= ny * f;
              }
            }
          }
        }
      }

      const damp = 0.9, maxv = u * 0.05;
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        if (i === grabbed) { p.vx = 0; p.vy = 0; continue; }
        p.vx = (p.vx + p.ax) * damp;
        p.vy = (p.vy + p.ay) * damp;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > maxv) { p.vx *= maxv / sp; p.vy *= maxv / sp; }
        p.x += p.vx; p.y += p.vy;
      }

      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < N - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-4;
          const minL = rest * 0.7, maxL = rest * 1.3;
          if (d < minL || d > maxL) {
            const want = clamp(d, minL, maxL);
            const diff = ((d - want) / d) * 0.5;
            if (i !== grabbed) { a.x += dx * diff; a.y += dy * diff; }
            if (i + 1 !== grabbed) { b.x -= dx * diff; b.y -= dy * diff; }
          }
        }
      }

      const m = u * 0.03;
      for (const p of pts) {
        if (p.x < m) { p.x = m; p.vx *= -0.4; }
        if (p.x > view.w - m) { p.x = view.w - m; p.vx *= -0.4; }
        if (p.y < m) { p.y = m; p.vy *= -0.4; }
        if (p.y > view.h - m) { p.y = view.h - m; p.vy *= -0.4; }
      }
    }

    function render() {
      const ctx = view.ctx;
      ctx.clearRect(0, 0, view.w, view.h);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(127,224,176,0.22)';
      ctx.beginPath();
      for (let i = 0; i < N - 1; i++) {
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      }
      ctx.stroke();

      for (let i = 0; i < N; i++) {
        const p = pts[i], r = p.r;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        if (p.type === 'hydro') { ctx.fillStyle = '#7fe0b0'; ctx.fill(); }
        else if (p.type === 'polar') { ctx.fillStyle = 'rgba(140,154,161,0.2)'; ctx.strokeStyle = '#8c9aa1'; ctx.lineWidth = 1.2; ctx.fill(); ctx.stroke(); }
        else if (p.type === 'plus') { ctx.fillStyle = '#6fc7e0'; ctx.fill(); }
        else { ctx.fillStyle = '#e0a35a'; ctx.fill(); }
      }

      if (grabbed >= 0) {
        const p = pts[grabbed];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, TAU);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    pointer(canvas, {
      down: (s) => {
        let best = -1, bd = (u * 0.06) ** 2;
        for (let i = 0; i < N; i++) {
          const d2 = (pts[i].x - s.x) ** 2 + (pts[i].y - s.y) ** 2;
          if (d2 < bd) { bd = d2; best = i; }
        }
        grabbed = best;
      },
      move: (s) => {
        if (grabbed >= 0) { pts[grabbed].x = s.x; pts[grabbed].y = s.y; }
      },
      up: () => { grabbed = -1; },
    });

    document.querySelectorAll('[data-protein]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.protein;
        if (act === 'heat') {
          for (const p of pts) {
            const ang = rnd() * TAU, sp = u * (0.03 + rnd() * 0.05);
            p.vx += Math.cos(ang) * sp;
            p.vy += Math.sin(ang) * sp;
          }
        } else if (act === 'fold') {
          for (const p of pts) { p.vx *= 0.2; p.vy *= 0.2; }
        } else if (act === 'charge') {
          chargesOn = !chargesOn;
          btn.setAttribute('aria-pressed', String(chargesOn));
          btn.textContent = 'Заряды: ' + (chargesOn ? 'вкл' : 'выкл');
        }
      });
    });

    layout();
    observeResize(canvas, view, layout);
    createLoop(canvas, () => { step(); render(); }).start();
  }

  /* ============================================================
     02 · СТАРЕНИЕ — ландшафт аттракторов
     ============================================================ */
  function initAging() {
    const canvas = document.getElementById('c-aging');
    if (!canvas) return;
    const view = setupCanvas(canvas);
    let x = -0.55, v = 0, age = 0, auto = false;
    const elState = document.querySelector('[data-aging="state"]');
    const elAge = document.querySelector('[data-aging="age"]');

    function V(xx, a) {
      const dy = 1.10 - 0.55 * a;
      const doo = 0.55 + 0.75 * a;
      return -dy * Math.exp(-((xx + 0.55) ** 2) / (2 * 0.22 * 0.22))
           - doo * Math.exp(-((xx - 0.50) ** 2) / (2 * 0.26 * 0.26))
           + 0.05 * xx;
    }

    function step() {
      if (auto) {
        age = Math.min(1, age + 0.0035);
        if (age >= 1) auto = false;
      }
      const h = 0.001;
      const dV = (V(x + h, age) - V(x - h, age)) / (2 * h);
      v += -dV * 0.0032;
      v *= 0.9;
      v += (rnd() - 0.5) * 0.0015;
      x = clamp(x + v, -1.15, 1.15);
      if (elState) elState.textContent = x < -0.12 ? 'YOUNG' : x > 0.12 ? 'OLD' : 'переход';
      if (elAge) elAge.textContent = Math.round(age * 100);
    }

    function render() {
      const ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);
      const padX = w * 0.08;
      const baseY = h * 0.22;
      const sY = (h * 0.62) / 1.5;
      const X = (vx) => padX + ((vx + 1.15) / 2.3) * (w - 2 * padX);
      const Y = (vv) => baseY + (-vv) * sY;

      const grad = ctx.createLinearGradient(padX, 0, w - padX, 0);
      grad.addColorStop(0, '#7fe0b0');
      grad.addColorStop(0.5, '#8c9aa1');
      grad.addColorStop(1, '#e0a35a');

      const M = 260;
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const xx = -1.15 + (2.3 * i) / M;
        const px = X(xx), py = Y(V(xx, age));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(X(1.15), h);
      ctx.lineTo(X(-1.15), h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(127,224,176,0.05)';
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const xx = -1.15 + (2.3 * i) / M;
        const px = X(xx), py = Y(V(xx, age));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const yp = Y(V(-0.55, age)), op = Y(V(0.5, age));
      ctx.fillStyle = 'rgba(127,224,176,0.85)';
      ctx.fillText('YOUNG', X(-0.55), yp + 22);
      ctx.fillStyle = 'rgba(224,163,90,0.85)';
      ctx.fillText('OLD', X(0.5), op + 22);

      const bx = X(x), by = Y(V(x, age));
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 26);
      glow.addColorStop(0, 'rgba(255,255,255,0.5)');
      glow.addColorStop(0.3, 'rgba(127,224,176,0.35)');
      glow.addColorStop(1, 'rgba(127,224,176,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, 26, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, TAU);
      ctx.fillStyle = '#eef3f2';
      ctx.fill();
      ctx.strokeStyle = 'rgba(127,224,176,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    document.querySelectorAll('[data-aging]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.aging;
        if (act === 'live') { age = 0; auto = true; x = -0.55; v = 0; }
        else if (act === 'reset') { age = 0; auto = false; x = -0.55; v = 0; }
      });
    });

    createLoop(canvas, () => { step(); render(); }).start();
  }

  /* ============================================================
     03 · ОНКОЛОГИЯ — потеря контактного торможения
     ============================================================ */
  function initOnco() {
    const canvas = document.getElementById('c-onco');
    if (!canvas) return;
    const view = setupCanvas(canvas);
    let GW = 0, GH = 0, N = 0;
    let cells, noise, off, octx, img, data;
    let apoptosis = false, mutated = 0;
    const elCount = document.querySelector('[data-onco="count"]');

    function build() {
      const w = view.w, h = view.h;
      GW = 180;
      GH = Math.max(80, Math.round(GW * h / w));
      N = GW * GH;
      cells = new Uint8Array(N);
      noise = new Float32Array(N);
      for (let i = 0; i < N; i++) noise[i] = rnd();
      const cx = GW / 2, cy = GH / 2, rx = GW * 0.36, ry = GH * 0.33;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const d = dx * dx + dy * dy;
          const edge = 1 - 0.12 * Math.sin(Math.atan2(dy, dx) * 6);
          if (d < edge) cells[y * GW + x] = 1;
        }
      }
      mutated = 0;
      off = document.createElement('canvas');
      off.width = GW; off.height = GH;
      octx = off.getContext('2d');
      img = octx.createImageData(GW, GH);
      data = img.data;
      if (elCount) elCount.textContent = 0;
    }

    function mutateAt(x, y) {
      if (x < 0 || y < 0 || x >= GW || y >= GH) return;
      const i = y * GW + x;
      if (cells[i] === 1) cells[i] = 2;
      else {
        let best = -1, bd = 1e9;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
            if (cells[yy * GW + xx] === 1) {
              const d = dx * dx + dy * dy;
              if (d < bd) { bd = d; best = yy * GW + xx; }
            }
          }
        }
        if (best >= 0) cells[best] = 2;
      }
    }

    function step() {
      const born = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          if (cells[i] !== 2) continue;
          if (apoptosis && rnd() < 0.02) { cells[i] = 0; continue; }
          if (rnd() < 0.14) {
            const d = dirs[(rnd() * 4) | 0];
            const xx = x + d[0], yy = y + d[1];
            if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
            const j = yy * GW + xx;
            if (cells[j] === 0) { if (rnd() < 0.6) born.push(j); }
            else if (cells[j] === 1 && rnd() < 0.35) born.push(j);
          }
        }
      }
      for (const j of born) cells[j] = 2;

      let c = 0;
      for (let i = 0; i < N; i++) if (cells[i] === 2) c++;
      mutated = c;
      if (elCount) elCount.textContent = c;
    }

    function render() {
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x, o = i * 4;
          const st = cells[i];
          const nz = noise[i];
          if (st === 0) {
            data[o] = 8; data[o + 1] = 12; data[o + 2] = 16; data[o + 3] = 255;
          } else if (st === 1) {
            const v = 0.75 + 0.35 * nz;
            data[o] = 26 * v; data[o + 1] = 78 * v; data[o + 2] = 60 * v; data[o + 3] = 255;
          } else {
            const v = 0.7 + 0.6 * nz;
            data[o] = clamp(215 * v, 0, 255);
            data[o + 1] = clamp(95 * v, 0, 255);
            data[o + 2] = clamp(55 * v, 0, 255);
            data[o + 3] = 255;
          }
        }
      }
      octx.putImageData(img, 0, 0);
      const ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      ctx.filter = 'blur(8px)';
      ctx.drawImage(off, 0, 0, w, h);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.restore();
    }

    const toGX = (px) => (px / view.w) * GW;
    const toGY = (py) => (py / view.h) * GH;
    pointer(canvas, { down: (s) => mutateAt(Math.round(toGX(s.x)), Math.round(toGY(s.y))) });

    document.querySelectorAll('[data-onco]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.onco;
        if (act === 'mutate') {
          let seeded = 0, tries = 0;
          while (seeded < 4 && tries++ < 2000) {
            const x = (GW * (0.32 + rnd() * 0.36)) | 0;
            const y = (GH * (0.32 + rnd() * 0.36)) | 0;
            if (cells[y * GW + x] === 1) { cells[y * GW + x] = 2; seeded++; }
          }
        } else if (act === 'apoptosis') {
          apoptosis = !apoptosis;
          btn.setAttribute('aria-pressed', String(apoptosis));
          btn.textContent = 'Апоптоз: ' + (apoptosis ? 'вкл' : 'выкл');
        } else if (act === 'therapy') {
          for (let i = 0; i < N; i++) if (cells[i] === 2) cells[i] = 0;
          mutated = 0;
          if (elCount) elCount.textContent = 0;
        } else if (act === 'reset') {
          build();
        }
      });
    });

    build();
    observeResize(canvas, view, build);
    createLoop(canvas, () => { step(); render(); }).start();
  }

  /* ============================================================
     04 · ОМОЛОЖЕНИЕ — разворот вектора старения
     ============================================================ */
  function initRej() {
    const canvas = document.getElementById('c-rej');
    if (!canvas) return;
    const view = setupCanvas(canvas);
    const NG = 220;
    const weights = [0.56, 0.17, 0.19, 0.05, 0.015];
    const angles = [-0.20, 0.14, -0.11, 0.22, -0.16];
    let dots = [], enabled = [false, false, false, false, false];
    let youngX = 0, oldX = 0, cy = 0;
    const elPct = document.querySelector('[data-rej="pct"]');

    function build() {
      const w = view.w, h = view.h;
      cy = h / 2;
      youngX = w * 0.32;
      oldX = w * 0.68;
      dots = [];
      for (let i = 0; i < NG; i++) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd());
        const yx = youngX + Math.cos(a) * rr * w * 0.075;
        const yy = cy + Math.sin(a) * rr * h * 0.27;
        const ox = oldX + Math.cos(a + 1.1) * rr * w * 0.075;
        const oy = cy + Math.sin(a + 1.1) * rr * h * 0.27 + (rnd() - 0.5) * h * 0.04;
        dots.push({ yx, yy, ox, oy, x: ox, y: oy });
      }
    }

    function intervention(i) {
      const len = (oldX - youngX) * weights[i];
      const ang = Math.PI + angles[i];
      return { x: Math.cos(ang) * len, y: Math.sin(ang) * len };
    }

    function step() {
      let tx = 0, ty = 0;
      for (let i = 0; i < 5; i++) {
        if (!enabled[i]) continue;
        const iv = intervention(i);
        tx += iv.x; ty += iv.y;
      }
      for (const d of dots) {
        const gx = d.ox + tx, gy = d.oy + ty;
        d.x += (gx - d.x) * 0.07;
        d.y += (gy - d.y) * 0.07;
      }
      const sum = enabled.reduce((s, e, i) => s + (e ? weights[i] : 0), 0);
      if (elPct) elPct.textContent = Math.round(Math.min(0.985, sum) * 1000) / 10;
    }

    function render() {
      const ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);

      const rg = ctx.createRadialGradient(oldX, cy, 0, oldX, cy, w * 0.22);
      rg.addColorStop(0, 'rgba(224,163,90,0.10)');
      rg.addColorStop(1, 'rgba(224,163,90,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(oldX, cy, w * 0.22, 0, TAU); ctx.fill();

      const yg = ctx.createRadialGradient(youngX, cy, 0, youngX, cy, w * 0.22);
      yg.addColorStop(0, 'rgba(127,224,176,0.12)');
      yg.addColorStop(1, 'rgba(127,224,176,0)');
      ctx.fillStyle = yg;
      ctx.beginPath(); ctx.arc(youngX, cy, w * 0.22, 0, TAU); ctx.fill();

      for (const d of dots) {
        const t = clamp((d.x - oldX) / (youngX - oldX), 0, 1);
        const r = Math.round(mix(224, 127, t));
        const g = Math.round(mix(163, 224, t));
        const b = Math.round(mix(90, 176, t));
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.35 + 0.5 * t) + ')';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.1, 0, TAU);
        ctx.fill();
      }

      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(127,224,176,0.9)';
      ctx.fillText('YOUNG', youngX, cy + h * 0.34);
      ctx.fillStyle = 'rgba(224,163,90,0.9)';
      ctx.fillText('OLD', oldX, cy + h * 0.34);

      ctx.strokeStyle = 'rgba(224,163,90,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(youngX + w * 0.06, cy - h * 0.36);
      ctx.lineTo(oldX + w * 0.06, cy - h * 0.36);
      ctx.stroke();
      ctx.fillStyle = 'rgba(224,163,90,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText('AGING VECTOR →', youngX + w * 0.06, cy - h * 0.36 - 8);

      for (let i = 0; i < 5; i++) {
        if (!enabled[i]) continue;
        const iv = intervention(i);
        const sx = oldX, sy = cy + (i - 2) * h * 0.05;
        const ex = sx + iv.x, ey = sy + iv.y;
        ctx.strokeStyle = 'rgba(127,224,176,0.75)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        const ang = Math.atan2(iv.y, iv.x);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4));
        ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fillStyle = 'rgba(127,224,176,0.85)';
        ctx.fill();
      }
    }

    document.querySelectorAll('[data-rej]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.rej);
        enabled[i] = !enabled[i];
        btn.setAttribute('aria-pressed', String(enabled[i]));
      });
    });

    build();
    observeResize(canvas, view, build);
    createLoop(canvas, () => { step(); render(); }).start();
  }

  /* ============================================================
     NAV
     ============================================================ */
  function initNav() {
    const links = Array.from(document.querySelectorAll('.partnav a'));
    const secs = Array.from(document.querySelectorAll('.module'));
    if (!links.length || !secs.length) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((a) => a.classList.toggle('active', a.dataset.nav === e.target.id));
        }
      });
    }, { threshold: 0.4 });
    secs.forEach((s) => io.observe(s));
  }

  function boot() {
    initNCA();
    initProtein();
    initAging();
    initOnco();
    initRej();
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
