// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs'),cp=require('child_process');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0'};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={title:'',body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:[],Sheets:{}}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {ytmJS,prog,BR,addM,events,applyTax,TODAY:()=>TODAY,YR,BONDS:()=>BONDS,yrs}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);const near=(a,b,t)=>Math.abs(a-b)<=t;
(async()=>{await new Promise(r=>setTimeout(r,60));const T=A.TODAY();
// --- yields (effective annual convention)
const addD=n=>new Date(T.getFullYear(),T.getMonth(),T.getDate()+n);
let mat=addD(730),t=(mat-T)/(365.25*864e5);ok(near(A.ytmJS(80,0,2,mat,mat,0),((1000/800)**(1/t)-1)*100,1e-6),'zero-coupon, 2 years, price 80: yield '+A.ytmJS(80,0,2,mat,mat,0).toFixed(4)+'% matches (1000/800)^(1/t)-1');
let m1=addD(365),t1=(m1-T)/(365.25*864e5);ok(near(A.ytmJS(100,100,1,m1,m1,0),((1100/1000)**(1/t1)-1)*100,1e-6),'annual 10% coupon bond at par for 1 year: yield '+A.ytmJS(100,100,1,m1,m1,0).toFixed(3)+'%');
const m2=addD(182),nx2=addD(182);ok(near(A.ytmJS(100,50,2,nx2,m2,0),((1050/1000)**(1/((m2-T)/(365.25*864e5)))-1)*100,1e-6),'half-year bond with 5% coupon at par: effective annual yield ~10.25%: '+A.ytmJS(100,50,2,nx2,m2,0).toFixed(3));
ok(A.ytmJS(100,100,1,m1,m1,0)>A.ytmJS(98,100,1,m1,m1,0)==false,'lower price gives higher yield');
// --- tax scale
const P=A.prog,B=A.BR;ok(P(2.4e6,B.p)==312000&&P(5e6,B.p)==702000&&P(2e7,B.p)==3402000&&P(5e7,B.p)==9402000&&P(6e7,B.p)==11602000,'progressive scale 13/15/18/20/22%: 312 000 / 702 000 / 3 402 000 / 9 402 000 / 11 602 000');
ok(P(3e6,B.i)==402000&&P(1e6,B.i)==130000,'investment-income scale 13% to 2.4m, 15% above');
const ev=[{d:new Date(T.getFullYear()+1,5,1),n:'X',cp:1e6,rd:0,ds:0}];A.applyTax(ev,'i',2e6);ok(near(ev[0].tx,142000,1e-6)&&near(ev[0].cpn,858000,1e-6),'1m of coupons on top of 2m other income: tax 142 000 (52 000 at 13% + 90 000 at 15%)');
const ev2=[{d:new Date(T.getFullYear()+1,5,1),n:'X',cp:100,rd:1000,ds:200}];A.applyTax(ev2,'n',0);ok(ev2[0].tx==0&&ev2[0].rdn==1000,'no-tax mode: nothing withheld');
const ev3=[{d:new Date(T.getFullYear()+1,5,1),n:'X',cp:0,rd:1000,ds:200}];A.applyTax(ev3,'i',0);ok(near(ev3[0].tx,26,1e-9)&&near(ev3[0].rdn,974,1e-9),'discount at redemption taxed: 200 gain -> 26 tax');
// --- calendar
const d31=new Date(2027,0,31);ok(A.addM(d31,1).getMonth()==1&&A.addM(d31,1).getDate()==28,'31 Jan + 1 month = 28 Feb 2027 (no overflow into March)');ok(A.addM(d31,13).getMonth()==1&&A.addM(d31,13).getDate()==29,'31 Jan 2027 + 13 months = 29 Feb 2028 (leap year)');ok(A.addM(new Date(2027,4,15),-3).getMonth()==1&&A.addM(new Date(2027,4,15),-3).getDate()==15,'going back keeps the day when it exists');
const mb=(f)=>A.BONDS().find(b=>b.f==f&&!b.pk&&A.yrs(b)>1.3);
for(const f of [12,4,2,1]){const b=mb(f);if(!b){console.log('  (no fixture bond with frequency',f,')');continue}const e=A.events([{b,q:3}]),lim=new Date(T.getFullYear()+1,T.getMonth(),T.getDate()),in12=e.filter(x=>x.cp>0&&x.d<lim).length;ok(in12==f||in12==f+1||in12==f-1,'frequency '+f+': '+in12+' coupons in the next 12 months for '+b.name)}
const b=mb(2),e=A.events([{b,q:3}]);ok(e[e.length-1].rd==3000&&near(e.filter(x=>x.cp>0).reduce((s,x)=>s+x.cp,0)/3/b.c,e.filter(x=>x.cp>0).length,1e-9),'redemption 3 x 1000 at maturity, coupon amounts equal c per bond');
// --- JS vs Python, and vs the source yield
const sample=A.BONDS().filter(b=>!b.pk&&b.y>0&&b.c>0&&A.yrs(b)>.5).slice(0,40);
const rows=sample.map(b=>[b.p,b.c,b.f,b.nx.toISOString().slice(0,10),b.mat.toISOString().slice(0,10),b.nkd]);
const py=`import json,sys;sys.path.insert(0,'${require('path').join(__dirname,'..','scripts').replace(/\\\\/g,'/')}');import update_data as u;from datetime import date;T=date(${T.getFullYear()},${T.getMonth()+1},${T.getDate()});r=json.load(sys.stdin);print(json.dumps([u.ytm(p,1000,c,f,date.fromisoformat(n),date.fromisoformat(m),k,T) for p,c,f,n,m,k in r]))`;
let pyY;try{pyY=JSON.parse(cp.execFileSync('python3',['-c',py],{input:JSON.stringify(rows)}).toString())}catch(e){console.log('  python unavailable:',String(e).slice(0,100))}
if(pyY){const js=sample.map(b=>A.ytmJS(b.p,b.c,b.f,b.nx,b.mat,b.nkd)),dd=js.map((v,i)=>Math.abs(v-pyY[i]));ok(Math.max(...dd)<.6,'JS and Python yields agree on '+sample.length+' bonds (max diff '+Math.max(...dd).toFixed(3)+' p.p., mean '+(dd.reduce((a,b)=>a+b)/dd.length).toFixed(3)+')');
const ds=sample.map((b,i)=>Math.abs(js[i]-b.y));console.log('  info: own yield vs source yield, mean diff',(ds.reduce((a,b)=>a+b)/ds.length).toFixed(2),'p.p., max',Math.max(...ds).toFixed(2),', over 1 p.p.:',ds.filter(x=>x>1).length,'of',ds.length)}
})().catch(e=>console.log('ERR',e.stack));
