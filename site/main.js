// Nav blur once scrolled
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Simulated feed subtitles cycling inside the hero device
const LINES = [
  { jp: '<ruby>凄<rt>すご</rt></ruby>い<ruby>力<rt>ちから</rt></ruby>だな', romaji: 'sugoi chikara da na', en: 'What a tremendous power.' },
  { jp: '<ruby>逃<rt>に</rt></ruby>げろ！', romaji: 'nigero!', en: 'Run!' },
  { jp: 'これは<ruby>私<rt>わたし</rt></ruby>の<ruby>夢<rt>ゆめ</rt></ruby>だ', romaji: 'kore wa watashi no yume da', en: 'This is my dream.' },
  { jp: '<ruby>約<rt>やく</rt></ruby><ruby>束<rt>そく</rt></ruby>する、<ruby>絶<rt>ぜっ</rt></ruby><ruby>対<rt>たい</rt></ruby>に', romaji: 'yakusoku suru, zettai ni', en: 'I promise — for certain.' },
  { jp: '<ruby>仲間<rt>なかま</rt></ruby>を<ruby>守<rt>まも</rt></ruby>りたい<ruby>心<rt>こころ</rt></ruby>だ', romaji: 'nakama o mamoritai kokoro da', en: 'A heart that wants to protect its comrades.' },
  { jp: 'もう<ruby>一度<rt>いちど</rt></ruby>、<ruby>会<rt>あ</rt></ruby>いに行こう', romaji: 'mou ichido, ai ni ikou', en: 'Let us go meet them once more.' },
];

const EPISODES = [
  { title: '星の旅路', ep: 'EP.03' },
  { title: '剣道少女', ep: 'EP.01' },
  { title: '春の約束', ep: 'EP.02' },
];

const elLine = document.getElementById('fsLine');
const elRomaji = document.getElementById('fsRomaji');
const elEn = document.getElementById('fsEn');
const elTitle = document.getElementById('fsTitle');

let i = 0;
const cycle = () => {
  const line = LINES[i % LINES.length];
  elLine.innerHTML = line.jp;
  elRomaji.textContent = line.romaji;
  elEn.textContent = line.en;
  elTitle.textContent = EPISODES[Math.floor(i / 2) % EPISODES.length].title + ' · ' + EPISODES[Math.floor(i / 2) % EPISODES.length].ep;
  const screen = document.getElementById('feedSim');
  screen.className = 'feed-sim fs-scene-' + (Math.floor(i / 2) % 3);
  const bar = screen.querySelector('.fs-progress span');
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = '';
  elLine.style.animation = 'none';
  void elLine.offsetWidth;
  elLine.style.animation = '';
  i++;
};
setInterval(cycle, 4400);
cycle();
