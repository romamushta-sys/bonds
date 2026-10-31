// © 2026 Мушта Роман Александрович. Тест приложения; запуск: node tests/run-all.js
const fs=require('fs');const D={names:[],sheets:{}};
const seed=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixture.json'),'utf8'));
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/const EMB="[^"]*"/,'const EMB="x"');
const defs={amt:'1000000',n:'10',h:'5',s:'ladder',u:'all',vol:'100',cap:'20',kr:'14',fq:'0',tm:'i',oth:'0',mq:'',ms:'y',fee:'0.1',pdm:'base',rec:'30',mr:'',mf:'0',mo:'12'};
const els={};const mk=id=>els[id]||(els[id]={id,value:defs[id]??'',checked:false,hidden:true,innerHTML:'',textContent:'',placeholder:'',dataset:{},scrollTop:0,classList:{toggle(){},add(){}},addEventListener(){},focus(){},click(){}});
global.document={body:{dataset:{}},documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},querySelector:s=>s=='[name=r]:checked'?{value:'3'}:mk(s.replace(/^#/,'')),createElement:()=>({click(){}})};
global.URL={createObjectURL:()=>'blob:x'};global.Blob=class{};global.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}};
global.fetch=async u=>String(u).includes('history')?{ok:false}:{ok:true,json:async()=>seed};global.XLSX={read:()=>({SheetNames:D.names,Sheets:D.sheets}),utils:{sheet_to_json:ws=>ws}};global.FileReader=function(){};
const A=new Function('els','mk',js+`;return {build,savePlan,drawPlan,PLANget:()=>PLAN,setHist:o=>{HIST=o},setMON:v=>{MON=v}}`)(els,mk);
const ok=(c,m)=>console.log((c?'PASS':'FAIL'),m);
(async()=>{await new Promise(r=>setTimeout(r,60));A.build();const o=els['out'].innerHTML;
const svgs=o.split('<svg').slice(1).map(s=>s.slice(0,s.indexOf('</svg>')));
const labelRe=/font-weight="700" style="fill:var\(--ink\)">([^<]+)</g;
const bars=svgs.filter(s=>/rx="2"/.test(s)&&/stroke="var\(--ln\)"/.test(s)&&!/<circle/.test(s));ok(bars.length>=2,'found '+bars.length+' bar charts (by year and by month)');
const hero=bars[0],mon=bars[1];const nb=s=>(s.match(/<g><title>/g)||[]).length;
const hl=[...hero.matchAll(labelRe)].map(m=>m[1]);ok(hl.length==nb(hero)&&hl.every(x=>/^[\d\s\u00a0,]+М?$/.test(x)),'year chart: total label on every bar ('+hl.length+'/'+nb(hero)+'): '+hl.join(' | '));
const inner=(hero.match(/style="fill:var\(--on,#fff\)">/g)||[]).length;ok(inner>0,'year chart: coupon amounts inside bars ('+inner+')');
const nz=(s,st)=>[...s.matchAll(/<title>[^:]*: купоны ([\d\s\u00a0]+) ₽, погашения ([\d\s\u00a0]+) ₽/g)].filter((m,i)=>i%st==0&&(+m[1].replace(/\D/g,'')+(+m[2].replace(/\D/g,'')))>=1).length;const ml=[...mon.matchAll(labelRe)].map(m=>m[1]);ok(ml.length==nz(mon,1)&&!/NaN/.test(mon),'monthly chart (12 months): a label on every non-empty bar ('+ml.length+' of '+nb(mon)+' bars, '+(nb(mon)-ml.length)+' empty)');
// check the label value equals the sum of the bar tooltip
const t=hero.match(/<title>[^:]*: купоны ([\d\s\u00a0]+) ₽, погашения ([\d\s\u00a0]+) ₽/);const n=s=>+s.replace(/\D/g,'');const tot=(n(t[1])+n(t[2]))/1000;
ok(Math.abs(+hl[0].replace(/\s|\u00a0/g,'').replace(',','.').replace('М','')-tot)<.1+(/М/.test(hl[0])?tot*.01:0),'first label '+hl[0]+' equals tooltip total '+tot.toFixed(1));
// 60-month chart uses label thinning
A.setMON(60);A.build();const o2=els['out'].innerHTML,bars2=o2.split('<svg').slice(1).map(s=>s.slice(0,s.indexOf('</svg>'))).filter(s=>/rx="2"/.test(s)&&/stroke="var\(--ln\)"/.test(s)&&!/<circle/.test(s));const mon2=bars2[1];
const l2=[...mon2.matchAll(labelRe)].length;ok(nb(mon2)>=36&&l2==nz(mon2,3)&&l2<nb(mon2),'long monthly chart: every 3rd bar labelled to avoid overlap ('+l2+' of '+nb(mon2)+' bars)');
// history last-value label
A.savePlan();const it=A.PLANget().items;it[0].got=3;const d=['2026-10-20','2026-10-21','2026-10-22'];const H={d,p:{},y:{}};it.forEach(x=>{H.p[x.n]=[x.p-1,x.p,x.p+.5];H.y[x.n]=[15,15.2,null]});A.setHist(H);A.drawPlan();
els['hsb'].value=it[0].n;els['hsb'].onchange();const hh=els['hh'].innerHTML;const last=[...hh.matchAll(labelRe)].map(m=>m[1]);ok(last.length==2&&last[0]==(it[0].p+.5).toFixed(1).replace('.',','),'history chart shows the last value: '+last.join(' | '));
// layout rules that prevent page-level horizontal scroll
ok(/main\{display:grid;grid-template-columns:minmax\(0,1fr\)/.test(html)&&/\.pn\{min-width:0\}/.test(html),'main column is minmax(0,1fr) and sections can shrink: wide tables scroll inside their own container only');
})().catch(e=>console.log('ERR',e.stack));
