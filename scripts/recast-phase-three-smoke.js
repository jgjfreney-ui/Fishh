#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const rawHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const html=rawHtml.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:'https://deepsea.local/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
Object.defineProperty(w.document,'readyState',{configurable:true,get:()=> 'complete'});
Object.defineProperty(w,'devicePixelRatio',{configurable:true,value:1});
Object.defineProperty(w,'innerWidth',{configurable:true,value:960});
Object.defineProperty(w,'innerHeight',{configurable:true,value:540});
w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.PointerEvent=w.MouseEvent;
function grad(){return{addColorStop(){}}}
function ctx(canvas){const b={canvas,createLinearGradient:grad,createRadialGradient:grad,createPattern:()=>({}),measureText:t=>({width:String(t||'').length*8}),getImageData:(x,y,ww,hh)=>({data:new Uint8ClampedArray(Math.max(0,ww*hh*4)),width:ww,height:hh}),createImageData:(ww,hh)=>({data:new Uint8ClampedArray(Math.max(0,ww*hh*4)),width:ww,height:hh}),isPointInPath:()=>false,isPointInStroke:()=>false};['save','restore','beginPath','closePath','moveTo','lineTo','rect','roundRect','arc','ellipse','quadraticCurveTo','bezierCurveTo','fill','stroke','clip','fillRect','strokeRect','clearRect','translate','rotate','scale','transform','setTransform','resetTransform','drawImage','fillText','strokeText','putImageData','setLineDash'].forEach(n=>b[n]=()=>{});return new Proxy(b,{get:(t,p)=>p in t?t[p]:undefined,set:(t,p,v)=>(t[p]=v,true)});}
w.HTMLCanvasElement.prototype.getContext=function(){return this.__ctx||(this.__ctx=ctx(this));};
w.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,recast-phase3';};
w.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:960,height:540,right:960,bottom:540}};
function evalFile(rel){w.eval(fs.readFileSync(path.join(root,rel),'utf8')+'\n//# sourceURL='+rel)}
function tick(){return new Promise(r=>w.setTimeout(r,0));}

