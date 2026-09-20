/* Deep Sea Diver: Remastered — animated biome signature scenery */
(function(){
  'use strict';
  var stage=document.getElementById('stage'); if(!stage) return;
  var c=document.createElement('canvas'); c.id='remaster-scenery'; c.setAttribute('aria-hidden','true'); stage.appendChild(c);
  var g=c.getContext('2d'),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function size(){var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight,rw=Math.floor(w*dpr),rh=Math.floor(h*dpr);if(c.width!==rw||c.height!==rh){c.width=rw;c.height=rh;c.style.width=w+'px';c.style.height=h+'px';g.setTransform(dpr,0,0,dpr,0,0);}}
  function line(x1,y1,x2,y2,a,col,w){g.strokeStyle='rgba('+col+','+a+')';g.lineWidth=w||2;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
  function coral(w,h,t,col){g.save();g.translate(w*.1,h*.88);for(var i=0;i<7;i++){var x=i*22,hh=45+(i%3)*25;line(x,0,x+Math.sin(t*.001+i)*6,-hh,.12,col,4);line(x,-hh*.55,x-14,-hh*.8,.09,col,3);line(x,-hh*.42,x+16,-hh*.7,.08,col,3);}g.restore();}
  function kelp(w,h,t,col){g.save();g.strokeStyle='rgba('+col+',.11)';g.lineWidth=7;for(var i=0;i<8;i++){var x=w*(.05+i*.13);g.beginPath();g.moveTo(x,h);for(var y=h;y>h*.28;y-=35){g.lineTo(x+Math.sin(t*.0015+y*.02+i)*10,y);}g.stroke();}g.restore();}
  function reeds(w,h,t,col){g.save();for(var i=0;i<16;i++){var x=w*(i/15),s=Math.sin(t*.0017+i)*8;line(x,h,x+s,h*.68-(i%4)*15,.09,col,3);}g.restore();}
  function ice(w,h,t,col){g.save();g.fillStyle='rgba('+col+',.08)';for(var i=0;i<6;i++){var x=w*(.04+i*.19),y=h*.08+(i%2)*8;g.beginPath();g.moveTo(x,y);g.lineTo(x+40,y-12);g.lineTo(x+25,y+30);g.lineTo(x-8,y+20);g.closePath();g.fill();}g.restore();}
  function pyramid(w,h,col){g.save();g.fillStyle='rgba('+col+',.08)';g.beginPath();g.moveTo(w*.75,h*.78);g.lineTo(w*.9,h*.93);g.lineTo(w*.6,h*.93);g.closePath();g.fill();line(w*.75,h*.78,w*.75,h*.93,.08,col,2);g.restore();}
  function bones(w,h,col){g.save();g.strokeStyle='rgba('+col+',.09)';g.lineWidth=8;g.beginPath();g.arc(w*.78,h*.86,65,Math.PI,Math.PI*2);g.stroke();for(var i=0;i<6;i++)line(w*.72+i*20,h*.84,w*.70+i*20,h*.94,.08,col,4);g.restore();}
  function peaks(w,h,col){g.save();g.fillStyle='rgba('+col+',.07)';for(var i=0;i<3;i++){var x=w*(.1+i*.34),base=h*.96;g.beginPath();g.moveTo(x,base);g.lineTo(x+w*.18,h*(.42+i*.06));g.lineTo(x+w*.34,base);g.closePath();g.fill();}g.restore();}
  function clouds(w,h,t,col){g.save();g.fillStyle='rgba('+col+',.05)';for(var i=0;i<5;i++){var x=((t*.006+i*w*.24)%(w+w*.2))-w*.1,y=h*(.12+(i%2)*.08);g.beginPath();g.arc(x,y,55,0,Math.PI*2);g.arc(x+48,y+8,42,0,Math.PI*2);g.arc(x-40,y+13,35,0,Math.PI*2);g.fill();}g.restore();}
  function torii(w,h,col){g.save();var x=w*.79,y=h*.79;line(x-48,y,x-48,y+105,.12,col,7);line(x+48,y,x+48,y+105,.12,col,7);line(x-75,y-14,x+75,y-14,.14,col,9);line(x-62,y+4,x+62,y+4,.09,col,5);g.restore();}
  function rig(w,h,col){g.save();var x=w*.77,y=h*.6;line(x,y,x,h,.1,col,7);line(x+70,y,x+70,h,.1,col,7);line(x-25,y,x+95,y,.1,col,9);for(var i=0;i<4;i++)line(x,y+i*45,x+70,y+(i+1)*45,.06,col,2);g.restore();}
  function crates(w,h,col){g.save();g.strokeStyle='rgba('+col+',.08)';g.lineWidth=3;for(var i=0;i<5;i++){var x=w*.62+(i%3)*55,y=h*.78+Math.floor(i/3)*48;g.strokeRect(x,y,48,40);line(x,y,x+48,y+40,.05,col,2);line(x+48,y,x,y+40,.05,col,2);}g.restore();}
  function cave(w,h,col){g.save();g.fillStyle='rgba('+col+',.08)';for(var i=0;i<9;i++){var x=i*w/8;g.beginPath();g.moveTo(x,0);g.lineTo(x+22,0);g.lineTo(x+10,h*(.12+(i%4)*.05));g.closePath();g.fill();}g.restore();}
  function alien(w,h,t,col){g.save();g.fillStyle='rgba('+col+',.09)';g.beginPath();g.arc(w*.78,h*.18,58,0,Math.PI*2);g.fill();g.fillStyle='rgba(100,230,255,.05)';g.beginPath();g.arc(w*.68,h*.26,28,0,Math.PI*2);g.fill();for(var i=0;i<4;i++){var x=w*(.15+i*.2),y=h*.85+Math.sin(t*.001+i)*6;line(x,y,x+10,h*.58,.08,col,5);g.beginPath();g.arc(x+12,h*.56,13,0,Math.PI*2);g.fillStyle='rgba('+col+',.07)';g.fill();}g.restore();}
  function vines(w,h,t,col){g.save();g.strokeStyle='rgba('+col+',.09)';g.lineWidth=5;for(var i=0;i<7;i++){var x=w*(.05+i*.16);g.beginPath();g.moveTo(x,0);for(var y=0;y<h*.48;y+=28)g.lineTo(x+Math.sin(t*.001+y*.02+i)*12,y);g.stroke();}g.restore();}
  function ruins(w,h,col){g.save();g.fillStyle='rgba('+col+',.06)';for(var i=0;i<4;i++){var x=w*(.15+i*.2);g.fillRect(x,h*.72,24,h*.25);g.fillRect(x-12,h*.7,48,13);}g.restore();}
  function machinery(w,h,t,col){g.save();g.strokeStyle='rgba('+col+',.07)';g.lineWidth=4;for(var i=0;i<3;i++){var x=w*(.68+i*.09),y=h*.82;g.beginPath();g.arc(x,y,25+i*3,0,Math.PI*2);g.stroke();for(var a=0;a<8;a++)line(x,y,x+Math.cos(a*Math.PI/4)*34,y+Math.sin(a*Math.PI/4)*34,.05,col,3);}g.restore();}
  function scene(area,w,h,t){
    switch(area){
      case'coral':coral(w,h,t,'255,145,120');break;case'river':reeds(w,h,t,'120,220,145');break;case'forest':vines(w,h,t,'100,210,120');break;case'secretcave':cave(w,h,'165,150,220');break;
      case'kelp':kelp(w,h,t,'70,190,150');break;case'arctic':ice(w,h,t,'215,245,255');break;case'desert':pyramid(w,h,'240,205,125');break;case'opensea':clouds(w,h,t,'100,175,225');break;
      case'ancient':ruins(w,h,'190,150,90');break;case'prism':coral(w,h,t,'255,130,220');break;case'swamp':reeds(w,h,t,'150,165,80');break;case'boneyard':bones(w,h,'220,225,220');break;
      case'storm':clouds(w,h,t,'145,160,195');break;case'mountain':peaks(w,h,'190,215,235');break;case'olympus':ruins(w,h,'255,225,145');clouds(w,h,t,'235,245,255');break;
      case'jungle':vines(w,h,t,'80,195,90');break;case'alien':alien(w,h,t,'175,110,245');break;case'grotto':ruins(w,h,'110,230,235');break;case'ashen':peaks(w,h,'210,85,45');break;
      case'pirate':ruins(w,h,'190,150,80');break;case'backrooms':ruins(w,h,'210,195,80');break;case'japan':torii(w,h,'235,85,105');break;case'oilrig':rig(w,h,'175,155,105');machinery(w,h,t,'175,155,105');break;
      case'flooded':crates(w,h,'110,155,145');break;case'cave':cave(w,h,'125,145,190');break;case'cloud':clouds(w,h,t,'235,245,255');break;case'trench':cave(w,h,'70,95,130');break;case'sanctuary':ruins(w,h,'145,240,205');break;
    }
  }
  function frame(t){size();var w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;g.clearRect(0,0,w,h);var api=window.DEEPSEA,run=api&&api.run?api.run():null;if(run&&run.area){g.save();scene(run.area,w,h,t);g.restore();}requestAnimationFrame(frame);}
  addEventListener('resize',size,{passive:true});size();requestAnimationFrame(frame);
})();