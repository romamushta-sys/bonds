// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
// fake GitHub gist server
const srv={gists:{},calls:[],online:true};
global.fetch=async(u,o={})=>{u=String(u);if(!u.includes('api.github.com'))return u.includes('history')?{ok:false}:{ok:true,json:async()=>seed};
if(!srv.online)throw new TypeError('network');const auth=(o.headers||{}).Authorization;srv.calls.push([o.method||'GET',u.replace('https://api.github.com','')]);
if(auth!='Bearer goodtoken')return{ok:false,status:401};const path=u.replace('https://api.github.com','');
if(path.startsWith('/gists?')&&(o.method||'GET')=='GET')return{ok:true,json:async()=>Object.entries(srv.gists).map(([id,g])=>({id,description:g.description,files:Object.fromEntries(Object.keys(g.files).map(k=>[k,{}]))}))};
if(path=='/gists'&&o.method=='POST'){const b=JSON.parse(o.body),id='a1b2c3d4e5f6a7b8c9d'+(Object.keys(srv.gists).length+1);srv.gists[id]={description:b.description,public:b.public,files:b.files};return{ok:true,json:async()=>({id})}}
const m=path.match(/^\/gists\/(\w+)$/);if(m&&o.method=='PATCH'&&srv.gists[m[1]]){const b=JSON.parse(o.body);Object.assign(srv.gists[m[1]].files,b.files);return{ok:true,json:async()=>({id:m[1]})}}
if(m&&!srv.gists[m[1]])return{ok:false,status:404};if(m&&(o.method||'GET')=='GET'){const g=srv.gists[m[1]];return{ok:true,json:async()=>({id:m[1],files:Object.fromEntries(Object.entries(g.files).map(([k,v])=>[k,{content:v.content}]))})}}
return{ok:false,status:404}};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
function device(name,pre){const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
const d={name,els,mk,ls:{_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}},doc:null};
if(pre)Object.assign(d.ls._,pre);d.doc={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
use(d);d.app=new Function('els','mk',js+`;return {build,drawPlan,savePlan,store,syncNow,mergeSnap,snap,decSnap,applySnap,SYget:()=>SY,PLANget:()=>PLAN,ALLget:()=>ALL,CURget:()=>CUR,SRCHget:()=>SRCH,DELget:()=>DEL,BONDSget:()=>BONDS,loadPlans}`)(els,mk);return d}
function use(d){global.document=d.doc;global.localStorage=d.ls}
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const A=device('laptop');use(A);await wait(60);A.app.SYget().delay=20;A.app.build();A.app.savePlan();
// 1. enable sync on laptop
A.mk('ght').value='goodtoken';A.mk('ghp').value='секретная фраза';A.els['ghu'].onclick();await wait(1500);
const ids=Object.keys(srv.gists);ok(ids.length==1&&srv.gists[ids[0]].public===false&&srv.gists[ids[0]].files['bond-plans.enc.json'],'encrypted gist created (non-public)');
const content=srv.gists[ids[0]].files['bond-plans.enc.json'].content;ok(!/ОФЗ|items|Основной/.test(content)&&/"salt"/.test(content),'gist content is ciphertext, no plan names or bond names ('+content.length+' bytes)');
console.log('  status:',A.els['sym']&&A.els['sym'].textContent);
// 2. phone, fresh device, same token/phrase
const B=device('phone');use(B);await wait(60);B.app.SYget().delay=20;B.mk('ght').value='goodtoken';B.mk('ghp').value='секретная фраза';B.els['ghu'].onclick();await wait(1500);
ok(B.app.PLANget()&&B.app.PLANget().items.length==10&&B.app.CURget()=='Основной','phone received the plan without any gist id');
// 3. change on phone, debounced auto-push, laptop pulls
B.app.PLANget().items[0].got=7;B.app.store();await wait(1500);use(A);await A.app.syncNow();
ok(A.app.PLANget().items[0].got==7,'change made on phone appears on laptop after sync');
// 4. offline edit on both devices, different plans, then merge
use(A);A.app.PLANget().items[1].got=3;A.app.store();await wait(1500);use(B);await B.app.syncNow();
use(B);srv.online=false;B.els['pln']=B.els['pln']||B.mk('pln');B.mk('pln').value='ИИС';B.els['plc'].onclick();await wait(100);B.app.PLANget().trades=[];B.app.store();await wait(200);srv.online=true;
use(A);A.app.PLANget().items[2].got=5;A.app.store();await wait(1500);
use(B);await B.app.syncNow();use(A);await A.app.syncNow();
ok(Object.keys(A.app.ALLget()).sort().join()==Object.keys(B.app.ALLget()).sort().join()&&Object.keys(A.app.ALLget()).includes('ИИС')&&Object.keys(A.app.ALLget()).includes('Основной'),'two plans edited on different devices are merged: '+Object.keys(A.app.ALLget()).join(', '));
const pa=A.app.ALLget()['Основной'].items,pb=B.app.ALLget()['Основной'].items;ok(pa[1].got==3&&pa[2].got==5&&pb[1].got==3&&pb[2].got==5,'edits from both devices kept in the shared plan');
// 5. delete plan on phone propagates
use(B);B.app.swPlan&&0;B.app.applySnap({...B.app.snap(),cur:'ИИС'});B.els['rs'].onclick&&0;
// emulate delete via the same code path as the button: tombstone + delete
const sn=B.app.snap();delete sn.all['ИИС'];sn.del={...sn.del,'ИИС':Date.now()};B.app.applySnap(sn);B.app.store();await wait(1500);use(A);await A.app.syncNow();
ok(!Object.keys(A.app.ALLget()).includes('ИИС')&&Object.keys(A.app.ALLget()).includes('Основной'),'deleted plan disappears on the other device (tombstone), not resurrected');
// 6. wrong phrase
const C=device('tablet');use(C);await wait(60);C.mk('ght').value='goodtoken';C.mk('ghp').value='другая фраза';C.els['ghu'].onclick();await wait(1500);
ok(/Неверная кодовая фраза/.test(C.els['sym'].textContent)&&!C.app.PLANget(),'wrong passphrase: sync stops, local data untouched');
// 7. bad token
const E=device('x');use(E);await wait(60);E.mk('ght').value='badtoken';E.mk('ghp').value='x';E.els['ghu'].onclick();await wait(800);ok(/токен не принят/.test(E.els['sym'].textContent),'bad token message');
// 8. offline message and no crash
use(A);srv.online=false;await A.app.syncNow(true);ok(/нет связи/.test(A.els['sym'].textContent),'offline handled');srv.online=true;
// 9. merge unit: newer plan wins, same-time conflict deterministic
const m=A.app.mergeSnap({all:{P:{upd:5,v:'a'}},ts:5,cur:'P'},{all:{P:{upd:9,v:'b'}},ts:9,cur:'P'});ok(m.all.P.v=='b'&&m.ts==9,'merge keeps the newer plan version');
// 10. idempotent: repeated sync does not upload again
use(A);const before=srv.calls.filter(c=>c[0]=='PATCH').length;await A.app.syncNow();await A.app.syncNow();ok(srv.calls.filter(c=>c[0]=='PATCH').length==before,'no redundant uploads when nothing changed');
})().catch(e=>console.log('ERR',e.stack));
process.on('unhandledRejection',e=>console.log('UNHANDLED',e&&e.stack||e));
setTimeout(async()=>{
 // restart: page opened again on laptop with sync already enabled and local data present
 const A2=device('laptop-reopen',{gh:JSON.stringify({t:'goodtoken',p:'секретная фраза',auto:true})});use(A2);
 const old=A2.ls._.plan;await wait(1200);
 const P=A2.app.PLANget();ok(!!P&&P.items.length==10,'reopened page with sync enabled: plan pulled from the gist at startup, no errors');
 console.log('  status after reopen:',A2.els['sym']&&A2.els['sym'].textContent);
},9000);

setTimeout(async()=>{
 // stale non-hex id left from the old manual version, and a hex id of a deleted gist
 for(const [label,id] of [['stale text id','Roman'],['deleted gist id','deadbeefdeadbeefdead1']]){
  const X=device('stale-'+label,{gh:JSON.stringify({t:'goodtoken',p:'секретная фраза',auto:true,id})});use(X);await wait(1500);
  ok(!!X.app.PLANget()&&/синхронизировано/.test(X.els['sym'].textContent),'recovers from '+label+' ('+id+'): '+X.els['sym'].textContent);
  const g=JSON.parse(X.ls._.gh);ok(/^[0-9a-f]{20,40}$/.test(g.id)&&g.id!=id,'valid gist id stored after recovery: '+g.id);
 }
},11000);
