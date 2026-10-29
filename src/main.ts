import './styles.css';
import { sky } from './sky';
import { openCheck, openJoin } from './check';

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Motion switch: still is off; flip it here (and add html.still) to freeze the page ---------- */
const motion = {
  still: false,
  listeners: [] as ((still: boolean) => void)[],
  on(f: (still: boolean) => void) {
    this.listeners.push(f);
  },
};

/* ---------- Skies ---------- */
function skies() {
  const skyEls = [sky($<HTMLCanvasElement>('.sky')!, { low: 0.7 }), sky($<HTMLCanvasElement>('.sheet-sky')!, { low: 0.74, scale: 0.5 })];
  motion.on((v) => skyEls.forEach((s) => s?.setStill(v)));
}

/* ---------- Title letters ---------- */
function splitTitle() {
  let i = 0;
  for (const el of $$<HTMLElement>('.letters')) {
    const text = el.textContent ?? '';
    el.textContent = '';
    for (const c of text) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', String(i++));
      s.textContent = c;
      el.append(s);
    }
  }
}

/* ---------- Reveal on view ---------- */
const onReveal = new Map<Element, () => void>();
function reveals() {
  const els = $$<HTMLElement>('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        onReveal.get(e.target)?.();
        io.unobserve(e.target);
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
  );
  els.forEach((e) => io.observe(e));
}

/* ---------- 3 am thoughts under the hero ---------- */
function nightThoughts() {
  const box = $<HTMLElement>('.night');
  if (!box) return;
  const time = $<HTMLElement>('.night-time', box)!;
  const thought = $<HTMLElement>('.night-thought', box)!;
  const lines: [string, string][] = [
    ['3:12 am', '“Why is my brain wide awake?”'],
    ['3:26 am', '“If I fall asleep now, I’ll get four hours.”'],
    ['3:41 am', '“Just relax. Why can’t I just relax?”'],
    ['4:05 am', '“I’ll be useless tomorrow.”'],
    ['4:20 am', '“Everyone else is asleep.”'],
  ];
  let i = 0;
  setInterval(() => {
    if (motion.still || document.hidden) return;
    box.classList.add('swap');
    setTimeout(() => {
      i = (i + 1) % lines.length;
      [time.textContent, thought.textContent] = lines[i];
      box.classList.remove('swap');
    }, 900);
  }, 4800);
}

/* ---------- Statement lights up word by word as you scroll ---------- */
function litWords() {
  const p = $<HTMLElement>('.lit');
  if (!p) return;
  const wrapWords = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of (child.textContent ?? '').split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.append(w);
          }
        }
        child.replaceWith(frag);
      } else wrapWords(child);
    }
  };
  wrapWords(p);
  const words = $$<HTMLElement>('.w', p);
  let queued = false;
  const update = () => {
    queued = false;
    const r = p.getBoundingClientRect();
    const vh = innerHeight;
    const prog = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25));
    const lit = Math.round(prog * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < lit));
  };
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

