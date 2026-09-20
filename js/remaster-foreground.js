/* Deep Sea Diver: Recast — foreground art pass (diver + scoop net) */
(function(){
  'use strict';
  window.REMASTER_DIVER_LAYER=true;
  window.REMASTER_NET_LAYER=true;
  window.RECAST_DIVER_FOREGROUND_VERSION='2.0';
  var stage=document.getElementById('stage'); if(!stage) return;
  var D=window.GAMEDATA;
  var c=document.createElement('canvas');c.id='remaster-foreground';c.setAttribute('aria-hidden','true');stage.appendChild(c);
  var g=c.getContext('2d'),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  var SKIN=['#f4c9a3','#e8b088','#d39a6e','#b87a4f','#8d5524','#5a3318'];
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function colorRGB(v){
    if(Array.isArray(v)&&v.length>=3)return[+v[0]||0,+v[1]||0,+v[2]||0];
    var s=String(v==null?'#1f7d9c':v).trim(),m;
    if((m=s.match(/^#([0-9a-f]{3})$/i))){var h=m[1];return[parseInt(h[0]+h[0],16),parseInt(h[1]+h[1],16),parseInt(h[2]+h[2],16)];}
    if((m=s.match(/^#([0-9a-f]{6})$/i))){var x=m[1];return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)];}
    if((m=s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)))return[clamp(+m[1],0,255),clamp(+m[2],0,255),clamp(+m[3],0,255)];
    return[31,125,156];
  }
  function rgb(a){function h(n){return Math.round(clamp(n,0,255)).toString(16).padStart(2,'0');}return'#'+h(a[0])+h(a[1])+h(a[2]);}
  function mix(a,b,t){var x=colorRGB(a),y=colorRGB(b);return rgb([x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t]);}
  function size(){var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight,rw=Math.floor(w*dpr),rh=Math.floor(h*dpr);if(c.width!==rw||c.height!==rh){c.width=rw;c.height=rh;c.style.width=w+'px';c.style.height=h+'px';g.setTransform(dpr,0,0,dpr,0,0);}}
  function camera(run,state,w,h){var loc=run.loc||D.LOCATIONS[run.area];var skyReveal=(state&&state.items&&state.items.rocfeather&&run.diver.y<120)?-470:(run.diver.y<80?-290:-150);return{x:Math.round(clamp(run.diver.x-w/2,0,Math.max(0,loc.worldWidth-w))),y:Math.round(clamp(run.diver.y-h/2,skyReveal,Math.max(0,loc.maxDepth*D.PXPM+120-h)))};}
  function itemOn(state,id){return !!(state.items&&state.items[id]&&!(state.itemsOff&&state.itemsOff[id]));}

  function drawDiver(run,state,cam,t){
    var d=run.diver,x=Math.round(d.x-cam.x),y=Math.round(d.y-cam.y),face=d.face<0?-1:1;
    var dv=state.diver||{},up=state.upgrades||{},items=state.items||{};
    var suit=dv.suit||'#1f7d9c';if(suit==='camo'){var loc=run.loc||D.LOCATIONS[run.area];suit=mix(loc.topColor||'#3b9fc0',loc.deepColor||'#05243a',clamp(d.y/Math.max(1,loc.maxDepth*D.PXPM),0,1));}
    var accent=dv.suitAccent||'#ffd24a',trim=dv.suitTrim||'#bfe9ff';
    var skin=(typeof dv.skin==='string'&&/^(#|rgb)/i.test(dv.skin))?dv.skin:(SKIN[dv.skin==null?2:dv.skin]||SKIN[2]);
    var dark=mix(suit,'#000000',.45),deep=mix(suit,'#000000',.68),light=mix(suit,'#ffffff',.3),glass=mix(suit,'#dff7ff',.78);
    var SC=4,moving=Math.abs(d.vx)+Math.abs(d.vy)>5,kick=t*.012*(moving?1.15:.35),k1=Math.round(Math.sin(kick)*2),k2=Math.round(Math.sin(kick+Math.PI)*2);
    var tilt=clamp((d.vy||0)*.0012,-.16,.16);
    g.save();g.translate(x,y);g.rotate(tilt);g.scale(face,1);
    if(items.cuttlecloak&&run.cloakActive>0)g.globalAlpha=.25+.08*Math.sin(t*.01);
    function R(ax,ay,aw,ah,col){g.fillStyle=col;g.fillRect(Math.round(ax*SC),Math.round(ay*SC),Math.round(aw*SC),Math.round(ah*SC));}

    // Pixel contour only. The previous version used three opaque rectangular
    // backplates here; on-device those showed up as black boxes around the diver.
    R(-6,-4,12,1,deep);R(-6,4,12,1,deep);R(-6,-3,1,7,deep);R(5,-3,1,7,deep);
    R(4,-10,7,1,deep);R(3,-9,9,1,deep);R(2,-7,1,6,deep);R(12,-7,1,6,deep);R(3,0,9,1,deep);

    // tank assembly — visibly grows with oxygen upgrades
    var ox=Math.min(3,Math.floor((up.oxygen||0)/2));
    R(-9-ox,-6-ox,3+ox,8+ox*2,'#46535f');R(-9-ox,-6-ox,3+ox,1,'#91a5b4');R(-8,-7-ox,1,1,'#d7e3ea');
    if((up.oxygen||0)>=4){R(-12,-4,3,8,'#303b46');R(-12,-4,3,1,'#7c919f');}
    // legs + noticeably larger fins
    var finLen=6+Math.min(5,Math.floor((up.fins||0)/2));var fin=mix(suit,'#000000',.28);
    R(-9,-2+k1,5,2,suit);R(-9-finLen,-2+k1,finLen,2,fin);R(-9-finLen,-2+k1,finLen,1,trim);
    R(-9,4+k2,5,2,suit);R(-9-finLen,4+k2,finLen,2,fin);R(-9-finLen,5+k2,finLen,1,accent);
    // torso: larger chest, shoulder panel and belt
    R(-5,-3,10,7,suit);R(-5,-3,10,1,light);R(-4,-2,8,1,accent);R(-4,-1,8,1,trim);R(-5,3,10,1,'#20272d');R(-1,3,2,1,accent);
    // backpack/cargo hold becomes a visible case
    if((up.inventory||0)>0){var bw=2+Math.min(3,up.inventory||0);R(-9-bw,-2,bw,6,dark);R(-9-bw,-2,bw,1,light);R(-9,0,1,4,trim);}
    // forward arm, elbow, glove
    R(3,0,4,2,suit);R(6,1,3,2,dark);R(8,1,2,2,skin);R(6,0,1,1,accent);
    // helmet shell has a much stronger silhouette than the original
    var helm=mix(suit,'#aab7c1',.48),helmD=mix(helm,'#000000',.38),helmL=mix(helm,'#ffffff',.5);
    R(4,-9,7,2,helm);R(3,-7,9,6,helm);R(3,-7,1,6,helmD);R(4,-8,6,1,helmL);R(4,-1,7,1,helmD);
    // exposed face + large mask window
    R(6,-6,5,5,skin);R(7,-5,5,4,'#112b38');R(8,-4,4,3,glass);R(9,-3,1,1,'#102c3a');R(10,-4,1,1,'#ffffff');
    R(11,-2,2,1,'#26333b');R(12,-1,1,1,'#26333b');
    // regulator hose back to tanks
    R(10,0,1,1,'#1d252b');R(8,1,1,1,'#1d252b');R(5,2,1,1,'#1d252b');R(2,2,1,1,'#1d252b');R(-1,1,1,1,'#1d252b');R(-4,0,1,1,'#1d252b');
    // helmet style personality survives the remaster
    if(dv.look==='crest'){R(5,-11,1,2,accent);R(6,-12,2,3,accent);R(8,-11,1,2,accent);}else if(dv.look==='antenna'){R(7,-12,1,3,helmD);R(7,-13,1,1,'#ff6b6b');}else if(dv.look==='bolts'){R(2,-7,1,2,helmD);R(12,-7,1,2,helmD);}else if(dv.look==='diadem'){R(4,-10,7,1,accent);R(7,-11,1,1,trim);}
    // visible equipment
    if((up.light||0)>0){R(5,-10,3,1,'#26323a');R(7,-10,1,1,'#fff2a3');}
    if(items.goggles){R(6,-5,7,1,'#081b23');R(7,-4,5,3,mix(glass,'#ffffff',.18));}
    if((up.net||0)>0){R(7,3,3,1,'#9aa6b0');R(9,2,1,1,'#5cd0ff');}
    if((up.scoop||0)>0){R(-10,-9,6,1,'#c69a4a');R(-11,-8,1,6,'#c69a4a');R(-10,-8,5,3,'rgba(205,235,245,.65)');}
    if((up.hammer||0)>0){R(-4,-7,1,5,'#60482f');R(-6,-8,4,2,'#818b92');}
    if((up.shovel||0)>0){R(-2,-7,1,5,'#60482f');R(-3,-8,3,2,'#a9b4bc');}
    if((up.knife||0)>0){R(-3,4,1,3,'#d9e2e8');R(-3,4,1,1,'#3b2e22');}
    if(itemOn(state,'crabcrown')){R(4,-11,2,1,'#ffd45b');R(6,-12,2,2,'#ffd45b');R(8,-11,2,1,'#ffd45b');R(5,-12,1,1,'#ff7b65');R(9,-12,1,1,'#67e4ff');}
    if(items.heatsuit){R(-5,0,10,1,'#ff7b45');}if(items.coldsuit){R(-5,0,10,1,'#9eeaff');}
    // glass glint and small bubble trail
    R(10,-4,1,1,'rgba(255,255,255,.9)');
    g.restore();
    if(moving&&Math.sin(t*.02)>-.2){g.strokeStyle='rgba(210,245,255,.55)';g.lineWidth=1;g.beginPath();g.arc(x-face*35,y-18,2.5,0,Math.PI*2);g.stroke();}
  }

  function netPalette(level){var p=[['#a97b3c','#e0b764'],['#8796a2','#d7e4ec'],['#4da9b9','#8ef0ff'],['#b78a32','#ffe187'],['#7266c6','#c7bcff']];return p[Math.min(p.length-1,Math.max(0,level-1))]||p[0];}
  function drawNets(run,state,cam,t){if(!run.netFx||!run.netFx.length)return;var lv=Math.max(1,(state.upgrades&&state.upgrades.scoop)||1),pal=netPalette(lv);
    for(var i=0;i<run.netFx.length;i++){
      var fx=run.netFx[i],p=1-fx.life/fx.max,curve=Math.sin(Math.PI*p)*(-22-4*lv);var px=fx.x+(fx.dx-fx.x)*p,py=fx.y+(fx.dy-fx.y)*p+curve;
      var sx=px-cam.x,sy=py-cam.y,divx=fx.dx-cam.x,divy=fx.dy-cam.y,base=Math.max(18,fx.size*(1.12-p*.22));var ang=Math.atan2(sy-divy,sx-divx),fade=fx.life>.1?1:Math.max(0,fx.life/.1);
      g.save();g.globalAlpha=fade;
      // stout telescoping handle with highlight
      g.strokeStyle='#27343b';g.lineWidth=6;g.beginPath();g.moveTo(divx,divy);g.lineTo(sx-Math.cos(ang)*base*.72,sy-Math.sin(ang)*base*.72);g.stroke();
      g.strokeStyle=pal[1];g.lineWidth=2;g.beginPath();g.moveTo(divx,divy-1);g.lineTo(sx-Math.cos(ang)*base*.72,sy-Math.sin(ang)*base*.72-1);g.stroke();
      g.translate(sx,sy);g.rotate(ang+.12*Math.sin(t*.02+i));
      // deep bag-shaped net: thick oval mouth, narrowing pouch, proper diamond mesh
      var close=.12+.72*p,bw=base*(1-close*.18),bh=base*.68*(1-close*.32),bag=base*(1.25-close*.45);
      g.fillStyle='rgba(10,32,42,.24)';g.beginPath();g.ellipse(0,0,bw,bh,0,0,Math.PI*2);g.fill();
      g.strokeStyle=pal[0];g.lineWidth=5;g.beginPath();g.ellipse(0,0,bw,bh,0,0,Math.PI*2);g.stroke();
      g.strokeStyle=pal[1];g.lineWidth=2;g.beginPath();g.ellipse(0,-1,bw-3,bh-3,0,0,Math.PI*2);g.stroke();
      // pouch silhouette
      g.fillStyle='rgba(150,220,230,.07)';g.beginPath();g.moveTo(-bw*.82,bh*.35);g.quadraticCurveTo(-bw*.58,bag*.78,0,bag);g.quadraticCurveTo(bw*.58,bag*.78,bw*.82,bh*.35);g.closePath();g.fill();
      g.strokeStyle='rgba(210,238,242,.58)';g.lineWidth=1.2;
      for(var m=-3;m<=3;m++){var xx=m*bw/3.5;g.beginPath();g.moveTo(xx,-bh*.72);g.quadraticCurveTo(xx*.72,bag*.36,xx*.2,bag*.88);g.stroke();}
      for(var r=0;r<5;r++){var yy=-bh*.62+r*(bag+bh*.5)/5;var ww=bw*(1-r*.12);g.beginPath();g.moveTo(-ww,yy);g.quadraticCurveTo(0,yy+6*Math.sin(r+i),ww,yy);g.stroke();}
      // trapped creature sits visibly inside the mouth/pouch
      if(fx.def&&window.SPRITES){g.save();g.rotate(-ang);var jig=Math.sin(t*.03+i)*2;SPRITES.draw(g,SPRITES.archetypeForShape(fx.def.shape),jig,bag*.22,{color:fx.def.color,accent:fx.def.accent,shiny:fx.shiny,targetH:Math.max(18,base*1.15)});g.restore();}
      // upgrade marker on rim
      g.fillStyle=pal[1];for(var q=0;q<Math.min(4,lv);q++){var qa=-1.15+q*.18;g.beginPath();g.arc(Math.cos(qa)*bw,Math.sin(qa)*bh,2.2,0,Math.PI*2);g.fill();}
      g.restore();
    }
  }

  function frame(t){size();var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;g.clearRect(0,0,w,h);var api=window.DEEPSEA,run=api&&api.run?api.run():null,state=api&&api.state?api.state():null;if(run&&state&&run.diver){var cam=camera(run,state,w,h);drawNets(run,state,cam,t);drawDiver(run,state,cam,t);}requestAnimationFrame(frame);}
  addEventListener('resize',size,{passive:true});size();requestAnimationFrame(frame);
})();