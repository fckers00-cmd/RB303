// Bank / slot serialisation.
// Two things matter here:
//  1. seq and snd stay separable — song mode depends on being able to step
//     through `seq` while `snd` stays put. A regression that fuses them would
//     be silent today and expensive later.
//  2. Import reads a file the user picked. Garbage must never take the app down.
const fs=require('fs');
const path=require('path');
/* Resolve the app regardless of what it is called. The file has been renamed
   before (rb303.html -> index.html for a shorter GitHub Pages URL) and hardcoding
   the name broke every test at once, which is a silly way to lose a test suite. */
const APP=(()=>{
  for(const n of ['index.html','rb303.html','v2.html']){
    const f=path.join(__dirname,'..',n);
    if(fs.existsSync(f)) return f;
  }
  console.error('หาไฟล์แอปไม่เจอ — ต้องมี index.html หรือ rb303.html ที่รากของ repo');
  process.exit(1);
})();
const html=fs.readFileSync(APP,'utf8');
const sm=html.match(/<script>([^]*)<\/script>/)[1];

const cnv={fillStyle:'',strokeStyle:'',lineWidth:1,font:'',
  fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},closePath(){},fillText(){}};
function mkEl(){ return {className:'',innerHTML:'',textContent:'',value:'130',style:{},dataset:{},
  files:null,type:'',accept:'',
  classList:{add(){},remove(){},toggle(){}},
  appendChild(){},removeChild(){},remove(){},addEventListener(){},setPointerCapture(){},click(){},
  getBoundingClientRect(){return{width:400,height:150};},
  querySelector(){return mkEl();},querySelectorAll(){return[];},
  getContext(){return cnv;},onclick:null,oninput:null,onchange:null}; }

function boot(store){
  const els={};
  global.document={ getElementById:(id)=>(els[id]=els[id]||mkEl()),
    createElement:()=>mkEl(), querySelectorAll:()=>[], body:mkEl() };
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0; global.location={hash:'',href:'http://local/'};
  global.history={replaceState(){}}; global.navigator={};
  global.Blob=function(){}; global.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
  global.FileReader=function(){};
  if(store) global.localStorage=store; else delete global.localStorage;
  const api=eval(sm+'\n;({seqSnapshot,sndSnapshot,applySeq,applySnd,snapshot,'+
    'readBank,writeBank,renderSlots,state,BANK_KEY,SLOT_COUNT})');
  return {api,els};
}

function memStore(){
  const m={};
  return { getItem:k=>(k in m?m[k]:null), setItem:(k,v)=>{m[k]=String(v);},
           removeItem:k=>{delete m[k];}, _raw:m };
}
let fails=0;
const ok=(name,cond,extra)=>{ console.log((cond?'OK   ':'FAIL ')+name+(cond?'':'  '+(extra||'')));
  if(!cond) fails++; };

// 1) seq and snd must not leak into each other
{
  const {api}=boot(memStore());
  const q=api.seqSnapshot(), n=api.sndSnapshot();
  const qk=Object.keys(q).sort().join(','), nk=Object.keys(n).sort().join(',');
  ok('seq holds only performance data', qk==='d,l,s', qk);
  ok('snd holds only sound data',       nk==='k,m,t,w', nk);
  ok('seq has no knobs', !('k' in q) && !('m' in q));
  ok('snd has no pattern', !('s' in n) && !('d' in n));
}

// 2) applying snd alone must not disturb the sequence (the song-mode guarantee)
{
  const {api}=boot(memStore());
  api.state.pattern[3].t=2; api.state.pattern[3].note=55;
  api.state.len=9;
  const seqBefore=JSON.stringify(api.seqSnapshot());
  api.applySnd({t:150,w:1,k:{cutoff:2000},m:{vBD:0.1}});
  const seqAfter=JSON.stringify(api.seqSnapshot());
  ok('applySnd leaves seq untouched', seqBefore===seqAfter);
  ok('applySnd did change tempo', api.state.tempo===150, 'tempo='+api.state.tempo);
}

// 3) applying seq alone must not disturb the sound
{
  const {api}=boot(memStore());
  api.applySnd({t:145,w:1,k:{cutoff:1234},m:{vCP:0.9}});
  const sndBefore=JSON.stringify(api.sndSnapshot());
  api.applySeq({ s:new Array(16).fill(0).map((_,i)=>[40+i,(i%3),0,0]),
                 d:{BD:'1'.repeat(16),SD:'0'.repeat(16),CH:'0'.repeat(16),
                    OH:'0'.repeat(16),CP:'0'.repeat(16)}, l:12 }, false);
  ok('applySeq leaves snd untouched', sndBefore===JSON.stringify(api.sndSnapshot()));
  ok('applySeq did change length', api.state.len===12, 'len='+api.state.len);
}

// 4) full slot round-trip through JSON, as the bank stores it
{
  const {api}=boot(memStore());
  api.state.pattern[0]={note:51,t:2,accent:1,slide:1};
  api.state.drums.CP[7].on=1; api.state.drums.CP[7].accent=1;
  api.state.len=13; api.state.tempo=141; api.state.wave=1;
  const slot={n:'Blade',seq:api.seqSnapshot(),snd:api.sndSnapshot()};
  const round=JSON.parse(JSON.stringify(slot));
  api.applySeq({s:new Array(16).fill([36,0,0,0]),d:{},l:16},false);   // wipe
  api.applySnd({t:100,w:0,k:{},m:{}});
  api.applySnd(round.snd); api.applySeq(round.seq,false);
  const p=api.state.pattern[0];
  ok('slot round-trip: step data', p.note===51&&p.t===2&&p.accent===1&&p.slide===1,
     JSON.stringify(p));
  ok('slot round-trip: drum accent', api.state.drums.CP[7].on===1&&api.state.drums.CP[7].accent===1);
  ok('slot round-trip: length', api.state.len===13, 'len='+api.state.len);
  ok('slot round-trip: tempo', api.state.tempo===141, 'tempo='+api.state.tempo);
}

// 5) hostile / corrupt stored bank must not throw on boot
{
  const bad=['not json at all','{}','[]','null','[1,2,3]',
             '[{"n":"x"}]',                                   // slot with no seq
             '[{"n":"x","seq":{"s":"nope","d":null,"l":"abc"}}]',
             '['+'{"n":"'+'z'.repeat(500)+'","seq":{}},'.repeat(20)+'null]'];
  let threw=null;
  for(const raw of bad){
    const st=memStore(); st.setItem('rb303.bank.v1',raw);
    try{ boot(st); }catch(e){ threw=raw.slice(0,30)+' -> '+e.message; break; }
  }
  ok('corrupt bank data does not break boot', threw===null, threw||'');
}

// 6) no localStorage at all (private mode / sandbox) must still boot
{
  let threw=null;
  try{ boot(null); }catch(e){ threw=e.message; }
  ok('boots with localStorage missing', threw===null, threw||'');
}

// 7) applySeq must never invent a tie from a legacy on/off pattern
{
  const {api}=boot(memStore());
  api.applySeq({ s:new Array(16).fill(0).map((_,i)=>[36,i%2?1:0,0,0]), d:{}, l:16 }, true);
  ok('legacy import makes no ties', api.state.pattern.every(x=>x.t!==2));
}

console.log(fails? '\n'+fails+' รายการไม่ผ่าน' : '\nbank: ผ่านทั้งหมด');
process.exit(fails?1:0);
