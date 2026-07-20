const fs=require('fs');
const path=require('path');
const APP=path.join(__dirname,'..','rb303.html');
const html=fs.readFileSync(APP,'utf8');
const m=html.match(/\/\* ==== DSP CORE BEGIN[^]*?\*\/([^]*?)\/\* ==== DSP CORE END ==== \*\//);
if(!m){ console.log('FAIL: markers not found'); process.exit(1); }
const ns=eval(m[1]+';({TUNING,tanh,midiToFreq,polyblep,DrumKick,DrumSnare,DrumClap,DrumHat,Engine})');

const SR=44100;
function drumPat(steps){ const p=[];for(let i=0;i<16;i++)p.push({on:steps.includes(i)?1:0,accent:(i===0?1:0)});return p; }

// 0) per-drum-voice solo levels (peak/RMS over 0.6s each)
for(const [name,mk] of [
  ['BD',()=>new ns.DrumKick(SR)],['SD',()=>new ns.DrumSnare(SR)],
  ['CP',()=>new ns.DrumClap(SR)],
  ['CH',()=>new ns.DrumHat(SR,ns.TUNING.hh.chDecayS)],
  ['OH',()=>new ns.DrumHat(SR,ns.TUNING.hh.ohDecayS)]]){
  const v=mk();
  if(name==='SD') v.trigger(0,182,0.18,0.62);
  else if(name==='CP') v.trigger(0,1050,0.15,0.010);
  else v.trigger(0);
  let peak=0,sum=0,nan=0; const N=SR*0.6|0;
  for(let i=0;i<N;i++){const s=v.process();if(!(s===s))nan++;peak=Math.max(peak,Math.abs(s));sum+=s*s;}
  console.log(name+' solo: peak='+peak.toFixed(3)+' rms='+Math.sqrt(sum/N).toFixed(3)+' NaN='+nan);
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
    SD:[['sdPitch',110,182,340],['sdDecay',0.04,0.18,0.6],['sdSnappy',0,0.62,1]],
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
