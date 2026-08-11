/* ==========================================================================
   SON — synthèse WebAudio, aucun fichier externe
   Auto-suffisant : aucun état de jeu, l'AudioContext est créé paresseusement
   au premier son et seulement si la fenêtre a le focus.
   ========================================================================== */
let AC=null, noiseBuf=null, lastSnd=0, sndCount=0;
export function audio(){
  if(AC) return AC;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  noiseBuf=AC.createBuffer(1,AC.sampleRate*0.5,AC.sampleRate);
  const d=noiseBuf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  return AC;
}
export function sfx(type){
  const ac=AC||(document.hasFocus()?audio():null); if(!ac) return;
  const now=ac.currentTime;
  if(now-lastSnd<0.016){ if(++sndCount>4) return; } else { sndCount=0; lastSnd=now; }
  const g=ac.createGain(); g.connect(ac.destination);
  const noise=()=>{const s=ac.createBufferSource(); s.buffer=noiseBuf; return s;};
  if(type==='rifle'||type==='mg'||type==='smg'){
    const s=noise(), f=ac.createBiquadFilter();
    f.type='bandpass'; f.frequency.value=type==='smg'?1500:type==='mg'?900:1100; f.Q.value=0.8;
    s.connect(f); f.connect(g);
    const v=type==='rifle'?0.16:0.09;
    g.gain.setValueAtTime(v,now); g.gain.exponentialRampToValueAtTime(0.001,now+(type==='rifle'?0.16:0.08));
    s.start(now); s.stop(now+0.2);
  } else if(type==='boom'){
    const s=noise(), f=ac.createBiquadFilter();
    f.type='lowpass'; f.frequency.setValueAtTime(900,now); f.frequency.exponentialRampToValueAtTime(90,now+0.5);
    s.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.5,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.7);
    s.start(now); s.stop(now+0.8);
    const o=ac.createOscillator(), og=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(120,now); o.frequency.exponentialRampToValueAtTime(35,now+0.45);
    og.gain.setValueAtTime(0.4,now); og.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    o.connect(og); og.connect(ac.destination); o.start(now); o.stop(now+0.55);
  } else if(type==='down'){
    const o=ac.createOscillator(); o.type='triangle';
    o.frequency.setValueAtTime(320,now); o.frequency.exponentialRampToValueAtTime(80,now+0.3);
    o.connect(g); g.gain.setValueAtTime(0.2,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
    o.start(now); o.stop(now+0.4);
  } else if(type==='smoke'){
    const s=noise(), f=ac.createBiquadFilter();
    f.type='highpass'; f.frequency.value=1800;
    s.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.001,now);
    g.gain.exponentialRampToValueAtTime(0.16,now+0.08);
    g.gain.exponentialRampToValueAtTime(0.001,now+1.1);
    s.start(now); s.stop(now+1.2);
  } else if(type==='spot'){
    const o=ac.createOscillator(); o.type='square';
    o.frequency.setValueAtTime(880,now); o.frequency.setValueAtTime(1320,now+0.05);
    o.connect(g); g.gain.setValueAtTime(0.045,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
    o.start(now); o.stop(now+0.14);
  } else if(type==='pen'||type==='deny'||type==='go'||type==='throw'){
    const o=ac.createOscillator(); o.type='square';
    const f0=type==='deny'?150:type==='go'?520:type==='throw'?300:660;
    o.frequency.setValueAtTime(f0,now);
    o.frequency.exponentialRampToValueAtTime(type==='deny'?90:f0*1.4,now+0.07);
    o.connect(g); g.gain.setValueAtTime(0.05,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.11);
    o.start(now); o.stop(now+0.13);
  }
}
