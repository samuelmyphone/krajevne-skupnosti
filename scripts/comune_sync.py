#!/usr/bin/env python3
"""Sincronizzazione (ogni 3 ore): allerte meteo, notizie (RSS) e albo pretorio del Comune di San Dorligo della Valle - Dolina.

Scrive assets/comune.json. Se una fonte non risponde o cambia forma, mantiene i dati precedenti
di quella fonte e termina con codice 1, così GitHub segnala l'errore via email.
"""
import json, re, sys, html, os, datetime, unicodedata, urllib.request
import xml.etree.ElementTree as ET

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'comune.json')
ENTE = '032004'
ALBO_URL = f'https://backoffice2-comuni.regione.fvg.it/albopretorio/atti/search/{ENTE}/6172/'
ALBO_PAGE = 'https://www.comune.san-dorligo-della-valle.ts.it/it/albo-pretorio-3612'
RSS = {'it': f'https://backoffice2-comuni.regione.fvg.it/feed/{ENTE}/it/',
       'sl': f'https://backoffice2-comuni.regione.fvg.it/feed/{ENTE}/sl/'}
UA = {'User-Agent': 'Mozilla/5.0 (cfks-dolina.org; sincronizzazione notizie)'}
TODAY = datetime.date.today()

# --- frazioni -------------------------------------------------------------------------------
SVETI = {
    'a': [r'DOLIN[AIEO]', r'KROGLJE', r'CROGOLE', r'SANCA'],
    'b': [r'BOLJUNC?E?C?', r'BOLJUNEC', r'BAGNOLI', r'GORNJI KONEC'],
    'c': [r'BORST', r"SANT.?ANTONIO IN BOSCO", r'HRVATI', r'HERVATI', r'ZABREZEC', r'MOCCO', r'JEZERO',
          r'SAN LORENZO', r'BOTAC', r'BOTAZZO', r'GROCANA', r'GROZZANA', r'DRAGA', r'PESEK'],
    'd': [r'RICMANJE', r'SAN GIUSEPPE DELLA CHIUSA', r'LOG'],
    'e': [r'DOMJO', r'DOMIO', r'PULJE', r'PUGLIE', r'LAKOTISCE', r'LACOTISCE', r'KRMENKA', r'MATTONAIA'],
    'f': [r'MACKOLJE', r'CARESANA', r'PREBENEG', r'KRIZPOT', r'CROCIATA', r"MONTE D.?ORO", r'MONT'],
    'g': [r'ZAVLJE', r'AQUILINIA', r'FRANKOVEC', r'FRANCOVEZ'],
}
# espressioni che contengono "Dolina" ma indicano il Comune intero o la Val Rosandra
COMUNE_RE = [r'SAN DORLIGO DELLA VALLE\s*[-–]?\s*DOLINA', r'OBCIN[AEI] DOLIN[AI]', r'OBCINSK\w* DOLIN\w*',
             r'DOLIN[AEI] GLINSCIC\w*', r'VAL ROSANDRA\s*[-–]?\s*', r'SAN DORLIGO DELLA VALLE', r'COMUNE DI SAN DORLIGO']


def norm(s):
    s = unicodedata.normalize('NFKD', s.upper())
    return ''.join(ch for ch in s if not unicodedata.combining(ch)).replace('’', "'")


def svet_of(text):
    t = norm(text)
    for p in COMUNE_RE:
        t = re.sub(p, ' ', t)
    out = []
    for sid, pats in SVETI.items():
        if any(re.search(r'\b' + p + r'\b', t) for p in pats):
            out.append(sid)
    return out


# --- privacy -------------------------------------------------------------------------------
def clean(s):
    s = html.unescape(s or '').replace('\r', '')
    s = re.sub(r'\s+', ' ', s).strip()
    # nessun nominativo di persone fisiche nei titoli
    s = re.sub(r"\b(SIG\.?(RA)?|SIGNOR[AE]?|RICHIEDENTE|G\.\s?|GOSP\w*)\s+[A-ZÀ-Ža-zà-ž'’]+(\s+[A-ZÀ-Ž][A-ZÀ-Ža-zà-ž'’]+)?", '…', s, flags=re.I)
    s = re.sub(r'\s*,?\s*(P\.?\s?IVA|C\.?F\.?)\s*[:n.]*\s*\d{8,16}', '', s, flags=re.I)
    return s


