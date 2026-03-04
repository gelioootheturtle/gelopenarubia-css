(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d', { alpha: true });

  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;

  function resize() {
    W = Math.floor(window.innerWidth * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  // Pointer for interactive pull/swirl
  const pointer = { x: W * 0.5, y: H * 0.5, down: false };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX * DPR;
    pointer.y = e.clientY * DPR;
  }, { passive: true });
  window.addEventListener('pointerdown', () => { pointer.down = true; nextMode(); }, { passive: true });
  window.addEventListener('pointerup',   () => { pointer.down = false; }, { passive: true });

  // Offscreen sampler
  const off = document.createElement('canvas');
  const ofc = off.getContext('2d');

  function samplePointsFromCanvas(gap = 6) {
    const img = ofc.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    for (let y = 0; y < off.height; y += gap) {
      for (let x = 0; x < off.width; x += gap) {
        const i = (y * off.width + x) * 4;
        const a = img[i + 3];
        if (a > 120) pts.push({ x, y });
      }
    }
    return pts;
  }

  function makeTextPoints(text, fontPx, weight = 900, gap = 6) {
    off.width = W;
    off.height = H;
    ofc.clearRect(0, 0, off.width, off.height);
    ofc.fillStyle = '#fff';
    ofc.textAlign = 'center';
    ofc.textBaseline = 'middle';
    ofc.font = `${weight} ${Math.floor(fontPx)}px system-ui, Segoe UI Emoji, Apple Color Emoji`;
    ofc.fillText(text, off.width / 2, off.height / 2);
    return samplePointsFromCanvas(gap);
  }

  function makeHeartPoints(gap = 6) {
    off.width = W;
    off.height = H;
    ofc.clearRect(0, 0, off.width, off.height);
    const s = Math.min(W, H) * 0.22;
    const cx = W / 2, cy = H / 2;
    ofc.fillStyle = '#fff';
    ofc.beginPath();
    ofc.moveTo(cx, cy + s * 0.35);
    ofc.bezierCurveTo(cx - s, cy - s * 0.2, cx - s * 0.8, cy - s * 1.1, cx, cy - s * 0.35);
    ofc.bezierCurveTo(cx + s * 0.8, cy - s * 1.1, cx + s, cy - s * 0.2, cx, cy + s * 0.35);
    ofc.closePath();
    ofc.fill();
    return samplePointsFromCanvas(gap);
  }

  async function makeImagePoints(src, scale = 0.58, gap = 6) {
    const img = await loadImage(src);
    off.width = W;
    off.height = H;
    ofc.clearRect(0, 0, off.width, off.height);

    const maxW = W * scale;
    const maxH = H * scale;
    const r = Math.min(maxW / img.width, maxH / img.height);
    const iw = img.width * r;
    const ih = img.height * r;
    const x = (W - iw) / 2;
    const y = (H - ih) / 2;

    // high-contrast silhouette from image
    ofc.save();
    ofc.fillStyle = '#000';
    ofc.fillRect(0, 0, W, H);
    ofc.drawImage(img, x, y, iw, ih);

    // convert to alpha mask
    const data = ofc.getImageData(0, 0, W, H);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0);
      const a = lum > 90 ? 255 : 0; // threshold
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a;
    }
    ofc.putImageData(data, 0, 0);
    ofc.restore();

    return samplePointsFromCanvas(gap);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  // Particle system
  const N = 9000; // heavy, but okay on most school PCs
  const particles = new Array(N).fill(0).map(() => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    tx: null,
    ty: null,
    c: 0
  }));

  // Modes: butterflies, heart, ORACLE, teacher photos
  
  function makeButterflyPoints(step=7){
    // classic butterfly curve (deterministic), returns canvas-space points
    const pts=[];
    const cx = W*0.5, cy = H*0.5;
    const s = Math.min(W,H)*0.18;
    for(let t=0;t<Math.PI*2;t+=0.03){
      const r = Math.exp(Math.cos(t)) - 2*Math.cos(4*t) + Math.pow(Math.sin(t/12),5);
      const x = cx + (s * r) * Math.sin(t);
      const y = cy - (s * r) * Math.cos(t);
      pts.push({x, y});
    }
    // densify / thin to roughly match particle count
    return normalizePoints(pts, 900, step);
  }
    
const modes = [
    { name: 'butterfly', build: () => makeButterflyPoints(7) },
    { name: 'heart',     build: () => makeHeartPoints(7) },
    { name: 'oracle',    build: () => makeTextPoints('ORACLE', Math.min(W, H) * 0.22, 950, 7) },
    { name: 'cssTeacher', build: () => makeImagePoints('./assets/css-teacher.jpg', 0.62, 7) },
    { name: 'emtechTeacher', build: () => makeImagePoints('./assets/emtech-teacher.jpg', 0.62, 7) }
  ];

  let modeIndex = 0;
  let targets = [];
  let targetsReady = false;

  async function setMode(i) {
    modeIndex = (i + modes.length) % modes.length;
    targetsReady = false;

    const built = await modes[modeIndex].build();
    // center targets (they're already on the canvas coordinate system)
    targets = built;

    // Assign targets to particles (repeat if fewer targets than particles)
    const tlen = targets.length || 1;
    for (let k = 0; k < particles.length; k++) {
      const t = targets[k % tlen];
      particles[k].tx = t.x;
      particles[k].ty = t.y;
      particles[k].c = (k % 360);
    }
    targetsReady = true;
  }

  function nextMode() {
    // tap/click cycles the shape
    setMode(modeIndex + 1);
  }
// auto-cycle so it keeps moving even without clicking (still click/tap to jump)
  const AUTO_CYCLE_MS = 6500;
  setInterval(() => {
    nextMode();
  }, AUTO_CYCLE_MS);


  // initial
  setMode(0);

  // Draw helpers
  function dot(x, y, hue, a = 1) {
    // tiny "star" dot
    ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${a})`;
    ctx.fillRect(x, y, 1.2 * DPR, 1.2 * DPR);
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    // subtle space fog
    const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.max(W, H) * 0.55);
    g.addColorStop(0, 'rgba(173,187,255,0.10)');
    g.addColorStop(0.35, 'rgba(120,168,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const pull = 0.0025;
    const jitter = 0.04;
    const damping = 0.90;

    for (let p of particles) {
      // target force
      if (targetsReady && p.tx != null) {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx += dx * pull;
        p.vy += dy * pull;
      }

      // pointer swirl
      const mdx = pointer.x - p.x;
      const mdy = pointer.y - p.y;
      const md = Math.hypot(mdx, mdy) + 0.0001;
      const influence = Math.max(0, 1 - md / (Math.min(W, H) * 0.35));
      if (influence > 0) {
        // orbit around pointer
        const swirl = 0.04 * influence;
        p.vx += (-mdy / md) * swirl;
        p.vy += ( mdx / md) * swirl;
      }

      // tiny random shimmer
      p.vx += (Math.random() - 0.5) * jitter;
      p.vy += (Math.random() - 0.5) * jitter;

      // integrate
      p.x += p.vx;
      p.y += p.vy;

      // bounds
      if (p.x < 0) p.x += W;
      if (p.y < 0) p.y += H;
      if (p.x > W) p.x -= W;
      if (p.y > H) p.y -= H;

      p.vx *= damping;
      p.vy *= damping;

      dot(p.x, p.y, 200 + (p.c % 160), 0.95);
    }

    requestAnimationFrame(tick);
  }

  tick();
})();