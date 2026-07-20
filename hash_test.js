// Boot with a v1 hash (no drums) and a v2 hash (with drums) — must not throw,
// and drum state must decode as expected.
const fs=require('fs');
const path=require('path');
const APP=path.join(__dirname,'..','rb303.html');
const html=fs.readFileSync(APP,'utf8');
const sm=html.match(/<script>([^]*)<\/script>/);
const cnv={fillStyle:'',strokeStyle:'',lineWidth:1,font:'',
  fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},closePath(){},fillText(){}};
function mkEl(){ return {className:'',innerHTML:'',textContent:'',value:'130',style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){}},
  appendChild(){},addEventListener(){},setPointerCapture(){},
  getBoundingClientRect(){return{width:400,height:150};},
  querySelector(){return mkEl();},querySelectorAll(){return[];},
  getContext(){return cnv;},onclick:null,oninput:null}; }
function run(hash,label,check){
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0; global.location={hash,href:'http://local/'};
  global.history={replaceState(){}}; global.navigator={};
  try{ eval(sm[1]); const r=check?check():''; console.log(label+': BOOT OK '+r); }
  catch(e){ console.log(label+': FAIL -> '+e.message); process.exit(1); }
}
// v1: old link, tempo 140, no drums field
const v1='#p='+Buffer.from(JSON.stringify({v:1,t:140,w:1,k:{cutoff:900},
  s:new Array(16).fill(0).map(()=>[36,1,0,0])})).toString('base64');
run(v1,'v1 link',null);
// consts inside eval aren't reachable from here; verify via re-encoded hash instead:
{
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0;
  let written='';
  global.location={hash:v1,href:'http://local/'};
  global.history={replaceState:(a,b,h)=>{written=h;}};
  global.navigator={};
  const code=sm[1]+'\n;writeHash();';
  eval(code);
  const d=JSON.parse(Buffer.from(written.slice(3),'base64').toString());
  const drumsAllOff=Object.values(d.d).every(s=>s==='0000000000000000');
  console.log('v1 decode: tempo='+d.t+' v='+d.v+' drums-silent='+drumsAllOff+
    ' -> '+((d.t===140&&d.v===4&&drumsAllOff)?'OK':'FAIL'));
}
// v2: with drums
{
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0;
  let written='';
  const v2='#p='+Buffer.from(JSON.stringify({v:2,t:120,w:0,k:{},
    s:new Array(16).fill(0).map(()=>[36,0,0,0]),
    d:{BD:'1000100010001000',SD:'0000200000002000',CH:'0010001000100010',
       OH:'0000000000000000',CP:'0000000000000001'}})).toString('base64');
  global.location={hash:v2,href:'http://local/'};
  global.history={replaceState:(a,b,h)=>{written=h;}};
  global.navigator={};
  eval(sm[1]+'\n;writeHash();');
  const d=JSON.parse(Buffer.from(written.slice(3),'base64').toString());
  const ok=d.d.BD==='1000100010001000'&&d.d.SD==='0000200000002000'&&d.d.CP==='0000000000000001';
  console.log('v2 drums round-trip: '+(ok?'OK':'FAIL -> '+JSON.stringify(d.d)));
  // v2 link has no mixer field -> must fall back to defaults, not NaN/undefined
  const mok=Object.values(d.m).every(v=>typeof v==='number'&&v>=0&&v<=1);
  console.log('v2 link -> mixer defaults: '+(mok?'OK':'FAIL -> '+JSON.stringify(d.m)));
}

// v3: mixer round-trip
{
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0;
  let written='';
  const mix={v303:0.5,vBD:0.7,vSD:0.3,vCH:0.2,vOH:0.25,vCP:0.35,vMas:1};
  const v3='#p='+Buffer.from(JSON.stringify({v:3,t:130,w:0,k:{},
    s:new Array(16).fill(0).map(()=>[36,0,0,0]),
    d:{BD:'0'.repeat(16),SD:'0'.repeat(16),CH:'0'.repeat(16),OH:'0'.repeat(16),CP:'0'.repeat(16)},
    m:mix})).toString('base64');
  global.location={hash:v3,href:'http://local/'};
  global.history={replaceState:(a,b,h)=>{written=h;}};
  global.navigator={};
  eval(sm[1]+'\n;writeHash();');
  const d=JSON.parse(Buffer.from(written.slice(3),'base64').toString());
  const ok=Object.keys(mix).every(k=>Math.abs(d.m[k]-mix[k])<0.011);  // UI rounds to 1%
  console.log('v3 mixer round-trip: '+(ok?'OK':'FAIL -> '+JSON.stringify(d.m)));
}

// v4: note/tie/rest + pattern length round-trip; and a v1 link (on/off only)
// must upgrade cleanly to note/rest with no ties invented.
{
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0;
  let written='';
  const steps=[[36,1,1,0],[36,2,0,0],[40,1,0,1],[36,0,0,0],[43,2,0,0],[36,1,0,0]]
    .concat(new Array(10).fill([36,0,0,0]));
  const v4='#p='+Buffer.from(JSON.stringify({v:4,t:128,w:0,k:{},l:6,s:steps,
    d:{BD:'0'.repeat(16),SD:'0'.repeat(16),CH:'0'.repeat(16),OH:'0'.repeat(16),CP:'0'.repeat(16)},
    m:{}})).toString('base64');
  global.location={hash:v4,href:'http://local/'};
  global.history={replaceState:(a,b,h)=>{written=h;}};
  global.navigator={};
  eval(sm[1]+'\n;writeHash();');
  const d=JSON.parse(Buffer.from(written.slice(3),'base64').toString());
  const tOK=d.s.slice(0,6).map(a=>a[1]).join('')==='121021';
  const lOK=d.l===6;
  console.log('v4 time+length round-trip: '+((tOK&&lOK)?'OK':'FAIL -> t='+
    d.s.slice(0,6).map(a=>a[1]).join('')+' len='+d.l));
}
{
  // old v1 link: slot 1 was a 0/1 gate. Must become note/rest, never a tie.
  global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
  global.window=global; global.addEventListener=()=>{}; global.devicePixelRatio=1;
  global.requestAnimationFrame=()=>0;
  let written='';
  const s1=[[36,1,0,0],[36,0,0,0],[38,1,1,0],[36,1,0,1]].concat(new Array(12).fill([36,0,0,0]));
  global.location={hash:'#p='+Buffer.from(JSON.stringify({v:1,t:130,w:0,k:{},s:s1})).toString('base64'),
    href:'http://local/'};
  global.history={replaceState:(a,b,h)=>{written=h;}};
  global.navigator={};
  eval(sm[1]+'\n;writeHash();');
  const d=JSON.parse(Buffer.from(written.slice(3),'base64').toString());
  const ts=d.s.map(a=>a[1]);
  console.log('v1 -> note/rest upgrade: '+
    ((ts.slice(0,4).join('')==='1011' && ts.every(t=>t!==2) && d.l===16)?'OK':'FAIL -> '+ts.join('')));
}
