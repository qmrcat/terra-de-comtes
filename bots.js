/* =====================================================================
   Terra de Comtes · bots
   Cada bot avalua les opcions simulant moltes partides fins al final
   (Monte Carlo) i hi afegeix el seu caràcter: biaixos, errors humans,
   ganes de tornar a tirar i de jugar cartes.
   Els bots no fan trampa: de les fitxes amagades dels Castells Menors
   només en saben el grup esperat (4), igual que la persona.
   ===================================================================== */
(function (global) {
  'use strict';
  const M = global.Motor || (typeof require !== 'undefined' ? require('./motor.js') : null);
  const { NR, NJ } = M;

  /* ---------- Caràcters ---------- */
  const CARACTERS = {
    estratega: {
      etiqueta: 'Estratega', descr: 'Calcula molt i rarament s’equivoca.',
      biaixValor: 0, margeRetirada: 0.6, llindarCarta: 2.2, soroll: 0.5, gustMoure: 0,
      frases: {
        tria: ['Ho tinc calculat.', 'Pas a pas.', 'Així, sense presses.', 'Una peça més al seu lloc.'],
        alta: ['%c val la pena.', 'El castell de %c serà clau.'],
        mou: ['Recol·loco les tropes.', 'Millor tenir-los a %c.'],
        buit: ['%c pot amagar alguna cosa.', 'Ocupem %c, per si de cas.'],
        retira: ['Prefereixo tornar a tirar.', 'Això no m’agrada. Una altra.'],
        carta: ['És el moment de la %t.', 'Juguem la %t.'],
        acaba: ['Les meves hosts ja són al camp.', 'He desplegat tothom.'],
      },
    },
    agosarat: {
      etiqueta: 'Agosarat', descr: 'Va a pels castells que valen més i torna a tirar sovint.',
      biaixValor: 0.18, margeRetirada: -0.4, llindarCarta: 3.2, soroll: 1.1, gustMoure: 0.3,
      frases: {
        tria: ['Endavant!', 'Que tremolin!', 'Ni un pas enrere.', 'Som-hi, que és tard!'],
        alta: ['%c és meu!', 'Tothom a %c!', 'Qui vulgui %c, que vingui a buscar-lo.'],
        mou: ['A marxes forçades cap a %c!', 'Ningú no m’atura.'],
        buit: ['Planto bandera a %c!', '%c, terra conquerida!'],
        retira: ['Quina misèria de daus! Torno a tirar.', 'Això no és digne d’un comte. Una altra!'],
        carta: ['Ara veureu: %t!', '%t, i que tremoli la terra!'],
        acaba: ['Totes les meves hosts a punt de guerra!'],
      },
    },
    murri: {
      etiqueta: 'Murri', descr: 'Li encanten les cartes i les jugades enrevessades.',
      biaixValor: -0.05, margeRetirada: 0.2, llindarCarta: 0.9, soroll: 0.8, gustMoure: 0.5,
      frases: {
        tria: ['Hmm, interessant…', 'Ja veureu, ja.', 'Que no es noti gaire.', 'Discretament.'],
        alta: ['Potser %c no està tan ben defensat…', 'M’hi colo a %c.'],
        mou: ['Uns quants cap a %c, sense fer soroll.', 'On menys us ho espereu.'],
        buit: ['Què hi deu haver a %c?', 'A %c no hi mira ningú…'],
        retira: ['Millor no ensenyar les cartes encara.', 'Tornem-hi.'],
        carta: ['Sorpresa: %t.', 'Tenia guardada la %t…'],
        acaba: ['Ja he fet la meva. Ara, a esperar.'],
      },
    },
  };

  const NIVELLS = {
    facil:   { R: 6,  mostres: 4,  sorollExtra: 3.0, error: 0.18, movs: 1 },
    normal:  { R: 28, mostres: 8,  sorollExtra: 1.0, error: 0.05, movs: 2 },
    dificil: { R: 80, mostres: 12, sorollExtra: 0,   error: 0,    movs: 3 },
  };

  /* ---------- Simulació ---------- */
  const _out = new Float64Array(4);
  const _out2 = new Float64Array(4);

  function valorFinal(punts, est, p) {
    let mx = -1, guanya = true;
    for (let j = 0; j < NJ; j++) if (j !== p) {
      if (punts[j] > mx) mx = punts[j];
      if (punts[j] > punts[p] || (punts[j] === punts[p] && est[j] > est[p])) guanya = false;
    }
    // ×3: els punts d'aquesta versió són petits; així el soroll i els llindars dels caràcters conserven la mida
    return 3 * (punts[p] - mx) + (guanya ? 6 : 0);
  }
  // Valor de l'estat si la guerra comencés ara: mitjana sobre els 11 inicis possibles
  // dels daus blancs (o l'inici real, si ja s'han tirat).
  function estatic(e, p) {
    if (e.inici != null) {
      M.puntsRapids(e.taulaPublica, e.ordresPublics[e.inici], e.tropes, e.estendards, _out, e.veinsReforc);
      return valorFinal(_out, e.estendards, p);
    }
    let v = 0;
    for (const s of M.INICIS) {
      M.puntsRapids(e.taulaPublica, e.ordresPublics[s], e.tropes, e.estendards, _out, e.veinsReforc);
      v += M.PROB_INICI[s] * valorFinal(_out, e.estendards, p);
    }
    return v;
  }

  // Juga la partida fins al final amb una política golafre amb una mica d'atzar
  // (a les simulacions només es despleguen soldats: sense moviments ni cartes)
  function simula(e, p, rnd) {
    const tropes = Int16Array.from(e.tropes);
    const res = e.reserva.slice(), est = e.estendards.slice(), lliures = e.estendardsLliures.slice();
    // cada simulació sorteja per on començarà la guerra (dos daus blancs)
    const inici = e.inici != null ? e.inici : 2 + ((rnd() * 6) | 0) + ((rnd() * 6) | 0);
    const taula = e.taulaPublica, ordre = e.ordresPublics[inici], veins = e.veinsReforc, regioDe = e.regioDe;
    let torn = e.torn, queden = res[0] + res[1] + res[2] + res[3];
    const daus = [0, 0, 0];
    while (queden > 0) {
      if (res[torn] > 0) {
        daus[0] = 1 + ((rnd() * 6) | 0); daus[1] = 1 + ((rnd() * 6) | 0); daus[2] = 1 + ((rnd() * 6) | 0);
        let millorR = -1, millorN = 0, millorV = -1e9;
        const atzar = rnd() < 0.2 ? (rnd() * 3) | 0 : -1;
        for (let s = 0; s < 3; s++) {
          const a = s === 0 ? 1 : 0, b = s === 2 ? 1 : 2;
          const r = regioDe[daus[a] + daus[b]];
          const d = daus[s], n = Math.min(d <= 2 ? 1 : d <= 4 ? 2 : 3, res[torn]);
          if (atzar >= 0) { if (s === atzar) { millorR = r; millorN = n; } continue; }
          tropes[r * NJ + torn] += n;
          M.puntsRapids(taula, ordre, tropes, est, _out2, veins);
          tropes[r * NJ + torn] -= n;
          let mx = -1; for (let j = 0; j < NJ; j++) if (j !== torn && _out2[j] > mx) mx = _out2[j];
          const v = _out2[torn] - mx;
          if (v > millorV) { millorV = v; millorR = r; millorN = n; }
        }
        tropes[millorR * NJ + torn] += millorN;
        res[torn] -= millorN; queden -= millorN;
        if (res[torn] === 0 && est[torn] === 0) est[torn] = lliures.shift();
      }
      torn = (torn + 1) % NJ;
    }
    M.puntsRapids(taula, ordre, tropes, est, _out, veins);
    return valorFinal(_out, est, p);
  }

  function valorEstat(e, p, R, llavor) {
    if (e.fase === 'guerra') return estatic(e, p);
    let t = 0;
    for (let i = 0; i < R; i++) t += simula(e, p, M.rng(llavor + i * 7919));
    return t / R;
  }

  /* ---------- El bot ---------- */
  class Bot {
    constructor(p, caracter, nivell) {
      this.p = p; this.caracter = caracter; this.c = CARACTERS[caracter]; this.n = NIVELLS[nivell] || NIVELLS.normal;
    }
    soroll() { return (Math.random() - 0.5) * 2 * (this.c.soroll + this.n.sorollExtra); }

    // Totes les jugades raonables per a uns daus: agrupació + moviment opcional
    candidats(e, daus) {
      const p = this.p, res = [];
      for (const op of M.agrupacions(daus)) {
        const fes = mov => { const c = M.clona(e); M.jugaTirada(c, p, op, mov); return c; };
        const base = fes(null);
        res.push({ op, mov: null, estat: base, st: estatic(base, p) });
        const movs = M.moviments(e, p, op.dauSol).map(mov => {
          const c = fes(mov);
          return { op, mov, estat: c, st: estatic(c, p) + this.c.gustMoure * 0.5 };
        }).sort((a, b) => b.st - a.st).slice(0, this.n.movs);
        res.push(...movs);
      }
      return res;
    }

    valorCand(cd, R, llavor) {
      const c = M.clona(cd.estat);
      M.passaTorn(c);
      return valorEstat(c, this.p, R, llavor);
    }

    // Decideix què fer amb una tirada. Retorna { retira: true } o { op, mov }
    decideixTirada(e, daus, potRetirar) {
      const cands = this.candidats(e, daus);
      const R = this.n.R, R2 = Math.max(4, (R / 2) | 0);
      if (potRetirar) {
        const llavor = (Math.random() * 1e9) | 0;
        const millorSt = cs => cs.reduce((a, b) => (b.st > a.st ? b : a));
        const ara = this.valorCand(millorSt(cands), R2, llavor);
        let suma = 0;
        for (let i = 0; i < this.n.mostres; i++) {
          const d = [M.dau(), M.dau(), M.dau()];
          suma += this.valorCand(millorSt(this.candidats(e, d)), R2, llavor);
        }
        const despres = suma / this.n.mostres;
        if (despres > ara + this.c.margeRetirada + 0.6 + this.soroll() * 0.3) return { retira: true };
      }
      const llavor = (Math.random() * 1e9) | 0;          // mateixes llavors per a totes les opcions
      const av = cands.map(cd => ({
        cd,
        v: this.valorCand(cd, R, llavor) + this.c.biaixValor * (Math.abs(cd.op.suma - 7) - 2.5) * cd.op.quants + this.soroll(),
      })).sort((a, b) => b.v - a.v);
      const tria = av.length > 1 && Math.random() < this.n.error ? av[1] : av[0];
      return { op: tria.cd.op, mov: tria.cd.mov };
    }

    // Decideix si juga carta. Retorna { id, accio } o null
    decideixCarta(e) {
      const p = this.p;
      if (!M.potJugarCarta(e, p)) return null;
      const candidats = [];
      const vistos = new Set();
      const base = estatic(e, p);
      for (const id of e.cartes) {
        for (const ac of M.accionsCarta(e, id, p)) {
          const c = M.clona(e);
          M.jugaCarta(c, p, id, ac);
          const clau = id + '|' + c.tropes.join(',') + '|' + c.reserva.join(',');
          if (vistos.has(clau)) continue;
          vistos.add(clau);
          candidats.push({ id, ac, c, st: estatic(c, p) - base });
        }
      }
      if (!candidats.length) return null;
      candidats.sort((a, b) => b.st - a.st);
      const R = this.n.R, llavor = (Math.random() * 1e9) | 0;
      const ref = valorEstat(e, p, R, llavor);               // valor de simplement tirar els daus
      let millor = null;
      for (const cd of candidats.slice(0, 4)) {
        M.passaTorn(cd.c);
        const v = valorEstat(cd.c, p, R, llavor) + this.soroll() * 0.5;
        if (!millor || v > millor.v) millor = { v, cd };
      }
      const progres = e.reserva[p] / M.SOLDATS_INICIALS;      // com més aviat, més exigent
      const llindar = this.c.llindarCarta * (0.45 + 0.75 * progres) + 0.4;
      if (millor.v - ref > llindar) return { id: millor.cd.id, accio: millor.cd.ac, guany: millor.v - ref };
      return null;
    }

    frase(tipus, dades = {}) {
      const l = this.c.frases[tipus];
      if (!l) return '';
      let f = l[Math.floor(Math.random() * l.length)];
      if (dades.comtat) f = f.replace('%c', dades.comtat);
      if (dades.carta) f = f.replace('%t', dades.carta);
      return f;
    }
  }

  const API = { Bot, CARACTERS, NIVELLS, simula, valorEstat };
  global.Bots = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
