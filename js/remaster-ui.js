/* Deep Sea Diver: Remastered — UI + sprite presentation controller */
(function(){
  'use strict';

  var REMASTER_BANNER = ''+
    '<div class="remaster-kicker">Deep Sea Diver: Remastered</div>'+
    '<div class="remaster-title">🌊 Welcome back below the surface.</div>'+
    '<div class="remaster-copy">The original adventure has been restored and remastered: every dive site now carries its own living atmosphere, shinies sparkle properly, bosses announce themselves with more presence, and the old cozy pixel-world is getting the polish it always deserved. Your progression, secrets and wonderfully questionable fish lore are still here.</div>'+
    '<div class="remaster-pills"><span class="remaster-pill">28 dive sites</span><span class="remaster-pill">animated biomes</span><span class="remaster-pill">restored progression</span><span class="remaster-pill">enhanced shinies</span><span class="remaster-pill">classic saves supported</span></div>';

  function celebrate(root){
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll('.update-banner').forEach(function(el){
      if(el.dataset.remastered) return;
      el.dataset.remastered='1';
      el.classList.add('remaster-banner');
      el.innerHTML=REMASTER_BANNER;
    });
    root.querySelectorAll('h1').forEach(function(h){
      if(/Ocean of Discovery/i.test(h.textContent||'')) h.innerHTML='🌊 Deep Sea Diver <span class="rm-title-tag">REMASTERED</span> 🐙';
    });
    root.querySelectorAll('.sub').forEach(function(p){
      if(/Dive deep/i.test(p.textContent||'')) p.textContent='Dive deeper. Find stranger things. Bring the whole ocean home.';
    });
  }

  celebrate(document);
  var obs=new MutationObserver(function(ms){
    ms.forEach(function(m){for(var i=0;i<m.addedNodes.length;i++){var n=m.addedNodes[i];if(n.nodeType===1) celebrate(n);}});
  });
  obs.observe(document.body,{childList:true,subtree:true});

  // Wrap the original pixel renderer. This leaves the authored grid art intact,
  // but adds subtle creature-class animation, depth shadow, boss presence and a
  // much stronger shiny treatment. Hitboxes/gameplay remain untouched.
  function installSpriteRemaster(){
    if(!window.SPRITES || window.SPRITES.__remastered) return false;
    var S=window.SPRITES, originalDraw=S.draw, originalURL=S.dataURL;
    var bossShapes={kraken:1,leviathanking:1,dragon:1,cinderboss:1,stonetitan:1,mechakaiju:1,xenoboss:1,magmakaiju:1,kaiju:1,rigtitan:1,apexmega:1,youngkraken:1,davyjones:1,rivergiant:1,grovegiant:1,deeplev:1,celestserp:1};
    var birdShapes={bird:1,gull:1,duck:1,songbird:1,raptor:1,seabird:1,albatross:1,finch:1,pteranodon:1,crane:1,heron:1,stork:1,macaw:1,roc:1,owl:1};

    S.draw=function(c,archetype,x,y,opts){
      opts=opts||{};
      var t=performance.now()*0.001;
      var boss=!!bossShapes[archetype], bird=!!birdShapes[archetype], diver=archetype==='diver';
      var bob=diver?Math.sin(t*3+x*0.01)*0.7:bird?Math.sin(t*5+x*0.02)*1.2:Math.sin(t*2.1+x*0.013)*0.45;
      var targetH=opts.targetH;
      // Amplify authored size differences very slightly; no random per-frame scaling.
      if(targetH){
        var amp=boss?1.08:(targetH<20?0.94:(targetH>46?1.04:1));
        opts=Object.assign({},opts,{targetH:targetH*amp});
      }
      c.save();
      if(opts.shiny){
        c.shadowColor='rgba(255,235,125,.88)'; c.shadowBlur=boss?18:10;
      }else if(boss){
        c.shadowColor='rgba(255,105,95,.55)'; c.shadowBlur=12;
      }else{
        c.shadowColor='rgba(0,10,18,.30)'; c.shadowBlur=3;
      }
      var result=originalDraw.call(S,c,archetype,x,y+bob,opts);
      c.restore();

      // tiny pixel highlights are intentionally drawn after the crisp sprite.
      if(opts.shiny && result){
        c.save(); c.globalCompositeOperation='screen';
        var rr=Math.max(8,Math.min(34,result.h*.72));
        for(var i=0;i<2;i++){
          var a=t*2.5+i*Math.PI+((x+y)%19)*.1;
          var sx=x+Math.cos(a)*rr, sy=y+bob+Math.sin(a)*rr*.55;
          c.fillStyle='rgba(255,250,210,.78)';
          c.fillRect(Math.round(sx)-1,Math.round(sy)-3,2,6); c.fillRect(Math.round(sx)-3,Math.round(sy)-1,6,2);
        }
        c.restore();
      }
      if(diver && result){
        c.save(); c.globalAlpha=.32; c.fillStyle='#dff8ff';
        c.fillRect(Math.round(x+((opts.flip?-1:1)*result.w*.12)),Math.round(y-result.h*.28),2,2);
        c.restore();
      }
      return result;
    };

    S.dataURL=function(archetype,opts){
      return originalURL.call(S,archetype,opts);
    };
    S.__remastered=true;
    return true;
  }

  if(!installSpriteRemaster()) setTimeout(installSpriteRemaster,0);
})();