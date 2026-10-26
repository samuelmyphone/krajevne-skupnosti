/* Language switch SLO / ITA.
   Bilingual texts are written as pairs; this script marks each half (data-l="sl" | "it")
   and CSS shows only the chosen language. Works on static pages, the dossier pages and
   content rendered later (MutationObserver). Patterns recognised:
   - explicit: <span data-l="sl">…</span><span data-l="it">…</span>
   - block pairs: <X>sl</X><X class="it|itl|sub|hsub">it</X>
   - inline pairs: "sl / <em>it</em>", "sl · <em>it</em>", "sl<br><em>it</em>", "sl <small>/ it</small>", nav "sl<small>it</small>"
   - text only: "sl / it" inside a leaf element, <option>, placeholder, aria-label, title */
(()=>{'use strict';
const KEY='ks-lang', D=document.documentElement;
let cur=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();
if(cur!=='sl'&&cur!=='it'){try{cur=localStorage.getItem(KEY)||'';}catch(_){cur='';}}
if(cur!=='sl'&&cur!=='it')cur='sl';
D.setAttribute('data-ui',cur);D.lang=cur;
const setTitle=l=>{const t=document.querySelector('title');if(t&&t.dataset[l])document.title=t.dataset[l];};
document.addEventListener('DOMContentLoaded',()=>setTitle(cur));
D.classList.add('js');const DARK=['noc','krasnoc'],SKINS=['kras','morje','teran','noc','krasnoc'];let skin='morje';try{skin=localStorage.getItem('ks-skin')||'morje';}catch(_){}if(!SKINS.includes(skin))skin='morje';
D.setAttribute('data-skin',skin);if(DARK.includes(skin))D.setAttribute('data-dark','');
const SKIP='script,style,textarea,input,select,.leaflet-container,.nol,svg,code';
const SEP_END=/(\s*(?:\/|·)\s*)$/;
const markEl=(el,l)=>{el.setAttribute('data-l',l);el.setAttribute('lang',l);};
function wrapNodes(nodes,l){if(!nodes.length)return;const s=document.createElement('span');markEl(s,l);nodes[0].before(s);nodes.forEach(n=>s.append(n));}
function sepSpan(txt){const s=document.createElement('span');s.className='lsep';s.textContent=txt;return s;}
const marked=n=>n.nodeType===1&&(n.hasAttribute('data-l')||n.classList.contains('lsep'));
function blocks(root){
  root.querySelectorAll('.it,.itl,.sub,.hsub,.ttl > p').forEach(el=>{
    if(el.hasAttribute('data-l')||el.closest('[data-l]')||el.closest(SKIP)||el.classList.contains('pit'))return;
    let prev=el.previousElementSibling;
    if(el.classList.contains('sub')||el.classList.contains('hsub')){if(!prev||!/^H[1-3]$/.test(prev.tagName))return;}
    if(!prev||prev.hasAttribute('data-l'))return;
    markEl(el,'it');markEl(prev,'sl');
  });
}
function inline(root){
  root.querySelectorAll('em,small').forEach(el=>{
    if(el.hasAttribute('data-l')||el.closest(SKIP)||el.parentElement.closest('[data-l]'))return;
    const par=el.parentElement;
    // separator
    let sepNode=null, sepTxt='', p=el.previousSibling;
    while(p&&p.nodeType===3&&!p.textContent.trim()&&p.previousSibling)p=p.previousSibling;
    const lead=el.firstChild&&el.firstChild.nodeType===3?el.firstChild.textContent.match(/^\s*\/\s*/):null;
    if(p&&p.nodeType===1&&p.tagName==='BR'){sepNode=p;}
    else if(p&&p.nodeType===3&&SEP_END.test(p.textContent)){const m=p.textContent.match(SEP_END);sepTxt=m[1];p.textContent=p.textContent.slice(0,-m[1].length);if(!p.textContent)p=p.previousSibling;}
    else if(lead){el.firstChild.textContent=el.firstChild.textContent.slice(lead[0].length);sepTxt=lead[0];}
    else if(el.tagName==='SMALL'&&par.closest('.nav,.subnav,.dd-menu,.brand,.village-buttons,.toolbar,.panel-head,.sidebar')){/* nav label pairs */}
    else if(el.tagName==='EM'&&par.tagName==='H2'&&par.closest('.village')){/* village heading: SL name + IT name */}
    else return;
    // collect SL nodes backwards
    const nodes=[];let n=sepNode?sepNode.previousSibling:(sepTxt&&!lead?p:el.previousSibling);
    if(lead)n=el.previousSibling;
    while(n){
      if(n.nodeType===1&&(n.tagName==='BR'||n.nodeName.toLowerCase()==='svg'||marked(n)||/^(P|DIV|UL|OL|LI|H\d|TABLE|SECTION|ARTICLE|HEADER|FOOTER|NAV|FIGURE|INPUT|SELECT|TEXTAREA|BUTTON|IMG)$/.test(n.tagName)))break;
      if(n.nodeType===3){const t=n.textContent;const m=t.match(/^([\s\S]*?(?:[:;·]|\)|–)\s+)(?=\S)/);
        if(nodes.length===0&&!t.trim()){n=n.previousSibling;continue;}
        // stop at ": " or "· " boundaries inside the text node (keep the tail as SL)
        const k=(sepNode||el.textContent.length>45)?-1:Math.max(t.lastIndexOf(': '),t.lastIndexOf('· '),t.lastIndexOf('; '));
        if(k>=0&&t.slice(k+2).trim()){const head=document.createTextNode(t.slice(0,k+2));n.textContent=t.slice(k+2);n.before(head);nodes.unshift(n);break;}
      }
      nodes.unshift(n);n=n.previousSibling;
    }
    if(!nodes.some(x=>x.textContent.trim()))return;
    const f=nodes[0];if(f&&f.nodeType===3){const m=f.textContent.match(/^(\s*\d[\d.,]*\s+)/);if(m){f.textContent=f.textContent.slice(m[1].length);f.before(document.createTextNode(m[1]));}}
    wrapNodes(nodes,'sl');markEl(el,'it');
    if(sepNode){sepNode.classList.add('lsep');}
    else if(sepTxt){el.before(sepSpan(sepTxt));}
  });
}
const PAIR=/^([^/]+?)\s+\/\s+([^/]+)$/;
function textOnly(root){
  root.querySelectorAll('a,span,b,strong,button,label,th,td,h2,h3,h4,p,li,summary,div,dt,dd,figcaption,option').forEach(el=>{
    if(el.hasAttribute('data-l')||el.dataset.sl||el.closest('[data-l]')||el.closest('script,style,textarea,.leaflet-container,.nol'))return;
    if(el.children.length||el.childNodes.length!==1||el.firstChild.nodeType!==3)return;
    const m=el.textContent.trim().match(PAIR);if(!m)return;
    if(el.tagName==='OPTION'){el.dataset.sl=m[1];el.dataset.it=m[2];return;}
    el.textContent='';const a=document.createElement('span'),b=document.createElement('span');a.textContent=m[1];b.textContent=m[2];markEl(a,'sl');markEl(b,'it');el.append(a,sepSpan(' / '),b);
  });
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el=>{
    ['placeholder','aria-label','title'].forEach(at=>{const v=el.getAttribute(at);if(!v||el.hasAttribute('data-'+at+'-sl'))return;const m=v.match(/^(.+?)\s+\/\s+(.+)$/);if(m){el.setAttribute('data-'+at+'-sl',m[1]);el.setAttribute('data-'+at+'-it',m[2]);}});
  });
}
function values(root){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const list=[];let n;
  while((n=w.nextNode())){const t=n.textContent;if(t.length>90||t.indexOf(' / ')<0)continue;const pe=n.parentElement;if(!pe||pe.closest('[data-l],script,style,textarea,option,.leaflet-container,.nol'))continue;
    const m=t.match(/^(\s*:\s*)([^/]+?)\s+\/\s+([^/]+?)(\s*)$/);if(m)list.push([n,m]);}
  list.forEach(([n,m])=>{const a=document.createElement('span'),b=document.createElement('span');a.textContent=m[2];b.textContent=m[3];markEl(a,'sl');markEl(b,'it');n.before(document.createTextNode(m[1]),a,sepSpan(' / '),b);if(m[4])n.before(document.createTextNode(m[4]));n.remove();});
}
function swap(root){
  (root.querySelectorAll?root:document).querySelectorAll('option[data-sl]').forEach(o=>{o.textContent=o.dataset[cur];});
  (root.querySelectorAll?root:document).querySelectorAll('[data-placeholder-sl],[data-aria-label-sl],[data-title-sl]').forEach(el=>{['placeholder','aria-label','title'].forEach(at=>{const v=el.getAttribute('data-'+at+'-'+cur);if(v)el.setAttribute(at,v);});});
}
let busy=false;
function apply(root){if(busy)return;busy=true;try{root=root||document.body;blocks(root);inline(root);textOnly(root);values(root);swap(root);}finally{busy=false;}}
function set(l){cur=l;D.setAttribute('data-ui',l);D.lang=l;setTitle(l);try{localStorage.setItem(KEY,l);}catch(_){}swap(document);
  document.querySelectorAll('[data-setlang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.setlang===l));
  dispatchEvent(new CustomEvent('ks-lang',{detail:l}));}
window.KSLANG={apply,set,get:()=>cur,t:(sl,it)=>`<span data-l="sl" lang="sl">${sl}</span><span data-l="it" lang="it">${it}</span>`};
function init(){
  apply(document.body);set(cur);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-setlang]');if(b)set(b.dataset.setlang);const k=e.target.closest('[data-setskin]');if(k){D.setAttribute('data-skin',k.dataset.setskin);D.toggleAttribute('data-dark',DARK.includes(k.dataset.setskin));try{localStorage.setItem('ks-skin',k.dataset.setskin);}catch(_){}document.querySelectorAll('[data-setskin]').forEach(x=>x.setAttribute('aria-pressed',x===k));}});
  document.querySelectorAll('[data-setskin]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.setskin===D.getAttribute('data-skin')));
  let q=null;new MutationObserver(ms=>{if(busy)return;ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1&&!n.closest('.leaflet-container'))(q=q||new Set()).add(n);}));
    if(q){const s=q;q=null;queueMicrotask(()=>s.forEach(n=>{if(n.isConnected){apply(n.parentElement||n);}}));}}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