/* ---------- Count-ups ---------- */
function counts() {
  for (const el of $$<HTMLElement>('[data-count]')) {
    const target = Number(el.dataset.count);
    const stat = el.closest('[data-reveal]');
    if (!stat) continue;
    el.textContent = motion.still ? String(target) : '0';
    onReveal.set(stat, () => {
      if (motion.still) return void (el.textContent = String(target));
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1800);
        el.textContent = String(Math.round(target * easeOut(p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}

/* ---------- Sleep pressure (process S): builds awake, clears asleep ---------- */
function pressure() {
  const svg = $<SVGSVGElement>('.pressure');
  if (!svg) return;
  const line = $<SVGPathElement>('.p-line', svg)!;
  const area = $<SVGPathElement>('.p-area', svg)!;
  const dot = $<SVGCircleElement>('.p-dot', svg)!;
  const note = $<HTMLElement>('[data-note]')!;
  const X0 = 30, X1 = 610, Y0 = 236, Y1 = 46;
  const BED = 16; // hours after 7 am: 11 pm
  const STEP = 0.1;
  const N = Math.round(24 / STEP) + 1;
  const x = (h: number) => X0 + (h / 24) * (X1 - X0);

  // Classic two-process model: rises toward 1 while awake (τ 18.2 h), falls while asleep (τ 4.2 h).
  const simulate = (nap: boolean) => {
    const out: number[] = [];
    let s = 0.093;
    for (let k = 0; k < N; k++) {
      const h = k * STEP;
      out.push(s);
      const asleep = h >= BED || (nap && h >= 9 && h < 10);
      s = asleep ? s * Math.exp(-STEP / 4.2) : 1 - (1 - s) * Math.exp(-STEP / 18.2);
    }
    return out;
  };
  const days = { normal: simulate(false), nap: simulate(true) };
  const top = Math.max(...days.normal) * 1.08;
  const y = (s: number) => Y0 - (s / top) * (Y0 - Y1);

  // Night zone, grid and labels.
  const zone = $<SVGRectElement>('.night-zone', svg)!;
  zone.setAttribute('x', String(x(BED)));
  zone.setAttribute('width', String(x(24) - x(BED)));
  const bed = $<SVGLineElement>('.bed-line', svg)!;
  bed.setAttribute('x1', String(x(BED)));
  bed.setAttribute('x2', String(x(BED)));
  $<SVGTextElement>('.bed-label', svg)!.setAttribute('x', String(x(BED)));
  const NS = 'http://www.w3.org/2000/svg';
  const grid = $<SVGGElement>('.grid', svg)!;
  ([[0, '7 am'], [6, '1 pm'], [12, '7 pm'], [BED, '11 pm'], [24, '7 am']] as [number, string][]).forEach(([h, label]) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(x(h)));
    t.setAttribute('y', '266');
    t.setAttribute('text-anchor', h === 0 ? 'start' : h === 24 ? 'end' : 'middle');
    t.textContent = label;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', String(x(h)));
    l.setAttribute('x2', String(x(h)));
    l.setAttribute('y1', '24');
    l.setAttribute('y2', String(Y0));
    grid.append(l, t);
  });
  const napLabel = document.createElementNS(NS, 'text');
  napLabel.setAttribute('x', String(x(9.5)));
  napLabel.setAttribute('text-anchor', 'middle');
  napLabel.textContent = 'nap';
  napLabel.style.transition = 'opacity 500ms';
  grid.append(napLabel);

  let shown = days.normal.slice();
  let drawn = motion.still ? 1 : 0;
  let phase = 0;
  const render = () => {
    const last = Math.max(1, Math.round(drawn * (N - 1)));
    let d = '';
    for (let k = 0; k <= last; k++) d += `${k ? 'L' : 'M'}${x(k * STEP).toFixed(1)} ${y(shown[k]).toFixed(1)}`;
    line.setAttribute('d', d);
    area.setAttribute('d', `${d}L${x(last * STEP).toFixed(1)} ${Y0}L${X0} ${Y0}Z`);
    const k = Math.round((motion.still || drawn < 1 ? Math.min(drawn, BED / 24) : phase) * (N - 1));
    dot.setAttribute('cx', x(k * STEP).toFixed(1));
    dot.setAttribute('cy', y(shown[k] ?? shown[0]).toFixed(1));
    const napK = Math.round(10 / STEP);
    napLabel.setAttribute('y', (y(shown[napK]) - 16).toFixed(1));
  };

  // Tween between days, draw in on first view, and walk the dot through the day.
  let from = shown.slice();
  let to = shown;
  let tweenStart = 0;
  let lastT = performance.now();
  let running = false;
  let raf = 0;
  const frame = (t: number) => {
    const dt = (t - lastT) / 1000;
    lastT = t;
    if (drawn < 1) drawn = Math.min(1, drawn + dt / 2.2);
    else phase = (phase + dt / (calm.matches ? 22 : 11)) % 1;
    const p = Math.min(1, (t - tweenStart) / 900);
    const e = easeOut(p);
    shown = from.map((v, i) => v + (to[i] - v) * e);
    render();
    raf = !motion.still && running ? requestAnimationFrame(frame) : 0;
  };
  const start = () => {
    if (raf || !running || motion.still) return render();
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    running = e.isIntersecting;
    start();
  }).observe(svg);
  motion.on((v) => {
    if (v) {
      drawn = 1;
      shown = to.slice();
      render();
    } else start();
  });

  const notes = {
    normal: 'Every hour awake builds adenosine, your brain’s pressure to sleep. By bedtime it’s high, and sleep comes easily.',
    nap: 'A late nap spends that pressure early. At bedtime there’s less left, so sleep comes slower and lighter.',
  };
  for (const b of $$<HTMLButtonElement>('[data-day]')) {
    b.addEventListener('click', () => {
      const day = b.dataset.day as keyof typeof days;
      $$<HTMLButtonElement>('[data-day]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      from = shown.slice();
      to = days[day];
      tweenStart = performance.now();
      napLabel.style.opacity = day === 'nap' ? '1' : '0';
      note.classList.add('swap');
      setTimeout(() => {
        note.textContent = notes[day];
        note.classList.remove('swap');
      }, 250);
      if (motion.still || !running) {
        shown = to.slice();
        render();
      }
    });
  }
  napLabel.style.opacity = '0';
  render();
}

/* ---------- Body clock: a live 24-hour dial ---------- */
function bodyClock() {
  const svg = $<SVGSVGElement>('.clock');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const ticks = $<SVGGElement>('.ticks', svg)!;
  for (let h = 0; h < 24; h++) {
    const a = (h / 24) * Math.PI * 2;
    const long = h % 6 === 0;
    const l = document.createElementNS(NS, 'line');
    const r1 = long ? 96 : 102;
    l.setAttribute('x1', String(140 + Math.sin(a) * r1));
    l.setAttribute('y1', String(140 - Math.cos(a) * r1));
    l.setAttribute('x2', String(140 + Math.sin(a) * 108));
    l.setAttribute('y2', String(140 - Math.cos(a) * 108));
    ticks.append(l);
  }
  const hand = $<SVGGElement>('.hand', svg)!;
  const time = $<HTMLElement>('[data-now-time]')!;
  const note = $<HTMLElement>('[data-clock-note]')!;
  const phase = (h: number) =>
    h >= 5 && h < 9
      ? 'Morning light now tells your body clock the day has begun. It sets the timer for tonight’s sleepiness.'
      : h >= 9 && h < 13
        ? 'Alertness is climbing. Your body clock is pushing you awake, whatever last night was like.'
        : h >= 13 && h < 16
          ? 'The early-afternoon dip is real: a natural drop in alertness, built into your clock.'
          : h >= 16 && h < 21
            ? 'Evening often brings a second wind. Your clock holds sleep off until a few hours before your usual bedtime.'
            : h >= 21
              ? 'Melatonin is rising. Your body is getting ready for sleep, if you let it.'
              : 'Deep in the biological night. Body temperature is near its lowest, and sleep pressure is clearing.';
  let shown = false;
  const tick = () => {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    note.textContent = phase(d.getHours());
    if (shown) hand.style.transform = `rotate(${((h - 12) / 24) * 360}deg)`;
  };
  tick();
  setInterval(tick, 30_000);
  const panel = svg.closest('[data-reveal]');
  const show = () => {
    shown = true;
    // Start from noon and sweep round to now.
    requestAnimationFrame(() => requestAnimationFrame(tick));
  };
  if (panel && !motion.still) onReveal.set(panel, show);
  else show();
}

/* ---------- Myth or fact cards ---------- */
const MYTHS: { q: string; fact: boolean; a: string }[] = [
  { q: 'Everyone needs 8 hours.', fact: false, a: 'Sleep need varies. Most adults need 7–9 hours, and chasing a number makes sleep harder.' },
  { q: 'Can’t sleep? Stay in bed and rest.', fact: false, a: 'Lying awake teaches your brain that bed means being awake. Getting up for a while breaks the link.' },
  { q: 'Sleep comes in cycles of about 90 minutes.', fact: true, a: 'You surface briefly between cycles all night. Most of those wakings are normal, and forgotten.' },
  { q: 'Trying harder helps you fall asleep.', fact: false, a: 'In experiments, people told to fall asleep as fast as they could took longer.⁶ Effort keeps the brain alert.' },
  { q: 'You probably slept more than you think.', fact: true, a: 'People with insomnia often underestimate how long they slept.⁵ The night feels longer than it was.' },
  { q: 'A nightcap helps you sleep.', fact: false, a: 'Alcohol can make you drowsy, but it breaks up sleep in the second half of the night.' },
];
function myths() {
  const list = $<HTMLUListElement>('.cards');
  if (!list) return;
  MYTHS.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.reveal = '';
    li.style.setProperty('--d', `${(i % 3) * 0.1}s`);
    li.innerHTML = `<button type="button" aria-pressed="false"><span class="face front"><p></p><span>Myth or fact? Tap to see</span></span><span class="face back ${m.fact ? 'fact' : 'myth'}" aria-hidden="true"><b>${m.fact ? 'Fact.' : 'Myth.'}</b><p></p></span></button>`;
    $('.front p', li)!.textContent = m.q;
    $('.back p', li)!.textContent = m.a;
    const b = $<HTMLButtonElement>('button', li)!;
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      $('.back', li)!.setAttribute('aria-hidden', String(!on));
      $('.front', li)!.setAttribute('aria-hidden', String(on));
    });
    list.append(li);
  });
}

