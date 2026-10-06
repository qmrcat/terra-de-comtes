# Terra de Comtes

Joc de daus i control de territori per al navegador, inspirat en el joc de taula
[*Rumble Nation*](https://boardgamegeek.com/boardgame/266722/rumble-nation).
Jugues tu contra tres bots en un mapa de 19 territoris,
del Rosselló a Alacant, amb Mallorca, Menorca i les Pitiüses.

No fa servir cap framework ni cal instal·lar res. És HTML, CSS i JavaScript sense
dependències, separats en fitxers.

## Com s'hi juga

1. Descomprimeix la carpeta.
2. Obre `index.html` amb qualsevol navegador modern (Chrome, Firefox, Edge o Safari).

No cal servidor. Si tens internet, les tipografies es carreguen de Google Fonts; si
no en tens, el joc funciona igual amb les tipografies del sistema.

## Regles

### Objectiu

Fer més punts que ningú. El mapa té 19 territoris. A cada partida, 11 triats a
l'atzar són **Castells Majors**, numerats del 2 al 12. Els altres 8 són
**Castells Menors**.

### Castells Majors

Com més difícil és treure el número amb dos daus, més punts reparteix el castell:

| Número | Valor | 1r | 2n | 3r |
| --- | --- | --- | --- | --- |
| 2, 3, 11, 12 | 6 | 3 | 2 | 1 |
| 4, 5, 9, 10 | 4 | 2 | 1 | 1 |
| 6, 7, 8 | 3 | 2 | 1 | – |

Del quart lloc en avall no es guanya res. Si hi ha empat de força, l'estendard més
alt queda per davant. Al mapa, la medalla de cada castell major mostra el seu valor
(daurada 6, platejada 4, bronze 3).

### Castells Menors

Cadascun té una fitxa cap per avall que ningú no coneix fins a la guerra. N'hi ha de
tres grups, a l'atzar:

| Fitxa | 1r | 2n | Empat al 1r lloc |
| --- | --- | --- | --- |
| Grup 3 | 3 | 1 | 2 cadascú |
| Grup 4 | 4 | 2 | 3 cadascú |
| Grup 5 | 5 | 3 | 4 cadascú |

- **Fan de pont.** Dos castells majors separats només per castells menors es
  consideren veïns. Això val per als moviments, les cartes i els reforços.
- **Es poden ocupar.** Si hi arriben soldats, a la guerra es lluita per la fitxa. El
  tercer i els següents no guanyen res. Si hi ha empat al primer lloc, tots els
  empatats cobren el valor d'empat i no hi ha segon.

### 1. Desplegament

Cada casa té **26 soldats**. Al teu torn tries una de dues accions.

**Tirar els daus.** Tires 3 daus. Si no t'agraden, els pots tornar a tirar tots una
vegada. Després agrupes dos daus i en deixes un de sol:

- La suma dels dos daus indica el castell major on vas.
- El dau sol indica quants soldats hi poses: 1–2 → 1 soldat, 3–4 → 2, 5–6 → 3.

Abans de desplegar pots fer un **moviment opcional** amb aquest mateix nombre de
soldats, des d'un territori on en tinguis prou:

- Si el dau sol és **senar**: cap a un territori veí on ja tinguis soldats.
- Si és **parell**: cap a un castell menor veí, encara que no hi tinguis ningú.

**Jugar una carta tàctica.** Cada casa en pot jugar una sola en tota la partida. Només
es poden jugar mentre ningú no hagi acabat la reserva.

Qui posa el seu últim soldat pren l'**estendard** més alt que quedi (IV, III, II, I) i
ja no juga més torns. L'estendard desfà els empats.

### 2. Guerra

Quan tothom ha desplegat, es tiren **dos daus blancs**. La suma diu per quin castell
major comença la guerra; es continua pel número següent i, després del 12, pel 2. Per
exemple, si surt un 5, l'ordre és 5, 6, 7… 12, 2, 3 i l'últim és el 4.

Després es giren les fitxes dels castells menors. Cada castell menor es resol just
després del castell major del número del seu grup (3, 4 o 5).

- La força de cada casa és soldats + reforços.
- Qui queda primer envia **2 reforços** a cada castell major veí encara no resolt on
  tingui soldats. Per això els territoris que es resolen abans poden decidir els
  següents.
- Els castells menors **no reben reforços**, però qui en guanya un sí que n'envia als
  castells majors veïns.
- En un empat al primer lloc d'un castell menor, els reforços els envia qui té
  l'estendard més alt.

### Cartes tàctiques

A cada partida n'hi ha 5 a l'atzar d'aquestes 10:

| Carta | Efecte |
| --- | --- |
| Explorador | Mou 1 soldat teu a un territori veí (per terra o per mar). |
| Pas de muntanya | Mou 2 soldats teus a un territori veí per terra. |
| Galera | Mou 2 soldats teus a un territori veí per mar. |
| Reagrupament | Mou la meitat dels teus soldats d'un territori a un veí. |
| Almogàver | Mou 1 soldat teu a qualsevol territori on ja tinguis soldats. |
| Lleva | Posa 1 soldat de la reserva on ja tinguis soldats. |
| Traïció | Retorna 1 soldat rival a la seva reserva i posa-hi 1 dels teus. |
| Fugida | Mou 1 soldat rival d'un territori on tens soldats a un veí. |
| Presoner | Mou 1 soldat rival de qualsevol territori a un veí on tens soldats. |
| Retirada | Retorna 3 soldats teus del tauler a la reserva. |

## Diferències amb el joc de taula

- Una persona juga contra tres bots.
- Mapa propi de 19 territoris en lloc dels 11 del Japó; només 11 són castells majors
  a cada partida.
- Puntuació segons la probabilitat dels daus, amb premi per al tercer lloc.
- Dos daus blancs decideixen per quin castell comença la guerra.
- Castells menors amb fitxes amagades que fan de pont.
- Moviment opcional segons si el dau sol és parell o senar.
- 26 soldats per casa en lloc de 18.
- 10 de les 12 cartes originals, adaptades. No hi ha l'entrada a la capital ni la finta.
- **Previsió en directe** (es pot desactivar): el mapa pinta qui guanyaria cada
  territori si la guerra comencés ara, i cada casa mostra uns punts aproximats. Les
  fitxes amagades hi compten com si fossin del grup 4, i com que encara no se sap
  per on començarà la guerra, la previsió fa la mitjana de tots els inicis possibles
  segons la probabilitat dels daus blancs.
- La guerra es resol animada, batalla a batalla.

## Els bots

Cada bot decideix simulant moltes partides fins al final (Monte Carlo) i triant
l'opció que de mitjana li dona més avantatge. No fan trampa: de les fitxes amagades
només en saben el grup esperat, i tampoc no saben per on començarà la guerra; cada
simulació sorteja els daus blancs.

Cada bot té un **caràcter**:

| Caràcter | Com juga |
| --- | --- |
| Estratega | Calcula molt i rarament s'equivoca. |
| Agosarat | Va a pels castells que valen més i torna a tirar sovint. |
| Murri | Li agraden les cartes i els moviments enrevessats. |

I hi ha tres **nivells**. En els fàcils els bots simulen menys i s'equivoquen de tant
en tant, com ho faria una persona.

| Nivell | Simulacions per opció | Errors |
| --- | --- | --- |
| Fàcil | 6 | 18 % de vegades tria la segona opció |
| Normal | 28 | 5 % |
| Difícil | 80 | cap |

## Estructura del projecte

```
terra-de-comtes/
├── index.html   Estructura de la pàgina, finestres d'inici, regles i resultat
├── estil.css    Estils (tema fosc únic, adaptat a mòbil)
├── mapa.js      Dades del mapa: contorns SVG, centres i fronteres dels 19 territoris
├── motor.js     Regles del joc, sense DOM (es pot fer servir des de Node)
├── bots.js      Intel·ligència dels bots
└── ui.js        Interfície: mapa, torns, animacions i guerra
```

Els scripts es carreguen en aquest ordre: `mapa.js`, `motor.js`, `bots.js`, `ui.js`.
Cada un exposa un objecte global (`MAPA`, `Motor`, `Bots`) que fa servir el següent.

### Provar el motor amb Node

`mapa.js`, `motor.js` i `bots.js` també funcionen com a mòduls de Node, cosa útil per
simular partides sense navegador:

```js
const M = require('./motor.js');
const B = require('./bots.js');

const e = M.novaPartida();
const bots = [0, 1, 2, 3].map(j => new B.Bot(j, 'estratega', 'normal'));

while (e.fase === 'desplegament') {
  const bot = bots[e.torn];
  const carta = bot.decideixCarta(e);
  if (carta) {
    M.jugaCarta(e, e.torn, carta.id, carta.accio);
  } else {
    let daus = [M.dau(), M.dau(), M.dau()];
    let d = bot.decideixTirada(e, daus, true);
    if (d.retira) {
      daus = [M.dau(), M.dau(), M.dau()];
      d = bot.decideixTirada(e, daus, false);
    }
    M.jugaTirada(e, e.torn, d.op, d.mov);
  }
  M.passaTorn(e);
}

console.log(M.resolGuerra(e).punts);
```

## Personalitzar

- **Constants del joc** (soldats, castells majors, reforços, cartes per partida,
  grups de les fitxes) i les **taules de punts** (`PUNTS_MAJOR`, `PUNTS_MENOR`,
  `EMPAT_MENOR`): al principi de `motor.js`.
- **Nivells i caràcters dels bots**, i les frases que diuen: `NIVELLS` i
  `CARACTERS` a `bots.js`.
- **Colors i tipografies**: les variables de `:root` a `estil.css`.
- **Mapa**: `mapa.js` és generat. Conté els contorns de cada territori (`d`), el punt
  on va la fitxa (`cx`, `cy`), les fronteres per terra (`terra`) i les rutes per mar
  (`mar`). Per afegir una ruta per mar n'hi ha prou d'afegir el parell d'índexs a
  `mar`.

## Configuració desada

El navegador recorda el teu nom, la casa, el nivell, el ritme i si vols la previsió
(`localStorage`, clau `terra-de-comtes`). Si el navegador no ho permet, el joc
funciona igual però no ho recorda.

## Crèdits

Mecànica basada en el joc de taula *Rumble Nation*. Aquest projecte és una adaptació
lliure sense afiliació amb l'editorial ni amb els autors.
