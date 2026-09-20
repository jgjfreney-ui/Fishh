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
w.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,'};
w.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:960,height:540,right:960,bottom:540}};
function evalFile(rel){w.eval(fs.readFileSync(path.join(__dirname,'..',rel),'utf8')+'\n//# sourceURL='+rel)}
evalFile('js/data.js');evalFile('js/sprites.js');evalFile('js/audio.js');evalFile('js/remaster-audio.js');evalFile('js/game.js');evalFile('js/remaster.js');evalFile('js/remaster-ui.js');
if(!w.DEEPSEA||!w.DEEPSEA._test) throw new Error('game test API missing');
w.DEEPSEA._test.newGame();w.DEEPSEA._test.devSave();w.DEEPSEA._test.dive('coral');w.DEEPSEA._test.frame(.016);
if(!w.document.getElementById('remaster-fx')) throw new Error('remaster effects canvas missing');
if(!w.SPRITES.__remastered) throw new Error('sprite remaster wrapper missing');
const dummy=w.document.createElement('div');dummy.innerHTML='<div class="update-banner">old tools text</div><h1>Ocean of Discovery</h1><p class="sub">Dive deep. Catch everything. Awaken the Kraken.</p>';w.document.body.appendChild(dummy);
return Promise.resolve().then(()=>new Promise(r=>setTimeout(r,0))).then(()=>{
 const banner=dummy.querySelector('.update-banner');
 if(!banner||!/Remastered/i.test(banner.textContent)) throw new Error('remaster celebration banner not applied');
 if(!/Deep Sea Diver/i.test(dummy.querySelector('h1').textContent)) throw new Error('remaster title not applied');
 console.log('Phase Two remaster smoke passed.');
});