/* Deep Sea Diver: Recast — soundtrack registry + boss-family music
 * Tracks are unlocked by actually hearing them. The Lounge can then replay any
 * unlocked track. Bosses are routed into distinct Recast musical families.
 */
(function(){
  'use strict';
  if(!window.AUDIO)return;

  var A=window.AUDIO,D=window.GAMEDATA||{},STORE='deepsea_recast_heard_tracks_v1';
  var heard={menu:true,lounge:true};
  try{var raw=localStorage.getItem(STORE);if(raw){var parsed=JSON.parse(raw);for(var k in parsed)heard[k]=!!parsed[k];}}catch(e){}

  var AREA_TITLES={
    coral:'Sunlit Shallows',river:'Current & Clover',forest:'Old Roots Below',secretcave:'Pale Roots',kelp:'Green Cathedral',
    arctic:'Glasswater',desert:'Sand Beneath the Sea',opensea:'No Land in Sight',ancient:'Before Memory',prism:'Rosewater Prism',
    swamp:'Mangrove Hush',boneyard:'Whale-Fall Lullaby',storm:'Blackwater Weather',mountain:'Sunlit Peaks',olympus:'Above the Clouds',
    jungle:'Emerald Flood',alien:'Two Moons Below',grotto:'Four Jewels',ashen:'Red Water',pirate:'Cursed Anchorage',
    backrooms:'Wet Carpet, Distant Hum',japan:'Petals on the Tide',oilrig:'Rust & Crude',flooded:'Between the Containers',
    cave:'Lanterns Out',cloud:'Cloud Reaches',trench:'Final Descent',sanctuary:'The Quiet Sanctuary'
  };
  var SPECIAL=[
    {id:'menu',name:'Home Port',category:'Menu',source:'Main Menu'},
    {id:'lounge',name:'White Squid After Hours',category:'Lounge',source:'Soundtrack Lounge'},
    {id:'boss:kaiju',name:'Something Huge Is Coming',category:'Boss Theme',source:'Kaiju family'},
    {id:'boss:wyrm',name:'Coils Beneath the Stone',category:'Boss Theme',source:'Wyrm & dragon family'},
    {id:'boss:abyss',name:'Abyss Has Teeth',category:'Boss Theme',source:'Kraken & abyssal titans'},
    {id:'boss:odd',name:'This Was Not in the Brochure',category:'Boss Theme',source:'Secret & strange bosses'},
    {id:'blob',name:'The Great Fake-Out',category:'Special',source:'Blobfish encounter'}
  ];

  function tracks(){
    var out=[SPECIAL[0],SPECIAL[1]];
    var locs=D.LOCATIONS||{};
    Object.keys(locs).forEach(function(id){out.push({id:'area:'+id,name:AREA_TITLES[id]||locs[id].name,category:'Dive Site',source:locs[id].name});});
    for(var i=2;i<SPECIAL.length;i++)out.push(SPECIAL[i]);
    return out.map(function(t){return{id:t.id,name:t.name,category:t.category,source:t.source,heard:!!heard[t.id]};});
  }
  function persist(){try{localStorage.setItem(STORE,JSON.stringify(heard));}catch(e){}}
  function mark(id){if(!id||heard[id])return;heard[id]=true;persist();try{window.dispatchEvent(new CustomEvent('recasttrackheard',{detail:{id:id}}));}catch(e){}}

  var AC=window.AudioContext||window.webkitAudioContext,ctx=null,master=null,timer=null,step=0,currentCustom=null,customMuted=false;
  var CUSTOM_MUSIC_GAIN=.14;
  function mtof(m){return 440*Math.pow(2,(m-69)/12);}
  function ensure(){
    if(ctx||!AC)return !!ctx;
    try{ctx=new AC();master=ctx.createGain();master.gain.value=CUSTOM_MUSIC_GAIN;master.connect(ctx.destination);syncMute();return true;}catch(e){return false;}
  }
  function syncMute(){if(!master||!ctx)return;var off=customMuted||(A.isMusicMuted&&A.isMusicMuted())||(A.isMuted&&A.isMuted());master.gain.setTargetAtTime(off?0:CUSTOM_MUSIC_GAIN,ctx.currentTime,.04);}
  function stopCustom(){if(timer){clearInterval(timer);timer=null;}currentCustom=null;step=0;}
  function voice(midi,dur,type,vol,cutoff,when){
    if(!ensure()||!master)return;var t=when==null?ctx.currentTime:when,o=ctx.createOscillator(),g=ctx.createGain(),lp=ctx.createBiquadFilter();
    o.type=type||'triangle';o.frequency.value=mtof(midi);lp.type='lowpass';lp.frequency.value=cutoff||1800;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,vol||.05),t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(lp);lp.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.04);
  }
  function noise(vol,dur,when){
    if(!ensure()||!master)return;var t=when==null?ctx.currentTime:when,len=Math.max(1,(ctx.sampleRate*dur)|0),b=ctx.createBuffer(1,len,ctx.sampleRate),a=b.getChannelData(0);for(var i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);
    var s=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;hp.type='highpass';hp.frequency.value=2400;g.gain.value=vol;s.connect(hp);hp.connect(g);g.connect(master);s.start(t);
  }
  function chord(root,intervals,dur,type,vol,when){for(var i=0;i<intervals.length;i++)voice(root+intervals[i],dur,type,vol/(1+i*.12),1700,when);}

  var THEMES={
    lounge:{bpm:78,tick:function(s,t,b){var roots=[45,50,43,48],r=roots[Math.floor(s/8)%roots.length];if(s%8===0)chord(r,[0,3,7,10],b*3.3,'sine',.030,t);if(s%2===0)voice(r-12,b*1.5,'triangle',.045,900,t);var mel=[12,15,19,22,19,15,17,14][s%8];if(s%2===1)voice(r+mel,b*1.35,'triangle',.026,1450,t);if(s%4===2)noise(.009,.06,t);}},
    'boss:kaiju':{bpm:138,tick:function(s,t,b){var r=[40,40,43,38][Math.floor(s/8)%4];if(s%2===0){voice(r-12,b*1.2,'sawtooth',.070,700,t);voice(r,b*.9,'square',.045,1250,t);}if(s%4===0)chord(r,[0,7,12],b*1.8,'square',.032,t);if(s%2===1)noise(.030,.08,t);var m=[0,0,3,0,7,5,3,0][s%8];voice(r+12+m,b*.55,'square',.032,1800,t);}},
    'boss:wyrm':{bpm:118,tick:function(s,t,b){var r=[47,50,45,43][Math.floor(s/12)%4],arp=[0,3,7,10,12,10,7,3,0,5,8,10][s%12];voice(r-12,b*1.8,'sine',.048,700,t);voice(r+arp,b*.8,'triangle',.038,1800,t);if(s%3===0)voice(r+24+(s%2?3:0),b*1.4,'sine',.018,2200,t);if(s%6===3)noise(.014,.07,t);}},
    'boss:abyss':{bpm:104,tick:function(s,t,b){var r=[36,36,39,34][Math.floor(s/8)%4];if(s%4===0){voice(r-12,b*3.2,'sine',.080,420,t);chord(r,[0,3,7],b*2.8,'triangle',.028,t);}var m=[0,null,3,5,null,7,5,3][s%8];if(m!=null)voice(r+12+m,b*1.25,'sawtooth',.030,1200,t);if(s%4===2)noise(.020,.12,t);}},
    'boss:odd':{bpm:126,tick:function(s,t,b){var r=[52,49,54,47][Math.floor(s/8)%4],m=[0,6,3,10,1,7,4,9][s%8];if(s%4===0)chord(r,[0,3,6,10],b*1.6,'triangle',.026,t);voice(r+12+m,b*.55,s%2?'square':'triangle',.030,1700,t);if(s%3===1)noise(.012,.05,t);}}
  };
  function startCustom(id){
    stopCustom();currentCustom=id;mark(id);if(!ensure())return;try{if(ctx.state==='suspended')ctx.resume();}catch(e){}
    var th=THEMES[id]||THEMES.lounge,beat=60/th.bpm,half=beat/2;step=0;
    function fire(){if(!ctx)return;syncMute();var t=ctx.currentTime+.025;th.tick(step++,t,half);}
    fire();timer=setInterval(fire,half*1000);
  }

  function activeBoss(){
    try{var run=window.DEEPSEA&&DEEPSEA.run?DEEPSEA.run():null;if(!run||!run.fish)return null;for(var i=run.fish.length-1;i>=0;i--)if(run.fish[i]&&run.fish[i].isBoss)return run.fish[i];}catch(e){}return null;
  }
  function bossFamily(){
    var b=activeBoss(),d=b&&b.def?b.def:{},id=d.id||'',sh=d.shape||'';
    var kaiju=/kaiju|giant|stonetitan|cinderboss|xenoboss|rigtitan/i.test(id+' '+sh);
    var wyrm=/wyrm|dragon|celestserp|ancientlev|deeplev|leviathanking/i.test(id+' '+sh);
    var abyss=/kraken|mega|megalodon|skeletonshark|greenlandshark|kingcuttle|davyjones/i.test(id+' '+sh)||(b&&b.isKraken);
    return kaiju?'boss:kaiju':wyrm?'boss:wyrm':abyss?'boss:abyss':'boss:odd';
  }

  var playArea=A.playArea.bind(A),playMenu=A.playMenu.bind(A),playBlob=A.playBlob.bind(A),baseStop=A.stopAll.bind(A),setMusic=A.setMusicMuted.bind(A),setMuted=A.setMuted.bind(A);
  A.playArea=function(id,night){stopCustom();mark('area:'+id);return playArea(id,night);};
  A.playMenu=function(night){stopCustom();mark('menu');return playMenu(night);};
  A.playBlob=function(){stopCustom();mark('blob');return playBlob();};
  A.playBoss=function(){var id=bossFamily();baseStop();startCustom(id);return id;};
  A.stopAll=function(){stopCustom();return baseStop();};
  A.setMusicMuted=function(v){customMuted=!!v;var r=setMusic(v);syncMute();return r;};
  A.setMuted=function(v){var r=setMuted(v);syncMute();return r;};

  A.recastTracks=tracks;
  A.recastHeard=function(id){return !!heard[id];};
  A.recastMarkHeard=mark;
  A.recastBossFamily=bossFamily;
  A.recastNowPlaying=function(){return currentCustom;};
  A.recastPreviewTrack=function(id){
    if(!heard[id]&&id!=='lounge'&&id!=='menu')return false;
    if(id.indexOf('area:')===0){stopCustom();playArea(id.slice(5),false);return true;}
    if(id==='menu'){stopCustom();playMenu(false);return true;}
    if(id==='blob'){stopCustom();playBlob();return true;}
    if(THEMES[id]){baseStop();startCustom(id);return true;}
    return false;
  };
  A.recastPlayLounge=function(){baseStop();startCustom('lounge');};
  window.RECAST_AUDIO_VERSION='1.0';
})();