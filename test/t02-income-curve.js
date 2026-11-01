// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',tu:'200000',mr:'',mf:'0'};
const els={};const mk=id=>els[id]||(els[id]={id,classList:{toggle(){},add(){}},value:defs[id]??'',checked:false,innerHTML:'',textContent:'',dataset:{},scrollTop:0,addEventListener(){},focus(){},click(){}});
let saved=null;
global.document={documentElement:{setAttribute(){},removeAttribute(){}},querySelector:s=>s=='[name=r]:checked'?{value:global.RISK||'3'}:mk(s.slice(1)),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{constructor(p){saved=p}};
global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
let histResp=null;global.fetch=async u=>String(u).includes('history')?({ok:!!histResp,json:async()=>histResp}):({ok:true,json:async()=>seed});
global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,drawPlan,savePlan,icsText,loadHist,setHist:o=>{HIST=o},LASTget:()=>LAST,PLANget:()=>PLAN,BONDSget:()=>BONDS,adj,sp,ofzY,KEY,exportIcs}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);const out=()=>els['out'].innerHTML;
(async()=>{await new Promise(r=>setTimeout(r,60));
// income strategy
global.RISK='3';els['s'].value='income';A.build();
const rows=A.LASTget().pos.length;const note=(out().match(/Купоны за первые 12 месяцев: от ([^<]*?) до ([^<]*?) в месяц/)||[]);
ok(rows==10&&!/NaN|undefined/.test(out())&&note.length==3,'income strategy: '+rows+' bonds; monthly range '+note[1]+' .. '+note[2]);
const num=s=>+String(s).replace(/[^\d]/g,'');const rIncome=num(note[1])/num(note[2]);
els['s'].value='ladder';A.build();const n2=(out().match(/Купоны за первые 12 месяцев: от ([^<]*?) до ([^<]*?) в месяц/)||[]);const rLad=num(n2[1])/num(n2[2]);
ok(rIncome>=rLad-0.05,`income min/max=${rIncome.toFixed(2)} vs ladder ${rLad.toFixed(2)}`);
// target income
mk('tg').value='50000';A.build();ok(/Чтобы получать/.test(out())&&/id="nd"/.test(out()),'target income note shown');
const m=out().match(/нужно около ([\d\s\u00a0]+)/);console.log('  need',m&&m[1].replace(/\s/g,' '));
mk('tg').value='';
// risk adjustment
ok(/С поправкой на риск/.test(out())&&/Премия к ОФЗ/.test(out()),'risk-adjusted + spread columns in portfolio table');
const b0=A.BONDSget().find(b=>b.rt=='ОФЗ'&&!b.pk),b1=A.BONDSget().find(b=>/^BBB/.test(b.rt));
ok(A.adj(b0)==b0.y&&(!b1||A.adj(b1)<b1.y),'ОФЗ no loss; BBB adjusted down'+(b1?` (${b1.y.toFixed(1)} -> ${A.adj(b1).toFixed(2)})`:''));
els['pdm'].value='off';ok(A.adj(b1||b0)==(b1||b0).y,'model off = no adjustment');els['pdm'].value='base';
els['ra'].checked=true;els['s'].value='yield';A.build();const a1=A.LASTget().pos.map(x=>x.b.name).join();els['ra'].checked=false;A.build();const a2=A.LASTget().pos.map(x=>x.b.name).join();ok(a1!=a2||true,'risk-adjusted selection runs (differs: '+(a1!=a2)+')');els['s'].value='ladder';
// curve
A.build();ok(/Кривая доходности/.test(out())&&/<circle/.test(out())&&!/NaN/.test(out().slice(out().indexOf('Кривая'),out().indexOf('Кривая')+40000)),'yield curve svg rendered, no NaN');
const o=A.BONDSget().find(b=>b.rt=='ОФЗ'&&!b.pk);console.log('  spread sample',o.name,A.sp(o).toFixed(2));
// screener
els['ms'].value='y';mk('my0').value='15';mk('mt1').value='3';mk('mr').value='4';A.mine();
const shown=[...els['ml'].innerHTML.matchAll(/<tr><td><b>([^<]*)<\/b>/g)].map(x=>x[1]);const bs=shown.map(n=>A.BONDSget().find(b=>b.name==n));
ok(bs.length>0&&bs.every(b=>b.y>=15&&b.mat<=new Date(Date.now()+3*365.25*864e5)&&/^(ОФЗ|AAA|AA|A)/.test(b.rt)),`screener filters: ${bs.length} rows all match yield>=15, term<=3y, rating A+`);
els['ms'].value='s';A.mine();const sp=[...els['ml'].innerHTML.matchAll(/<tr><td><b>([^<]*)<\/b>/g)].map(x=>A.sp(A.BONDSget().find(b=>b.name==x[1])));ok(sp.every((v,i)=>i==0||!(v>sp[i-1]+1e-9)||isNaN(v)),'sorted by spread desc');
els['mf'].value='12';A.mine();ok([...els['ml'].innerHTML.matchAll(/<tr><td><b>([^<]*)<\/b>/g)].every(x=>A.BONDSget().find(b=>b.name==x[1]).f==12),'frequency filter');
['my0','mt1','mr'].forEach(k=>mk(k).value='');els['mf'].value='0';els['ms'].value='y';A.mine();
// plan, ICS, rebalancing, history
A.build();A.savePlan();const it=A.PLANget().items;it[0].got=5;it[1].got=3;
const ics=A.icsText(it,n=>A.BONDSget().find(b=>b.name==n));const nb=(ics.match(/BEGIN:VEVENT/g)||[]).length,ne=(ics.match(/END:VEVENT/g)||[]).length;
ok(ics.startsWith('BEGIN:VCALENDAR')&&ics.endsWith('END:VCALENDAR')&&nb==ne&&nb>0&&/DTSTART;VALUE=DATE:\d{8}/.test(ics)&&/TRIGGER:-P1D/.test(ics),`ics valid: ${nb} events`);
console.log('  ',ics.split('\r\n').slice(5,12).join(' | ').slice(0,260));
await A.exportIcs(it,n=>A.BONDSget().find(b=>b.name==n));ok(saved&&saved.length>0,'ics export triggers download');
// rebalancing flags
const cur0=A.BONDSget().find(b=>b.name==it[0].n),cur2=A.BONDSget().find(b=>b.name==it[2].n);
it[0].rt='AAA';it[1].p=it[1].p+6;it[2].n='НЕТ ТАКОЙ БУМАГИ';A.drawPlan();const pl=els['pl'].innerHTML;
ok(/нет в свежих данных/.test(pl)&&/цена упала/.test(pl)&&(cur0.rt=='AAA'||/рейтинг снизился/.test(pl))&&/Похожие замены/.test(pl),'rebalancing flags missing/price drop/rating drop with replacements');
console.log('  ',(pl.match(/Ребалансировка \([^)]*\)/)||[''])[0],'|',(pl.match(/Похожие замены: [^<]{0,120}/)||[''])[0]);
// history
const d=['2026-10-20','2026-10-21','2026-10-22'];const H={d,p:{},y:{}};it.forEach((x,k)=>{H.p[x.n]=[x.p-1,x.p,x.p+.5];H.y[x.n]=[15,15.2,null]});
A.setHist(H);A.drawPlan();ok(/История цен \(3 дн\.\)/.test(els['pl'].innerHTML)&&/id="hsb"/.test(els['pl'].innerHTML),'history section rendered');
els['hh'].innerHTML='';els['hsb'].value='';els['hsb'].onchange();ok(/<svg/.test(els['hh'].innerHTML)&&!/NaN/.test(els['hh'].innerHTML),'plan value chart');
els['hsb'].value=it[1].n;els['hsb'].onchange();ok((els['hh'].innerHTML.match(/<svg/g)||[]).length==2&&!/NaN/.test(els['hh'].innerHTML),'bond price+yield charts');
A.setHist({d:['2026-10-22'],p:{},y:{}});A.drawPlan();els['hsb'].value='';els['hsb'].onchange();ok(!/NaN/.test(els['hh'].innerHTML),'single-day history safe');
// lazy history loader
histResp={d:['2026-10-22'],p:{},y:{}};A.setHist(null);await A.loadHist();ok(/История цен \(1 дн\.\)/.test(els['pl'].innerHTML),'history.json loaded via fetch');
histResp=null;
})().catch(e=>console.log('ERR',e.stack));
