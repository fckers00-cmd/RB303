const fs=require('fs');
const path=require('path');
const APP=path.join(__dirname,'..','rb303.html');
const html=fs.readFileSync(APP,'utf8');
const m=html.match(/\/\* ==== DSP CORE BEGIN[^]*?\*\/([^]*?)\/\* ==== DSP CORE END ==== \*\//);
if(!m){ console.log('FAIL: markers not found'); process.exit(1); }
const ns=eval(m[1]+';({TUNING,SILENT,tanh,midiToFreq,polyblep,DrumKick,DrumSnare,DrumClap,DrumHat,Engine})');

const SR=44100;
/* Tests used to only print FAIL and still exit 0, so a broken build passed the
   suite silently. Anything that matters must call fail(). */
let FAILURES=0;
const fail=(m)=>{FAILURES++;console.log('  ^^ FAIL: '+m);};
process.on('exit',()=>{ if(FAILURES){ console.log('\n'+FAILURES+' assertion(s) failed'); process.exitCode=1; } });
function drumPat(steps){ const p=[];for(let i=0;i<16;i++)p.push({on:steps.includes(i)?1:0,accent:(i===0?1:0)});return p; }

// 0) per-drum-voice solo levels (peak/RMS over 0.6s each)
for(const [name,mk] of [
  ['BD',()=>new ns.DrumKick(SR)],['SD',()=>new ns.DrumSnare(SR)],
  ['CP',()=>new ns.DrumClap(SR)],
  ['CH',()=>new ns.DrumHat(SR,ns.TUNING.hh.chDecayS)],
  ['OH',()=>new ns.DrumHat(SR,ns.TUNING.hh.ohDecayS)]]){
  const v=mk();
  if(name==='SD') v.trigger(0,190,0.30,0.55);
  else if(name==='CP') v.trigger(0,1050,0.15,0.010);
  else v.trigger(0);
  let peak=0,sum=0,nan=0; const N=SR*0.6|0;
  for(let i=0;i<N;i++){const s=v.process();if(!(s===s))nan++;peak=Math.max(peak,Math.abs(s));sum+=s*s;}
  console.log(name+' solo: peak='+peak.toFixed(3)+' rms='+Math.sqrt(sum/N).toFixed(3)+' NaN='+nan);
}

// 0b) Kit balance in the mix. Raw solo peaks may exceed 1.0 by design (the fader
// brings them down) — what matters is where each voice LANDS in the mix at its
// default fader, and that kick > snare/clap > hats. This catches the "buried
// snare/clap" bug that made them inaudible under the 303.
{
  const db=x=>20*Math.log10(x+1e-9);
  const e=new ns.Engine(SR);
  const raw=(t)=>{const eng=new ns.Engine(SR);eng.trigDrum(t,0);const N=SR*0.5|0;let s=0;
    for(let i=0;i<N;i++){let v=0;
      if(t==='BD')v=eng.bd.process();else if(t==='SD')v=eng.sd.process();
      else if(t==='CP')v=eng.cp.process();else if(t==='CH')v=eng.chh.process();
      else if(t==='OH')v=eng.ohh.process();s+=v*v;}
    return Math.sqrt(s/N);};
  const mix={};
  for(const t of ['BD','SD','CP','CH','OH']) mix[t]=db(raw(t)*e.p['v'+t]);
  const gapSD=mix.BD-mix.SD, gapCP=mix.BD-mix.CP;
  // snare and clap should be within ~8dB of the kick (audible), hats further back
  const ok = gapSD<8 && gapCP<9 && mix.CH<mix.SD && mix.OH<mix.SD;
  if(!ok) fail('kit balance');
  console.log('kit balance: '+(ok?'OK':'FAIL')+
    '  BD '+mix.BD.toFixed(0)+'  SD '+mix.SD.toFixed(0)+
    '  CP '+mix.CP.toFixed(0)+'  CH '+mix.CH.toFixed(0)+'  OH '+mix.OH.toFixed(0)+' dB');
}

// 0b) choke: trigger OH, run 20ms, choke, verify it dies within ~10ms
{
  const oh=new ns.DrumHat(SR,ns.TUNING.hh.ohDecayS);
  oh.trigger(0);
  for(let i=0;i<SR*0.02;i++) oh.process();
  let pre=0; for(let i=0;i<64;i++) pre=Math.max(pre,Math.abs(oh.process()));
  oh.choke();
  for(let i=0;i<SR*0.01;i++) oh.process();
  let post=0; for(let i=0;i<64;i++) post=Math.max(post,Math.abs(oh.process()));
  console.log('choke: pre='+pre.toFixed(4)+' post10ms='+post.toFixed(6)+' -> '+(post<pre*0.01?'OK':'FAIL'));
}

// 1) stability + level + cpu, 4-sec full pattern (303 + all 5 drums)
const eng=new ns.Engine(SR);
const P=[];for(let i=0;i<16;i++)P.push({note:36+(i%3)*3,t:(i%4===3?0:(i%4===2?2:1)),accent:(i%4===0?1:0),slide:(i%2===0?1:0)});
eng.setPattern(P);
eng.setDrums({ BD:drumPat([0,4,8,12]), SD:drumPat([4,12]), CH:drumPat([2,6,10,14]),
               OH:drumPat([2,10]), CP:drumPat([12]) });   // CH+OH ชน step 2/10 -> เทสต์ choke ใน sequencer ด้วย
eng.setParam('cutoff',500);eng.setParam('reso',0.85);eng.setParam('envMod',0.6);eng.setParam('decay',0.35);
eng.play();
const N=SR*4, out=new Float32Array(N);
const t0=process.hrtime.bigint();
for(let i=0;i<N;i+=128){ const b=out.subarray(i,i+128); eng.render(b,b.length); }
const ms=Number(process.hrtime.bigint()-t0)/1e6;
let peak=0,sum=0,nan=0;
for(let i=0;i<N;i++){const s=out[i];if(!(s===s))nan++;peak=Math.max(peak,Math.abs(s));sum+=s*s;}
console.log('4s full mix: peak='+peak.toFixed(3)+' rms='+Math.sqrt(sum/N).toFixed(3)+' NaN='+nan+
  ' cpu='+(ms/4000*100).toFixed(1)+'%');

// 1b) time data — note/tie/rest must produce three DIFFERENT gate shapes.
// Regression guard: before this existed, consecutive notes were silently all-tied.
{
  const shape=(time)=>{
    const e=new ns.Engine(SR);
    e.setPattern(time.map(t=>({t,note:36,accent:0,slide:0})));
    for(const k of ['vBD','vSD','vCH','vOH','vCP'])e.setParam(k,0);
    e.setParam('v303',1);e.setParam('vMas',1);
    e.play();
    const sp=SR*(60/130)/4|0,N=sp*time.length,o=new Float32Array(N);
    for(let i=0;i<N;i+=128){const b=o.subarray(i,Math.min(i+128,N));e.render(b,b.length);}
    // RMS of the LAST quarter of each step: silent => gate closed early
    return time.map((_,s)=>{let q=0,n=0;
      for(let i=(s*sp+sp*0.75)|0;i<(s+1)*sp;i++){q+=o[i]*o[i];n++;}
      return Math.sqrt(q/n);});
  };
  const notes=shape([1,1,1,1]);      // every step should close its gate
  const ties =shape([1,2,2,2]);      // only the LAST step closes
  const rests=shape([1,0,1,0]);
  const ok = notes.slice(0,3).every(v=>v<0.05)      // plain notes are staccato
          && ties.slice(0,3).every(v=>v>0.15)       // ties sustain across steps
          && ties[3]<0.05                           // ...and release at the end
          && rests[1]<0.01 && rests[3]<0.01;        // rests are silent
  console.log('time data note/tie/rest: '+(ok?'OK':'FAIL')+
    '  [notes '+notes.map(v=>v.toFixed(2)).join(',')+
    ' | ties '+ties.map(v=>v.toFixed(2)).join(',')+']');
}

// 1c) pattern length: len=4 must loop every 4 steps
{
  const e=new ns.Engine(SR);
  const seen=[];
  e.setPattern(new Array(16).fill(0).map((_,i)=>({t:1,note:36+i,accent:0,slide:0})));
  e.setParam('len',4);
  e.onPos=(i)=>seen.push(i);
  e.play();
  const sp=SR*(60/130)/4|0,N=sp*10,o=new Float32Array(N);
  for(let i=0;i<N;i+=128){const b=o.subarray(i,Math.min(i+128,N));e.render(b,b.length);}
  const ok=seen.length>=9&&seen.slice(0,9).join('')==='012301230';
  console.log('pattern length (len=4): '+(ok?'OK':'FAIL -> '+seen.slice(0,9).join('')));
}

// 2) worklet serialization — build exactly like the page, run with stubs
const src=[
 'const TUNING='+JSON.stringify(ns.TUNING)+';',
 'const SILENT='+ns.SILENT+';',
 ns.tanh.toString(),ns.midiToFreq.toString(),ns.polyblep.toString(),
 ns.DrumKick.toString(),ns.DrumSnare.toString(),ns.DrumClap.toString(),ns.DrumHat.toString(),
 ns.Engine.toString(),
 `class Voice303 extends AudioWorkletProcessor{
   constructor(){super();this.eng=new Engine(sampleRate);}
   process(i,o){const b=o[0][0];this.eng.render(b,b.length);return true;}}
  registerProcessor('voice303',Voice303);({Voice303})`
].join('\n');
global.sampleRate=SR;
global.AudioWorkletProcessor=class{constructor(){this.port={postMessage(){},onmessage:null};}};
global.registerProcessor=()=>{};
const w=eval(src);
const v=new w.Voice303(); v.eng.setPattern(P);
v.eng.setDrums({ BD:drumPat([0,8]), SD:drumPat([4]), CH:drumPat([2,6]), OH:drumPat([2]), CP:drumPat([12]) });
v.eng.play();
const buf=[[new Float32Array(128)]];
let ok=true;
for(let i=0;i<200;i++) v.process([],buf);
for(const s of buf[0][0]) if(!(s===s)) ok=false;
console.log('worklet-serialized: '+(ok?'OK':'FAIL'));

// 3) knob-range sweep: every drum knob at min / mid / max must stay finite and
// in-range. Latching at trigger() means a bad value can't be caught by smoothing,
// so the extremes have to be safe by construction.
{
  const SETS={
    SD:[['sdPitch',120,190,260],['sdDecay',0,0.3,1],['sdSnappy',0,0.55,1]],
    CP:[['cpPitch',500,1050,2400],['cpDecay',0.04,0.15,0.5],['cpSpread',0.004,0.010,0.028]],
  };
  let worst=0, bad=[];
  for(const trk in SETS){
    for(const [key,...vals] of SETS[trk]){
      for(const v of vals){
        const e=new ns.Engine(SR);
        e.setParam(key,v);
        for(const k of ['vBD','vSD','vCH','vOH','vCP','v303'])e.setParam(k,k==='v'+trk?1:0);
        e.setParam('vMas',1);
        e.trigDrum(trk,1);                       // accented hit = worst case
        const N=SR*0.8|0, o=new Float32Array(N);
        for(let i=0;i<N;i+=128){const b=o.subarray(i,Math.min(i+128,N));e.render(b,b.length);}
        let pk=0,nan=0;
        for(let i=0;i<N;i++){const x=o[i];if(!(x===x))nan++;if(Math.abs(x)>pk)pk=Math.abs(x);}
        if(pk>worst)worst=pk;
        if(nan||pk>1.05) bad.push(key+'='+v+' peak='+pk.toFixed(2)+(nan?' NaN!':''));
      }
    }
  }
  console.log('knob sweep (18 combos): worst peak='+worst.toFixed(3)+
    ' -> '+(bad.length?'FAIL '+bad.join(' | '):'OK'));
}

// 4) Snap is a bipolar tom<->snare macro (809 rebuild).
// Guards: (a) loudness stays in a tight band across the whole throw — a tom is
// allowed to be beefier than a snare, but not by a lot; (b) timbre moves a great
// deal from tom to snare; (c) the SNARE end keeps real low-mid body, i.e. it must
// NOT collapse into a bright noise-only "hi-hat" sound (the bug that triggered
// this rebuild).
{
  const db=x=>20*Math.log10(x);
  const spec=(o)=>{let num=0,den=0,lm=0,tot=0;const N=4096;
    for(let k=2;k<600;k++){let re=0,im=0;
      for(let i=0;i<N;i++){const a=2*Math.PI*k*i/N;re+=o[i]*Math.cos(a);im-=o[i]*Math.sin(a);}
      const g=re*re+im*im,f=k*SR/N;num+=Math.sqrt(g)*f;den+=Math.sqrt(g);tot+=g;if(f>=140&&f<=430)lm+=g;}
    return {cen:num/den, lm:lm/tot};};
  const R=[],C=[]; let snareLM=0;
  for(const s of [0,0.2,0.33,0.55,0.8,1]){
    const v=new ns.DrumSnare(SR); v.trigger(0,190,0.30,s);
    const N=SR*0.6|0,o=new Float32Array(4096); let sum=0;
    for(let i=0;i<N;i++){const x=v.process();if(i<4096)o[i]=x;sum+=x*x;}
    R.push(Math.sqrt(sum/N)); const sp=spec(o); C.push(sp.cen);
    if(s===1) snareLM=sp.lm;
  }
  const swing=db(Math.max(...R)/Math.min(...R));
  const semis=Math.abs(12*Math.log2(C[C.length-1]/C[0]));
  console.log('snap loudness band: '+(swing<=4?'OK':'FAIL')+'  swing='+swing.toFixed(2)+'dB'+
    '   tom->snare timbre '+semis.toFixed(1)+' semitone '+(semis>10?'OK':'FAIL'));
  // the whole point of the rebuild: snare end still has body, isn't a hi-hat
  if(!(snareLM>0.15)) fail('snare lost its body');
  console.log('snare keeps body (not hi-hat): '+(snareLM>0.15?'OK':'FAIL')+
    '  low-mid frac at Snap 100% = '+(snareLM*100).toFixed(0)+'%');
}

// 5) Voice deactivation. A voice that has decayed below -72 dB must stop
// computing — otherwise five drum voices grind through oscillators forever.
{
  const e=new ns.Engine(SR);
  const N=SR*3,o=new Float32Array(N);
  for(let i=0;i<N;i+=128){const b=o.subarray(i,i+128);e.render(b,b.length);}
  const idleOff=!e.bd.active&&!e.sd.active&&!e.cp.active&&!e.chh.active&&!e.ohh.active;
  let pk=0; for(let i=0;i<N;i++) pk=Math.max(pk,Math.abs(o[i]));
  console.log('idle voices deactivate: '+(idleOff&&pk===0?'OK':'FAIL')+'  (peak while idle '+pk+')');
  // ...and a trigger must wake them back up and still make sound
  e.trigDrum('BD',0); e.setParam('vBD',1); e.setParam('vMas',1);
  const o2=new Float32Array(512);
  e.render(o2,512);
  let pk2=0; for(let i=0;i<512;i++) pk2=Math.max(pk2,Math.abs(o2[i]));
  console.log('trigger reactivates voice: '+(e.bd.active&&pk2>0.01?'OK':'FAIL')+'  peak='+pk2.toFixed(3));
}

// 6) Bus headroom + master position.
// Two bugs lived here: (a) voices were balanced by AVERAGE level, which sent
// their PEAKS to ~3.2 into the shared soft-clip — every drum hit ducked the
// whole mix ~9 dB, heard as pumping; (b) the master fader sat AFTER the clipper,
// so the player could not reduce distortion with it at all.
{
  const db=x=>20*Math.log10(x+1e-9);
  const dp=(st)=>{const p=[];for(let i=0;i<16;i++)p.push({on:st.includes(i)?1:0,accent:i%4===0?1:0});return p;};
  const mk=(vmas)=>{
    const e=new ns.Engine(SR);
    e.setDrums({BD:dp([0,4,8,12]),SD:dp([4,12]),CH:dp([2,6,10,14]),OH:dp([]),CP:dp([4,12])});
    e.setPattern(new Array(16).fill(0).map((_,i)=>
      ({note:36,t:i%4===3?0:1,accent:i%4===0?1:0,slide:0})));
    if(vmas!==undefined) e.setParam('vMas',vmas);
    e.play();
    const N=SR*4,o=new Float32Array(N);
    for(let i=0;i<N;i+=128){const b=o.subarray(i,i+128);e.render(b,b.length);}
    let pk=0,sum=0;for(let i=0;i<N;i++){pk=Math.max(pk,Math.abs(o[i]));sum+=o[i]*o[i];}
    return {pk,rms:Math.sqrt(sum/N)};
  };
  // (a) The clipper may catch transient PEAKS (that is a limiter doing its job)
  // but must not be compressing a meaningful share of the signal — that is what
  // is heard as pumping. Measure the share, not just the worst case.
  {
    const e=new ns.Engine(SR);
    e.setDrums({BD:dp([0,4,8,12]),SD:dp([4,12]),CH:dp([2,6,10,14]),OH:dp([]),CP:dp([4,12])});
    e.setPattern(new Array(16).fill(0).map((_,i)=>
      ({note:36,t:i%4===3?0:1,accent:i%4===0?1:0,slide:0})));
    e.play();
    const N=SR*4,o=new Float32Array(N);
    for(let i=0;i<N;i+=128){const b=o.subarray(i,i+128);e.render(b,b.length);}
    // invert the output clip to recover how hard it was driven
    let squashed=0,worst=1;
    for(let i=0;i<N;i++){
      const y=o[i]/0.9;                                   // undo master
      if(Math.abs(y)>=0.9999){squashed++;continue;}
      const x=0.5*Math.log((1+y)/(1-y));                  // atanh
      const gr=Math.abs(x)>1e-6?Math.abs(y/x):1;
      if(gr<0.707)squashed++;
      if(gr<worst)worst=gr;
    }
    const pct=squashed/N*100;
    if(!(pct<0.5)) fail('bus headroom');
  console.log('bus headroom: '+(pct<0.5?'OK':'FAIL')+
      '  '+pct.toFixed(2)+'% of samples compressed >3dB (must stay under 0.5%)'+
      '   worst '+db(worst).toFixed(1)+' dB');
  }
  // (b) the master fader must actually change the peak — proves it is pre-clip
  const lo=mk(0.4), hi=mk(1.0);
  const works=(hi.pk-lo.pk)>0.15;
  if(!works) fail('master is pre-clip');
  console.log('master is pre-clip: '+(works?'OK':'FAIL')+
    '  peak at vMas 0.4='+lo.pk.toFixed(2)+' vs 1.0='+hi.pk.toFixed(2));
}

// 7) Hollowness guard. "Hollow" has a measurable signature: the body resonance
// towering over the noise floor, so the ear hears a tube rather than a drum.
// The voice was fine — the DEFAULT Snap position sat in the hollow zone (17 dB
// peak-over-floor). This pins the shipped default to the usable range and
// checks the knob still reaches a fat tom at the far left.
{
  const db=x=>10*Math.log10(x+1e-12);
  const shape=(snap)=>{
    const v=new ns.DrumSnare(SR); v.trigger(0,190,0.30,snap);
    const N=8192,o=new Float32Array(N); let pk=0;
    for(let i=0;i<N;i++){o[i]=v.process();pk=Math.max(pk,Math.abs(o[i]));}
    for(let i=0;i<N;i++)o[i]/=pk;
    const mag=[];
    for(let k=2;k<1600;k++){let re=0,im=0;
      for(let n=0;n<N;n++){const a=2*Math.PI*k*n/N;re+=o[n]*Math.cos(a);im-=o[n]*Math.sin(a);}
      mag.push([k*SR/N,re*re+im*im]);}
    const d=(lo,hi)=>{let e=0,c=0;for(const [f,g] of mag)if(f>=lo&&f<hi){e+=g;c++;}return c?e/c:0;};
    return db(d(170,340))-db(d(600,1500));   // resonance above floor, in dB
  };
  const def=shape(0.78), tom=shape(0.1);
  console.log('default not hollow: '+(def<15?'OK':'FAIL')+
    '  peak-over-floor '+def.toFixed(1)+' dB at shipped default (must stay under 15)');
  console.log('tom end still fat: '+(tom>20?'OK':'FAIL')+'  '+tom.toFixed(1)+' dB');
}
