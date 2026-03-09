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

  const show = () => { backdrop.style.opacity = '1'; };
  const hide = () => { backdrop.style.opacity = '0'; };

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 1 — Bioinformagician
  // ══════════════════════════════════════════════════════════════════════════
  const PALETTE = ['#39ff14','#38bdf8','#ff4136','#ff00ff','#ffffff','#fbbf24'];
  let particles = [], sparks = [];

  function initBio() {
    particles = []; sparks = [];
    const n = Math.min(140, Math.floor((W * H) / 8000));
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35,
        r: Math.random()*2.5+.5,
        color: PALETTE[Math.floor(Math.random()*PALETTE.length)],
        alpha: Math.random()*.55+.2,
        sparkCD: Math.floor(Math.random()*220+80),
      });
    }
  }

  function stepBio() {
    ctx.fillStyle = 'rgba(2,8,24,0.22)'; ctx.fillRect(0,0,W,H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);
      g.addColorStop(0, p.color); g.addColorStop(.4, p.color+'66'); g.addColorStop(1,'transparent');
      ctx.globalAlpha = p.alpha; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*5,0,Math.PI*2); ctx.fill();
      if (--p.sparkCD <= 0) {
        p.sparkCD = Math.floor(Math.random()*220+80);
        for (let j=0;j<6;j++) {
          const a=(j/6)*Math.PI*2+Math.random()*.5, s=Math.random()*1.8+.5;
          sparks.push({x:p.x,y:p.y,color:p.color,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:Math.random()*.04+.025});
        }
      }
    }
    for (let i=sparks.length-1;i>=0;i--) {
      const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.vx*=.96; s.vy*=.96; s.life-=s.decay;
      if (s.life<=0){sparks.splice(i,1);continue;}
      ctx.globalAlpha=s.life*.9; ctx.strokeStyle=s.color; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*3,s.y-s.vy*3); ctx.stroke();
    }
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
    // d6 — cube
    const s=22;
    const d6v=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];
    const d6f=[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];

    // d4 — tetrahedron
    const r4=28,phi=Math.atan(Math.SQRT2);
    const mk=(a)=>[r4*Math.sin(phi)*Math.cos(a),-r4*Math.cos(phi),r4*Math.sin(phi)*Math.sin(a)];
    const d4v=[[0,r4,0],mk(0),mk(2*Math.PI/3),mk(4*Math.PI/3)];
    const d4f=[[0,1,2],[0,2,3],[0,3,1],[1,3,2]];

    // d8 — octahedron
    const r8=28;
    const d8v=[[r8,0,0],[-r8,0,0],[0,r8,0],[0,-r8,0],[0,0,r8],[0,0,-r8]];
    const d8f=[[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]];

    // d20 — icosahedron
    const G=(1+Math.sqrt(5))/2, r20=24;
    const rawI=[[-1,G,0],[1,G,0],[-1,-G,0],[1,-G,0],[0,-1,G],[0,1,G],[0,-1,-G],[0,1,-G],[G,0,-1],[G,0,1],[-G,0,-1],[-G,0,1]];
    const d20v=rawI.map(v=>{const l=Math.hypot(...v);return v.map(x=>x/l*r20);});
    const d20f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];

    // d10 — pentagonal trapezohedron (simplified as d10-like polyhedron using 10 faces)
    const r10=24;
    const d10v=[];
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5; d10v.push([r10*Math.cos(a),8,r10*Math.sin(a)]);}
    for(let i=0;i<5;i++){const a=(i+.5)*2*Math.PI/5; d10v.push([r10*Math.cos(a),-8,r10*Math.sin(a)]);}
    d10v.push([0,r10,0]); d10v.push([0,-r10,0]);
    const d10f=[[10,0,1],[10,1,2],[10,2,3],[10,3,4],[10,4,0],[11,5,6],[11,6,7],[11,7,8],[11,8,9],[11,9,5],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]];

    return [
      {verts:d6v,  faces:d6f,  color:'#a78bfa', label:'d6'},
      {verts:d4v,  faces:d4f,  color:'#38bdf8', label:'d4'},
      {verts:d8v,  faces:d8f,  color:'#f59e0b', label:'d8'},
      {verts:d20v, faces:d20f, color:'#4ade80', label:'d20'},
      {verts:d10v, faces:d10f, color:'#fb923c', label:'d10'},
    ];
  }

  const GLYPHS='⚔🗡✦◈⬡♪♫✧⟡⬟☽★◉⌬⌖♞⚡∞⚜Ω∆ΣΛΦΨд☆⊕⊗⊛❖✺◊⬠⬡⌘⎈⚹⚳⚵⎊⎋⚑✵⊹⊸⋮'.split('').filter(c=>c.trim());
  let diceObjs=[], glyphObjs=[], compTime=0;

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
        scale:.65+Math.random()*.7, fov:160,
      };
    });
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

      d.rx+=d.drx; d.ry+=d.dry; d.rz+=d.drz;
      ctx.globalAlpha=.88; drawDie(d);
    }

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

  let cats=[], catTime=0;

  function initCats() {
    catTime=0;
    cats=[
      makeCat(W*.28,H*.62,1.3,'#d4922a',.9),
      makeCat(W*.68,H*.58,1.0,'#a06030',.7),
    ];
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
        cat.tx=80+Math.random()*(W-160); cat.ty=H*.38+Math.random()*(H*.48);
      } else { cat.state=r<.75?'sit':'look'; cat.stateLen=Math.random()*200+100; }
    }
    if (cat.state==='walk') {
      const dx=cat.tx-cat.x, dy=cat.ty-cat.y, dist=Math.hypot(dx,dy);
      if (dist>3) {
        cat.x+=dx/dist*cat.spd; cat.y+=dy/dist*cat.spd*.5;
        cat.dir=dx>0?1:-1; cat.walk+=.18;
      } else { cat.state='sit'; cat.stateLen=200; cat.stateT=0; }
    }
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

    // Body
    const bob=state==='walk'?Math.sin(walk)*2.5:0;
    ctx.beginPath(); ctx.ellipse(0,20+bob,21,27,0,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();

    // Head
    ctx.beginPath(); ctx.arc(0,-19+bob,19,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();

    // Ears + inner
    [['-13,-35','-23,-56','-1,-37'],['13,-35','23,-56','1,-37']].forEach(([a,b,c],ei)=>{
      const pts=[a,b,c].map(s=>s.split(',').map(Number));
      ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]+bob); ctx.lineTo(pts[1][0],pts[1][1]+bob); ctx.lineTo(pts[2][0],pts[2][1]+bob); ctx.closePath();
      ctx.fillStyle=col; ctx.fill();
      // Inner ear (scaled inward)
      ctx.save(); ctx.translate((pts[0][0]+pts[2][0])/2,(pts[0][1]+pts[2][1])/2+bob); ctx.scale(.55,.55);
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
    for (const c of cats) { updateCat(c); drawCat(c); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 4 — CV  (warm academic: floating mathematical / Greek symbols)
  // ══════════════════════════════════════════════════════════════════════════
  const CV_SYMS = 'αβγδεζηθλμνξπρστυφψω∂∇∫∑∏ΔΣΩ∞≈≠±√∝∈∀∃⊂∪∩⊕∠∥⊥ℵℏℒℝ'.split('').filter(c=>c.trim());
  let cvGlyphs = [], cvTime = 0;

  function initCV() {
    cvTime = 0;
    cvGlyphs = Array.from({length:45}, () => ({
      g: CV_SYMS[Math.floor(Math.random()*CV_SYMS.length)],
      x: Math.random()*W, y: Math.random()*H,
      sz: 11 + Math.random()*30,
      vx: (Math.random()-.5)*.11, vy: (Math.random()-.5)*.09,
      alpha: .05 + Math.random()*.22,
      phase: Math.random()*Math.PI*2, pspd: .18+Math.random()*.35,
      color: Math.random()<.55 ? '#e2b96e' : (Math.random()<.5 ? '#a78bfa' : '#94a3b8'),
    }));
  }

  function stepCV() {
    cvTime += .007;
    ctx.fillStyle='rgba(10,5,2,0.22)'; ctx.fillRect(0,0,W,H);
    // Warm amber radial
    const rg=ctx.createRadialGradient(W*.5,H*.45,0,W*.5,H*.45,Math.min(W,H)*.55);
    rg.addColorStop(0,'rgba(226,185,110,0.07)'); rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
    ctx.fontKerning='normal';
    for(const g of cvGlyphs){
      g.x+=g.vx; g.y+=g.vy;
      if(g.x<-30)g.x=W+30; if(g.x>W+30)g.x=-30;
      if(g.y<-30)g.y=H+30; if(g.y>H+30)g.y=-30;
      const a=g.alpha+Math.sin(cvTime*g.pspd+g.phase)*.06;
      ctx.globalAlpha=Math.max(.02,a); ctx.fillStyle=g.color;
      ctx.font=`${g.sz}px Georgia,serif`;
      ctx.fillText(g.g, g.x, g.y);
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME 5 — Gallery  (IMC / spectral flow: vibrant fluorescent cell blobs)
  // ══════════════════════════════════════════════════════════════════════════
  const GAL_COLORS=['#ff00ff','#39ff14','#38bdf8','#ff4136','#fbbf24','#a78bfa','#00ffcc','#ff69b4'];
  let galParts=[], galTime=0;

  function initGallery() {
    galTime=0; galParts=[];
    const n=Math.min(72,Math.floor((W*H)/10000));
    // Six loose fluorescent clusters — like an IMC image
    const centres=Array.from({length:6},()=>({
      x: W*.1+Math.random()*W*.8, y: H*.1+Math.random()*H*.8,
      col: GAL_COLORS[Math.floor(Math.random()*GAL_COLORS.length)],
    }));
    for(let i=0;i<n;i++){
      const c=centres[i%centres.length];
      galParts.push({
        x:c.x+(Math.random()-.5)*150, y:c.y+(Math.random()-.5)*100,
        vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.15,
        r:Math.random()*5+2, color:c.col,
        alpha:Math.random()*.55+.2,
        phase:Math.random()*Math.PI*2,
      });
    }
  }

  function stepGallery() {
    galTime+=.016;
    ctx.fillStyle='rgba(2,2,12,0.26)'; ctx.fillRect(0,0,W,H);
    for(const p of galParts){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0;
      if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      const pulse=.7+.3*Math.sin(galTime*2+p.phase);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*7);
      g.addColorStop(0,p.color); g.addColorStop(.35,p.color+'66'); g.addColorStop(1,'transparent');
      ctx.globalAlpha=p.alpha*pulse; ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*7,0,Math.PI*2); ctx.fill();
      // Bright core
      ctx.globalAlpha=p.alpha*pulse*.8;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
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
  //  THEME 7 — ETF Tools  (finance: animated candlestick bars + green glow)
  // ══════════════════════════════════════════════════════════════════════════
  let etfBars=[], etfDots=[], etfTime=0;

  function initETF() {
    etfTime=0;
    const n=Math.max(12, Math.floor(W/24));
    etfBars=Array.from({length:n},(_, i)=>{
      const h=40+Math.random()*H*.38;
      return {
        x:(i+.5)*(W/n), h, th:40+Math.random()*H*.38,
        spd:.012+Math.random()*.018,
        col:Math.random()<.68?'#39ff14':'#ef4444',
      };
    });
    etfDots=Array.from({length:35},()=>({
      x:Math.random()*W, y:H*.7+Math.random()*H*.3,
      vy:-.25-.35*Math.random(),
      alpha:Math.random()*.45+.1,
      life:Math.random(), decay:.002+Math.random()*.004,
    }));
  }

  function stepETF() {
    etfTime+=.013;
    ctx.fillStyle='rgba(2,10,3,0.24)'; ctx.fillRect(0,0,W,H);
    // Subtle green radial glow
    const rg=ctx.createRadialGradient(W*.5,H,0,W*.5,H,H);
    rg.addColorStop(0,'rgba(57,255,20,0.06)'); rg.addColorStop(.6,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);

    const bw=Math.max(6,(W/etfBars.length)*.62);
    for(const b of etfBars){
      b.h+=(b.th-b.h)*b.spd;
      if(Math.abs(b.h-b.th)<1){b.th=40+Math.random()*H*.42; b.col=b.th>b.h?'#39ff14':'#ef4444';}
      const by=H-b.h;
      ctx.globalAlpha=.18; ctx.fillStyle=b.col;
      ctx.fillRect(b.x-bw/2,by,bw,b.h);
      // Candle top
      ctx.globalAlpha=.55; ctx.fillRect(b.x-bw/2,by,bw,2);
      // Wick
      ctx.globalAlpha=.25; ctx.strokeStyle=b.col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(b.x,by-8); ctx.lineTo(b.x,by); ctx.stroke();
    }

    // Rising particles
    for(const d of etfDots){
      d.y+=d.vy; d.life-=d.decay;
      if(d.life<=0){d.y=H; d.x=Math.random()*W; d.life=.7+Math.random()*.5;}
      ctx.globalAlpha=d.life*d.alpha; ctx.fillStyle='#39ff14';
      ctx.beginPath(); ctx.arc(d.x,d.y,1.3,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Loop + theme switching
  // ══════════════════════════════════════════════════════════════════════════
  const STEPS={bio:stepBio,composer:stepComposer,cats:stepCats,cv:stepCV,gallery:stepGallery,ff:stepFF,etf:stepETF};
  const INITS={bio:initBio,composer:initComposer,cats:initCats,cv:initCV,gallery:initGallery,ff:initFF,etf:initETF};

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
})();
