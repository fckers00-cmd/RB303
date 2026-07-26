// UI structure test: the app-shell refactor moved every panel. Nothing here
// touches audio — it checks the DOM contract the wiring depends on.
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
const h=fs.readFileSync(APP,'utf8');
const js=h.match(/<script>([^]*)<\/script>/)[1];
let fails=0;
const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c?'':'  '+(x||''))); if(!c)fails++;};

// 1. every ID the script reaches for must exist exactly once
{
  const ids=[...new Set([...js.matchAll(/getElementById\(['"`](\w+)['"`]\)/g)].map(m=>m[1]))];
  const bad=[];
  for(const id of ids){
    const n=(h.match(new RegExp('id="'+id+'"','g'))||[]).length;
    if(n!==1) bad.push(id+' x'+n);
  }
  ok('every referenced id exists once ('+ids.length+' ids)', bad.length===0, bad.join(', '));
}
// 2. the deck must contain the controls that have to stay visible
{
  const deck=h.slice(h.indexOf('<div class="deck">'), h.indexOf('<div class="page"'));
  const need=['id="play"','id="tracks"','id="pmrow"','id="stepsA"','id="stepsB"','id="tempo"'];
  const missing=need.filter(x=>!deck.includes(x));
  ok('pinned deck holds transport/tracks/grid', missing.length===0, 'missing '+missing.join(', '));
}
// 3. exactly five pages, each matching a tab, exactly one visible at boot
{
  const pgs=[...h.matchAll(/<div class="pg[^"]*" data-p="(\w+)"/g)].map(m=>m[1]);
  const tabs=[...h.matchAll(/<button data-p="(\w+)"/g)].map(m=>m[1]);
  const onCount=(h.match(/<div class="pg on"/g)||[]).length;
  ok('pages and tabs line up', pgs.length===5 && tabs.length===5 &&
     pgs.every(p=>tabs.includes(p)), 'pages='+pgs+' tabs='+tabs);
  ok('exactly one page visible at boot', onCount===1, 'count='+onCount);
}
// 4. panels must not have been dropped in the move
{
  const need=['id="knobs"','id="fxknobs"','id="scope"','id="mixer"','id="slots"','id="keys"','id="kbwrap"'];
  const missing=need.filter(x=>!h.includes(x));
  ok('no panel lost in the restructure', missing.length===0, 'missing '+missing.join(', '));
}
// 5. the scope lives in the deck now, so it is always visible and always sized —
// no page-reveal resize needed, and no hidden-canvas sizing bug possible
{
  const deck=h.slice(h.indexOf('<div class="deck">'), h.indexOf('<!-- ===== PAGES'));
  ok('scope strip is in the deck', deck.includes('id="scope"'));
}
// 6. the deck must stay lean — diagnostics and share buttons belong on pages
{
  const deck=h.slice(h.indexOf('<div class="deck">'), h.indexOf('<!-- ===== PAGES'));
  const strays=['id="status"','id="copyLink"','id="clrPat"','id="resetPat"'].filter(x=>deck.includes(x));
  ok('deck holds no page-level clutter', strays.length===0, 'found '+strays.join(', '));
}

console.log(fails? '\n'+fails+' รายการไม่ผ่าน' : '\nui: ผ่านทั้งหมด');
process.exit(fails?1:0);
