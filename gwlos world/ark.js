(() => {
  const canvas = document.getElementById("ark");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  let W=0, H=0, DPR=1;
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = canvas.width  = Math.floor(innerWidth * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  }
  addEventListener("resize", resize);
  resize();

  const pointer = { x: W*0.5, y: H*0.5, down:false };
  addEventListener("pointermove", (e)=>{
    pointer.x = e.clientX * DPR;
    pointer.y = e.clientY * DPR;
  }, {passive:true});
  addEventListener("pointerdown", ()=>pointer.down=true, {passive:true});
  addEventListener("pointerup",   ()=>pointer.down=false, {passive:true});

  // Build target points from silhouette image
  const img = new Image();
  img.src = "./assets/ark.webp";

  let targets = [];
  let particles = [];

  function buildTargets(){
    const off = document.createElement("canvas");
    const octx = off.getContext("2d", { willReadFrequently:true });

    const scale = Math.min(W / (img.width||1), H / (img.height||1)) * 0.72;
    const iw = Math.max(1, Math.floor(img.width * scale));
    const ih = Math.max(1, Math.floor(img.height * scale));

    off.width = iw;
    off.height = ih;

    octx.clearRect(0,0,iw,ih);
    octx.drawImage(img, 0, 0, iw, ih);

    const { data } = octx.getImageData(0,0,iw,ih);

    const step = (innerWidth < 768) ? 7 : 6;
    const cx = (W - iw) * 0.5;
    const cy = (H - ih) * 0.5;

    const pts = [];
    for(let y=0; y<ih; y+=step){
      for(let x=0; x<iw; x+=step){
        const i = (y*iw + x)*4;
        const a = data[i+3];
        if (a > 40){
          pts.push({ x: cx + x, y: cy + y });
        }
      }
    }
    targets = pts;

    // particles count: keep it smooth on phones
    const maxP = innerWidth < 768 ? 1200 : 2200;
    const n = Math.min(maxP, targets.length);

    particles = new Array(n).fill(0).map((_,k)=>({
      x: Math.random()*W,
      y: Math.random()*H,
      vx: 0,
      vy: 0,
      tx: targets[k].x,
      ty: targets[k].y,
      seed: Math.random()*1000
    }));
  }

  img.onload = () => {
    buildTargets();
  };

  // rebuild after resize so it stays centered
  window.addEventListener("resize", ()=>{
    if (img.complete && img.naturalWidth) buildTargets();
  });

  let t = 0;
  function draw(){
    t += 0.016;
    ctx.clearRect(0,0,W,H);

    // space fog
    const fog = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.min(W,H)*0.65);
    fog.addColorStop(0, "rgba(154,166,255,0.12)");
    fog.addColorStop(0.5, "rgba(124,242,255,0.06)");
    fog.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0,0,W,H);

    if (!particles.length){
      requestAnimationFrame(draw);
      return;
    }

    // wing shimmer: a soft pulse
    const pulse = 0.6 + 0.4*Math.sin(t*1.4);

    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "rgba(154,166,255,0.9)";
    ctx.shadowBlur = 10 * pulse;

    for(let i=0;i<particles.length;i++){
      const p = particles[i];
      const target = targets[i % targets.length];

      // interactive pull when holding/touching
      const mdx = pointer.x - p.x;
      const mdy = pointer.y - p.y;
      const md = Math.sqrt(mdx*mdx + mdy*mdy) + 1;
      const pull = pointer.down ? 0.020 : 0.008;

      // gentle flutter jitter
      const jx = Math.sin(t*2.2 + p.seed)*0.35*DPR;
      const jy = Math.cos(t*2.0 + p.seed)*0.35*DPR;

      p.vx += (target.x - p.x) * 0.010 + (mdx/md)*pull + jx*0.01;
      p.vy += (target.y - p.y) * 0.010 + (mdy/md)*pull + jy*0.01;
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;

      const a = 0.10 + 0.25*pulse;
      ctx.fillStyle = `rgba(180,190,255,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.25*DPR, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;

    requestAnimationFrame(draw);
  }
  draw();
})();
