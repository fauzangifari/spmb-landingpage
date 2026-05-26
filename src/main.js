const progressBar = document.getElementById('prog');

if (progressBar) {
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const scrollableHeight = document.body.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? Math.round((scrollTop / scrollableHeight) * 100) : 0;

    progressBar.style.width = `${progress}%`;
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.07 });

document.querySelectorAll('.fade-in').forEach(element => observer.observe(element));

document.querySelectorAll('.acc-btn').forEach(button => {
  button.addEventListener('click', () => {
    const body = button.nextElementSibling;
    const isOpen = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', String(!isOpen));
    body?.classList.toggle('open', !isOpen);
  });
});

const SIM_CAP = { dp: 20, af: 120, pr: 120, mu: 20 };
const DOM_BASE = 120;
const TOTAL = 400;

const byId = id => document.getElementById(id);
const round = number => Math.round(number);

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function setWidth(id, pct) {
  const element = byId(id);
  if (element) {
    element.style.width = `${Math.max(0, Math.min(100, round(pct)))}%`;
  }
}

function setColor(id, color) {
  const element = byId(id);
  if (element) element.style.color = color;
}

function setOpacity(id, visible) {
  const element = byId(id);
  if (element) element.style.opacity = visible ? '1' : '0';
}

function updateStatus({ emptySlots, sisaApm, sisaDpDasar, domFinal }) {
  const status = byId('s-status');
  const icon = byId('s-status-icon');
  const title = byId('s-status-title');
  const desc = byId('s-status-desc');

  if (!status || !icon || !title || !desc) return;

  if (emptySlots === 0 && sisaApm === 0 && sisaDpDasar === 0) {
    status.style.background = 'var(--teal-bg)';
    status.style.borderColor = 'rgba(13, 148, 136, .25)';
    icon.style.background = 'var(--teal)';
    icon.textContent = '✓';
    title.style.color = 'var(--teal)';
    title.textContent = 'Semua jalur terpenuhi';
    desc.textContent = 'Tidak ada redistribusi kuota. Total 400 siswa terpenuhi penuh.';
    return;
  }

  if (sisaApm > 0 && sisaDpDasar === 0) {
    status.style.background = 'var(--blue-bg)';
    status.style.borderColor = 'rgba(37, 99, 235, .25)';
    icon.style.background = 'var(--blue)';
    icon.textContent = '←';
    title.style.color = 'var(--blue)';
    title.textContent = 'Redistribusi ke Domisili Prioritas';
    desc.textContent = `${sisaApm} sisa kuota Afirmasi/Prestasi/Mutasi dialihkan ke Domisili Prioritas. Domisili tetap ${DOM_BASE} siswa.`;
    return;
  }

  if (sisaApm === 0 && sisaDpDasar > 0) {
    status.style.background = 'var(--amber-bg)';
    status.style.borderColor = 'rgba(217, 119, 6, .25)';
    icon.style.background = 'var(--amber)';
    icon.textContent = '⇒';
    title.style.color = 'var(--amber)';
    title.textContent = 'Redistribusi ke Jalur Domisili';
    desc.textContent = `${sisaDpDasar} sisa kuota Domisili Prioritas dialihkan ke Domisili. Domisili: ${DOM_BASE} → ${domFinal} siswa.`;
    return;
  }

  if (sisaApm > 0 && sisaDpDasar > 0) {
    status.style.background = 'var(--amber-bg)';
    status.style.borderColor = 'rgba(217, 119, 6, .25)';
    icon.style.background = 'var(--amber)';
    icon.textContent = '⇒';
    title.style.color = 'var(--amber)';
    title.textContent = 'Redistribusi gabungan';
    desc.textContent = `${sisaApm} sisa Afirmasi/Prestasi/Mutasi masuk Domisili Prioritas, dan ${sisaDpDasar} sisa Domisili Prioritas masuk Domisili.`;
    return;
  }

  status.style.background = 'var(--coral-bg)';
  status.style.borderColor = 'rgba(220, 38, 38, .25)';
  icon.style.background = 'var(--coral)';
  icon.textContent = '!';
  title.style.color = 'var(--coral)';
  title.textContent = 'Kuota belum terpenuhi';
  desc.textContent = `${emptySlots} kursi masih kosong dari total 400.`;
}

