// DOM menu screens — the canvas does gameplay, the DOM does menus.
// Title (with re-entry Continue card), chapter select, settings, pause,
// clear (level / chapter / final) and game over, with NEW BEST ceremony.

export class Screens {
  constructor(handlers) {
    this.handlers = handlers;
    this.els = {
      title: document.getElementById('screen-title'),
      chapters: document.getElementById('screen-chapters'),
      settings: document.getElementById('screen-settings'),
      pause: document.getElementById('screen-pause'),
      clear: document.getElementById('screen-clear'),
      gameover: document.getElementById('screen-gameover'),
    };
    this.settingsReturn = 'title';

    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-start', () => handlers.onStart(0));
    on('btn-continue-run', handlers.onContinueRun);
    on('btn-chapters', () => this.show('chapters'));
    on('btn-chapters-back', () => this.show('title'));
    on('btn-settings', () => { this.settingsReturn = 'title'; this.show('settings'); });
    on('btn-pause-settings', () => { this.settingsReturn = 'pause'; this.show('settings'); });
    on('btn-settings-back', () => this.show(this.settingsReturn));
    on('btn-resume', handlers.onResume);
    on('btn-restart', handlers.onRestart);
    on('btn-quit', handlers.onQuit);
    on('btn-continue', () => handlers.onContinue());
    on('btn-clear-quit', handlers.onQuit);
    on('btn-retry', handlers.onRestart);
    on('btn-go-title', handlers.onQuit);
  }

  hideAll() {
    for (const el of Object.values(this.els)) el.classList.add('hidden');
  }

  show(name) {
    this.hideAll();
    this.els[name].classList.remove('hidden');
  }

  // Title's Continue is a re-entry card, not a bare button (§12): it names
  // where you left off so getting back in takes zero recall.
  updateTitle(profile, chapters) {
    const btn = document.getElementById('btn-continue-run');
    if (profile.unlocked > 1) {
      const idx = Math.min(profile.unlocked, chapters.length) - 1;
      btn.textContent = `CONTINUE — CH ${idx + 1} · ${chapters[idx].name.toUpperCase()}`;
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  buildChapterCards(chapters, profile, onPick) {
    const wrap = document.getElementById('chapter-cards');
    wrap.innerHTML = '';
    chapters.forEach((ch, i) => {
      const locked = i + 1 > profile.unlocked;
      const card = document.createElement('button');
      card.className = `chapter-card${locked ? ' locked' : ''}`;
      const best = profile.best[i];
      card.innerHTML = `
        <span class="num">CHAPTER ${i + 1}</span>
        <span class="name">${ch.name}</span>
        <span class="tag">${ch.tagline}</span>
        <span class="best">${best ? `Best ${best}` : ''}</span>
      `;
      if (!locked) card.addEventListener('click', () => onPick(i));
      wrap.appendChild(card);
    });
  }

  // mode: 'level' | 'chapter' | 'final'
  showClear({ score, mode, chapterName, nextChapterName, newBest }) {
    const title = document.getElementById('clear-title');
    const sub = document.getElementById('clear-sub');
    const btn = document.getElementById('btn-continue');
    const quitBtn = document.getElementById('btn-clear-quit');
    document.getElementById('clear-score').textContent = `Score ${score}`;
    document.getElementById('clear-best').classList.toggle('hidden', !newBest);

    if (mode === 'final') {
      title.textContent = 'THE WALL CAME DOWN';
      sub.textContent = 'All four chapters cleared. Every obstacle, broken through.';
      btn.textContent = 'PLAY AGAIN';
      quitBtn.classList.remove('hidden');
    } else if (mode === 'chapter') {
      title.textContent = 'BREAKTHROUGH!';
      sub.textContent = `${chapterName} cleared. Next: ${nextChapterName}.`;
      btn.textContent = 'NEXT CHAPTER';
      quitBtn.classList.remove('hidden');
    } else {
      title.textContent = 'LEVEL CLEAR';
      sub.textContent = '';
      btn.textContent = 'CONTINUE';
      quitBtn.classList.add('hidden');
    }
    this.show('clear');
  }

  showGameOver(score, newBest) {
    document.getElementById('go-score').textContent = `Score ${score}`;
    document.getElementById('go-best').classList.toggle('hidden', !newBest);
    this.show('gameover');
  }

  // wires the settings controls to a live settings object; persists via onChange
  bindSettings(settings, onChange) {
    const vol = document.getElementById('set-volume');
    vol.value = Math.round(settings.volume * 100);
    vol.addEventListener('input', () => {
      settings.volume = vol.value / 100;
      onChange('volume');
    });
    for (const key of ['music', 'shake', 'reducedFlash', 'crt', 'assist']) {
      const el = document.getElementById(`set-${key}`);
      el.checked = settings[key];
      el.addEventListener('change', () => {
        settings[key] = el.checked;
        onChange(key);
      });
    }
  }
}
