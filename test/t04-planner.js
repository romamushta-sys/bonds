// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};
global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};
global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,drawPlan,savePlan,runPlanner,store,cands,PLANget:()=>PLAN,BONDSget:()=>BONDS}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
(async()=>{await new Promise(r=>setTimeout(r,60));A.build();A.savePlan();const P=A.PLANget(),it=P.items,cb=n=>A.BONDSget().find(b=>b.name==n);
const strip=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
// scenario 1: partially filled plan, monthly top-ups, small amount => only plan items
it.forEach(x=>x.got=Math.floor(x.q/2));
P.pl={a:50000,p:1,n:6,r:false};A.runPlanner(it,cb);let o=els['plo'].innerHTML;
const rowsN=(o.match(/<tr><td>\d+<\/td>/g)||[]).length;ok(rowsN==6&&!/NaN|undefined/.test(o),'6 monthly top-ups rendered');
ok(!/новая/.test(o),'no new bonds while plan has shortfall');console.log('  ',strip(o).slice(0,260));
ok(/Итого вложите/.test(o)&&/Рекомендации/.test(o)&&/План будет собран|план собран не будет/.test(o),'summary and recommendations present');
// totals do not exceed budgets
const spent=+((strip(o).match(/Итого вложите ([\d\s\u00a0]+)/)||[])[1]||'').replace(/\D/g,'');ok(spent>0&&spent<=300000,'spent '+spent+' <= 300 000');
// scenario 2: big top-up completes plan then adds new bonds within cap
it.forEach(x=>x.got=x.q-1);P.pl={a:600000,p:3,n:3,r:true};A.runPlanner(it,cb);o=els['plo'].innerHTML;
ok(/новая/.test(o)&&!/NaN|undefined/.test(o),'new bonds recommended after plan is filled');
const names=[...o.matchAll(/(\d+) × ([^;<]*?)( <span class="chip">новая)/g)].map(m=>m[2].trim());
ok(names.length>0&&names.every(n=>!it.some(x=>x.n==n)),'new bonds not already in plan: '+names.slice(0,4).join(', '));
const iss=n=>n.split(/[\s-]/)[0],cnt={};names.forEach(n=>{const k=iss(n);cnt[k]=(cnt[k]||0)+1});
ok(true,'new issuers: '+JSON.stringify(cnt));console.log('  ',strip(o).split('Рекомендации')[1].slice(0,400));
ok(/Добавить \d+ нов\S* бумаг/.test(strip(o)),'apply button shown');
const before=P.items.length;els['plp'].onclick();ok(P.items.length>before&&P.items.slice(before).every(x=>x.got==0&&x.q>0),'apply adds new items to the plan with got=0');
// scenario 3: lump sum, reinvest flag irrelevant; zero/invalid amount
P.pl={a:0,p:0,n:1,r:false};A.runPlanner(P.items,cb);ok(/Введите сумму/.test(els['plo'].innerHTML),'zero amount handled');
// scenario 4: reinvest raises later budgets
it.forEach(x=>x.got=x.q);P.pl={a:50000,p:1,n:6,r:true};A.runPlanner(P.items,cb);o=els['plo'].innerHTML;
const budgets=[...o.matchAll(/<tr><td>(\d+)<\/td><td>[\d.]+<\/td><td>([\d\s\u00a0]+)₽/g)].map(m=>+m[2].replace(/\D/g,''));console.log('  budgets',budgets.join(' / '));
ok(budgets[0]==50000&&budgets.slice(1).some(b=>b>50000),'coupons added to later top-ups');
// plan stored with planner settings and persists
ok(JSON.parse(localStorage._.plan).all['Основной'].pl.a>=0,'planner settings saved in plan');
})().catch(e=>console.log('ERR',e.stack));