NOMI = ["San Dorligo della Valle", "Dolina", "Kroglje", "Crogole", "Boljunec", "Bagnoli della Rosandra", "Bagnoli Superiore",
        "Gornji konec", "Boršt", "Sant'Antonio in Bosco", "Hrvati", "Hervati", "Zabrežec", "Moccò", "Jezero", "San Lorenzo",
        "Botač", "Botazzo", "Gročana", "Grozzana", "Draga Sant'Elia", "Draga", "Pesek", "Ricmanje", "San Giuseppe della Chiusa",
        "Log", "Domjo", "Domio", "Pulje", "Puglie", "Lakotišče", "Lacotisce", "Krmenka", "Mattonaia", "Mačkolje", "Caresana",
        "Prebeneg", "Križpot", "Crociata", "Monte d'Oro", "Žavlje", "Aquilinia", "Frankovec", "Francovez", "Val Rosandra",
        "Glinščica", "Šanca", "Comune", "Občina", "Regione", "FVG", "TARI", "D.Lgs.", "LR", "Interreg", "Italia", "Slovenia"]


STEMS_SL = r"(dolin[iae]?|drag[ie]?|boršt\w*|boljun\w*|ricmanj\w*|mačkolj\w*|prebeneg\w*|žavlj\w*|frankov\w*|domj\w*|gročan\w*|pesk\w*|hrvat\w*|zabrež\w*|botač\w*|krogelj\w*|kroglj\w*|pulj\w*|krmenk\w*|križpot\w*|lakotišč\w*)"