/* ---------- Luna: a live chat that plays through three moments ---------- */
type Line = ['me' | 'luna', string];
const SCENES: Line[][] = [
  [
    ['me', 'It’s 3 am. I’ve been awake for ages.'],
    ['luna', 'Then let’s not fight it. Get up, somewhere dim, something dull. Come back when your eyes feel heavy.'],
    ['me', 'Won’t that make tomorrow worse?'],
    ['luna', 'A little, maybe. But you’re teaching your bed to mean sleep again. That’s the whole trick.'],
  ],
  [
    ['luna', 'Morning. How did last night go?'],
    ['me', 'Took ages to drop off. Woke at 4.'],
    ['luna', 'Thanks, that’s logged. It took 30 seconds, and it’s your only job today.'],
    ['luna', 'Three steadier nights this week. That’s how it starts.'],
  ],
  [
    ['me', 'My head won’t stop. Work, money, everything.'],
    ['luna', 'Let’s park it. Tell me the loudest three, and I’ll hold them till morning.'],
    ['me', 'The deadline. The bills. Mum’s appointment.'],
    ['luna', 'Parked. They’ll be here at 9. For now, nothing to solve.'],
  ],
];
function lunaChat() {
  const chat = $<HTMLElement>('.chat');
  const tabs = $$<HTMLButtonElement>('[data-scene]');
  if (!chat) return;
  let token = 0;
  let scene = 0;
  let inView = false;
  const wait = (ms: number, t: number) => new Promise<boolean>((r) => setTimeout(() => r(t === token), ms));
  const bubble = (who: string, text: string) => {
    const p = document.createElement('p');
    p.className = `msg ${who}`;
    p.textContent = text;
    chat.append(p);
    return p;
  };
  const play = async (n: number) => {
    const t = ++token;
    scene = n;
    tabs.forEach((b, i) => b.setAttribute('aria-selected', String(i === n)));
    chat.classList.add('fade');
    if (!(await wait(450, t))) return;
    chat.replaceChildren();
    chat.classList.remove('fade');
    if (motion.still) {
      SCENES[n].forEach(([w, s]) => bubble(w, s));
      return;
    }
    for (const [who, text] of SCENES[n]) {
      if (who === 'luna') {
        const typing = bubble('luna typing', '');
        typing.setAttribute('aria-hidden', 'true');
        typing.innerHTML = '<i></i><i></i><i></i>';
        if (!(await wait(900 + Math.min(900, text.length * 12), t))) return;
        typing.remove();
      } else if (!(await wait(700, t))) return;
      bubble(who, text);
      if (!(await wait(900, t))) return;
    }
    if (!(await wait(5200, t))) return;
    if (inView && !motion.still) play((n + 1) % SCENES.length);
  };
  tabs.forEach((b, i) => b.addEventListener('click', () => play(i)));
  // Arrow keys move between the moments, as a tablist should.
  tabs.forEach((b, i) =>
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
      play(Number(next.dataset.scene));
    }),
  );
  let started = false;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !started) {
      started = true;
      play(0);
    }
  }, { threshold: 0.4 }).observe(chat);
  motion.on(() => started && play(scene));
}

