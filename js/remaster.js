/* ===========================================================================
 * Deep Sea Diver — Phase Two Remaster Layer
 * Presentation-only effects: biome atmosphere, shiny/boss celebration, and
 * subtle screen treatment. Reads the public debug/state handle without altering
 * progression, physics, saves, catches, or unlock logic.
 * ======================================================================== */
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  if (!stage) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'remaster-fx';
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var particles = [];
  var lastArea = null;
  var t0 = performance.now();

  var MOODS = {
    coral:      { kind:'motes',    density:26, drift:10, glow:0.18, ray:0.18, tint:'120,225,255' },
    river:      { kind:'leaves',   density:18, drift:15, glow:0.08, ray:0.12, tint:'125,215,150' },
    forest:     { kind:'leaves',   density:28, drift:9,  glow:0.12, ray:0.18, tint:'110,210,135' },
    secretcave: { kind:'spores',   density:34, drift:4,  glow:0.28, ray:0.04, tint:'185,180,255' },
    kelp:       { kind:'motes',    density:24, drift:7,  glow:0.10, ray:0.13, tint:'80,210,170' },
    arctic:     { kind:'snow',     density:34, drift:5,  glow:0.12, ray:0.20, tint:'205,240,255' },
    desert:     { kind:'sand',     density:26, drift:13, glow:0.09, ray:0.10, tint:'255,222,145' },
    opensea:    { kind:'bubbles',  density:12, drift:4,  glow:0.06, ray:0.22, tint:'100,190,255' },
    ancient:    { kind:'dust',     density:22, drift:4,  glow:0.05, ray:0.06, tint:'210,175,105' },
    prism:      { kind:'spark',    density:32, drift:5,  glow:0.24, ray:0.22, tint:'255,165,245' },
    swamp:      { kind:'motes',    density:30, drift:4,  glow:0.06, ray:0.04, tint:'165,180,90' },
    boneyard:   { kind:'dust',     density:28, drift:3,  glow:0.06, ray:0.03, tint:'220,232,240' },
    storm:      { kind:'rain',     density:42, drift:24, glow:0.04, ray:0.02, tint:'170,195,235' },
    mountain:   { kind:'spark',    density:16, drift:6,  glow:0.10, ray:0.26, tint:'210,235,255' },
    olympus:    { kind:'spark',    density:42, drift:5,  glow:0.32, ray:0.34, tint:'255,232,150' },
    jungle:     { kind:'leaves',   density:38, drift:11, glow:0.10, ray:0.16, tint:'100,220,100' },
    alien:      { kind:'spores',   density:44, drift:7,  glow:0.38, ray:0.10, tint:'185,120,255' },
    grotto:     { kind:'spark',    density:36, drift:5,  glow:0.27, ray:0.20, tint:'120,240,255' },
    ashen:      { kind:'ash',      density:44, drift:10, glow:0.10, ray:0.01, tint:'235,115,70' },
    pirate:     { kind:'embers',   density:24, drift:7,  glow:0.14, ray:0.04, tint:'240,185,90' },
    backrooms:  { kind:'dust',     density:20, drift:2,  glow:0.02, ray:0.00, tint:'225,210,95' },
    japan:      { kind:'petals',   density:30, drift:12, glow:0.11, ray:0.15, tint:'255,175,205' },
    oilrig:     { kind:'soot',     density:32, drift:6,  glow:0.03, ray:0.01, tint:'175,155,105' },
    flooded:    { kind:'silt',     density:38, drift:3,  glow:0.04, ray:0.01, tint:'115,160,145' },
    cave:       { kind:'spores',   density:36, drift:3,  glow:0.22, ray:0.00, tint:'155,180,230' },
    cloud:      { kind:'spark',    density:28, drift:14, glow:0.20, ray:0.30, tint:'235,245,255' },
    trench:     { kind:'motes',    density:18, drift:2,  glow:0.10, ray:0.00, tint:'90,130,180' },
    sanctuary:  { kind:'spark',    density:48, drift:4,  glow:0.34, ray:0.28, tint:'170,255,220' }
  };

  function size() {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
    var rw = Math.floor(w * dpr), rh = Math.floor(h * dpr);
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw; canvas.height = rh;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
  }

  function moodFor(area) { return MOODS[area] || MOODS.opensea; }

  function reset(area) {
    lastArea = area;
    particles.length = 0;
    var m = moodFor(area);
    for (var i=0; i<m.density; i++) particles.push(makeParticle(m, true));
  }

  function makeParticle(m, initial) {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
    return {
      x: Math.random()*w,
      y: initial ? Math.random()*h : h + 12,
      z: 0.35 + Math.random()*0.9,
      s: 0.7 + Math.random()*2.1,
      a: 0.15 + Math.random()*0.48,
      p: Math.random()*Math.PI*2,
      r: Math.random()*1.0
    };
  }

  function drawRays(m, w, h, time) {
    if (!m.ray) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var i=0;i<4;i++) {
      var x = w*(0.12+i*0.26) + Math.sin(time*0.00018+i)*w*0.04;
      var g = ctx.createLinearGradient(x,0,x+80,h*0.75);
      g.addColorStop(0,'rgba('+m.tint+','+(m.ray*0.7)+')');
      g.addColorStop(1,'rgba('+m.tint+',0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.moveTo(x-18,0); ctx.lineTo(x+20,0); ctx.lineTo(x+130,h*0.76); ctx.lineTo(x+35,h*0.76); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticle(p,m,time,w,h) {
    var kind=m.kind;
    p.p += 0.01*p.z;
    var vx = (Math.sin(p.p)+0.35)*m.drift*0.018*p.z;
    var vy = -0.11*p.z;
    if (kind==='rain') { vx=-0.7; vy=4.8*p.z; }
    else if (kind==='snow') { vx=Math.sin(p.p)*0.28; vy=0.45*p.z; }
    else if (kind==='sand' || kind==='silt' || kind==='soot' || kind==='ash') { vx=(0.15+Math.sin(p.p))*0.35*m.drift/8; vy=-0.02+Math.cos(p.p)*0.05; }
    else if (kind==='petals' || kind==='leaves') { vx=0.25+Math.sin(p.p)*0.3; vy=0.18+Math.cos(p.p*0.7)*0.08; }
    p.x += vx; p.y += vy;
    if (p.y < -15 || p.y > h+15 || p.x < -25 || p.x > w+25) {
      var q=makeParticle(m,false); p.x=q.x; p.y=(vy>0?-10:h+10); p.z=q.z; p.s=q.s; p.a=q.a; p.p=q.p;
    }

    ctx.save(); ctx.globalAlpha=p.a;
    if (kind==='bubbles') {
      ctx.strokeStyle='rgba('+m.tint+',0.75)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.x,p.y,2.5*p.s,0,Math.PI*2); ctx.stroke();
    } else if (kind==='rain') {
      ctx.strokeStyle='rgba('+m.tint+',0.45)'; ctx.lineWidth=Math.max(1,p.z); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-5,p.y+15*p.z); ctx.stroke();
    } else if (kind==='petals' || kind==='leaves') {
      ctx.translate(p.x,p.y); ctx.rotate(Math.sin(p.p)*0.8); ctx.fillStyle='rgba('+m.tint+',0.72)'; ctx.beginPath(); ctx.ellipse(0,0,3.5*p.s,1.6*p.s,0,0,Math.PI*2); ctx.fill();
    } else if (kind==='spark') {
      ctx.globalCompositeOperation='screen'; ctx.fillStyle='rgba('+m.tint+',0.9)'; ctx.fillRect(p.x-0.6,p.y-3*p.s,1.2,6*p.s); ctx.fillRect(p.x-3*p.s,p.y-0.6,6*p.s,1.2);
    } else {
      ctx.fillStyle='rgba('+m.tint+',0.62)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.s,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function worldToScreen(obj, run, w, h) {
    if (!run || !run.diver || !obj) return null;
    // The engine camera follows the diver; this intentionally only provides a
    // soft approximate aura, so small camera easing differences are harmless.
    var cx = w*0.5, cy = h*0.5;
    return { x:cx+(obj.x-run.diver.x), y:cy+(obj.y-run.diver.y) };
  }

  function drawCatchAuras(run,w,h,time) {
    if (!run || !run.fish) return;
    ctx.save(); ctx.globalCompositeOperation='screen';
    for (var i=0;i<run.fish.length;i++) {
      var f=run.fish[i], pos=worldToScreen(f,run,w,h); if(!pos) continue;
      var shiny=!!f.shiny, boss=!!f.isBoss;
      if (!shiny && !boss) continue;
      var pulse=0.72+Math.sin(time*0.006+i)*0.18;
      var radius=boss?42:18;
      var col=boss?'255,115,95':'255,235,125';
      var g=ctx.createRadialGradient(pos.x,pos.y,1,pos.x,pos.y,radius*pulse);
      g.addColorStop(0,'rgba('+col+','+(boss?0.18:0.24)+')'); g.addColorStop(1,'rgba('+col+',0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pos.x,pos.y,radius*pulse,0,Math.PI*2); ctx.fill();
      if (shiny) {
        for(var s=0;s<3;s++) {
          var a=time*0.0018+s*2.094+i, rr=radius*(0.65+0.12*Math.sin(a*2));
          var sx=pos.x+Math.cos(a)*rr, sy=pos.y+Math.sin(a)*rr;
          ctx.globalAlpha=0.6; ctx.fillStyle='rgba(255,248,200,0.95)'; ctx.fillRect(sx-1,sy-4,2,8); ctx.fillRect(sx-4,sy-1,8,2);
        }
      }
    }
    ctx.restore();
  }

  function drawVignette(m,w,h) {
    var g=ctx.createRadialGradient(w/2,h*0.45,Math.min(w,h)*0.15,w/2,h*0.48,Math.max(w,h)*0.72);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,8,16,0.18)');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }

  function frame(time) {
    size();
    var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;
    ctx.clearRect(0,0,w,h);
    var api=window.DEEPSEA, run=api&&api.run?api.run():null;
    var area=run&&run.area;
    if (area) {
      if (area!==lastArea) reset(area);
      var m=moodFor(area);
      drawRays(m,w,h,time);
      for(var i=0;i<particles.length;i++) drawParticle(particles[i],m,time,w,h);
      drawCatchAuras(run,w,h,time);
      drawVignette(m,w,h);
      if(area==='backrooms' && Math.sin(time*0.004)>0.985){ctx.fillStyle='rgba(255,245,170,0.035)';ctx.fillRect(0,0,w,h);}
    } else {
      lastArea=null; particles.length=0;
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize',size,{passive:true});
  size(); requestAnimationFrame(frame);
})();