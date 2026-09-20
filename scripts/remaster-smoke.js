#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:'https://deepsea.local/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
Object.defineProperty(w.document,'readyState',{configurable:true,get:()=> 'complete'});
Object.defineProperty(w,'devicePixelRatio',{configurable:true,value:1});
Object.defineProperty(w,'innerWidth',{configurable:true,value:960});
Object.defineProperty(w,'innerHeight',{configurable:true,value:540});
w.requestAnimationFrame=()=>1; w.cancelAnimationFrame=()=>{}; w.confirm=()=>true; w.alert=()=>{}; w.prompt=()=>null; w.PointerEvent=w.MouseEvent;
function grad(){return{addColorStop(){}}}
function ctx(canvas){const b={canvas,createLinearGradient:grad,createRadialGradient:grad,createPattern:()=>({}),measureText:t=>({width:String(t||'').length*8}),getImageData:(x,y,ww,hh)=>({data:new Uint8ClampedArray(Math.max(0,ww*hh*4)),width:ww,height:hh}),createImageData:(ww,hh)=>({data:new Uint8ClampedArray(Math.max(0,ww*hh*4)),width:ww,height:hh}),isPointInPath:()=>false,isPointInStroke:()=>false};['save','restore','beginPath','closePath','moveTo','lineTo','rect','roundRect','arc','ellipse','quadraticCurveTo','bezierCurveTo','fill','stroke','clip','fillRect','strokeRect','clearRect','translate','rotate','scale','transform','setTransform','resetTransform','drawImage','fillText','strokeText','putImageData','setLineDash'].forEach(n=>b[n]=()=>{});return new Proxy(b,{get:(t,p)=>p in t?t[p]:undefined,set:(t,p,v)=>(t[p]=v,true)});}
w.HTMLCanvasElement.prototype.getContext=function(){return this.__ctx||(this.__ctx=ctx(this));};
w.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,recast';};
w.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:960,height:540,right:960,bottom:540}};
function evalFile(rel){w.eval(fs.readFileSync(path.join(__dirname,'..',rel),'utf8')+'\n//# sourceURL='+rel)}
evalFile('js/data.js');evalFile('js/sprites.js');evalFile('js/audio.js');evalFile('js/remaster-audio.js');evalFile('js/game.js');evalFile('js/remaster-scenes.js');evalFile('js/remaster.js');evalFile('js/remaster-ui.js');evalFile('js/remaster-foreground.js');evalFile('js/remaster-trap.js');evalFile('js/recast-sprites.js');evalFile('js/recast-collectibles.js');
if(!w.DEEPSEA||!w.DEEPSEA._test) throw new Error('game test API missing');
w.DEEPSEA._test.newGame();w.DEEPSEA._test.devSave();w.DEEPSEA._test.dive('coral');w.DEEPSEA._test.frame(.016);
if(w.document.title!=='Deep Sea Diver: Recast') throw new Error('Recast document title missing');
if(!w.document.getElementById('remaster-scenery')) throw new Error('remaster scenery canvas missing');
if(!w.document.getElementById('remaster-fx')) throw new Error('remaster effects canvas missing');
if(!w.document.getElementById('remaster-foreground')) throw new Error('remaster foreground canvas missing');
if(!w.document.getElementById('remaster-trap')) throw new Error('remaster deployed-net canvas missing');
if(!w.document.getElementById('recast-collectibles')) throw new Error('Recast collectible canvas missing');
if(!w.REMASTER_DIVER_LAYER||!w.REMASTER_NET_LAYER||!w.REMASTER_TRAP_LAYER) throw new Error('remaster render handoff flags missing');
if(!w.SPRITES.__remastered) throw new Error('sprite remaster wrapper missing');
if(!w.SPRITES.__recastArt||w.RECAST_ART_VERSION!=='1.0') throw new Error('Recast creature art layer missing');
if(!w.RECAST_COLLECTIBLE_ART) throw new Error('Recast collectible art layer missing');
const gameSrc=fs.readFileSync(path.join(__dirname,'..','js','game.js'),'utf8');
if(!gameSrc.includes('window.REMASTER_DIVER_LAYER) return;')) throw new Error('legacy diver handoff not installed');
if(!gameSrc.includes('window.REMASTER_NET_LAYER) return;')) throw new Error('legacy scoop-net handoff not installed');
if(!gameSrc.includes('window.REMASTER_TRAP_LAYER) return;')) throw new Error('legacy deployed-net handoff not installed');
const sceneSrc=fs.readFileSync(path.join(__dirname,'..','js','remaster-scenes.js'),'utf8');
if(!/function camera\(/.test(sceneSrc)||!/worldX\(/.test(sceneSrc)||!/floorY\(/.test(sceneSrc)) throw new Error('world-anchored scenery helpers missing');

// Exercise every authored creature shape through the live Recast draw wrapper and
// through Collection-card generation, both normal and shiny.
const all=[];
if(Array.isArray(w.GAMEDATA.FISH)) all.push(...w.GAMEDATA.FISH);
if(Array.isArray(w.GAMEDATA.CREATURES)) all.push(...w.GAMEDATA.CREATURES);
if(Array.isArray(w.GAMEDATA.BIRDS)) all.push(...w.GAMEDATA.BIRDS);
const seen=new Set(),testCanvas=w.document.createElement('canvas');testCanvas.width=220;testCanvas.height=180;const tc=testCanvas.getContext('2d');
for(const def of all){
  if(!def||!def.shape) continue;
  const arch=w.SPRITES.archetypeForShape(def.shape),key=arch+'|'+(def.color||'')+'|'+(def.accent||'');
  if(seen.has(key)) continue;seen.add(key);
  w.SPRITES.draw(tc,arch,110,90,{color:def.color,accent:def.accent,shiny:false,targetH:54});
  w.SPRITES.draw(tc,arch,110,90,{color:def.color,accent:def.accent,shiny:true,targetH:54});
  const url=w.SPRITES.dataURL(arch,{color:def.color,accent:def.accent,shiny:false,scale:3});
  const shiny=w.SPRITES.dataURL(arch,{color:def.color,accent:def.accent,shiny:true,scale:3});
  if(!/^data:image\/png/.test(url)||!/^data:image\/png/.test(shiny)) throw new Error('Recast Collection render failed for '+arch);
}
if(seen.size<40) throw new Error('Recast art test covered too few creature variants: '+seen.size);

const dummy=w.document.createElement('div');dummy.innerHTML='<div class="update-banner">old tools text</div><h1>Ocean of Discovery</h1><p class="sub">Dive deep. Catch everything. Awaken the Kraken.</p>';w.document.body.appendChild(dummy);
Promise.resolve().then(()=>new Promise(r=>setTimeout(r,0))).then(()=>{
 const banner=dummy.querySelector('.update-banner');
 if(!banner||!/Recast/i.test(banner.textContent)) throw new Error('Recast celebration banner not applied');
 if(!/RECAST/i.test(dummy.querySelector('h1').textContent)) throw new Error('Recast title treatment not applied');
 console.log('Deep Sea Diver: Recast presentation smoke passed. Creature variants exercised: '+seen.size);
 dom.window.close();process.exit(0);
}).catch(err=>{console.error(err);dom.window.close();process.exit(1);});