function simUpdate() {
  if (!byId('sl-dp')) return;

  const values = {
    dp: Number(byId('sl-dp')?.value ?? 100),
    af: Number(byId('sl-af')?.value ?? 100),
    pr: Number(byId('sl-pr')?.value ?? 100),
    mu: Number(byId('sl-mu')?.value ?? 100)
  };

  const filled = {
    dp: round((SIM_CAP.dp * values.dp) / 100),
    af: round((SIM_CAP.af * values.af) / 100),
    pr: round((SIM_CAP.pr * values.pr) / 100),
    mu: round((SIM_CAP.mu * values.mu) / 100)
  };

  const leftover = {
    dp: SIM_CAP.dp - filled.dp,
    af: SIM_CAP.af - filled.af,
    pr: SIM_CAP.pr - filled.pr,
    mu: SIM_CAP.mu - filled.mu
  };

  const sisaApm = leftover.af + leftover.pr + leftover.mu;
  const sisaDpDasar = leftover.dp;
  const dpFinal = filled.dp + sisaApm;
  const domFinal = DOM_BASE + sisaDpDasar;
  const grandTotal = dpFinal + filled.af + filled.pr + filled.mu + domFinal;
  const emptySlots = TOTAL - grandTotal;

  Object.keys(values).forEach(key => {
    const cap = SIM_CAP[key];
    const sisaElement = byId(`s-sisa-${key}`);
    setText(`s-pct-${key}`, values[key]);
    setText(`s-num-${key}`, `${filled[key]} / ${cap} siswa`);
    setWidth(`s-bar-${key}`, values[key]);

    if (!sisaElement) return;

    if (key === 'dp') {
      const dpExtra = Math.max(0, dpFinal - SIM_CAP.dp);
      if (leftover.dp > 0) {
        sisaElement.textContent = `Sisa ${leftover.dp} → Domisili`;
        sisaElement.style.color = 'var(--coral)';
      } else if (dpExtra > 0) {
        sisaElement.textContent = `+${dpExtra} dari jalur lain`;
        sisaElement.style.color = 'var(--blue)';
      } else {
        sisaElement.textContent = '✓ Kuota terpenuhi';
        sisaElement.style.color = 'var(--teal)';
      }
      return;
    }

    sisaElement.textContent = leftover[key] > 0 ? `Sisa ${leftover[key]} → Dom. Prioritas` : '✓ Kuota terpenuhi';
    sisaElement.style.color = leftover[key] > 0 ? 'var(--coral)' : 'var(--teal)';
  });

  const dpDisplayed = dpFinal;
  setText('sv-dp-terisi', `${dpDisplayed} terisi`);
  setText('sv-af-terisi', `${filled.af} terisi`);
  setText('sv-pr-terisi', `${filled.pr} terisi`);
  setText('sv-mu-terisi', `${filled.mu} terisi`);

  setWidth('sv-fill-dp', (dpFinal / SIM_CAP.dp) * 100);
  setWidth('sv-fill-af', values.af);
  setWidth('sv-fill-pr', values.pr);
  setWidth('sv-fill-mu', values.mu);

  setOpacity('sv-arr-dp', sisaDpDasar > 0);
  ['af', 'pr', 'mu'].forEach(key => setOpacity(`sv-arr-${key}`, leftover[key] > 0));
  setText('sv-lbl-tambah', sisaApm > 0 ? `+${sisaApm} ke DP` : '');
  setOpacity('sv-lbl-tambah', sisaApm > 0);
  setOpacity('sv-lbl-tambah-bg', sisaApm > 0);

  setText('sv-dom-num', `${domFinal} siswa`);
  setText('s-dom-extra-num', sisaDpDasar);
  setText('s-dom-total-num', domFinal);
  setText('sv-dom-extra', sisaDpDasar > 0 ? `${DOM_BASE} tetap + ${sisaDpDasar} sisa Dom. Prioritas` : '');
  setOpacity('sv-dom-extra', sisaDpDasar > 0);
  setWidth('sv-fill-dom', (domFinal / TOTAL) * 100);
  setText('sv-lbl-overflow', sisaApm > 0 ? 'dialihkan ke Dom. Prioritas' : (sisaDpDasar > 0 ? 'sisa DP ke Domisili' : ''));

  setText('s-total-num', grandTotal);
  setText('sv-total-txt', `${grandTotal} / 400 siswa`);

  const segments = {
    dp: round((dpDisplayed / TOTAL) * 100),
    af: round((filled.af / TOTAL) * 100),
    pr: round((filled.pr / TOTAL) * 100),
    mu: round((filled.mu / TOTAL) * 100),
    dom: round((domFinal / TOTAL) * 100)
  };
  segments.emp = Math.max(0, 100 - segments.dp - segments.af - segments.pr - segments.mu - segments.dom);

  Object.keys(segments).forEach(key => setWidth(`sv-seg-${key}`, segments[key]));

  setText('sv-leg-dp', dpDisplayed);
  setText('sv-leg-af', filled.af);
  setText('sv-leg-pr', filled.pr);
  setText('sv-leg-mu', filled.mu);
  setText('sv-leg-dom', domFinal);
  setText('sv-leg-emp', emptySlots);

  const emptyLegend = byId('sv-leg-emp-wrap');
  if (emptyLegend) emptyLegend.style.display = emptySlots > 0 ? 'flex' : 'none';

  updateStatus({ emptySlots, sisaApm, sisaDpDasar, domFinal });
}

function resetSim() {
  ['sl-dp', 'sl-af', 'sl-pr', 'sl-mu'].forEach(id => {
    const input = byId(id);
    if (input) input.value = 100;
  });
  simUpdate();
}

document.querySelectorAll('#sl-dp, #sl-af, #sl-pr, #sl-mu').forEach(input => {
  input.addEventListener('input', simUpdate);
});

document.querySelector('[data-reset-sim]')?.addEventListener('click', resetSim);

simUpdate();
