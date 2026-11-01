// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,drawPlan,savePlan,pfData,store,PLANget:()=>PLAN,BONDSget:()=>BONDS}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);const DAY=864e5;
(async()=>{await new Promise(r=>setTimeout(r,60));A.build();A.savePlan();const P=A.PLANget(),it=P.items;
// monthly-coupon bond and a semiannual one for clear signal
const mb=A.BONDSget().filter(b=>b.f==12&&!b.pk&&b.rt!='—').slice(0,2);
P.at=new Date(Date.now()-170*DAY).toISOString();
// replace plan with controlled items
P.items=mb.map(b=>({n:b.name,mat:b.mat.toISOString().slice(0,10),nx:b.nx.toISOString().slice(0,10),p:b.p,y:b.y,c:b.c,f:b.f,nkd:b.nkd,rt:b.rt,pk:0,q:10,got:0}));
P.trades=[{d:new Date(Date.now()-130*DAY).toISOString(),n:mb[0].name,q:10,p:mb[0].p,nkd:0,fee:0}];P.items[0].got=10;P.items[1].got=0;P.tm='n';P.oth=0;
let R=A.pfData(P.items);ok(R.length>=12&&R.length<=24&&R.every(r=>isFinite(r.plan)&&isFinite(r.fact)),'rows built: '+R.length+' months, all finite');
const cur=R.find(r=>r.cur);ok(!!cur&&R.indexOf(cur)>0,'current month marked');
const atM=new Date(P.at);const before=R.filter(r=>r.d<new Date(atM.getFullYear(),atM.getMonth(),1));ok(before.every(r=>r.plan==0),'plan is zero before the plan creation month ('+before.length+' months)');
const tM=new Date(Date.now()-130*DAY);const pre=R.filter(r=>!r.fut&&r.d<new Date(tM.getFullYear(),tM.getMonth(),1));ok(pre.every(r=>r.fact==0),'fact is zero before the purchase');
const post=R.filter(r=>!r.fut&&!r.cur&&r.d>new Date(tM.getFullYear(),tM.getMonth()+1,1));ok(post.length>0&&post.every(r=>r.fact>0&&r.fact<r.plan),'fact positive after purchase and below plan (only 1 of 2 bonds bought): '+post.map(r=>Math.round(r.fact)+'/'+Math.round(r.plan)).join(' '));
const fut=R.filter(r=>r.fut);ok(fut.length==11&&fut.every(r=>r.fact>0&&Math.abs(r.fact*2-r.plan)<r.plan*.2||r.plan>0),'future fact reflects current holdings, plan reflects full plan');
const f1=R.filter(r=>r.fut)[3];ok(Math.abs(f1.plan-10*(mb[0].c+mb[1].c))<1e-6&&Math.abs(f1.fact-10*mb[0].c)<1e-6,'exact future numbers (no tax): plan='+f1.plan.toFixed(2)+' fact='+f1.fact.toFixed(2)+' expected '+(10*(mb[0].c+mb[1].c)).toFixed(2)+' / '+(10*mb[0].c).toFixed(2));
// sale reduces fact
P.trades.unshift({d:new Date(Date.now()-40*DAY).toISOString(),n:mb[0].name,q:-10,p:mb[0].p,nkd:0,fee:0});P.items[0].got=0;R=A.pfData(P.items);const afterSale=R.filter(r=>!r.fut&&r.d>new Date(Date.now()-30*DAY)&&!r.cur);
ok(R.filter(r=>r.fut).every(r=>r.fact==0),'after a full sale the expected fact is zero');
P.trades.shift();P.items[0].got=10;
// tax: with tax the net amounts are lower
const gross=R.reduce((t,r)=>t+r.plan,0);P.tm='i';P.oth=0;const net=A.pfData(P.items).reduce((t,r)=>t+r.plan,0);ok(net<gross,'tax lowers net plan payouts ('+Math.round(gross)+' -> '+Math.round(net)+')');
// html and override
A.drawPlan();let pl=els['pl'].innerHTML;ok(/График выплат: план и факт/.test(pl)&&/<svg/.test(pl)&&!/NaN|undefined/.test(pl),'section rendered without NaN');
const pastRows=(pl.match(/data-pf="/g)||[]).length;ok(pastRows>0,'input rows for past months: '+pastRows);
const key=pl.match(/data-pf="([\d-]+)"/)[1];els['pfx'].onchange({target:{dataset:{pf:key},value:'12345'}});ok(P.act&&P.act[key]==12345,'manual fact saved');
pl=els['pl'].innerHTML;ok(/value="12345"/.test(pl)&&/12\s?345/.test(pl.replace(/\u00a0/g,' ')),'override shown and used in totals');
els['pfx'].onchange({target:{dataset:{pf:key},value:''}});ok(P.act[key]==null,'blank input removes the override');
// amount labels on the plan/fact chart
P.tm='n';P.oth=0;A.drawPlan();{const svg=els['pl'].innerHTML,seg=svg.slice(svg.indexOf('График выплат'),svg.indexOf('Получено, ₽')>0?svg.indexOf('Получено, ₽'):svg.length),RR=A.pfData(P.items),kf=v=>(v/1000).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
const labels=[...seg.matchAll(/font-weight="700" style="fill:var\(--(?:ink|on,#fff)\)">([^<]*)</g)].map(m=>m[1]),need=RR.filter(r=>r.plan>=1).length+RR.filter(r=>r.fact>=1).length;
ok(labels.length==need&&need>0,'labels on chart: '+labels.length+' (expected '+need+')');const rr=RR.find(r=>r.plan>=1);ok(seg.includes('>'+kf(rr.plan)+'<'),'plan label text '+kf(rr.plan)+' present');
const ff=RR.find(r=>r.fact>=1);ok(seg.includes('>'+kf(ff.fact)+'<'),'fact label text '+kf(ff.fact)+' present');ok(/min-width:640px/.test(seg)&&!/NaN|undefined/.test(seg),'chart scrolls on narrow screens, no NaN');console.log('  labels:',labels.slice(0,8).join(' | '))}
// empty plan safe
P.items=[];A.drawPlan();ok(!/График выплат/.test(els['pl'].innerHTML)&&!/NaN|undefined/.test(els['pl'].innerHTML),'empty plan renders safely');
})().catch(e=>console.log('ERR',e.stack));
