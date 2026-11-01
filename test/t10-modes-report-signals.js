// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed0=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0',dep:'',mmf:'',inf:''};
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
async function boot(seed,ls){const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{_:new Set(),toggle(){},add(c){this._.add(c)}},addEventListener(){},focus(){},click(){}});
const body={dataset:{}};let printed=0,titleAtPrint=null;global.print=()=>{printed++;titleAtPrint=global.document.title};
global.document={title:'orig',body,documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{...(ls||{})},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,drawPlan,savePlan,printReport,histSig,sellHTML,rebalHTML,setHist:o=>{HIST=o},LASTget:()=>LAST,PLANget:()=>PLAN,BONDSget:()=>BONDS,SIMget:()=>SIMLAST,KEY,yrs,cands}`)(els,mk);await new Promise(r=>setTimeout(r,80));return{A,els,body,printed:()=>printed,titleAtPrint:()=>titleAtPrint}}
(async()=>{
const fresh=JSON.parse(JSON.stringify(seed0));fresh.at=new Date().toISOString();fresh.qual='ok';
let {A,els,body,printed,titleAtPrint}=await boot(fresh,{});
// simple mode
A.build();let o=els['out'].innerHTML;
ok(/class="pn simple"/.test(o)&&/Простыми словами/.test(o)&&!/NaN|undefined/.test(o.slice(o.indexOf('Простыми'),o.indexOf('Простыми')+1500)),'plain-language summary rendered');
const sm=o.slice(o.indexOf('Простыми'),o.indexOf('Простыми')+1200);ok(/плохих 5% случаев/.test(sm)&&/годовых после налога/.test(sm),'summary mentions yield and the bad-scenario floor');
ok((o.match(/class="pn adv"/g)||[]).length>=3,'advanced sections tagged ('+(o.match(/class="pn adv"/g)||[]).length+')');
ok(body.dataset.mode=='full'&&typeof els['smd'].onclick=='function','default mode is full, toggle attached');
els['smd'].onclick();ok(body.dataset.mode=='simple'&&els['smd'].textContent=='Расширенный режим'&&localStorage._.mode=='simple','toggle to simple, label and storage updated');
els['smd'].onclick();ok(body.dataset.mode=='full'&&localStorage._.mode=='full','toggle back');
({A,els,body,printed,titleAtPrint}=await boot(fresh,{mode:'simple'}));ok(body.dataset.mode=='simple','simple mode restored from storage');
// real yield
els['inf'].value='7';A.build();o=els['out'].innerHTML;const real=o.match(/Реальная после налога<\/small><strong>([\-\d,]+)%/),nom=o.match(/После налога, примерно<\/small><strong>([\-\d,]+)%/);
ok(!!real&&!!nom&&+real[1].replace(',','.')<+nom[1].replace(',','.'),'real yield '+(real&&real[1])+'% is below nominal after-tax '+(nom&&nom[1])+'%');
els['dep'].value='13';A.build();ok(/Реальная, за вычетом инфляции/.test(els['out'].innerHTML),'comparison table has a real-yield column');els['inf'].value='';els['dep'].value='';
// report
A.build();A.printReport('auto');let rep=els['rep'].innerHTML;ok(/Отчёт по облигационному портфелю/.test(rep)&&/Состав/.test(rep)&&/Мушта Роман Александрович/.test(rep)&&!/NaN|undefined/.test(rep),'auto report generated');
ok(printed()==1&&titleAtPrint()!='orig'&&global.document.title=='orig','print called once, title set during print and restored');
A.savePlan();A.PLANget().items[0].got=2;A.printReport('plan');rep=els['rep'].innerHTML;ok(/План «Основной»/.test(rep)&&/Ожидаемые выплаты по месяцам/.test(rep)&&!/NaN|undefined/.test(rep),'plan report generated');
// history signals
const it=A.PLANget().items;it.forEach(x=>x.got=3);const names=it.map(x=>x.n);
const d=['1','2','3','4','5','6','7'].map(n=>'2026-10-0'+n),mkH=(drop)=>{const H={d,p:{},y:{}};A.BONDSget().forEach(b=>{H.p[b.name]=[90,90,90,90,90,90,90]});H.p[names[0]]=[90,90,90,90,90,90,90-drop];return H};
A.setHist(mkH(4));let s=A.histSig(names[0]);ok(s&&Math.abs(s.d+4)<1e-9&&Math.abs(s.rel+4)<1e-9,'signal: bond fell 4 points, market median 0 -> relative -4');
A.drawPlan();ok(/упала на 4,0 п\.п\./.test(els['pl'].innerHTML),'rebalancing shows the stress warning');
A.setHist(mkH(1));A.drawPlan();ok(!/упала на/.test(els['pl'].innerHTML.replace(/цена упала на [\d,]+ п\.п\. к цене в плане/g,'')),'small drop is not flagged');
const Hm=mkH(0);Object.keys(Hm.p).forEach(k=>Hm.p[k]=Hm.p[k].map((v,i)=>i==6?v-4:v));A.setHist(Hm);ok(Math.abs(A.histSig(names[0]).rel)<1e-9,'market-wide drop gives relative 0 (no false alarm)');A.setHist(null);
// sell hints
A.drawPlan();ok(/Подсказки по продаже и замене/.test(els['pl'].innerHTML)&&!/NaN|undefined/.test(els['pl'].innerHTML),'sell hints block rendered');
const low=A.BONDSget().filter(b=>/^AA/.test(b.rt)&&!b.pk&&A.yrs(b)>1.2&&A.yrs(b)<4).sort((a,b)=>A.KEY(a)-A.KEY(b))[0];
const P=A.PLANget();P.items=[{n:low.name,mat:low.mat.toISOString().slice(0,10),nx:low.nx.toISOString().slice(0,10),p:low.p,y:low.y,c:low.c,f:low.f,nkd:low.nkd,rt:low.rt,pk:0,q:100,got:100}];els['h'].value='5';A.drawPlan();
const sh=els['pl'].innerHTML;console.log('  low-yield held:',low.name,low.y.toFixed(1),'| ',(sh.match(/замена на [^<]{0,200}/)||['no alternative found'])[0].slice(0,190));
ok(/замена на/.test(sh)&&/после налога, издержки/.test(sh),'replacement idea with costs shown');
const soon=A.BONDSget().find(b=>(b.mat-new Date())/864e5>5&&(b.mat-new Date())/864e5<55&&!b.pk);if(soon){P.items=[{n:soon.name,mat:soon.mat.toISOString().slice(0,10),nx:soon.nx.toISOString().slice(0,10),p:soon.p,y:soon.y,c:soon.c,f:soon.f,nkd:soon.nkd,rt:soon.rt,pk:0,q:10,got:10}];A.drawPlan();ok(/до погашения \d+ дн\./.test(els['pl'].innerHTML),'near maturity is flagged for reinvestment')}else console.log('  (no bond maturing within 55 days in the fixture, skipped)');
// stale banner
const old=JSON.parse(JSON.stringify(seed0));old.at=new Date(Date.now()-10*864e5).toISOString();({A,els}=await boot(old,{}));ok(/ВНИМАНИЕ: данные старше 10 дн\./.test(els['st'].textContent)&&els['st'].classList._.has('stale'),'stale-data warning for 10-day-old data');
({A,els}=await boot(fresh,{}));ok(!/старше/.test(els['st'].textContent),'no warning for fresh data');
const wk=JSON.parse(JSON.stringify(seed0));wk.at=new Date(Date.now()-2.6*864e5).toISOString();({A,els}=await boot(wk,{}));ok(!/старше/.test(els['st'].textContent),'weekend gap (2.6 days) does not trigger a warning');
})().catch(e=>console.log('ERR',e.stack));
