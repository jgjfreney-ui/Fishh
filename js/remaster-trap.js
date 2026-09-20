/* Deep Sea Diver: Remastered — deployed capture-net presentation */
(function(){
  'use strict';
  window.REMASTER_TRAP_LAYER=true;
  var stage=document.getElementById('stage'); if(!stage) return;
  var D=window.GAMEDATA;
  var c=document.createElement('canvas'); c.id='remaster-trap'; c.setAttribute('aria-hidden','true'); stage.appendChild(c);
  var g=c.getContext('2d'),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function size(){var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight,rw=Math.floor(w*dpr),rh=Math.floor(h*dpr);if(c.width!==rw||c.height!==rh){c.width=rw;c.height=rh;c.style.width=w+'px';c.style.height=h+'px';g.setTransform(dpr,0,0,dpr,0,0);}}
  function camera(run,state,w,h){var loc=run.loc||D.LOCATIONS[run.area];var skyReveal=(state&&state.items&&state.items.rocfeather&&run.diver.y<120)?-470:(run.diver.y<80?-290:-150);return{x:Math.round(clamp(run.diver.x-w/2,0,Math.max(0,loc.worldWidth-w))),y:Math.round(clamp(run.diver.y-h/2,skyReveal,Math.max(0,loc.maxDepth*D.PXPM+120-h)))};}
  function palette(level){var p=[['#7b9b84','#c6dfc9','#b7d8bb'],['#7897a5','#d7edf5','#93d9ef'],['#3aa3ad','#9af4ef','#60d8d5'],['#b88b34','#ffe49a','#f1c95f'],['#6659ba','#d2c9ff','#a99cff']];return p[Math.min(p.length-1,Math.max(0,level-1))]||p[0];}
  function drawTrap(run,state,cam,t,w,h){var tr=run.trap;if(!tr||!tr.active||!(tr.r>0))return;var x=tr.x-cam.x,y=tr.y-cam.y,r=tr.r;if(x<-r-80||x>w+r+80||y<-r-80||y>h+r+80)return;var lv=Math.max(1,(state.upgrades&&state.upgrades.trap)||1),pal=palette(lv),pulse=.5+.5*Math.sin(t*.003),mouthW=r*.88,mouthH=Math.max(20,r*.28),depth=r*.72;
    g.save();
    // subtle true gameplay radius, kept faint so the art can be more net-like than circular.
    g.setLineDash([6,10]);g.strokeStyle='rgba(150,235,190,'+(0.12+pulse*.04)+')';g.lineWidth=1.2;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.setLineDash([]);
    // tether line and small anchored control buoy.
    g.strokeStyle='rgba(80,105,110,.65)';g.lineWidth=2;g.beginPath();g.moveTo(x,y-depth*.72);g.lineTo(x-r*.55,y-depth*.98);g.stroke();
    g.fillStyle=pal[0];g.beginPath();g.ellipse(x-r*.55,y-depth*.98,9,6,0,0,Math.PI*2);g.fill();g.fillStyle=pal[1];g.fillRect(x-r*.58,y-depth*1.02,5,2);
    // upper float line — a real deployed fishing net silhouette rather than a target reticle.
    g.strokeStyle=pal[0];g.lineWidth=5;g.beginPath();g.ellipse(x,y-depth*.45,mouthW,mouthH,0,0,Math.PI*2);g.stroke();
    g.strokeStyle=pal[1];g.lineWidth=1.5;g.beginPath();g.ellipse(x,y-depth*.45,mouthW-3,mouthH-3,0,0,Math.PI*2);g.stroke();
    var floats=4+Math.min(4,lv);for(var f=0;f<floats;f++){var a=Math.PI+(f/(floats-1))*Math.PI;var fx=x+Math.cos(a)*mouthW*.92,fy=y-depth*.45+Math.sin(a)*mouthH*.92;g.fillStyle=pal[2];g.beginPath();g.arc(fx,fy,3.3,0,Math.PI*2);g.fill();}
    // drooping bag body.
    g.fillStyle='rgba(65,145,130,.055)';g.beginPath();g.moveTo(x-mouthW*.88,y-depth*.38);g.quadraticCurveTo(x-mouthW*.55,y+depth*.46,x,y+depth*.62);g.quadraticCurveTo(x+mouthW*.55,y+depth*.46,x+mouthW*.88,y-depth*.38);g.closePath();g.fill();
    g.strokeStyle='rgba(205,238,224,.38)';g.lineWidth=1;
    for(var m=-5;m<=5;m++){var sx=x+m*mouthW/6;g.beginPath();g.moveTo(sx,y-depth*.45);g.quadraticCurveTo(x+(sx-x)*.68,y+depth*.18,x+(sx-x)*.22,y+depth*.57);g.stroke();}
    for(var row=0;row<7;row++){var q=row/6,yy=y-depth*.38+q*depth*.95,ww=mouthW*(.9-q*.62);g.beginPath();g.moveTo(x-ww,yy);g.quadraticCurveTo(x,yy+Math.sin(t*.002+row)*3,x+ww,yy);g.stroke();}
    // weighted bottom edge keeps the net visually planted.
    var weightY=y+depth*.59;g.strokeStyle=pal[0];g.lineWidth=3;g.beginPath();g.moveTo(x-mouthW*.24,weightY);g.lineTo(x+mouthW*.24,weightY);g.stroke();for(var k=-2;k<=2;k++){g.fillStyle='#46515a';g.fillRect(x+k*mouthW*.105-3,weightY-1,6,6);g.fillStyle='rgba(220,235,240,.45)';g.fillRect(x+k*mouthW*.105-2,weightY,2,1);}
    // centre lure pulse / upgrade identity.
    g.globalCompositeOperation='screen';var grd=g.createRadialGradient(x,y,1,x,y,16+lv*3);grd.addColorStop(0,'rgba(135,245,205,'+(0.18+pulse*.12)+')');grd.addColorStop(1,'rgba(135,245,205,0)');g.fillStyle=grd;g.beginPath();g.arc(x,y,16+lv*3,0,Math.PI*2);g.fill();
    g.restore();
  }
  function frame(t){size();var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;g.clearRect(0,0,w,h);var api=window.DEEPSEA,run=api&&api.run?api.run():null,state=api&&api.state?api.state():null;if(run&&state&&run.diver){drawTrap(run,state,camera(run,state,w,h),t,w,h);}requestAnimationFrame(frame);}
  addEventListener('resize',size,{passive:true});size();requestAnimationFrame(frame);
})();