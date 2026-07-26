// Boot smoke test: eval the page's <script> with a stub DOM.
// Any load-time exception (the "page dead, no sound" class) fails here.
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
const sm=html.match(/<script>([^]*)<\/script>/);
const cnv={fillStyle:'',strokeStyle:'',lineWidth:1,font:'',
  fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},closePath(){},fillText(){}};
function mkEl(){ return {className:'',innerHTML:'',textContent:'',value:'130',style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){}},
  appendChild(){},addEventListener(){},setPointerCapture(){},
  getBoundingClientRect(){return{width:400,height:150};},
  querySelector(){return mkEl();},querySelectorAll(){return[];},
  getContext(){return cnv;},onclick:null,oninput:null}; }
global.document={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[]};
global.window=global;
global.addEventListener=()=>{};
global.devicePixelRatio=1;
global.requestAnimationFrame=()=>0;
global.location={hash:'',href:'http://local/'};
global.history={replaceState(){}};
global.navigator={};
try{ eval(sm[1]); console.log('BOOT OK'); }
catch(e){ console.log('BOOT FAIL -> '+e.constructor.name+': '+e.message); process.exit(1); }
