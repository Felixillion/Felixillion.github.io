/**
 * assets/js/hero.js
 * Hover backdrop animations for the three homepage subheadings.
 *
 * Bioinformagician  → fluorescence microscopy: FITC/DAPI/TRITC/CY5 particles + magic sparks
 * Composer of Worlds → 3-D rotating D&D dice (d4/d6/d8/d20) + abundant arcane/musical glyphs
 * Lover of Cats     → two cats that wander, sit and blink with warm amber ember glow
 */

(function () {
  'use strict';

  const backdrop = document.getElementById('hero-backdrop');
  const canvas   = document.getElementById('hero-canvas');
  if (!backdrop || !canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, currentTheme = null;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (currentTheme) INITS[currentTheme]?.();
  }
  window.addEventListener('resize', resize);
  resize();

  const show = () => {
    backdrop.style.opacity = '1';
    const t = document.getElementById('hero-title');
    if(t) t.style.opacity = '0.18';
  };
  const hide = () => {
    backdrop.style.opacity = '0';
    const t = document.getElementById('hero-title');
    if(t) t.style.opacity = '1';
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 1 — Bioinformagician  (magic particles + top hats + appearing bunnies)
  // ══════════════════════════════════════════════════════════════════════════
  const PALETTE = ['#39ff14','#38bdf8','#ff4136','#ff00ff','#ffffff','#fbbf24'];
  let particles=[], sparks=[], topHats=[], bunnies=[];

  function initBio() {
    particles=[]; sparks=[]; bunnies=[];
    const n=Math.min(100,Math.floor((W*H)/10000));
    for(let i=0;i<n;i++){
      particles.push({
        x:Math.random()*W, y:Math.random()*H,
        vx:(Math.random()-.5)*.35, vy:(Math.random()-.5)*.35,
        r:Math.random()*2.5+.5,
        color:PALETTE[Math.floor(Math.random()*PALETTE.length)],
        alpha:Math.random()*.55+.2,
        sparkCD:Math.floor(Math.random()*220+80),
      });
    }
    // 3–4 top hats drifting around
    topHats=Array.from({length:3+Math.floor(Math.random()*2)},()=>({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-.5)*.22, vy:(Math.random()-.5)*.18,
      angle:(Math.random()-.5)*.28,
      spin:(Math.random()-.5)*.005,
      sz:24+Math.random()*14,   // half-width of cylinder
      alpha:.78+Math.random()*.18,
      bunnyCD:Math.floor(Math.random()*320+180),
      frozen:false, // hat pauses while bunny is out
    }));
  }

  // ── Top hat helpers ─────────────────────────────────────────────────────────
  // Split into Back (just back brim) and Front (cylinder+crown+front brim) so
  // the bunny can be sandwiched in between: back-brim → bunny → front-hat.
  // This makes the bunny appear IN FRONT of the back brim but hidden inside
  // the cylinder, with the front brim lip naturally overlapping its edges.
  //
  // Constants (same in both halves — computed from sz):
  //   TW = sz             cylinder half-width
  //   TH = sz*2.4         cylinder height (crown at y=-TH, brim at y=0)
  //   BRX = sz*1.65       brim x-radius
  //   BRY = sz*0.26       brim ellipse y-radius
  //   CRY = sz*0.21       crown ellipse y-radius

  function drawTopHatBack(x,y,sz,angle,alpha){
    const TW=sz, BRX=sz*1.65, BRY=sz*0.26;
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(1,-1); // flip: crown→bottom, opening→top
    ctx.globalAlpha=alpha;
    // Back half of brim — now the UPPER arc (y<0 after flip = visual top)
    ctx.fillStyle='#12122a';
    ctx.beginPath(); ctx.ellipse(0,0,BRX,BRY,0,0,Math.PI); ctx.fill();
    ctx.restore();
  }

  function drawTopHatFront(x,y,sz,angle,alpha){
    const TW=sz, TH=sz*2.4, BRX=sz*1.65, BRY=sz*0.26, CRY=sz*0.21;
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(1,-1); // flip: crown→bottom, cylinder→below
    ctx.globalAlpha=alpha;

    // ── Cylinder body — horizontal shading + vertical top-light/bottom-dark ──
    // Pass 1: left/right shading
    const hGrad=ctx.createLinearGradient(-TW,0,TW,0);
    hGrad.addColorStop(0,'#07071a');
    hGrad.addColorStop(0.18,'#181838');
    hGrad.addColorStop(0.5,'#21214a');
    hGrad.addColorStop(0.82,'#181838');
    hGrad.addColorStop(1,'#07071a');
    ctx.fillStyle=hGrad;
    ctx.beginPath();
    ctx.moveTo(-TW,0); ctx.lineTo(-TW,-TH);
    ctx.bezierCurveTo(-TW,-TH-CRY*.5,TW,-TH-CRY*.5,TW,-TH);
    ctx.lineTo(TW,0); ctx.closePath();
    ctx.fill();
    // Pass 2: vertical top-lighter / bottom-darker overlay
    const vGrad=ctx.createLinearGradient(0,-TH,0,0);
    vGrad.addColorStop(0,'rgba(80,80,130,0.35)');   // top: lighter/bluer
    vGrad.addColorStop(0.55,'rgba(0,0,0,0)');
    vGrad.addColorStop(1,'rgba(0,0,0,0.55)');        // bottom: very dark — reinforces "mouth" of hat
    ctx.fillStyle=vGrad;
    ctx.beginPath();
    ctx.moveTo(-TW,0); ctx.lineTo(-TW,-TH);
    ctx.bezierCurveTo(-TW,-TH-CRY*.5,TW,-TH-CRY*.5,TW,-TH);
    ctx.lineTo(TW,0); ctx.closePath();
    ctx.fill();

    // ── Curved ribbon band — edges follow cylinder curvature ──
    const by1=-TH*0.29, by2=-TH*0.14, sag=CRY*0.9;
    const bGrad=ctx.createLinearGradient(-TW,0,TW,0);
    bGrad.addColorStop(0,'#3b1278'); bGrad.addColorStop(0.5,'#7c3aed'); bGrad.addColorStop(1,'#3b1278');
    ctx.fillStyle=bGrad;
    ctx.beginPath();
    ctx.moveTo(-TW,by1);
    ctx.quadraticCurveTo(0,by1-sag,  TW,by1);    // top edge bows upward (wraps around cylinder)
    ctx.lineTo(TW,by2);
    ctx.quadraticCurveTo(0,by2+sag, -TW,by2);    // bottom edge bows downward
    ctx.closePath();
    ctx.fill();
    // Ribbon highlight
    ctx.globalAlpha=alpha*0.4; ctx.strokeStyle='#a78bfa'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-TW,by1); ctx.quadraticCurveTo(0,by1-sag,TW,by1); ctx.stroke();

    // ── Crown top ──
    ctx.globalAlpha=alpha;
    // Top face fill — lighter so crown reads as the "closed" top
    const crownG=ctx.createRadialGradient(0,-TH,0,0,-TH,TW);
    crownG.addColorStop(0,'#2e2e60'); crownG.addColorStop(1,'#0d0d25');
    ctx.fillStyle=crownG;
    ctx.beginPath(); ctx.ellipse(0,-TH,TW,CRY,0,0,Math.PI*2); ctx.fill();
    // Crown rim stroke
    ctx.strokeStyle='#4a4a80'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.ellipse(0,-TH,TW,CRY,0,Math.PI,Math.PI*2); ctx.stroke();

    // ── Front half of brim (angles PI→2PI, canvas y<0 = front/top of ellipse) ──
    ctx.fillStyle='#1c1c3a';
    ctx.beginPath(); ctx.ellipse(0,0,BRX,BRY,0,Math.PI,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#3a3a6a'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(0,0,BRX,BRY,0,Math.PI,Math.PI*2); ctx.stroke();
    // Dark throat shadow (upper half only so it stays above brim, no "reflection" below)
    ctx.globalAlpha=alpha*0.45; ctx.fillStyle='#03030c';
    ctx.beginPath(); ctx.ellipse(0,0,TW*.9,CRY*.75,0,Math.PI,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  // ── Bunny ─────────────────────────────────────────────────────────────────
  //
  // HAT GEOMETRY (world/bunny-local space — NO scale flip applied here):
  //   drawTopHatFront/Back both apply ctx.scale(1,-1).
  //   After that flip, on screen:
  //     brim opening  = y=0   (the translate point h.x,h.y)
  //     cylinder body = y=0 → y=+TH  (goes DOWNWARD on screen)
  //     crown         = y=+TH (below brim on screen — closed end)
  //
  //   Bunny draw uses translate+rotate but NO scale flip, so in local coords:
  //     y < 0  =  ABOVE brim  (visible, upward on screen)
  //     y > 0  =  inside hat  (hidden by cylinder drawn in step 3)
  //
  //   Bunny emerges UPWARD: clip to y<0, ears first (most negative Y).
  //   emerge=0 → ear tips at y=0 (BY−sz*2.85=0  → BY= sz*2.85)
  //   emerge=1 → paws at y=0    (BY+sz*0.52=0  → BY=−sz*0.52)
  //   BY = sz*2.85 − emerge * sz*3.37
  //
  function drawBunnyLocal(sz, BY) {
    // ── Ears — most upward (most negative Y), appear first ───────────────────
    function drawEar(sign) {
      const ex = sign * sz * .32;
      ctx.fillStyle = '#ecdde4';
      ctx.beginPath();
      ctx.moveTo(ex,              BY - sz * 1.05);   // ear base at head top
      ctx.bezierCurveTo(
        ex + sign*sz*.28, BY - sz*1.55,
        ex + sign*sz*.22, BY - sz*2.55,
        ex,               BY - sz*2.85);             // tip — most upward, appear first
      ctx.bezierCurveTo(
        ex - sign*sz*.18, BY - sz*2.55,
        ex - sign*sz*.12, BY - sz*1.55,
        ex - sign*sz*.18, BY - sz*1.05);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f9a8c4';
      ctx.beginPath();
      ctx.moveTo(ex,               BY - sz*1.2);
      ctx.bezierCurveTo(ex+sign*sz*.14, BY-sz*1.6, ex+sign*sz*.10, BY-sz*2.4, ex, BY-sz*2.62);
      ctx.bezierCurveTo(ex-sign*sz*.10, BY-sz*2.4, ex-sign*sz*.06, BY-sz*1.6, ex-sign*sz*.10, BY-sz*1.2);
      ctx.closePath(); ctx.fill();
    }
    drawEar(-1); drawEar(1);

    // ── Head ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#ecdde4';
    ctx.beginPath(); ctx.arc(0, BY - sz*.82, sz*.68, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(-sz*.1, BY - sz*1.05, sz*.3, sz*.18, -.3, 0, Math.PI*2); ctx.fill();

    // ── Eyes ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#ff69b4';
    ctx.beginPath(); ctx.ellipse(-sz*.24, BY-sz*.88, sz*.145, sz*.13, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( sz*.24, BY-sz*.88, sz*.145, sz*.13, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.ellipse(-sz*.23, BY-sz*.88, sz*.068, sz*.092, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( sz*.23, BY-sz*.88, sz*.068, sz*.092, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(-sz*.20, BY-sz*.94, sz*.028, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( sz*.26, BY-sz*.94, sz*.028, 0, Math.PI*2); ctx.fill();

    // ── Nose + mouth ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#f4a0b5';
    ctx.beginPath();
    ctx.moveTo(0, BY-sz*.52);
    ctx.lineTo(-sz*.09, BY-sz*.58); ctx.lineTo(sz*.09, BY-sz*.58);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c87090'; ctx.lineWidth = sz*.042; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, BY-sz*.52);
    ctx.quadraticCurveTo(-sz*.12, BY-sz*.44, -sz*.16, BY-sz*.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, BY-sz*.52);
    ctx.quadraticCurveTo( sz*.12, BY-sz*.44,  sz*.16, BY-sz*.4); ctx.stroke();

    // ── Whiskers ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,225,235,.68)'; ctx.lineWidth = sz*.024;
    [[-1,0],[-1,1],[1,0],[1,1]].forEach(([s,row]) => {
      ctx.beginPath();
      ctx.moveTo(s*sz*.12, BY - sz*(.52+row*.08));
      ctx.lineTo(s*sz*.72, BY - sz*(.56+row*.10));
      ctx.stroke();
    });

    // ── Cheek blush ──────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,160,185,.3)';
    ctx.beginPath(); ctx.ellipse(-sz*.36, BY-sz*.78, sz*.2, sz*.13, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( sz*.36, BY-sz*.78, sz*.2, sz*.13, 0, 0, Math.PI*2); ctx.fill();

    // ── Body ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#ecdde4';
    ctx.beginPath(); ctx.ellipse(0, BY+sz*.08, sz*.52, sz*.68, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.ellipse(0, BY+sz*.06, sz*.28, sz*.36, 0, 0, Math.PI*2); ctx.fill();

    // ── Paws — least negative Y, last to leave hat opening ───────────────────
    function drawPaw(sign) {
      const px = sign*sz*.34, py = BY + sz*.52;
      ctx.fillStyle = '#e8ccd5';
      ctx.beginPath(); ctx.ellipse(px, py, sz*.19, sz*.12, sign*.25, 0, Math.PI*2); ctx.fill();
      for (let t = -1; t <= 1; t++) {
        ctx.fillStyle = '#e2c8d0';
        ctx.beginPath(); ctx.arc(px + sign*sz*.02 + t*sz*.07, py + sz*.09, sz*.055, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,140,160,0.4)';
      ctx.beginPath(); ctx.ellipse(px, py, sz*.09, sz*.06, sign*.15, 0, Math.PI*2); ctx.fill();
    }
    drawPaw(-1); drawPaw(1);
  }

  function stepBio() {
    ctx.fillStyle='rgba(2,8,24,0.22)'; ctx.fillRect(0,0,W,H);
    // Subtle magical radial
    const mg=ctx.createRadialGradient(W*.5,H*.48,0,W*.5,H*.48,Math.min(W,H)*.5);
    mg.addColorStop(0,'rgba(120,50,200,0.06)'); mg.addColorStop(1,'transparent');
    ctx.fillStyle=mg; ctx.fillRect(0,0,W,H);

    // Fluorescent particles + sparks
    for(const p of particles){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);
      g.addColorStop(0,p.color); g.addColorStop(.4,p.color+'66'); g.addColorStop(1,'transparent');
      ctx.globalAlpha=p.alpha; ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*5,0,Math.PI*2); ctx.fill();
      if(--p.sparkCD<=0){
        p.sparkCD=Math.floor(Math.random()*220+80);
        for(let j=0;j<6;j++){
          const a=(j/6)*Math.PI*2+Math.random()*.5, s=Math.random()*1.8+.5;
          sparks.push({x:p.x,y:p.y,color:p.color,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:Math.random()*.04+.025});
        }
      }
    }
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.vx*=.96; s.vy*=.96; s.life-=s.decay;
      if(s.life<=0){sparks.splice(i,1);continue;}
      ctx.globalAlpha=s.life*.9; ctx.strokeStyle=s.color; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*3,s.y-s.vy*3); ctx.stroke();
    }

    // ── Advance bunny state ─────────────────────────────────────────────────────
    for(let i=bunnies.length-1;i>=0;i--){
      const b=bunnies[i]; b.t+=.018;
      if(b.state==='rise'){
        b.emerge=Math.min(1,b.emerge+.02);
        if(b.emerge>=1&&b.t>1.4) b.state='hold';
      } else if(b.state==='hold'){
        if(b.t>3.8) b.state='fall';
      } else {
        b.emerge=Math.max(0,b.emerge-.025);
        if(b.emerge<=0){
          b.hat.frozen=false;
          b.hat.bunnyCD=280+Math.floor(Math.random()*280);
          bunnies.splice(i,1); continue;
        }
      }
    }

    // ── Advance hat positions ────────────────────────────────────────────────
    for(const h of topHats){
      if(!h.frozen){
        h.x+=h.vx; h.y+=h.vy; h.angle+=h.spin;
        if(h.x<-60)h.x=W+60; if(h.x>W+60)h.x=-60;
        if(h.y<-60)h.y=H+60; if(h.y>H+60)h.y=-60;
        h.bunnyCD--;
        if(h.bunnyCD<=0){
          h.frozen=true;
          bunnies.push({
            hat:h, sz:h.sz*.58,
            emerge:0, state:'rise', t:0,
            sparksBurst:Array.from({length:14},(_,k)=>{
              const a=(k/14)*Math.PI*2;
              return {vx:Math.cos(a)*(2+Math.random()*3), vy:Math.sin(a)*(2+Math.random()*3),
                      col:PALETTE[Math.floor(Math.random()*PALETTE.length)], life:1};
            }),
          });
        }
      }
    }

    // ── Draw order: back-brim → sparkles+bunny → hat-front ───────────────────
    // This ensures: back brim behind bunny, cylinder/front-brim in front.

    // 1) Back brim for every hat (behind everything)
    for(const h of topHats) drawTopHatBack(h.x,h.y,h.sz,h.angle,h.alpha);

    // 2) Sparkles + bunny — bunny emerges UPWARD through the brim opening (y=0).
    //    Clip to y<0 (above brim on screen). Cylinder (step 3) is at y>0 (below brim)
    //    so it naturally occludes any part of the bunny still inside the hat.
    //    emerge=0 → ear tips at y=0; emerge=1 → paws at y=0.
    for(const b of bunnies){
      const h=b.hat;
      // Sparkles radiate from brim centre (world: h.x, h.y)
      for(const sp of b.sparksBurst){
        if(sp.life>0){
          sp.life-=.014;
          ctx.globalAlpha=Math.max(0,sp.life*.6); ctx.fillStyle=sp.col;
          ctx.beginPath();
          ctx.arc(h.x+sp.vx*(1-sp.life)*42, h.y+sp.vy*(1-sp.life)*42, 1.8, 0, Math.PI*2);
          ctx.fill();
        }
      }
      // BY: emerge=0 → ear tips at brim (BY−sz*2.85=0 → BY=sz*2.85)
      //     emerge=1 → paws at brim    (BY+sz*0.52=0 → BY=−sz*0.52)
      const BY = b.sz*2.85 - b.emerge*b.sz*3.37;
      ctx.save();
      ctx.translate(h.x,h.y); ctx.rotate(h.angle);
      ctx.globalAlpha=Math.min(1,b.emerge*2.2);
      // Clip: only show y < 0 (strictly above brim opening)
      ctx.beginPath(); ctx.rect(-5000,-5000,10000,5000); ctx.clip();
      drawBunnyLocal(b.sz, BY);
      ctx.restore();
    }

    // 3) Hat front (cylinder occludes bunny inside; front-brim lip overlaps bunny edge)
    for(const h of topHats) drawTopHatFront(h.x,h.y,h.sz,h.angle,h.alpha);
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 2 — Composer of Worlds
  //  3-D rotating D&D dice + abundant arcane / musical glyphs drifting around
  // ══════════════════════════════════════════════════════════════════════════

  // 3-D rotation helpers (operate on arrays of [x,y,z] triples)
  const rotX = (pts,a) => { const c=Math.cos(a),s=Math.sin(a); return pts.map(([x,y,z])=>[x,c*y-s*z,s*y+c*z]); };
  const rotY = (pts,a) => { const c=Math.cos(a),s=Math.sin(a); return pts.map(([x,y,z])=>[c*x+s*z,y,-s*x+c*z]); };
  const rotZ = (pts,a) => { const c=Math.cos(a),s=Math.sin(a); return pts.map(([x,y,z])=>[c*x-s*y,s*x+c*y,z]); };
  const proj = (pts,fov,cx,cy) => pts.map(([x,y,z])=>{ const d=fov/(fov-z); return [cx+x*d,cy+y*d,z]; });

  function makeDiceTemplates() {
    // d6 — cube (fov=360 to reduce perspective keystoning on quads)
    const s=22;
    const d6v=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];
    const d6f=[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];

    // d4 — FIXED regular tetrahedron.
    // Bug was phi=atan(√2)≈54.7° making a non-equilateral shape (edge v0-v1 ≈49.7 vs base ≈39.6).
    // Correct: base vertices at y = +r/3, radius ρ = r·2√2/3 → all edges equal r·2√(2/3) ≈ 45.7.
    const r4=28;
    const rho4=r4*2*Math.SQRT2/3;   // base-vertex radius ≈ 26.40
    const yb4=r4/3;                  // base y ≈ 9.33 (downward in screen space)
    const d4v=[
      [0, -r4, 0],                                                            // apex (upward on screen)
      [rho4,                           yb4, 0                              ],  // base v1
      [rho4*Math.cos(2*Math.PI/3),     yb4, rho4*Math.sin(2*Math.PI/3)   ],  // base v2
      [rho4*Math.cos(4*Math.PI/3),     yb4, rho4*Math.sin(4*Math.PI/3)   ],  // base v3
    ];
    const d4f=[[0,1,2],[0,2,3],[0,3,1],[1,3,2]];

    // d8 — octahedron (unchanged, all-triangular, works correctly)
    const r8=28;
    const d8v=[[r8,0,0],[-r8,0,0],[0,r8,0],[0,-r8,0],[0,0,r8],[0,0,-r8]];
    const d8f=[[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]];

    // d20 — icosahedron (unchanged, all-triangular, works correctly)
    const G=(1+Math.sqrt(5))/2, r20=24;
    const rawI=[[-1,G,0],[1,G,0],[-1,-G,0],[1,-G,0],[0,-1,G],[0,1,G],[0,-1,-G],[0,1,-G],[G,0,-1],[G,0,1],[-G,0,-1],[-G,0,1]];
    const d20v=rawI.map(v=>{const l=Math.hypot(...v);return v.map(x=>x/l*r20);});
    const d20f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];

    // d10 — pentagonal bipyramid, pole axis along Z (not Y).
    // Y-axis poles caused a "flat moment" where the equatorial ring went edge-on to the camera.
    // Z-axis poles: initial camera view sees a proper pentagon; rotations are always interesting.
    // Winding: back [0,k,j] → n_z = r10²·sin(-72°)<0 ✓  front [1,j,k] → n_z = r10²·sin(+72°)>0 ✓
    const r10=18, h10=34; // elongated: pole:equator ≈ 1.9:1 like a real d10
    const d10v=[[0,0,-h10],[0,0,+h10]]; // v0=back pole, v1=front pole
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5; d10v.push([r10*Math.cos(a),r10*Math.sin(a),0]);}
    // v2-6: equatorial ring in XY plane at z=0
    const d10f=[];
    for(let i=0;i<5;i++){
      const j=2+i, k=2+(i+1)%5;
      d10f.push([0,k,j]); // back cap
      d10f.push([1,j,k]); // front cap
    }

    return [
      {verts:d6v,  faces:d6f,  color:'#a78bfa', label:'d6',  fov:2000},
      {verts:d4v,  faces:d4f,  color:'#38bdf8', label:'d4',  fov:160},
      {verts:d8v,  faces:d8f,  color:'#f59e0b', label:'d8',  fov:160},
      {verts:d20v, faces:d20f, color:'#4ade80', label:'d20', fov:160},
      {verts:d10v, faces:d10f, color:'#fb923c', label:'d10', fov:160},
    ];
  }

  const GLYPHS='⚔🗡✦◈⬡♪♫✧⟡⬟☽★◉⌬⌖♞⚡∞⚜Ω∆ΣΛΦΨд☆⊕⊗⊛❖✺◊⬠⬡⌘⎈⚹⚳⚵⎊⎋⚑✵⊹⊸⋮'.split('').filter(c=>c.trim());
  let diceObjs=[], glyphObjs=[], dragonObj=null, fireParticles=[], compTime=0;

  function initComposer() {
    compTime=0;
    const tmpls = makeDiceTemplates();
    // Place 7 dice scattered across the canvas
    const spots=[
      [.12,.28],[.82,.18],[.42,.72],[.72,.62],[.22,.75],[.88,.52],[.55,.14],[.65,.38],
    ];
    diceObjs = spots.map((pos,i)=>{
      const t=tmpls[i%tmpls.length];
      return {
        verts:t.verts, faces:t.faces, color:t.color, label:t.label,
        cx:pos[0]*W, cy:pos[1]*H,
        // drift: each die wanders slowly around its home position
        hx:pos[0]*W, hy:pos[1]*H,      // home position
        dvx:(Math.random()-.5)*.35,     // drift velocity x
        dvy:(Math.random()-.5)*.25,     // drift velocity y
        driftPhase:Math.random()*Math.PI*2,
        driftSpd:.004+Math.random()*.003,
        rx:Math.random()*Math.PI*2, ry:Math.random()*Math.PI*2, rz:Math.random()*Math.PI*2,
        drx:(Math.random()-.5)*.014+.005, dry:(Math.random()-.5)*.014+.007, drz:(Math.random()-.5)*.008,
        bdrx:(Math.random()-.5)*.014+.005, bdry:(Math.random()-.5)*.014+.007, bdrz:(Math.random()-.5)*.008,
        spinMult:1.0, spinHoldT:0, // fire boosts spinMult; holdT prevents premature decay
        scale:.65+Math.random()*.7, fov:t.fov||160,
      };
    });
    // Dragon init
    dragonObj={x:W*.12,y:H*.45,vx:.4,vy:.2,ang:0,flapPh:0,targetIdx:0,state:'hunt',breathT:0,cooldown:0};
    fireParticles=[];
    // 32 glyphs drifting
    glyphObjs = Array.from({length:32},()=>({
      g: GLYPHS[Math.floor(Math.random()*GLYPHS.length)],
      x:Math.random()*W, y:Math.random()*H,
      sz:10+Math.random()*24,
      vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.14,
      alpha:.08+Math.random()*.22,
      phase:Math.random()*Math.PI*2, pspd:.3+Math.random()*.5,
    }));
  }

  function drawDie(die) {
    let pts = die.verts.map(v=>v.map(x=>x*die.scale));
    pts = rotX(pts,die.rx); pts = rotY(pts,die.ry); pts = rotZ(pts,die.rz);
    const p = proj(pts, die.fov, die.cx, die.cy);

    // Sort faces back-to-front by average z (painter's algorithm — no back-face culling)
    // Back-face culling caused quads to "break apart" when the cross product flipped
    // mid-rotation. Using painter's algorithm alone is correct for convex polyhedra.
    const sorted = die.faces
      .map(f=>({f, z:f.reduce((s,i)=>s+p[i][2],0)/f.length}))
      .sort((a,b)=>a.z-b.z);

    for (const {f,z} of sorted) {
      const poly = f.map(i=>[p[i][0],p[i][1]]);
      // Compute signed area to determine face visibility
      let area=0;
      for(let i=0;i<poly.length;i++){
        const j=(i+1)%poly.length;
        area+=(poly[j][0]-poly[i][0])*(poly[j][1]+poly[i][1]);
      }
      if(area>0) continue; // back face — skip (signed area > 0 means CCW in screen space = back)
      const br = Math.min(1,Math.max(.15,(z+80)/120));
      ctx.beginPath(); ctx.moveTo(poly[0][0],poly[0][1]);
      for (let i=1;i<poly.length;i++) ctx.lineTo(poly[i][0],poly[i][1]);
      ctx.closePath();
      const hex=Math.floor(br*75+35).toString(16).padStart(2,'0');
      ctx.fillStyle=die.color+hex; ctx.fill();
      ctx.strokeStyle=die.color+'cc'; ctx.lineWidth=1; ctx.stroke();
    }
  }

  function drawDragon(d) {
    ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.ang);
    const bob=Math.sin(d.flapPh)*2.0; // gentle — keeps wings firmly attached
    const twag=Math.sin(d.flapPh*.6)*12;

    // ── Tail: long sinuous, three-segment bezier ──
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle='#5b21b6'; ctx.lineWidth=9;
    ctx.beginPath();
    ctx.moveTo(-18,6);
    ctx.bezierCurveTo(-38,14+twag,-60,twag*0.4,-72,twag-8);
    ctx.stroke();
    ctx.strokeStyle='#4c1d95'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(-72,twag-8);
    ctx.bezierCurveTo(-85,twag-16,-90,twag-24,-86,twag-30); ctx.stroke();
    // Spade tip
    ctx.fillStyle='#7c3aed';
    ctx.beginPath(); ctx.moveTo(-86,twag-30); ctx.lineTo(-95,twag-38);
    ctx.lineTo(-80,twag-28); ctx.lineTo(-84,twag-22);
    ctx.bezierCurveTo(-80,twag-27,-95,twag-38,-86,twag-30); ctx.fill();

    // ── Dorsal spines ──
    ctx.fillStyle='#a78bfa';
    [[-10,-15,-6,-25],[-4,-17,0,-27],[2,-16,6,-26],[10,-13,13,-22]].forEach(([bx,by,tx,ty])=>{
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(tx-2,ty); ctx.lineTo(tx+2,ty+2); ctx.closePath(); ctx.fill();
    });

    // ── Back wing — root cp FIXED, only outer tip region flaps ──
    const bw=bob*0.4;  // tip moves at 40% of already-small bob
    ctx.globalAlpha=.68; ctx.fillStyle='#3b0764';
    ctx.beginPath();
    ctx.moveTo(-8,-4);                           // root — FIXED
    ctx.bezierCurveTo(-20,-24,-8,-50+bw*.5,2,-48+bw);   // root cp fixed(-20,-24), tip moves
    ctx.bezierCurveTo(8,-44+bw,12,-33+bw*.3,15,-25+bw*.1); // grad to 0 near trailing edge
    ctx.bezierCurveTo(17,-15,12,-6,4,-5);        // trailing fully fixed near body
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#4c1d95'; ctx.lineWidth=.8; ctx.globalAlpha=.5;
    [[-8,-4,2,-48+bw],[4,-5,12,-35+bw*.4],[-4,-8,10,-26+bw*.2]].forEach(([x0,y0,x1,y1])=>{
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    });

    // ── Body: sinuous serpentine, two overlapping ellipses ──
    ctx.globalAlpha=.95;
    ctx.fillStyle='#6d28d9';
    ctx.beginPath(); ctx.ellipse(-6,6,22,12,.18,0,Math.PI*2); ctx.fill();
    // Belly lighter
    ctx.fillStyle='#8b5cf6';
    ctx.beginPath(); ctx.ellipse(-4,10,15,6,.18,0,Math.PI*2); ctx.fill();

    // ── Leg (front, visible) ──
    ctx.fillStyle='#5b21b6'; ctx.strokeStyle='#4c1d95'; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(2,14); ctx.bezierCurveTo(6,22,14,26,16,20); ctx.stroke();
    // Claws
    ctx.strokeStyle='#c4b5fd'; ctx.lineWidth=1.2;
    [[16,20,20,14],[16,20,22,20],[16,20,18,26]].forEach(([x0,y0,x1,y1])=>{
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    });

    // ── Neck: tapering S-curve ──
    ctx.fillStyle='#7c3aed';
    ctx.beginPath();
    ctx.moveTo(10,-4); ctx.bezierCurveTo(18,-8,26,-6,30,-10);
    ctx.bezierCurveTo(32,-12,30,-16,28,-14);
    ctx.bezierCurveTo(24,-10,18,-12,12,0);
    ctx.closePath(); ctx.fill();
    // Neck scale suggestion
    ctx.strokeStyle='#9155f5'; ctx.lineWidth=.7; ctx.globalAlpha=.6;
    ctx.beginPath(); ctx.moveTo(14,-2); ctx.bezierCurveTo(22,-7,28,-9,28,-13); ctx.stroke();

    // ── Head: triangular reptilian silhouette ──
    ctx.globalAlpha=.95; ctx.fillStyle='#7c3aed';
    ctx.beginPath();
    ctx.moveTo(26,-14);          // back of skull
    ctx.bezierCurveTo(30,-22,38,-20,44,-16);  // top of skull
    ctx.bezierCurveTo(52,-12,58,-6,60,-4);    // snout top
    ctx.bezierCurveTo(60,2,56,6,50,6);        // lower jaw tip
    ctx.bezierCurveTo(44,8,36,6,30,2);        // lower jaw back
    ctx.bezierCurveTo(26,0,24,-8,26,-14);     // back of lower skull
    ctx.closePath(); ctx.fill();
    // Jaw lower (lighter)
    ctx.fillStyle='#6d28d9';
    ctx.beginPath();
    ctx.moveTo(30,2); ctx.bezierCurveTo(38,6,48,8,50,6);
    ctx.bezierCurveTo(54,4,58,0,60,-4);
    ctx.bezierCurveTo(58,-2,52,2,48,4);
    ctx.bezierCurveTo(42,6,34,4,30,2); ctx.closePath(); ctx.fill();

    // ── Horns ──
    ctx.fillStyle='#c4b5fd';
    ctx.beginPath(); ctx.moveTo(30,-14); ctx.lineTo(26,-30); ctx.lineTo(34,-16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(37,-18); ctx.lineTo(36,-30); ctx.lineTo(42,-19); ctx.closePath(); ctx.fill();

    // ── Eye: vertical slit pupil ──
    ctx.fillStyle='#fbbf24';
    ctx.beginPath(); ctx.ellipse(36,-12,5,4,-.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1c0a00';
    ctx.beginPath(); ctx.ellipse(36.5,-12,1.8,3.5,-.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(35,-13.5,.9,0,Math.PI*2); ctx.fill();

    // ── Nostril ──
    ctx.fillStyle='#4c1d95';
    ctx.beginPath(); ctx.ellipse(57,-2,2.5,1.5,.3,0,Math.PI*2); ctx.fill();

    // ── Front wing — root FIXED at (4,-6); adjacent cps also fixed; only tips move ──
    ctx.globalAlpha=.82; ctx.fillStyle='#5b21b6';
    const fy=bob;
    ctx.beginPath();
    ctx.moveTo(4,-6);                             // root — FIXED always
    ctx.bezierCurveTo(5,-20,12,-39+fy*.4,19,-41+fy);    // 1st finger: root cp (5,-20) fixed
    ctx.bezierCurveTo(23,-39+fy,23,-30+fy*.4,21,-23+fy*.15); // 1st tip trailing, fades to 0
    ctx.bezierCurveTo(25,-27+fy*.2,31,-37+fy*.8,36,-36+fy);  // 2nd finger tip
    ctx.bezierCurveTo(38,-32+fy*.7,34,-19+fy*.2,29,-14+fy*.05); // 2nd trailing, nearly fixed
    ctx.bezierCurveTo(31,-17+fy*.1,35,-24+fy*.4,37,-21+fy*.6);  // 3rd finger
    ctx.bezierCurveTo(39,-15+fy*.2,33,-6,25,-4);    // 3rd trailing: root-adjacent → fixed
    ctx.bezierCurveTo(17,-2,10,-4,4,-6);             // close back to root — all FIXED
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#7c3aed'; ctx.lineWidth=1; ctx.globalAlpha=.55;
    [[4,-6,19,-41+fy],[4,-6,36,-36+fy],[4,-6,37,-21+fy*.6]].forEach(([x0,y0,x1,y1])=>{
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    });

    // ── Fire glow at nostril when breathing ──
    if(d.state==='breathe'){
      ctx.globalAlpha=.9; ctx.fillStyle='#fbbf24';
      ctx.beginPath(); ctx.arc(60,-2,5,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=.3;
      const fg=ctx.createRadialGradient(60,-2,0,60,-2,16);
      fg.addColorStop(0,'#fbbf24'); fg.addColorStop(1,'transparent');
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(60,-2,16,0,Math.PI*2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha=1;
  }

  function updateDragon() {
    if(!dragonObj||diceObjs.length===0) return;
    const d=dragonObj;
    d.flapPh+=.1; d.cooldown=Math.max(0,d.cooldown-1);
    const tgt=diceObjs[d.targetIdx%diceObjs.length];
    const dx=tgt.cx-d.x, dy=tgt.cy-d.y, dist=Math.hypot(dx,dy);
    if(d.state==='hunt'){
      const tA=Math.atan2(dy,dx);
      let da=tA-d.ang; while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
      d.ang+=da*.06;
      d.vx+=Math.cos(d.ang)*.09; d.vy+=Math.sin(d.ang)*.065;
      const spd=Math.hypot(d.vx,d.vy); if(spd>2.2){d.vx=d.vx/spd*2.2; d.vy=d.vy/spd*2.2;}
      d.x+=d.vx; d.y+=d.vy;
      d.x=Math.max(65,Math.min(W-65,d.x)); d.y=Math.max(65,Math.min(H-65,d.y));
      if(dist<140&&d.cooldown===0){d.state='breathe'; d.breathT=90;}
      if(Math.random()<.004) d.targetIdx=Math.floor(Math.random()*diceObjs.length);
    } else {
      d.breathT--; d.vx*=.91; d.vy*=.91; d.x+=d.vx; d.y+=d.vy;
      const tA=Math.atan2(dy,dx);
      let da=tA-d.ang; while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
      d.ang+=da*.09;
      const snx=d.x+Math.cos(d.ang)*56, sny=d.y+Math.sin(d.ang)*56;
      for(let i=0;i<3;i++){
        const sp=(Math.random()-.5)*.42;
        const fA=Math.atan2(dy,dx)+sp, fSpd=3.5+Math.random()*3;
        fireParticles.push({
          x:snx+(Math.random()-.5)*6, y:sny+(Math.random()-.5)*6,
          vx:Math.cos(fA)*fSpd, vy:Math.sin(fA)*fSpd,
          life:1.0, decay:.028+Math.random()*.025, r:5+Math.random()*7,
          col:Math.random()<.38?'#fbbf24':(Math.random()<.55?'#f97316':'#ef4444'),
        });
      }
      tgt.spinMult = Math.min(tgt.spinMult + 0.35, 14.0); // fire boosts spin
      tgt.spinHoldT = Math.max(tgt.spinHoldT, 110); // hold fast for ~1.8s before decaying
      if(d.breathT<=0){d.state='hunt'; d.cooldown=130; d.targetIdx=(d.targetIdx+1)%diceObjs.length;}
    }
  }

  function stepFireParticles() {
    for(let i=fireParticles.length-1;i>=0;i--){
      const p=fireParticles[i];
      p.x+=p.vx; p.y+=p.vy; p.vy+=.05; p.life-=p.decay; p.r*=.96;
      if(p.life<=0||p.r<.6){fireParticles.splice(i,1); continue;}
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
      g.addColorStop(0,p.col+'ff'); g.addColorStop(.55,p.col+'55'); g.addColorStop(1,'transparent');
      ctx.globalAlpha=p.life*.85; ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function stepComposer() {
    compTime += .012;
    ctx.fillStyle='rgba(15,5,35,0.28)'; ctx.fillRect(0,0,W,H);
    // Central purple radial
    const rg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.min(W,H)*.6);
    rg.addColorStop(0,'rgba(139,92,246,0.1)'); rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);

    for (const d of diceObjs) {
      // Drift: sinusoidal wandering around home position
      d.driftPhase += d.driftSpd;
      d.cx = d.hx + Math.sin(d.driftPhase) * 80;
      d.cy = d.hy + Math.cos(d.driftPhase * 0.7) * 50;
      // Wrap if home position is now off screen (e.g. after resize)
      if(d.cx < -60) d.cx = W + 60;
      if(d.cx > W+60) d.cx = -60;

      // Hold at boosted spin for spinHoldT frames, then exponential ease-out
      if(d.spinHoldT>0){ d.spinHoldT--; }
      else { d.spinMult = 1 + (d.spinMult-1)*.988; } // slower decay ~5-6s
      const sm = d.spinMult;
      d.rx+=d.bdrx*sm; d.ry+=d.bdry*sm; d.rz+=d.bdrz*sm;
      d.drx=d.bdrx*sm; d.dry=d.bdry*sm; d.drz=d.bdrz*sm;
      ctx.globalAlpha=.88; drawDie(d);
    }

    // Dragon + fire breath
    ctx.globalAlpha=1; updateDragon(); stepFireParticles();
    if(dragonObj){ctx.globalAlpha=.95; drawDragon(dragonObj); ctx.globalAlpha=1;}

    ctx.globalAlpha=1; ctx.fillStyle='#c084fc';
    for (const g of glyphObjs) {
      g.x+=g.vx; g.y+=g.vy;
      if(g.x<-30)g.x=W+30; if(g.x>W+30)g.x=-30;
      if(g.y<-30)g.y=H+30; if(g.y>H+30)g.y=-30;
      const a=g.alpha+Math.sin(compTime*g.pspd+g.phase)*.08;
      ctx.globalAlpha=Math.max(.03,a);
      ctx.font=`${g.sz}px serif`; ctx.fillText(g.g,g.x,g.y);
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 3 — Lover of Cats
  //  Two cats wander, sit, and blink. Warm ember glow background.
  // ══════════════════════════════════════════════════════════════════════════

  const EMBER=[
    {xF:.25,yF:.45,r:220,col:'#f59e0b',ph:0.0,sp:.55},
    {xF:.72,yF:.60,r:170,col:'#ef4444',ph:1.1,sp:.40},
    {xF:.50,yF:.30,r:190,col:'#f97316',ph:2.3,sp:.65},
    {xF:.15,yF:.70,r:130,col:'#fbbf24',ph:0.7,sp:.35},
    {xF:.85,yF:.35,r:140,col:'#dc2626',ph:1.9,sp:.50},
  ];

  function makeCat(x,y,scale,col,spd) {
    return {
      x,y,tx:x,ty:y,scale,col,spd,dir:1,
      state:'sit', stateT:0, stateLen:Math.random()*180+80,
      walk:0, tailPh:Math.random()*Math.PI*2,
      blinkT:Math.floor(Math.random()*150+60), blinking:false,
    };
  }

  let cats=[], catTime=0, yarn=null, fishObjs=[];

  function initCats() {
    catTime=0;
    yarn={
      x:W*.5, y:H*.5,
      vx:(Math.random()-.5)*2.4, vy:(Math.random()-.5)*2.4,
      trail:[], maxTrail:55, r:12,
    };
    cats=[
      makeCat(W*.28,H*.62,1.3,'#e8a82e',.9),
      makeCat(W*.68,H*.58,1.0,'#c07a40',.7),
    ];
    fishObjs=Array.from({length:4},(_,i)=>({
      x: Math.random()*W, y: H*.15+Math.random()*H*.55,
      vx: (Math.random()<.5?-1:1)*(.35+Math.random()*.35),
      waveOff: Math.random()*Math.PI*2,
      sz: 8+Math.random()*7,
      col: ['#fb923c','#38bdf8','#f59e0b','#f472b6'][i%4],
      tailPh: 0,
    }));
  }

  function updateYarn() {
    yarn.x+=yarn.vx; yarn.y+=yarn.vy;
    if(yarn.x<yarn.r){yarn.x=yarn.r; yarn.vx=Math.abs(yarn.vx);}
    if(yarn.x>W-yarn.r){yarn.x=W-yarn.r; yarn.vx=-Math.abs(yarn.vx);}
    if(yarn.y<yarn.r){yarn.y=yarn.r; yarn.vy=Math.abs(yarn.vy);}
    if(yarn.y>H-yarn.r){yarn.y=H-yarn.r; yarn.vy=-Math.abs(yarn.vy);}
    yarn.vx*=.997; yarn.vy*=.997;
    if(Math.hypot(yarn.vx,yarn.vy)<.4){yarn.vx+=(Math.random()-.5)*.5; yarn.vy+=(Math.random()-.5)*.5;}
    for(const cat of cats){
      const dx=yarn.x-cat.x, dy=yarn.y-cat.y, dist=Math.hypot(dx,dy);
      if(dist<95&&dist>0){
        const kick=((95-dist)/95)*9;
        yarn.vx+=(dx/dist)*kick; yarn.vy+=(dy/dist)*kick;
        const capped=Math.hypot(yarn.vx,yarn.vy);
        if(capped>6){yarn.vx=yarn.vx/capped*6; yarn.vy=yarn.vy/capped*6;}
      }
    }
    yarn.trail.push({x:yarn.x,y:yarn.y});
    if(yarn.trail.length>yarn.maxTrail)yarn.trail.shift();
  }

  function drawYarn() {
    if(yarn.trail.length>1){
      for(let i=1;i<yarn.trail.length;i++){
        const f=i/yarn.trail.length;
        ctx.globalAlpha=f*.42; ctx.strokeStyle='#f97316';
        ctx.lineWidth=1.4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(yarn.trail[i-1].x,yarn.trail[i-1].y);
        ctx.lineTo(yarn.trail[i].x,yarn.trail[i].y); ctx.stroke();
      }
    }
    ctx.globalAlpha=.92; ctx.fillStyle='#f97316';
    ctx.beginPath(); ctx.arc(yarn.x,yarn.y,yarn.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fbd38d'; ctx.lineWidth=1.1;
    for(let a=0;a<Math.PI;a+=Math.PI/4){
      ctx.globalAlpha=.6;
      ctx.beginPath(); ctx.arc(yarn.x,yarn.y,yarn.r*.72,a-.5,a+.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(yarn.x,yarn.y,yarn.r*.4,a+.2,a+.85); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  function updateCat(cat) {
    cat.tailPh+=.04;
    cat.stateT++;
    cat.blinkT--;
    if (cat.blinkT<=0) {
      cat.blinking=!cat.blinking;
      cat.blinkT=cat.blinking?6:Math.floor(Math.random()*160+60);
    }
    if (cat.stateT>=cat.stateLen) {
      cat.stateT=0;
      const r=Math.random();
      if (r<.45) {
        cat.state='walk'; cat.stateLen=Math.random()*160+60;
        if(yarn&&Math.random()<.72){cat.tx=yarn.x; cat.ty=yarn.y;}
        else{cat.tx=80+Math.random()*(W-160); cat.ty=H*.38+Math.random()*(H*.48);}
      } else { cat.state=r<.75?'sit':'look'; cat.stateLen=Math.random()*200+100; }
    }
    if(cat.state==='walk'&&yarn&&Math.random()<.06&&Math.hypot(yarn.x-cat.x,yarn.y-cat.y)<280){
      cat.tx=yarn.x; cat.ty=yarn.y;
    }
    if (cat.state==='walk') {
      const dx=cat.tx-cat.x, dy=cat.ty-cat.y, dist=Math.hypot(dx,dy);
      if (dist>3) {
        cat.x+=dx/dist*cat.spd; cat.y+=dy/dist*cat.spd*.5;
        cat.dir=dx>0?1:-1; cat.walk+=.18;
      } else { cat.state='sit'; cat.stateLen=200; cat.stateT=0; }
    }
  }

  function drawFish(f) {
    const dir=f.vx>0?1:-1;
    const tail=Math.sin(f.tailPh)*f.sz*.55;
    ctx.save(); ctx.translate(f.x,f.y); ctx.scale(dir,1);
    ctx.globalAlpha=.38;
    // Body
    ctx.fillStyle=f.col;
    ctx.beginPath(); ctx.ellipse(0,0,f.sz,f.sz*.55,0,0,Math.PI*2); ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-f.sz*.85,0);
    ctx.lineTo(-f.sz*1.55,-f.sz*.6+tail);
    ctx.lineTo(-f.sz*1.55,f.sz*.6+tail);
    ctx.closePath(); ctx.fill();
    // Eye
    ctx.globalAlpha=.5; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(f.sz*.42,-f.sz*.1,f.sz*.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1c1917';
    ctx.beginPath(); ctx.arc(f.sz*.48,-f.sz*.1,f.sz*.09,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }


  function drawCat(cat) {
    const {x,y,scale,col,dir,blinking,walk,state,tailPh}=cat;
    ctx.save(); ctx.translate(x,y); ctx.scale(dir*scale,scale);

    // Ground shadow
    ctx.save(); ctx.scale(1,.22); ctx.translate(0,6);
    ctx.beginPath(); ctx.ellipse(0,64,26,9,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fill(); ctx.restore();

    // Tail
    const tw=Math.sin(tailPh)*20;
    ctx.beginPath(); ctx.moveTo(-5,22);
    ctx.bezierCurveTo(-38,12,-54,tw-28,-48,tw-54);
    ctx.strokeStyle=col; ctx.lineWidth=7; ctx.lineCap='round'; ctx.stroke();

    // Dark shadow glow so cats pop against the warm amber ember background
    ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=20;
    // Body
    const bob=state==='walk'?Math.sin(walk)*2.5:0;
    ctx.beginPath(); ctx.ellipse(0,20+bob,21,27,0,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(0,-19+bob,19,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.shadowColor='transparent'; ctx.shadowBlur=0;

    // Ears + inner
    [['-13,-35','-23,-56','-1,-37'],['13,-35','23,-56','1,-37']].forEach(([a,b,c])=>{
      const pts=[a,b,c].map(s=>s.split(',').map(Number));
      ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]+bob); ctx.lineTo(pts[1][0],pts[1][1]+bob); ctx.lineTo(pts[2][0],pts[2][1]+bob); ctx.closePath();
      ctx.fillStyle=col; ctx.fill();
      ctx.save();
      ctx.translate((pts[0][0]+pts[2][0])/2,(pts[0][1]+pts[2][1])/2+bob); ctx.scale(.55,.55);
      ctx.translate(-(pts[0][0]+pts[2][0])/2,-(pts[0][1]+pts[2][1])/2-bob);
      ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]+bob); ctx.lineTo(pts[1][0],pts[1][1]+bob); ctx.lineTo(pts[2][0],pts[2][1]+bob); ctx.closePath();
      ctx.fillStyle='#f4a9b4'; ctx.fill(); ctx.restore();
    });

    // Eyes
    const ey=-21+bob;
    if (!blinking) {
      ctx.fillStyle='#fffbe8';
      ctx.beginPath(); ctx.ellipse(-7,ey,5,4,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( 7,ey,5,4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2d1b0e';
      ctx.beginPath(); ctx.ellipse(-7,ey,2.2,3.2,.15,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( 7,ey,2.2,3.2,-.15,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(-6,ey-1.5,1.1,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( 8,ey-1.5,1.1,0,Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle='#3a2010'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-12,ey); ctx.lineTo(-2,ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 2,ey);  ctx.lineTo(12,ey);  ctx.stroke();
    }

    // Nose + whiskers
    ctx.fillStyle='#e07070';
    ctx.beginPath(); ctx.moveTo(0,-13+bob); ctx.lineTo(-3,-10+bob); ctx.lineTo(3,-10+bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.45)'; ctx.lineWidth=1;
    [[-20,-11],[-20,-8],[14,-11],[14,-8]].forEach(([wx,wy])=>{
      ctx.beginPath(); ctx.moveTo(wx>0?3:-3,wy+bob); ctx.lineTo(wx,wy+bob+(wx>0?1:-1)); ctx.stroke();
    });

    // Front legs (visible when walking)
    if (state==='walk') {
      const ls=Math.sin(walk)*13;
      ctx.strokeStyle=col; ctx.lineWidth=9; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-9,41+bob); ctx.lineTo(-11+ls,64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 9,41+bob); ctx.lineTo( 11-ls,64); ctx.stroke();
    }

    ctx.restore();
  }

  function stepCats() {
    catTime+=.007;
    ctx.fillStyle='rgba(28,8,4,0.25)'; ctx.fillRect(0,0,W,H);
    for (const o of EMBER) {
      const ox=o.xF*W+Math.sin(catTime*o.sp+o.ph)*50, oy=o.yF*H+Math.cos(catTime*o.sp*.6+o.ph)*35;
      const g=ctx.createRadialGradient(ox,oy,0,ox,oy,o.r);
      g.addColorStop(0,o.col+'28'); g.addColorStop(.5,o.col+'0f'); g.addColorStop(1,'transparent');
      ctx.globalAlpha=.85; ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(ox,oy,o.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    // Fish in background
    for(const f of fishObjs){
      f.x+=f.vx; f.y+=Math.sin(catTime*1.1+f.waveOff)*0.22;
      if(f.x<-60)f.x=W+60; if(f.x>W+60)f.x=-60;
      f.tailPh+=0.22;
      drawFish(f);
    }
    if(yarn){updateYarn(); drawYarn();}
    for (const c of cats) { updateCat(c); drawCat(c); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 4 — CV  (lab + code: floating syntax, microscopy crosshairs)
  // ══════════════════════════════════════════════════════════════════════════
  const CV_SNIPPETS=[
    'library(Seurat)','ggplot(df, aes(x,y))','FindClusters(pbmc)','RunUMAP(object)',
    'import scanpy as sc','pd.DataFrame(data)','sc.tl.umap(adata)','np.array(cells)',
    'git commit -m "fix"','git push origin main','#!/usr/bin/env Rscript','conda activate',
    'read.csv("data.csv")','lm(y ~ x, data=df)','p.adjust(pvals,"BH")',
    'p < 0.05 ***','n = 1,247 cells','FDR < 0.1','ssh felix@hpc',
    'cat("Done!\\n")','grep -r "ENSG"','sort | uniq -c','head -n 10',
    'DESeq2::results(dds)','SingleR::SingleR()','RunHarmony(obj)',
    'samtools index bam','bcftools call -mv','snakemake --cores 8',
    'scanpy.read_h5ad()','cellranger count','STAR --runMode align',
    'Rscript analysis.R','qsub -pe smp 16','awk \'{print $2}\'',
  ];
  let cvSnips=[], cvClusters=[], cvCursor={on:true,timer:0}, cvTime=0;

  // UMAP cluster colours — like a real single-cell UMAP
  const UMAP_COLS=['#c084fc','#38bdf8','#4ade80','#f59e0b','#f472b6','#a78bfa'];

  function initCV() {
    cvTime=0;
    cvSnips=Array.from({length:24},()=>({
      text:CV_SNIPPETS[Math.floor(Math.random()*CV_SNIPPETS.length)],
      x:Math.random()*W, y:Math.random()*H,
      sz:9+Math.random()*7,
      vx:(Math.random()-.5)*.13, vy:(Math.random()-.5)*.1,
      alpha:.055+Math.random()*.17,
      phase:Math.random()*Math.PI*2, pspd:.18+Math.random()*.35,
      col:Math.random()<.45?'#39ff14':(Math.random()<.55?'#38bdf8':'#a78bfa'),
    }));
    // Generate UMAP-like clusters: 5 clusters of ~20 dots each
    cvClusters=[];
    const nClusters=5;
    const cx_offsets=[.2,.5,.78,.32,.65], cy_offsets=[.3,.2,.45,.68,.72];
    for(let c=0;c<nClusters;c++){
      const ccx=cx_offsets[c]*W, ccy=cy_offsets[c]*H;
      const col=UMAP_COLS[c%UMAP_COLS.length];
      const spread=Math.min(W,H)*.07;
      for(let j=0;j<18;j++){
        const angle=Math.random()*Math.PI*2;
        const dist=Math.random()*spread;
        cvClusters.push({
          x:ccx+Math.cos(angle)*dist, y:ccy+Math.sin(angle)*dist,
          r:1.2+Math.random()*2.2, col,
          alpha:.12+Math.random()*.18,
          phase:Math.random()*Math.PI*2,
          vx:(Math.random()-.5)*.06, vy:(Math.random()-.5)*.05,
        });
      }
    }
    cvCursor={on:true, timer:0};
  }

  function stepCV() {
    cvTime+=.007;
    ctx.fillStyle='rgba(2,8,4,0.22)'; ctx.fillRect(0,0,W,H);
    // Subtle terminal glow
    const rg=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,Math.min(W,H)*.6);
    rg.addColorStop(0,'rgba(15,55,15,0.09)'); rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);

    // UMAP scatter plot background — 5 coloured clusters of dots, slowly drifting
    for(const p of cvClusters){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=0; if(p.x>W)p.x=W;
      if(p.y<0)p.y=0; if(p.y>H)p.y=H;
      const a=p.alpha+Math.sin(cvTime*.7+p.phase)*.03;
      ctx.globalAlpha=Math.max(.04,a);
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }

    // Floating bioinformatics code snippets
    for(const s of cvSnips){
      s.x+=s.vx; s.y+=s.vy;
      if(s.x<-250)s.x=W+250; if(s.x>W+250)s.x=-250;
      if(s.y<-20)s.y=H+20; if(s.y>H+20)s.y=-20;
      const a=s.alpha+Math.sin(cvTime*s.pspd+s.phase)*.04;
      ctx.globalAlpha=Math.max(.02,a);
      ctx.fillStyle=s.col;
      ctx.font=`${s.sz}px 'Courier New',monospace`;
      ctx.fillText(s.text,s.x,s.y);
    }

    // Blinking terminal cursor in bottom-right corner
    cvCursor.timer++;
    if(cvCursor.timer>28){cvCursor.on=!cvCursor.on; cvCursor.timer=0;}
    if(cvCursor.on){
      ctx.globalAlpha=.55; ctx.fillStyle='#39ff14';
      ctx.font=`13px 'Courier New',monospace`;
      ctx.fillText('█', W*.88, H*.88);
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 5 — Gallery  (living tissue: vessels, T cells, B cells, tissue cells)
  // ══════════════════════════════════════════════════════════════════════════
  let galVessels=[], galTcells=[], galBcells=[], galTissueCells=[], galTime=0;

  // Draw an amoeboid blob using wavy path (organic shape with pseudopods)
  function drawBlob(cx,cy,r,wobble,phase,time,color,alpha) {
    const n=10, pts=[];
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2;
      const wr=r*(1+wobble*Math.sin(time*1.2+i*1.4+phase));
      pts.push([cx+Math.cos(a)*wr, cy+Math.sin(a)*wr]);
    }
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=0;i<n;i++){
      const p=pts[i], nxt=pts[(i+1)%n];
      const mx=(p[0]+nxt[0])/2, my=(p[1]+nxt[1])/2;
      ctx.quadraticCurveTo(p[0],p[1],mx,my);
    }
    ctx.closePath();
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.6);
    g.addColorStop(0,color+'cc'); g.addColorStop(.6,color+'55'); g.addColorStop(1,color+'00');
    ctx.globalAlpha=alpha; ctx.fillStyle=g; ctx.fill();
    // Bright nucleus
    ctx.globalAlpha=alpha*.7; ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(cx,cy,r*.28,0,Math.PI*2); ctx.fill();
  }

  // Build a branching vessel segment tree (VETC-like network).
  // Uses the PARENT angle as the bezier control-point direction so the curve
  // leaves smoothly in the parent direction and gently bends toward the child
  // endpoint — giving sinuous, vein-like smoothness at every junction.
  function buildVesselTree(x,y,ang,len,depth,vessels,col,parentWidth){
    if(depth<=0||len<22) return;
    const w=parentWidth*(0.72+Math.random()*0.12);
    // Gentle bend only — keeps curves smooth and biologically plausible
    const bend=(Math.random()-.5)*0.5;
    const childAng=ang+bend;
    const ex=x+Math.cos(childAng)*len, ey=y+Math.sin(childAng)*len;
    // Control point placed along PARENT direction → smooth tangent departure
    const cpx=x+Math.cos(ang)*len*0.62, cpy=y+Math.sin(ang)*len*0.62;
    const nCells=Math.max(2,Math.floor(len/24));
    vessels.push({
      p0:{x,y}, cp:{x:cpx,y:cpy}, p1:{x:ex,y:ey},
      w, col, outAng:childAng, // store outgoing angle for child tangent
      cells:Array.from({length:nCells},(_,ci)=>({
        t:ci/nCells+Math.random()*.08, speed:0.0004+Math.random()*0.0004,
      })),
    });
    // Branch: 45% chance of bifurcation; smaller bend at forks for smooth junctions
    const nBranch=depth>1&&Math.random()<0.45?2:1;
    for(let b=0;b<nBranch;b++){
      const forkSign=nBranch===2?(b===0?1:-1):(Math.random()<.5?1:-1);
      const forkBend=forkSign*(0.22+Math.random()*0.32);
      buildVesselTree(ex,ey,childAng+forkBend,len*(0.62+Math.random()*0.12),depth-1,vessels,col,w);
    }
  }

  // Quadratic bezier point
  function qbez(p0,cp,p1,t){ const u=1-t; return [u*u*p0.x+2*u*t*cp.x+t*t*p1.x, u*u*p0.y+2*u*t*cp.y+t*t*p1.y]; }

  function initGallery() {
    galTime=0; galVessels=[];

    // Just 2 root vessels entering from opposite sides — fewer, calmer network
    const roots=[
      {x:0,    y:H*.38, ang: 0.12, col:'#38bdf8'},
      {x:W,    y:H*.62, ang: Math.PI-0.12, col:'#c084fc'},
    ];
    for(const r of roots){
      buildVesselTree(r.x,r.y,r.ang, Math.min(W,H)*.44, 3, galVessels, r.col, 13);
    }

    // Dense tumour-like tissue cell clusters — the visual centrepiece.
    // Seed clusters at: vessel branch points + 2-3 independent avascular regions.
    galTissueCells=[];
    const clusterSeeds=[];
    // From vessel endpoints (branch points every ~3 segments)
    galVessels.filter((_,i)=>i%3===1).slice(0,3).forEach(v=>{
      clusterSeeds.push({cx:v.p1.x, cy:v.p1.y, spread:55});
    });
    // Plus 3 fixed avascular tumour nests scattered across the canvas
    clusterSeeds.push({cx:W*.25+Math.random()*W*.15, cy:H*.3+Math.random()*H*.15, spread:65});
    clusterSeeds.push({cx:W*.55+Math.random()*W*.2,  cy:H*.55+Math.random()*H*.2,  spread:60});
    clusterSeeds.push({cx:W*.15+Math.random()*W*.12, cy:H*.6+Math.random()*H*.2,  spread:50});
    if(clusterSeeds.length===0) clusterSeeds.push({cx:W*.5,cy:H*.5,spread:60});

    const TISSUE_COLS=['#39ff14','#ff69b4','#fbbf24','#fb923c','#a3e635'];
    for(const seed of clusterSeeds){
      // 24-35 cells per cluster — dense enough to look like a tumour nest
      const n=24+Math.floor(Math.random()*12);
      for(let i=0;i<n;i++){
        const ang=Math.random()*Math.PI*2;
        // Gaussian-ish distribution: most cells near centre, few at fringe
        const d=(Math.random()+Math.random())*seed.spread*.5;
        galTissueCells.push({
          x:Math.max(10,Math.min(W-10, seed.cx+Math.cos(ang)*d)),
          y:Math.max(10,Math.min(H-10, seed.cy+Math.sin(ang)*d)),
          r:5+Math.random()*10,
          vx:(Math.random()-.5)*.055, vy:(Math.random()-.5)*.055,
          wobble:.18+Math.random()*.3,
          phase:Math.random()*Math.PI*2,
          col:TISSUE_COLS[Math.floor(Math.random()*TISSUE_COLS.length)],
          alpha:.3+Math.random()*.22,
          changeCd:100+Math.floor(Math.random()*220),
        });
      }
    }

    // B cells cluster
    const bcx=W*(0.35+Math.random()*.3), bcy=H*(0.3+Math.random()*.4);
    galBcells=Array.from({length:10},()=>({
      x:bcx+(Math.random()-.5)*100, y:bcy+(Math.random()-.5)*70,
      r:6+Math.random()*5, wobble:.1+Math.random()*.15,
      phase:Math.random()*Math.PI*2,
      vx:(Math.random()-.5)*.035, vy:(Math.random()-.5)*.035,
      col:'#c084fc', alpha:.32+Math.random()*.22,
    }));

    // T cells
    galTcells=Array.from({length:20},()=>({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-.5)*.55, vy:(Math.random()-.5)*.55,
      r:3.5+Math.random()*2.5,
      wobble:.32+Math.random()*.22, phase:Math.random()*Math.PI*2,
      col:'#38bdf8', alpha:.45+Math.random()*.25,
      searchCd:Math.floor(Math.random()*100+30),
      engaged:false,
    }));
  }

  function stepGallery() {
    galTime+=.014;
    ctx.fillStyle='rgba(2,2,12,0.25)'; ctx.fillRect(0,0,W,H);
    const bg=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,Math.min(W,H)*.7);
    bg.addColorStop(0,'rgba(0,20,30,0.10)'); bg.addColorStop(1,'transparent');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // ── Vessel network ───────────────────────────────────────────────────────
    for(const v of galVessels){
      // Vessel wall glow
      ctx.globalAlpha=.065; ctx.strokeStyle=v.col; ctx.lineWidth=v.w*2+1; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(v.p0.x,v.p0.y);
      ctx.quadraticCurveTo(v.cp.x,v.cp.y,v.p1.x,v.p1.y); ctx.stroke();
      // Inner lumen (darker)
      ctx.globalAlpha=.04; ctx.strokeStyle='#000820'; ctx.lineWidth=v.w*1.2;
      ctx.beginPath(); ctx.moveTo(v.p0.x,v.p0.y);
      ctx.quadraticCurveTo(v.cp.x,v.cp.y,v.p1.x,v.p1.y); ctx.stroke();
      // Highlight
      ctx.globalAlpha=.025; ctx.strokeStyle='#ffffff'; ctx.lineWidth=v.w*.4;
      ctx.beginPath(); ctx.moveTo(v.p0.x,v.p0.y);
      ctx.quadraticCurveTo(v.cp.x,v.cp.y,v.p1.x,v.p1.y); ctx.stroke();
      // Flowing RBCs
      for(const c of v.cells){
        c.t+=c.speed; if(c.t>1)c.t-=1;
        const [px,py]=qbez(v.p0,v.cp,v.p1,c.t);
        const pulse=.8+.2*Math.sin(galTime*4+c.t*25);
        const rr=Math.max(2,v.w*.45);
        ctx.globalAlpha=.6*pulse; ctx.fillStyle=v.col;
        ctx.beginPath(); ctx.ellipse(px,py,rr*1.3,rr*.85,.3,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=.18*pulse; ctx.fillStyle='#000';
        ctx.beginPath(); ctx.ellipse(px,py,rr*.55,rr*.38,.3,0,Math.PI*2); ctx.fill();
      }
    }

    // ── Dense tumour-like tissue cell clusters ────────────────────────────────
    for(const c of galTissueCells){
      c.x+=c.vx; c.y+=c.vy;
      if(c.x<5)c.x=5; if(c.x>W-5)c.x=W-5;
      if(c.y<5)c.y=H-5; if(c.y>H-5)c.y=H-5;
      c.changeCd--;
      if(c.changeCd<=0){
        c.vx=(Math.random()-.5)*.09; c.vy=(Math.random()-.5)*.07;
        c.changeCd=120+Math.floor(Math.random()*200);
      }
      drawBlob(c.x,c.y,c.r,c.wobble,c.phase,galTime,c.col,c.alpha);
    }

    // ── B cells ──────────────────────────────────────────────────────────────
    for(const b of galBcells){
      b.x+=b.vx; b.y+=b.vy;
      if(b.x<15||b.x>W-15)b.vx*=-1; if(b.y<15||b.y>H-15)b.vy*=-1;
      drawBlob(b.x,b.y,b.r,b.wobble,b.phase,galTime,b.col,b.alpha);
    }

    // ── T cells searching for B cells ────────────────────────────────────────
    for(const t of galTcells){
      t.searchCd--;
      if(t.searchCd<=0){
        const nb=galBcells[Math.floor(Math.random()*galBcells.length)];
        const dd=Math.hypot(nb.x-t.x,nb.y-t.y);
        if(dd<200&&Math.random()<.45){
          t.vx=(nb.x-t.x)/dd*.65; t.vy=(nb.y-t.y)/dd*.65; t.engaged=true;
        } else {
          t.vx=(Math.random()-.5)*.65; t.vy=(Math.random()-.5)*.65; t.engaged=false;
        }
        t.searchCd=45+Math.floor(Math.random()*90);
      }
      t.x+=t.vx; t.y+=t.vy;
      if(t.x<8||t.x>W-8)t.vx*=-1; if(t.y<8||t.y>H-8)t.vy*=-1;
      drawBlob(t.x,t.y,t.r,t.wobble,t.phase,galTime,t.engaged?'#00ffff':t.col,
               t.engaged?t.alpha*1.4:t.alpha);
      if(t.engaged&&Math.random()<.12){
        ctx.globalAlpha=.28; ctx.strokeStyle='#00ffff'; ctx.lineWidth=.9;
        ctx.beginPath(); ctx.arc(t.x,t.y,t.r*2.4,0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 6 — FF Points  (flight: star field + airplane contrails)
  // ══════════════════════════════════════════════════════════════════════════
  let ffStars=[], ffPlanes=[], ffTime=0;

  function initFF() {
    ffTime=0;
    ffStars=Array.from({length:130},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.4+.2,
      alpha:Math.random()*.55+.1,
      ph:Math.random()*Math.PI*2, sp:.25+Math.random()*.7,
    }));
    ffPlanes=Array.from({length:4},()=>({
      x:-60+Math.random()*W, y:.1*H+Math.random()*.8*H,
      ang:(Math.random()-.5)*.25,
      spd:.55+Math.random()*.5,
      trail:[],
      col:Math.random()<.5?'#38bdf8':'#ffffff',
    }));
  }

  function stepFF() {
    ffTime+=.01;
    ctx.fillStyle='rgba(2,4,18,0.22)'; ctx.fillRect(0,0,W,H);
    // Subtle blue tint from below
    const bg=ctx.createLinearGradient(0,H*.6,0,H);
    bg.addColorStop(0,'transparent'); bg.addColorStop(1,'rgba(30,58,120,0.12)');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    for(const s of ffStars){
      const a=s.alpha*(.6+.4*Math.sin(ffTime*s.sp+s.ph));
      ctx.globalAlpha=a; ctx.fillStyle='#e2e8f0';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    }

    for(const p of ffPlanes){
      p.x+=Math.cos(p.ang)*p.spd; p.y+=Math.sin(p.ang)*p.spd*.4;
      if(p.x>W+60){p.x=-60; p.y=.1*H+Math.random()*.8*H; p.trail=[];}
      p.trail.push({x:p.x,y:p.y});
      if(p.trail.length>90)p.trail.shift();
      // Contrail
      ctx.setLineDash([5,5]);
      for(let i=1;i<p.trail.length;i++){
        const f=i/p.trail.length;
        ctx.globalAlpha=f*.28; ctx.strokeStyle=p.col;
        ctx.lineWidth=Math.max(.3,1.8-f*1.4);
        ctx.beginPath(); ctx.moveTo(p.trail[i-1].x,p.trail[i-1].y);
        ctx.lineTo(p.trail[i].x,p.trail[i].y); ctx.stroke();
      }
      ctx.setLineDash([]);
      // Plane body (small delta wing silhouette)
      ctx.globalAlpha=.88; ctx.fillStyle=p.col;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.ang);
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,-4); ctx.lineTo(-3,0); ctx.lineTo(-6,4); ctx.closePath();
      ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 7 — ETF Tools  (candlesticks + flying cash + creature forever chasing)
  // ══════════════════════════════════════════════════════════════════════════
  let etfBars=[], etfBills=[], etfCreature={}, etfTime=0;

  function initETF() {
    etfTime=0;
    const n=Math.max(12, Math.floor(W/24));
    etfBars=Array.from({length:n},(_,i)=>{
      const h=40+Math.random()*H*.38;
      return {x:(i+.5)*(W/n), h, th:40+Math.random()*H*.38,
              spd:.012+Math.random()*.018, col:Math.random()<.68?'#39ff14':'#ef4444'};
    });
    etfBills=Array.from({length:8},(_,bi)=>({
      x:Math.random()*W, y:H*.18+Math.random()*H*.6,
      vx:0.5+Math.random()*0.55, vy:(Math.random()-.5)*.2,
      angle:(Math.random()-.5)*.4, spin:(Math.random()-.5)*.016,
      flap:bi*Math.PI/4, // stagger tumble
    }));
    etfCreature={x:W*.08, y:H*.58, vx:0, vy:0, dir:1, legPh:0, hopPh:0, targetIdx:0};
  }

  function drawBill(b) {
    const sx=Math.cos(b.flap);            // -1..1 simulates tumbling
    const bw=34*Math.abs(sx), bh=16;
    if(bw<1) return;
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.angle);
    ctx.globalAlpha=.8;
    ctx.fillStyle=sx>0?'#22c55e':'#16a34a';
    ctx.fillRect(-bw/2,-bh/2,bw,bh);
    ctx.strokeStyle='#15803d'; ctx.lineWidth=1;
    ctx.strokeRect(-bw/2+.5,-bh/2+.5,bw-1,bh-1);
    if(Math.abs(sx)>0.38){
      ctx.fillStyle='#dcfce7';
      ctx.font=`bold ${Math.round(11*Math.abs(sx))}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('$',0,0);
    }
    ctx.restore();
  }

  function drawCreature(c) {
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(c.dir,1);
    const bob=Math.sin(c.hopPh)*4.5;
    // Shadow
    ctx.globalAlpha=.15; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(0,28+bob*.15,15,4,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.9; ctx.fillStyle='#d97706';
    // Floppy ears
    ctx.beginPath(); ctx.ellipse(-11,-13+bob,6.5,10,-.38,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11,-13+bob,6.5,10,.38,0,Math.PI*2); ctx.fill();
    // Body
    ctx.beginPath(); ctx.ellipse(0,6+bob,17,14,0,0,Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(0,-12+bob,15,0,Math.PI*2); ctx.fill();
    // Eyes
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(-5,-14+bob,4,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5,-14+bob,4,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1c1917';
    ctx.beginPath(); ctx.ellipse(-4.5,-13.5+bob,2.2,2.8,.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5,-13.5+bob,2.2,2.8,-.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(-3.5,-14.5+bob,.9,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6.5,-14.5+bob,.9,0,Math.PI*2); ctx.fill();
    // Nose
    ctx.fillStyle='#92400e';
    ctx.beginPath(); ctx.ellipse(0,-6+bob,3.5,2.5,0,0,Math.PI*2); ctx.fill();
    // Panting tongue (SO CLOSE yet SO FAR)
    ctx.fillStyle='#f9a8d4'; ctx.globalAlpha=.9;
    ctx.beginPath(); ctx.ellipse(0,.5+bob,4.5,6,.1,0,Math.PI); ctx.fill();
    ctx.globalAlpha=.35; ctx.strokeStyle='#ec4899'; ctx.lineWidth=.8;
    ctx.beginPath(); ctx.moveTo(0,.5+bob); ctx.lineTo(0,6+bob); ctx.stroke();
    // Legs
    ctx.globalAlpha=.9; ctx.fillStyle='#d97706';
    const ls=Math.sin(c.legPh);
    [[-9,ls*6],[-2,-ls*6],[3,ls*6],[9,-ls*6]].forEach(([lx,ly],i)=>{
      ctx.beginPath(); ctx.ellipse(lx,22+bob+ly,5,7,(i-.5)*.1,0,Math.PI*2); ctx.fill();
    });
    // Wagging tail
    const tw=Math.sin(etfTime*6)*18;
    ctx.strokeStyle='#d97706'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-14,8+bob); ctx.bezierCurveTo(-28,-2+bob,-36,tw-18+bob,-30,tw-34+bob); ctx.stroke();
    ctx.restore();
  }

  function stepETF() {
    etfTime+=.013;
    ctx.fillStyle='rgba(2,10,3,0.24)'; ctx.fillRect(0,0,W,H);
    const rg=ctx.createRadialGradient(W*.5,H,0,W*.5,H,H);
    rg.addColorStop(0,'rgba(57,255,20,0.05)'); rg.addColorStop(.6,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
    // Candlestick bars
    const bw=Math.max(6,(W/etfBars.length)*.62);
    for(const b of etfBars){
      b.h+=(b.th-b.h)*b.spd;
      if(Math.abs(b.h-b.th)<1){b.th=40+Math.random()*H*.42; b.col=b.th>b.h?'#39ff14':'#ef4444';}
      const by=H-b.h;
      ctx.globalAlpha=.13; ctx.fillStyle=b.col; ctx.fillRect(b.x-bw/2,by,bw,b.h);
      ctx.globalAlpha=.4;  ctx.fillRect(b.x-bw/2,by,bw,2);
      ctx.globalAlpha=.18; ctx.strokeStyle=b.col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(b.x,by-8); ctx.lineTo(b.x,by); ctx.stroke();
    }
    // Bills
    for(let bi=0;bi<etfBills.length;bi++){
      const b=etfBills[bi];
      b.x+=b.vx; b.y+=b.vy; b.angle+=b.spin; b.flap+=.055;
      b.vy+=Math.sin(etfTime*1.3+bi*1.1)*.006; b.vy*=.99;
      // Wrap right→left as before; bills escaping left are "lost" — respawn on right
      if(b.x>W+50){b.x=-50; b.y=H*.18+Math.random()*H*.6; b.vx=0.5+Math.random()*0.55; b.vy=(Math.random()-.5)*.2;}
      if(b.x<-50) {b.x=W+50; b.y=H*.18+Math.random()*H*.6; b.vx=0.5+Math.random()*0.55; b.vy=(Math.random()-.5)*.2;}
      if(b.y<H*.05||b.y>H*.92){b.vy*=-1;}
      ctx.globalAlpha=1; drawBill(b);
    }
    // Creature AI
    const c=etfCreature;
    // Retarget immediately if current target has escaped off-screen
    const tgt=etfBills[c.targetIdx];
    if(!tgt || tgt.x < -20 || tgt.x > W+20){
      let m=Infinity;
      etfBills.forEach((b,i)=>{ const d=Math.hypot(b.x-c.x,b.y-c.y); if(d<m){m=d;c.targetIdx=i;} });
    }
    const tgt2=etfBills[c.targetIdx];
    if(tgt2){
      const dx=tgt2.x-c.x, dy=tgt2.y-c.y, dist=Math.hypot(dx,dy);
      if(dist>5){ c.vx+=(dx/dist)*.11; c.vy+=(dy/dist)*.06; }
    }
    // ALL bills flee from creature when nearby (not just the one being chased)
    for(let bi=0;bi<etfBills.length;bi++){
      const b=etfBills[bi];
      const dx=b.x-c.x, dy=b.y-c.y, dist=Math.hypot(dx,dy);
      if(dist<120 && dist>0){
        const f=(120-dist)/120;
        b.vx+=(dx/dist)*f*0.9;
        b.vy+=(dy/dist)*f*0.45;
        const bs=Math.hypot(b.vx,b.vy);
        if(bs>3.2){b.vx=b.vx/bs*3.2; b.vy=b.vy/bs*3.2;}
      }
    }
    const cs=Math.hypot(c.vx,c.vy); if(cs>1.3){c.vx=c.vx/cs*1.3; c.vy=c.vy/cs*1.3;}
    c.vx*=.91; c.vy*=.91;
    c.x+=c.vx; c.y+=c.vy;
    c.x=Math.max(25,Math.min(W-25,c.x)); c.y=Math.max(H*.1,Math.min(H*.9,c.y));
    c.dir=c.vx>=0?1:-1;
    c.legPh+=Math.hypot(c.vx,c.vy)*.32;
    c.hopPh+=.14;
    // Retarget nearest bill when otherwise stuck
    if(Math.hypot(c.vx,c.vy)<.07){
      let m=Infinity;
      etfBills.forEach((b,i)=>{const d=Math.hypot(b.x-c.x,b.y-c.y); if(d<m){m=d;c.targetIdx=i;}});
    }
    ctx.globalAlpha=1; drawCreature(c);
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 8 — Cosmic Lab  (star field + constellations + shooting stars + cell stars)
  // ══════════════════════════════════════════════════════════════════════════

  // Constellation patterns: stars as [x,y] relative units, edges as index pairs
  // Each will be scaled and placed on the canvas
  const CONST_PATTERNS=[
    {name:'Dipper',  stars:[[0,0],[1,.1],[2,.05],[3,.2],[3.8,.8],[3.2,1.1],[2.4,.95]],
                     edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]},
    {name:'Cross',   stars:[[1,0],[1,2],[0,1],[2,1],[.35,.35]],
                     edges:[[0,1],[2,3],[0,4],[1,4]]},
    {name:'Cass',    stars:[[0,.5],[1,0],[2,.6],[3,.1],[4,.5]],
                     edges:[[0,1],[1,2],[2,3],[3,4]]},
    {name:'Triangle',stars:[[0,1],[1,0],[2,1]],
                     edges:[[0,1],[1,2],[2,0]]},
    {name:'Orion',   stars:[[.5,0],[1.5,0],[1,.15],[.35,1],[1.65,1],[.2,2.1],[1.8,2.1]],
                     edges:[[0,2],[1,2],[3,4],[2,3],[2,4],[3,5],[4,6]]},
    {name:'Cluster', stars:[[0,0],[.9,.3],[1.7,.1],[2.3,.65],[1.5,1.05],[.55,.85],[1.1,1.5]],
                     edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6]]},
  ];

  let cosmicStars=[], cosmicCells=[], cosmicConsts=[], cosmicShoots=[], cosmicOrbs=[], cosmicTime=0;

  function spawnShooter() {
    return {
      x: Math.random()*W*.6,
      y: Math.random()*H*.5,
      vx: 5+Math.random()*7,
      vy: 1.5+Math.random()*3.5,
      len: 60+Math.random()*120,
      life: 1.0,
      decay: .025+Math.random()*.03,
    };
  }

  function initCosmic() {
    cosmicTime=0;
    // Regular stars
    cosmicStars=Array.from({length:180},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.4+.12,
      alpha:Math.random()*.65+.1,
      phase:Math.random()*Math.PI*2,
      sp:.2+Math.random()*.8,
    }));
    // Cell-stars: glowing blobs that look like fluorescent cells
    cosmicCells=Array.from({length:7},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:3.5+Math.random()*5,
      vx:(Math.random()-.5)*.08, vy:(Math.random()-.5)*.07,
      alpha:.18+Math.random()*.28,
      phase:Math.random()*Math.PI*2,
      col:['#39ff14','#c084fc','#38bdf8','#ff69b4','#fbbf24'][Math.floor(Math.random()*5)],
    }));
    // Constellations: pick 3 random patterns, place them on screen with timing offsets
    cosmicConsts=Array.from({length:3},(_,i)=>{
      const pat=CONST_PATTERNS[(i*2+Math.floor(Math.random()*2))%CONST_PATTERNS.length];
      // Find bounding box of pattern
      const xs=pat.stars.map(s=>s[0]), ys=pat.stars.map(s=>s[1]);
      const pw=Math.max(...xs)||1, ph=Math.max(...ys)||1;
      const scale=(55+Math.random()*70); // pixels per unit
      const ox=30+Math.random()*(W-pw*scale-60);
      const oy=30+Math.random()*(H-ph*scale-60);
      return {
        stars: pat.stars.map(([x,y])=>({sx:ox+x*scale, sy:oy+y*scale})),
        edges: pat.edges,
        alpha: 0,           // current visibility
        targetAlpha: 0,     // 0=fading out, 0.7=fading in
        timer: Math.random()*400, // frames until next state change
        phase: Math.random()*Math.PI*2,
      };
    });
    // 2 initial shooting stars
    cosmicShoots=[spawnShooter()];
    cosmicShoots[0].life=Math.random(); // stagger
    const R=Math.min(W,H);
    cosmicOrbs=[
      {a:R*.21,b:R*.07, angle:0,         spd:.00055, color:'#c084fc', alpha:.065},
      {a:R*.36,b:R*.115,angle:Math.PI/3, spd:-.00038,color:'#38bdf8', alpha:.05 },
    ];
  }

  function stepCosmic() {
    cosmicTime+=.009;
    ctx.fillStyle='rgba(1,0,10,0.22)'; ctx.fillRect(0,0,W,H);
    // Nebula glows
    const ng=ctx.createRadialGradient(W*.42,H*.44,0,W*.42,H*.44,Math.min(W,H)*.55);
    ng.addColorStop(0,'rgba(110,70,210,0.07)'); ng.addColorStop(1,'transparent');
    ctx.fillStyle=ng; ctx.fillRect(0,0,W,H);

    // Regular stars (twinkle)
    for(const s of cosmicStars){
      const a=s.alpha*(.4+.6*Math.sin(cosmicTime*s.sp+s.phase));
      ctx.globalAlpha=Math.max(.01,a); ctx.fillStyle='#e2e8f0';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    }

    // Cell-stars: fluorescent blobs that drift slowly
    for(const c of cosmicCells){
      c.x+=c.vx; c.y+=c.vy;
      if(c.x<-30)c.x=W+30; if(c.x>W+30)c.x=-30;
      if(c.y<-30)c.y=H+30; if(c.y>H+30)c.y=-30;
      const pulse=.6+.4*Math.sin(cosmicTime*1.1+c.phase);
      // Outer glow (like FITC/GFP cell)
      const g=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.r*8);
      g.addColorStop(0,c.col+'88'); g.addColorStop(.4,c.col+'22'); g.addColorStop(1,'transparent');
      ctx.globalAlpha=c.alpha*pulse; ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r*8,0,Math.PI*2); ctx.fill();
      // Bright nucleus
      ctx.globalAlpha=c.alpha*.9*pulse; ctx.fillStyle=c.col;
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill();
    }

    // Constellations: twinkle in and out
    for(const con of cosmicConsts){
      con.timer--;
      if(con.timer<=0){
        // Flip state
        con.targetAlpha = con.targetAlpha>0 ? 0 : 0.72;
        con.timer = 280+Math.random()*380;
      }
      // Smooth fade toward target
      con.alpha+=(con.targetAlpha-con.alpha)*.012;
      if(con.alpha<.008) continue;

      // Draw connecting lines
      ctx.globalAlpha=con.alpha*.55; ctx.strokeStyle='#a5b4fc'; ctx.lineWidth=.8;
      ctx.setLineDash([3,6]);
      for(const [a,b] of con.edges){
        ctx.beginPath();
        ctx.moveTo(con.stars[a].sx, con.stars[a].sy);
        ctx.lineTo(con.stars[b].sx, con.stars[b].sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Draw star nodes
      for(const st of con.stars){
        const twink=.75+.25*Math.sin(cosmicTime*2.2+st.sx*.01+con.phase);
        ctx.globalAlpha=con.alpha*twink;
        // Glow
        const sg=ctx.createRadialGradient(st.sx,st.sy,0,st.sx,st.sy,7);
        sg.addColorStop(0,'#c4b5fd'); sg.addColorStop(1,'transparent');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(st.sx,st.sy,7,0,Math.PI*2); ctx.fill();
        // Core
        ctx.globalAlpha=con.alpha*twink*.9; ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.arc(st.sx,st.sy,1.8,0,Math.PI*2); ctx.fill();
      }
    }

    // Orbital ellipses + planets
    ctx.setLineDash([4,9]);
    for(const orb of cosmicOrbs){
      orb.angle+=orb.spd;
      ctx.globalAlpha=orb.alpha; ctx.strokeStyle=orb.color; ctx.lineWidth=.8;
      ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(orb.angle);
      ctx.beginPath(); ctx.ellipse(0,0,orb.a,orb.b,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      const px=W/2+orb.a*Math.cos(cosmicTime*orb.spd*90+orb.angle);
      const py=H/2+orb.b*Math.sin(cosmicTime*orb.spd*90+orb.angle);
      ctx.globalAlpha=.6;
      const dg=ctx.createRadialGradient(px,py,0,px,py,5);
      dg.addColorStop(0,orb.color+'ff'); dg.addColorStop(1,'transparent');
      ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(px,py,5,0,Math.PI*2); ctx.fill();
    }
    ctx.setLineDash([]);

    // Shooting stars
    if(Math.random()<.003&&cosmicShoots.length<4) cosmicShoots.push(spawnShooter());
    for(let i=cosmicShoots.length-1;i>=0;i--){
      const s=cosmicShoots[i];
      s.x+=s.vx; s.y+=s.vy; s.life-=s.decay;
      if(s.life<=0||s.x>W+50){cosmicShoots.splice(i,1); continue;}
      // Streak
      const grad=ctx.createLinearGradient(s.x-s.vx*s.len/s.vx,s.y-s.vy*s.len/s.vx,s.x,s.y);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(1,'rgba(220,230,255,'+s.life.toFixed(2)+')');
      ctx.globalAlpha=s.life*.9; ctx.strokeStyle=grad; ctx.lineWidth=1.6; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(s.x-s.vx*(s.len/Math.max(s.vx,1)), s.y-s.vy*(s.len/Math.max(s.vx,1)));
      ctx.lineTo(s.x,s.y); ctx.stroke();
      // Head flare
      ctx.globalAlpha=s.life*.7; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(s.x,s.y,1.4,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 9 — Legacy  (cash falls → pigs inhale & fatten → spit coins → stick figures fight in dust clouds)
  // ══════════════════════════════════════════════════════════════════════════
  let lgPigs=[], lgNotes=[], lgCoins=[], lgPeople=[], lgDusts=[], lgT=0;
  const LG_PINK='#fda4af', LG_DPINK='#e11d48', LG_GOLD='#f0c040', LG_BILL='#4ade80';

  function initLegacy(){
    lgPigs=[]; lgNotes=[]; lgCoins=[]; lgPeople=[]; lgDusts=[]; lgT=0;
    const pigY=H*0.52, floorY=H*0.74;
    const n=Math.min(4,Math.max(2,Math.floor(W/200)));
    const sp=W/(n+1);
    for(let i=0;i<n;i++){
      lgPigs.push({
        x:sp*(i+1), pigY, floorY,
        baseFat:28, fat:28, maxFat:80,
        // Inhale state
        inhaling:0,      // 0=idle, >0=inhaling (countdown)
        inhalePow:0,     // 0..1 suction strength
        // Belch state
        belchCD:240+Math.floor(Math.random()*400),
        belchAnim:0,
        // Visual
        wiggle:0, angle:0,
        // Absorbed sparkles
        sparks:[],
      });
    }
    // Stick people in lower tier
    const m=Math.min(10,Math.max(4,Math.floor(W/120)));
    const sp2=W/(m+1);
    for(let i=0;i<m;i++){
      lgPeople.push({
        bx:sp2*(i+1), x:sp2*(i+1), y:floorY+38,
        ph:Math.random()*Math.PI*2,
        scramble:0, target:null,
        dustCD:0,
      });
    }
  }

  /* ─── Cash note (rectangle with $ sign) ─── */
  function newNote(){
    const pw=(Math.random()>.5)?22:18;
    const ph=pw*0.6;
    return {
      x:Math.random()*W*0.9+W*0.05,
      y:-30-Math.random()*80,
      vx:(Math.random()-.5)*.4,
      vy:0.5+Math.random()*0.9,
      rot:(Math.random()-.5)*.5,
      spin:(Math.random()-.5)*.025,
      w:pw, h:ph,
      al:0.8+Math.random()*0.18,
      dead:false,
      // When being sucked by a pig:
      suckTarget:null, suckSpeed:0,
    };
  }

  function drawNote(n){
    ctx.save();
    ctx.translate(n.x,n.y);
    ctx.rotate(n.rot);
    ctx.globalAlpha=n.al;
    // Bill body
    ctx.fillStyle='#166534';
    ctx.strokeStyle='#4ade80';
    ctx.lineWidth=.8;
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(-n.w/2,-n.h/2,n.w,n.h,2):ctx.rect(-n.w/2,-n.h/2,n.w,n.h);
    ctx.fill(); ctx.stroke();
    // $ sign
    ctx.fillStyle='#86efac';
    ctx.font=`bold ${n.h*0.7}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('$',0,0);
    ctx.restore();
  }

  /* ─── Coin (small silver/gold disc) ─── */
  function drawCoin(c){
    ctx.save();
    ctx.translate(c.x,c.y);
    ctx.globalAlpha=c.al;
    ctx.fillStyle='#d1d5db';
    ctx.strokeStyle='#9ca3af';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,0,c.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#6b7280';
    ctx.font=`bold ${c.r*1.2}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('¢',0,0);
    ctx.restore();
  }

  /* ─── Table ─── */
  function lgGoldPileDraw(x,pigY,fat){
    // Gold coin pile under pig — grows with fat
    const baseW=Math.max(fat*2.2,70);
    const pileH=Math.max(fat*0.55,18);
    const cy=pigY+6; // top of pile (pig sits on it)

    // Pile shadow
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(x,cy+pileH*0.6,baseW*0.52,pileH*0.22,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;

    // Main pile gradient — gold mound
    const g=ctx.createRadialGradient(x,cy,0,x,cy+pileH*0.4,baseW*0.65);
    g.addColorStop(0,'#fef08a'); g.addColorStop(0.35,'#fbbf24'); g.addColorStop(0.75,'#d97706'); g.addColorStop(1,'#92400e');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(x-baseW*0.5,cy+pileH);
    ctx.bezierCurveTo(x-baseW*0.55,cy+pileH*0.3, x-baseW*0.25,cy-pileH*0.25, x,cy-pileH*0.1);
    ctx.bezierCurveTo(x+baseW*0.25,cy-pileH*0.25, x+baseW*0.55,cy+pileH*0.3, x+baseW*0.5,cy+pileH);
    ctx.closePath(); ctx.fill();

    // Coin highlights — small ellipses scattered on pile
    const nCoins=Math.floor(fat/9)+3;
    const coinSeed=Math.floor(fat*7); // stable within fat level
    for(let i=0;i<nCoins;i++){
      const t=(i/nCoins);
      const cx2=x+(t*2-1)*baseW*0.38;
      const cy2=cy+pileH*(0.15+t*0.55);
      const cr=fat*0.11+2;
      ctx.save();
      ctx.globalAlpha=0.55+0.2*(i%2);
      const cg=ctx.createRadialGradient(cx2-cr*0.3,cy2-cr*0.3,0,cx2,cy2,cr);
      cg.addColorStop(0,'#fef9c3'); cg.addColorStop(0.5,'#fbbf24'); cg.addColorStop(1,'#b45309');
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.ellipse(cx2,cy2,cr,cr*0.45,0,0,Math.PI*2); ctx.fill();
      // Coin edge glint
      ctx.strokeStyle='rgba(254,240,138,0.5)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.ellipse(cx2,cy2,cr,cr*0.45,0,Math.PI*1.1,Math.PI*1.9); ctx.stroke();
      ctx.restore();
    }

    // Scattered gold bars behind pile
    const barW=fat*0.38, barH=fat*0.14;
    [[x-baseW*0.32,cy+pileH*0.25],[x+baseW*0.28,cy+pileH*0.3]].forEach(([bx,by],bi)=>{
      ctx.save(); ctx.rotate(bi===0?-0.18:0.22);
      const bg2=ctx.createLinearGradient(bx-barW/2,by,bx+barW/2,by);
      bg2.addColorStop(0,'#b45309'); bg2.addColorStop(0.3,'#fef08a'); bg2.addColorStop(0.7,'#fbbf24'); bg2.addColorStop(1,'#92400e');
      ctx.fillStyle=bg2;
      ctx.translate(bx,by);
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-barW/2,-barH/2,barW,barH,2);
      else ctx.rect(-barW/2,-barH/2,barW,barH);
      ctx.fill();
      ctx.strokeStyle='rgba(254,240,138,0.4)'; ctx.lineWidth=0.6; ctx.stroke();
      ctx.restore();
    });

    ctx.restore();
  }

  /* ─── Pig ─── */
  function drawPig(pig,t){
    const {x,pigY,fat,belchAnim,wiggle,angle,inhaling,inhalePow,sparks}=pig;
    const bw=fat*1.4, bh=fat*0.88;
    const py=pigY-bh*0.35;
    const wA=wiggle>0?Math.sin(t*0.3)*0.07*(wiggle/12):0;

    ctx.save(); ctx.translate(x,py); ctx.rotate(wA+angle*.04);

    // Drop shadow
    ctx.globalAlpha=0.18;
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(0,bh*0.8,bw*0.7,bh*0.22,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;

    // Body (ellipse with slight pear shape via scale)
    const bodyScale=1+inhalePow*0.18; // swell during inhale
    ctx.save(); ctx.scale(bodyScale,1+inhalePow*0.12);
    // Main body gradient
    const bodyG=ctx.createRadialGradient(-bw*.25,-bh*.25,bh*.1,0,0,bw);
    bodyG.addColorStop(0,'#fecdd3'); bodyG.addColorStop(0.6,LG_PINK); bodyG.addColorStop(1,'#e11d48');
    ctx.fillStyle=bodyG;
    ctx.strokeStyle=LG_DPINK; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(0,0,bw,bh,0,0,Math.PI*2);
    ctx.fill(); ctx.stroke();
    // Belly highlight
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(-bw*.1,bh*.15,bw*.45,bh*.28,-.15,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Ears (rounded triangles)
    const earCol=LG_DPINK;
    ctx.fillStyle=earCol; ctx.strokeStyle='#9f1239'; ctx.lineWidth=1;
    [[-bw*.58,-bh*.72,-.35],[bw*.58,-bh*.72,.35]].forEach(([ex,ey,ea])=>{
      ctx.save(); ctx.translate(ex,ey); ctx.rotate(ea);
      ctx.beginPath();
      ctx.moveTo(0,-fat*.32); ctx.lineTo(-fat*.16,fat*.08); ctx.lineTo(fat*.16,fat*.08); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Inner ear
      ctx.fillStyle='#fda4af'; ctx.lineWidth=.5;
      ctx.beginPath();
      ctx.moveTo(0,-fat*.2); ctx.lineTo(-fat*.09,fat*.03); ctx.lineTo(fat*.09,fat*.03); ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Snout (oval with nostrils)
    ctx.save(); ctx.translate(bw*.48, bh*.08);
    ctx.fillStyle=LG_DPINK; ctx.strokeStyle='#9f1239'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(0,0,fat*.3,fat*.22,0.08,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // Nostrils
    ctx.fillStyle='#881337';
    [[-fat*.12,0],[fat*.12,0]].forEach(([nx,ny])=>{
      ctx.beginPath(); ctx.ellipse(nx,ny,fat*.065,fat*.075,0,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();

    // Eyes (with reflection)
    ctx.fillStyle='#1e1b4b';
    ctx.beginPath(); ctx.ellipse(-bw*.18,-bh*.28,fat*.1,fat*.11,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='white';
    ctx.beginPath(); ctx.arc(-bw*.14,-bh*.32,fat*.04,0,Math.PI*2); ctx.fill();

    // Mouth - if belching show open maw
    if(belchAnim>0){
      const mAl=Math.min(1,belchAnim/8);
      ctx.globalAlpha=mAl;
      ctx.fillStyle='#881337';
      ctx.beginPath(); ctx.ellipse(bw*.44,bh*.25,fat*.13,fat*.1,0.15,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      // Belch puff
      if(belchAnim>6){
        ctx.globalAlpha=(belchAnim-6)/20;
        ctx.font=`${fat*.6}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('💨',bw*.92,bh*.15);
        ctx.globalAlpha=1;
      }
    } else {
      // Inhale: open mouth toward sky to suck in notes
      if(inhalePow>0.2){
        ctx.fillStyle='#881337'; ctx.globalAlpha=inhalePow*.9;
        ctx.beginPath(); ctx.ellipse(bw*.42,-bh*.48,fat*.12*inhalePow,fat*.1*inhalePow,-.3,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
      }
    }

    // Curly tail
    ctx.strokeStyle=LG_DPINK; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-bw*.9,0);
    ctx.bezierCurveTo(-bw*1.3,-fat*.5,-bw*1.38,fat*.45,-bw*1.1,fat*.3);
    ctx.stroke();

    // Spots
    ctx.fillStyle='rgba(225,29,72,0.22)';
    ctx.beginPath(); ctx.ellipse(bw*.15,bh*.45,fat*.18,fat*.1,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-bw*.35,bh*.25,fat*.12,fat*.08,-.2,0,Math.PI*2); ctx.fill();

    ctx.restore();

    // Inhale suction visual: arc of particles
    if(inhalePow>0.1){
      for(let a=0;a<3;a++){
        const ang=-Math.PI*.5+((a/3)-.5)*0.8;
        const rad=bw*.9+Math.sin(t*.15+a)*bw*.3;
        const sx=x+Math.cos(ang)*rad, sy=py+Math.sin(ang)*rad;
        ctx.globalAlpha=inhalePow*0.35*(0.5+0.5*Math.sin(t*.3+a));
        ctx.fillStyle=LG_BILL;
        ctx.beginPath(); ctx.arc(sx,sy,2,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
      }
    }

    // Gold sparks
    sparks.forEach(s=>{
      ctx.globalAlpha=s.al; ctx.fillStyle=LG_GOLD;
      ctx.font=`${s.sz}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('✦',x+s.x,py+s.y); ctx.globalAlpha=1;
    });
  }

  /* ─── Stick person ─── */
  function drawPerson(p,t){
    const {x,y,ph,scramble}=p;
    const hd=6.5;
    ctx.save(); ctx.translate(x,y);
    ctx.strokeStyle='rgba(148,163,184,.8)'; ctx.fillStyle='rgba(148,163,184,.8)';
    ctx.lineWidth=2; ctx.lineCap='round';
    // Head
    ctx.beginPath(); ctx.arc(0,-hd*5.2,hd,0,Math.PI*2); ctx.fill();
    // Body
    ctx.beginPath(); ctx.moveTo(0,-hd*4.2); ctx.lineTo(0,0); ctx.stroke();
    // Legs
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-hd*1.2,hd*2.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo( hd*1.2,hd*2.4); ctx.stroke();
    // Arms — raised toward coin when scrambling
    const wave=Math.sin(t*0.04+ph)*0.3;
    if(scramble>0){
      // Reaching up
      ctx.beginPath(); ctx.moveTo(0,-hd*3); ctx.lineTo(-hd*2.2,-hd*4.5+wave*hd); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-hd*3); ctx.lineTo( hd*2.2,-hd*4.5-wave*hd); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(0,-hd*3); ctx.lineTo(-hd*2.2,-hd*2.5+wave*hd); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-hd*3); ctx.lineTo( hd*2.2,-hd*2.5-wave*hd); ctx.stroke();
    }
    ctx.restore();
  }

  /* ─── Dust cloud (for fighting) ─── */
  function drawDust(d){
    ctx.save(); ctx.translate(d.x,d.y);
    ctx.globalAlpha=d.al*.55;
    // Cloud of puffs
    for(let i=0;i<d.puffs.length;i++){
      const pf=d.puffs[i];
      ctx.fillStyle='rgba(203,213,225,0.7)';
      ctx.beginPath(); ctx.arc(pf.x,pf.y,pf.r,0,Math.PI*2); ctx.fill();
    }
    // Stars/exclamation inside
    ctx.globalAlpha=d.al*0.9;
    const icons=['★','💥','!','?'];
    icons.forEach((ic,i)=>{
      const angle=d.spin*lgT+i*Math.PI/2;
      const r=d.radius*.55;
      ctx.font=`bold ${d.radius*.28}px sans-serif`;
      ctx.fillStyle=['#fbbf24','#f87171','#60a5fa','#4ade80'][i];
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(ic, Math.cos(angle)*r, Math.sin(angle)*r);
    });
    ctx.restore();
  }

  /* ─── Note batch spawner ─── */
  let lgBatchCD=80, lgBatchSize=0, lgBatchLeft=0;

  function spawnBatch(){
    lgBatchSize=5+Math.floor(Math.random()*7);
    lgBatchLeft=lgBatchSize;
    lgBatchCD=Math.max(50,lgBatchSize*12);
  }

  /* ─── Main step ─── */
  function stepLegacy(){
    lgT++;
    ctx.clearRect(0,0,W,H);
    if(!lgPigs.length) return;
    const {pigY,floorY}=lgPigs[0];

    // Sky gradient
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#020818'); sky.addColorStop(0.5,'#050f20'); sky.addColorStop(1,'#080510');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    // Floor line
    ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,floorY); ctx.lineTo(W,floorY); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(0,floorY,W,H-floorY);

    // Batch spawner
    lgBatchCD--;
    if(lgBatchCD<=0&&lgBatchLeft>0){ lgNotes.push(newNote()); lgBatchLeft--; if(lgBatchLeft===0) lgBatchCD=120+Math.floor(Math.random()*180); }
    if(lgBatchCD<=0&&lgBatchLeft===0) spawnBatch();

    // Update pig states
    lgPigs.forEach(pig=>{
      // Belch timer
      pig.belchCD--;
      if(pig.belchCD<=0){
        pig.belchCD=200+Math.floor(Math.random()*350);
        pig.belchAnim=30;
        // Spit a few coins
        const numCoins=2+Math.floor(Math.random()*3);
        for(let i=0;i<numCoins;i++){
          lgCoins.push({
            x:pig.x+pig.fat*.5+(Math.random()-.5)*pig.fat*.4,
            y:pigY-pig.fat*.6,
            vx:(1.2+Math.random()*1.8)*(Math.random()>.5?1:-1),
            vy:-1.5-Math.random()*.8,
            r:4+Math.random()*2.5,
            al:1, ang:0, dead:false, landed:false, landT:0,
          });
        }
        // Shrink a little after spitting
        pig.fat=Math.max(pig.baseFat, pig.fat*0.88);
      }
      if(pig.belchAnim>0) pig.belchAnim--;
      if(pig.wiggle>0) pig.wiggle=Math.max(0,pig.wiggle-.15);
      pig.sparks=pig.sparks.filter(s=>s.al>.04);
      pig.sparks.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.vy+=0.05;s.al-=.02;});
    });

    // Check if any note is in pig suction zone and assign targets
    // Zone is wide (W/nPigs * 0.72) and tall (full screen above pig)
    const nLgPigs=lgPigs.length||1;
    const suckHalfW=pig=>Math.max(W/(nLgPigs*2)*0.72, pig.fat*2.8, 120);
    lgNotes.forEach(note=>{
      if(note.dead||note.suckTarget) return;
      // Find nearest pig in whose zone this note falls
      let best=null, bestDist=Infinity;
      lgPigs.forEach(pig=>{
        const hw=suckHalfW(pig);
        if(note.x>pig.x-hw&&note.x<pig.x+hw&&note.y<pigY+12){
          const d=Math.abs(note.x-pig.x);
          if(d<bestDist){ bestDist=d; best=pig; }
        }
      });
      if(best){
        note.suckTarget=best;
        note.suckSpeed=0.06;
        best.inhaling=45;
        best.inhalePow=Math.min(1,best.inhalePow+0.25);
      }
    });

    // Update pig inhale state
    lgPigs.forEach(pig=>{
      if(pig.inhaling>0){ pig.inhaling--; }
      else { pig.inhalePow=Math.max(0,pig.inhalePow-0.04); }
    });

    // Tables
    lgPigs.forEach(p=>{ lgGoldPileDraw(p.x,pigY,p.fat); });

    // Notes
    lgNotes=lgNotes.filter(n=>!n.dead);
    for(const note of lgNotes){
      if(note.suckTarget){
        // Fly toward pig's mouth
        const pig=note.suckTarget;
        const tx=pig.x, ty=pigY-pig.fat*1.1;
        const dx=tx-note.x, dy=ty-note.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        note.suckSpeed=Math.min(0.25,note.suckSpeed+0.018);
        note.x+=dx*note.suckSpeed; note.y+=dy*note.suckSpeed;
        note.rot+=0.08;
        if(dist<10){
          // Absorbed!
          pig.fat=Math.min(pig.maxFat, pig.fat+0.7+Math.random()*0.5);
          pig.wiggle=Math.min(pig.wiggle+5,15);
          pig.sparks.push({x:(Math.random()-.5)*pig.fat,y:-pig.fat*.6,al:.9,sz:7+Math.random()*5,vx:(Math.random()-.5)*2,vy:-1.2-Math.random()*.8});
          note.dead=true;
        }
      } else {
        // Regular gravity fall
        note.y+=note.vy; note.x+=note.vx; note.rot+=note.spin;
        // Stop notes from passing the pig tier — if they reach below midY without being grabbed, still catch
        if(note.y>floorY){
          // Note reached floor without being absorbed — teleport back to top (shouldn't normally happen)
          note.y=-20; note.x=Math.random()*W*.9+W*.05;
        }
      }
      drawNote(note);
    }

    // Pigs
    lgPigs.forEach(pig=>drawPig(pig,lgT));

    // Coins (spit out by pigs)
    lgCoins=lgCoins.filter(c=>!c.dead);
    for(const c of lgCoins){
      if(!c.landed){
        c.vy+=0.1; c.x+=c.vx; c.y+=c.vy;
        if(c.y>=floorY){
          c.y=floorY; c.landed=true; c.landT=lgT;
          // Alert nearby people
          lgPeople.forEach(p=>{
            if(Math.abs(p.bx-c.x)<W*.45){
              p.target=c.x+(Math.random()-.5)*30;
              p.scramble=100;
            }
          });
          // Spawn a dust cloud at the coin
          lgDusts.push({
            x:c.x, y:floorY-10, radius:30+Math.random()*20,
            al:0.7, life:80, spin:(Math.random()-.5)*.06,
            puffs:Array.from({length:8},()=>({x:(Math.random()-.5)*50,y:(Math.random()-.5)*30,r:8+Math.random()*12})),
          });
        }
      } else {
        const age=lgT-c.landT; c.al=Math.max(0,1-age/50);
        if(age>50) c.dead=true;
      }
      if(!c.dead) drawCoin(c);
    }

    // Dust clouds
    lgDusts=lgDusts.filter(d=>d.al>0.02);
    lgDusts.forEach(d=>{
      d.life--; d.al=Math.max(0,d.al-0.008);
      // Expand slightly
      d.radius=Math.min(d.radius+0.15,60);
      // Shuffle puffs a tiny bit
      d.puffs.forEach(pf=>{pf.x+=(Math.random()-.5)*.8;pf.y+=(Math.random()-.5)*.8;});
      drawDust(d);
    });

    // People
    for(const p of lgPeople){
      if(p.scramble>0){
        p.scramble--;
        if(p.target!==null) p.x+=(p.target-p.x)*.12;
      } else {
        p.x+=(p.bx-p.x)*.04; p.target=null;
      }
      drawPerson(p,lgT);
    }

    // Zone labels — opaque with backdrop to stay readable
    ctx.save();
    ctx.textAlign='center';
    const maxFat=Math.max(...lgPigs.map(p=>p.fat));
    const lblY1=pigY-maxFat*2.8;
    const lblY2=floorY+18;
    // Label backdrop
    ctx.font='bold 10px Outfit,sans-serif';
    const lbl1='B I L L I O N A I R E S', lbl2='E V E R Y O N E   E L S E';
    const w1=ctx.measureText(lbl1).width+16, w2=ctx.measureText(lbl2).width+16;
    ctx.fillStyle='rgba(2,8,24,.72)';
    ctx.fillRect(W/2-w1/2,lblY1-11,w1,14);
    ctx.fillRect(W/2-w2/2,lblY2-11,w2,14);
    ctx.fillStyle='rgba(212,160,23,.75)';
    ctx.fillText(lbl1,W/2,lblY1);
    ctx.fillStyle='rgba(148,163,184,.55)';
    ctx.fillText(lbl2,W/2,lblY2);
    ctx.restore();
  }
  //  Loop + theme switching
  // ══════════════════════════════════════════════════════════════════════════
  const STEPS={bio:stepBio,composer:stepComposer,cats:stepCats,cv:stepCV,gallery:stepGallery,ff:stepFF,etf:stepETF,cosmic:stepCosmic,legacy:stepLegacy};
  const INITS={bio:initBio,composer:initComposer,cats:initCats,cv:initCV,gallery:initGallery,ff:initFF,etf:initETF,cosmic:initCosmic,legacy:initLegacy};

  function loop() { if(currentTheme) STEPS[currentTheme]?.(); requestAnimationFrame(loop); }

  function activateTheme(t) {
    if (t === currentTheme) { show(); return; } // same theme — re-show without re-init
    currentTheme = t;
    ctx.clearRect(0, 0, W, H);
    INITS[t]?.();
    show();
  }

  document.querySelectorAll('[data-hero]').forEach(el=>{
    const t=el.dataset.hero;
    el.addEventListener('mouseenter',()=>activateTheme(t));
    el.addEventListener('mouseleave',()=>hide());

    if(el.tagName==='A'){
      // Nav links: show animation on touchstart; page navigates on touchend naturally
      el.addEventListener('touchstart',()=>activateTheme(t),{passive:true});
    } else {
      // Identity spans: tap to toggle — tap same span again to hide, tap elsewhere hides too
      el.addEventListener('touchstart',e=>{
        e.stopPropagation();
        if(currentTheme===t && backdrop.style.opacity==='1'){ hide(); }
        else { activateTheme(t); }
      },{passive:true});
    }
  });

  // Tap on anything that isn't a data-hero element collapses the backdrop on mobile
  document.addEventListener('touchstart',()=>hide(),{passive:true});

  loop();
  window._heroActivate = activateTheme;
})();
