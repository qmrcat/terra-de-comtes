/* =====================================================================
   Terra de Comtes · interfície
   Dibuixa el mapa, gestiona els torns (persona i bots) i anima la guerra.
   ===================================================================== */
(function () {
  'use strict';
  const M = window.Motor, B = window.Bots, MP = window.MAPA;
  const NR = M.NR, NJ = M.NJ;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = s => document.querySelector(s);

  const CASES = [
    { nom: 'Casa de Barcelona', lletra: 'B' },
    { nom: 'Casa d’Empúries', lletra: 'E' },
    { nom: 'Casa d’Urgell', lletra: 'U' },
    { nom: 'Casa de Pallars', lletra: 'P' },
  ];
  const color = j => `var(--j${j})`;
  const NOMS_BOTS = ['Elisenda', 'Guerau', 'Bernat', 'Sança', 'Arnau', 'Brunissenda', 'Ermengol', 'Adelaida', 'Miró', 'Ermessenda'];
  const ROMA = ['', 'I', 'II', 'III', 'IV'];
  const NOM_R = r => MP.regions[r].nom;
  // Text del repartiment de punts d'un Castell Major: "3·2·1", "2·1·1", "2·1"
  const repMajor = v => M.PUNTS_MAJOR(v).filter(x => x > 0).join('·');
  const totalMajor = v => M.PUNTS_MAJOR(v).reduce((a, b) => a + b, 0);
  const txtMenor = g => `${g}/${g - 2}, empat ${g - 1}`;
  const LLOC = ['', '1r', '2n', '3r'];
  const art = nom => (/^[AEIOUÀÈÉÍÒÓÚaeiou]/.test(nom) ? 'd’' : 'de ') + nom;   // "d’Osona", "de Girona"

  /* ---------- Configuració recordada ---------- */
  const CFG_DEF = { nom: 'Tu', casa: 0, nivell: 'normal', ritme: 'tranquil', previsio: true };
  let cfg = { ...CFG_DEF };
  try { cfg = { ...CFG_DEF, ...JSON.parse(localStorage.getItem('terra-de-comtes') || '{}') }; } catch (_) { /* sense emmagatzematge */ }
  const desaCfg = () => { try { localStorage.setItem('terra-de-comtes', JSON.stringify(cfg)); } catch (_) { /* res */ } };

  /* ---------- Estat ---------- */
  let e = null;               // estat del motor
  let jug = [];               // jugadors
  let partidaId = 0;
  let ui = { mode: 'res' };   // estat de la interacció actual
  let guerraVis = null;       // { reforc, resolts, punts } durant la guerra
  let resultat = null;
  const viu = id => id === partidaId;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const ritme = (a, b) => (a + Math.random() * (b - a)) * (cfg.ritme === 'agil' ? 0.4 : 1);

  /* =================================================================
     MAPA
     ================================================================= */
  const svg = $('#mapa');
  const el = (tag, attrs = {}, pare) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (pare) pare.appendChild(n);
    return n;
  };
  const capes = {};
  const regioG = [], xipsG = [], fitxaG = [], noms = [];

  function construeixMapa() {
    svg.setAttribute('viewBox', `0 0 ${MP.amplada} ${MP.alcada}`);
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'gra', x: '0', y: '0', width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '4', result: 'n' }, f);
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.9 0' }, f);
    const clip = el('clipPath', { id: 'clip-terra' }, defs);
    MP.regions.forEach(r => el('path', { d: r.d }, clip));
    const mk = el('marker', { id: 'punta', viewBox: '0 0 10 10', refX: '7', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#f7f1e3' }, mk);

    // Onades i rètols del mar
    const mar = el('g', { 'aria-hidden': 'true' }, svg);
    [[485, 262], [548, 300], [350, 372], [420, 335], [262, 438], [330, 560], [480, 560], [545, 610], [250, 622], [560, 505], [220, 520]]
      .forEach(([x, y]) => el('path', { class: 'onada', d: `M${x - 12},${y} q6,-5 12,0 t12,0` }, mar));
    const t = el('text', { class: 'rotul-mar', x: 470, y: 604, 'text-anchor': 'middle' }, mar);
    t.textContent = 'MAR MEDITERRÀNIA';
    const t2 = el('text', { class: 'rotul-mar', x: 120, y: 60, 'text-anchor': 'middle' }, mar);
    t2.textContent = 'PIRINEUS';

    el('path', { class: 'costa-ombra', d: MP.costa }, svg);

    // Rutes per mar (corbes que passen per l'aigua)
    const rutes = el('g', {}, svg);
    for (const [a, b] of MP.mar) {
      const A = MP.regions[a], Bq = MP.regions[b];
      const mx = (A.cx + Bq.cx) / 2, my = (A.cy + Bq.cy) / 2;
      let nx = -(Bq.cy - A.cy), ny = Bq.cx - A.cx;
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      if (nx + ny < 0) { nx = -nx; ny = -ny; }
      const k = Math.min(110, Math.hypot(Bq.cx - A.cx, Bq.cy - A.cy) * 0.45);
      el('path', { class: 'ruta-mar', d: `M${A.cx},${A.cy} Q${mx + nx * k},${my + ny * k} ${Bq.cx},${Bq.cy}` }, rutes);
    }

    // Comtats
    capes.regions = el('g', {}, svg);
    MP.regions.forEach((r, i) => {
      const g = el('g', { class: 'regio', 'data-r': i, tabindex: '0', role: 'button' }, capes.regions);
      el('path', { class: 'terra-regio', d: r.d }, g);
      regioG[i] = g;
    });
    el('rect', { class: 'textura', x: 0, y: 0, width: MP.amplada, height: MP.alcada, filter: 'url(#gra)', 'clip-path': 'url(#clip-terra)' }, svg);
    capes.contorns = el('g', {}, svg);
    MP.regions.forEach((r, i) => el('path', { class: 'contorn-opcio', d: r.d, 'data-r': i }, capes.contorns));

    // Noms, fitxes de castell i soldats
    capes.etiquetes = el('g', {}, svg);
    capes.fletxes = el('g', {}, svg);
    MP.regions.forEach((r, i) => {
      const nom = el('text', { class: 'nom-regio', x: r.cx, y: r.cy - 25 }, capes.etiquetes);
      nom.textContent = r.nom;
      noms[i] = nom;
      const fx = el('g', { class: 'fitxa', transform: `translate(${r.cx},${r.cy})` }, capes.etiquetes);
      el('circle', { class: 'anell', r: 17 }, fx);
      el('circle', { class: 'disc', r: 14 }, fx);
      el('text', { y: 1 }, fx);
      const ins = el('g', { class: 'insignia', transform: 'translate(14,-13)' }, fx);
      el('circle', { r: 8 }, ins);
      el('text', { y: 0.5 }, ins);
      fitxaG[i] = fx;
      xipsG[i] = el('g', { transform: `translate(${r.cx},${r.cy + 21})` }, capes.etiquetes);
    });

    // Interacció
    MP.regions.forEach((r, i) => {
      const g = regioG[i];
      g.addEventListener('click', ev => clicRegio(i, ev));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clicRegio(i, ev); } });
      g.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') mostraGlobus(i, ev); });
      g.addEventListener('pointerleave', amagaGlobus);
      g.addEventListener('focus', () => mostraGlobus(i, null));
      g.addEventListener('blur', amagaGlobus);
    });
  }

  function dibuixaXips(i, nous) {
    const g = xipsG[i];
    g.textContent = '';
    const items = [];
    for (let j = 0; j < NJ; j++) {
      const t = e.tropes[i * NJ + j];
      const rf = guerraVis ? guerraVis.reforc[i * NJ + j] : 0;
      if (t > 0 || rf > 0) items.push({ j, t, rf });
    }
    if (!items.length) return;
    const ample = it => (it.rf ? 34 : 20);
    const cols = items.length === 4 ? 2 : items.length;
    const cw = Math.max(...items.map(ample)) + 3;
    items.forEach((it, k) => {
      const c = k % cols, f = Math.floor(k / cols);
      const fila = Math.min(cols, items.length - f * cols);
      const x = (c - (fila - 1) / 2) * cw, y = f * 19;
      const w = ample(it);
      const nou = nous && nous.some(n => n.r === i && n.j === it.j);
      const xg = el('g', { class: 'xip' + (nou ? ' nou' : ''), transform: `translate(${x},${y})` }, g);
      const rc = el('rect', { x: -w / 2, y: -8, width: w, height: 16, rx: 3 }, xg);
      rc.style.fill = color(it.j);
      const tx = el('text', { x: 0, y: 0.5 }, xg);
      tx.textContent = it.rf ? `${it.t}+${it.rf}` : it.t;
    });
  }

  function actualitzaMapa(nous) {
    let previs = null;
    if (e.fase === 'desplegament' && cfg.previsio) previs = M.previsio(e);
    const guanyadorPrevist = previs ? previs.guanyador : {};
    const revelat = !!guerraVis;
    for (let i = 0; i < NR; i++) {
      const g = regioG[i];
      const v = e.valors[i], buit = e.buit[i];
      fitxaG[i].querySelector('text').textContent = buit && !revelat ? '?' : v;
      const ins = fitxaG[i].querySelector('.insignia');
      ins.style.display = buit ? 'none' : '';
      if (!buit) { ins.dataset.v = totalMajor(v); ins.querySelector('text').textContent = totalMajor(v); }
      fitxaG[i].classList.toggle('amagada', buit);
      fitxaG[i].classList.toggle('revelada', buit && revelat);
      g.classList.toggle('erma', buit);
      noms[i].classList.toggle('erm', buit);
      g.setAttribute('aria-label', buit ? `${NOM_R(i)}, castell menor${revelat ? ', fitxa ' + txtMenor(v) : ', fitxa amagada'}` : `${NOM_R(i)}, castell major ${v}, punts ${repMajor(v)}`);
      g.classList.remove('previsio', 'resolta', 'buida-resolta');
      g.style.removeProperty('--tint');
      fitxaG[i].classList.remove('guanyada');
      fitxaG[i].style.removeProperty('--tint');
      if (guerraVis && i in guerraVis.resolts) {
        const w = guerraVis.resolts[i];
        if (w < 0) g.classList.add('buida-resolta');
        else { g.classList.add('resolta'); g.style.setProperty('--tint', color(w)); fitxaG[i].classList.add('guanyada'); fitxaG[i].style.setProperty('--tint', color(w)); }
      } else if (previs && i in guanyadorPrevist) {
        g.classList.add('previsio'); g.style.setProperty('--tint', color(guanyadorPrevist[i]));
      }
      dibuixaXips(i, nous);
    }
    return previs;
  }

  // Les vores ressaltades són en una capa per sobre de tot; en copiem l'estat
  function marca(regs, classe) {
    for (let i = 0; i < NR; i++) regioG[i].classList.toggle(classe, !!(regs && regs.includes(i)));
    for (let i = 0; i < NR; i++) {
      const g = regioG[i];
      capes.contorns.children[i].dataset.estat = ['triat', 'destacat', 'candidat', 'opcio'].find(k => g.classList.contains(k)) || '';
    }
  }
  const netejaMarques = () => { ['opcio', 'candidat', 'triat', 'destacat', 'lluita', 'atenuat'].forEach(c => marca(null, c)); };

  /* ---------- Globus d'informació ---------- */
  const globus = $('#globus');
  function mostraGlobus(i, ev) {
    if (!e) return;
    const v = e.valors[i], p = M.PROB_SUMA[v], buit = e.buit[i];
    const tropes = [];
    for (let j = 0; j < NJ; j++) {
      const t = e.tropes[i * NJ + j];
      if (t) tropes.push(`<div class="fila"><span style="color:${color(j)}">${esc(jug[j].nom)}</span><b>${t}</b></div>`);
    }
    const veins = e.veins[i].map(n => NOM_R(n) + (e.buit[n] ? ' (menor)' : '') + (e.pont[i].includes(n) ? ' (pont)' : e.veinsMar[i].includes(n) ? ' (mar)' : '')).join(', ');
    const dades = buit
      ? `<div class="fila"><span>Castell menor</span><b>${guerraVis ? 'fitxa ' + v : 'fitxa amagada'}</b></div>
         <div class="fila"><span>Punts 1r/2n</span><b>${guerraVis ? `${v}/${v - 2}` : '3/1, 4/2 o 5/3'}</b></div>
         <div class="fila"><span>Empat al 1r lloc</span><b>${guerraVis ? `${v - 1} cadascú` : '2, 3 o 4 cadascú'}</b></div>`
      : `<div class="fila"><span>Castell major</span><b>${v}</b></div>
         <div class="fila"><span>Punts 1r·2n·3r</span><b>${M.PUNTS_MAJOR(v).join(' · ')}</b></div>
         <div class="fila"><span>Prob. en una tirada</span><b>${Math.round(p * 100)}%</b></div>
         <div class="fila"><span>Amb una segona tirada</span><b>${Math.round((1 - (1 - p) ** 2) * 100)}%</b></div>`;
    globus.innerHTML = `<h4>${NOM_R(i)} <small>${MP.regions[i].capital}</small></h4>${dades}
      ${tropes.length ? '<div style="margin-top:6px"></div>' + tropes.join('') : ''}
      ${previsioGlobus(i)}
      <div class="veins">Veïns: ${veins}</div>
      ${buit ? '<div class="veins">Fa de pont: els castells majors que el toquen són veïns entre ells.</div>' : ''}`;
    const marc = $('.mapa-marc').getBoundingClientRect();
    let x, y;
    if (ev) { x = ev.clientX - marc.left + 16; y = ev.clientY - marc.top + 16; }
    else {
      const r = regioG[i].getBoundingClientRect();
      x = r.left - marc.left + r.width / 2; y = r.top - marc.top + r.height / 2;
    }
    globus.hidden = false;
    const gw = globus.offsetWidth, gh = globus.offsetHeight;
    if (x + gw > marc.width - 4) x = Math.max(4, x - gw - 28);
    if (y + gh > marc.height - 4) y = Math.max(4, y - gh - 28);
    globus.style.left = x + 'px'; globus.style.top = y + 'px';
  }
  function amagaGlobus() { globus.hidden = true; }
  // Línia de previsió per al globus: qui guanyaria i amb quina probabilitat (segons els daus blancs)
  function previsioGlobus(i) {
    if (!cfg.previsio || e.fase !== 'desplegament') return '';
    const pv = M.previsio(e);
    if (!(i in pv.guanyador)) return '';
    const j = pv.guanyador[i], pc = Math.round(pv.prob[i] * 100);
    return `<div class="fila" style="margin-top:6px"><span>Previsió</span><b style="color:${color(j)}">${esc(jug[j].nom)}${pc < 100 ? ` · ${pc}%` : ''}</b></div>`;
  }

  /* =================================================================
     TAULER LATERAL
     ================================================================= */
  function actualitzaJugadors(previs) {
    const ol = $('#jugadors');
    ol.textContent = '';
    jug.forEach((J, j) => {
      const li = document.createElement('li');
      li.className = 'jugador' + (e.fase === 'desplegament' && e.torn === j ? ' actiu' : '');
      li.style.setProperty('--color', color(j));
      let punts = '', etiqueta = '';
      if (guerraVis) { punts = guerraVis.punts[j]; etiqueta = 'punts'; }
      else if (previs) { punts = '≈' + Math.round(previs.punts[j]); etiqueta = 'previsió'; }
      const extra = [];
      if (e.fase === 'desplegament') extra.push(`Reserva <b>${e.reserva[j]}</b>`);
      if (e.estendards[j]) extra.push(`Estendard <b>${ROMA[e.estendards[j]]}</b>`);
      if (e.cartaUsada[j]) extra.push(`<b>${M.CARTA[e.cartaUsada[j]].nom}</b>`);
      li.innerHTML = `<span class="escut">${CASES[j].lletra}</span>
        <span class="nom">${esc(J.nom)} <small>· ${CASES[j].nom.replace('Casa ', '')}${J.huma ? ' · tu' : ' · ' + B.CARACTERS[J.caracter].etiqueta.toLowerCase()}</small></span>
        <span class="punts">${punts}<small>${etiqueta}</small></span>
        <span class="detall">${extra.map(x => `<span>${x}</span>`).join('')}</span>
        <span class="diu${J.pensant ? ' pensant' : ''}">${J.pensant ? 'Pensant' : J.diu ? '«' + esc(J.diu) + '»' : ''}</span>`;
      ol.appendChild(li);
    });
    $('#titol-fase').textContent = e.fase === 'final' ? 'Resultat final' : e.inici != null ? `Guerra · comença pel ${e.inici}` : e.fase === 'guerra' ? 'Guerra' : `Desplegament · ronda ${e.tornNum}`;
  }

  function actualitzaCartes() {
    const ul = $('#cartes');
    ul.textContent = '';
    const nota = $('#nota-cartes');
    const p = ui.p;
    const humaPot = ui.mode === 'inici' && M.potJugarCarta(e, p);
    if (e.fase !== 'desplegament') nota.textContent = '';
    else if (!e.cartesActives) nota.textContent = 'ja no es poden jugar';
    else nota.textContent = 'una per casa';
    if (!e.cartes.length) { ul.innerHTML = '<li class="cartes-buit">No en queda cap.</li>'; return; }
    for (const id of e.cartes) {
      const c = M.CARTA[id];
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'carta' + (ui.carta && ui.carta.id === id ? ' activa' : '') + (ui.cartaBot === id ? ' activa' : '');
      b.innerHTML = `<b>${c.nom}</b><span>${c.text}</span>`;
      const possible = humaPot && M.accionsCarta(e, id, p).length > 0;
      b.disabled = !possible;
      if (humaPot && !possible) b.title = 'Ara mateix no la pots jugar';
      b.addEventListener('click', () => clicCarta(id));
      li.appendChild(b); ul.appendChild(li);
    }
  }

  function cronica(html, j) {
    const li = document.createElement('li');
    if (j != null) li.style.setProperty('--color', color(j));
    li.innerHTML = html;
    $('#cronica').prepend(li);
  }
  const nomJ = j => `<b style="color:${color(j)}">${esc(jug[j].nom)}</b>`;
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function renderTot(nous) {
    const previs = actualitzaMapa(nous);
    actualitzaJugadors(previs);
    actualitzaCartes();
  }

  /* ---------- Daus ---------- */
  const htmlDau = (v, petit) => `<span class="dau${petit ? ' petit' : ''}" data-v="${v}">${'<i></i>'.repeat(9)}</span>`;
  async function animaDaus(cont, daus, id) {
    cont.innerHTML = daus.map(() => htmlDau(1)).join('');
    const ds = [...cont.children];
    const passos = cfg.ritme === 'agil' ? 4 : 7;
    for (let k = 0; k < passos; k++) {
      ds.forEach(d => (d.dataset.v = 1 + Math.floor(Math.random() * 6)));
      await espera(60);
      if (id != null && !viu(id)) return;
    }
    ds.forEach((d, i) => { d.dataset.v = daus[i]; d.classList.remove('roda'); void d.offsetWidth; d.classList.add('roda'); });
  }

  /* =================================================================
     PARTIDA
     ================================================================= */
  function creaJugadors() {
    const noms = M.barreja(NOMS_BOTS);
    const cars = M.barreja(Object.keys(B.CARACTERS));
    jug = [];
    for (let j = 0; j < NJ; j++) {
      if (j === cfg.casa) jug.push({ nom: (cfg.nom || 'Tu').trim() || 'Tu', huma: true });
      else {
        const car = cars.pop();
        jug.push({ nom: noms.pop(), huma: false, caracter: car, bot: new B.Bot(j, car, cfg.nivell) });
      }
    }
  }

  function comenca() {
    partidaId++;
    const id = partidaId;
    e = M.novaPartida();
    creaJugadors();
    ui = { mode: 'res' }; guerraVis = null; resultat = null;
    $('#cronica').textContent = '';
    $('#batalla').hidden = true;
    netejaMarques();
    const nivell = { facil: 'fàcils', normal: 'de nivell normal', dificil: 'difícils' }[cfg.nivell];
    cronica(`Comença la partida amb rivals ${nivell}. Cartes en joc: ${e.cartes.map(c => M.CARTA[c].nom).join(', ')}.`);
    cronica(`Comença ${nomJ(e.torn)}.`, e.torn);
    renderTot();
    bucle(id);
  }

  async function bucle(id) {
    while (e.fase === 'desplegament') {
      jug.forEach(J => (J.diu = J.diu || ''));
      renderTot();
      const p = e.torn;
      if (jug[p].huma) await tornHuma(id, p);
      else await tornBot(id, p);
      if (!viu(id)) return;
      M.passaTorn(e);
    }
    await guerra(id);
    if (!viu(id)) return;
    mostraFinal();
  }

  /* ---------- Torn de la persona ---------- */
  function tornHuma(id, p) {
    return new Promise(resolve => {
      ui = { mode: 'inici', p, id, resolve, tirades: 0, daus: null, carta: null };
      $('#accio').dataset.casa = p;
      mostraIniciTorn();
    });
  }

  function mostraIniciTorn() {
    const p = ui.p;
    ui.mode = 'inici'; ui.carta = null;
    netejaMarques();
    const pot = M.potJugarCarta(e, p);
    const acc = $('#accio');
    acc.innerHTML = `<h3>El teu torn</h3>
      <p>Tens <b>${e.reserva[p]}</b> soldats a la reserva. ${pot ? 'Tira els daus o juga una de les cartes tàctiques (només una en tota la partida).' : 'Tira els daus.'}</p>
      <div class="fila-botons"><button type="button" class="boto" id="btn-tira">Tira els daus</button></div>`;
    $('#btn-tira').addEventListener('click', tiraHuma);
    $('#btn-tira').focus({ preventScroll: true });
    renderTot();
  }

  async function tiraHuma() {
    if (ui.mode !== 'inici' && ui.mode !== 'opcions') return;
    const id = ui.id;
    ui.mode = 'tirant'; ui.tirades++;
    ui.daus = [M.dau(), M.dau(), M.dau()];
    netejaMarques();
    actualitzaCartes();
    const acc = $('#accio');
    acc.innerHTML = `<h3>${ui.tirades === 1 ? 'Daus' : 'Segona tirada'}</h3><div class="daus" id="daus"></div>`;
    await animaDaus($('#daus'), ui.daus, id);
    if (!viu(id)) return;
    mostraOpcions();
  }

  function mostraOpcions() {
    ui.mode = 'opcions';
    const p = ui.p, d = ui.daus;
    const ops = M.agrupacions(d);
    ui.ops = ops;
    const acc = $('#accio');
    const retira = ui.tirades < 2;
    acc.innerHTML = `<h3>On despleguem?</h3>
      <div class="daus">${d.map(v => htmlDau(v)).join('')}</div>
      <p>La parella marca el castell; el dau sol, quants soldats hi van. Si el dau sol és senar, abans pots moure aquests soldats a un veí on ja en tinguis; si és parell, a un castell menor veí.</p>
      <div class="opcions" id="opcions"></div>
      <div class="fila-botons">${retira ? '<button type="button" class="boto-fantasma" id="btn-retira">Torna a tirar els tres daus (un sol cop)</button>' : ''}</div>`;
    const cont = $('#opcions');
    ops.forEach(op => {
      const r = M.regioDeValor(e, op.suma);
      const n = Math.min(op.quants, e.reserva[p]);
      const pot = M.moviments(e, p, op.dauSol).length > 0;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opcio';
      b.innerHTML = `<span class="parella">${htmlDau(d[op.parella[0]], true)}${htmlDau(d[op.parella[1]], true)}</span>
        <span class="on"><b>${NOM_R(r)}</b><small>Castell ${op.suma} · punts ${repMajor(op.suma)}${e.tropes[r * NJ + p] ? ` · ja hi tens ${e.tropes[r * NJ + p]}` : ''}</small>
          <small class="mov">${pot ? (op.parell ? `Parell: pots moure’n ${op.quants} a un castell menor` : `Senar: pots moure’n ${op.quants} on ja en tens`) : 'Sense moviment possible'}</small></span>
        <span class="quants">${htmlDau(d[op.sol], true)} +${n} ${n === 1 ? 'soldat' : 'soldats'}</span>`;
      b.addEventListener('click', () => triaOpcioHuma(op));
      b.addEventListener('mouseenter', () => { marca([r], 'destacat'); });
      b.addEventListener('mouseleave', () => { marca(null, 'destacat'); });
      b.addEventListener('focus', () => { marca([r], 'destacat'); });
      b.addEventListener('blur', () => { marca(null, 'destacat'); });
      cont.appendChild(b);
    });
    if (retira) $('#btn-retira').addEventListener('click', tiraHuma);
    marca(ops.map(op => M.regioDeValor(e, op.suma)), 'opcio');
    cont.firstChild && cont.firstChild.focus({ preventScroll: true });
  }

  function triaOpcioHuma(op) {
    if (ui.mode !== 'opcions') return;
    const movs = M.moviments(e, ui.p, op.dauSol);
    if (!movs.length) return desplegaHuma(op, null);
    ui.mode = 'moviment'; ui.op = op; ui.movs = movs; ui.movDe = null;
    pasMoviment();
  }

  // Pas opcional: moure soldats abans de desplegar
  function pasMoviment() {
    const op = ui.op, n = op.quants;
    netejaMarques();
    const r = M.regioDeValor(e, op.suma);
    const regla = op.parell
      ? `Dau sol ${op.dauSol} (parell): pots moure ${n} ${n === 1 ? 'soldat teu' : 'soldats teus'} a un <b>castell menor</b> veí, encara que no hi tinguis ningú.`
      : `Dau sol ${op.dauSol} (senar): pots moure ${n} ${n === 1 ? 'soldat teu' : 'soldats teus'} a un territori veí <b>on ja tinguis soldats</b>.`;
    let pas;
    if (ui.movDe == null) {
      marca([...new Set(ui.movs.map(m => m.de))], 'candidat');
      pas = 'Tria d’on surten els soldats.';
    } else {
      marca([ui.movDe], 'triat');
      marca(ui.movs.filter(m => m.de === ui.movDe).map(m => m.a), 'candidat');
      pas = `Surten de ${NOM_R(ui.movDe)}. Tria on van.`;
    }
    $('#accio').innerHTML = `<h3>Moviment opcional</h3><p>${regla}</p><p><b>${pas}</b></p>
      <p>Després, ${Math.min(n, e.reserva[ui.p])} de la reserva aniran a ${NOM_R(r)} (castell ${op.suma}).</p>
      <div class="fila-botons">
        <button type="button" class="boto" id="btn-no-moure">No moguis, desplega</button>
        ${ui.movDe != null ? '<button type="button" class="boto-fantasma" id="btn-altre-origen">Canvia l’origen</button>' : ''}
      </div>`;
    $('#btn-no-moure').addEventListener('click', () => desplegaHuma(op, null));
    const ao = $('#btn-altre-origen');
    if (ao) ao.addEventListener('click', () => { ui.movDe = null; pasMoviment(); });
  }

  function desplegaHuma(op, mov) {
    const p = ui.p, r = M.regioDeValor(e, op.suma);
    const n = M.jugaTirada(e, p, op, mov);
    ui.mode = 'res';
    netejaMarques();
    if (mov) cronica(`${nomJ(p)} mou ${mov.n} ${mov.n === 1 ? 'soldat' : 'soldats'} de ${NOM_R(mov.de)} a ${NOM_R(mov.a)}${e.buit[mov.a] ? ' (castell menor)' : ''}.`, p);
    cronica(`${nomJ(p)} tira ${ui.daus.join('·')} i posa ${n} ${n === 1 ? 'soldat' : 'soldats'} a ${NOM_R(r)} (castell ${op.suma}).`, p);
    if (e.reserva[p] === 0) cronica(`${nomJ(p)} ha desplegat tot l’exèrcit i pren l’estendard ${ROMA[e.estendards[p]]}.`, p);
    $('#accio').innerHTML = `<h3>Fet</h3><p>${mov ? `${mov.n} cap a ${NOM_R(mov.a)} i ` : ''}${n} ${n === 1 ? 'soldat' : 'soldats'} cap a ${NOM_R(r)}.</p>`;
    renderTot([{ r, j: p }].concat(mov ? [{ r: mov.a, j: p }] : []));
    const res = ui.resolve;
    setTimeout(res, 350);
  }

  /* ---------- Cartes (persona) ---------- */
  function clicCarta(id) {
    if (ui.mode !== 'inici') return;
    const accions = M.accionsCarta(e, id, ui.p);
    if (!accions.length) return;
    ui.mode = 'carta';
    ui.carta = { id, accions, cami: [] };
    actualitzaCartes();
    pasCarta();
  }

  function pasCarta() {
    const c = ui.carta, k = c.cami.length;
    const compat = c.accions.filter(a => c.cami.every((t, i) => a.cami[i] === t));
    const completa = compat.find(a => a.cami.length === k);
    if (completa) return aplicaCartaHuma(completa);
    const seguents = [...new Set(compat.map(a => a.cami[k]))];
    const def = M.CARTA[c.id];
    netejaMarques();
    const triats = c.cami.filter(t => t[0] === 'r').map(t => +t.slice(1));
    marca(triats, 'triat');
    const acc = $('#accio');
    let cos = '';
    if (seguents[0][0] === 'r') {
      marca(seguents.map(t => +t.slice(1)), 'candidat');
      cos = '<p>Toca un dels territoris marcats al mapa.</p>';
    } else {
      cos = `<div class="tria-rival">${seguents.map(t => {
        const j = +t.slice(1);
        return `<button type="button" class="boto-fantasma" data-t="${t}" style="--color:${color(j)}">${esc(jug[j].nom)}</button>`;
      }).join('')}</div>`;
    }
    const retirada = c.id === 'retirada' && triats.length ? `<p>Ja en retires de: ${triats.map(NOM_R).join(', ')}.</p>` : '';
    acc.innerHTML = `<h3>${def.nom}</h3><p><b>${def.passos[k]}</b></p>${retirada}${cos}
      <div class="fila-botons"><button type="button" class="boto-fantasma" id="btn-cancel">Cancel·la la carta</button></div>`;
    acc.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { c.cami.push(b.dataset.t); pasCarta(); }));
    $('#btn-cancel').addEventListener('click', mostraIniciTorn);
  }

  function aplicaCartaHuma(ac) {
    const p = ui.p, id = ui.carta.id;
    M.jugaCarta(e, p, id, ac);
    ui.mode = 'res'; ui.carta = null;
    netejaMarques();
    cronica(`${nomJ(p)} juga <b>${M.CARTA[id].nom}</b>: ${descriuOps(ac.ops)}.`, p);
    $('#accio').innerHTML = `<h3>${M.CARTA[id].nom}</h3><p>Fet: ${descriuOps(ac.ops)}.</p>`;
    renderTot(opsNous(ac.ops));
    setTimeout(ui.resolve, 450);
  }

  function descriuOps(ops) {
    const parts = [];
    const agrupa = {};
    for (const op of ops) {
      if (op[0] === 'mou') parts.push(`${op[4]} ${op[4] === 1 ? 'soldat' : 'soldats'} de ${esc(jug[op[1]].nom)} de ${NOM_R(op[2])} a ${NOM_R(op[3])}`);
      else if (op[0] === 'treu') { const k = op[1] + ':' + op[2]; agrupa[k] = (agrupa[k] || 0) + op[3]; }
      else if (op[0] === 'posa') parts.push(`${esc(jug[op[1]].nom)} posa ${op[3]} a ${NOM_R(op[2])}`);
    }
    for (const k in agrupa) {
      const [j, r] = k.split(':').map(Number);
      parts.unshift(`${agrupa[k]} ${agrupa[k] === 1 ? 'soldat' : 'soldats'} de ${esc(jug[j].nom)} tornen a la reserva des de ${NOM_R(r)}`);
    }
    return parts.join('; ');
  }
  const opsNous = ops => ops.filter(o => o[0] !== 'treu').map(o => ({ r: o[0] === 'mou' ? o[3] : o[2], j: o[1] }));
  const opsRegions = ops => [...new Set(ops.flatMap(o => (o[0] === 'mou' ? [o[2], o[3]] : [o[2]])))];

  /* ---------- Clic al mapa ---------- */
  function clicRegio(i, ev) {
    if (ui.mode === 'opcions') {
      const op = ui.ops.find(o => M.regioDeValor(e, o.suma) === i);
      if (op) return triaOpcioHuma(op);
    } else if (ui.mode === 'carta') {
      const c = ui.carta;
      if (regioG[i].classList.contains('candidat')) { c.cami.push('r' + i); return pasCarta(); }
    } else if (ui.mode === 'moviment') {
      if (regioG[i].classList.contains('candidat')) {
        if (ui.movDe == null) { ui.movDe = i; return pasMoviment(); }
        const mov = ui.movs.find(m => m.de === ui.movDe && m.a === i);
        if (mov) return desplegaHuma(ui.op, mov);
      }
    }
    if (ev && ev.pointerType !== 'mouse') {           // en pantalles tàctils, el toc mostra la informació
      mostraGlobus(i, ev.clientX != null && ev.detail ? ev : null);
      clearTimeout(clicRegio.t); clicRegio.t = setTimeout(amagaGlobus, 3500);
    }
  }

  /* ---------- Torn d'un bot ---------- */
  async function tornBot(id, p) {
    const J = jug[p], bot = J.bot;
    J.pensant = true; J.diu = '';
    ui = { mode: 'bot', p };
    $('#accio').dataset.casa = p;
    $('#accio').innerHTML = `<h3>Torn ${art(esc(J.nom))}</h3><p>Observa el mapa…</p><div class="daus" id="daus"></div>`;
    renderTot();
    await espera(ritme(650, 1200));
    if (!viu(id)) return;

    const carta = bot.decideixCarta(e);
    if (!viu(id)) return;
    if (carta) {
      const def = M.CARTA[carta.id];
      J.pensant = false; J.diu = bot.frase('carta', { carta: def.nom });
      ui.cartaBot = carta.id;
      $('#accio').innerHTML = `<h3>${esc(J.nom)} juga ${def.nom}</h3><p>${def.text}</p>`;
      renderTot();
      marca(opsRegions(carta.accio.ops), 'destacat');
      await espera(ritme(1500, 2100));
      if (!viu(id)) return;
      M.jugaCarta(e, p, carta.id, carta.accio);
      ui.cartaBot = null;
      cronica(`${nomJ(p)} juga <b>${def.nom}</b>: ${descriuOps(carta.accio.ops)}.`, p);
      $('#accio').innerHTML = `<h3>${esc(J.nom)} juga ${def.nom}</h3><p>${descriuOps(carta.accio.ops)}.</p>`;
      renderTot(opsNous(carta.accio.ops));
      await espera(ritme(1100, 1500));
      netejaMarques();
      return;
    }

    let daus = [M.dau(), M.dau(), M.dau()];
    $('#accio').querySelector('p').textContent = 'Tira els daus.';
    await animaDaus($('#daus'), daus, id);
    if (!viu(id)) return;
    await espera(ritme(450, 900));
    if (!viu(id)) return;
    let dec = bot.decideixTirada(e, daus, true);
    if (!viu(id)) return;
    if (dec.retira) {
      J.pensant = false; J.diu = bot.frase('retira');
      cronica(`${nomJ(p)} treu ${daus.join('·')} i torna a tirar.`, p);
      $('#accio').querySelector('p').textContent = 'No li agrada la tirada: torna a tirar.';
      renderTot();
      await espera(ritme(800, 1200));
      if (!viu(id)) return;
      daus = [M.dau(), M.dau(), M.dau()];
      await animaDaus($('#daus'), daus, id);
      if (!viu(id)) return;
      J.pensant = true; renderTot();
      await espera(ritme(450, 900));
      if (!viu(id)) return;
      dec = bot.decideixTirada(e, daus, false);
      if (!viu(id)) return;
    }
    const { op, mov } = dec;
    const r = M.regioDeValor(e, op.suma);
    J.pensant = false;
    const nPrev = Math.min(op.quants, e.reserva[p]);
    const textMov = mov ? `Abans, mou ${mov.n} de ${NOM_R(mov.de)} a <b>${NOM_R(mov.a)}</b>${e.buit[mov.a] ? ' (castell menor)' : ''}. ` : '';
    $('#accio').innerHTML = `<h3>Torn ${art(esc(J.nom))}</h3>
      <div class="daus">${daus.map(v => htmlDau(v)).join('')}</div>
      <p>${textMov}Agrupa ${daus[op.parella[0]]}+${daus[op.parella[1]]} → <b>${NOM_R(r)}</b> (castell ${op.suma}) i hi envia ${nPrev} ${nPrev === 1 ? 'soldat' : 'soldats'}.</p>`;
    if (mov) {
      J.diu = bot.frase(e.buit[mov.a] ? 'buit' : 'mou', { comtat: NOM_R(mov.a) });
      renderTot();
      marca([mov.de, mov.a], 'destacat');
      await espera(ritme(800, 1200));
      if (!viu(id)) return;
      e.tropes[mov.de * NJ + p] -= mov.n; e.tropes[mov.a * NJ + p] += mov.n;
      cronica(`${nomJ(p)} mou ${mov.n} ${mov.n === 1 ? 'soldat' : 'soldats'} de ${NOM_R(mov.de)} a ${NOM_R(mov.a)}${e.buit[mov.a] ? ' (castell menor)' : ''}.`, p);
      renderTot([{ r: mov.a, j: p }]);
      await espera(ritme(500, 800));
      if (!viu(id)) return;
    } else {
      J.diu = bot.frase(totalMajor(op.suma) === 6 ? 'alta' : 'tria', { comtat: NOM_R(r) });
      renderTot();
    }
    marca(null, 'destacat');
    marca([r], 'destacat');
    await espera(ritme(700, 1100));
    if (!viu(id)) return;
    const n = M.desplega(e, p, r, op.quants);
    cronica(`${nomJ(p)} tira ${daus.join('·')} i posa ${n} ${n === 1 ? 'soldat' : 'soldats'} a ${NOM_R(r)} (castell ${op.suma}).`, p);
    if (e.reserva[p] === 0) {
      J.diu = bot.frase('acaba');
      cronica(`${nomJ(p)} ha desplegat tot l’exèrcit i pren l’estendard ${ROMA[e.estendards[p]]}.`, p);
    }
    renderTot([{ r, j: p }]);
    await espera(ritme(650, 950));
    netejaMarques();
  }

  /* =================================================================
     GUERRA
     ================================================================= */
  async function guerra(id) {
    ui = { mode: 'guerra', pausa: false, salta: false };
    delete $('#accio').dataset.casa;
    jug.forEach(J => { J.pensant = false; J.diu = ''; });
    netejaMarques();
    renderTot();
    cronica('<b>Tothom ha desplegat. Comença la guerra!</b>');
    const acc = $('#accio');

    // 1. Els dos daus blancs decideixen per quin castell major es comença
    const inici = M.tiraInici(e);
    const seq = M.INICIS.map((_, k) => ((inici - 2 + k) % 11) + 2);
    const rInici = M.regioDeValor(e, inici);
    acc.innerHTML = `<h3>Daus blancs</h3><p>Es tiren dos daus blancs per saber per quin castell major comença la guerra.</p>
      <div class="daus blancs" id="daus"></div>`;
    await espera(ritme(500, 700));
    if (!viu(id)) return;
    await animaDaus($('#daus'), e.dausInici, id);
    if (!viu(id)) return;
    marca([rInici], 'destacat');
    const ultim = seq[seq.length - 1];
    acc.querySelector('p').innerHTML = `${e.dausInici[0]} + ${e.dausInici[1]} = <b>${inici}</b>. Es comença per ${NOM_R(rInici)} (castell ${inici}), es continua pel ${seq[1]} i així successivament${inici === 2 ? '' : ' (després del 12 ve el 2)'}. L’últim és el ${ultim}.`;
    cronica(`Els daus blancs fan ${e.dausInici[0]} + ${e.dausInici[1]} = <b>${inici}</b>: la guerra comença per ${NOM_R(rInici)} i acaba pel castell ${ultim}.`);
    await espera(cfg.ritme === 'agil' ? 1600 : 3000);
    if (!viu(id)) return;
    netejaMarques();

    // 2. Es giren les fitxes i es resol
    resultat = M.resolGuerra(e);
    guerraVis = { reforc: new Array(NR * NJ).fill(0), resolts: {}, punts: [0, 0, 0, 0] };
    const fitxes = [...Array(NR).keys()].filter(r => e.buit[r]).map(r => `${NOM_R(r)} ${e.valors[r]}/${e.valors[r] - 2}`);
    cronica(`Es giren les fitxes dels castells menors: ${fitxes.join(', ')}.`);
    acc.innerHTML = `<h3>La guerra</h3>
      <div class="daus blancs">${e.dausInici.map(v => htmlDau(v, true)).join('')}</div>
      <ol class="ordre-guerra" id="ordre-guerra" aria-label="Ordre de resolució">${seq.map(v => `<li data-v="${v}">${v}</li>`).join('')}</ol>
      <p>Cada castell menor es resol just després del castell major del seu grup (3, 4 o 5). Qui queda primer envia 2 reforços a cada castell major veí encara en joc on tingui soldats; els castells menors no en reben.</p>
      <div class="fila-botons">
        <button type="button" class="boto-fantasma" id="btn-pausa">Pausa</button>
        <button type="button" class="boto" id="btn-salta">Ves al resultat</button>
      </div>`;
    $('#btn-pausa').addEventListener('click', () => {
      ui.pausa = !ui.pausa;
      $('#btn-pausa').textContent = ui.pausa ? 'Continua' : 'Pausa';
    });
    $('#btn-salta').addEventListener('click', () => { ui.salta = true; ui.pausa = false; });
    renderTot();
    const banner = $('#batalla');
    const pausaG = async ms => {
      if (ui.salta) return;
      const fi = Date.now() + ms * (cfg.ritme === 'agil' ? 0.55 : 1);
      while ((Date.now() < fi || ui.pausa) && !ui.salta && viu(id)) await espera(60);
    };
    await pausaG(900);

    const xips = [...$('#ordre-guerra').children];
    for (const b of resultat.batalles) {
      if (!viu(id)) return;
      const r = b.regio;
      const pos = seq.indexOf(b.valor);
      xips.forEach((x, k) => { x.classList.toggle('fet', k < pos); x.classList.toggle('ara', k === pos); });
      if (b.buida) {
        guerraVis.resolts[r] = -1;
        cronica(`Ningú no lluita per ${NOM_R(r)} (castell major ${b.valor}).`);
        renderTot();
        await pausaG(450);
        continue;
      }
      marca([r], 'lluita');
      regioG[r].classList.add('lluita');
      const max = Math.max(...b.forca);
      const files = [0, 1, 2, 3].filter(j => b.forca[j] > 0).sort((x, y) => b.forca[y] - b.forca[x]).map(j => `
        <div class="forca"><span class="qui" style="color:${color(j)}">${esc(jug[j].nom)}</span>
          <span class="barra-f"><span style="width:${b.tropes[j] / max * 100}%;background:${color(j)}"></span><span class="r" style="width:${b.reforcos[j] / max * 100}%"></span></span>
          <b>${b.forca[j]}</b></div>`).join('');
      const queEs = b.buit ? `Castell menor · ${txtMenor(b.valor)}` : `Castell major ${b.valor} · ${repMajor(b.valor)}`;
      banner.innerHTML = `<h3>${NOM_R(r)} <small>${queEs}</small></h3>${files}<p class="veredicte" id="veredicte">&nbsp;</p>`;
      banner.hidden = ui.salta;
      await pausaG(1100);
      if (!viu(id)) return;
      const g = b.guanyador;
      for (const pr of b.premis) guerraVis.punts[pr.j] += pr.punts;
      guerraVis.resolts[r] = g;
      const empat = b.empat ? ` (empat desfet per l’estendard ${ROMA[e.estendards[g]]})` : '';
      const nomC = j => `<span style="color:${color(j)}">${esc(jug[j].nom)}</span>`;
      let veredicte, txtCron;
      if (b.repartit) {
        const qui = b.premis.map(pr => pr.j);
        veredicte = `Empat al primer lloc entre ${qui.map(nomC).join(' i ')}: +${b.premis[0].punts} cadascú.`;
        txtCron = `Empat a ${NOM_R(r)} entre ${qui.map(nomJ).join(' i ')}: +${b.premis[0].punts} cadascú.`;
      } else {
        veredicte = b.premis.map(pr => `${nomC(pr.j)} ${LLOC[pr.lloc]}: +${pr.punts}`).join(' · ') + empat + '.';
        txtCron = `${NOM_R(r)}: ` + b.premis.map(pr => `${nomJ(pr.j)} ${LLOC[pr.lloc]} (+${pr.punts})`).join(', ') + empat + '.';
      }
      $('#veredicte').innerHTML = veredicte;
      cronica(txtCron, g);
      renderTot();
      await pausaG(900);
      if (b.envia.length) {
        if (!ui.salta) {
          for (const n of b.envia) {
            const A = MP.regions[r], Z = MP.regions[n];
            const dx = Z.cx - A.cx, dy = Z.cy - A.cy, L = Math.hypot(dx, dy);
            el('path', { class: 'fletxa', d: `M${A.cx + dx / L * 22},${A.cy + dy / L * 22} L${Z.cx - dx / L * 26},${Z.cy - dy / L * 26}` }, capes.fletxes);
          }
        }
        b.envia.forEach(n => (guerraVis.reforc[n * NJ + g] += M.REFORC));
        cronica(`${nomJ(g)} envia reforços a ${b.envia.map(NOM_R).join(', ')}.`, g);
        renderTot(b.envia.map(n => ({ r: n, j: g })));
        await pausaG(1000);
        capes.fletxes.textContent = '';
      }
      regioG[r].classList.remove('lluita');
      netejaMarques();
    }
    banner.hidden = true;
    capes.fletxes.textContent = '';
    xips.forEach(x => { x.classList.remove('ara'); x.classList.add('fet'); });
  }

  function mostraFinal() {
    const res = resultat;
    e.fase = 'final';
    // el mapa es queda pintat amb els guanyadors, sense els reforços
    guerraVis.reforc.fill(0);
    guerraVis.punts = res.punts.slice();
    renderTot();
    const huma = jug.findIndex(J => J.huma);
    const guanya = res.classificacio[0];
    const posHuma = res.classificacio.indexOf(huma) + 1;
    const empatPrimer = res.punts[res.classificacio[0]] === res.punts[res.classificacio[1]];
    let lema = guanya === huma
      ? 'Has unificat les terres de la Corona. La victòria és teva!'
      : `${esc(jug[guanya].nom)} (${CASES[guanya].nom}) s’endú la corona comtal. Has quedat en ${posHuma}a posició.`;
    if (empatPrimer) lema += ` L’empat a punts l’ha desfet l’estendard més alt.`;
    $('#final-lema').innerHTML = lema;
    $('#final-taula').innerHTML = `<thead><tr><th></th><th>Casa</th><th class="llista">Llocs</th><th style="text-align:right">Punts</th></tr></thead><tbody>` +
      res.classificacio.map((j, k) => `<tr class="${k === 0 ? 'guanya' : ''}">
        <td>${k + 1}</td>
        <td><span class="qui"><span class="escut" style="--color:${color(j)}"></span>${esc(jug[j].nom)}</span></td>
        <td class="llista">${[1, 2, 3].map(k => `${LLOC[k]} ×${res.llocs[j][k]}`).join(' · ')} · estendard ${ROMA[e.estendards[j]]}</td>
        <td class="num">${res.punts[j]}</td></tr>`).join('') + '</tbody>';
    $('#accio').innerHTML = `<h3>Partida acabada</h3><p>${lema}</p>
      <div class="fila-botons"><button type="button" class="boto-fantasma" id="btn-veure">Veure el resultat</button><button type="button" class="boto" id="btn-altra">Una altra partida</button></div>`;
    $('#btn-veure').addEventListener('click', () => obre('#capa-final'));
    $('#btn-altra').addEventListener('click', () => obreInici());
    cronica(`<b>Fi de la guerra.</b> ${lema}`);
    obre('#capa-final');
  }

  /* =================================================================
     CAPES I INICI
     ================================================================= */
  function obre(sel) { $(sel).hidden = false; const b = $(sel).querySelector('.boto'); b && b.focus({ preventScroll: true }); }
  function tanca(sel) { $(sel).hidden = true; }

  function obreInici() {
    tanca('#capa-final');
    $('#btn-inici-tanca').hidden = !(e && e.fase !== 'final');
    $('#btn-comenca').textContent = e ? 'Comença una partida nova' : 'Comença la partida';
    obre('#capa-inici');
  }

  function preparaInici() {
    const cont = $('#tria-casa');
    CASES.forEach((c, j) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'casa'; b.style.setProperty('--color', color(j));
      b.setAttribute('aria-pressed', String(j === cfg.casa));
      b.innerHTML = `<span class="escut">${c.lletra}</span><span>${c.nom}</span>`;
      b.addEventListener('click', () => {
        cfg.casa = j;
        cont.querySelectorAll('.casa').forEach((x, k) => x.setAttribute('aria-pressed', String(k === j)));
      });
      cont.appendChild(b);
    });
    $('#in-nom').value = cfg.nom;
    const nv = document.getElementById('niv-' + cfg.nivell); nv && (nv.checked = true);
    const rt = document.getElementById('rit-' + cfg.ritme); rt && (rt.checked = true);
    $('#form-inici').addEventListener('submit', ev => {
      ev.preventDefault();
      cfg.nom = $('#in-nom').value.trim() || 'Tu';
      cfg.nivell = document.querySelector('input[name="nivell"]:checked').value;
      cfg.ritme = document.querySelector('input[name="ritme"]:checked').value;
      desaCfg();
      tanca('#capa-inici');
      comenca();
    });
    document.querySelectorAll('input[name="ritme"]').forEach(i => i.addEventListener('change', () => { cfg.ritme = i.value; desaCfg(); }));
    $('#btn-inici-tanca').addEventListener('click', () => tanca('#capa-inici'));
    $('#btn-inici-regles').addEventListener('click', () => obre('#capa-regles'));
    $('#btn-regles').addEventListener('click', () => obre('#capa-regles'));
    $('#btn-tanca-regles').addEventListener('click', () => tanca('#capa-regles'));
    $('#btn-nova').addEventListener('click', obreInici);
    $('#btn-final-nova').addEventListener('click', obreInici);
    $('#btn-final-mapa').addEventListener('click', () => tanca('#capa-final'));
    const pv = $('#opt-previsio');
    pv.checked = cfg.previsio;
    pv.addEventListener('change', () => { cfg.previsio = pv.checked; desaCfg(); if (e) renderTot(); });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      if (!$('#capa-regles').hidden) tanca('#capa-regles');
      else if (!$('#capa-final').hidden) tanca('#capa-final');
      else if (!$('#capa-inici').hidden && e) tanca('#capa-inici');
    });
    $('#regles-cartes').innerHTML = M.CARTES.map(c => `<dt>${c.nom}</dt><dd>${c.text}</dd>`).join('');
  }

  /* ---------- Engegada ---------- */
  construeixMapa();
  preparaInici();
  // Partida de mostra al fons mentre es tria (el mapa no queda buit)
  e = M.novaPartida({ primer: 0 });
  creaJugadors();
  actualitzaMapa();
  actualitzaJugadors(null);
  $('#accio').innerHTML = '<h3>Benvinguda</h3><p>Tria la teva casa i comença la partida.</p>';
  $('#cartes').innerHTML = '<li class="cartes-buit">Es reparteixen en començar.</li>';
  e = null;
})();
