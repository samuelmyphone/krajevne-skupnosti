/* Iz občine / Dal Comune — voci dell'albo pretorio e notizie del Comune, aggiornate ogni notte (assets/comune.json). */
(()=>{'use strict';
const T=(sl,it)=>`<span data-l="sl" lang="sl">${sl}</span><span data-l="it" lang="it">${it}</span>`;
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CAT={viabilita:['Promet in zapore','Viabilità e limitazioni'],lavori:['Javna dela in projekti','Lavori e progetti'],prilike:['Prispevki in prijave','Contributi e domande'],
  avvisi:['Druga obvestila','Altri avvisi'],bp:['Participativni proračun','Bilancio partecipativo'],eventi:['Dogodki','Eventi']};
const FASE={affidamento:['oddaja del','affidamento'],progetto:['projekt / smernice','progetto / indirizzi'],concluso:['zaključeno','concluso']};
const fmt=d=>{if(!d)return'';const[y,m,g]=d.split('-');return `${+g}. ${+m}. ${y}`;};
const today=()=>new Date().toISOString().slice(0,10);
const base=()=>{const s=document.currentScript||[...document.scripts].find(x=>/comune\.js/.test(x.src));return s?s.src.replace(/assets\/comune\.js.*$/,''):'';};
const BASE=base();
let DATA=null;
async function load(){
  if(DATA)return DATA;
  const r=await fetch(BASE+'assets/comune.json',{cache:'no-cache'});
  if(!r.ok)throw new Error(r.status);
  DATA=await r.json();
  const t=today();
  DATA.items=[...(DATA.albo||[]).filter(x=>!x.until||x.until>=t),...(DATA.rss||[])].sort((a,b)=>b.date.localeCompare(a.date));
  return DATA;
}
const myId=()=>{try{return localStorage.getItem('ks-svet')||'';}catch(_){return'';}};
function vasLabel(ids){
  const C=window.KS_CONS||{};
  if(!ids||!ids.length)return T('Vsa občina','Tutto il Comune');
  return ids.map(i=>C[i]?T(esc(C[i].ssl),esc(C[i].sit)):i).join(', ');
}
let UID=0;
function card(x,opt={}){
  const c=CAT[x.cat]||CAT.avvisi, id='cm'+(++UID);
  const sl=x.sl||x.it, it=x.it||x.sl, sx=x.sint;
  const head=sx?T(esc(sx.h_sl),esc(sx.h_it)):T(esc(sl),esc(it));
  const why=sx&&(sx.m_sl||sx.m_it)?`<p class="cm-why">${T(esc(sx.m_sl||sx.m_it),esc(sx.m_it||sx.m_sl))}</p>`:'';
  const ref=x.src==='albo'?`${x.tipo_it} n. ${x.num}`:'';
  const doc=x.src==='albo'?`<b>${T(esc(x.tipo_sl),esc(x.tipo_it))} ${x.num?T('št.','n.')+' '+esc(x.num):''}</b>`:T('Novica na spletni strani Občine','Notizia sul sito del Comune');
  const fase=x.fase&&FASE[x.fase]?`<span class="cm-fase">${T(FASE[x.fase][0],FASE[x.fase][1])}</span>`:'';
  const det=x.src==='albo'?`<details class="cm-det"><summary>${T('Podrobnosti','Dettagli')}</summary>
   ${sx?`<p class="cm-full">${T(esc(sl),esc(it))}</p>`:''}
   <dl><dt>${T('Akt','Atto')}</dt><dd>${T(esc(x.tipo_sl),esc(x.tipo_it))} ${esc(x.num)} · ${T('vrsta na oglasni deski','tipologia all’albo')}: ${esc(x.tipologia||x.tipo_it)}</dd>
   <dt>${T('Na oglasni deski','All’albo pretorio')}</dt><dd>${T('od','dal')} ${fmt(x.date)} ${T('do','al')} ${fmt(x.until)} <small>(${T('obdobje objave, ne trajanje ukrepa','periodo di pubblicazione, non durata del provvedimento')})</small></dd></dl>
   <p class="cm-how">${T('Dokler je objavljen, akt poiščete na oglasni deski Občine po vrsti in številki; kopija besedila ostane tu tudi pozneje.','Finché è pubblicato, cercate l’atto nell’albo del Comune per tipologia e numero; una copia del testo resta qui anche dopo.')}
   <button type="button" class="cm-copy" data-ref="${esc(ref)}">${T('Kopiraj oznako','Copia riferimento')}</button></p></details>`:'';
  const link=x.src==='albo'?T('Oglasna deska Občine','Albo pretorio del Comune'):T('Odpri novico','Apri la notizia');
  const arh=(x.pdf?` · <a href="${BASE}${esc(x.pdf)}" target="_blank" rel="noopener">${T('Akt (PDF)','Atto (PDF)')}</a>`:'')+(x.txt&&!x.pdf?` · <a href="${BASE}${esc(x.txt)}" target="_blank" rel="noopener">${T('Besedilo akta','Testo dell’atto')}</a>`:'');
  return `<article class="cm-item cm-${x.cat}" id="${id}">
 <div class="cm-top"><span class="cm-chip">${T(c[0],c[1])}</span>${fase}${opt.showVas===false?'':`<span class="cm-vas">${vasLabel(x.svet)}</span>`}<time datetime="${x.date}" title="${x.src==='albo'?'Objava / Pubblicazione':''}">${fmt(x.date)}</time></div>
 <p class="cm-t">${head}</p>${why}
 <p class="cm-meta">${doc} · <a href="${esc(x.url)}" target="_blank" rel="noopener">${link} ↗</a>${arh}</p>${det}
</article>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('.cm-copy');if(!b)return;const r=b.dataset.ref;
  const ok=()=>{b.classList.add('ok');setTimeout(()=>b.classList.remove('ok'),1600);};
  if(navigator.clipboard)navigator.clipboard.writeText(r).then(ok,()=>prompt('',r));else prompt('',r);});
function empty(msg){return `<p class="cm-empty">${msg}</p>`;}
function errBox(el,fn){el.innerHTML=`<p class="cm-empty">${T('Podatkov Občine trenutno ni mogoče naložiti.','Al momento non è possibile caricare i dati del Comune.')} <button type="button" class="btn ghost sm">${T('Poskusi znova','Riprova')}</button></p>`;el.querySelector('button').onclick=fn;}
function stamp(d){const s=d.stato||{};const a=(s.albo||{}).aggiornato||(s.rss||{}).aggiornato;return a?`<p class="cm-stamp">${T('Samodejno posodobljeno','Aggiornato automaticamente il')} ${fmt(a)} · ${T('vir','fonte')}: ${T('Občina Dolina','Comune di San Dorligo della Valle')}</p>`:'';}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const hay=x=>norm([x.it,x.sl,x.num,x.tipo_it,x.tipo_sl,x.sint&&x.sint.h_it,x.sint&&x.sint.h_sl,(x.svet||[]).map(i=>{const c=(window.KS_CONS||{})[i];return c?c.ssl+' '+c.sit+' '+c.sl+' '+c.it:''}).join(' ')].join(' '));

/* Home e pagina "Vsi akti": filtri per zona e categoria, ricerca */
async function home(el,opt={}){
  try{const d=await load();
    const full=!!opt.full, lim=full?999:(opt.limit||6), recent=new Date(Date.now()-75*864e5).toISOString().slice(0,10);
    const all=d.items.filter(x=>x.cat!=='eventi'&&(x.src==='albo'||x.date>=recent));
    const C=window.KS_CONS||{}; const me=myId();
    const qs=new URLSearchParams(location.search);
    let zona=qs.get('svet')||(me&&C[me]?'moja':'vse'), cur=qs.get('cat')||'vse', q='';
    const inZona=x=>zona==='vse'?true:zona==='moja'?((x.svet||[]).includes(me)||!(x.svet||[]).length):(x.svet||[]).includes(zona);
    const draw=()=>{
      const Z=all.filter(inZona).filter(x=>!q||hay(x).includes(norm(q)));
      const cats=['vse','viabilita','lavori','prilike','bp','avvisi'].filter(k=>k==='vse'||Z.some(x=>x.cat===k));
      if(!cats.includes(cur))cur='vse';
      const L=Z.filter(x=>cur==='vse'||x.cat===cur), shown=L.slice(0,lim);
      const zb=(k,lab)=>`<button type="button" aria-pressed="${k===zona}" data-z="${k}">${lab}</button>`;
      const zone=full?`<select class="cm-zsel" aria-label="Krajevna skupnost / Frazione"><option value="vse"${zona==='vse'?' selected':''} data-sl="Vsa občina" data-it="Tutto il Comune">Vsa občina</option>${me&&C[me]?`<option value="moja"${zona==='moja'?' selected':''} data-sl="Moja krajevna skupnost" data-it="La mia frazione">Moja krajevna skupnost</option>`:''}${Object.entries(C).map(([k,c])=>`<option value="${k}"${zona===k?' selected':''} data-sl="${k}) ${esc(c.ssl)}" data-it="${k}) ${esc(c.sit)}">${k}) ${esc(c.ssl)}</option>`).join('')}</select>`
        :(me&&C[me]?`<div class="cm-zone">${zb('moja',T('Moja krajevna skupnost','La mia frazione')+' · '+T(esc(C[me].ssl),esc(C[me].sit)))}${zb('vse',T('Vsa občina','Tutto il Comune'))}</div>`:'');
      el.innerHTML=`<div class="cm-bar">${zone}${full?`<input type="search" class="cm-q" value="${esc(q)}" placeholder="Iščite: cesta, vas, tema ali številka akta / Cerca strada, località, argomento o numero atto" aria-label="Iskanje / Cerca">`:''}</div>
<div class="cm-filt" role="tablist">${cats.map(k=>{const n=k==='vse'?Z.length:Z.filter(x=>x.cat===k).length;return `<button type="button" role="tab" aria-selected="${k===cur}" data-k="${k}">${k==='vse'?T('Vse','Tutto'):T(CAT[k][0],CAT[k][1])} <span class="n">${n}</span></button>`;}).join('')}</div>
<div class="cm-list">${shown.map(x=>card(x,{})).join('')||empty(T('Ni zadetkov.','Nessun risultato.'))}</div>
${!full&&L.length>lim?`<p class="cm-all"><a class="btn ghost sm" href="${BASE}obcina.html${zona!=='vse'&&zona!=='moja'?'?svet='+zona:''}">${T('Vsi akti in novice Občine','Tutti gli atti e le notizie del Comune')} (${L.length}) →</a></p>`:''}${stamp(d)}`;
      el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{cur=b.dataset.k;draw();});
      el.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{zona=b.dataset.z;draw();});
      const zs=el.querySelector('.cm-zsel');if(zs)zs.onchange=()=>{zona=zs.value;draw();};
      const qi=el.querySelector('.cm-q');if(qi)qi.oninput=()=>{q=qi.value;const pos=qi.selectionStart;draw();const n=el.querySelector('.cm-q');n.focus();n.setSelectionRange(pos,pos);};
    };
    draw();
  }catch(e){errBox(el,()=>home(el,opt));}
}
/* Pagina della frazione: solo i gruppi con contenuti */
async function svet(el,id){
  try{const d=await load();
    const mine=d.items.filter(x=>(x.svet||[]).includes(id)&&x.cat!=='eventi');
    const gen=d.items.filter(x=>(!x.svet||!x.svet.length)&&x.cat==='prilike');
    const G=[['Promet in zapore','Viabilità e limitazioni',mine.filter(x=>x.cat==='viabilita')],
      ['Javna dela in projekti','Lavori e progetti',mine.filter(x=>x.cat==='lavori'||x.cat==='bp')],
      ['Prispevki in prijave za vse','Contributi e domande per tutti',gen.slice(0,4)],
      ['Druga obvestila','Altri avvisi',mine.filter(x=>x.cat==='avvisi'||x.cat==='prilike')]].filter(g=>g[2].length);
    el.innerHTML=(G.length?`<div class="cm-grps">${G.map(g=>`<section class="cm-grp"><h3>${T(g[0],g[1])} <span class="n">${g[2].length}</span></h3><div class="cm-list">${g[2].map(x=>card(x,{showVas:false})).join('')}</div></section>`).join('')}</div>`
      :empty(T('Trenutno ni odredb, del ali obvestil Občine za te vasi.','Al momento nessuna ordinanza, lavoro o avviso del Comune per queste località.')))
      +`<p class="cm-all"><a href="${BASE}obcina.html?svet=${id}">${T('Vsi akti in novice Občine','Tutti gli atti e le notizie del Comune')} →</a></p>`+stamp(d);
  }catch(e){errBox(el,()=>svet(el,id));}
}
/* Elenco per categoria (BP, eventi) */
async function list(el,opt={}){
  try{const d=await load();
    const since=opt.days?new Date(Date.now()-opt.days*864e5).toISOString().slice(0,10):'';
    const L=d.items.filter(x=>(opt.cats||[]).includes(x.cat)&&(!since||x.date>=since)).slice(0,opt.limit||10);
    el.innerHTML=(L.length?`<div class="cm-list">${L.map(x=>card(x,{})).join('')}</div>`:empty(opt.empty?T(opt.empty[0],opt.empty[1]):T('Trenutno nič.','Nulla al momento.')))+stamp(d);
    if(opt.bpLink)bpLink(d);
  }catch(e){errBox(el,()=>list(el,opt));}
}
/* Collega gli atti "progetto BP n. X" alla scheda del progetto (solo documentale, lo stato non cambia) */
function bpLink(d){
  (d.albo||[]).filter(x=>x.bp_n).forEach(x=>{
    const n=String(x.bp_n).padStart(2,'0');
    document.querySelectorAll('.num').forEach(s=>{
      if(s.textContent.trim()!==n+'/2025')return;
      const art=s.closest('article,details,.proj,li,div');if(!art||art.querySelector('.bp-akt[data-id="'+x.id+'"]'))return;
      const box=document.createElement('div');box.className='bp-akt';box.dataset.id=x.id;
      box.innerHTML=`<div><b>${T('Nov povezan akt Občine','Nuovo atto collegato del Comune')}</b> – ${T(esc(x.tipo_sl),esc(x.tipo_it))} ${esc(x.num)} (${fmt(x.date)})</div><div class="bp-akt-t">${T(esc(x.sl||x.it),esc(x.it))}</div><div><a href="${esc(x.url)}" target="_blank" rel="noopener">${T('Oglasna deska Občine','Albo pretorio del Comune')} ↗</a></div><small>${T('Stanje projekta se ne spremeni samodejno.','Lo stato del progetto non viene modificato automaticamente.')}</small>`;
      (art.querySelector('header')||art).insertAdjacentElement('afterend',box);
    });
  });
}
/* Riquadro stagionale: vegetazione lungo le strade e pericolo incendi */
const NO_FIRE=['e','g'];
function sezona(el,opt={}){
  const q=new URLSearchParams(location.search).get('sezona');
  const d=q?new Date(q):new Date(), md=(d.getMonth()+1)*100+d.getDate();
  const out=[];
  if(md>=501&&md<=930)out.push(`<article class="sz sz-veg"><h3>${T('Vejevje in živa meja ob cestah','Rami e siepi lungo le strade')}</h3>
<p>${T('Lastniki in uporabniki zemljišč ob cestah morajo redno obrezovati drevje, grmovje in živo mejo, da ne segajo na cestišče, ne zakrivajo prometnih znakov in ne ovirajo preglednosti.','Proprietari e conduttori dei terreni lungo le strade devono tagliare regolarmente alberi, arbusti e siepi che sporgono sulla carreggiata, coprono i segnali o riducono la visibilità.')}</p>
<p class="sz-src"><a href="https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285~art29" target="_blank" rel="noopener">${T('Cestni zakonik, 29. člen','Codice della strada, art. 29')} ↗</a></p></article>`);
  const fire=(md>=115&&md<=415)||(md>=615&&md<=930);
  if(fire&&!(opt.svet&&NO_FIRE.includes(opt.svet)))out.push(`<article class="sz sz-fire"><h3>${T('Požarna ogroženost na Krasu','Pericolo di incendi sul Carso')}</h3>
<p>${T('V tem obdobju je nevarnost požarov v naravi večja. Ne kurite na prostem in ne sežigajte rastlinskih odpadkov, kadar Dežela razglasi obdobje velike požarne ogroženosti. Požar takoj sporočite na številko 112.','In questo periodo il rischio di incendi boschivi è più alto. Non accendete fuochi all’aperto e non bruciate residui vegetali quando la Regione dichiara lo stato di grave pericolosità. Segnalate subito ogni incendio al 112.')}</p>
<p class="sz-src"><a href="https://www.protezionecivile.fvg.it" target="_blank" rel="noopener">${T('Civilna zaščita FJK','Protezione civile FVG')} ↗</a></p></article>`);
  if(!out.length){el.hidden=true;return;}
  el.hidden=false;el.innerHTML=out.join('');
}
/* Allerta meteo: banda in cima a ogni pagina finché l'allerta è valida */
const LV={yellow:['rumeno','gialla'],orange:['oranžno','arancione'],red:['rdeče','rossa']};
const dt=s=>{const d=new Date(s);if(d.getMinutes()===59)d.setMinutes(60);return `${d.getDate()}. ${d.getMonth()+1}., ${d.getHours()}.${String(d.getMinutes()).padStart(2,'0')}`;};
async function meteo(el){
  if(!el)return;
  try{const d=await load();const now=Date.now();
    const L=(d.meteo||[]).filter(x=>new Date(x.expires).getTime()>now);
    if(!L.length){el.hidden=true;return;}
    const top=L[0].level;
    el.className='meteo meteo-'+top;
    el.innerHTML=`<div class="meteo-in"><b>${T('Vremensko opozorilo','Allerta meteo')}</b> ${L.map(x=>`<span class="meteo-i"><i class="dot ${x.level}"></i>${T(`${esc(x.sl)} – ${LV[x.level][0]} opozorilo`,`${esc(x.it)} – allerta ${LV[x.level][1]}`)} · ${T('od','dal')} ${dt(x.onset)} ${T('do','al')} ${dt(x.expires)}</span>`).join('')}
 <span class="meteo-src"><a href="https://www.protezionecivile.fvg.it" target="_blank" rel="noopener">${T('Uradna obvestila: Civilna zaščita FJK','Avvisi ufficiali: Protezione civile FVG')} ↗</a> · ${T('vir','fonte')}: <a href="https://meteoalarm.org/en/live/region/IT?s=friuli" target="_blank" rel="noopener">MeteoAlarm</a></span></div>`;
    el.hidden=false;
  }catch(e){el.hidden=true;}
}
window.KS_COMUNE={load,home,svet,list,sezona,card,meteo,bpLink};
})();
