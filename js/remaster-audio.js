/* Deep Sea Diver: Remastered — subtle area-specific ambient music layer */
(function(){
  'use strict';
  if(!window.AUDIO) return;

  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return;
  var ctx=null, gain=null, timer=null, current='menu', muted=false;

  var THEMES={
    menu:{root:60,mode:[0,4,7,11],pace:7.5,wave:'sine'},
    coral:{root:60,mode:[0,4,7,9],pace:6.6,wave:'triangle'},
    river:{root:62,mode:[0,2,7,9],pace:7.2,wave:'triangle'},
    forest:{root:57,mode:[0,4,7,11],pace:8.4,wave:'sine'},
    secretcave:{root:55,mode:[0,3,7,10],pace:9.1,wave:'sine'},
    kelp:{root:57,mode:[0,4,7,9],pace:8.0,wave:'triangle'},
    arctic:{root:69,mode:[0,4,7,11],pace:9.5,wave:'sine'},
    desert:{root:57,mode:[0,1,5,7],pace:8.8,wave:'triangle'},
    opensea:{root:60,mode:[0,4,7,9],pace:9.2,wave:'sine'},
    ancient:{root:50,mode:[0,3,7,10],pace:9.0,wave:'triangle'},
    prism:{root:64,mode:[0,4,7,11],pace:6.8,wave:'sine'},
    swamp:{root:55,mode:[0,3,7,10],pace:9.4,wave:'sine'},
    boneyard:{root:50,mode:[0,3,7,10],pace:10.2,wave:'sine'},
    storm:{root:50,mode:[0,3,7,10],pace:7.0,wave:'triangle'},
    mountain:{root:60,mode:[0,4,7,11],pace:8.6,wave:'sine'},
    olympus:{root:72,mode:[0,4,7,11],pace:7.6,wave:'sine'},
    jungle:{root:55,mode:[0,2,7,9],pace:6.9,wave:'triangle'},
    alien:{root:63,mode:[0,3,6,10],pace:10.5,wave:'sine'},
    grotto:{root:60,mode:[0,1,5,7],pace:9.4,wave:'sine'},
    ashen:{root:47,mode:[0,3,7,10],pace:8.0,wave:'triangle'},
    pirate:{root:52,mode:[0,3,7,10],pace:7.4,wave:'triangle'},
    backrooms:{root:49,mode:[0,1,7,8],pace:12.0,wave:'sine'},
    japan:{root:66,mode:[0,2,7,9],pace:8.8,wave:'triangle'},
    oilrig:{root:48,mode:[0,3,7,10],pace:8.0,wave:'triangle'},
    flooded:{root:45,mode:[0,3,7,10],pace:10.0,wave:'sine'},
    cave:{root:53,mode:[0,3,7,10],pace:10.0,wave:'sine'},
    cloud:{root:72,mode:[0,4,7,9],pace:7.4,wave:'sine'},
    trench:{root:48,mode:[0,3,7,10],pace:11.0,wave:'sine'},
    sanctuary:{root:67,mode:[0,4,7,11],pace:8.2,wave:'sine'}
  };

  function mtof(m){return 440*Math.pow(2,(m-69)/12);}
  function ensure(){
    if(ctx) return true;
    try{
      ctx=new AC();
      gain=ctx.createGain(); gain.gain.value=0.035; gain.connect(ctx.destination);
      return true;
    }catch(e){return false;}
  }
  function chime(midi,dur,vol,wave){
    if(!ensure()||muted||window.AUDIO.isMusicMuted&&window.AUDIO.isMusicMuted()) return;
    var t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain(),lp=ctx.createBiquadFilter();
    o.type=wave||'sine'; o.frequency.value=mtof(midi);
    lp.type='lowpass'; lp.frequency.value=1500;
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.08); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(lp);lp.connect(g);g.connect(gain);o.start(t);o.stop(t+dur+.05);
  }
  function phrase(){
    if(!ensure()) return;
    var th=THEMES[current]||THEMES.menu;
    var idx=(Math.random()*th.mode.length)|0;
    var note=th.root+th.mode[idx]+(Math.random()>.72?12:0);
    chime(note,2.4,.22,th.wave);
    if(Math.random()>.55) setTimeout(function(){chime(note+7,1.8,.12,'sine');},520);
    timer=setTimeout(phrase,(th.pace*(.82+Math.random()*.36))*1000);
  }
  function setArea(id){
    current=THEMES[id]?id:'menu';
    if(timer) clearTimeout(timer);
    if(ensure()&&ctx.state==='suspended') ctx.resume();
    timer=setTimeout(phrase,900);
  }

  var A=window.AUDIO;
  var playArea=A.playArea.bind(A),playMenu=A.playMenu.bind(A),playBoss=A.playBoss.bind(A),playBlob=A.playBlob.bind(A),stopAll=A.stopAll.bind(A),setMusicMuted=A.setMusicMuted.bind(A);
  A.playArea=function(a,n){var r=playArea(a,n);setArea(a);return r;};
  A.playMenu=function(n){var r=playMenu(n);setArea('menu');return r;};
  A.playBoss=function(){if(timer)clearTimeout(timer);current='menu';return playBoss();};
  A.playBlob=function(){if(timer)clearTimeout(timer);current='menu';return playBlob();};
  A.stopAll=function(){if(timer)clearTimeout(timer);timer=null;return stopAll();};
  A.setMusicMuted=function(m){muted=!!m;if(gain&&ctx)gain.gain.linearRampToValueAtTime(muted?0:.035,ctx.currentTime+.18);return setMusicMuted(m);};
})();