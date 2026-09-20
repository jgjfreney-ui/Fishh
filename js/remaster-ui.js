/* Deep Sea Diver: Remastered — UI + sprite presentation controller */
(function(){
  'use strict';

  var REMASTER_BANNER=''+
    '<div class="remaster-kicker">Deep Sea Diver: Remastered</div>'+
    '<div class="remaster-title">🌊 Welcome back below the surface.</div>'+
    '<div class="remaster-copy">The original adventure has been restored and remastered: every dive site now carries its own living atmosphere, shinies have more individual colour and sparkle, bosses carry more presence, and the old cozy pixel-world is getting the polish it always deserved. Your progression, secrets and wonderfully questionable fish lore are still here.</div>'+
    '<div class="remaster-pills"><span class="remaster-pill">28 dive sites</span><span class="remaster-pill">animated biomes</span><span class="remaster-pill">restored progression</span><span class="remaster-pill">species shinies</span><span class="remaster-pill">classic saves supported</span></div>';

  function celebrate(root){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll('.update-banner').forEach(function(el){if(el.dataset.remastered)return;el.dataset.remastered='1';el.classList.add('remaster-banner');el.innerHTML=REMASTER_BANNER;});
    root.querySelectorAll('h1').forEach(function(h){if(/Ocean of Discovery/i.test(h.textContent||''))h.innerHTML='🌊 Deep Sea Diver <span class="rm-title-tag">REMASTERED</span> 🐙';});
    root.querySelectorAll('.sub').forEach(function(p){if(/Dive deep/i.test(p.textContent||''))p.textContent='Dive deeper. Find stranger things. Bring the whole ocean home.';});
  }
  celebrate(document);
  var obs=new MutationObserver(function(ms){ms.forEach(function(m){for(var i=0;i<m.addedNodes.length;i++){var n=m.addedNodes[i];if(n.nodeType===1)celebrate(n);}});});
  obs.observe(document.body,{childList:true,subtree:true});

  function hashHue(s){var h=0;for(var i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return Math.abs(h)%360;}

  function installSpriteRemaster(){
    if(!window.SPRITES||window.SPRITES.__remastered)return false;
    var S=window.SPRITES,originalDraw=S.draw,originalURL=S.dataURL;
    var bossShapes={kraken:1,leviathanking:1,dragon:1,cinderboss:1,stonetitan:1,mechakaiju:1,xenoboss:1,magmakaiju:1,kaiju:1,rigtitan:1,apexmega:1,youngkraken:1,davyjones:1,rivergiant:1,grovegiant:1,deeplev:1,celestserp:1};
    var birdShapes={bird:1,gull:1,duck:1,songbird:1,raptor:1,seabird:1,albatross:1,finch:1,pteranodon:1,crane:1,heron:1,stork:1,macaw:1,roc:1,owl:1};

    function diverGear(c,x,y,result,opts){
      var api=window.DEEPSEA,st=api&&api.state?api.state():null;if(!st||!result)return;
      var dir=opts.flip?-1:1,w=result.w,h=result.h;
      c.save();c.imageSmoothingEnabled=false;
      // tank silhouette
      if(st.upgrades&&st.upgrades.oxygen>0){c.fillStyle='rgba(155,205,220,.82)';c.fillRect(Math.round(x-dir*w*.27),Math.round(y-h*.16),Math.max(2,Math.round(w*.09)),Math.max(6,Math.round(h*.35)));c.fillStyle='rgba(40,85,105,.9)';c.fillRect(Math.round(x-dir*w*.28),Math.round(y-h*.04),Math.max(2,Math.round(w*.11)),2);}
      // dive-light pixel at the leading shoulder
      if(st.upgrades&&st.upgrades.light>0){c.globalCompositeOperation='screen';c.fillStyle='rgba(220,250,255,.9)';c.fillRect(Math.round(x+dir*w*.30),Math.round(y-h*.22),3,2);}
      // goggles become a cool cyan visor if owned
      if(st.items&&st.items.goggles){c.fillStyle='rgba(100,235,255,.72)';c.fillRect(Math.round(x+dir*w*.08),Math.round(y-h*.31),Math.max(3,Math.round(w*.16)),2);}
      // maxed fins exaggerate the trailing kick slightly
      if(st.upgrades&&st.upgrades.fins>=3){c.fillStyle='rgba(70,190,210,.75)';c.fillRect(Math.round(x-dir*w*.18),Math.round(y+h*.30),Math.max(4,Math.round(w*.18)),2);}
      // one of the most memorable boss rewards deserves to be visible
      if(st.items&&st.items.crabcrown&&!(st.itemsOff&&st.itemsOff.crabcrown)){c.fillStyle='#ffd879';var cy=Math.round(y-h*.48),cx=Math.round(x);c.fillRect(cx-5,cy,10,2);c.fillRect(cx-4,cy-3,2,3);c.fillRect(cx,cy-4,2,4);c.fillRect(cx+3,cy-3,2,3);}
      c.restore();
    }

    S.draw=function(c,archetype,x,y,opts){
      opts=opts||{};var t=performance.now()*.001;
      var boss=!!bossShapes[archetype],bird=!!birdShapes[archetype],diver=archetype==='diver';
      var bob=diver?Math.sin(t*3+x*.01)*.7:bird?Math.sin(t*5+x*.02)*1.2:Math.sin(t*2.1+x*.013)*.45;
      var targetH=opts.targetH;
      if(targetH){var amp=boss?1.08:(targetH<20?.94:(targetH>46?1.04:1));opts=Object.assign({},opts,{targetH:targetH*amp});}
      var hue=hashHue(archetype+'|'+(opts.color||''));
      c.save();
      if(opts.shiny){c.shadowColor='hsla('+hue+',92%,72%,.92)';c.shadowBlur=boss?19:11;}
      else if(boss){c.shadowColor='rgba(255,105,95,.55)';c.shadowBlur=12;}
      else{c.shadowColor='rgba(0,10,18,.30)';c.shadowBlur=3;}
      var result=originalDraw.call(S,c,archetype,x,y+bob,opts);c.restore();

      if(opts.shiny&&result){
        c.save();c.globalCompositeOperation='screen';var rr=Math.max(8,Math.min(36,result.h*.72));
        for(var i=0;i<3;i++){var a=t*(2.2+i*.14)+i*2.094+((x+y)%19)*.1,sx=x+Math.cos(a)*rr,sy=y+bob+Math.sin(a)*rr*.55;c.fillStyle='hsla('+((hue+i*38)%360)+',100%,82%,.76)';c.fillRect(Math.round(sx)-1,Math.round(sy)-3,2,6);c.fillRect(Math.round(sx)-3,Math.round(sy)-1,6,2);}c.restore();
      }
      if(diver&&result){c.save();c.globalAlpha=.34;c.fillStyle='#e5fbff';c.fillRect(Math.round(x+((opts.flip?-1:1)*result.w*.12)),Math.round(y-result.h*.28),2,2);c.restore();diverGear(c,x,y+bob,result,opts);}
      return result;
    };
    S.dataURL=function(archetype,opts){return originalURL.call(S,archetype,opts);};
    S.__remastered=true;return true;
  }
  if(!installSpriteRemaster())setTimeout(installSpriteRemaster,0);

  // Remaster location introductions. They are informational only and never touch
  // area state, unlocks or saves.
  var stage=document.getElementById('stage'),card=null,lastArea=null,hideTimer=null;
  if(stage){card=document.createElement('div');card.id='remaster-area-card';card.setAttribute('aria-live','polite');stage.appendChild(card);}
  function showAreaCard(id){
    if(!card||!window.GAMEDATA||!GAMEDATA.LOCATIONS)return;var loc=GAMEDATA.LOCATIONS[id];if(!loc)return;
    card.innerHTML='<div class="rac-kicker">DIVE SITE</div><div class="rac-name">'+loc.name+'</div><div class="rac-blurb">'+loc.blurb+'</div>';
    card.classList.remove('show');void card.offsetWidth;card.classList.add('show');if(hideTimer)clearTimeout(hideTimer);hideTimer=setTimeout(function(){card.classList.remove('show');},3200);
  }
  setInterval(function(){var api=window.DEEPSEA,run=api&&api.run?api.run():null;if(run&&run.area&&run.area!==lastArea){lastArea=run.area;showAreaCard(run.area);}},250);
})();