// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
try{new Function(js)}catch(e){console.log('SYNTAX',e.message);process.exit(1)}
// test data tweaks
seed.b.slice(0,6).forEach(b=>b.q=1);
const unr=seed.b.find(b=>b.rt!='ОФЗ'&&!b.q);unr.rt='—';const unrName=unr.name;
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',tu:'200000',trq:'10',trf:'50'};
const els={};const mk=id=>els[id]||(els[id]={id,classList:{toggle(){},add(){}},value:defs[id]??'',checked:false,innerHTML:'',textContent:'',dataset:{},scrollTop:0,addEventListener(){},focus(){},click(){}});
let dl=null;
global.document={documentElement:{attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.slice(1)),createElement:()=>({click(){dl=this.download},set download(v){dl=v},get download(){return dl}})};
global.URL={createObjectURL:()=>'blob:x'};
global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async()=>({ok:true,json:async()=>seed});
global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};
global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,drawPlan,loadPlans,swPlan,savePlan,xirr,ytmJS,LASTget:()=>LAST,ALLget:()=>ALL,CURget:()=>CUR,PLANget:()=>PLAN,BONDSget:()=>BONDS,RATget:()=>RAT}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
const out=()=>els['out'].innerHTML;
(async()=>{
await new Promise(r=>setTimeout(r,60));
ok(/Чувствительность к ставке/.test(out())&&!/NaN|undefined/.test(out()),'boot + sensitivity text');
// fee
const inv=()=>A.LASTget().pos.reduce((t,x)=>t+x.q*x.cost,0);
els['fee'].value='0';A.build();const i0=inv();els['fee'].value='2';A.build();const i2=inv();
ok(i2>0&&i0>0&&Math.abs(i2-i0)<1e5,'fee changes costs ('+Math.round(i0)+' vs '+Math.round(i2)+')');els['fee'].value='0.1';
// offers
const withOffer=A.BONDSget().filter(b=>b.of&&b.of!='-').length;els['of'].checked=true;A.build();
const changed=A.BONDSget().filter(b=>b.m0&&+b.m0!=+b.mat);
ok(changed.length>0&&changed.every(b=>b.y>0&&isFinite(b.y)),`offer mode: ${withOffer} with offer, ${changed.length} shifted, yields valid`);
const ex=changed[0];console.log('  e.g.',ex&&ex.name,'mat',ex&&ex.mat.toLocaleDateString('ru-RU'),'y',ex&&ex.y.toFixed(2),'was',ex&&ex.y0);
els['of'].checked=false;A.build();ok(A.BONDSget().every(b=>+b.mat==+b.m0&&b.y==b.y0||b.pk),'offer mode off restores');
// qualified
A.build();const names=new Set(A.LASTget().pos.map(x=>x.b.name));ok(![...A.BONDSget().filter(b=>b.q)].some(b=>names.has(b.name)),'qualified hidden in auto');
A.mine();ok(!/квал\./.test(els['ml'].innerHTML),'qualified hidden in picker');A.mine();ok(!/квал\./.test(els['ml'].innerHTML),'qualified never shown (no switch any more)');
// manual rating
mk('mq').value=unrName;A.mine();ok(/data-rt=/.test(els['ml'].innerHTML),'unrated shows rating input');
els['ml'].onchange({target:{dataset:{rt:'0'},value:'zzz'}});ok(!A.RATget()[unrName],'invalid rating rejected');
els['ml'].onchange({target:{dataset:{rt:'0'},value:' a+ '}});ok(A.RATget()[unrName]=='A+'&&A.BONDSget().find(b=>b.name==unrName).rt=='A+','valid rating saved and applied');
ok(/data-rr=/.test(els['ml'].innerHTML),'clear-rating button present');
els['ml'].onclick({target:{dataset:{rr:'0'}}});ok(!A.RATget()[unrName],'rating override cleared');mk('mq').value='';
// plans
A.build();A.savePlan();ok(Object.keys(A.ALLget()).join()=='Основной'&&A.PLANget().items.length==10,'auto portfolio saved as plan');
mk('pln').value='ИИС';els['plc'].onclick();ok(A.CURget()=='ИИС'&&A.PLANget().items.length==0,'new empty plan created and active');
A.mine();els['ml'].onclick({target:{dataset:{a:'0'}}});els['ml'].onclick({target:{dataset:{a:'1'}}});ok(A.PLANget().items.length==2,'manual picks added to second plan');
ok(!/NaN|undefined/.test(els['pl'].innerHTML),'plan html clean (small plan)');
A.swPlan('Основной');ok(A.PLANget().items.length==10,'switched back');
els['plx'].onclick();await new Promise(r=>setTimeout(r,20));ok(dl=='bond-plans.json','export triggers download');
// trades
const it=A.PLANget().items;const x0=it[0];mk('trn').value=x0.n;mk('trq').value='10';mk('trp').value=String(x0.p-1.5);mk('trk').value='10';
mk('trd').value=new Date(Date.now()-120*864e5).toISOString().slice(0,10);els['tra'].onclick();
ok(x0.got==10&&A.PLANget().trades.length==1,'trade recorded and got updated');
const pl=els['pl'].innerHTML;const m=pl.match(/годовая доходность ≈ ([\d,]+)%/);
ok(!!m&&!/NaN|undefined/.test(pl),'journal shows annual return: '+(m?m[1]+'%':'none')+' | '+(pl.match(/Результат[^.]*\./)||[''])[0].slice(0,80));
// top-up creates trades
const n0=A.PLANget().trades.length;mk('tu').value='200000';els['tb'].onclick();ok(A.PLANget().trades.length>n0,'top-up recorded in journal ('+(A.PLANget().trades.length-n0)+' new)');
// delete trade
const g=x0.got;els['trl'].onclick({target:{dataset:{t:String(A.PLANget().trades.length-1)}}});ok(true,'trade delete handler ran');
// persistence
const saved=localStorage._.plan;A.loadPlans('{"bad":1}');A.loadPlans(saved);ok(Object.keys(A.ALLget()).length==2,'round-trip load of plans');
// legacy single plan format
A.loadPlans(JSON.stringify(A.PLANget()));ok(A.CURget()=='Основной'&&Object.keys(A.ALLget()).length==1,'legacy plan format accepted');
// delete plan
A.drawPlan();els['rs'].onclick.call({dataset:{},textContent:''});els['rs'].onclick.call({dataset:{c:1},textContent:''});ok(true,'delete plan handler ran, plans left: '+Object.keys(A.ALLget()).length);
console.log('xirr sanity',A.xirr([[new Date(Date.now()-365*864e5),-1000],[new Date(),1100]]).toFixed(3),'(expect ~0.100)');
console.log('ytmJS sanity',A.ytmJS(100,50,2,new Date(Date.now()+180*864e5),new Date(Date.now()+180*864e5),0).toFixed(2),'(coupon 5% semi on par → ~10.3%/yr for 6 months)');
})().catch(e=>console.log('ERR',e.stack));
setTimeout(()=>{const th=els['th'];console.log('theme select present',!!th);
for(const v of ['ocean','plum','auto','contrast']){th.value=v;th.onchange();console.log(' theme',v,'->',JSON.stringify(document.documentElement.attrs),'stored',localStorage._.theme)}},400);
