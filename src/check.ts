// The 2-minute sleep check and the waitlist form, in one <dialog>.
// Our own five questions (not the ISI, which needs a licence), scored like the app's sleep score.

type Q = { kicker: string; text: string; options: string[] };

const OFTEN = ['Rarely or never', 'Once a week or less', '2–3 nights a week', '4–5 nights a week', 'Almost every night'];
const QUESTIONS: Q[] = [
  { kicker: 'Falling asleep', text: 'How long does it usually take you to fall asleep?', options: ['Under 15 minutes', '15–30 minutes', '30–45 minutes', '45–60 minutes', 'Over an hour'] },
  { kicker: 'Staying asleep', text: 'How often do you wake in the night and struggle to get back to sleep?', options: OFTEN },
  { kicker: 'Waking early', text: 'How often do you wake too early and can’t get back to sleep?', options: OFTEN },
  { kicker: 'Your days', text: 'How much does poor sleep get in the way of your day?', options: ['Not at all', 'A little', 'Somewhat', 'A lot', 'Very much'] },
  { kicker: 'Your mind', text: 'How much do you worry about your sleep?', options: ['Not at all', 'A little', 'Somewhat', 'A lot', 'It’s on my mind most days'] },
];
const SAFETY = [
  { id: 'apnea', kicker: 'One quick safety check', text: 'Has anyone said you snore loudly and stop breathing or gasp in your sleep?' },
  { id: 'drowsy', kicker: 'And one more', text: 'In the last month, have you nodded off, or nearly, while driving?' },
] as const;
type SafetyId = (typeof SAFETY)[number]['id'];

const COUNTRIES = ['India', 'United Kingdom', 'United States', 'Canada', 'Australia', 'Singapore', 'United Arab Emirates', 'Ireland', 'New Zealand', 'Somewhere else'];
const LAST = QUESTIONS.length + SAFETY.length; // the result step

type Step = number | 'join' | 'done';
const state = {
  step: 0 as Step,
  answers: [] as number[],
  safety: {} as Partial<Record<SafetyId, boolean>>,
  name: '',
  preview: false,
};

const sheet = document.querySelector<HTMLDialogElement>('.sheet')!;
const body = sheet.querySelector<HTMLElement>('.sheet-body')!;
const back = sheet.querySelector<HTMLButtonElement>('[data-back]')!;
const bar = sheet.querySelector<HTMLElement>('.phase')!;
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => document.documentElement.classList.contains('still');

export function scoreOf(answers: number[]) {
  const total = answers.reduce((a, b) => a + b, 0);
  const score = Math.round(((20 - total) / 20) * 100);
  const band =
    score >= 75
      ? { name: 'Sleeping well', line: 'Your nights sound mostly settled. LunaOS can help you keep them that way.' }
      : score >= 50
        ? { name: 'A little unsettled', line: 'Some nights are harder than they should be. This is when small changes work fastest.' }
        : score >= 25
          ? { name: 'Struggling', line: 'Your sleep is taking a real toll. This is exactly what LunaOS is built for.' }
          : { name: 'Really struggling', line: 'That sounds exhausting. You’re not broken, and this is very treatable.' };
  return { score, band };
}

function open(step: Step) {
  state.step = step;
  // Open first: showModal moves focus to the first button, and render() then puts it on the question.
  if (!sheet.open) {
    sheet.showModal();
    document.body.style.overflow = 'hidden';
  }
  render();
}

export function openCheck() {
  if (state.step === 'done' || state.step === 'join') {
    state.answers = [];
    state.safety = {};
    state.step = 0;
  }
  open(state.step);
}

export function openJoin() {
  open(state.step === 'done' ? 'done' : state.answers.length === QUESTIONS.length && state.step === LAST ? LAST : 'join');
}

