/* =====================================================================
   Terra de Comtes · motor de regles
   Lògica pura del joc: sense DOM. Es pot provar amb Node.

   19 territoris al mapa; a cada partida se'n trien 11 a l'atzar, que
   són els Castells Majors (del 2 al 12). Els altres 8 són Castells
   Menors: tenen una fitxa amagada (grup 3, 4 o 5) i fan de pont entre
   els Castells Majors.

   Al codi, 'buit[r]' vol dir que el territori r és un Castell Menor.
   ===================================================================== */
(function (global) {
  'use strict';

  const MAPA_ = global.MAPA || (typeof require !== 'undefined' ? require('./mapa.js') : null);
  const NR = MAPA_.regions.length;            // 19 territoris
  const NJ = 4;                               // 4 jugadors
  const NSEL = 11;                            // territoris amb castell a cada partida
  const SOLDATS_INICIALS = 26;
  const REFORC = 2;                           // reforços per territori veí (3-4 jugadors)
  const CARTES_PER_PARTIDA = 5;
  const VALORS_BUITS = [3, 4, 5];             // grups de les fitxes amagades dels Castells Menors
  const GRUP_PUBLIC = 4;                      // grup esperat: el que sap qualsevol jugador abans de la guerra

  /* ---------- Punts ----------
     Castells Majors: com més difícil és treure el número amb els daus, més val.
       2, 3, 11, 12 → 6 punts: 3 al 1r, 2 al 2n, 1 al 3r
       4, 5, 9, 10  → 4 punts: 2 al 1r, 1 al 2n, 1 al 3r
       6, 7, 8      → 3 punts: 2 al 1r, 1 al 2n
     Castells Menors (fitxa amagada, grup 3, 4 o 5):
       1r = grup, 2n = grup − 2; si hi ha empat al primer lloc, grup − 1 per a cadascun */
  const PUNTS_MAJOR = v => (v <= 3 || v >= 11 ? [3, 2, 1] : v <= 5 || v >= 9 ? [2, 1, 1] : [2, 1, 0]);
  const PUNTS_MENOR = g => [g, g - 2, 0];
  const EMPAT_MENOR = g => g - 1;
  // Taula de punts per territori: p1, p2, p3 i pe (punts per empat al 1r lloc; -1 = es desfà amb l'estendard)
  function taulaPunts(valors, buit) {
    const t = { p1: new Float64Array(NR), p2: new Float64Array(NR), p3: new Float64Array(NR), pe: new Float64Array(NR) };
    for (let r = 0; r < NR; r++) {
      const p = buit[r] ? PUNTS_MENOR(valors[r]) : PUNTS_MAJOR(valors[r]);
      t.p1[r] = p[0]; t.p2[r] = p[1]; t.p3[r] = p[2];
      t.pe[r] = buit[r] ? EMPAT_MENOR(valors[r]) : -1;
    }
    return t;
  }
  const puntsDe = (e, r, publica = false) => {
    const t = publica ? e.taulaPublica : e.taula;
    return { p: [t.p1[r], t.p2[r], t.p3[r]], empat: t.pe[r] };
  };

  /* ---------- Veïnatge físic (el del mapa) ---------- */
  const fisTerra = Array.from({ length: NR }, () => []);
  const fisMar = Array.from({ length: NR }, () => []);
  for (const [a, b] of MAPA_.terra) { fisTerra[a].push(b); fisTerra[b].push(a); }
  for (const [a, b] of MAPA_.mar) { fisMar[a].push(b); fisMar[b].push(a); }
  const fisTots = fisTerra.map((l, i) => [...new Set(l.concat(fisMar[i]))]);

  // Veïnatge de joc: dos territoris triats són veïns si es toquen o si
  // entre ells només hi ha territoris buits (que fan de pont).
  function calculaVeinatge(buit) {
    const abast = (s, llista) => {
      const res = new Set(), vist = new Set([s]), cua = [];
      for (const n of llista[s]) if (buit[n]) { vist.add(n); cua.push(n); }
      while (cua.length) {
        const u = cua.shift();
        for (const w of llista[u]) {
          if (vist.has(w)) continue;
          vist.add(w);
          if (buit[w]) cua.push(w); else res.add(w);
        }
      }
      return res;
    };
    const veins = [], veinsTerra = [], veinsMar = [], pont = [];
    for (let r = 0; r < NR; r++) {
      if (buit[r]) {
        veins[r] = fisTots[r].slice(); veinsTerra[r] = fisTerra[r].slice(); veinsMar[r] = fisMar[r].slice(); pont[r] = [];
        continue;
      }
      const tots = new Set(fisTots[r]); abast(r, fisTots).forEach(x => tots.add(x));
      const terra = new Set(fisTerra[r]); abast(r, fisTerra).forEach(x => terra.add(x));
      veins[r] = [...tots].sort((a, b) => a - b);
      veinsTerra[r] = [...terra].sort((a, b) => a - b);
      veinsMar[r] = veins[r].filter(x => !terra.has(x));
      pont[r] = veins[r].filter(x => !fisTots[r].includes(x));
    }
    // A la guerra, els reforços només poden anar a Castells Majors: els Castells Menors no en reben
    const veinsReforc = veins.map(l => l.filter(n => !buit[n]));
    return { veins, veinsTerra, veinsMar, pont, veinsReforc };
  }

  /* ---------- Atzar ---------- */
  function rng(seed) {                        // mulberry32: reproduïble per a les simulacions
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = Math.random;
  const dau = (r = rand) => 1 + Math.floor(r() * 6);
  function barreja(arr, r = rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- Daus ---------- */
  const soldatsPerDau = d => (d <= 2 ? 1 : d <= 4 ? 2 : 3);

  // Les maneres (fins a 3) d'agrupar 3 daus en parella + dau sol
  function agrupacions(daus) {
    const res = [], vistos = new Set();
    for (let s = 0; s < 3; s++) {
      const p = [0, 1, 2].filter(i => i !== s);
      const suma = daus[p[0]] + daus[p[1]];
      const dauSol = daus[s];
      const clau = suma + ':' + dauSol;
      if (vistos.has(clau)) continue;
      vistos.add(clau);
      res.push({ parella: p, sol: s, suma, dauSol, quants: soldatsPerDau(dauSol), parell: dauSol % 2 === 0 });
    }
    return res;
  }

  // Probabilitat que una suma surti com a parella en una tirada de 3 daus
  const PROB_SUMA = (() => {
    const cnt = new Array(13).fill(0);
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      const s = new Set([a + b, a + c, b + c]);
      s.forEach(v => cnt[v]++);
    }
    return cnt.map(c => c / 216);
  })();

  /* ---------- Moviment opcional de la tirada ----------
     El dau sol diu quants soldats (1/2/3). Abans de desplegar, pots moure
     aquests mateixos soldats d'un territori teu a un veí:
       · dau senar → a un veí on ja tinguis soldats
       · dau parell → a un territori buit veí (no cal tenir-hi soldats) */
  function moviments(e, p, dauSol) {
    const n = soldatsPerDau(dauSol), parell = dauSol % 2 === 0;
    const res = [];
    for (let de = 0; de < NR; de++) {
      if (e.tropes[de * NJ + p] < n) continue;
      for (const a of e.veins[de]) {
        if (parell ? e.buit[a] : e.tropes[a * NJ + p] > 0) res.push({ de, a, n });
      }
    }
    return res;
  }

  /* ---------- Cartes tàctiques ---------- */
  // Cada carta enumera totes les accions possibles. Una acció té:
  //   cami: seqüència de seleccions ('r3' = territori 3, 'j2' = jugador 2) que fa la persona
  //   ops:  operacions sobre el tauler
  const CARTES = [
    { id: 'explorador', nom: 'Explorador', text: 'Mou 1 soldat teu a un territori veí (per terra o per mar).',
      passos: ['Tria el territori d’on surt el soldat', 'Tria el territori veí on va'] },
    { id: 'pas', nom: 'Pas de muntanya', text: 'Mou 2 soldats teus a un territori veí per terra.',
      passos: ['Tria el territori d’on surten els 2 soldats', 'Tria el territori veí (per terra)'] },
    { id: 'galera', nom: 'Galera', text: 'Mou 2 soldats teus a un territori veí per mar.',
      passos: ['Tria el port d’on surten els 2 soldats', 'Tria el port de destí'] },
    { id: 'reagrupar', nom: 'Reagrupament', text: 'Mou la meitat dels teus soldats d’un territori (arrodonint a la baixa) a un territori veí.',
      passos: ['Tria el territori que es reagrupa (mínim 2 soldats)', 'Tria el territori veí'] },
    { id: 'almogaver', nom: 'Almogàver', text: 'Mou 1 soldat teu a qualsevol territori on ja tinguis soldats.',
      passos: ['Tria el territori d’on surt l’almogàver', 'Tria on va (on ja tinguis soldats)'] },
    { id: 'lleva', nom: 'Lleva', text: 'Posa 1 soldat de la teva reserva en un territori on ja tinguis soldats.',
      passos: ['Tria el territori on arriba la lleva'] },
    { id: 'traicio', nom: 'Traïció', text: 'Retorna 1 soldat rival a la seva reserva i posa-hi 1 soldat teu de la reserva.',
      passos: ['Tria el territori', 'Tria el rival que et ven el soldat'] },
    { id: 'fugida', nom: 'Fugida', text: 'Mou 1 soldat rival d’un territori on tens soldats a un territori veí.',
      passos: ['Tria el territori (on tens soldats)', 'Tria el rival', 'Tria cap a quin territori veí fuig'] },
    { id: 'presoner', nom: 'Presoner', text: 'Mou 1 soldat rival de qualsevol territori a un territori veí on tens soldats.',
      passos: ['Tria el territori d’on s’endú el presoner', 'Tria el rival', 'Tria el territori veí on tens soldats'] },
    { id: 'retirada', nom: 'Retirada', text: 'Retorna 3 soldats teus del tauler a la teva reserva (poden ser de territoris diferents).',
      passos: ['Tria el 1r soldat que es retira', 'Tria el 2n soldat', 'Tria el 3r soldat'] },
  ];
  const CARTA = Object.fromEntries(CARTES.map(c => [c.id, c]));

  const T = (e, r, j) => e.tropes[r * NJ + j];

  function accionsCarta(e, id, p) {
    const acc = [];
    const meus = [];
    for (let r = 0; r < NR; r++) if (T(e, r, p) > 0) meus.push(r);
    const rivals = [0, 1, 2, 3].filter(j => j !== p);
    const V = e.veins, VT = e.veinsTerra, VM = e.veinsMar;
    switch (id) {
      case 'explorador':
        for (const de of meus) for (const a of V[de]) acc.push({ cami: ['r' + de, 'r' + a], ops: [['mou', p, de, a, 1]] });
        break;
      case 'pas':
        for (const de of meus) if (T(e, de, p) >= 2) for (const a of VT[de]) acc.push({ cami: ['r' + de, 'r' + a], ops: [['mou', p, de, a, 2]] });
        break;
      case 'galera':
        for (const de of meus) if (T(e, de, p) >= 2) for (const a of VM[de]) acc.push({ cami: ['r' + de, 'r' + a], ops: [['mou', p, de, a, 2]] });
        break;
      case 'reagrupar':
        for (const de of meus) if (T(e, de, p) >= 2) for (const a of V[de]) acc.push({ cami: ['r' + de, 'r' + a], ops: [['mou', p, de, a, Math.floor(T(e, de, p) / 2)]] });
        break;
      case 'almogaver':
        for (const de of meus) for (const a of meus) if (a !== de) acc.push({ cami: ['r' + de, 'r' + a], ops: [['mou', p, de, a, 1]] });
        break;
      case 'lleva':
        if (e.reserva[p] >= 1) for (const a of meus) acc.push({ cami: ['r' + a], ops: [['posa', p, a, 1]] });
        break;
      case 'traicio':
        if (e.reserva[p] >= 1) for (let r = 0; r < NR; r++) for (const j of rivals) if (T(e, r, j) > 0)
          acc.push({ cami: ['r' + r, 'j' + j], ops: [['treu', j, r, 1], ['posa', p, r, 1]] });
        break;
      case 'fugida':
        for (const de of meus) for (const j of rivals) if (T(e, de, j) > 0) for (const a of V[de])
          acc.push({ cami: ['r' + de, 'j' + j, 'r' + a], ops: [['mou', j, de, a, 1]] });
        break;
      case 'presoner':
        for (let de = 0; de < NR; de++) for (const j of rivals) if (T(e, de, j) > 0) for (const a of V[de]) if (T(e, a, p) > 0)
          acc.push({ cami: ['r' + de, 'j' + j, 'r' + a], ops: [['mou', j, de, a, 1]] });
        break;
      case 'retirada': {
        const n = meus.reduce((s, r) => s + T(e, r, p), 0);
        if (n < 3) break;
        for (const a of meus) for (const b of meus) for (const c of meus) {
          const usa = {}; usa[a] = (usa[a] || 0) + 1; usa[b] = (usa[b] || 0) + 1; usa[c] = (usa[c] || 0) + 1;
          if (Object.keys(usa).every(r => usa[r] <= T(e, +r, p)))
            acc.push({ cami: ['r' + a, 'r' + b, 'r' + c], ops: [['treu', p, a, 1], ['treu', p, b, 1], ['treu', p, c, 1]] });
        }
        break;
      }
    }
    return acc;
  }

  function aplicaOps(e, ops) {
    for (const op of ops) {
      if (op[0] === 'mou') { const [, j, de, a, n] = op; e.tropes[de * NJ + j] -= n; e.tropes[a * NJ + j] += n; }
      else if (op[0] === 'treu') { const [, j, de, n] = op; e.tropes[de * NJ + j] -= n; e.reserva[j] += n; }
      else if (op[0] === 'posa') { const [, j, a, n] = op; e.tropes[a * NJ + j] += n; e.reserva[j] -= n; }
    }
  }

  /* ---------- Estat de la partida ---------- */
  // Ordre de la guerra. Abans de començar es tiren dos daus blancs: la suma (2–12) és el
  // Castell Major pel qual es comença; es continua cap amunt i, després del 12, pel 2.
  // Cada Castell Menor es resol just després del Castell Major del número del seu grup.
  const posicio = (v, inici) => (v - inici + 11) % 11;
  const ordreDe = (valors, buit, inici = 2) => valors.map((v, r) => [posicio(v, inici), buit[r] ? 1 : 0, r])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map(x => x[2]);
  // Probabilitat de cada inici amb dos daus
  const PROB_INICI = Array.from({ length: 13 }, (_, s) => (s < 2 ? 0 : (6 - Math.abs(s - 7)) / 36));
  const INICIS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const ordresDe = (valors, buit) => { const o = []; for (const s of INICIS) o[s] = ordreDe(valors, buit, s); return o; };

  function novaPartida(opts = {}) {
    const r = opts.rng || rand;
    const triats = barreja([...Array(NR).keys()], r).slice(0, NSEL);
    const castells = barreja([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], r);
    const buit = new Array(NR).fill(true);
    const valors = new Array(NR);
    const regioDe = {};
    triats.forEach((t, k) => { buit[t] = false; valors[t] = castells[k]; regioDe[castells[k]] = t; });
    for (let t = 0; t < NR; t++) if (buit[t]) valors[t] = VALORS_BUITS[Math.floor(r() * VALORS_BUITS.length)];
    const valorsPublics = valors.map((v, t) => (buit[t] ? GRUP_PUBLIC : v));
    const vei = calculaVeinatge(buit);
    return {
      // dades fixes de la partida (es comparteixen entre còpies)
      buit, valors, valorsPublics, regioDe, ...vei,
      taula: taulaPunts(valors, buit), taulaPublica: taulaPunts(valorsPublics, buit),
      ordres: ordresDe(valors, buit), ordresPublics: ordresDe(valorsPublics, buit),
      inici: null, dausInici: null,                       // es fixen amb els daus blancs abans de la guerra
      // estat que canvia
      tropes: new Array(NR * NJ).fill(0),
      reserva: new Array(NJ).fill(opts.soldats || SOLDATS_INICIALS),
      estendards: new Array(NJ).fill(0),                 // 4,3,2,1 segons l'ordre en què s'acaba la reserva
      estendardsLliures: [4, 3, 2, 1],
      cartes: barreja(CARTES.map(c => c.id), r).slice(0, CARTES_PER_PARTIDA),
      cartaUsada: new Array(NJ).fill(null),
      cartesActives: true,
      torn: opts.primer != null ? opts.primer : Math.floor(r() * NJ),
      tornNum: 1,
      fase: 'desplegament',
    };
  }

  function clona(e) {
    return {
      ...e,
      tropes: e.tropes.slice(), reserva: e.reserva.slice(), estendards: e.estendards.slice(),
      estendardsLliures: e.estendardsLliures.slice(), cartes: e.cartes.slice(), cartaUsada: e.cartaUsada.slice(),
    };
  }

  const regioDeValor = (e, v) => e.regioDe[v];

  // Desplega soldats; retorna quants se n'han posat realment
  function desplega(e, p, regio, quants) {
    const n = Math.min(quants, e.reserva[p]);
    e.tropes[regio * NJ + p] += n;
    e.reserva[p] -= n;
    comprovaReserva(e, p);
    return n;
  }

  // Tirada completa: moviment opcional (mov pot ser null) i desplegament
  function jugaTirada(e, p, op, mov) {
    if (mov) { e.tropes[mov.de * NJ + p] -= mov.n; e.tropes[mov.a * NJ + p] += mov.n; }
    return desplega(e, p, e.regioDe[op.suma], op.quants);
  }

  // Tirada dels dos daus blancs que decideix per quin Castell Major comença la guerra
  function tiraInici(e, r = rand) {
    e.dausInici = [dau(r), dau(r)];
    e.inici = e.dausInici[0] + e.dausInici[1];
    return e.inici;
  }

  function comprovaReserva(e, p) {
    if (e.reserva[p] === 0 && e.estendards[p] === 0) {
      e.estendards[p] = e.estendardsLliures.shift();
      e.cartesActives = false;     // quan algú acaba, ja no es poden jugar cartes
    }
  }

  function jugaCarta(e, p, id, accio) {
    aplicaOps(e, accio.ops);
    e.cartes = e.cartes.filter(c => c !== id);
    e.cartaUsada[p] = id;
    for (let j = 0; j < NJ; j++) comprovaReserva(e, j);
  }

  const potJugarCarta = (e, p) => e.fase === 'desplegament' && e.cartesActives && !e.cartaUsada[p] && e.cartes.length > 0;

  function passaTorn(e) {
    for (let k = 1; k <= NJ; k++) {
      const j = (e.torn + k) % NJ;
      if (e.reserva[j] > 0) { if (j <= e.torn) e.tornNum++; e.torn = j; return true; }
    }
    e.fase = 'guerra';
    return false;
  }

  /* ---------- Guerra ---------- */
  // Desempat: estendard més alt. Si encara no en té (previsió), 0 i després ordre fix.
  const forcaDesempat = (est, j) => est[j] * 10 - j;

  // Reparteix els punts d'un territori. Retorna la llista de premis [{ j, lloc, punts, empat }].
  // rank: jugadors amb força > 0, ordenats per força i estendard.
  function repartiment(t, r, rank, forca) {
    const premis = [];
    if (!rank.length) return premis;
    if (t.pe[r] >= 0 && rank.length > 1 && forca[rank[1]] === forca[rank[0]]) {
      for (const j of rank) if (forca[j] === forca[rank[0]]) premis.push({ j, lloc: 1, punts: t.pe[r], empat: true });
      return premis;
    }
    const pts = [t.p1[r], t.p2[r], t.p3[r]];
    rank.slice(0, 3).forEach((j, k) => { if (pts[k] > 0) premis.push({ j, lloc: k + 1, punts: pts[k], empat: false }); });
    return premis;
  }

  // Resol la guerra i retorna el detall de cada batalla.
  // publica = true fa servir el grup esperat de les fitxes amagades (previsió).
  // inici: castell pel qual es comença; si no es diu, el dels daus blancs (i si encara no s'han tirat, es tiren).
  function resolGuerra(e, publica = false, inici = null) {
    if (inici == null) inici = e.inici != null ? e.inici : publica ? 2 : tiraInici(e);
    const valors = publica ? e.valorsPublics : e.valors;
    const ordre = (publica ? e.ordresPublics : e.ordres)[inici];
    const t = publica ? e.taulaPublica : e.taula;
    const reforc = new Array(NR * NJ).fill(0);
    const resolt = new Array(NR).fill(false);
    const punts = new Array(NJ).fill(0);
    const llocs = Array.from({ length: NJ }, () => [0, 0, 0, 0]);   // quants 1rs, 2ns, 3rs (índex 1-3)
    const batalles = [];
    for (const r of ordre) {
      const v = valors[r];
      const forca = [0, 1, 2, 3].map(j => e.tropes[r * NJ + j] + reforc[r * NJ + j]);
      resolt[r] = true;
      if (forca.every(f => f === 0)) {
        if (!e.buit[r]) batalles.push({ regio: r, valor: v, buida: true, buit: false, forca, premis: [] });
        continue;
      }
      const rank = [0, 1, 2, 3].filter(j => forca[j] > 0)
        .sort((a, b) => forca[b] - forca[a] || forcaDesempat(e.estendards, b) - forcaDesempat(e.estendards, a));
      const g = rank[0];
      const premis = repartiment(t, r, rank, forca);
      for (const pr of premis) { punts[pr.j] += pr.punts; llocs[pr.j][pr.lloc]++; }
      const repartit = premis.length > 0 && premis[0].empat;
      const empat = !repartit && rank.length > 1 && forca[rank[0]] === forca[rank[1]];
      const envia = [];
      for (const n of e.veinsReforc[r]) if (!resolt[n] && e.tropes[n * NJ + g] > 0) { reforc[n * NJ + g] += REFORC; envia.push(n); }
      batalles.push({ regio: r, valor: v, buit: e.buit[r], forca, tropes: [0, 1, 2, 3].map(j => e.tropes[r * NJ + j]),
        reforcos: [0, 1, 2, 3].map(j => reforc[r * NJ + j]), guanyador: g, premis, repartit, empat, envia });
    }
    const classif = [0, 1, 2, 3].sort((a, b) => punts[b] - punts[a] || e.estendards[b] - e.estendards[a]);
    return { batalles, punts, llocs, classificacio: classif, inici };
  }

  // Previsió abans de la guerra: com que no se sap per on es començarà, es fa la mitjana
  // de tots els inicis possibles, ponderada per la probabilitat dels dos daus blancs.
  function previsio(e) {
    const punts = new Array(NJ).fill(0);
    const pesos = Array.from({ length: NR }, () => new Array(NJ).fill(0));
    for (const s of INICIS) {
      const w = PROB_INICI[s], res = resolGuerra(e, true, s);
      for (let j = 0; j < NJ; j++) punts[j] += w * res.punts[j];
      for (const b of res.batalles) if (!b.buida) pesos[b.regio][b.guanyador] += w;
    }
    const guanyador = {}, prob = {};
    for (let r = 0; r < NR; r++) {
      let mj = -1, mw = 0;
      for (let j = 0; j < NJ; j++) if (pesos[r][j] > mw) { mw = pesos[r][j]; mj = j; }
      if (mj >= 0) { guanyador[r] = mj; prob[r] = mw; }
    }
    return { punts, guanyador, prob, pesos };
  }

  // Versió ràpida per als bots: només punts finals (escriu a 'out'). 'veins' ha de ser e.veinsReforc.
  const _ref = new Int16Array(NR * NJ), _res = new Uint8Array(NR);
  const _ord = new Int8Array(NJ), _key = new Float64Array(NJ), _f = new Int16Array(NJ);
  function puntsRapids(t, ordre, tropes, est, out, veins) {
    _ref.fill(0); _res.fill(0); out[0] = out[1] = out[2] = out[3] = 0;
    for (let k = 0; k < NR; k++) {
      const r = ordre[k], b = r * NJ;
      _res[r] = 1;
      let n = 0;
      for (let j = 0; j < NJ; j++) {
        const f = tropes[b + j] + _ref[b + j];
        _f[j] = f;
        if (f <= 0) continue;
        const key = f * 100 + est[j] * 10 - j + 10;
        let i = n++;
        while (i > 0 && _key[i - 1] < key) { _key[i] = _key[i - 1]; _ord[i] = _ord[i - 1]; i--; }
        _key[i] = key; _ord[i] = j;
      }
      if (n === 0) continue;
      const g = _ord[0];
      if (t.pe[r] >= 0 && n > 1 && _f[_ord[1]] === _f[g]) {
        for (let i = 0; i < n && _f[_ord[i]] === _f[g]; i++) out[_ord[i]] += t.pe[r];
      } else {
        out[g] += t.p1[r];
        if (n > 1) out[_ord[1]] += t.p2[r];
        if (n > 2) out[_ord[2]] += t.p3[r];
      }
      const vs = veins[r];
      for (let i = 0; i < vs.length; i++) { const m = vs[i]; if (!_res[m] && tropes[m * NJ + g] > 0) _ref[m * NJ + g] += REFORC; }
    }
    return out;
  }

  const API = {
    NR, NJ, NSEL, SOLDATS_INICIALS, REFORC, CARTES, CARTA, PROB_SUMA, VALORS_BUITS, GRUP_PUBLIC,
    PUNTS_MAJOR, PUNTS_MENOR, EMPAT_MENOR, taulaPunts, puntsDe, repartiment,
    fisTerra, fisMar, fisTots, calculaVeinatge, rng, dau, barreja, soldatsPerDau, agrupacions, moviments,
    accionsCarta, aplicaOps, novaPartida, clona, regioDeValor, desplega, jugaTirada, jugaCarta, potJugarCarta,
    passaTorn, resolGuerra, previsio, tiraInici, puntsRapids, ordreDe, PROB_INICI, INICIS, comprovaReserva,
  };
  global.Motor = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
