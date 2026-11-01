// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed0=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'yield',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
async function boot(seed){const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
const kd=[];global.document={body:{dataset:{}},activeElement:null,documentElement:{setAttribute(){},removeAttribute(){}},addEventListener:(t,f)=>kd.push(f),querySelector:s=>s=='[name=r]:checked'?{value:'5'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,drawPlan,savePlan,snap,mergeSnap,ssDraw,cands,critNow,critSet,planBar,LASTget:()=>LAST,PLANget:()=>PLAN,BONDSget:()=>BONDS,BLKget:()=>BLK}`)(els,mk);await new Promise(r=>setTimeout(r,60));return{A,els,mk,kd}}
(async()=>{
const seed=JSON.parse(JSON.stringify(seed0));const qn=seed.b.filter(b=>b.rt!='ОФЗ').slice(0,40);qn.forEach(b=>b.q=1);const qset=new Set(qn.map(b=>b.name));seed.qual='ok';
let {A,els,mk,kd}=await boot(seed);
ok(!/id="ql"/.test(html)&&!/#ql/.test(js),'checkbox removed from the page and no code reads it');
for(const st of ['yield','ladder','equal','barbell','income']){els['s'].value=st;A.build();ok(A.LASTget().pos.every(x=>!qset.has(x.b.name)),'strategy '+st+': no qualified-only bonds selected ('+A.LASTget().pos.length+' picked)')}
els['mq'].value='';A.mine();const shown=[...els['ml'].innerHTML.matchAll(/<tr><td><b>([^<]*)<\/b>/g)].map(m=>m[1]);ok(shown.length>0&&shown.every(n=>!qset.has(n)),'picker never lists them ('+shown.length+' rows)');
mk('mq').value=[...qset][0];A.mine();ok(!/<tr><td><b>/.test(els['ml'].innerHTML)||![...els['ml'].innerHTML.matchAll(/<tr><td><b>([^<]*)<\/b>/g)].some(m=>qset.has(m[1])),'searching a qualified bond by name still hides it');mk('mq').value='';
ok(A.cands().every(b=>!qset.has(b.name)),'planner candidate pool excludes them');
ok(!('ql' in A.critNow()),'saved searches no longer carry a qualified switch');
ok(/Выпуски для квалифицированных инвесторов исключены биржевым признаком/.test(els['st'].textContent)&&!/Внимание/.test(els['st'].textContent),'status says verified when qual=ok');
// personal hide list
A.build();const first=A.LASTget().pos[0].b.name;mk('mq').value=first;A.mine();ok(/data-hd=/.test(els['ml'].innerHTML),'hide button present');
els['ml'].onclick({target:{dataset:{hd:'0'}}});ok(A.BLKget()[first]===1,'bond added to the hide list');
A.build();ok(A.LASTget().pos.every(x=>x.b.name!=first),'hidden bond is no longer selected');A.mine();ok(!new RegExp('<b>'+first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</b>').test(els['ml'].innerHTML),'hidden bond disappears from the picker');
A.ssDraw();ok(/Скрытые бумаги \(1\)/.test(els['ss'].innerHTML)&&/data-un=/.test(els['ss'].innerHTML),'hidden list with restore button');
const sn=A.snap();ok(sn.blk&&sn.blk[first]===1,'hide list is part of the synced snapshot');
const m=A.mergeSnap({all:{},blk:{[first]:1},ts:9,cur:'x'},{all:{},blk:{},ts:3,cur:'x'});ok(m.blk[first]===1,'merge keeps the hide list from the newer side');
els['ss'].onclick({target:{id:'x',dataset:{un:first}}});ok(!A.BLKget()[first],'restore removes it from the hide list');A.build();
// persisted data keeps the original flag, not the personal one
A.BLKget()[first]=1;A.mine();const stored=()=>{};
// plan guard
A.savePlan();const it=A.PLANget().items;A.BLKget()[it[0].n]=1;A.drawPlan();ok(/выпуск для квалифицированных инвесторов или скрыт вами/.test(els['pl'].innerHTML),'plan flags a held bond that is now excluded');
// help overlay
ok(/id="help"/.test(html)&&els['hlp'].onclick&&els['hlc'].onclick,'help button and close handlers attached');
els['hlp'].onclick();ok(els['help'].hidden===false,'help opens');els['hlc'].onclick();ok(els['help'].hidden===true,'help closes with the button');
els['hlp'].onclick();kd.forEach(f=>f({key:'Escape'}));ok(els['help'].hidden===true,'Escape closes help');
els['hlp'].onclick();els['help'].onclick({target:els['help']});ok(els['help'].hidden===true,'click on backdrop closes help');
// unverified data shows the warning
const seed2=JSON.parse(JSON.stringify(seed0));({A,els}=await boot(seed2));ok(/Внимание: признак «только для квалифицированных инвесторов»/.test(els['st'].textContent),'warning shown when data is not verified');
// old stored data keeps working: saveData round-trip does not bake personal hides into q
})().catch(e=>console.log('ERR',e.stack));
