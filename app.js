(() => {
  'use strict';

  const FULL = 108 * 60;      // 108 minutes
  const WINDOW = 4 * 60;      // code may be entered from 4:00
  const ALARM = 60;           // continuous alarm from 1:00
  const CODE = '4 8 15 16 23 42';
  const GLYPHS = ['𓂀', '𓃭', '𓆣', '𓋹', '𓁹', '𓅓', '𓊖', '𓇳', '𓆓', '𓄿', '𓈖', '𓏏'];

  // URL options for testing: ?start=250 (initial seconds), ?speed=10 (time multiplier)
  const params = new URLSearchParams(location.search);
  const speed = Math.max(0.1, Number(params.get('speed')) || 1);
  const startParam = params.has('start') ? Math.max(0, Number(params.get('start')) || 0) : null;
  const persist = speed === 1 && startParam === null;
  const STORAGE_KEY = 'swan.deadline';

  // ---------- Flip digits ----------

  class FlipDigit {
    constructor(el) {
      this.el = el;
      this.value = null;
      el.innerHTML =
        '<div class="half top"><span></span></div>' +
        '<div class="half bottom"><span></span></div>' +
        '<div class="flap top"><span></span></div>' +
        '<div class="flap bottom"><span></span></div>';
      [this.top, this.bottom, this.flapTop, this.flapBottom] = el.querySelectorAll('span');
    }

    set(value, animate = true) {
      value = String(value);
      if (value === this.value) return;
      const old = this.value;
      this.value = value;

      if (!animate || old === null) {
        this.top.textContent = this.bottom.textContent = value;
        return;
      }

      this.top.textContent = value;
      this.bottom.textContent = old;
      this.flapTop.textContent = old;
      this.flapBottom.textContent = value;

      this.el.classList.remove('flipping');
      void this.el.offsetWidth; // restart animation
      this.el.classList.add('flipping');

      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.bottom.textContent = value;
        this.el.classList.remove('flipping');
      }, 300);
    }
  }

  const digits = [...document.querySelectorAll('.digit')].map((el) => new FlipDigit(el));

  function showTime(seconds, animate = true) {
    const m = String(Math.floor(seconds / 60)).padStart(3, '0');
    const s = String(seconds % 60).padStart(2, '0');
    const chars = m + s;
    digits.forEach((d, i) => {
      d.el.classList.remove('glyph');
      d.set(chars[i], animate);
    });
  }

  function showGlyphs() {
    digits.forEach((d, i) => {
      setTimeout(() => {
        d.el.classList.add('glyph');
        d.set(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
      }, i * 180);
    });
  }

  // ---------- Terminal ----------

  const terminal = document.getElementById('terminal');
  const log = document.getElementById('log');
  const typedEl = document.getElementById('typed');
  let typed = '';

  function print(text, cls) {
    const line = document.createElement('div');
    line.className = 'line' + (cls ? ' ' + cls : '');
    line.textContent = text;
    log.appendChild(line);
    while (log.children.length > 60) log.removeChild(log.firstChild);
  }

  function normalize(input) {
    return input.trim().split(/[\s,]+/).filter(Boolean).join(' ');
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    unlockAudio();

    if (e.key === 'Enter') {
      e.preventDefault();
      execute(typed);
      typed = '';
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      typed = typed.slice(0, -1);
    } else if (e.key.length === 1 && typed.length < 40) {
      typed += e.key;
    } else {
      return;
    }
    typedEl.textContent = typed;
  });

  terminal.addEventListener('click', unlockAudio);

  function execute(input) {
    const cmd = normalize(input);
    print('>: ' + input);
    if (!cmd) return;

    if (cmd !== CODE) {
      print('INVALID INPUT', 'warn');
      return;
    }
    if (state === 'counting') {
      print('ACCESS DENIED. EXECUTION WINDOW NOT OPEN.', 'warn');
      return;
    }
    reset();
  }

  // ---------- Audio ----------

  let audio = null;

  function unlockAudio() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    }
    if (audio.state === 'suspended') audio.resume();
  }

  function beep(freq = 880, duration = 0.15, volume = 0.15) {
    if (!audio || audio.state !== 'running') return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const t = audio.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  // ---------- Home Assistant ----------

  const config = window.SWAN_CONFIG || {};

  function notifyHomeAssistant(event) {
    const base = (config.homeAssistantUrl || '').replace(/\/+$/, '');
    const id = config.webhooks && config.webhooks[event];
    if (!base || !id) return;
    // no-cors: HA webhooks don't need a response, and this avoids CORS setup in HA
    fetch(`${base}/api/webhook/${id}`, { method: 'POST', mode: 'no-cors' })
      .catch(() => print('HOME ASSISTANT UNREACHABLE', 'warn'));
  }

  // ---------- Countdown ----------

  let deadline;
  let state = 'counting'; // counting | window | alarm | failure
  let lastSecond = null;

  function remaining() {
    return Math.max(0, Math.ceil(((deadline - Date.now()) * speed) / 1000));
  }

  function setDeadline(seconds) {
    deadline = Date.now() + (seconds * 1000) / speed;
    if (persist) localStorage.setItem(STORAGE_KEY, String(deadline));
  }

  function reset() {
    if (state !== 'counting') notifyHomeAssistant('reset');
    setDeadline(FULL);
    state = 'counting';
    terminal.classList.remove('alarm');
    lastSecond = FULL;
    showTime(FULL);
    beep(1320, 0.08);
    print('CODE ACCEPTED. TIMER RESET TO 108:00.');
  }

  function tick() {
    const sec = remaining();
    if (sec === lastSecond) return;
    lastSecond = sec;

    if (sec === 0) {
      if (state !== 'failure') failure();
      return;
    }

    showTime(sec);

    if (sec <= ALARM) {
      if (state !== 'alarm') {
        state = 'alarm';
        print('WARNING: SYSTEM FAILURE IMMINENT', 'warn blink');
      }
      beep(880, 0.25, 0.2);
      setTimeout(() => beep(660, 0.25, 0.2), 450);
    } else if (sec <= WINDOW) {
      if (state !== 'window') {
        state = 'window';
        terminal.classList.add('alarm');
        print('EXECUTION WINDOW OPEN. ENTER CODE.', 'warn blink');
        notifyHomeAssistant('alarm');
      }
      if (sec % 2 === 0) beep(880, 0.12);
    } else {
      state = 'counting';
      terminal.classList.remove('alarm');
    }
  }

  function failure() {
    state = 'failure';
    terminal.classList.remove('alarm');
    showGlyphs();
    print('SYSTEM FAILURE', 'warn blink');
    print('ENTER CODE TO RESTORE.', 'warn');
    beep(110, 2, 0.25);
  }

  // ---------- Boot ----------

  const stored = persist ? Number(localStorage.getItem(STORAGE_KEY)) : 0;
  if (stored && stored > Date.now()) {
    deadline = stored;
  } else if (stored) {
    deadline = stored; // already expired: will show failure
  } else {
    setDeadline(startParam ?? FULL);
  }

  [
    'DHARMA INITIATIVE',
    'STATION 3: THE SWAN',
    '',
    'EVERY 108 MINUTES THE CODE MUST BE ENTERED.',
    'CLICK OR PRESS ANY KEY TO ENABLE SOUND.',
    '',
  ].forEach((l) => print(l));

  showTime(remaining(), false);
  tick();
  setInterval(tick, 100);
})();
