// © 2026 Мушта Роман Александрович. Пометка «сверка» и ключевая ставка из данных.
const fs=require('fs'),path=require('path');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
seed.at=new Date().toISOString();seed.qual='ok';seed.kr0=14;
const norm=seed.b.filter(b=>b.rt!='ОФЗ'&&!b.pk);const sus=norm.slice(0,60);sus.forEach(b=>b.sus=1);const susNames=new Set(sus.map(b=>b.name));
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'yield',u:'all',vol:'100',cap:'20',kr:'99',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={title:'',body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},querySelector:s=>s=='[name=r]:checked'?{value:'5'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')||String(u).includes('blocklist')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:[],Sheets:{}}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,drawPlan,savePlan,cands,LASTget:()=>LAST,PLANget:()=>PLAN}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
(async()=>{await new Promise(r=>setTimeout(r,80));
ok(els['kr'].value=='14','key-rate field takes the official rate from the data: '+els['kr'].value);
for(const st of ['yield','ladder','equal','barbell','income']){els['s'].value=st;A.build();ok(A.LASTget().pos.every(x=>!susNames.has(x.b.name)),'strategy '+st+': no "сверка" bonds selected')}
ok(A.cands().every(b=>!susNames.has(b.name)),'planner pool excludes them');
mk('mq').value=[...susNames][0];A.mine();const list=els['ml'].innerHTML;ok(new RegExp('<b>'+[...susNames][0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</b>').test(list)&&/сверка/.test(list),'picker still lists such a bond, with a "сверка" chip');mk('mq').value='';
A.build();A.savePlan();const P=A.PLANget();const b=[...susNames][1];const x=seed.b.find(z=>z.name==b);
P.items.push({n:x.name,mat:x.mat.slice(0,10),nx:x.nx.slice(0,10),p:x.p,y:x.y,c:x.c,f:x.f,nkd:x.nkd,rt:x.rt,pk:0,q:5,got:5});A.drawPlan();
ok(/доходность по купонам и по данным биржи сильно расходятся/.test(els['pl'].innerHTML),'plan flags a held bond marked "сверка"');
})().catch(e=>console.log('ERR',e.stack));
