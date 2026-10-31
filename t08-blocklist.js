// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'yield',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
async function boot(block){const els={};const clicks={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(t,f){clicks[id+':'+t]=f},focus(){},click(){}});
global.document={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},querySelector:s=>s=='[name=r]:checked'?{value:'5'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>{u=String(u);if(u.includes('history'))return{ok:false};if(u.includes('blocklist'))return block?{ok:true,json:async()=>block}:{ok:false};return{ok:true,json:async()=>seed}};
global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,mine,LASTget:()=>LAST,BONDSget:()=>BONDS,BLKget:()=>BLK,fbHas}`)(els,mk);await new Promise(r=>setTimeout(r,80));return{A,els,clicks}}
(async()=>{
// without the blocklist the bond is available (this is the situation the user saw)
let {A,els,clicks}=await boot(null);
const b=A.BONDSget().find(x=>x.name=='ИнвОбл06');ok(!!b,'test bond exists in data: ИнвОбл06 ('+b.rt+', '+b.y.toFixed(1)+'%)');
const picks=[];for(const st of ['yield','ladder','equal','barbell','income']){els['s'].value=st;A.build();picks.push(A.LASTget().pos.some(x=>x.b.name=='ИнвОбл06'))}console.log('  selected without blocklist per strategy:',picks.join(','));
// one-click hide from the portfolio table
els['s'].value='yield';A.build();const sel=A.LASTget().pos[0].b.name;ok(/data-hb=/.test(els['out'].innerHTML),'portfolio table has a Hide button for every row ('+(els['out'].innerHTML.match(/data-hb=/g)||[]).length+')');
clicks['out:click']({target:{dataset:{hb:sel}}});ok(A.BLKget()[sel]===1&&A.LASTget().pos.every(x=>x.b.name!=sel),'click hides the bond and rebuilds the portfolio without it');
// permanent blocklist file
({A,els,clicks}=await boot({names:['ИнвОбл06','Тест*']}));
ok(A.fbHas('инвобл06')&&A.fbHas('ТЕСТ 7')&&!A.fbHas('ИнвОбл08'),'blocklist: exact (case-insensitive) and prefix entries');
for(const st of ['yield','ladder','equal','barbell','income']){els['s'].value=st;A.build();ok(A.LASTget().pos.every(x=>x.b.name!='ИнвОбл06'),'blocklist applied, strategy '+st)}
mk=null;els['mq'].value='ИнвОбл06';A.mine();ok(!/<tr><td><b>ИнвОбл06/.test(els['ml'].innerHTML),'not listed in the picker either');
})().catch(e=>console.log('ERR',e.stack));
