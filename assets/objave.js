/* Obvestila svetov / Avvisi dei Consigli: public lists, calendar page, .ics export. Needs live.js (window.SVET). */
(()=>{'use strict';
const S=window.SVET; if(!S)return;
const E=S.E;
const T=(sl,it)=>`<span data-l="sl" lang="sl">${sl}</span><span data-l="it" lang="it">${it}</span>`;
const VR={obvestilo:['Obvestilo','Avviso'],sestanek:['Seja sveta','Riunione del Consiglio'],zupan:['Sestanek z županom','Riunione col Sindaco'],skupscina:['Zbor krajanov','Assemblea pubblica'],dogodek:['Dogodek','Evento'],dela:['Dela, zapore','Lavori, chiusure']};
const MS=['jan','feb','mar','apr','maj','jun','jul','avg','sep','okt','nov','dec'],MI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const MSL=['januar','februar','marec','april','maj','junij','julij','avgust','september','oktober','november','december'],MIT=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const CONS=window.KS_CONS||{};   // {a:{sl,it,slug}}
const pr=(o)=>String(o).padStart(2,'0');
function tm(d){return pr(d.getHours())+'.'+pr(d.getMinutes());}
function hasTime(d){return d.getHours()||d.getMinutes();}
function when(o){
  if(!o.zacetek)return '';
  const a=new Date(o.zacetek),b=o.konec?new Date(o.konec):null;
  let sl=`${a.getDate()}. ${a.getMonth()+1}. ${a.getFullYear()}`,it=`${pr(a.getDate())}/${pr(a.getMonth()+1)}/${a.getFullYear()}`;
  if(hasTime(a)){sl+=`, ob ${tm(a)}`;it+=`, ore ${tm(a)}`;}
  if(b){const same=b.toDateString()===a.toDateString();
    if(same&&hasTime(b)){sl+=`–${tm(b)}`;it+=`–${tm(b)}`;}
    else if(!same){sl+=` – ${b.getDate()}. ${b.getMonth()+1}. ${b.getFullYear()}`;it+=` – ${pr(b.getDate())}/${pr(b.getMonth()+1)}/${b.getFullYear()}`;}}
  return T(sl,it);
}
function fileUrl(p){return S.CFG.url+'/storage/v1/object/public/objave/'+p.split('/').map(encodeURIComponent).join('/');}
function root(){const s=document.querySelector('script[src*="assets/objave.js"]');return s?s.getAttribute('src').replace(/assets\/objave\.js.*$/,''):'';}
/* ---------- .ics ---------- */
function icsDate(d){return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
function icsEsc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);}
function ics(list){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Krajevne skupnosti Dolina//SL','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const o of list){ if(!o.zacetek)continue;
    const a=new Date(o.zacetek),b=o.konec?new Date(o.konec):new Date(a.getTime()+(hasTime(a)?7200e3:864e5));
    L.push('BEGIN:VEVENT','UID:'+o.id+'@krajevne-skupnosti','DTSTAMP:'+icsDate(new Date()),'DTSTART:'+icsDate(a),'DTEND:'+icsDate(b),
      'SUMMARY:'+icsEsc(o.naslov_sl+(o.naslov_it?' / '+o.naslov_it:'')),
      'DESCRIPTION:'+icsEsc([o.besedilo_sl,o.besedilo_it].filter(Boolean).join('\n\n')),
      ...(o.kraj?['LOCATION:'+icsEsc(o.kraj)]:[]),'END:VEVENT');}
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function gcal(o){const a=new Date(o.zacetek),b=o.konec?new Date(o.konec):new Date(a.getTime()+(hasTime(a)?7200e3:864e5));
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(o.naslov_sl+(o.naslov_it?' / '+o.naslov_it:''))+'&dates='+icsDate(a)+'/'+icsDate(b)+'&location='+encodeURIComponent(o.kraj||'')+'&details='+encodeURIComponent([o.besedilo_sl,o.besedilo_it].filter(Boolean).join('\n\n'));}
/* ---------- card ---------- */
let CACHE={};
function card(o,opt={}){
  const v=VR[o.vrsta]||VR.obvestilo, d=o.zacetek?new Date(o.zacetek):new Date(o.created_at), c=o.consiglio_id?CONS[o.consiglio_id]:null;
  const past=o.zacetek&&new Date(o.konec||o.zacetek)<new Date(new Date().toDateString());
  const it=o.naslov_it||o.naslov_sl, bit=o.besedilo_it||o.besedilo_sl||'';
  const files=(o.priloge||[]).map(p=>`<a href="${E(fileUrl(p))}" target="_blank" rel="noopener">📎 ${E(p.split('/').pop().replace(/^\d+-/,''))}</a>`).join('');
  CACHE[o.id]=o;
  return `<article class="obj${past?' past':''}" data-v="${E(o.vrsta)}">
  <div class="obj-d"><b>${d.getDate()}</b><span>${T(MS[d.getMonth()],MI[d.getMonth()])}</span></div>
  <div class="obj-b">
   <p class="obj-m"><span class="obj-v">${T(v[0],v[1])}</span>${opt.showSvet!==false?(c?`<a href="${root()}sveti/${E(c.slug)}/">${T(E(c.ssl||c.sl),E(c.sit||c.it))}</a>`:`<span>${T('Vsi sveti','Tutti i Consigli')}</span>`):''}</p>
   <h3>${T(E(o.naslov_sl),E(it))}</h3>
   ${o.zacetek?`<p class="obj-w">${when(o)}${o.kraj?` · ${E(o.kraj)}`:''}</p>`:(o.kraj?`<p class="obj-w">${E(o.kraj)}</p>`:'')}
   ${(o.besedilo_sl||bit)?`<div class="obj-t">${T(E(o.besedilo_sl||'').replace(/\n/g,'<br>'),E(bit).replace(/\n/g,'<br>'))}</div>`:''}
   <p class="obj-a">${files}${/^https?:\/\//i.test(o.povezava||'')?`<a href="${E(o.povezava)}" target="_blank" rel="noopener">${T('Več','Dettagli')} ↗</a>`:''}${o.zacetek&&!past?`<button type="button" class="obj-ics" data-id="${E(o.id)}">${T('Dodaj v koledar','Aggiungi al calendario')}</button><a href="${E(gcal(o))}" target="_blank" rel="noopener">Google ${T('Koledar','Calendar')} ↗</a>`:''}</p>
  </div></article>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('.obj-ics');if(!b)return;const o=CACHE[b.dataset.id];if(o)download('obvestilo-'+(o.zacetek||'').slice(0,10)+'.ics',ics([o]));});
/* ---------- data ---------- */
async function load({svet=null,from=null,to=null,limit=50,asc=true}={}){
  const c=await S.getClient(); if(!c)return {data:[],error:'off'};
  let q=c.from('objave').select('*').eq('objavljeno',true);
  const F=from?`or(zacetek.gte."${from}",konec.gte."${from}",and(zacetek.is.null,created_at.gte."${new Date(Date.now()-30*864e5).toISOString()}"))`:null;
  if(svet&&F)q=q.or(`and(consiglio_id.eq.${svet},${F}),and(consiglio_id.is.null,${F})`);
  else if(svet)q=q.or(`consiglio_id.eq.${svet},consiglio_id.is.null`);
  else if(F)q=q.or(F.slice(3,-1));
  if(to)q=q.lt('zacetek',to);
  q=q.order('zacetek',{ascending:asc,nullsFirst:false}).order('created_at',{ascending:false}).limit(limit);
  const {data,error}=await q; return {data:data||[],error};
}
const today=()=>new Date(new Date().toDateString()).toISOString();
/* list of upcoming notices (home, council page) */
async function mount(el,{svet=null,limit=6,empty=null,showSvet=true}={}){
  if(!el)return;
  if(!S.ready()){el.innerHTML='';return;}
  el.innerHTML=`<p class="empty">${T('Nalagam …','Caricamento …')}</p>`;
  const {data,error}=await load({svet,from:today(),limit});
  if(error){el.innerHTML=`<p class="empty">${T('Obvestil trenutno ni mogoče naložiti.','Non è stato possibile caricare gli avvisi.')} <button type="button" class="btn ghost small obj-retry">${T('Poskusi znova','Riprova')}</button></p>`;el.querySelector('.obj-retry').onclick=()=>mount(el,{svet,limit,empty,showSvet});return;}
  el.innerHTML=data.length?data.map(o=>card(o,{showSvet})).join(''):(empty||`<p class="empty">${T('Trenutno ni napovedanih sej ali obvestil.','Al momento non ci sono riunioni o avvisi in programma.')}</p>`);
  const n=el.closest('section')?.querySelector('[data-obj-count]'); if(n)n.textContent=data.length;
}
/* calendar page */
async function calendar(el){
  if(!el)return;
  const sel=document.getElementById('kal-svet'),arch=document.getElementById('kal-arhiv'),dl=document.getElementById('kal-ics');
  let last=[];
  async function draw(){
    el.innerHTML=`<p class="empty">${T('Nalagam …','Caricamento …')}</p>`;
    const svet=sel.value||null, a=arch.checked;
    const {data,error}=a?await load({svet,limit:200,asc:false}):await load({svet,from:today(),limit:200});
    if(error){el.innerHTML=`<p class="empty">${T('Podatkov trenutno ni mogoče naložiti.','Dati non disponibili al momento.')} <button type="button" class="btn ghost small obj-retry">${T('Poskusi znova','Riprova')}</button></p>`;el.querySelector('.obj-retry').onclick=draw;return;}
    last=data; if(!data.length){el.innerHTML=`<p class="empty">${T('Ni obvestil.','Nessun avviso.')}</p>`;return;}
    const g={};data.forEach(o=>{const d=new Date(o.zacetek||o.created_at);const k=d.getFullYear()+'-'+pr(d.getMonth()+1);(g[k]=g[k]||[]).push(o);});
    el.innerHTML=Object.keys(g).map(k=>{const [y,m]=k.split('-').map(Number);return `<h2 class="h kal-m">${T(MSL[m-1]+' '+y,MIT[m-1]+' '+y)}</h2><div class="obj-l">${g[k].map(o=>card(o)).join('')}</div>`;}).join('');
  }
  sel.addEventListener('change',draw);arch.addEventListener('change',draw);
  dl.addEventListener('click',()=>{const ev=last.filter(o=>o.zacetek);if(ev.length)download('krajevne-skupnosti-koledar.ics',ics(ev));});
  const h=new URLSearchParams(location.search).get('svet'); if(h&&[...sel.options].some(o=>o.value===h))sel.value=h;
  draw();
}

/* activity badges on council cards (home) */
async function badges(){
  const els=[...document.querySelectorAll('[data-act]')]; if(!els.length||!S.ready())return;
  const c=await S.getClient(); if(!c)return;
  const now=Date.now(), d14=new Date(now-14*864e5).toISOString(), d30=new Date(now-30*864e5).toISOString(), t0=today();
  const [ob,pr]=await Promise.all([
    c.from('objave').select('consiglio_id,vrsta,zacetek,konec,created_at').eq('objavljeno',true).or(`zacetek.gte."${t0}",konec.gte."${t0}",created_at.gte."${d14}"`).order('zacetek',{ascending:true,nullsFirst:false}).limit(200),
    c.from('prijave').select('consiglio_id,created_at').eq('status','objavljeno').gte('created_at',d30).limit(500)]);
  const A={};
  const g=k=>A[k]=A[k]||{ev:null,nov:0,pr:0};
  for(const o of (ob.data||[])){ const ks=o.consiglio_id?[o.consiglio_id]:els.map(e=>e.dataset.act);
    for(const k of ks){const a=g(k);
      if(o.zacetek&&new Date(o.konec||o.zacetek)>=new Date(t0)&&o.vrsta!=='obvestilo'){ if(!a.ev||new Date(o.zacetek)<new Date(a.ev.zacetek))a.ev=o; }
      else if(new Date(o.created_at)>=new Date(d14))a.nov++; } }
  for(const p of (pr.data||[])) g(p.consiglio_id).pr++;
  const EV={sestanek:['Seja','Riunione'],zupan:['Sestanek z županom','Riunione col Sindaco'],skupscina:['Zbor krajanov','Assemblea'],dogodek:['Dogodek','Evento'],dela:['Dela','Lavori']};
  const pl=(n,one,two,few,many)=>n===1?one:n===2?two:(n%100>=3&&n%100<=4)?few:many;
  for(const e of els){const a=A[e.dataset.act]; if(!a)continue; const parts=[];
    if(a.ev){const d=new Date(a.ev.zacetek),v=EV[a.ev.vrsta]||EV.dogodek; parts.push(T(`${v[0]} ${d.getDate()}. ${d.getMonth()+1}.`,`${v[1]} ${pr2(d.getDate())}/${pr2(d.getMonth()+1)}`));}
    if(a.nov)parts.push(T(`${a.nov} ${pl(a.nov,'novo obvestilo','novi obvestili','nova obvestila','novih obvestil')}`,`${a.nov} ${a.nov===1?'nuovo avviso':'nuovi avvisi'}`));
    if(a.pr)parts.push(T(`${a.pr} ${pl(a.pr,'nova prijava','novi prijavi','nove prijave','novih prijav')}`,`${a.pr} ${a.pr===1?'nuova segnalazione':'nuove segnalazioni'}`));
    if(parts.length){e.innerHTML='<i aria-hidden="true"></i>'+parts.join('<br>');e.hidden=false;}
  }
}
function pr2(n){return String(n).padStart(2,'0');}

/* "my village": remembered without registration (localStorage only) */
async function mojaVas(el){
  if(!el)return; let id=null; try{id=localStorage.getItem('ks-svet');}catch(e){}
  const c=id&&CONS[id]; if(!c)return;
  el.innerHTML=`<div><small>${T('Vaša krajevna skupnost','La vostra frazione')}</small><b>${T(E(c.ssl||c.sl),E(c.sit||c.it))}</b><span data-mv-n></span></div><a class="btn small" href="${root()}sveti/${E(c.slug)}/">${T('Novosti','Novità')} →</a><button type="button" class="mv-x" aria-label="${'Pozabi / Dimentica'}" title="Pozabi / Dimentica">×</button>`;
  el.hidden=false;
  el.querySelector('.mv-x').onclick=()=>{try{localStorage.removeItem('ks-svet');}catch(e){} el.hidden=true;};
  const {data,error}=await load({svet:id,from:today(),limit:20}); const n=el.querySelector('[data-mv-n]');
  if(!error&&n)n.innerHTML=data.length?T(` · napovedana obvestila: ${data.length}`,` · avvisi in programma: ${data.length}`):'';
}

/* resolved reports ("results") */
async function rezultati(el){
  if(!el||!S.ready())return; const c=await S.getClient(); if(!c)return;
  const {data,error}=await c.from('prijave').select('id,created_at,updated_at,consiglio_id,vas,vrsta,kategorija,kje,opis,predlog,resnost,fotografije,napredek,odgovor,oznaka').eq('status','objavljeno').eq('napredek','reseno').order('updated_at',{ascending:false}).limit(6);
  if(error){el.innerHTML=`<p class="empty">${T('Podatkov trenutno ni mogoče naložiti.','Dati non disponibili al momento.')}</p>`;return;}
  if(!data.length){el.closest('section')?.classList.add('is-empty');el.innerHTML='';return;}
  el.innerHTML=data.map(S.card).join('');
}
window.OBJAVE={mount,calendar,card,load,ics,VR,fileUrl,badges,mojaVas,rezultati};
})();
