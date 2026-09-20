/* Deep Sea Diver: Recast — Soundtrack Lounge UI */
(function(){
  'use strict';
  var currentId='lounge',overlay=null;

  function q(sel,root){return(root||document).querySelector(sel);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tracks(){return window.AUDIO&&AUDIO.recastTracks?AUDIO.recastTracks():[];}
  function meta(id){var a=tracks();for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}

  function installStartButton(panel){
    if(!panel||panel.querySelector('.recast-soundtrack-btn'))return;
    var b=document.createElement('button');b.className='big recast-soundtrack-btn';b.type='button';b.textContent='🎵 Soundtrack Lounge';b.onclick=open;
    var sub=panel.querySelector('.sub');
    if(sub&&sub.nextSibling)panel.insertBefore(b,sub.nextSibling);else panel.appendChild(b);
  }

  function installBoatButton(panel){
    if(!panel||panel.querySelector('.recast-soundtrack-btn'))return;
    var grid=panel.querySelector('.boat-grid');if(!grid)return;
    var b=document.createElement('button');b.className='big recast-soundtrack-btn';b.type='button';b.textContent='🎵 Soundtrack Lounge';b.onclick=open;grid.appendChild(b);
  }

  function enhancePanel(panel){
    if(!panel||panel.nodeType!==1)return;
    if(panel.matches&&panel.matches('.start-panel'))installStartButton(panel);
    if(panel.matches&&panel.matches('.boat-panel'))installBoatButton(panel);
  }

  function ensureButton(root){
    root=root||document;
    if(root.nodeType===1)enhancePanel(root); // MutationObserver hands us the panel itself.
    if(!root.querySelectorAll)return;
    var panels=root.querySelectorAll('.start-panel,.boat-panel');
    for(var i=0;i<panels.length;i++)enhancePanel(panels[i]);
  }

  function groupName(cat){return cat==='Dive Site'?'DIVE SITES':cat==='Boss Theme'?'BOSS THEMES':cat==='Lounge'?'RECAST':cat==='Menu'?'RECAST':cat.toUpperCase();}
  function buildList(){
    var all=tracks(),last='',html='';
    for(var i=0;i<all.length;i++){
      var t=all[i],g=groupName(t.category);
      if(g!==last){last=g;html+='<div class="recast-track-group">'+esc(g)+'</div>';}
      html+='<button class="recast-track'+(t.heard?'':' locked')+(t.id===currentId?' active':'')+'" data-track="'+esc(t.id)+'" type="button">'
        +'<span class="recast-track-name">'+(t.heard?esc(t.name):'🔒 ???')+'</span>'
        +'<span class="recast-track-source">'+(t.heard?esc(t.source):'Hear it in-game to unlock')+'</span></button>';
    }
    return html;
  }

  function drawMascot(){
    if(!overlay||!window.SPRITES||!window.GAMEDATA)return;var c=q('#recast-squid-label',overlay);if(!c)return;var ctx=c.getContext('2d');if(!ctx)return;
    c.width=96;c.height=96;ctx.clearRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;
    var d=GAMEDATA.FISH_BY_ID&&GAMEDATA.FISH_BY_ID.whitesquid;if(!d)return;
    SPRITES.draw(ctx,SPRITES.archetypeForShape(d.shape),48,48,{color:d.color,accent:d.accent,shiny:false,targetH:58});
  }

  function updateNow(id,lockedMessage){
    var t=meta(id)||meta('lounge');if(!t)return;
    var title=q('.recast-now-title',overlay),m=q('.recast-now-meta',overlay),note=q('.recast-now-note',overlay),vinyl=q('.recast-vinyl',overlay);
    if(title)title.textContent=t.heard?t.name:'???';if(m)m.textContent=t.heard?(t.category+' · '+t.source):'Locked track';
    if(note)note.textContent=lockedMessage|| (id==='lounge'?'The White Squid keeps the booth warm here — brushed beats, soft chords, and nowhere you need to be.':'Unlocked by hearing this piece naturally during your dives.');
    if(vinyl)vinyl.classList.toggle('playing',!!t.heard);
  }

  function bindTracks(){
    if(!overlay)return;q('.recast-track-pane',overlay).innerHTML=buildList();
    var bs=overlay.querySelectorAll('[data-track]');for(var i=0;i<bs.length;i++)bs[i].onclick=function(){
      var id=this.getAttribute('data-track'),t=meta(id);if(!t||!t.heard){updateNow(id,'That record is still sealed. Hear its song in the game first.');return;}
      currentId=id;if(window.AUDIO&&AUDIO.recastPreviewTrack)AUDIO.recastPreviewTrack(id);bindTracks();updateNow(id);
    };
  }

  function close(){
    if(!overlay)return;overlay.remove();overlay=null;currentId='lounge';
    if(window.AUDIO&&AUDIO.playMenu)AUDIO.playMenu(false);
  }

  function open(){
    if(overlay)return;currentId='lounge';
    overlay=document.createElement('div');overlay.id='recast-lounge';overlay.innerHTML=''
      +'<div class="recast-lounge-shell">'
      +'<div class="recast-lounge-head"><div><div class="rl-kicker">DEEP SEA DIVER: RECAST</div><h2>🎵 Soundtrack Lounge</h2></div><button class="rl-close" type="button">✕ Close</button></div>'
      +'<div class="recast-lounge-body"><div class="recast-track-pane"></div><div class="recast-now-pane">'
      +'<div class="recast-vinyl playing"><div class="recast-label"><canvas id="recast-squid-label" width="96" height="96"></canvas></div><div class="recast-label-hole"></div></div>'
      +'<div class="recast-record-brand">WHITE SQUID RECORDS</div><div class="recast-now-title">White Squid After Hours</div><div class="recast-now-meta">Lounge · Soundtrack Lounge</div>'
      +'<div class="recast-now-note">The White Squid keeps the booth warm here — brushed beats, soft chords, and nowhere you need to be.</div>'
      +'<div class="recast-locked-note">Tracks join the shelf only after you hear them in the game.</div>'
      +'</div></div></div>';
    document.body.appendChild(overlay);q('.rl-close',overlay).onclick=close;
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    bindTracks();drawMascot();if(window.AUDIO&&AUDIO.recastPlayLounge)AUDIO.recastPlayLounge();
  }

  addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay)close();});
  addEventListener('recasttrackheard',function(){if(overlay)bindTracks();});
  ensureButton(document);
  var obs=new MutationObserver(function(ms){
    for(var i=0;i<ms.length;i++)for(var j=0;j<ms[i].addedNodes.length;j++){
      var n=ms[i].addedNodes[j];if(n&&n.nodeType===1)ensureButton(n);
    }
  });
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  window.RECAST_LOUNGE={open:open,close:close,refresh:function(){ensureButton(document);}};
})();