/* ---------- Header and floating CTA ---------- */
function chrome() {
  const bar = $<HTMLElement>('.bar')!;
  const edge = () => bar.classList.toggle('scrolled', scrollY > 10);
  edge();
  addEventListener('scroll', edge, { passive: true });

  const float = $<HTMLElement>('.float')!;
  const hero = $<HTMLElement>('.hero')!;
  const beta = $<HTMLElement>('#beta')!;
  float.hidden = false;
  let pastHero = false;
  let atBeta = false;
  const sync = () => float.classList.toggle('show', pastHero && !atBeta);
  new IntersectionObserver(([e]) => {
    pastHero = !e.isIntersecting;
    sync();
  }, { threshold: 0.15 }).observe(hero);
  new IntersectionObserver(([e]) => {
    atBeta = e.isIntersecting || e.boundingClientRect.top < 0;
    sync();
  }).observe(beta);
}

function wire() {
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    const check = t?.closest('[data-open-check]');
    const join = t?.closest('[data-open-join]');
    if (!check && !join) return;
    e.preventDefault();
    if (check) openCheck();
    else openJoin();
  });
  if (location.hash === '#check') openCheck();
}

splitTitle();
skies();
myths();
counts();
bodyClock();
reveals();
nightThoughts();
litWords();
pressure();
lunaChat();
chrome();
wire();
