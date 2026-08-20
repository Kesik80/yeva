/* words.js — общий словарь для всех игр YEVA.
   Подключается ДО основного скрипта страницы:
       <script src="words.js"></script>

   Правит только этот файл: игра и voicegen читают отсюда,
   так что списки не могут разъехаться.

   Поля животного:
     e  — эмодзи в пузыре
     s  — какой звук играет при лопании (набор звуков живёт в bubbles.html)
     ru — русское название
     de — немецкое с артиклем; из него же строится имя файла:
          'die Katze' -> voice/de/katze.mp3

   Доступные s: meow woof moo baa oink cluck neigh quack ribbit tweet
                buzz bloop zap hoot squeak growl chirp
*/
(function () {
  'use strict';

  const A = (e, s, ru, de) => ({ e: e, s: s, ru: ru, de: de });

  // Части тела. part — область на фигурке в koerper.html.
  // easy: первый круг, самые узнаваемые. e — эмодзи для пузырей и Memory
  // (у некоторых его нет, такие в пузырях не появляются).
  const B = (part, s, ru, de, easy, e) => ({ part: part, s: s, ru: ru, de: de, easy: !!easy, e: e || '' });
  const BODY = [
    B('kopf',     'ding',  'голова', 'der Kopf',     1, '\u{1F642}'),
    B('auge',     'ding',  'глаз',   'das Auge',     1, '\u{1F441}\u{FE0F}'),
    B('nase',     'squeak','нос',    'die Nase',     1, '\u{1F443}'),
    B('mund',     'nom',   'рот',    'der Mund',     1, '\u{1F444}'),
    B('ohr',      'ding',  'ухо',    'das Ohr',      1, '\u{1F442}'),
    B('hand',     'ding',  'рука',   'die Hand',     1, '\u{270B}'),
    B('bauch',    'nom',   'живот',  'der Bauch',    1, ''),
    B('fuss',     'brum',  'нога',   'der Fuß',      1, '\u{1F9B6}'),
    B('haar',     'swish', 'волосы', 'das Haar',     0, ''),
    B('arm',      'ding',  'ручка',  'der Arm',      0, '\u{1F4AA}'),
    B('bein',     'brum',  'ножка',  'das Bein',     0, '\u{1F9B5}'),
    B('knie',     'ding',  'колено', 'das Knie',     0, ''),
    B('schulter', 'swish', 'плечо',  'die Schulter', 0, ''),
    B('hals',     'ding',  'шея',    'der Hals',     0, ''),
    B('zahn',     'cluck', 'зуб',    'der Zahn',     0, '\u{1F9B7}'),
    B('zunge',    'bloop', 'язык',   'die Zunge',    0, '\u{1F445}')
  ];

  // Числа. Артикля нет, поэтому в voicegen они попадут к мужскому голосу.
  // e не задаём — в карточные игры и пузыри числа не идут.
  const N = (n, de, e) => ({ num: n, de: de, ru: String(n), s: 'ding', e: e });
  const NUMBERS = [
    N(0,  'null',   '\u0030\u{FE0F}\u{20E3}'),
    N(1,  'eins',   '\u0031\u{FE0F}\u{20E3}'),
    N(2,  'zwei',   '\u0032\u{FE0F}\u{20E3}'),
    N(3,  'drei',   '\u0033\u{FE0F}\u{20E3}'),
    N(4,  'vier',   '\u0034\u{FE0F}\u{20E3}'),
    N(5,  'fünf',   '\u0035\u{FE0F}\u{20E3}'),
    N(6,  'sechs',  '\u0036\u{FE0F}\u{20E3}'),
    N(7,  'sieben', '\u0037\u{FE0F}\u{20E3}'),
    N(8,  'acht',   '\u0038\u{FE0F}\u{20E3}'),
    N(9,  'neun',   '\u0039\u{FE0F}\u{20E3}'),
    N(10, 'zehn',   '\u{1F51F}')
  ];

  window.YEVA_WORDS = {
    version: 5,
    numbers: NUMBERS,
    body: BODY,

    // фоновые украшения для миров, где вместо облаков что-то своё
    decor: {
      sea:   ['\u{1F41F}', '\u{1F420}', '\u{1FAB8}', '\u{1F41A}'],
      space: ['\u{1FA90}', '\u{2B50}', '\u{2604}\u{FE0F}']
    },

    // миры меняются каждые два уровня
    worlds: [
      {
        id: 'wiese', css: '', night: false, decor: 'clouds',
        animals: [
          A('\u{1F431}', 'meow',   'кошка',     'die Katze'),
          A('\u{1F436}', 'woof',   'собака',    'der Hund'),
          A('\u{1F42E}', 'moo',    'корова',    'die Kuh'),
          A('\u{1F411}', 'baa',    'овечка',    'das Schaf'),
          A('\u{1F410}', 'baa',    'козочка',   'die Ziege'),
          A('\u{1F437}', 'oink',   'поросёнок', 'das Schwein'),
          A('\u{1F414}', 'cluck',  'курочка',   'das Huhn'),
          A('\u{1F986}', 'quack',  'утка',      'die Ente'),
          A('\u{1F434}', 'neigh',  'лошадка',   'das Pferd'),
          A('\u{1F42D}', 'squeak', 'мышка',     'die Maus'),
          A('\u{1F41D}', 'buzz',   'пчела',     'die Biene'),
          A('\u{1F438}', 'ribbit', 'лягушка',   'der Frosch'),
          A('\u{1F426}', 'tweet',  'птичка',    'der Vogel')
        ]
      },
      {
        id: 'wald', css: 'sky1', night: false, decor: 'clouds',
        animals: [
          A('\u{1F430}', 'squeak', 'зайчик',        'der Hase'),
          A('\u{1F98A}', 'squeak', 'лисичка',       'der Fuchs'),
          A('\u{1F43F}\u{FE0F}', 'chirp', 'белочка', 'das Eichhörnchen'),
          A('\u{1F98C}', 'squeak', 'олень',         'das Reh'),
          A('\u{1F43B}', 'growl',  'мишка',         'der Bär'),
          A('\u{1F994}', 'chirp',  'ёжик',          'der Igel'),
          A('\u{1F98B}', 'tweet',  'бабочка',       'der Schmetterling'),
          A('\u{1F40C}', 'bloop',  'улитка',        'die Schnecke'),
          A('\u{1F41E}', 'chirp',  'божья коровка', 'der Marienkäfer'),
          A('\u{1F417}', 'oink',   'кабанчик',      'das Wildschwein'),
          A('\u{1F426}', 'tweet',  'птичка',        'der Vogel')
        ]
      },
      {
        id: 'nacht', css: 'sky2', night: true, decor: 'stars',
        animals: [
          A('\u{1F989}', 'hoot',   'сова',         'die Eule'),
          A('\u{1F987}', 'squeak', 'летучая мышь', 'die Fledermaus'),
          A('\u{1F43A}', 'growl',  'волк',         'der Wolf'),
          A('\u{1F99D}', 'chirp',  'енот',         'der Waschbär'),
          A('\u{1F431}', 'meow',   'кошка',        'die Katze'),
          A('\u{1F42D}', 'squeak', 'мышка',        'die Maus'),
          A('\u{1F994}', 'chirp',  'ёжик',         'der Igel'),
          A('\u{1F98C}', 'squeak', 'олень',        'das Reh')
        ]
      },
      {
        id: 'meer', css: 'sea', night: false, decor: 'sea',
        animals: [
          A('\u{1F41F}', 'bloop',  'рыбка',     'der Fisch'),
          A('\u{1F421}', 'bloop',  'рыба-шар',  'der Kugelfisch'),
          A('\u{1F419}', 'bloop',  'осьминог',  'der Krake'),
          A('\u{1F980}', 'chirp',  'крабик',    'die Krabbe'),
          A('\u{1F422}', 'bloop',  'черепаха',  'die Schildkröte'),
          A('\u{1F42C}', 'squeak', 'дельфин',   'der Delfin'),
          A('\u{1F433}', 'moo',    'кит',       'der Wal'),
          A('\u{1F991}', 'bloop',  'кальмар',   'der Tintenfisch'),
          A('\u{1F99E}', 'chirp',  'омар',      'der Hummer'),
          A('\u{1F990}', 'chirp',  'креветка',  'die Garnele'),
          A('\u{1F9AD}', 'baa',    'тюлень',    'die Robbe'),
          A('\u{1F988}', 'growl',  'акула',     'der Hai'),
          A('\u{1F427}', 'quack',  'пингвин',   'der Pinguin')
        ]
      },
      {
        id: 'weltraum', css: 'space', night: true, decor: 'space',
        animals: [
          A('\u{1F680}', 'zap',   'ракета',        'die Rakete'),
          A('\u{1F47D}', 'zap',   'инопланетянин', 'das Alien'),
          A('\u{1FA90}', 'bloop', 'планета',       'der Planet'),
          A('\u{2B50}',  'tweet', 'звёздочка',     'der Stern'),
          A('\u{1F6F8}', 'zap',   'тарелка',       'das Ufo'),
          A('\u{2604}\u{FE0F}', 'zap', 'комета',   'der Komet'),
          A('\u{1F319}', 'hoot',  'луна',          'der Mond'),
          A('\u{2600}\u{FE0F}', 'tweet', 'солнышко','die Sonne'),
          A('\u{1F916}', 'cluck', 'робот',         'der Roboter'),
          A('\u{1F30D}', 'bloop', 'земля',         'die Erde')
        ]
      }
      ,
      {
        id: 'koerper', css: 'sky3', night: false, decor: 'clouds',
        animals: BODY.filter(b => b.e)
      },
      {
        id: 'zahlen', css: 'sky1', night: false, decor: 'clouds',
        animals: NUMBERS.filter(n => n.num >= 1)   // ноль в пузырях не нужен
      },
      {
        id: 'essen', css: 'sky3', night: false, decor: 'clouds',
        animals: [
          A('\u{1F34E}', 'nom',   'яблоко',    'der Apfel'),
          A('\u{1F34C}', 'nom',   'банан',     'die Banane'),
          A('\u{1F353}', 'nom',   'клубника',  'die Erdbeere'),
          A('\u{1F347}', 'nom',   'виноград',  'die Traube'),
          A('\u{1F955}', 'nom',   'морковка',  'die Karotte'),
          A('\u{1F345}', 'nom',   'помидор',   'die Tomate'),
          A('\u{1F952}', 'nom',   'огурец',    'die Gurke'),
          A('\u{1F35E}', 'nom',   'хлеб',      'das Brot'),
          A('\u{1F9C0}', 'nom',   'сыр',       'der Käse'),
          A('\u{1F95B}', 'bloop', 'молоко',    'die Milch'),
          A('\u{1F36A}', 'nom',   'печенье',   'der Keks'),
          A('\u{1F370}', 'ding',  'торт',      'der Kuchen'),
          A('\u{1F366}', 'ding',  'мороженое', 'das Eis'),
          A('\u{1F95A}', 'cluck', 'яйцо',      'das Ei')
        ]
      },
      {
        id: 'verkehr', css: '', night: false, decor: 'clouds',
        animals: [
          A('\u{1F697}', 'brum',  'машина',          'das Auto'),
          A('\u{1F68C}', 'honk',  'автобус',         'der Bus'),
          A('\u{1F6B2}', 'ding',  'велосипед',       'das Fahrrad'),
          A('\u{1F686}', 'honk',  'поезд',           'der Zug'),
          A('\u{2708}\u{FE0F}', 'zap', 'самолёт',    'das Flugzeug'),
          A('\u{1F681}', 'brum',  'вертолёт',        'der Helikopter'),
          A('\u{1F6A2}', 'honk',  'корабль',         'das Schiff'),
          A('\u{1F69C}', 'brum',  'трактор',         'der Traktor'),
          A('\u{1F692}', 'honk',  'пожарная машина', 'das Feuerwehrauto'),
          A('\u{1F691}', 'honk',  'скорая',          'der Krankenwagen'),
          A('\u{1F6F4}', 'ding',  'самокат',         'der Roller')
        ]
      },
      {
        id: 'kleidung', css: 'sky1', night: false, decor: 'clouds',
        animals: [
          A('\u{1F455}', 'swish', 'футболка',  'das T-Shirt'),
          A('\u{1F456}', 'swish', 'штанишки',  'die Hose'),
          A('\u{1F457}', 'swish', 'платье',    'das Kleid'),
          A('\u{1F9E6}', 'swish', 'носочек',   'die Socke'),
          A('\u{1F45F}', 'swish', 'ботинок',   'der Schuh'),
          A('\u{1F9E2}', 'swish', 'шапочка',   'die Mütze'),
          A('\u{1F9E4}', 'swish', 'варежка',   'der Handschuh'),
          A('\u{1F9E3}', 'swish', 'шарфик',    'der Schal'),
          A('\u{1F9E5}', 'swish', 'куртка',    'die Jacke'),
          A('\u{1F452}', 'swish', 'шляпа',     'der Hut')
        ]
      }
    ]
  };

  // плоский список без повторов — им пользуется voicegen
  window.YEVA_WORDS.unique = (() => {
    const out = [], seen = {};
    const add = a => {
      const k = a.de.toLowerCase();
      if (!seen[k]) { seen[k] = 1; out.push(a); }
    };
    window.YEVA_WORDS.worlds.forEach(w => w.animals.forEach(add));
    BODY.forEach(add);          // Kopf, Bauch, Haar и прочие без эмодзи тоже нужны озвучке
    NUMBERS.forEach(add);       // числа — только ради озвучки
    return out;
  })();

  // Только те слова, которые можно показать картинкой.
  // unique нужен озвучке (там есть и слова без эмодзи, вроде der Bauch),
  // а играм с карточками нужен именно этот список.
  window.YEVA_WORDS.pictured = window.YEVA_WORDS.unique.filter(a => a.e);

  // 'die Katze' -> 'katze'
  window.YEVA_WORDS.slug = a => (typeof a === 'string' ? a : a.de)
    .replace(/^(der|die|das)\s+/i, '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // 'die Katze' -> 'die'
  window.YEVA_WORDS.gender = a => {
    const m = (typeof a === 'string' ? a : a.de).match(/^(der|die|das)\b/i);
    return m ? m[1].toLowerCase() : 'der';
  };
})();
