(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const P = window.PAINEIS;
  const TAXA_ANUNCIANTE = 0.05;
  const DAY = 864e5;

  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brlShort = v => v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
  const fluxo = n => (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil/dia';
  const unidadeTxt = u => u === 7 ? 'semana' : u === 14 ? 'bissemana' : '4 semanas';
  const iso = d => d.toISOString().slice(0, 10);
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const fmtDia = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');

  const isReserved = (p, d) => p.reservas.some(([a, b]) => d >= parse(a) && d <= parse(b));
  const livreAgora = p => !isReserved(p, today);

  const toast = msg => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-on'), 3200);
  };

  // ---------- cena desenhada do painel ----------
  const scene = p => {
    const night = p.tipo === 'Painel LED' || (p.luz && p.id.endsWith('7'));
    const wall = p.tipo === 'Empena';
    return `<div class="scene ${night ? 'is-night' : ''} ${wall ? 'scene--wall' : ''}">
      ${wall ? '<div class="scene__wall"></div>' : '<i class="scene__post"></i><i class="scene__post"></i>'}
      <div class="scene__board" style="background:${p.art.bg};color:${p.art.fg}">
        <b>${p.art.txt}</b><small>${p.art.sub}</small>
      </div>
    </div>`;
  };

  // ---------- mapa ----------
  const map = L.map('map', { zoomControl: false, scrollWheelZoom: false }).setView([-23.57, -46.63], 11);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19
  }).addTo(map);
  map.on('click', () => map.scrollWheelZoom.enable());

  const markers = {};
  P.forEach(p => {
    const icon = L.divIcon({
      className: '',
      html: `<span class="mk ${livreAgora(p) ? '' : 'is-busy'}" data-id="${p.id}">${brlShort(p.preco)}</span>`,
      iconSize: [0, 0]
    });
    markers[p.id] = L.marker([p.lat, p.lng], { icon }).on('click', () => openPanel(p.id));
  });

  const hot = (id, on) => {
    const m = document.querySelector(`.mk[data-id="${id}"]`);
    if (m) m.classList.toggle('is-hot', on);
    const it = document.querySelector(`.item[data-id="${id}"]`);
    if (it) it.classList.toggle('is-hot', on);
  };

  // ---------- filtros e lista ----------
  const state = { q: '', tipo: '', chip: 'all' };
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const filtered = () => P.filter(p => {
    if (state.tipo && p.tipo !== state.tipo) return false;
    if (state.q && !norm(`${p.nome} ${p.bairro} ${p.cidade}`).includes(norm(state.q))) return false;
    if (state.chip === 'lit' && !p.luz) return false;
    if (state.chip === 'now' && !livreAgora(p)) return false;
    if (state.chip === 'cheap' && p.preco > 2500) return false;
    return true;
  });

  const render = (fit = true) => {
    const items = filtered();
    $('#count').textContent = items.length;
    $('#list').innerHTML = items.length ? items.map(p => `
      <article class="item" data-id="${p.id}" tabindex="0">
        ${scene(p)}
        <div>
          <span class="pill ${livreAgora(p) ? 'pill--ok' : 'pill--busy'}">${livreAgora(p) ? 'Livre agora' : 'Ocupado hoje'}</span>
          <h4>${p.nome}</h4>
          <div class="item__meta"><span>${p.tipo} · ${p.medida}</span><span>${p.bairro}, ${p.cidade}</span></div>
          <div class="item__price"><b>${brl(p.preco)}</b> <small>/ ${unidadeTxt(p.unidade)}</small></div>
        </div>
      </article>`).join('') : `<div class="list__empty"><p>Nenhum painel com esses filtros.</p><button class="btn btn--sm" id="clearF">Limpar filtros</button></div>`;

    Object.values(markers).forEach(m => m.remove());
    items.forEach(p => markers[p.id].addTo(map));
    if (fit && items.length) {
      map.fitBounds(L.latLngBounds(items.map(p => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 14 });
    }
  };

  $('#list').addEventListener('click', e => {
    if (e.target.id === 'clearF') {
      Object.assign(state, { q: '', tipo: '', chip: 'all' });
      $('#qWhere').value = ''; $('#qType').value = '';
      $$('.chip').forEach(c => c.classList.toggle('is-on', c.dataset.f === 'all'));
      return render();
    }
    const it = e.target.closest('.item');
    if (it) openPanel(it.dataset.id);
  });
  $('#list').addEventListener('keydown', e => {
    const it = e.target.closest('.item');
    if (it && e.key === 'Enter') openPanel(it.dataset.id);
  });
  $('#list').addEventListener('mouseover', e => {
    const it = e.target.closest('.item');
    $$('.is-hot').forEach(x => x.classList.remove('is-hot'));
    if (it) hot(it.dataset.id, true);
  });
  $('#map').addEventListener('mouseover', e => {
    const m = e.target.closest('.mk');
    $$('.item.is-hot').forEach(x => x.classList.remove('is-hot'));
    if (m) { hot(m.dataset.id, true); }
  });
  $('#map').addEventListener('mouseout', e => {
    const m = e.target.closest('.mk');
    if (m) hot(m.dataset.id, false);
  });

  $('#chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    $$('.chip').forEach(x => x.classList.toggle('is-on', x === c));
    state.chip = c.dataset.f;
    render();
  });

  $('#heroSearch').addEventListener('submit', e => {
    e.preventDefault();
    state.q = $('#qWhere').value.trim();
    state.tipo = $('#qType').value;
    render();
    $('#explorar').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- detalhe do painel ----------
  let cur = null;
  let sel = { start: null, end: null, stage: 0 };
  let monthOffset = 0;

  const openPanel = id => {
    cur = P.find(p => p.id === id);
    sel = { start: null, end: null, stage: 0 };
    monthOffset = 0;
    drawPanel();
    $('#drawer').classList.add('is-on');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('is-on');
    $('#drawer').scrollTop = 0;
  };

  const closeAll = () => {
    $('#drawer').classList.remove('is-on');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('is-on');
    $('#modal').classList.remove('is-on');
  };

  const drawPanel = () => {
    const p = cur;
    const ini = p.dono.split(' ').map(w => w[0]).slice(0, 2).join('');
    $('#drawerBody').innerHTML = `
      <div class="d__hero">${scene(p)}</div>
      <div class="d__pad">
        <span class="d__id">${p.id} · ${p.tipo}</span>
        <h3 class="d__title">${p.nome}</h3>
        <p class="d__loc">${p.bairro}, ${p.cidade} — ${p.inclui}</p>
        <div class="specs">
          <div><small>Medida</small><b>${p.medida}</b></div>
          <div><small>Fluxo est.</small><b>${fluxo(p.fluxo)}</b></div>
          <div><small>Iluminação</small><b>${p.luz ? 'Sim' : 'Não'}</b></div>
          <div><small>Período</small><b>${unidadeTxt(p.unidade)}</b></div>
        </div>
        <div class="owner">
          <div class="owner__av">${ini}</div>
          <div><b>${p.dono}</b><br><span>★ ${p.nota.toLocaleString('pt-BR')} · ${p.avaliacoes} locações · responde em ~6h</span></div>
        </div>
        <div class="d__h">Disponibilidade
          <div class="cal__nav">
            <button data-mo="-1" aria-label="Meses anteriores" ${monthOffset === 0 ? 'disabled' : ''}>‹</button>
            <button data-mo="1" aria-label="Próximos meses">›</button>
          </div>
        </div>
        <div class="cal" id="cal">${calendar()}</div>
        <div class="cal__legend"><span><i></i>Livre</span><span><i class="r"></i>Reservado</span><span><i class="s"></i>Sua seleção</span></div>
        <div class="book" id="book">${bookBox()}</div>
      </div>`;
  };

  const calendar = () => {
    let out = '';
    for (let k = 0; k < 2; k++) {
      const m0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset + k, 1));
      const label = m0.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const days = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth() + 1, 0)).getUTCDate();
      let g = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<span>${d}</span>`).join('');
      g += '<span></span>'.repeat(m0.getUTCDay());
      for (let d = 1; d <= days; d++) {
        const dt = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth(), d));
        const past = dt < today;
        const res = isReserved(cur, dt);
        const s = sel.start && +dt === +sel.start || sel.end && +dt === +sel.end;
        const inR = sel.start && sel.end && dt > sel.start && dt < sel.end;
        const cls = ['cal__d', past && 'is-past', res && 'is-res', s && 'is-sel', inR && 'is-in'].filter(Boolean).join(' ');
        g += `<button class="${cls}" data-d="${iso(dt)}" ${past || res ? 'disabled' : ''}>${d}</button>`;
      }
      out += `<div class="cal__m"><h5>${label}</h5><div class="cal__g">${g}</div></div>`;
    }
    return out;
  };

  const quote = () => {
    if (!sel.start || !sel.end) return null;
    const dias = Math.round((sel.end - sel.start) / DAY) + 1;
    const periodos = Math.ceil(dias / cur.unidade);
    const sub = periodos * cur.preco;
    const taxa = Math.round(sub * TAXA_ANUNCIANTE);
    return { dias, periodos, sub, taxa, total: sub + taxa };
  };

  let bookMsg = { t: '', err: false };
  const bookBox = () => {
    const q = quote();
    const per = q ? `${fmtDia(sel.start)} → ${fmtDia(sel.end)}` : '—';
    return `
      <div class="book__row"><span>Período</span><b>${per}</b></div>
      <div class="book__row"><span>${q ? `${q.periodos} ${unidadeTxt(cur.unidade)}${q.periodos > 1 ? 's' : ''} × ${brl(cur.preco)}` : `Preço por ${unidadeTxt(cur.unidade)}`}</span><b>${q ? brl(q.sub) : brl(cur.preco)}</b></div>
      ${q ? `<div class="book__row"><span>Taxa de serviço (5%)</span><b>${brl(q.taxa)}</b></div>
      <div class="book__row book__row--t"><span>Total</span><b>${brl(q.total)}</b></div>` : ''}
      <p class="book__msg ${bookMsg.err ? 'is-err' : ''}">${bookMsg.t || (q ? 'Clique em outra data para estender o período.' : `Escolha a data de início. O mínimo é 1 ${unidadeTxt(cur.unidade)}.`)}</p>
      <button class="btn btn--cone" id="reqBtn" ${q ? '' : 'disabled'}>Solicitar reserva</button>
      <p class="book__note">Nada é cobrado agora. Você só paga depois que o proprietário aprovar.</p>`;
  };

  const conflicts = (a, b) => {
    for (let t = +a; t <= +b; t += DAY) if (isReserved(cur, new Date(t))) return true;
    return false;
  };

  const pick = d => {
    bookMsg = { t: '', err: false };
    const u = cur.unidade;
    if (sel.stage === 1 && d > sel.start) {
      const n = Math.ceil((Math.round((d - sel.start) / DAY) + 1) / u);
      const end = new Date(+sel.start + (n * u - 1) * DAY);
      if (conflicts(sel.start, end)) {
        bookMsg = { t: 'Esse período passa por datas já reservadas. Escolha um intervalo menor.', err: true };
      } else {
        sel.end = end; sel.stage = 2;
      }
    } else {
      const end = new Date(+d + (u - 1) * DAY);
      if (conflicts(d, end)) {
        bookMsg = { t: `A partir desse dia não há ${unidadeTxt(u)} completa livre.`, err: true };
        sel = { start: null, end: null, stage: 0 };
      } else {
        sel = { start: d, end, stage: 1 };
      }
    }
    $('#cal').innerHTML = calendar();
    $('#book').innerHTML = bookBox();
  };

  $('#drawer').addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return closeAll();
    const day = e.target.closest('.cal__d');
    if (day && !day.disabled) return pick(parse(day.dataset.d));
    const mo = e.target.closest('[data-mo]');
    if (mo) { monthOffset = Math.max(0, monthOffset + Number(mo.dataset.mo)); return drawPanel(); }
    if (e.target.id === 'reqBtn') openModal('solicitar');
  });
  $('#scrim').addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // ---------- modais ----------
  const modals = {
    login: () => `
      <h3>Entrar</h3>
      <p class="lead">Use o mesmo acesso para anunciar e para gerenciar seus painéis.</p>
      <form class="m__form" data-form="login">
        <label>E-mail<input class="field" type="email" required></label>
        <label>Senha<input class="field" type="password" required></label>
        <button class="btn btn--ink">Entrar</button>
      </form>
      <p class="m__switch">Ainda não tem conta? <a data-open="cadastro">Criar conta</a></p>`,
    cadastro: () => `
      <h3>Criar conta</h3>
      <p class="lead">Leva um minuto. Dá pra mudar o perfil depois.</p>
      <form class="m__form" data-form="cadastro">
        <div class="roles">
          <label><input type="radio" name="role" checked>Quero anunciar<small>Buscar e alugar painéis</small></label>
          <label><input type="radio" name="role">Tenho painéis<small>Cadastrar e receber pedidos</small></label>
        </div>
        <label>Nome ou empresa<input class="field" required></label>
        <label>E-mail<input class="field" type="email" required></label>
        <label>Senha<input class="field" type="password" minlength="8" required></label>
        <button class="btn btn--cone">Criar conta</button>
      </form>
      <p class="m__switch">Já tem conta? <a data-open="login">Entrar</a></p>`,
    solicitar: () => {
      const q = quote();
      return `
      <h3>Solicitar ${cur.id}</h3>
      <p class="lead">${cur.nome} · ${fmtDia(sel.start)} → ${fmtDia(sel.end)} · <b>${brl(q.total)}</b></p>
      <form class="m__form" data-form="solicitar">
        <div class="upload">Arraste a arte aqui ou <u>escolha um arquivo</u><br><small>PDF, JPG ou PNG · ${cur.medida} · pode enviar depois</small></div>
        <label>Mensagem para ${cur.dono}<textarea class="field" rows="3" placeholder="Ex.: campanha de inauguração, precisamos da colagem até sexta."></textarea></label>
        <label>Propor outro valor (opcional)<input class="field" inputmode="numeric" placeholder="${brl(q.sub)}"></label>
        <button class="btn btn--cone">Enviar solicitação</button>
      </form>`;
    },
    enviado: () => `
      <h3>Solicitação enviada</h3>
      <p class="lead">Avisamos ${cur.dono} por e-mail. Você acompanha tudo em <b>Minhas solicitações</b>.</p>
      <ol class="timeline">
        <li class="done">Solicitação enviada<small>Agora</small></li>
        <li class="now">Aprovação do proprietário<small>Normalmente em até 48h</small></li>
        <li>Pagamento por Pix ou cartão<small>Liberado após aprovação</small></li>
        <li>Instalação e foto de comprovação<small>Até 2 dias antes de ${fmtDia(sel.start)}</small></li>
      </ol>
      <button class="btn btn--ink" data-close style="width:100%">Fechar</button>`
  };

  const openModal = k => {
    $('#modalBody').innerHTML = modals[k]();
    $('#modal').classList.add('is-on');
    $('#modal').setAttribute('aria-hidden', 'false');
    const f = $('#modalBody input, #modalBody textarea');
    if (f) setTimeout(() => f.focus(), 50);
  };

  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); openModal(o.dataset.open); }
  });
  $('#modal').addEventListener('click', e => {
    if (e.target === $('#modal')) $('#modal').classList.remove('is-on');
    if (e.target.closest('[data-close]')) {
      if ($('#modalBody .timeline')) closeAll();
      else $('#modal').classList.remove('is-on');
    }
  });
  $('#modal').addEventListener('submit', e => {
    e.preventDefault();
    const k = e.target.dataset.form;
    // a solicitação não bloqueia a agenda: o bloqueio só acontece depois do pagamento
    if (k === 'solicitar') return openModal('enviado');
    $('#modal').classList.remove('is-on');
    toast(k === 'login' ? 'Isto é uma demonstração — login simulado.' : 'Conta criada. Enviamos um link de confirmação para o seu e-mail.');
  });

  // ---------- painel do proprietário ----------
  const S = window.SOLICITACOES;
  const drawReqs = () => {
    $('#reqs').innerHTML = S.map(r => {
      let act;
      if (r.status === 'pendente') act = `<button class="btn btn--sm" data-r="no" data-id="${r.id}">Recusar</button><button class="btn btn--sm btn--ink" data-r="ok" data-id="${r.id}">Aprovar</button>`;
      else if (r.status === 'aprovado') act = `<span class="status status--ok">aguardando pagamento</span>`;
      else if (r.status === 'recusado') act = `<span class="status status--no">recusada</span>`;
      else act = `<span class="status status--pago">pago · agenda bloqueada</span>`;
      return `<div class="req">
        <div class="req__who"><b>${r.anunciante}</b><span>${r.painel} · ${r.periodo} · ${brl(r.valor)}${r.proposta ? ` · <em>propôs ${brl(r.proposta)}</em>` : ''}</span></div>
        <div class="req__act">${act}</div>
      </div>`;
    }).join('');
    $('#pendCount').textContent = S.filter(r => r.status === 'pendente').length;
  };
  $('#reqs').addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    const r = S.find(x => x.id === b.dataset.id);
    r.status = b.dataset.r === 'ok' ? 'aprovado' : 'recusado';
    drawReqs();
    toast(r.status === 'aprovado' ? `${r.anunciante} foi avisado e já pode pagar.` : `Solicitação recusada. ${r.anunciante} recebeu o aviso por e-mail.`);
  });

  // ---------- como funciona ----------
  $$('[data-how]').forEach(b => b.addEventListener('click', () => {
    $$('[data-how]').forEach(x => x.classList.toggle('is-on', x === b));
    $$('.steps').forEach(s => { s.hidden = s.dataset.panel !== b.dataset.how; });
  }));

  // ---------- contato e menu ----------
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    e.target.reset();
    $('.contact__ok').hidden = false;
  });
  $('#burger').addEventListener('click', () => $('#nav').classList.toggle('is-open'));
  $$('#nav a').forEach(a => a.addEventListener('click', () => $('#nav').classList.remove('is-open')));

  render();
  drawReqs();
})();
