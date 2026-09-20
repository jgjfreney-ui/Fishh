/* ===========================================================================
 * Ocean of Discovery — Phase Two Remaster Layer
 * Animated atmosphere + remaster celebration UI. The canvas is transparent and
 * input-free, so the restored gameplay engine remains authoritative underneath.
 * ======================================================================== */
(function () {
  "use strict";

  var D = window.GAMEDATA;
  if (!D) return;

  var stage = document.getElementById("stage");
  if (!stage) return;

  document.title = "Ocean of Discovery: Remastered";

  var fx = document.createElement("canvas");
  fx.id = "remaster-fx";
  fx.setAttribute("aria-hidden", "true");
  var game = document.getElementById("game");
  if (game && game.nextSibling) stage.insertBefore(fx, game.nextSibling);
  else stage.appendChild(fx);
  var ctx = fx.getContext("2d");

  var chip = document.createElement("div");
  chip.className = "rm-area-chip";
  stage.appendChild(chip);

  var W = 0, H = 0, DPR = 1, lastArea = null, chipTimer = 0;
  var seeds = [];
  for (var i = 0; i < 90; i++) {
    seeds.push({
      x: ((i * 47) % 101) / 100,
      y: ((i * 73 + 19) % 103) / 102,
      s: 0.35 + ((i * 29) % 70) / 100,
      p: ((i * 91) % 628) / 100,
      k: i % 5
    });
  }

  var P = {
    coral:      { accent:"#84efff", mote:"#fff0ba", mood:"Sunlit shallows", motif:"coral", density:0.85 },
    river:      { accent:"#9ee6b0", mote:"#e9ffd6", mood:"Freshwater current", motif:"river", density:0.62 },
    forest:     { accent:"#8cdda0", mote:"#d8ffc5", mood:"Drowned old-growth", motif:"forest", density:0.72 },
    secretcave: { accent:"#cbb8ff", mote:"#cffff1", mood:"Rootbound limestone", motif:"spores", density:0.58 },
    kelp:       { accent:"#61e0bd", mote:"#c8ffe1", mood:"Living green towers", motif:"kelp", density:0.78 },
    arctic:     { accent:"#b9efff", mote:"#ffffff", mood:"Under the ice", motif:"ice", density:0.74 },
    desert:     { accent:"#f6d989", mote:"#ffe7a4", mood:"Drowned golden ruins", motif:"sand", density:0.64 },
    opensea:    { accent:"#6bbaff", mote:"#cdeaff", mood:"Endless blue", motif:"open", density:0.42 },
    ancient:    { accent:"#e0bb78", mote:"#f4ddad", mood:"A sea out of time", motif:"fossil", density:0.46 },
    prism:      { accent:"#ff9fe1", mote:"#d8f6ff", mood:"Kaleidoscope reef", motif:"prism", density:0.86 },
    swamp:      { accent:"#b3c96a", mote:"#d7f29b", mood:"Brackish roots", motif:"swamp", density:0.60 },
    boneyard:   { accent:"#dfe5e5", mote:"#f8fbff", mood:"Whale-fall graveyard", motif:"bones", density:0.44 },
    storm:      { accent:"#a9c7ff", mote:"#e1ebff", mood:"Thunder over black water", motif:"storm", density:0.52 },
    mountain:   { accent:"#d2edff", mote:"#ffffff", mood:"Clear high water", motif:"peaks", density:0.52 },
    olympus:    { accent:"#ffe397", mote:"#fff4c2", mood:"Above the clouds", motif:"olympus", density:0.88 },
    jungle:     { accent:"#72e67c", mote:"#cbff9c", mood:"Flooded emerald canopy", motif:"jungle", density:0.82 },
    alien:      { accent:"#bd9cff", mote:"#bdfdff", mood:"An ocean beneath alien moons", motif:"alien", density:0.84 },
    grotto:     { accent:"#72efff", mote:"#fff4b8", mood:"The jewel beneath the dunes", motif:"gems", density:0.78 },
    ashen:      { accent:"#ff7b4c", mote:"#ffbb68", mood:"Heat beneath the sea", motif:"embers", density:0.66 },
    pirate:     { accent:"#e8c76f", mote:"#ffe8a8", mood:"Cursed wreckwater", motif:"pirate", density:0.56 },
    backrooms:  { accent:"#e6d567", mote:"#fff6a4", mood:"You weren't supposed to find this", motif:"liminal", density:0.36 },
    japan:      { accent:"#ff9bb1", mote:"#ffd9e4", mood:"Petals above hidden water", motif:"petals", density:0.80 },
    oilrig:     { accent:"#e0b858", mote:"#cfbf88", mood:"Oil, rust and old machinery", motif:"oil", density:0.44 },
    flooded:    { accent:"#78c9aa", mote:"#c8eee1", mood:"Inside the drowned hold", motif:"cargo", density:0.58 },
    cave:       { accent:"#a7b9ff", mote:"#b9ffe8", mood:"Lanterns in the gloom", motif:"gloom", density:0.65 },
    cloud:      { accent:"#d9f4ff", mote:"#ffffff", mood:"Where the sea meets the sky", motif:"cloud", density:0.90 },
    trench:     { accent:"#6d8dff", mote:"#9cc8ff", mood:"Below the last blue light", motif:"trench", density:0.46 },
    sanctuary:  { accent:"#d8b6ff", mote:"#fff0be", mood:"Starlight Sanctuary", motif:"aurora", density:0.94 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rgb(hex, a) {
    hex = String(hex || "#ffffff").replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return "rgba("+r+","+g+","+b+","+a+")";
  }

  function resize() {
    var w = Math.max(1, stage.clientWidth || window.innerWidth || 1);
    var h = Math.max(1, stage.clientHeight || window.innerHeight || 1);
    var d = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && d === DPR) return;
    W = w; H = h; DPR = d;
    fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR);
    fx.style.width = W + "px"; fx.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function remasterStartScreen() {
    var panel = document.querySelector(".start-panel");
    if (!panel || panel.dataset.remasterCelebrated === "1") return;
    panel.dataset.remasterCelebrated = "1";

    var h1 = panel.querySelector("h1");
    if (h1) h1.innerHTML = "🌊 Ocean of Discovery 🐙<span class=\"rm-title-mark\">Remastered</span>";
    var sub = panel.querySelector(".sub");
    if (sub) sub.textContent = "Dive again. Rediscover everything. The ocean remembers.";

    var banner = panel.querySelector(".update-banner");
    if (banner) {
      banner.classList.add("rm-celebration");
      banner.innerHTML = "<span class=\"rm-celebration-title\">✨ Welcome back to the Remaster ✨</span>" +
        "<span class=\"rm-celebration-copy\">The restored original now has richer living biomes, refreshed creature presentation, distinctive shiny effects, warmer layered music, and a new visual pass built around the game you remember.</span>" +
        "<span class=\"rm-celebration-icons\"><span>🐠</span><span>🫧</span><span>💎</span><span>🐙</span><span>🌌</span></span>";
      var badge = document.createElement("div");
      badge.className = "rm-remaster-badge";
      badge.textContent = "✦ Phase Two · Celebration Build ✦";
      banner.parentNode.insertBefore(badge, banner);
    }
  }

  var mo = new MutationObserver(remasterStartScreen);
  mo.observe(document.body, { childList:true, subtree:true });
  remasterStartScreen();

  function areaChanged(id, profile) {
    if (id === lastArea) return;
    lastArea = id;
    var loc = D.LOCATIONS[id];
    chip.textContent = (loc ? loc.name : id) + " · " + profile.mood;
    chip.classList.add("show");
    clearTimeout(chipTimer);
    chipTimer = setTimeout(function () { chip.classList.remove("show"); }, 3000);
  }

  function depthRatio(run) {
    if (!run || !run.loc || !run.diver) return 0;
    return clamp(run.diver.y / Math.max(1, run.loc.maxDepth * D.PXPM), 0, 1);
  }

  function baseGrade(profile, depth, night) {
    var top = ctx.createLinearGradient(0, 0, 0, H);
    top.addColorStop(0, rgb(profile.accent, 0.025 + depth * 0.02));
    top.addColorStop(0.55, "rgba(0,0,0,0)");
    top.addColorStop(1, "rgba(0,8,18," + (0.03 + depth * 0.08) + ")");
    ctx.fillStyle = top; ctx.fillRect(0,0,W,H);

    var vignette = ctx.createRadialGradient(W*0.5,H*0.45,Math.min(W,H)*0.18,W*0.5,H*0.48,Math.max(W,H)*0.72);
    vignette.addColorStop(0,"rgba(0,0,0,0)");
    vignette.addColorStop(1,"rgba(0,5,12," + (night ? 0.13 : 0.075) + ")");
    ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);
  }

  function motes(profile, t, depth) {
    var n = Math.floor(22 + profile.density * 42);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i=0; i<n; i++) {
      var s=seeds[i], drift=t*(2.2+s.s*4.4);
      var x=(s.x*W + Math.sin(s.p+t*(0.12+s.s*0.08))*28 + drift*(s.k===0?0.8:0.18)) % (W+40)-20;
      var y=(s.y*H - drift*(0.18+s.s*0.36) + H*4) % (H+30)-15;
      var a=(0.035 + s.s*0.10) * profile.density * (0.75 + depth*0.35);
      ctx.fillStyle=rgb(profile.mote,a);
      var r=s.k===0?1.8:0.7+s.s*1.2;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function caustics(profile, t, depth) {
    if (depth > 0.72) return;
    ctx.save(); ctx.globalCompositeOperation="screen";
    ctx.strokeStyle=rgb(profile.accent,0.035*(1-depth));
    ctx.lineWidth=2;
    for (var i=0;i<7;i++) {
      var y=H*(0.12+i*0.105)+Math.sin(t*0.7+i)*7;
      ctx.beginPath();
      for (var x=-40;x<=W+40;x+=32) {
        var yy=y+Math.sin(x*0.018+t*0.8+i)*5;
        if (x===-40) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function kelp(t) {
    ctx.save();
    for (var side=0; side<2; side++) for (var i=0;i<5;i++) {
      var baseX=side?W-(12+i*12):(12+i*12), sway=Math.sin(t*0.65+i*0.8)*(14+i*2);
      ctx.strokeStyle="rgba(30,130,94,"+(0.08+i*0.012)+")"; ctx.lineWidth=5-i*0.45;
      ctx.beginPath(); ctx.moveTo(baseX,H+20); ctx.bezierCurveTo(baseX+sway,H*0.72,baseX-sway*0.4,H*0.42,baseX+sway,H*0.12); ctx.stroke();
    }
    ctx.restore();
  }

  function forest(t) {
    ctx.save();
    for(var i=0;i<6;i++){
      var x=(i+0.35)*W/6+Math.sin(t*0.12+i)*6;
      ctx.fillStyle="rgba(12,54,34,"+(0.035+i%2*0.018)+")";
      ctx.fillRect(x-9,0,18,H);
      ctx.strokeStyle="rgba(80,170,100,0.045)";ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(x,H*0.45);ctx.lineTo(x+(i%2?55:-55),H*0.26);ctx.stroke();
    }
    ctx.restore();
  }

  function ice(t) {
    ctx.save();ctx.strokeStyle="rgba(224,249,255,0.12)";ctx.lineWidth=1.2;
    for(var i=0;i<7;i++){
      var x=i*W/6+Math.sin(i*3.1)*18;
      ctx.beginPath();ctx.moveTo(x,-5);ctx.lineTo(x+18+Math.sin(t*0.2+i)*4,30);ctx.lineTo(x+7,55);ctx.stroke();
    }
    ctx.restore();
  }

  function sand(t) {
    ctx.save();ctx.strokeStyle="rgba(242,210,126,0.07)";ctx.lineWidth=2;
    for(var i=0;i<6;i++){
      var y=H*(0.3+i*0.1)+Math.sin(t*0.35+i)*10;
      ctx.beginPath();ctx.moveTo(-20,y);ctx.bezierCurveTo(W*.3,y-16,W*.65,y+14,W+20,y-5);ctx.stroke();
    }
    ctx.restore();
  }

  function openSea(t, profile) {
    ctx.save();
    ctx.strokeStyle=rgb(profile.accent,0.035);ctx.lineWidth=3;
    for(var i=0;i<3;i++){
      var x=W*(0.18+i*.33)+Math.sin(t*.08+i)*30,y=H*(0.58+i*.08);
      ctx.beginPath();ctx.ellipse(x,y,70+i*20,12+i*2,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }

  function fossil(t) {
    ctx.save();ctx.strokeStyle="rgba(236,211,166,0.06)";ctx.lineWidth=3;
    for(var i=0;i<4;i++){
      var x=W*(.15+i*.25),y=H*(.65+(i%2)*.12);
      ctx.beginPath();ctx.arc(x,y,24+i*5,Math.PI*.15,Math.PI*1.85);ctx.stroke();
      for(var r=0;r<4;r++){ctx.beginPath();ctx.moveTo(x-8+r*6,y-14);ctx.lineTo(x-20+r*12,y-35);ctx.stroke();}
    }
    ctx.restore();
  }

  function prism(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    var cols=["rgba(255,105,190,.045)","rgba(95,225,255,.045)","rgba(255,232,120,.04)"];
    for(var i=0;i<3;i++){
      ctx.fillStyle=cols[i];ctx.beginPath();ctx.moveTo(W*(.18+i*.27),-20);ctx.lineTo(W*(.32+i*.22),H);ctx.lineTo(W*(.39+i*.22),H);ctx.lineTo(W*(.24+i*.27),-20);ctx.fill();
    }
    ctx.restore();
  }

  function roots(t) {
    ctx.save();ctx.strokeStyle="rgba(82,102,35,0.12)";ctx.lineWidth=5;
    for(var i=0;i<7;i++){
      var x=i*W/6;ctx.beginPath();ctx.moveTo(x,-10);ctx.bezierCurveTo(x+Math.sin(t*.2+i)*18,H*.25,x-30,H*.46,x+15,H*.62);ctx.stroke();
    }
    ctx.restore();
  }

  function bones() {
    ctx.save();ctx.strokeStyle="rgba(235,240,236,0.07)";ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(W*.18,H*.82,65,Math.PI,Math.PI*1.85);ctx.stroke();
    ctx.beginPath();ctx.arc(W*.82,H*.76,92,Math.PI*1.12,Math.PI*1.9);ctx.stroke();
    for(var i=0;i<5;i++){ctx.beginPath();ctx.moveTo(W*.16+i*14,H*.79);ctx.lineTo(W*.12+i*20,H*.69);ctx.stroke();}
    ctx.restore();
  }

  function storm(t) {
    var flash=(Math.sin(t*0.47)+Math.sin(t*1.73)*0.35)>1.20;
    if(!flash)return;
    ctx.save();ctx.strokeStyle="rgba(210,230,255,0.28)";ctx.lineWidth=2;
    var x=W*(.2+((Math.floor(t)%7)/10));ctx.beginPath();ctx.moveTo(x,-10);ctx.lineTo(x-18,H*.18);ctx.lineTo(x+5,H*.31);ctx.lineTo(x-26,H*.52);ctx.stroke();ctx.restore();
  }

  function peaks() {
    ctx.save();ctx.fillStyle="rgba(210,235,255,0.035)";
    ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(W*.18,H*.42);ctx.lineTo(W*.30,H);ctx.lineTo(W*.55,H*.30);ctx.lineTo(W*.73,H);ctx.lineTo(W*.88,H*.47);ctx.lineTo(W,H);ctx.closePath();ctx.fill();ctx.restore();
  }

  function clouds(t, gold) {
    ctx.save();ctx.fillStyle=gold?"rgba(255,236,181,0.07)":"rgba(242,251,255,0.08)";
    for(var i=0;i<6;i++){
      var x=((i*.21+t*.006)%1.25-.12)*W,y=H*(.12+(i%3)*.16);
      ctx.beginPath();ctx.ellipse(x,y,50+12*(i%2),16,0,0,Math.PI*2);ctx.fill();
    }ctx.restore();
  }

  function leaves(t) {
    ctx.save();ctx.fillStyle="rgba(130,230,108,0.07)";
    for(var i=0;i<12;i++){
      var s=seeds[i],x=(s.x*W+Math.sin(t*.4+s.p)*40),y=(s.y*H+t*(5+s.s*3))%(H+40)-20;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.5+s.p));ctx.beginPath();ctx.ellipse(0,0,8,3,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }ctx.restore();
  }

  function alien(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<18;i++){var s=seeds[i];ctx.fillStyle=i%3?"rgba(188,150,255,.11)":"rgba(140,248,255,.14)";ctx.fillRect(s.x*W,s.y*H,1+(i%2),1+(i%2));}
    ctx.strokeStyle="rgba(182,138,255,.08)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.80,H*.18,44+Math.sin(t*.3)*2,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(W*.20,H*.28,24,0,Math.PI*2);ctx.stroke();ctx.restore();
  }

  function gems(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    var cols=["#ff708e","#70b9ff","#78efb1","#ffe274","#d093ff"];
    for(var i=0;i<10;i++){var s=seeds[i],a=.08+.06*Math.max(0,Math.sin(t*1.5+s.p));ctx.fillStyle=rgb(cols[i%cols.length],a);ctx.fillRect(s.x*W,s.y*H,2,2);}
    ctx.restore();
  }

  function embers(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<22;i++){var s=seeds[i],x=s.x*W+Math.sin(t+s.p)*9,y=H-((s.y*H+t*(12+s.s*12))%(H+20));ctx.fillStyle="rgba(255,119,54,"+(.05+s.s*.08)+")";ctx.fillRect(x,y,1+(i%3===0),1+(i%3===0));}ctx.restore();
  }

  function pirate(t) {
    ctx.save();ctx.strokeStyle="rgba(235,200,105,0.06)";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(W*.12,H*.78);ctx.lineTo(W*.12,H*.42);ctx.moveTo(W*.12,H*.50);ctx.lineTo(W*.25,H*.58);ctx.stroke();
    ctx.fillStyle="rgba(255,225,120,"+(.05+.04*Math.max(0,Math.sin(t*1.7)))+")";ctx.fillRect(W*.74,H*.75,3,3);ctx.fillRect(W*.78,H*.79,2,2);ctx.restore();
  }

  function liminal(t) {
    ctx.save();ctx.fillStyle="rgba(255,248,166,0.035)";
    for(var i=0;i<5;i++){var y=H*(.15+i*.18);ctx.fillRect(0,y+Math.sin(t*.25+i)*2,W,2);}
    ctx.fillStyle="rgba(10,10,0,0.025)";for(var x=0;x<W;x+=56)ctx.fillRect(x,0,1,H);ctx.restore();
  }

  function petals(t) {
    ctx.save();ctx.fillStyle="rgba(255,190,210,0.16)";
    for(var i=0;i<18;i++){var s=seeds[i],x=(s.x*W+t*(5+s.s*5)+Math.sin(t+s.p)*20)%(W+30)-15,y=(s.y*H+t*(8+s.s*7))%(H+30)-15;ctx.save();ctx.translate(x,y);ctx.rotate(t*.5+s.p);ctx.fillRect(-2,-1,4,2);ctx.restore();}ctx.restore();
  }

  function oil(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    var g=ctx.createLinearGradient(0,H*.72,W,H*.72);g.addColorStop(0,"rgba(255,120,80,.025)");g.addColorStop(.34,"rgba(95,210,255,.035)");g.addColorStop(.68,"rgba(190,100,255,.025)");g.addColorStop(1,"rgba(255,210,90,.03)");ctx.fillStyle=g;ctx.fillRect(0,H*.68,W,H*.16);
    ctx.strokeStyle="rgba(210,190,120,.055)";ctx.lineWidth=2;for(var i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-20,H*(.25+i*.17));ctx.lineTo(W+20,H*(.28+i*.17)+Math.sin(t*.3+i)*8);ctx.stroke();}ctx.restore();
  }

  function cargo() {
    ctx.save();ctx.strokeStyle="rgba(130,190,165,0.055)";ctx.lineWidth=2;
    for(var i=0;i<5;i++){var x=W*(.05+i*.22),y=H*(.62+(i%2)*.11);ctx.strokeRect(x,y,92,42);ctx.beginPath();ctx.moveTo(x+46,y);ctx.lineTo(x+46,y+42);ctx.stroke();}ctx.restore();
  }

  function gloom(t) {
    ctx.save();ctx.globalCompositeOperation="screen";
    for(var i=0;i<8;i++){var s=seeds[i],p=.04+.06*Math.max(0,Math.sin(t*1.2+s.p));ctx.fillStyle="rgba(150,255,220,"+p+")";ctx.beginPath();ctx.arc(s.x*W,s.y*H,2+s.s*2,0,Math.PI*2);ctx.fill();}ctx.restore();
  }

  function trench(depth) {
    ctx.save();var g=ctx.createLinearGradient(0,0,W*.65,H);g.addColorStop(0,"rgba(120,160,255,"+(0.05*(1-depth))+")");g.addColorStop(.38,"rgba(40,80,150,0.015)");g.addColorStop(.55,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W*.38,0);ctx.lineTo(W*.72,H);ctx.lineTo(W*.50,H);ctx.closePath();ctx.fill();ctx.restore();
  }

  function aurora(t) {
    ctx.save();ctx.globalCompositeOperation="screen";ctx.lineWidth=14;
    var cols=["rgba(120,245,220,.045)","rgba(205,150,255,.05)","rgba(255,220,135,.035)"];
    for(var j=0;j<3;j++){ctx.strokeStyle=cols[j];ctx.beginPath();for(var x=-40;x<W+40;x+=24){var y=H*(.18+j*.08)+Math.sin(x*.012+t*.35+j)*24;if(x===-40)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}ctx.restore();
  }

  function drawMotif(profile, t, depth) {
    switch(profile.motif){
      case "coral": caustics(profile,t,depth); break;
      case "river": caustics(profile,t,depth); leaves(t*.35); break;
      case "forest": forest(t); break;
      case "spores": gloom(t); break;
      case "kelp": kelp(t); break;
      case "ice": ice(t); break;
      case "sand": sand(t); break;
      case "open": openSea(t,profile); break;
      case "fossil": fossil(t); break;
      case "prism": prism(t); break;
      case "swamp": roots(t); break;
      case "bones": bones(); break;
      case "storm": storm(t); break;
      case "peaks": peaks(); caustics(profile,t,depth); break;
      case "olympus": clouds(t,true); aurora(t*.45); break;
      case "jungle": leaves(t); roots(t*.6); break;
      case "alien": alien(t); break;
      case "gems": gems(t); break;
      case "embers": embers(t); break;
      case "pirate": pirate(t); break;
      case "liminal": liminal(t); break;
      case "petals": petals(t); break;
      case "oil": oil(t); break;
      case "cargo": cargo(); break;
      case "gloom": gloom(t); break;
      case "cloud": clouds(t,false); break;
      case "trench": trench(depth); break;
      case "aurora": aurora(t); break;
    }
  }

  function diverBubbles(run, t) {
    if (!run || !run.diver || !run.loc) return;
    var st = window.DEEPSEA && window.DEEPSEA.state ? window.DEEPSEA.state() : null;
    var rocOn = st && st.items && st.items.rocfeather && !(st.itemsOff && st.itemsOff.rocfeather);
    var skyReveal = (rocOn && run.diver.y < 120) ? -470 : (run.diver.y < 80 ? -290 : -150);
    var camX = clamp(run.diver.x - W/2, 0, Math.max(0, run.loc.worldWidth - W));
    var camY = clamp(run.diver.y - H/2, skyReveal, Math.max(0, run.loc.maxDepth * D.PXPM + 120 - H));
    var x = run.diver.x - camX, y = run.diver.y - camY;
    ctx.save();ctx.strokeStyle="rgba(210,247,255,0.18)";ctx.lineWidth=1;
    for(var i=0;i<3;i++){var ph=t*(.8+i*.1)+i*2.2,r=2+i*.45;ctx.beginPath();ctx.arc(x-8+Math.sin(ph)*5,y-18-((t*(7+i*2)+i*9)%28),r,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }

  function aquariumFx(t) {
    var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"rgba(110,220,255,.025)");g.addColorStop(.5,"rgba(255,255,255,0)");g.addColorStop(1,"rgba(135,110,255,.025)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalCompositeOperation="screen";ctx.fillStyle="rgba(220,250,255,.08)";for(var i=0;i<20;i++){var s=seeds[i],x=s.x*W,y=(s.y*H-t*(4+s.s*5)+H*3)%H;ctx.fillRect(x,y,1,1);}ctx.restore();
  }

  function render(now) {
    resize();
    ctx.clearRect(0,0,W,H);
    var api=window.DEEPSEA;
    if (!api || !api.scene) { requestAnimationFrame(render); return; }
    var scene=api.scene();
    var t=(now||performance.now())/1000;
    if (scene === "dive" && api.run) {
      var run=api.run();
      if(run && run.area){
        var profile=P[run.area] || P.coral;
        areaChanged(run.area,profile);
        var depth=depthRatio(run), night=!!run.night;
        baseGrade(profile,depth,night);
        motes(profile,t,depth);
        drawMotif(profile,t,depth);
        diverBubbles(run,t);
      }
    } else if (scene === "aquarium") {
      aquariumFx(t);
    }
    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize, { passive:true });
  resize();
  requestAnimationFrame(render);

  window.REMASTER = {
    version:"2.0-m1",
    milestone:"Phase Two — Celebration Build",
    profiles:P,
    canvas:fx,
    refreshStart:remasterStartScreen
  };
})();