// Progress is a moon waxing from a thin crescent to full.
function moonPhase(f: number, cx = 20, cy = 20, r = 15) {
  const p = 0.06 + f * 0.94;
  const rx = (r * Math.abs(1 - 2 * p)).toFixed(2);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}A${rx} ${r} 0 0 ${p < 0.5 ? 0 : 1} ${cx} ${cy - r}Z`;
}

function progress(p: number, label: string) {
  bar.querySelector('.phase-lit')!.setAttribute('d', moonPhase(p));
  bar.querySelector('.phase-label')!.textContent = label;
  bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  bar.setAttribute('aria-valuetext', label || 'Done');
}

function render() {
  const s = state.step;
  back.hidden = s === 0 || s === 'join' || s === 'done';
  body.replaceChildren();
  if (typeof s === 'number' && s < QUESTIONS.length) question(s);
  else if (typeof s === 'number' && s < LAST) safety(s - QUESTIONS.length);
  else if (s === LAST) result();
  else if (s === 'join') join();
  else done();
  if (typeof s === 'number' && s < LAST) progress(s / LAST, `Free check · ${s + 1} of ${LAST}`);
  else progress(1, s === LAST ? 'Your score' : s === 'done' ? 'Done' : 'Waitlist');
  body.querySelector<HTMLElement>('#sheet-title')?.focus({ preventScroll: true });
  sheet.querySelector('.sheet-in')!.scrollTop = 0;
}

function frame(kicker: string, title: string, cls = '') {
  const step = document.createElement('div');
  step.className = `step ${cls}`.trim();
  step.innerHTML = `<p class="kicker"></p><h2 class="q" id="sheet-title" tabindex="-1"></h2>`;
  step.querySelector('.kicker')!.textContent = kicker;
  step.querySelector('.q')!.textContent = title;
  body.append(step);
  return step;
}

function choices(parent: HTMLElement, labels: string[], picked: number | undefined, onPick: (i: number) => void, cls = '') {
  const list = document.createElement('div');
  list.className = `opts ${cls}`.trim();
  labels.forEach((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.style.setProperty('--i', String(i));
    b.textContent = label;
    b.setAttribute('aria-pressed', String(picked === i));
    b.addEventListener('click', () => {
      list.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      // A beat to see the choice land, then move on.
      setTimeout(() => onPick(i), calm.matches ? 0 : 240);
    });
    list.append(b);
  });
  parent.append(list);
}

function question(i: number) {
  const q = QUESTIONS[i];
  const step = frame(`${i + 1} of ${QUESTIONS.length} · ${q.kicker}`, q.text);
  choices(step, q.options, state.answers[i], (v) => {
    state.answers[i] = v;
    open(i + 1);
  });
}

function safety(i: number) {
  const q = SAFETY[i];
  const step = frame(q.kicker, q.text);
  const prior = state.safety[q.id];
  choices(step, ['Yes', 'No'], prior === undefined ? undefined : prior ? 0 : 1, (v) => {
    state.safety[q.id] = v === 0;
    open(QUESTIONS.length + i + 1);
  }, 'yn');
}

function result() {
  const { score, band } = scoreOf(state.answers);
  const step = frame('Your sleep score', `Your sleep score is ${score} out of 100: ${band.name}.`, 'result');
  // The heading carries the full result for screen readers; the moon and number show it visually.
  step.querySelector('.q')!.className = 'sr-only';
  const fill = 15 + 140 * (1 - score / 100);
  step.insertAdjacentHTML(
    'beforeend',
    `<div class="score-moon" aria-hidden="true"><svg viewBox="0 0 170 170">
       <defs><clipPath id="fill-clip"><rect x="0" y="${still() ? fill : 155}" width="170" height="170" /></clipPath></defs>
       <circle cx="85" cy="85" r="82" fill="url(#halo)" />
       <circle cx="85" cy="85" r="70" fill="#1C2050" stroke="#2C3170" stroke-width="2" />
       <circle cx="85" cy="85" r="70" fill="url(#moon)" clip-path="url(#fill-clip)" />
     </svg></div>
     <p class="score-num" aria-hidden="true"><span>${still() ? score : 0}</span><small>/100</small></p>
     <p class="band" aria-hidden="true"></p>
     <p class="band-line"></p>`,
  );
  step.querySelector('.band')!.textContent = band.name;
  step.querySelector('.band-line')!.textContent = band.line;

  const flags: string[] = [];
  if (state.safety.apnea) flags.push('Loud snoring with pauses or gasping can be a sign of sleep apnoea, which is treated differently.');
  if (state.safety.drowsy) flags.push('Nodding off at the wheel is serious. Please don’t drive when you feel sleepy.');
  if (flags.length) {
    const note = document.createElement('p');
    note.className = 'flag';
    note.innerHTML = '<b>Worth checking with a doctor.</b> ';
    note.append(flags.join(' '));
    step.append(note);
  }
  step.append(form('Join the beta waitlist', 'Your score comes with you. We’ll be in touch before launch.'));

  if (!still()) {
    const rect = step.querySelector('rect')!;
    const num = step.querySelector<HTMLElement>('.score-num span')!;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1600);
      const e = 1 - Math.pow(1 - p, 4);
      rect.setAttribute('y', String(155 + (fill - 155) * e));
      num.textContent = String(Math.round(score * e));
      if (p < 1 && rect.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function join() {
  const step = frame('LunaOS Beta', 'Join the waitlist.');
  const p = document.createElement('p');
  p.className = 'sub';
  p.textContent = 'Be first in when the LunaOS beta opens. Beta users get the inaugural price and a say in what Luna becomes.';
  step.append(p, form());
  const take = document.createElement('button');
  take.type = 'button';
  take.className = 'btn btn-ghost';
  take.style.marginTop = '12px';
  take.textContent = 'Get my free sleep score first';
  take.addEventListener('click', () => {
    state.answers = [];
    state.safety = {};
    open(0);
  });
  step.append(take);
}

function field(label: string, input: HTMLInputElement | HTMLSelectElement) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const l = document.createElement('label');
  l.htmlFor = input.id;
  l.textContent = label;
  wrap.append(l, input);
  return wrap;
}

function form(title?: string, sub?: string) {
  const f = document.createElement('form');
  f.className = 'form';
  f.noValidate = true;
  if (title) {
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = sub ?? '';
    f.append(h, p);
  }

  const name = Object.assign(document.createElement('input'), { id: 'f-name', name: 'name', autocomplete: 'given-name', required: true, maxLength: 60 });
  const email = Object.assign(document.createElement('input'), { id: 'f-email', name: 'email', type: 'email', autocomplete: 'email', inputMode: 'email', required: true, maxLength: 120, placeholder: 'you@example.com' });
  email.spellcheck = false;
  const country = Object.assign(document.createElement('select'), { id: 'f-country', name: 'country', required: true, autocomplete: 'country-name' });
  country.append(new Option('Choose one', ''), ...COUNTRIES.map((c) => new Option(c, c)));
  country.options[0].disabled = true;
  country.options[0].selected = true;

  const seg = document.createElement('fieldset');
  seg.className = 'field';
  seg.innerHTML = `<legend>Would you want in-person sessions with a counsellor?</legend><div class="seg">${['Yes', 'Maybe', 'No']
    .map((v) => `<label><input type="radio" name="counsellor" value="${v.toLowerCase()}"><span>${v}</span></label>`)
    .join('')}</div>`;

  const consent = document.createElement('label');
  consent.className = 'consent';
  consent.innerHTML = '<input type="checkbox" name="consent" required><span>Email me about the LunaOS launch. I can unsubscribe any time.</span>';

  const err = document.createElement('p');
  err.className = 'err';
  err.setAttribute('role', 'alert');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn';
  submit.textContent = 'Join the waitlist';

  // The price is always in view before anyone joins.
  const price = document.createElement('div');
  price.className = 'form-price';
  price.innerHTML = '<span><b>LunaOS Beta</b>Inaugural price for beta users</span><span class="form-price-n"><s>₹25,000</s><b>₹9,999</b></span><p>Joining the waitlist is free. No payment now. We’ll be in touch before launch.</p>';

  f.append(field('First name', name), field('Email', email), field('Country', country), seg, price, consent, err, submit);

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(f);
    const problem = !String(data.get('name') ?? '').trim()
      ? [name, 'Please add your first name.']
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.get('email') ?? '').trim())
        ? [email, 'That email doesn’t look right.']
        : !data.get('country')
          ? [country, 'Please choose your country.']
          : !data.get('consent')
            ? [consent.querySelector('input')!, 'Please tick the box so we can email you.']
            : null;
    if (problem) {
      err.textContent = problem[1] as string;
      (problem[0] as HTMLElement).focus();
      return;
    }
    err.textContent = '';
    submit.disabled = true;
    submit.innerHTML = '<span class="spin" aria-hidden="true"></span>Saving your place';
    try {
      await save(data);
      state.name = String(data.get('name')).trim();
      open('done');
    } catch {
      err.textContent = 'We couldn’t save that just now. Please try again in a moment.';
      submit.disabled = false;
      submit.textContent = 'Join the waitlist';
    }
  });
  return f;
}

async function save(data: FormData) {
  const checked = state.answers.length === QUESTIONS.length;
  const result = checked ? scoreOf(state.answers) : null;
  const params = new URLSearchParams(location.search);
  const utm = Object.fromEntries([...params].filter(([k]) => k.startsWith('utm_') || k === 'ref'));
  // Score and band only: the safety answers stay on this screen.
  const payload = {
    name: String(data.get('name')).trim(),
    email: String(data.get('email')).trim().toLowerCase(),
    country: String(data.get('country')),
    counsellor: data.get('counsellor') ?? null,
    consent: true,
    score: result?.score ?? null,
    band: result?.band.name ?? null,
    utm,
    referrer: document.referrer || null,
    at: new Date().toISOString(),
  };
  const endpoint = import.meta.env.VITE_WAITLIST_ENDPOINT;
  if (!endpoint) {
    // Preview mode: no endpoint configured yet, so keep the sign-up on this device only.
    const key = 'lunaos.waitlist';
    let list: unknown[] = [];
    try {
      list = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      list = [];
    }
    try {
      localStorage.setItem(key, JSON.stringify([...list, payload]));
    } catch {
      /* storage blocked: still show success in preview */
    }
    state.preview = true;
    return;
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`waitlist ${res.status}`);
  state.preview = false;
}

function done() {
  const step = frame('You’re on the waitlist', state.name ? `Thanks, ${state.name}. You’re on the list.` : 'Thanks. You’re on the list.', 'done');
  const checked = state.answers.length === QUESTIONS.length ? scoreOf(state.answers) : null;
  const joined = new Date().toLocaleDateString([], { month: 'short', year: 'numeric' });

  // The beta pass: a small card that's theirs, with a sheen and a gentle tilt.
  const card = document.createElement('div');
  card.className = 'member';
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `<div class="member-top"><span>LunaOS Beta · Waitlist</span><svg viewBox="0 0 24 24"><path d="M16 3a9 9 0 1 0 5 15.5A7.5 7.5 0 1 1 16 3z" fill="url(#moon)" /></svg></div>
    <p class="member-name"></p>
    <div class="member-meta"><span>Added<b>${joined}</b></span><span>Sleep score<b>${checked ? `${checked.score}/100` : 'Not yet'}</b></span><span>Your price<b>₹9,999</b></span></div>`;
  card.querySelector('.member-name')!.textContent = state.name || 'On the waitlist';
  const burst = document.createElement('div');
  burst.className = 'burst';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = 90 + Math.random() * 90;
    const dotEl = document.createElement('i');
    dotEl.style.setProperty('--x', `${Math.cos(a) * d}px`);
    dotEl.style.setProperty('--y', `${Math.sin(a) * d}px`);
    burst.append(dotEl);
  }
  step.prepend(burst, card);
  if (!calm.matches && !still()) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
      card.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 14}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  const p = document.createElement('p');
  p.textContent = 'We’ll be in touch by email before launch to confirm your beta place at the ₹9,999 inaugural price. Until then, one tip from Luna: tonight, only go to bed when you’re sleepy.';
  step.append(p);

  const row = document.createElement('div');
  row.className = 'cta-row';
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'btn';
  share.textContent = 'Share with a friend';
  share.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?ref=share`;
    try {
      if (navigator.share) await navigator.share({ title: 'LunaOS', text: 'Stop trying to sleep. A free 2-minute sleep check:', url });
      else {
        await navigator.clipboard.writeText(url);
        share.textContent = 'Link copied';
      }
    } catch {
      /* share sheet dismissed */
    }
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-ghost';
  close.textContent = 'Back to the page';
  close.addEventListener('click', () => sheet.close());
  row.append(share, close);
  step.append(row);

  if (state.preview) {
    const note = document.createElement('p');
    note.className = 'preview';
    note.textContent = 'Preview mode: saved on this device only. Set VITE_WAITLIST_ENDPOINT to collect sign-ups.';
    step.append(note);
  }
}

back.addEventListener('click', () => {
  if (typeof state.step === 'number' && state.step > 0) open(state.step - 1);
});
sheet.querySelector('[data-close]')!.addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => {
  document.body.style.overflow = '';
});
