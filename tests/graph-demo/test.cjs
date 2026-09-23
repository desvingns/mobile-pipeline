const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),graph=path.join(root,'graph');
const html=fs.readFileSync(path.join(graph,'index.html'),'utf8');
const ctx={window:{MP_GRAPHS:[],MP_GRAPH_REGISTER(g){this.MP_GRAPHS.push(g);}}};
for(const f of ['overview','mp-spec','mp-dev'])vm.runInNewContext(fs.readFileSync(path.join(graph,'data',f+'.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(graph,'story/scenario.js'),'utf8'),ctx);
const story=ctx.window.MP_STORY;
assert.equal(story.stages.length,8);
for(const s of story.stages){
  assert(s.narration && s.coordinator && s.outcome);
  for(const p of s.participants){
    const g=ctx.window.MP_GRAPHS.find(g=>g.id===p.ref[0]);assert(g,'graph '+p.ref);
    const f=g.flows.find(f=>f.id===p.ref[1]);assert(f,'flow '+p.ref);
    assert(g.nodes.some(n=>n.id===p.ref[2]),'node '+p.ref);
    assert(f.nodes.includes(p.ref[2]),'node not in selected flow: '+p.ref);
    for(const key of ['when','input','action','output','example'])assert(p[key],s.id+'/'+p.id+'/'+key);
  }
}
assert.equal(story.stages.filter(s=>s.parallel).length,1);
assert.equal(story.stages[1].participants.length,3);
assert(story.stages[1].participants.every(p=>p.ref[2]==='grounding-scout'));

function open(hash='',options={}){
  const dom=new JSDOM(html,{url:(options.file?'file:///demo/graph/index.html':'https://demo.test/graph/index.html')+hash,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;let queue=[],clock=0;
  w.matchMedia=()=>({matches:!!options.reduced});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLMediaElement.prototype.pause=function(){};
  w.HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
  w.setTimeout=(fn,ms)=>{const t={fn,time:clock+ms};queue.push(t);return t;};
  w.clearTimeout=t=>{queue=queue.filter(v=>v!==t);};
  for(const f of ['story/scenario.js','story/timing.js','assets/demo.js'])w.eval(fs.readFileSync(path.join(graph,f),'utf8'));
  return {w,doc:w.document,click(sel){const n=w.document.querySelector(sel);assert(n,'missing '+sel);n.click();},advance(ms){const end=clock+ms;while(queue.some(v=>v.time<=end)){queue.sort((a,b)=>a.time-b.time);const next=queue.shift();clock=next.time;next.fn();}clock=end;},close(){dom.window.close();}};
}
let t=open('#overview/all');assert(!t.doc.getElementById('story-view').hidden);assert(t.doc.querySelector('[data-mode=simple][aria-pressed=true]'));
t.click('[data-stage="1"]');assert.equal(t.doc.querySelectorAll('.node-card').length,3);assert(t.doc.querySelector('.node-flow.parallel'));
t.click('#simulate');t.advance(1500);assert.equal(t.doc.querySelectorAll('[data-state=done]').length,1);assert.match(t.doc.getElementById('join-note').textContent,/ждёт/);
t.advance(1500);assert.equal(t.doc.querySelectorAll('[data-state=done]').length,2);assert.match(t.doc.getElementById('join-note').textContent,/ждёт/);
t.advance(1500);assert.equal(t.doc.querySelectorAll('[data-state=done]').length,3);assert.match(t.doc.getElementById('join-note').textContent,/может продолжить/);
t.click('[data-mode=guided]');assert.equal(t.w.location.hash,'#guided/research');assert(!t.doc.getElementById('technical-context').hidden);
t.click('[data-role="0"]');assert(t.doc.getElementById('role-dialog').open);assert.match(t.doc.getElementById('role-body').textContent,/Когда подключается/);
t.click('#role-source');assert(!t.doc.getElementById('role-dialog').open);assert.match(t.doc.getElementById('expert-frame').getAttribute('src'),/mp-spec\/feature\/grounding-scout/);
t.click('[data-mode=simple]');assert.equal(t.w.location.hash,'#simple/research');
t.click('[data-stage="5"]');t.click('#simulate');t.advance(1);assert.equal(t.doc.querySelectorAll('[data-state=running]').length,1);assert.equal(t.doc.querySelectorAll('[data-state=waiting]').length,2);t.advance(1499);assert.equal(t.doc.querySelectorAll('[data-state=running]').length,1);assert.equal(t.doc.querySelectorAll('[data-state=done]').length,1);
t.click('[data-stage="2"]');t.advance(10000);assert.match(t.doc.getElementById('stage-title').textContent,/Договариваемся/);
t.click('#favorite-button');assert.equal(t.doc.getElementById('favorite-button').getAttribute('aria-pressed'),'false');assert.equal(t.doc.getElementById('favorite-count').textContent,'Пока пусто');
t.click('[data-mode=presentation]');assert.equal(t.w.location.hash,'#presentation/agreement');assert.equal(t.doc.querySelectorAll('[data-video-chapter]').length,8);t.click('[data-video-chapter="6"]');assert.equal(t.w.location.hash,'#presentation/repair');t.click('[data-mode=simple]');assert.equal(t.w.location.hash,'#simple/repair');t.close();
t=open('#mp-dev/feature/mp-tester-android');assert(!t.doc.getElementById('details-view').hidden);assert.match(t.w.document.getElementById('expert-frame').getAttribute('src'),/mp-tester-android/);t.close();
t=open('#nonsense/missing');assert(!t.doc.getElementById('story-view').hidden);t.close();
t=open('#guided/result');assert.match(t.doc.getElementById('stage-title').textContent,/человек/);t.click('#next');assert.equal(t.w.location.hash,'#guided/idea');t.close();
t=open('#simple/research',{file:true,reduced:true});t.click('#simulate');t.advance(0);assert.equal(t.doc.querySelectorAll('[data-state=done]').length,3);t.w.document.body.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(t.w.location.hash,'#simple/agreement');t.click('.skip-link');assert.equal(t.w.location.hash,'#simple/agreement');assert.equal(t.doc.activeElement.id,'main-content');t.click('[data-journey="2"]');assert.equal(t.w.location.hash,'#simple/checks');assert.equal(t.doc.querySelector('[data-journey][aria-current=step]').textContent.includes('Проверяем результат'),true);t.close();
// Exercise the retained expert map as a real DOM application (no layout engine).
const expert=new JSDOM(fs.readFileSync(path.join(graph,'expert.html'),'utf8'),{url:'file:///demo/graph/expert.html#mp-dev/feature/mp-tester-android',runScripts:'outside-only',pretendToBeVisual:true});
const ew=expert.window,ed=ew.document;
ew.MP_GRAPHS=ctx.window.MP_GRAPHS;
ew.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:1200,height:700,right:1200,bottom:700};};
ew.eval(fs.readFileSync(path.join(graph,'assets/app.js'),'utf8'));
ed.dispatchEvent(new ew.Event('DOMContentLoaded'));
assert(ed.querySelector('.node.selected'));assert.match(ed.getElementById('panelTech').textContent,/tester-android/);
const before=ed.getElementById('zoomVal').textContent;ed.getElementById('zoomIn').click();assert.notEqual(ed.getElementById('zoomVal').textContent,before);ed.getElementById('zoomOut').click();assert.equal(ed.getElementById('zoomVal').textContent,before);
ed.body.dispatchEvent(new ew.KeyboardEvent('keydown',{key:'/',bubbles:true}));assert.equal(ed.activeElement.id,'search');const search=ed.getElementById('search');search.value='mp-developer-android';search.dispatchEvent(new ew.Event('input'));assert(ed.querySelector('.node.dimmed'));search.dispatchEvent(new ew.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.match(ew.location.hash,/mp-developer-android/);search.dispatchEvent(new ew.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(search.value,'');ed.getElementById('fitBtn').click();assert(!ed.getElementById('world').style.transform.includes('NaN'));expert.window.close();
for(const rel of ['assets/onest-cyrillic.woff2','assets/onest-latin.woff2'])assert(fs.existsSync(path.join(root,'videos/mobile-pipeline',rel)));
assert(!/https?:\/\//.test(html),'runtime must use local resources');
console.log('PASS: story refs, parallel join, sequential execution, cancellation, 4 modes, legacy links, dialogs, phone, chapters, file URLs, reduced motion, keyboard, expert search/zoom and local assets.');