def frase(s):
    """Titoli scritti tutti in maiuscolo -> maiuscola solo iniziale, nomi propri ripristinati."""
    letters = [c for c in s if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.7:
        return s
    t = s.replace('’', "'").lower()
    for n in sorted(NOMI, key=len, reverse=True):
        t = re.sub(r'(?<!\w)' + re.escape(n.lower()) + r'(?!\w)', n, t)
    # forme slovene declinate dopo preposizione (v dolini, v borštu…)
    t = re.sub(r'\b(v|na|iz|pri|do|med|za|k|proti) ' + STEMS_SL + r'\b', lambda m: m.group(1) + ' ' + m.group(2).capitalize(), t)
    t = re.sub(r'(\w{4,}[.!?] )([a-zà-ž])', lambda m: m.group(1) + m.group(2).upper(), t)
    t = t.replace("'", '’')
    return t[:1].upper() + t[1:]


def fetch(url, data=None, timeout=90):
    req = urllib.request.Request(url, data=data, headers=dict(UA, **({'Content-Type': 'application/json'} if data else {})))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# --- albo pretorio -------------------------------------------------------------------------
TIPI_SI = {'Ordinanze dirigenziali', 'Ordinanze sindacali', 'Deliberazioni giuntali', 'Determinazioni dirigenziali', 'Altri avvisi'}
ESCLUDI = re.compile(r'MATRIMONI|PERSONALE|ASSUNZION|STAFF|COLLABORATORE|AVVOCAT|PATROCINIO|TELEFONIA|FORMAZIONE|CORSO ON|'
                     r'VARIAZIONE AL BILANCIO|FLUSSI DI CASSA|CONCESSIONE IN USO|BARCOLANA|SCAMBIO TEATRALE|ALUNNI|PULIZIA|'
                     r'NOMINA DEL GRUPPO|INCENTIV|CAMBIO COGNOME|DECRETO DI|SCRUTATOR|RISARCIMENT|SINISTR|CONTENZIOS', re.I)
LAVORI = re.compile(r'LAVORI|MANUTENZION|REALIZZAZION|SISTEMAZION|RIQUALIFICAZION|ALLACCIAMENT|FONTANEL|CORS[OI] D.ACQUA|'
                    r'\bRIO\b|CENTRO .*RACCOLTA|CAMPO|ILLUMINAZION|MARCIAPIED|ASFALT|STRAD|PARCHEGG|BACHECH|PIAZZA|MESSA IN SICUREZZA', re.I)
AVVISI = re.compile(r'TARI\b|CONTRIBUT|RIDUZION|AGEVOLAZION|BANDO|RIFIUTI|ACQUA|ENERGIA|INTERRUZION', re.I)
VIAB = re.compile(r'VIABILIT|CIRCOLAZION|SOSTA|TRANSITO|PEDONAL|SENSO UNICO|DIVIETO', re.I)


LUOGHI = [("Sant'Antonio in Bosco", 'Boršt'), ('Bagnoli della Rosandra', 'Boljunec'), ('Bagnoli Superiore', 'Gornji konec'),
          ('San Giuseppe della Chiusa', 'Ricmanje'), ('Caresana', 'Mačkolje'), ('Aquilinia', 'Žavlje'), ('Francovez', 'Frankovec'),
          ('Grozzana', 'Gročana'), ('Hervati', 'Hrvati'), ('Moccò', 'Zabrežec'), ('Botazzo', 'Botač'), ('San Lorenzo', 'Jezero'),
          ('Domio', 'Domjo'), ('Puglie', 'Pulje'), ('Mattonaia', 'Krmenka'), ('Crogole', 'Kroglje'), ('Crociata', 'Križpot'),
          ('Prebeneg', 'Prebeneg'), ('Pesek', 'Pesek'), ('Draga', 'Draga'), ('Dolina', 'Dolina'), ('Log', 'Log')]


def sintesi(it, sl, tipo):
    """Titolo breve e motivo, solo da ciò che il titolo dice; None se non applicabile."""
    if not tipo.startswith('Ordinanz') or not VIAB.search(it):
        return None
    t = it.replace('’', "'")
    luogo = next(((a, b) for a, b in LUOGHI if re.search(r'\b' + re.escape(a) + r'\b', t, re.I)), None)
    civ = re.search(r'\bciv(?:ico|\.)?\s*(?:n\.\s*)?(\d+\w?)', t, re.I)
    tra = re.search(r'\btra (?:il )?civ(?:ico|\.)?\s*(?:n\.\s*)?(\d+\w?) e (?:il )?civ(?:ico|\.)?\s*(?:n\.\s*)?(\d+\w?)', t, re.I)
    if not luogo:
        return None
    pedon = re.search(r'percorso pedonal', t, re.I)
    cosa_it = 'percorso pedonale e limitazioni alla circolazione' if pedon else 'limitazioni alla circolazione'
    cosa_sl = 'pešpot in omejitev prometa' if pedon else 'omejitev prometa'
    if tra:
        head_it = f'{luogo[0]}, tra i civici {tra.group(1)} e {tra.group(2)}: {cosa_it}'
        head_sl = f'{luogo[1]}, med h. št. {tra.group(1)} in {tra.group(2)}: {cosa_sl}'
    else:
        head_it = luogo[0] + (f', presso il civ. {civ.group(1)}' if civ else '') + ': ' + cosa_it
        head_sl = luogo[1] + (f', pri h. št. {civ.group(1)}' if civ else '') + ': ' + cosa_sl
    m = re.search(r"\bper (?:consentire |permettere )?(?:i |il |la |le |gli |l['’])?(lavori .+|la .+|posa .+|.+)$", t, re.I)
    mot_it = m.group(1).strip(' .') if m else ''
    mot_it = re.sub(r'^(la|le|il|i|gli) ', '', mot_it, flags=re.I)
    ms = re.search(r'\b((?:zaradi|da se omogočijo) .+)$', sl or '', re.I)
    mot_sl = ms.group(1).strip(' .') if ms else ''
    cap = lambda x: x[:1].upper() + x[1:] if x else ''
    return dict(h_it=head_it, h_sl=head_sl, m_it=cap(mot_it), m_sl=cap(mot_sl))


def fase(raw):
    r = norm(raw)
    if re.search(r'AFFIDAMENTO|DECISIONE A CONTRARRE|DETERMINA(ZIONE)? A CONTRARRE|AGGIUDICAZION', r):
        return 'affidamento'
    if re.search(r'APPROVAZIONE DEL PROGETTO|PROGETTO (DI FATTIBILITA|ESECUTIVO|DEFINITIVO)|INDIRIZZI', r):
        return 'progetto'
    if re.search(r'COLLAUDO|REGOLARE ESECUZIONE|ULTIMAZIONE', r):
        return 'concluso'
    return ''


OPPORTUNITA = re.compile(r'CONTRIBUT|BANDO|RIDUZION|AGEVOLAZION|BENEFIC|ISCRIZION|RAZPIS|PRISPEV|OLAJSAV|ABBATTIMENTO RETTE|SOSTEGNO', re.I)


def split_lingue(t):
    """Titolo IT e SL sulla stessa riga: separa dove inizia la parte slovena.
    Candidati: confini di frase (". " seguito da maiuscola) che non seguono un'abbreviazione."""
    ABBR = re.compile(r'(?:\b(?:n|art|artt|c|cc|co|d|p|reg|lgs|dpr|l|lr|prot|civ|loc|fraz|s|ss|dott|ing|geom|arch|avv|sig|str|km|h|št|k|o)\.)$', re.I)
    pos = [m.end() for m in re.finditer(r'[.!?»"\)]\s+(?=[A-ZČŠŽ])', t)]
    for k in pos:
        a, b = t[:k].rstrip(), t[k:].strip()
        if ABBR.search(a) or len(a) < 15 or len(b) < 15:
            continue
        if lang_of(b) == 'sl' and lang_of(a) == 'it' and re.search(r'[čšž]|\b(za|na|in|med|pri|ki|je)\b', b, re.I) and not re.search(r'\b(per|della|del|di|con|dal|ai|degli|delle)\b', b, re.I):
            return [a, b]
    return [t]


def numero(x):
    n = x.get('numeroAtto') or ''
    m = re.search(r'n\s*\.?\s*0*(\d+)', n, re.I)
    anno = (x.get('dataInizioPubblicazione') or '')[:4]
    if m:
        return f'{m.group(1)}/{anno}'
    m = re.match(r'\s*0*(\d+)\s*$', n)
    return f'{m.group(1)}/{anno}' if m else ''


TIPO_SL = {'Ordinanze dirigenziali': ('Odredba', 'Ordinanza'), 'Ordinanze sindacali': ('Županova odredba', 'Ordinanza sindacale'),
           'Deliberazioni giuntali': ('Sklep odbora', 'Delibera di Giunta'), 'Determinazioni dirigenziali': ('Odločba', 'Determinazione'),
           'Altri avvisi': ('Obvestilo', 'Avviso')}


def albo():
    body = json.dumps({'ordinaAsc': 'false', 'dataA': TODAY.isoformat(), 'dataDa': (TODAY - datetime.timedelta(days=90)).isoformat(),
                       'numeroAtto': '', 'ricercaatti': '', 'numeroPagina': '1', 'risultatiPerPagina': 500, 'testo': '', 'oggetto': '',
                       'ufficioCompetente': '', 'tipo_ricerca': 'Richiesta_ricerca_atti', 'tipologia': '', 'ordinaPer': 'dataDa'}).encode()
    d = json.loads(fetch(ALBO_URL, body))
    atti = d['atto']
    if not isinstance(atti, list) or (atti and not all(k in atti[0] for k in ('oggetto', 'tipologia', 'dataFinePubblicazione'))):
        raise ValueError('forma dei dati dell\'albo cambiata')
    out = []
    for x in atti:
        tipo = x['tipologia']['descrizione']
        if tipo not in TIPI_SI:
            continue
        uff = (x.get('ufficioCompetente') or '').upper()
        if tipo == 'Altri avvisi' and ('PROTOCOLLO' in uff or 'MESSI' in uff):
            continue  # avvisi di terzi (gestori di rete, ministeri…)
        raw = html.unescape(x['oggetto'])
        parts = [p for p in raw.split('\r\n') if p.strip()]
        if len(parts) == 1:
            parts = split_lingue(parts[0])
        it_t, sl_t = frase(clean(parts[0])), frase(clean(parts[1])) if len(parts) > 1 else ''
        if ESCLUDI.search(raw):
            continue
        if 'BILANCIO PARTECIPATIVO' in norm(raw) or 'PARTICIPATIVN' in norm(raw):
            cat = 'bp'
        elif tipo.startswith('Ordinanze') and VIAB.search(raw):
            cat = 'viabilita'
        elif tipo in ('Deliberazioni giuntali', 'Determinazioni dirigenziali') and LAVORI.search(raw) and ('LAVORI' in uff or 'URBANISTICA' in uff or 'POLIZIA' in uff):
            cat = 'lavori'
        elif AVVISI.search(raw) or tipo.startswith('Ordinanze'):
            cat = 'avvisi'
        else:
            continue
        if cat == 'avvisi' and OPPORTUNITA.search(norm(raw)):
            cat = 'prilike'
        ts, ti = TIPO_SL.get(tipo, (tipo, tipo))
        d = dict(id='albo-' + x['id'], src='albo', cat=cat, tipo_sl=ts, tipo_it=ti, tipologia=tipo, num=numero(x),
                 it=it_t, sl=sl_t, date=x['dataInizioPubblicazione'][:10], until=x['dataFinePubblicazione'][:10],
                 svet=svet_of(raw), url=ALBO_PAGE)
        sx = sintesi(it_t, sl_t, tipo)
        if sx:
            d['sint'] = sx
        if cat in ('lavori', 'bp'):
            f = fase(raw)
            if f:
                d['fase'] = f
        m = re.search(r'BILANCIO PARTECIPATIVO N\.?\s*(\d+)', norm(raw))
        if m:
            d['bp_n'] = int(m.group(1))
        out.append(d)
    return out


# --- notizie (RSS) -------------------------------------------------------------------------
SL_WORDS = re.compile(r'\b(za|in|na|o|v|ki|ali|občin\w*|leto|razpis|obvestilo|dejavnosti|srečanje)\b', re.I)
IT_WORDS = re.compile(r'\b(di|per|il|la|del|della|e|nel|alla|avviso|bando|anno|con|come|dal|ai|degli|delle|dei|sensi)\b', re.I)
RSS_ESCLUDI = re.compile(r'staff del Sindaco|sodelavca v kabinetu|avvocati|odvetnik|tesoreria', re.I)
EVENTO = re.compile(r'concert|festival|serata|mostra|presentazion|spettacol|notti del vino|sagra|incontro|koncert|večer|razstav|'
                    r'predstavitev|prireditev|srečanje|laboratori|delavnic|evento|dogod', re.I)


NON_EVENTO = re.compile(r'manifestazione d\w*.?interesse|avviso pubblico|bando|razpis|operatori economici', re.I)


def lang_of(t):
    return 'sl' if len(SL_WORDS.findall(t)) > len(IT_WORDS.findall(t)) else 'it'


def rss():
    items = {}
    for lg, url in RSS.items():
        root = ET.fromstring(fetch(url))
        found = list(root.iter('item'))
        if not found:
            raise ValueError('feed RSS vuoto o cambiato')
        for i in found:
            link = i.findtext('link') or ''
            t = clean(i.findtext('title'))
            m = re.search(r'-(\d+)/?$', link)
            if not m or len(t) < 8 or RSS_ESCLUDI.search(t):
                continue
            pid = m.group(1)
            dt = datetime.datetime.strptime(i.findtext('pubDate')[:16], '%a, %d %b %Y').date()
            it = items.setdefault(pid, dict(id='rss-' + pid, src='rss', date=dt.isoformat(), url=link, titles={}))
            it['titles'][lang_of(t)] = t
    # unisce le coppie (stessa notizia pubblicata come due pagine, una per lingua)
    byday = {}
    for it in items.values():
        byday.setdefault(it['date'], []).append(it)
    out = []
    for day, lst in byday.items():
        lst.sort(key=lambda x: x['id'])
        used = set()
        for a in lst:
            if a['id'] in used:
                continue
            for b in lst:
                if b is a or b['id'] in used:
                    continue
                if set(a['titles']) ^ set(b['titles']) == {'it', 'sl'} and len(a['titles']) == 1 and len(b['titles']) == 1:
                    a['titles'].update(b['titles']); used.add(b['id']); break
            used.add(a['id'])
            ti = a['titles']
            itt, slt = ti.get('it') or ti.get('sl'), ti.get('sl') or ti.get('it')
            raw = f'{itt} {slt}'
            cat = 'eventi' if EVENTO.search(raw) and not NON_EVENTO.search(raw) else ('lavori' if LAVORI.search(raw) and not AVVISI.search(raw) else 'avvisi')
            if cat == 'avvisi' and OPPORTUNITA.search(norm(raw)):
                cat = 'prilike'
            out.append(dict(id=a['id'], src='rss', cat=cat, it=itt, sl=slt, date=day, until='', svet=svet_of(raw), url=a['url']))
    # doppioni: stessa notizia due volte nello stesso giorno -> tiene la versione bilingue
    out.sort(key=lambda x: (x['date'], x['it'] != x['sl']), reverse=True)
    seen, res = set(), []
    for x in out:
        k = (x['date'], norm(x['it'])[:60])
        if k in seen:
            continue
        seen.add(k); res.append(x)
    return res[:40]


# --- allerte meteo (MeteoAlarm, Friuli Venezia Giulia) -------------------------------------
METEO_FEED = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-italy'
METEO_AREA = 'IT020'  # Friuli Venezia Giulia
TIPI_METEO = {'1': ('Veter', 'Vento'), '2': ('Sneg in poledica', 'Neve e ghiaccio'), '3': ('Nevihte', 'Temporali'),
              '4': ('Megla', 'Nebbia'), '5': ('Vročina', 'Alte temperature'), '6': ('Mraz', 'Basse temperature'),
              '7': ('Pojavi ob obali', 'Eventi costieri'), '8': ('Požari v naravi', 'Incendi boschivi'),
              '9': ('Plazovi', 'Valanghe'), '10': ('Dež', 'Pioggia'), '12': ('Poplave', 'Alluvioni'), '13': ('Dež in poplave', 'Pioggia e alluvioni')}


def meteo():
    ns = {'a': 'http://www.w3.org/2005/Atom', 'cap': 'urn:oasis:names:tc:emergency:cap:1.2'}
    root = ET.fromstring(fetch(METEO_FEED))
    if root.tag != '{http://www.w3.org/2005/Atom}feed':
        raise ValueError('feed MeteoAlarm cambiato')
    now = datetime.datetime.now(datetime.timezone.utc)
    out = []
    for e in root.findall('a:entry', ns):
        code = [v.text for v in e.iter('{http://www.w3.org/2005/Atom}value')]
        if METEO_AREA not in code:
            continue
        exp = datetime.datetime.fromisoformat(e.findtext('cap:expires', namespaces=ns))
        if exp < now:
            continue
        ev = e.findtext('cap:event', namespaces=ns) or ''
        lvl = 'red' if ev.startswith('Red') else 'orange' if ev.startswith('Orange') else 'yellow' if ev.startswith('Yellow') else ''
        if not lvl:
            continue
        typ = re.sub(r'^(Red|Orange|Yellow)\s+|\s+Warning$', '', ev).strip().lower()
        key = {'wind': '1', 'snow-ice': '2', 'snow/ice': '2', 'thunderstorm': '3', 'thunderstorms': '3', 'fog': '4',
               'high-temperature': '5', 'high temperature': '5', 'low-temperature': '6', 'low temperature': '6',
               'coastalevent': '7', 'coastal event': '7', 'forest-fire': '8', 'forest fire': '8', 'avalanches': '9',
               'rain': '10', 'flooding': '12', 'rain-flood': '13', 'rain flood': '13'}.get(typ, '')
        sl, it = TIPI_METEO.get(key, (typ, typ))
        out.append(dict(level=lvl, sl=sl, it=it, onset=e.findtext('cap:onset', namespaces=ns),
                        expires=e.findtext('cap:expires', namespaces=ns)))
    order = {'red': 0, 'orange': 1, 'yellow': 2}
    out.sort(key=lambda x: (order[x['level']], x['onset']))
    return out


def main():
    try:
        prev = json.load(open(OUT, encoding='utf-8'))
    except Exception:
        prev = {'albo': [], 'rss': [], 'stato': {}}
    res, stato, errori = {}, {}, []
    for nome, fn in (('albo', albo), ('rss', rss), ('meteo', meteo)):
        try:
            res[nome] = fn()
            stato[nome] = {'ok': True, 'aggiornato': TODAY.isoformat(), 'voci': len(res[nome])}
        except Exception as e:
            res[nome] = prev.get(nome, [])
            stato[nome] = dict(prev.get('stato', {}).get(nome, {}), ok=False, errore=str(e)[:200])
            errori.append(f'{nome}: {e}')
    # atti scaduti: fuori
    res['albo'] = [x for x in res['albo'] if not x['until'] or x['until'] >= TODAY.isoformat()]
    if not stato['meteo']['ok']:
        res['meteo'] = []  # mai mostrare un'allerta vecchia
    data = {'stato': stato, 'meteo': res['meteo'], 'albo': res['albo'], 'rss': res['rss']}
    new = json.dumps(data, ensure_ascii=False, indent=1)
    old = json.dumps(prev, ensure_ascii=False, indent=1)
    if new != old:
        open(OUT, 'w', encoding='utf-8').write(new + '\n')
    print(f"albo {len(res['albo'])} voci, rss {len(res['rss'])} voci")
    if errori:
        print('ERRORE: ' + ' | '.join(errori), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
