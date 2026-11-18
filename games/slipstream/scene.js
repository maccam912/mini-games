import { lanes, wakeAt, windAt } from './physics.js';

const ink = '#19343a',
  cream = '#fff1d2',
  rust = '#bc4822';
const colors = ['#d54a1e', '#294e69', '#39583e', '#c18b24'];
const frac = (n) => n - Math.floor(n);
const noise = (i) => frac(Math.sin(i * 93.45 + 0.6) * 43758.55);

export function makeScene(canvas, redraw) {
  const ctx = canvas.getContext('2d');
  const images = {};
  for (const name of ['salt-flats', 'streamliner', 'player', 'vega', 'moss', 'sol']) {
    const img = new Image();
    img.onload = redraw;
    img.src = './' + name + '.webp';
    images[name] = img;
  }
  new ResizeObserver(redraw).observe(canvas);
  const loaded = (img) => img.complete && img.naturalWidth;
  const lowMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function polygon(color, pts) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fill();
  }
  function landscape(w, h, horizon) {
    const img = images['salt-flats'];
    if (!loaded(img)) return;
    // Keep the terrain's proportions, extending the sky and salt vertically
    // on portrait displays so the road and mountains both stay in frame.
    const width = Math.max(w, Math.min(h * 1.48, w * 2.0));
    const height = width / 3;
    const x = (w - width) * 0.77,
      y = horizon - height * 0.66;
    if (y > 0) {
      const sh = Math.round(img.height * 0.13),
        strip = height * 0.13;
      for (let bottom = y, row = 0; bottom > 0; bottom -= strip, row++) {
        ctx.save();
        ctx.translate(0, bottom);
        ctx.scale(1, row % 2 ? 1 : -1);
        ctx.drawImage(img, 0, 0, img.width * 0.58, sh, x, row % 2 ? -strip : 0, width, strip + 1);
        ctx.restore();
      }
    }
    ctx.drawImage(img, x, y, width, height);
    const sh = Math.round(img.height * 0.23),
      strip = height * 0.23;
    for (let top = y + height, row = 0; top < h; top += strip, row++) {
      ctx.save();
      ctx.translate(0, top);
      ctx.scale(1, row % 2 ? 1 : -1);
      ctx.drawImage(img, 0, img.height - sh, img.width, sh, x, row % 2 ? -1 : -strip, width, strip + 1);
      ctx.restore();
    }
  }
  function menu(w, h) {
    const tall = h > w;
    landscape(w, h, h * 0.55);
    const car = images.streamliner;
    if (!loaded(car)) return;
    const width = Math.min(w * (tall ? 0.93 : 0.66), h * 2.5);
    const height = (width * car.height) / car.width;
    const x = w * (tall ? 0.51 : 0.58),
      y = h * (tall ? 0.7 : 0.76);
    ctx.fillStyle = '#4f493c53';
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.5, height * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(car, x - width / 2, y - height, width, height);
  }

  function course(w, h, race) {
    const player = race.cars[0];
    const tall = h > w,
      short = h < 530 && !tall;
    const horizon = h * (short ? 0.16 : 0.2);
    const stackedControls = w <= 760 && !short;
    const anchor = stackedControls ? Math.min(h * 0.705, h - 200) : h * 0.76;
    const roadWidth = Math.min(w * 0.93, (anchor - horizon) * 1.4);
    const px = roadWidth / 11.8;
    const cam = player.x * 0.16;
    const depth = 22;
    const at = (s, x = 0) => {
      const k = depth / Math.max(4.8, depth + s - player.s);
      return { x: w / 2 + (x - cam) * px * k, y: horizon + (anchor - horizon) * k, k };
    };
    const pt = (s, x) => {
      const p = at(s, x);
      return [p.x, p.y];
    };
    landscape(w, h, horizon);
    // Paint the road all the way to the vanishing point.
    const near = player.s - 18;
    const far = player.s + 1400;
    polygon('#f0d8aacc', [pt(near, -5.95), pt(far, -5.95), pt(far, 5.95), pt(near, 5.95)]);
    for (const side of [-1, 1]) {
      polygon('#a06940ad', [
        pt(near, side * 5.98),
        pt(far, side * 5.98),
        pt(far, side * 6.03),
        pt(near, side * 6.03)
      ]);
      polygon('#fff2cbb3', [
        pt(near, side * 5.87),
        pt(far, side * 5.87),
        pt(far, side * 5.94),
        pt(near, side * 5.94)
      ]);
    }
    const nearBlock = Math.floor(near / 8);
    for (let n = nearBlock + 55; n >= nearBlock; n--) {
      const s = n * 8;
      for (const x of [-1.8, 1.8])
        polygon('#ffffdfb3', [
          pt(s, x - 0.035),
          pt(s + 3, x - 0.035),
          pt(s + 3, x + 0.035),
          pt(s, x + 0.035)
        ]);
      const sx = (noise(n + 100) - 0.5) * 33,
        p = at(s, sx);
      ctx.fillStyle = '#ac865a59';
      ctx.fillRect(p.x, p.y, Math.max(1, p.k * px * 0.38), Math.max(1, p.k * 0.9));
      if (n % 3 === 0)
        for (const side of [-1, 1]) {
          const p = at(s, side * 6.28),
            height = Math.max(2, p.k * px * 0.69);
          ctx.fillStyle = cream;
          ctx.fillRect(p.x - 1.6 * p.k, p.y - height, 3.2 * p.k, height);
          ctx.fillStyle = rust;
          ctx.fillRect(p.x - 1.6 * p.k, p.y - height, 3.2 * p.k, height * 0.44);
        }
    }

    const marker = at(race.heat.length);
    if (race.heat.length - player.s < 300 && marker.y < h * 1.2) {
      for (let i = 0; i < 20; i++)
        for (let j = 0; j < 2; j++) {
          const s = race.heat.length + j * 0.64,
            x = -5.9 + i * 0.59;
          polygon((i + j) % 2 ? ink : cream, [
            pt(s, x),
            pt(s + 0.64, x),
            pt(s + 0.64, x + 0.59),
            pt(s, x + 0.59)
          ]);
        }
      if (marker.k > 0.2) {
        const p = at(race.heat.length, 6.35),
          hh = px * p.k * 2;
        ctx.fillStyle = ink;
        ctx.fillRect(p.x, p.y - hh, Math.max(1, p.k * 3), hh);
        ctx.font = 'bold ' + Math.max(9, Math.min(17, hh * 0.28)) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('FINISH', p.x, p.y - hh - 3);
      }
    }

    const wind = windAt(race.heat, player.s);
    // A windsock provides a world-space indication of the crosswind.
    for (let n = Math.floor((player.s + 200) / 135); n >= Math.ceil(near / 135); n--) {
      const p = at(n * 135 + 6, -7.2);
      if (p.y > h + 60) continue;
      const sz = px * p.k,
        direction = wind.x >= 0 ? 1 : -1;
      ctx.fillStyle = ink;
      ctx.fillRect(p.x, p.y - 2.7 * sz, Math.max(1, sz * 0.047), 2.7 * sz);
      const cx = p.x,
        cy = p.y - sz * 2.53,
        length = direction * sz * (0.48 + Math.abs(wind.x) * 0.075);
      for (let i = 0; i < 4; i++) {
        const a = i / 4,
          b = (i + 1) / 4;
        const upper = (t) => cy + sz * 0.18 * t;
        const lower = (t) => upper(t) + sz * (0.36 - 0.19 * t);
        polygon(i % 2 ? cream : rust, [
          [cx + a * length, upper(a)],
          [cx + b * length, upper(b)],
          [cx + b * length, lower(b)],
          [cx + a * length, lower(a)]
        ]);
      }
    }

    for (const car of race.cars) {
      if (!car.id || car.finished || car.s < near || car.s > player.s + 270) continue;
      const phase = lowMotion.matches ? 0 : race.time * 8;
      const past = (gap, side) => {
        const s = car.s - gap;
        const wake = wakeAt(car, s, car.x, windAt(race.heat, s));
        const ripple = 0.07 * Math.sin(gap * 0.6 - phase * 0.32 + car.id) * Math.min(1, gap / 15);
        return pt(s, wake.center + (side + ripple) * wake.width);
      };
      for (let gap = 3; gap < 53; gap += 2) {
        if (car.s - gap - 2 < near) break;
        const alpha = 0.29 * Math.exp(-gap / 39);
        polygon('rgba(12,139,158,' + alpha + ')', [
          past(gap, -1.16),
          past(gap + 2, -1.16),
          past(gap + 2, 1.16),
          past(gap, 1.16)
        ]);
        for (const side of [-0.69, 0.69]) {
          ctx.beginPath();
          ctx.moveTo(...past(gap, side));
          ctx.lineTo(...past(gap + 2, side));
          ctx.strokeStyle = 'rgba(16,109,130,' + 0.45 * Math.exp(-gap / 37) + ')';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        if (Math.floor(gap + phase) % 10 < 2) {
          ctx.beginPath();
          ctx.moveTo(...past(gap - 0.6, -0.25));
          ctx.lineTo(...past(gap, 0.0));
          ctx.lineTo(...past(gap - 0.6, 0.25));
          ctx.strokeStyle = '#fff4cdbb';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }
    }

    const objects = race.cars
      .filter((c) => c.s > near && (!c.finished || !c.id))
      .map((car) => ({ s: car.s, car }));
    for (const [s, lane] of race.heat.cones) if (s >= near && s < player.s + 245) objects.push({ s, lane });
    for (const obj of objects.sort((a, b) => b.s - a.s)) {
      if (!obj.car) {
        for (const off of [-1.05, 0, 1.05]) {
          const p = at(obj.s, lanes[obj.lane] + off),
            unit = px * p.k;
          ctx.fillStyle = '#604d4080';
          ctx.fillRect(p.x - unit * 0.22, p.y, unit * 0.6, Math.max(1, unit * 0.08));
          polygon(rust, [
            [p.x - unit * 0.21, p.y],
            [p.x, p.y - unit * 0.71],
            [p.x + unit * 0.21, p.y]
          ]);
          polygon(cream, [
            [p.x - 0.135 * unit, p.y - 0.25 * unit],
            [p.x - 0.08 * unit, p.y - 0.45 * unit],
            [p.x + 0.08 * unit, p.y - 0.45 * unit],
            [p.x + 0.135 * unit, p.y - 0.25 * unit]
          ]);
        }
        continue;
      }
      const car = obj.car,
        p = at(car.s, car.x);
      const ww = px * p.k * 1.82,
        hh = ww * (tall ? 1.58 : 1.48);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(car.vx, car.v) * 0.88);
      ctx.fillStyle = '#55473255';
      ctx.beginPath();
      ctx.ellipse(ww * 0.1, hh * 0.09, ww * 0.55, hh * 0.47, -0.08, 0, Math.PI * 2);
      ctx.fill();
      if (car.boosting) {
        const tail = hh * (0.2 + (lowMotion.matches ? 0 : 0.06 * Math.sin(race.time * 42)));
        for (const side of [-0.25, 0.25]) {
          const x = ww * side;
          polygon('#f18524dd', [
            [x - ww * 0.13, hh * 0.36],
            [x + ww * 0.13, hh * 0.36],
            [x, hh * 0.46 + tail]
          ]);
          polygon('#fff6a6', [
            [x - ww * 0.07, hh * 0.4],
            [x + ww * 0.07, hh * 0.4],
            [x, hh * 0.48 + tail * 0.6]
          ]);
        }
      }
      const img = images[car.spec.car];
      if (loaded(img)) ctx.drawImage(img, -ww / 2, -hh / 2, ww, hh);
      else {
        ctx.fillStyle = colors[car.id];
        ctx.fillRect(-ww / 2, -hh / 2, ww, hh);
      }
      if (car.contact > 0.38) {
        ctx.strokeStyle = '#fff7cb';
        ctx.lineWidth = 2;
        ctx.strokeRect(-ww * 0.53, -hh * 0.5, ww * 1.06, hh);
      }
      ctx.restore();
      if ((!car.id && race.time < 3.5) || (car.id && car.s > player.s + 5 && car.s < player.s + 78)) {
        const text = car.id ? car.spec.name.toUpperCase() : 'YOU';
        ctx.font = 'bold ' + (short ? 9 : 10) + 'px system-ui';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(text).width + 10,
          yy = p.y - hh * 0.53 - 15;
        ctx.fillStyle = car.id ? '#1b3439de' : '#a7381be8';
        ctx.fillRect(p.x - tw / 2, yy, tw, 14);
        ctx.fillStyle = cream;
        ctx.fillText(text, p.x, yy + 10.5);
      }
    }
  }
  return function draw(mode, race) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight,
      dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!ctx || !w || !h) return;
    const cw = Math.round(w * dpr),
      ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(cw / w, 0, 0, ch / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (mode === 'menu') menu(w, h);
    else course(w, h, race);
  };
}
