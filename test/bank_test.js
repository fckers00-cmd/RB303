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
    'readBank,writeBank,renderSlots,tapSlot,state,BANK_KEY,SLOT_COUNT,KNOBDEF,'+
    'setCtl:(c)=>{ctl=c;}, setStarted:(b)=>{started=b;}, setBooted:(b)=>{booted=b;},'+
    'undoPending:()=>!!bankUndo, getSlotSel:()=>slotSel, getBank:()=>bank,'+
    'saveToSlot:(name)=>{ bank[slotSel]={n:name,seq:seqSnapshot(),snd:bankSnd(sndSnapshot())};'+
    ' writeBank(); }})');
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

// 8) loading a patch must reach the engine WHOLE, not just the visible track.
//    buildKnobs only pushes the dials it drew — one track's worth, and never the
//    FX panel. Left at that, loading a bank slot while sitting on a drum track
//    kept the 303 on the previous patch's filter: the grid filled in, the sound
//    did not change. Silent to look at, obvious to hear.
{
  for(const track of ['303','BD','CH','SD','CP']){
    const {api}=boot(memStore());
    api.setBooted(true);
    api.state.track=track;
    /* a patch that differs from the defaults in every knob the engine has */
    const patch={};
    for(const k in api.KNOBDEF){
      const c=api.KNOBDEF[k];
      let v=c.min+(c.max-c.min)*0.73;
      if(c.quant) v=Math.round(v/c.quant)*c.quant;
      patch[k]=v;
    }
    const got={};
    api.setCtl({ setParam:(k,v)=>{got[k]=v;}, setPattern(){}, setDrums(){} });
    api.setStarted(true);
    api.applySnd({ k:patch });
    const missing=Object.keys(api.KNOBDEF).filter(k=>!(k in got));
    ok('patch reaches engine whole (track '+track+')', missing.length===0,
       'ไม่ถูกส่ง: '+missing.join(','));
  }
}

// 9) auditioning the bank must not trip the undo gesture.
//    Undo is a second tap on the SAME slot. A tap on a different slot is a new
//    choice: it loads that slot. The old "second tap anywhere = undo" made every
//    quick second pick roll back the first one instead of loading.
{
  /* two slots whose patterns cannot be confused for each other */
  const mkSlot=(name,note)=>{
    const {api}=boot(memStore());
    api.setBooted(true);
    api.state.pattern=api.state.pattern.map(()=>({note,t:1,accent:0,slide:0}));
    return {n:name,seq:api.seqSnapshot(),snd:api.sndSnapshot()};
  };
  const A=mkSlot('A',40), B=mkSlot('B',52);
  const raw=JSON.stringify([A,B,null,null,null,null,null,null]);

  const firstNote=api=>api.state.pattern[0].note;

  { const st=memStore(); st.setItem('rb303.bank.v1',raw);
    const {api}=boot(st); api.setBooted(true); api.readBank();
    api.tapSlot(0);
    ok('tap slot A loads A', firstNote(api)===40, 'ได้ note '+firstNote(api));
    api.tapSlot(1);
    ok('tap slot B right after A loads B (ไม่ใช่ undo)',
       firstNote(api)===52, 'ได้ note '+firstNote(api)+' — undo เด้งแทนที่จะโหลด');
    ok('slot B is the selected slot', api.getSlotSel()===1, 'sel='+api.getSlotSel()); }

  { const st=memStore(); st.setItem('rb303.bank.v1',raw);
    const {api}=boot(st); api.setBooted(true); api.readBank();
    const before=firstNote(api);
    api.tapSlot(0);
    api.tapSlot(0);
    ok('tap the same slot twice still undoes', firstNote(api)===before,
       'ได้ note '+firstNote(api)+' ควรได้ '+before);
    ok('undo is spent after it runs', api.undoPending()===false); }
}

// 10) a slot must never move the mixer.
//     The mixer is the instrument's, not the pattern's. A slot saved while the
//     faders were down used to pull all seven to zero on load — the whole box
//     went quiet and no pattern loaded afterwards brought it back, because the
//     mixer is global. Old slots already carry those zeros, so reading has to
//     drop them too, not just saving.
{
  const pat=new Array(16).fill(0).map((_,i)=>[40+i%7,1,0,0]);
  const seq={ s:pat, d:{BD:'1000100010001000',SD:'0'.repeat(16),CH:'0'.repeat(16),
                        OH:'0'.repeat(16),CP:'0'.repeat(16)}, l:16 };
  const silent={ w:0, t:130, k:{cutoff:2500},
                 m:{v303:0,vBD:0,vSD:0,vCH:0,vOH:0,vCP:0,vMas:0} };

  { /* a slot stored by an older build, zeros and all */
    const st=memStore();
    st.setItem('rb303.bank.v1',JSON.stringify([{n:'quiet',seq,snd:silent}]));
    const {api}=boot(st); api.setBooted(true); api.readBank();
    const mixBefore=JSON.stringify(api.state.mix);
    api.tapSlot(0);
    ok('loading an old slot leaves the mixer alone',
       JSON.stringify(api.state.mix)===mixBefore, 'mixer กลายเป็น '+JSON.stringify(api.state.mix));
    ok('the pattern still loads', api.state.pattern.filter(x=>x.t===1).length===16);
    ok('stored mixer is dropped on read', !('m' in (api.getBank()[0].snd||{}))); }

  { /* and a slot saved now must not carry the mixer either */
    const {api}=boot(memStore()); api.setBooted(true);
    api.state.mix.vMas=0;
    api.saveToSlot('now');
    ok('saving a slot does not store the mixer', !('m' in (api.getBank()[0].snd||{}))); }

  { /* Copy Link is the opposite call: a shared track keeps its balance */
    const {api}=boot(memStore());
    ok('the URL snapshot still carries the mixer', 'm' in api.snapshot()); }
}

console.log(fails? '\n'+fails+' รายการไม่ผ่าน' : '\nbank: ผ่านทั้งหมด');
process.exit(fails?1:0);