(async function(){
  // Match production order: Lounge code loads before the game's menu panel is created.
  evalFile('js/data.js');
  evalFile('js/sprites.js');
  evalFile('js/audio.js');
  evalFile('js/remaster-audio.js');
  evalFile('js/recast-audio.js');
  evalFile('js/game.js');
  evalFile('js/remaster-ui.js');
  evalFile('js/recast-sprites.js');
  evalFile('js/recast-shiny.js');
  evalFile('js/recast-lounge.js');

  if(!w.SPRITES||!w.SPRITES.__recastShiny)throw new Error('Recast shiny wrapper missing');
  if(w.RECAST_SHINY_RULE!=='alternate-palette')throw new Error('Shiny rule is not alternate-palette');
  if(!w.AUDIO||typeof w.AUDIO.recastTracks!=='function')throw new Error('Recast soundtrack registry missing');
  if(typeof w.AUDIO.recastPreviewTrack!=='function'||typeof w.AUDIO.recastBossFamily!=='function')throw new Error('Recast soundtrack playback/boss routing API missing');

  let tracks=w.AUDIO.recastTracks();
  const byId=id=>tracks.find(t=>t.id===id);
  for(const id of ['menu','lounge','boss:kaiju','boss:wyrm','boss:abyss','boss:odd','area:coral','area:river']){
    if(!byId(id))throw new Error('Missing soundtrack registry entry: '+id);
  }
  if(!byId('menu').heard||!byId('lounge').heard)throw new Error('Menu/Lounge should start unlocked');
  if(byId('area:river').heard)throw new Error('Fresh unheard area track should be locked');

  // Hearing a real area theme must unlock it through the same API gameplay uses.
  w.AUDIO.playArea('coral',false);
  tracks=w.AUDIO.recastTracks();
  if(!tracks.find(t=>t.id==='area:coral').heard)throw new Error('Playing Coral Coast did not unlock its soundtrack entry');

  // Regression test: the real game creates/replaces these panels AFTER recast-lounge.js loads.
  const menu=w.document.createElement('div');
  menu.className='panel start-panel';
  menu.innerHTML='<h1>Deep Sea Diver: Recast</h1><p class="sub">Dive deeper.</p>';
  w.document.body.appendChild(menu);
  await tick();
  let btn=menu.querySelector('.recast-soundtrack-btn');
  if(!btn||!/Soundtrack Lounge/.test(btn.textContent))throw new Error('Late-created start menu did not receive Soundtrack Lounge button');

  const boat=w.document.createElement('div');
  boat.className='panel boat-panel';
  boat.innerHTML='<div class="boat-grid"><button class="big">Dive</button></div>';
  w.document.body.appendChild(boat);
  await tick();
  btn=boat.querySelector('.recast-soundtrack-btn');
  if(!btn||!boat.querySelector('.boat-grid .recast-soundtrack-btn'))throw new Error('Boat menu did not receive Soundtrack Lounge button');

  if(!w.RECAST_LOUNGE||typeof w.RECAST_LOUNGE.open!=='function')throw new Error('Lounge controller missing');
  btn.click();
  const lounge=w.document.getElementById('recast-lounge');
  if(!lounge)throw new Error('Soundtrack Lounge overlay did not open from the real menu button');
  if(!lounge.querySelector('#recast-squid-label'))throw new Error('White Squid record label canvas missing');
  if(!/WHITE SQUID RECORDS/.test(lounge.textContent))throw new Error('White Squid Records branding missing');
  if(!/\?\?\?/.test(lounge.textContent))throw new Error('Unheard soundtrack entries are not hidden as ???');
  if(!/White Squid After Hours/.test(lounge.textContent))throw new Error('Lounge theme metadata missing');

  const white=w.GAMEDATA&&w.GAMEDATA.FISH_BY_ID&&w.GAMEDATA.FISH_BY_ID.whitesquid;
  if(!white||!white.shape)throw new Error('White Squid mascot definition missing');

  // Static guards for the design rule: palette swaps, not literal shiny light FX.
  const shinySrc=fs.readFileSync(path.join(root,'js','recast-shiny.js'),'utf8');
  if(!/local\.shiny=false/.test(shinySrc)||!/alternate-palette/.test(shinySrc))throw new Error('Shiny wrapper no longer suppresses literal shiny effects');
  const gameSrc=fs.readFileSync(path.join(root,'js','game.js'),'utf8');
  if(!/Recast shinies are palette variants, not a light source/.test(gameSrc))throw new Error('Core shiny-light patch missing');
  if(/if \(f\.shiny\) return \{ color: "#fff0a0"/.test(gameSrc))throw new Error('Old generic fish shiny aura returned');
  if(/if \(state\.buddy\.shiny\) drawGlow/.test(gameSrc))throw new Error('Old buddy shiny aura returned');
  if(/if \(b\.shiny\) drawGlow\(x, y, th \* 1\.1, "#fff0a0"/.test(gameSrc))throw new Error('Old bird shiny aura returned');

  const audioSrc=fs.readFileSync(path.join(root,'js','recast-audio.js'),'utf8');
  for(const marker of ['boss:kaiju','boss:wyrm','boss:abyss','boss:odd','White Squid After Hours','deepsea_recast_heard_tracks_v1']){
    if(!audioSrc.includes(marker))throw new Error('Recast audio source missing '+marker);
  }

  for(const asset of ['js/recast-audio.js','js/recast-shiny.js','js/recast-lounge.js','css/recast-lounge.css']){
    if(!rawHtml.includes(asset))throw new Error('index.html does not load '+asset);
  }

  w.RECAST_LOUNGE.close();
  console.log('Recast Phase Three smoke passed: real late-created menus reach the Soundtrack Lounge; shiny palettes, heard-track unlocks, White Squid mascot, and boss-theme families verified.');
  dom.window.close();
  process.exit(0);
})().catch(err=>{
  console.error(err);
  dom.window.close();
  process.exit(1);
});
