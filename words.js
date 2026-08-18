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

  window.YEVA_WORDS = {
    version: 1,

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
    ]
  };

  // плоский список без повторов — им пользуется voicegen
  window.YEVA_WORDS.unique = (() => {
    const out = [], seen = {};
    window.YEVA_WORDS.worlds.forEach(w => w.animals.forEach(a => {
      const k = a.de.toLowerCase();
      if (!seen[k]) { seen[k] = 1; out.push(a); }
    }));
    return out;
  })();

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
