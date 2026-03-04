(() => {
  // ===== STARFIELD CANVAS =====
  const stars = document.getElementById("stars");
  if (stars) {
    const ctx = stars.getContext("2d");
    let W=0,H=0,DPR=Math.max(1, Math.min(2, window.devicePixelRatio||1));
    const S=[];
    function resize(){
      W=innerWidth|0; H=innerHeight|0;
      stars.width=(W*DPR)|0; stars.height=(H*DPR)|0;
      ctx.setTransform(DPR,0,0,DPR,0,0);
      S.length=0;
      const count = Math.min(1200, Math.floor((W*H)/1800));
      for(let i=0;i<count;i++){
        S.push({
          x: Math.random()*W,
          y: Math.random()*H,
          z: Math.random()*1,
          r: Math.random()*1.6 + 0.2,
          a: Math.random()*0.9 + 0.05,
          vx: (Math.random()-0.5)*0.04,
          vy: (Math.random()-0.5)*0.04,
        });
      }
    }
    addEventListener("resize", resize);
    resize();

    function draw(){
      ctx.clearRect(0,0,W,H);

      // soft dark veil
      ctx.fillStyle="rgba(0,0,0,0.18)";
      ctx.fillRect(0,0,W,H);

      for(const s of S){
        s.x += s.vx;
        s.y += s.vy;
        if(s.x<0) s.x=W;
        if(s.x>W) s.x=0;
        if(s.y<0) s.y=H;
        if(s.y>H) s.y=0;

        const tw = 0.6 + Math.sin((performance.now()*0.002) + s.z*10)*0.4;
        ctx.fillStyle = `rgba(255,255,255,${s.a*tw})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ===== CURSOR TRAIL (works with mouse, touch, pen) =====
  const trailLayer = document.getElementById("cursorTrail");
  const dots = [];
  const DOTS = 22;
  for (let i=0;i<DOTS;i++){
    const d=document.createElement("div");
    d.style.position="fixed";
    d.style.width="10px";
    d.style.height="10px";
    d.style.borderRadius="999px";
    d.style.background="rgba(154,166,255,0.18)";
// periwinkle trail (galaxy)
    d.style.background = "radial-gradient(circle, rgba(180,190,255,0.55), rgba(154,166,255,0.14), transparent)";
    d.style.boxShadow = "0 0 18px rgba(154,166,255,0.20)";

    d.style.boxShadow="0 0 18px rgba(154,166,255,0.18)";
    d.style.pointerEvents="none";
    d.style.transform="translate(-999px,-999px)";
    d.style.zIndex="-1";
    trailLayer?.appendChild(d);
    dots.push({el:d, x:-999, y:-999});
  }

  let mx = innerWidth/2, my = innerHeight/2;
  addEventListener("pointermove",(e)=>{
    mx=e.clientX; my=e.clientY;
  });

  function animateTrail(){
    let x=mx, y=my;
    for(let i=0;i<dots.length;i++){
      const p=dots[i];
      p.x += (x - p.x) * 0.22;
      p.y += (y - p.y) * 0.22;
      p.el.style.transform = `translate(${p.x-5}px, ${p.y-5}px)`;
      p.el.style.opacity = String(0.9 - i*(0.9/dots.length));
      x = p.x; y = p.y;
    }
    requestAnimationFrame(animateTrail);
  }
  if (trailLayer) animateTrail();

  // ===== TILT CARDS =====
  const tilts = document.querySelectorAll(".tilt");
  tilts.forEach(el=>{
    el.addEventListener("pointermove",(e)=>{
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -10;
      const ry = (px - 0.5) *  12;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-1px)`;
      el.style.setProperty("--mx", (px*100)+"%");
      el.style.setProperty("--my", (py*100)+"%");
    });
    el.addEventListener("pointerleave",()=>{
      el.style.transform="";
    });
  });

  // ===== GALLERY MODAL =====
  const modal = document.getElementById("modal");
  if(modal){
    const img = document.getElementById("modalImg");
    const cap = document.getElementById("modalCap");
    document.querySelectorAll(".shot img").forEach(el=>{
      el.addEventListener("click",()=>{
        img.src = el.src;
        cap.textContent = el.closest("figure")?.querySelector("figcaption")?.textContent || "";
        modal.classList.add("show");
      });
    });
    modal.querySelectorAll("[data-close]").forEach(btn=>{
      btn.addEventListener("click",()=> modal.classList.remove("show"));
    });
    addEventListener("keydown",(e)=>{
      if(e.key==="Escape") modal.classList.remove("show");
    });
  }

  
  // ===== MUSIC (autoplay attempt + continue across pages) =====
  const bgm = document.getElementById("bgm");
  const MUSIC_KEY_PLAY = "gw_music_play";
  const MUSIC_KEY_TIME = "gw_music_time";

  async function tryPlay() {
    if (!bgm) return;
    try {
      await bgm.play();
      localStorage.setItem(MUSIC_KEY_PLAY, "1");
    } catch (e) {
      // Autoplay can be blocked until the user taps once. We'll retry on first interaction.
    }
  }

  if (bgm) {
    // restore time + play state
    const savedT = parseFloat(localStorage.getItem(MUSIC_KEY_TIME) || "0");
    if (isFinite(savedT) && savedT > 0) {
      try { bgm.currentTime = savedT; } catch {}
    }
    const shouldPlay = localStorage.getItem(MUSIC_KEY_PLAY) === "1";
    if (shouldPlay) tryPlay();

    // save current time while playing
    setInterval(() => {
      if (!bgm.paused) localStorage.setItem(MUSIC_KEY_TIME, String(bgm.currentTime || 0));
    }, 400);

    // minimal click-to-enable (no extra UI text)
    const enableOnce = () => {
      // if user interacts anywhere, we can start/resume music
      if (localStorage.getItem(MUSIC_KEY_PLAY) !== "1") {
        tryPlay();
      } else if (bgm.paused) {
        tryPlay();
      }
      window.removeEventListener("pointerdown", enableOnce);
      window.removeEventListener("touchstart", enableOnce);
      window.removeEventListener("keydown", enableOnce);
    };
    window.addEventListener("pointerdown", enableOnce, { once: true });
    window.addEventListener("touchstart", enableOnce, { once: true });
    window.addEventListener("keydown", enableOnce, { once: true });
  }
})();
