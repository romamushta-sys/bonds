// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',tu:'200000',mr:'',mf:'0',dep:'',mmf:''};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};
global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
const gist={calls:[],store:null};
global.fetch=async(u,o={})=>{u=String(u);if(u.includes('api.github.com')){gist.calls.push([o.method||'GET',u,o.headers&&o.headers.Authorization]);if((o.method||'GET')=='GET')return{ok:true,json:async()=>({id:'G1',files:{'bond-plans.json':{content:gist.store}}})};gist.store=JSON.parse(o.body).files['bond-plans.json'].content;return{ok:true,json:async()=>({id:'G1'})}}
return u.includes('history')?{ok:false}:{ok:true,json:async()=>seed}};
global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,drawPlan,savePlan,importBroker,ssDraw,loadPlans,snap,krPath,krAt,ldvMap,simHTML,altHTML,events,applyTax,applyKey,LASTget:()=>LAST,PLANget:()=>PLAN,ALLget:()=>ALL,SRCHget:()=>SRCH,ALRTget:()=>ALRT,BONDSget:()=>BONDS,CURset:v=>{CUR=v}}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);const out=()=>els['out'].innerHTML;
(async()=>{await new Promise(r=>setTimeout(r,60));
A.build();
// comparison + simulation
ok(/введите их доходность/.test(out())&&!/Доход за/.test(out()),'comparison hint when no rates');
mk('dep').value='13';mk('mmf').value='14';A.build();ok(/Сравнение с вкладом и фондом/.test(out())&&/Вклад/.test(out())&&!/NaN/.test(out()),'comparison table with deposit and fund');
const sim=out().slice(out().indexOf('Симуляция дефолтов'));const vals=[...sim.matchAll(/₽ \(([\-\d,]+)%/g)].map(m=>+m[1].replace(',','.'));
ok(/Симуляция дефолтов/.test(out())&&!/NaN|undefined/.test(sim.slice(0,3500)),'simulation rendered');console.log('  pct values',vals.slice(0,6).join(' | '));
ok(vals.length==5&&vals[0]>=vals[1]-1e-9&&vals[2]>=vals[3]-1e-9&&vals[3]>=vals[4]-1e-9,'percentiles ordered: no-default >= mean, median >= p5 >= p1');
mk('pdm').value='off';A.build();ok(/Симуляция дефолтов выключена/.test(out()),'simulation off when model off');mk('pdm').value='hard';A.build();const hard=[...out().slice(out().indexOf('Симуляция дефолтов')).matchAll(/₽ \(([\-\d,]+)%/g)].map(m=>+m[1].replace(',','.'));mk('pdm').value='base';
ok(hard[1]<=vals[1]+1e-9,`harder model lowers mean (${hard[1]} vs ${vals[1]})`);
// key-rate path
mk('krp').value='2027-01:10, 2027-07:8';const P=A.krPath();ok(P.length==2&&A.krAt(new Date(2026,11,1),P)==14&&A.krAt(new Date(2027,2,1),P)==10&&A.krAt(new Date(2028,0,1),P)==8,'key-rate path parsed and applied');
const pkb=A.BONDSget().find(b=>b.pk);mk('pk').checked=true;A.applyKey();const cWith=pkb.c;mk('krp').value='';A.applyKey();ok(cWith<pkb.c,`floater coupon lower under falling-rate path (${cWith.toFixed(1)} < ${pkb.c.toFixed(1)})`);
const evs=A.events([{b:{...pkb,mat:new Date(Date.now()+4*365*864e5)},q:1}]);mk('krp').value='2027-01:7';const evs2=A.events([{b:{...pkb,mat:new Date(Date.now()+4*365*864e5)},q:1}]);
const lastC=e=>e.filter(x=>x.cp).slice(-1)[0].cp;ok(lastC(evs2)<lastC(evs),'plan events for floaters follow the path');mk('krp').value='';mk('pk').checked=false;
// saved searches
mk('my0').value='15';mk('mt1').value='3';mk('mr').value='4';mk('ssn').value='Мой поиск';A.ssDraw();els['ss'].onclick({target:{id:'ssa',dataset:{}}});
ok(A.SRCHget().length==1&&A.SRCHget()[0].n=='Мой поиск'&&A.SRCHget()[0].y0=='15','search saved');ok(/Мой поиск/.test(els['ss'].innerHTML)&&/доходность 15–∞%/.test(els['ss'].innerHTML),'search listed with description');
['my0','mt1','mr'].forEach(k=>mk(k).value='');els['ss'].onclick({target:{id:'x',dataset:{sa:'0'}}});ok(els['my0'].value=='15'&&els['mt1'].value=='3'&&els['mr'].value=='4','search applied back to filters');
['my0','mt1','mr'].forEach(k=>mk(k).value='');
// broker import
A.build();A.savePlan();const pl0=A.PLANget();const b1=A.BONDSget().find(b=>b.name=='ОФЗ 26250'),b2=A.BONDSget().find(b=>b.rt=='AA'&&!b.pk);
const rows=[['Отчёт брокера'],['Дата сделки','Операция','Наименование','Количество','Цена','НКД','Комиссия'],
 ['20.08.2026 10:01','Покупка',b1.name,'10',String(b1.p-1).replace('.',','),'40,5','12,3'],
 ['25.08.2026','Покупка',b2.name,'5',String(b2.p*10),'20','5'],
 ['01.09.2026','Продажа',b1.name,'4',String(b1.p),'16','4'],
 ['02.09.2026','Выплата купона',b1.name,'6','0','0','0'],
 ['03.09.2026','Покупка','Неведомая облигация','3','95','0','0'],
 ['20.08.2026 10:01','Покупка',b1.name,'10',String(b1.p-1).replace('.',','),'40,5','12,3']];
const r=A.importBroker(rows);console.log('  ',r.msg);const t=A.PLANget().trades;
const it1=A.PLANget().items.find(x=>x.n==b1.name),it2=A.PLANget().items.find(x=>x.n==b2.name);
ok(/покупок 2/.test(r.msg)&&/продаж 1/.test(r.msg)&&/дубликатов пропущено 1/.test(r.msg)&&/не распознано бумаг 1/.test(r.msg),'import counts: 2 buys, 1 sale, 1 duplicate, 1 unknown');
ok(it1&&it1.got==6&&it2&&it2.got==5&&it2.p>0,'positions updated (10-4=6, 5)');const tb2=t.find(x=>x.n==b2.name);ok(tb2&&Math.abs(tb2.p-b2.p)<1e-9,'price in rubles converted to percent');
ok(/Импорт|годовая|Результат/.test(els['pl'].innerHTML)&&!/NaN|undefined/.test(els['pl'].innerHTML),'journal renders after import with sale');
ok(/Не нашёл строку/.test(A.importBroker([['a','b'],['1','2']]).msg),'unrecognised file reports clearly');
// alerts
A.drawPlan();ok(/Оповещения \(0\)/.test(els['pl'].innerHTML)&&/<datalist/.test(els['pl'].innerHTML),'alerts block with bond list');
mk('aln').value=b1.name;mk('alv').value='5';mk('alt').value='y';els['ala'].onclick();ok(A.ALRTget().length==1,'alert added');ok(/сейчас выполняется/.test(els['pl'].innerHTML),'alert shows currently-true status');
mk('aln').value='нет такой';els['ala'].onclick();ok(A.ALRTget().length==1,'unknown bond rejected');els['all'].onclick({target:{dataset:{al:'0'}}});ok(A.ALRTget().length==0,'alert removed');
A.ALRTget().push({n:b1.name,t:'p',v:50});
// LDV
const it=A.PLANget().items;const x=it.find(z=>z.pk==0&&z.p<90&&(new Date(z.mat)-new Date())/365.25/864e5>3.2)||it[0];
const planBefore=JSON.stringify(A.ldvMap());A.PLANget().ldv=true;const m=A.ldvMap();A.PLANget().ldv=false;
const evA=A.events([{b:{name:'X',mat:new Date(Date.now()+4*365*864e5),nx:new Date(Date.now()+30*864e5),p:80,c:20,f:2},q:10}]);const evB=A.events([{b:{name:'X',mat:new Date(Date.now()+4*365*864e5),nx:new Date(Date.now()+30*864e5),p:80,c:20,f:2},q:10}],{X:1});
const dsA=evA.slice(-1)[0].ds,dsB=evB.slice(-1)[0].ds;ok(dsA>0&&dsB==0,'LDV zeroes discount income on redemption');
A.applyTax(evA,'i',0);A.applyTax(evB,'i',0);ok(evB.slice(-1)[0].tx<evA.slice(-1)[0].tx,'LDV lowers tax on the redemption event');
ok(planBefore=='null'&&m&&Object.keys(m).length>=0,'ldvMap null when off, object when on ('+Object.keys(m).length+' eligible)');
// mobile: nav exists and body tab set
ok(/id="mnav"/.test(html)&&/body\[data-g=m\]/.test(html)&&/aside\.col/.test(html),'mobile tabs markup/css present');
})().catch(e=>console.log('ERR',e.stack));
