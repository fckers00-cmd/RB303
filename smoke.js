// Boot smoke test: eval the page's <script> with a stub DOM.
// Any load-time exception (the "page dead, no sound" class) fails here.
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
