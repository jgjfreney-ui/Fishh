/* Deep Sea Diver: Recast — creature art pass
 * Adds authored pixel-scale anatomy, markings, shiny treatments and boss
 * silhouette detail on top of the stable sprite library. Visual only.
 */
(function(){
  'use strict';

  function install(){
    if(!window.SPRITES||window.SPRITES.__recastArt)return false;
    var S=window.SPRITES,priorDraw=S.draw,priorURL=S.dataURL;

    function set(s){var o={};s.split(/\s+/).forEach(function(k){o[k]=1;});return o;}
    var fish=set('fish longfish clownfish codfish puffer perch mackerel sardine guppy trout goby parrotfish hatchetfish barreleye lionfish triggerfish fangtooth pike tuna koi salmon mahimahi butterflyfish moorishidol tang flatfish moonfish catfish arapaima ecatfish xenofish sturgeon coelacanth flyingfish mola grouper captaincarp wallpaperfish torpedo lantern angler stargazer armored');
    var sharks=set('shark hammer megalodon greenlandshark apexmega goblin skeletonshark whaleshark helicoprion');
    var whales=set('whale spermwhale galaxywhale voidwhale wraithwhale stormwhale ghostwhale bacteriawhale dolphin orca narwhal');
    var rays=set('ray manta ghostray');
    var eels=set('eel oarfish antlereel dragonfish glowworm lanternjaw wyrm ancientlev celestserp seadragon dragon firedragon deeplev');
    var ceph=set('squid octopus cuttlefish kingcuttle giantsquid whitesquid vampsquid kraken youngkraken lampsquid');
    var jellies=set('jelly manowar siphonophore glowjelly clione');
    var reptiles=set('turtle leatherback crocodile gharial mosasaur ichthyosaur kaiju magmakaiju mechakaiju rivergiant grovegiant dunkle stonetitan frog bigfrog tadpole steed tableturtle');
    var floor=set('crab spidercrab lobster starfish urchin trilobite ammonite seaspider bug insect slug snail hermitcrab clam bacteria chairsnail');
    var birds=set('bird gull duck songbird raptor seabird albatross finch pteranodon crane heron stork macaw roc owl');
    var bosses=set('kraken youngkraken leviathanking dragon firedragon prismboss apexmega davyjones rigtitan deeplev celestserp rivergiant grovegiant ancientlev wyrm kingcuttle mechakaiju magmakaiju xenoboss cinderboss stonetitan captaincarp bacteriawhale skeletonshark goblin leatherback dunkle grouper kaiju');

    function hex(h){if(!h||h[0]!=='#')return[130,180,200];h=h.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return[parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0];}
    function mix(a,b,t){var x=hex(a),y=hex(b);return'rgb('+Math.round(x[0]+(y[0]-x[0])*t)+','+Math.round(x[1]+(y[1]-x[1])*t)+','+Math.round(x[2]+(y[2]-x[2])*t)+')';}
    function hash(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
    function px(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
    function dx(x,dir,d){return x+d*dir;}
    function star(c,x,y,p,col){px(c,x-p*.5,y-p*2,p,p*4,col);px(c,x-p*2,y-p*.5,p*4,p,col);}
    function tri(c,pts,col){c.fillStyle=col;c.beginPath();c.moveTo(Math.round(pts[0]),Math.round(pts[1]));for(var i=2;i<pts.length;i+=2)c.lineTo(Math.round(pts[i]),Math.round(pts[i+1]));c.closePath();c.fill();}

    function pattern(c,arch,x,y,w,h,p,dir,base,accent,shiny){
      var seed=hash(arch+'|'+base+'|'+(accent||'')),mode=seed%4;
      var col=shiny?mix(accent||base,'#ffffff',.4):(accent||mix(base,'#ffffff',.55));
      c.save();c.globalAlpha=shiny?.92:.62;
      if(mode===0){
        for(var i=0;i<4;i++){var xx=dx(x,dir,(-.20+i*.13)*w),yy=y+((seed>>>(i*4))&7)/7*h*.22-h*.11;px(c,xx,yy,p,p,col);}
      }else if(mode===1){
        for(var b=0;b<3;b++){var bx=dx(x,dir,(-.16+b*.15)*w);px(c,bx,y-h*.17,p,h*.34,col);}
      }else if(mode===2){
        for(var d=0;d<3;d++){var qx=dx(x,dir,(-.16+d*.16)*w);px(c,qx,y-h*.12,p*2,p,col);px(c,qx+p*.5*dir,y-h*.12+p,p,p,col);}
      }else{
        for(var s=0;s<5;s++){var sx=dx(x,dir,(-.22+s*.11)*w),sy=y+(s%2?1:-1)*h*.10;px(c,sx,sy,p,p,col);}
      }
      c.restore();
    }

    function fishDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      pattern(c,a,x,y,w,h,p,dir,base,accent,o.shiny);
      // gill cover, lateral line and a little dorsal/ventral fin separation
      px(c,dx(x,dir,w*.25),y-h*.09,p,h*.18,dark);
      px(c,dx(x,dir,-w*.08),y+h*.19,p*4,p,mix(base,'#000000',.25));
      px(c,dx(x,dir,-w*.10),y-h*.48,p*2,p,accent);
      if(a==='angler'||a==='lantern'||a==='barreleye'||a==='hatchetfish')star(c,dx(x,dir,w*.12),y-h*.35,p,light);
    }
    function sharkDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      for(var g=0;g<3;g++)px(c,dx(x,dir,w*(.17-g*.045)),y-h*.05+g*p,p,h*.13,dark);
      // stronger dorsal silhouette and pale belly edge
      tri(c,[dx(x,dir,-w*.08),y-h*.43,dx(x,dir,-w*.02),y-h*.67,dx(x,dir,w*.08),y-h*.39],dark);
      px(c,dx(x,dir,-w*.03),y+h*.28,w*.28,p,mix(base,'#ffffff',.62));
      if(a==='hammer')px(c,dx(x,dir,w*.34),y-h*.24,p*3,p,accent);
      if(a==='skeletonshark')for(var b=0;b<4;b++)px(c,dx(x,dir,-w*.16+b*w*.10),y,p,p,light);
    }
    function whaleDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      px(c,dx(x,dir,w*.13),y-h*.36,p*2,p,dark); // blowhole
      px(c,dx(x,dir,-w*.02),y+h*.29,w*.30,p,mix(base,'#ffffff',.58));
      if(a!=='dolphin'&&a!=='orca'){
        px(c,dx(x,dir,w*.03),y-h*.08,p*5,p,accent);px(c,dx(x,dir,w*.00),y-h*.02,p*4,p,accent);
      }
      if(a==='galaxywhale'||a==='voidwhale'||a==='wraithwhale'||o.shiny)pattern(c,a,x,y,w,h,p,dir,base,accent,true);
    }
    function rayDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      px(c,dx(x,dir,w*.13),y-h*.12,p,p,light);px(c,dx(x,dir,w*.03),y-h*.12,p,p,light);
      px(c,dx(x,dir,-w*.18),y+h*.02,p*3,p,accent);px(c,dx(x,dir,w*.15),y+h*.02,p*3,p,accent);
      pattern(c,a,x,y,w,h,p,dir,base,accent,o.shiny);
    }
    function eelDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      for(var i=0;i<5;i++){var xx=dx(x,dir,-w*.30+i*w*.13);px(c,xx,y-h*.31+(i%2)*p,p*2,p,accent);}
      px(c,dx(x,dir,w*.30),y-h*.05,p,h*.16,dark);
      if(a==='wyrm'||a==='ancientlev'||a==='celestserp'||a==='dragon'||a==='firedragon'){
        for(var s=0;s<4;s++)tri(c,[dx(x,dir,-w*.22+s*w*.12),y-h*.40,dx(x,dir,-w*.18+s*w*.12),y-h*.58,dx(x,dir,-w*.12+s*w*.12),y-h*.39],accent);
      }
    }
    function cephDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      px(c,dx(x,dir,w*.12),y-h*.14,p*2,p,light);px(c,dx(x,dir,w*.12),y-h*.14,p,p,dark);
      pattern(c,a,x,y,w,h,p,dir,base,accent,o.shiny);
      // sucker pixels along the lower tentacle fan
      for(var i=0;i<4;i++)px(c,dx(x,dir,-w*.18+i*w*.12),y+h*.34+(i%2)*p,p,p,mix(accent,'#ffffff',.5));
      if(a==='kraken'||a==='youngkraken'||a==='kingcuttle'){
        tri(c,[x-w*.18,y-h*.45,x,y-h*.70,x+w*.18,y-h*.45],accent);
      }
    }
    function jellyDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      px(c,x-w*.27,y+h*.02,w*.54,p,accent);
      for(var i=0;i<4;i++)star(c,x-w*.20+i*w*.13,y-h*.10+(i%2)*p,p*.65,o.shiny?'#ffffff':light);
    }
    function reptileDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      for(var i=0;i<4;i++)px(c,dx(x,dir,-w*.22+i*w*.12),y-h*.36+(i%2)*p,p*2,p,accent);
      if(a==='turtle'||a==='leatherback'||a==='tableturtle'){
        px(c,x-w*.18,y-h*.16,w*.30,p,dark);px(c,x-w*.12,y+h*.02,w*.26,p,accent);
      }else if(a==='kaiju'||a==='magmakaiju'||a==='mechakaiju'||a==='grovegiant'||a==='stonetitan'){
        for(var s=0;s<4;s++)tri(c,[dx(x,dir,-w*.22+s*w*.12),y-h*.40,dx(x,dir,-w*.18+s*w*.12),y-h*.64,dx(x,dir,-w*.12+s*w*.12),y-h*.39],accent);
      }
    }
    function floorDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      pattern(c,a,x,y,w,h,p,dir,base,accent,o.shiny);
      px(c,x-w*.18,y+h*.26,w*.36,p,dark);
      if(a==='crab'||a==='spidercrab'||a==='lobster'||a==='seaspider'){
        px(c,x-w*.30,y,p*3,p,accent);px(c,x+w*.20,y,p*3,p,accent);
      }
    }
    function birdDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      px(c,dx(x,dir,w*.31),y-h*.05,p*3,p,accent); // beak
      px(c,dx(x,dir,-w*.08),y-h*.13,w*.24,p,mix(accent,'#ffffff',.25));
      if(a==='macaw'||a==='roc'||a==='raptor')px(c,dx(x,dir,-w*.12),y+h*.04,w*.25,p,accent);
    }
    function bossDetail(c,a,x,y,r,o,dir,p,base,accent,dark,light){
      var w=r.w,h=r.h;
      // Pixel crest changes silhouette; eye flare and scars keep bosses readable at phone scale.
      for(var s=0;s<3;s++)tri(c,[dx(x,dir,-w*.18+s*w*.13),y-h*.44,dx(x,dir,-w*.13+s*w*.13),y-h*(.62+s*.025),dx(x,dir,-w*.07+s*w*.13),y-h*.43],s===1?light:accent);
      star(c,dx(x,dir,w*.30),y-h*.10,Math.max(1,p*.8),o.shiny?'#ffffff':mix(accent,'#ffffff',.55));
      c.save();c.globalAlpha=.72;for(var q=0;q<3;q++)px(c,dx(x,dir,w*(.02-q*.035)),y-h*.05+q*p*2,p*5,p,mix(base,'#ffffff',.68));c.restore();
    }

    S.draw=function(c,a,x,y,o){
      o=o||{};var local={};for(var k in o)local[k]=o[k];
      if(local.targetH&&a!=='diver'){
        var seed=hash(a+'|'+(local.color||''));
        var scale=.95+(seed%12)/100;
        if(bosses[a])scale*=1.10;
        local.targetH*=scale;
      }
      var r=priorDraw.call(S,c,a,x,y,local);if(!r||a==='diver')return r;
      var dir=local.flip?-1:1,p=Math.max(1,Math.round((r.scale||2)*.55));
      var base=local.color||'#8fa6b0',accent=local.accent||mix(base,'#ffffff',.62),dark=mix(base,'#000000',.52),light=mix(base,'#ffffff',.74);
      c.save();c.imageSmoothingEnabled=false;
      if(fish[a])fishDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(sharks[a])sharkDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(whales[a])whaleDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(rays[a])rayDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(eels[a])eelDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(ceph[a])cephDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(jellies[a])jellyDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(reptiles[a])reptileDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(floor[a])floorDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else if(birds[a])birdDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      else pattern(c,a,x,y,r.w,r.h,p,dir,base,accent,local.shiny);

      if(local.shiny){
        var seed2=hash(a+'|'+base+'|shiny'),hue=seed2%360;
        c.save();c.globalCompositeOperation='screen';
        for(var z=0;z<3;z++){var ox=(-.18+z*.18)*r.w*dir,oy=(z%2?-.18:.12)*r.h;star(c,x+ox,y+oy,p,'hsla('+((hue+z*47)%360)+',100%,82%,.95)');}
        c.restore();
      }
      if(bosses[a])bossDetail(c,a,x,y,r,local,dir,p,base,accent,dark,light);
      c.restore();return r;
    };

    // Collection cards use the same Recast artwork instead of reverting to base grids.
    S.dataURL=function(a,o){
      o=o||{};if(o.silhouette)return priorURL.call(S,a,o);
      var d=S.dims(a),sc=o.scale||4,pad=Math.max(8,sc*5),cnv=document.createElement('canvas');
      cnv.width=Math.ceil(d.w*sc*1.28+pad*2);cnv.height=Math.ceil(d.h*sc*1.40+pad*2);
      var c=cnv.getContext('2d');c.imageSmoothingEnabled=false;
      var op={};for(var k in o)op[k]=o[k];delete op.scale;op.targetH=d.h*sc;
      S.draw(c,a,cnv.width/2,cnv.height/2,op);return cnv.toDataURL();
    };

    S.__recastArt=true;
    window.RECAST_ART_VERSION='1.0';
    return true;
  }

  if(!install())setTimeout(install,0);
})();