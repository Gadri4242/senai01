/**
 * SAAFEM — Sistema Automatizado de Análise Fiscal e Econômica Municipal
 * Paloware Core Engine v2.4
 * Arquitetura Reativa Vanilla JS — Ultra Otimizada para Sistemas de Qualquer Porte
 */

// =============================================================================
// 1. DATA STATE & REGISTERED USERS DATABASE
// =============================================================================

const SAAFEM_STATE = {
  theme: localStorage.getItem('saafem_theme') || 'dark',
  audioEnabled: localStorage.getItem('saafem_audio') !== 'false',
  activeView: 'view-dashboard',
  wizardStep: 1,
  
  // Registered users database (LocalStorage persisted)
  registeredUsers: JSON.parse(localStorage.getItem('saafem_users') || JSON.stringify([
    { email: 'nome.sobrenome@email.com', pass: '123456', name: 'Analista Paloware' },
    { email: 'analista@fazenda.gov.br', pass: 'saafem2024', name: 'Dr. Roberto Silveira' },
    { email: 'consultor@paloware.com.br', pass: 'paloware', name: 'Felipe Barbosa Braga' }
  ])),

  // Current logged in session
  currentUser: {
    email: 'nome.sobrenome@email.com',
    name: 'Analista Fiscal SAAFEM',
    isLoggedIn: true
  },

  // Active Municipality Context
  selectedCity: {
    name: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    status: 'Atualizado',
    exercicio: '2024',
    periodo: 'Anual',
    rcl: 11980779500, // R$ 11.98 bi
    pessoalMagisterioAtual: 50.2, // 50,2%
    baseFundeb: 16300000, // R$ 16.3 mi
    receitaBruta: 18400000,
    deducoes: 2100000
  },

  // Database of Municipalities in Paraná
  municipiosPR: [
    { name: 'Curitiba', ibge: '4106902', status: 'Atualizado', rcl: 11980779500, mag: 50.2, fundeb: 16.3 },
    { name: 'Londrina', ibge: '4113700', status: 'Pendente', rcl: 2840120000, mag: 49.1, fundeb: 8.4 },
    { name: 'Maringá', ibge: '4115200', status: 'Atualizado', rcl: 2180450000, mag: 47.8, fundeb: 6.9 },
    { name: 'Cascavel', ibge: '4104808', status: 'Revisar', rcl: 1720300000, mag: 52.4, fundeb: 5.1 },
    { name: 'Ponta Grossa', ibge: '4119905', status: 'Atualizado', rcl: 1540200000, mag: 46.5, fundeb: 4.8 },
    { name: 'Foz do Iguaçu', ibge: '4108304', status: 'Atualizado', rcl: 1390100000, mag: 48.2, fundeb: 4.2 }
  ],

  // Simulator Parameters
  simulator: {
    reajusteProposto: 6.27, // %
    cenarioAtualPct: 50.2,
    aposReajustePct: 53.0,
    impactoAnualReais: 8700000,
    cenariosSalvos: [
      {
        nome: 'Proposta Oficial Piso 2024',
        reajuste: 6.27,
        comprometimento: '53,0%',
        impacto: 'R$ 8.700.000,00',
        enquadramento: 'Alerta LRF (48,6% a 51,3%)'
      }
    ]
  },

  // Export Settings
  exportFormat: 'CSV',
  docCurrentPage: 1,
  docTotalPages: 8,
  coletaInProgress: false
};

// =============================================================================
// 2. SYNTHESIZED AUDIO ENGINE (Web Audio API - Zero External Files)
// =============================================================================

class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.08) {
    if (!SAAFEM_STATE.audioEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio not permitted yet
    }
  }

  click() {
    this.playTone(800, 'triangle', 0.04, 0.04);
  }

  success() {
    this.playTone(523.25, 'sine', 0.08, 0.06);
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.06), 70);
    setTimeout(() => this.playTone(1046.50, 'sine', 0.2, 0.07), 140);
  }

  warning() {
    this.playTone(380, 'sawtooth', 0.1, 0.05);
    setTimeout(() => this.playTone(280, 'sawtooth', 0.15, 0.05), 90);
  }

  laserScan() {
    if (!SAAFEM_STATE.audioEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }
}

const sfx = new SoundFX();

// =============================================================================
// 3. MAIN APPLICATION CONTROLLER
// =============================================================================

class SaafemApp {
  constructor() {
    this.initTheme();
    this.bindEvents();
    this.updateCityUI();
    this.recalculateSimulator(SAAFEM_STATE.simulator.reajusteProposto);
    this.animateCounters();
    this.setupChartTooltips();
  }

  // ---------------- Theme Management ----------------
  initTheme() {
    document.documentElement.setAttribute('data-theme', SAAFEM_STATE.theme);
    this.updateSoundIcon();
  }

  toggleTheme() {
    sfx.click();
    const newTheme = SAAFEM_STATE.theme === 'dark' ? 'light' : 'dark';
    SAAFEM_STATE.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('saafem_theme', newTheme);
    this.showToast(`Tema alterado para Modo ${newTheme === 'dark' ? 'Cyber Escuro' : 'Executivo Claro'}`, 'info');
  }

  toggleAudio() {
    SAAFEM_STATE.audioEnabled = !SAAFEM_STATE.audioEnabled;
    localStorage.setItem('saafem_audio', SAAFEM_STATE.audioEnabled);
    this.updateSoundIcon();
    if (SAAFEM_STATE.audioEnabled) {
      sfx.success();
      this.showToast('Efeitos sonoros ativados', 'success');
    } else {
      this.showToast('Efeitos sonoros desativados', 'info');
    }
  }

  updateSoundIcon() {
    const icon = document.getElementById('soundIcon');
    if (icon) {
      icon.textContent = SAAFEM_STATE.audioEnabled ? '🔊' : '🔇';
    }
  }

  // ---------------- Navigation & View Router ----------------
  navigateTo(viewId, stepIndex = null) {
    sfx.click();
    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(s => s.style.display = 'none');

    const target = document.getElementById(viewId);
    if (target) {
      target.style.display = 'block';
      target.style.animation = 'none';
      void target.offsetWidth; // Trigger reflow
      target.style.animation = 'screenReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    SAAFEM_STATE.activeView = viewId;

    // Update Sidebar active button
    document.querySelectorAll('.nav-item, .nav-subitem').forEach(b => {
      b.classList.remove('active');
      if (b.getAttribute('data-view') === viewId) {
        b.classList.add('active');
      }
    });

    // Update Context Badge
    const contextMap = {
      'view-dashboard': 'VISÃO GERAL',
      'view-municipios': 'MUNICÍPIOS',
      'view-coleta': 'COLETA DE DADOS',
      'view-conferencia': 'CONFERÊNCIA',
      'view-analise-geral': 'ANÁLISE FUNDEB',
      'view-analise-financeira': 'ANÁLISE LRF',
      'view-indicadores': 'INDICADORES',
      'view-simulador': 'SIMULADOR',
      'view-relatorios': 'RELATÓRIOS',
      'view-exportacao': 'EXPORTAÇÃO',
      'view-monitoramento': 'MONITORAMENTO',
      'view-login': 'LOGIN',
      'view-signup': 'NOVO REGISTRO'
    };

    const label = contextMap[viewId] || 'SISTEMA';
    const badge = document.getElementById('currentContextVal');
    if (badge) badge.textContent = label;

    // Update Wizard Stepper Index
    const stepMap = {
      'view-dashboard': 1,
      'view-municipios': 1,
      'view-coleta': 2,
      'view-conferencia': 3,
      'view-analise-geral': 4,
      'view-analise-financeira': 4,
      'view-indicadores': 5,
      'view-simulador': 5,
      'view-relatorios': 6,
      'view-exportacao': 6
    };

    const currentStep = stepIndex || stepMap[viewId] || 1;
    this.updateWizardStepper(currentStep);

    // Update Contextual Hint
    this.updateContextualHint(viewId);

    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateWizardStepper(step) {
    SAAFEM_STATE.wizardStep = step;
    
    // Update mini-bar in sidebar
    const miniBar = document.getElementById('wizardMiniBar');
    const miniLabel = document.getElementById('wizardCurrentLabel');
    if (miniBar && miniLabel) {
      const pct = Math.round((step / 6) * 100);
      miniBar.style.width = `${pct}%`;
      miniLabel.textContent = `${step} de 6`;
    }

    // Update main stepper bar
    for (let i = 1; i <= 6; i++) {
      const stepEl = document.getElementById(`step-btn-${i}`);
      if (!stepEl) continue;

      stepEl.classList.remove('active', 'completed');
      if (i < step) {
        stepEl.classList.add('completed');
      } else if (i === step) {
        stepEl.classList.add('active');
      }
    }
  }

  updateContextualHint(viewId) {
    const hints = {
      'view-dashboard': {
        title: 'Painel Central:',
        msg: 'Acompanhe as 368 coletas sincronizadas dos 399 municípios do Paraná e clique em "NOVA ANÁLISE" para auditar.'
      },
      'view-municipios': {
        title: 'Passo 1 — Seleção:',
        msg: 'Busque o município por nome ou código IBGE e confirme o exercício orçamentário (2024).'
      },
      'view-coleta': {
        title: 'Passo 2 — Coleta & OCR:',
        msg: 'Clique em "COLETAR DOS PORTAIS" para disparar a busca automática ou importe o PDF do TCE-PR.'
      },
      'view-conferencia': {
        title: 'Passo 3 — Conferência:',
        msg: 'Confira os valores em reais normalizados com rastreabilidade antes de aprovar para a análise.'
      },
      'view-analise-geral': {
        title: 'Passo 4 — Base FUNDEB:',
        msg: 'Verifique a memória de cálculo e a composição dos impostos (ICMS, FPM, IPVA) que formam a base.'
      },
      'view-analise-financeira': {
        title: 'Passo 4B — Limites LRF:',
        msg: 'Avalie a curva de despesa de pessoal frente ao limite de alerta (48,6%) e máximo (54%).'
      },
      'view-indicadores': {
        title: 'Passo 5 — Semáforo Fiscal:',
        msg: 'Veja o diagnóstico em cores: Regular (Verde), Atenção (Amarelo) ou Crítico (Vermelho).'
      },
      'view-simulador': {
        title: 'Passo 5B — Simulador Interativo:',
        msg: 'Arraste o slider para testar qualquer reajuste e ver o impacto financeiro em tempo real.'
      },
      'view-relatorios': {
        title: 'Passo 6 — Parecer Técnico:',
        msg: 'Pré-visualize o parecer oficial timbrado com síntese executiva pronto para exportação.'
      },
      'view-exportacao': {
        title: 'Passo 6B — Base Estruturada:',
        msg: 'Escolha CSV, EXCEL ou JSON e baixe a planilha contábil completa para uso local.'
      }
    };

    const hint = hints[viewId];
    if (hint) {
      document.getElementById('hintTitle').textContent = hint.title;
      document.getElementById('hintMessage').textContent = hint.msg;
      document.getElementById('contextHintCard').style.display = 'flex';
    }
  }

  // ---------------- Municipality Selection ----------------
  selectCityAndGo(cityName, ibgeCode) {
    const found = SAAFEM_STATE.municipiosPR.find(m => m.name.toLowerCase() === cityName.toLowerCase()) || {
      name: cityName,
      ibge: ibgeCode || '4106902',
      status: 'Atualizado',
      rcl: 11980779500,
      mag: 50.2,
      fundeb: 16.3
    };

    SAAFEM_STATE.selectedCity.name = found.name;
    SAAFEM_STATE.selectedCity.ibge = found.ibge;
    SAAFEM_STATE.selectedCity.status = found.status;
    SAAFEM_STATE.selectedCity.pessoalMagisterioAtual = found.mag;
    SAAFEM_STATE.selectedCity.baseFundeb = found.fundeb * 1000000;

    this.updateCityUI();
    this.recalculateSimulator(SAAFEM_STATE.simulator.reajusteProposto);

    sfx.success();
    this.showToast(`Município ${found.name} selecionado com sucesso!`, 'success');
    this.navigateTo('view-coleta', 2);
  }

  updateCityUI() {
    const city = SAAFEM_STATE.selectedCity;
    
    // Topbar
    const topName = document.getElementById('topbarCityName');
    const topIBGE = document.getElementById('topbarCityIBGE');
    if (topName) topName.textContent = `${city.name} • ${city.uf}`;
    if (topIBGE) topIBGE.textContent = `IBGE: ${city.ibge}`;

    // Coleta badge
    const colBadge = document.getElementById('coletaCityBadge');
    if (colBadge) colBadge.textContent = `Município: ${city.name} • ${city.uf}`;

    // Recorte Exportação
    const recMun = document.getElementById('recorteMunicipio');
    if (recMun) recMun.textContent = `${city.name} / ${city.uf}`;

    // Report Header & Texts
    const repTitle = document.querySelector('#parecerDocSheet .doc-title-block h2');
    if (repTitle) repTitle.textContent = `Análise fiscal — ${city.name} / ${city.uf}`;

    // Semáforo text
    const diagText = document.getElementById('diagnosisCityText');
    if (diagText) {
      diagText.textContent = `${city.name} está em ATENÇÃO: ${city.pessoalMagisterioAtual.toFixed(1)}% da RCL comprometida.`;
    }
  }

  // ---------------- Coleta & OCR Simulation ----------------
  startColetaProcess() {
    if (SAAFEM_STATE.coletaInProgress) return;
    SAAFEM_STATE.coletaInProgress = true;
    sfx.laserScan();

    const bar = document.getElementById('coletaProgressBar');
    const label = document.getElementById('progressPercentLabel');
    const stage = document.getElementById('coletaStageLabel');
    const stream = document.getElementById('crawlerStream');
    const btnConferencia = document.getElementById('btnGoToConferencia');

    let current = 20;
    bar.style.width = '20%';
    label.textContent = 'Iniciando extração do SICONFI e Portais — 20%';
    stage.textContent = 'Etapa 1/4: Conectando aos endpoints oficiais do Paraná';

    const logs = [
      { pct: 40, stage: 'Etapa 2/4: Capturando tabelas de receita via Pandas & Scraper', msg: '✓ Extração da tabela RREO Anexo 1 concluída (48 campos mapeados)' },
      { pct: 65, stage: 'Etapa 3/4: Higienização de dados e eliminação de inconsistências', msg: '✓ Tratamento: campo "Transferências" ausente convertido para R$ 0,00' },
      { pct: 85, stage: 'Etapa 4/4: Normalização contábil dos anexos fiscais (LRF)', msg: '⚡ Validando deduções legais do FUNDEB e cálculo da Receita Líquida' },
      { pct: 100, stage: 'Concluído: 100% dos dados fiscais prontos para conferência!', msg: '✓ Normalização completa! Cache operacional atualizado.' }
    ];

    let logIdx = 0;
    const interval = setInterval(() => {
      if (logIdx < logs.length) {
        const item = logs[logIdx];
        bar.style.width = `${item.pct}%`;
        label.textContent = `Processando documentos — ${item.pct}%`;
        stage.textContent = item.stage;

        const line = document.createElement('div');
        line.className = 'term-line ' + (item.pct === 100 ? 'success' : 'info');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${item.msg}`;
        stream.appendChild(line);
        stream.scrollTop = stream.scrollHeight;

        sfx.laserScan();
        logIdx++;
      } else {
        clearInterval(interval);
        SAAFEM_STATE.coletaInProgress = false;
        sfx.success();
        this.showToast('Coleta e normalização finalizadas com sucesso!', 'success');
        if (btnConferencia) {
          btnConferencia.classList.add('btn-glow');
        }
      }
    }, 600);
  }

  simulatePdfImport(fileName) {
    sfx.laserScan();
    const stream = document.getElementById('crawlerStream');
    const line = document.createElement('div');
    line.className = 'term-line highlight';
    line.textContent = `[OCR] Analisando arquivo "${fileName}" do TCE-PR via motor de visão...`;
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;

    setTimeout(() => {
      const line2 = document.createElement('div');
      line2.className = 'term-line success';
      line2.textContent = `✓ OCR concluído com 99.8% de precisão: 14 páginas fiscais estruturadas!`;
      stream.appendChild(line2);
      stream.scrollTop = stream.scrollHeight;
      sfx.success();
      this.showToast(`PDF do TCE importado com sucesso: ${fileName}`, 'success');
    }, 1000);
  }

  // ---------------- Dynamic Fiscal & Simulator Math ----------------
  recalculateSimulator(reajusteVal) {
    const reajuste = Math.max(0, Math.min(25, parseFloat(reajusteVal) || 0));
    SAAFEM_STATE.simulator.reajusteProposto = reajuste;

    const baseMag = SAAFEM_STATE.selectedCity.pessoalMagisterioAtual; // ex: 50.2%
    // Proportional formula: 6.27% increase produces ~2.8% p.p. in total payroll ratio (53.0%)
    const deltaRatio = 2.8 / 6.27;
    const novoComprometimento = baseMag + (reajuste * deltaRatio);

    // Annual financial impact formula: R$ 8.7 mi at 6.27%
    const impactoReais = (8700000 / 6.27) * reajuste;

    SAAFEM_STATE.simulator.aposReajustePct = novoComprometimento;
    SAAFEM_STATE.simulator.impactoAnualReais = impactoReais;

    // Update UI elements
    const inputNum = document.getElementById('inputNumReajuste');
    const rangeSlider = document.getElementById('rangeReajuste');
    if (inputNum && document.activeElement !== inputNum) inputNum.value = reajuste.toFixed(2);
    if (rangeSlider && document.activeElement !== rangeSlider) rangeSlider.value = reajuste;

    // Scenario cards
    const simAtual = document.getElementById('simCenarioAtual');
    const simApos = document.getElementById('simAposReajuste');
    const simDelta = document.getElementById('simDeltaLabel');
    const simImpacto = document.getElementById('simImpactoReais');
    const simMsg = document.getElementById('simMensagemLegal');

    if (simAtual) simAtual.textContent = `${baseMag.toFixed(1)}%`;
    if (simApos) {
      simApos.textContent = `${novoComprometimento.toFixed(1)}%`;
      simApos.className = `cenario-pct font-bold ${novoComprometimento > 51.3 ? 'text-danger' : (novoComprometimento > 45 ? 'text-warning' : 'text-success')}`;
    }
    if (simDelta) {
      const diff = novoComprometimento - baseMag;
      simDelta.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} p.p. na folha`;
    }
    if (simImpacto) {
      simImpacto.textContent = this.formatCurrency(impactoReais);
    }

    // Legal status text
    if (simMsg) {
      if (novoComprometimento <= 45.0) {
        simMsg.textContent = 'O cenário se mantém na MARGEM FISCAL CONFORTÁVEL (abaixo de 45%).';
        simMsg.style.color = 'var(--success)';
      } else if (novoComprometimento <= 48.6) {
        simMsg.textContent = 'O cenário está em zona de ATENÇÃO, mas ainda abaixo do limite de alerta da LRF (48,6%).';
        simMsg.style.color = 'var(--warning)';
      } else if (novoComprometimento <= 54.0) {
        simMsg.textContent = 'O cenário ultrapassa o limite de alerta (48,6%) e permanece abaixo do limite máximo da LRF (54%).';
        simMsg.style.color = 'var(--warning)';
      } else {
        simMsg.textContent = '⚠️ ATENÇÃO: O cenário ULTRAPASSA o limite máximo da LRF de 54,0%! Sujeito a sanções.';
        simMsg.style.color = 'var(--danger)';
      }
    }

    // Synchronize Financial Analysis Screen Cards (Pag 15)
    const finSit = document.getElementById('finSituacaoAtual');
    const finApos = document.getElementById('finAposReajuste');
    const finImp = document.getElementById('finImpactoAnual');
    if (finSit) finSit.textContent = `${baseMag.toFixed(1)}%`;
    if (finApos) finApos.textContent = `${novoComprometimento.toFixed(1)}%`;
    if (finImp) finImp.textContent = `R$ ${(impactoReais / 1000000).toFixed(1)} mi`;

    // Synchronize Indicadores Screen (Semáforo)
    this.updateSemaforoState(novoComprometimento);

    // Synchronize Document Text
    const docSintese = document.getElementById('docSinteseText');
    if (docSintese) {
      docSintese.innerHTML = `A despesa projetada com pessoal do Magistério alcança <strong>${novoComprometimento.toFixed(1)}% da Receita Corrente Líquida</strong> após o reajuste simulado de ${reajuste.toFixed(2)}%. Recomenda-se monitoramento mensal e revisão das premissas de receita para garantir o cumprimento da Lei Federal nº 11.738/2008 sem extrapolar o teto improrrogável de 54,0% imposto pela Lei de Responsabilidade Fiscal (LC nº 101/2000).`;
    }
  }

  updateSemaforoState(currentVal) {
    const cardReg = document.getElementById('cardRegular');
    const cardAtn = document.getElementById('cardAtencao');
    const cardCrit = document.getElementById('cardCritico');
    if (!cardReg || !cardAtn || !cardCrit) return;

    // Reset styles
    [cardReg, cardAtn, cardCrit].forEach(c => {
      c.classList.remove('card-highlighted-warn', 'card-highlighted-danger');
      const badge = c.querySelector('.semaforo-badge-status');
      if (badge) badge.className = 'semaforo-badge-status';
    });

    if (currentVal <= 45.0) {
      const b = cardReg.querySelector('.semaforo-badge-status');
      if (b) { b.textContent = 'ATIVO AGORA'; b.classList.add('status-active-now'); }
    } else if (currentVal <= 51.3) {
      cardAtn.classList.add('card-highlighted-warn');
      const b = cardAtn.querySelector('.semaforo-badge-status');
      if (b) { b.textContent = 'ATIVO AGORA'; b.classList.add('status-active-now'); }
    } else {
      cardCrit.classList.add('card-highlighted-danger');
      const b = cardCrit.querySelector('.semaforo-badge-status');
      if (b) { b.textContent = 'ATIVO AGORA'; b.classList.add('status-active-now'); }
    }
  }

  saveCurrentScenario() {
    sfx.success();
    const sim = SAAFEM_STATE.simulator;
    const count = sim.cenariosSalvos.length + 1;
    const novoCenario = {
      nome: `Cenário Simulado #${count} (${sim.reajusteProposto.toFixed(2)}%)`,
      reajuste: sim.reajusteProposto,
      comprometimento: `${sim.aposReajustePct.toFixed(1)}%`,
      impacto: this.formatCurrency(sim.impactoAnualReais),
      enquadramento: sim.aposReajustePct > 51.3 ? 'Crítico / LRF' : (sim.aposReajustePct > 48.6 ? 'Alerta LRF' : 'Regular')
    };

    sim.cenariosSalvos.push(novoCenario);
    this.renderSavedScenariosTable();
    this.showToast(`Cenário de ${sim.reajusteProposto.toFixed(2)}% salvo com sucesso!`, 'success');
  }

  renderSavedScenariosTable() {
    const tbody = document.getElementById('tbodyCenarios');
    const badge = document.getElementById('savedScenariosCount');
    if (!tbody) return;

    tbody.innerHTML = '';
    SAAFEM_STATE.simulator.cenariosSalvos.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.nome}</strong></td>
        <td><span class="tag-badge">${c.reajuste.toFixed(2)}%</span></td>
        <td><strong class="${parseFloat(c.comprometimento) > 51.3 ? 'text-danger' : 'text-warning'}">${c.comprometimento}</strong></td>
        <td>${c.impacto}</td>
        <td><span class="status-pill ${parseFloat(c.comprometimento) > 51.3 ? 'status-pill-danger' : 'status-pill-warning'}">${c.enquadramento}</span></td>
        <td style="text-align: right;">
          <button class="btn-table-action" onclick="app.loadScenario(${c.reajuste})">Aplicar ➜</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (badge) {
      badge.textContent = `${SAAFEM_STATE.simulator.cenariosSalvos.length} cenários salvos`;
    }
  }

  loadScenario(reajusteVal) {
    sfx.click();
    this.recalculateSimulator(reajusteVal);
    this.showToast(`Cenário com reajuste de ${reajusteVal}% carregado!`, 'info');
  }

  // ---------------- Technical Report & PDF Generation ----------------
  setDocPage(pageNum) {
    sfx.click();
    SAAFEM_STATE.docCurrentPage = pageNum;
    
    // Update pills
    document.querySelectorAll('.page-pill').forEach((p, idx) => {
      p.classList.toggle('active', idx + 1 === pageNum);
    });

    // Update Counter
    const counter = document.getElementById('docPageCounter');
    if (counter) counter.textContent = `Página ${pageNum} / ${SAAFEM_STATE.docTotalPages}`;

    // Add realistic paper page flip animation
    const sheet = document.getElementById('parecerDocSheet');
    if (sheet) {
      sheet.style.transform = 'scale(0.98)';
      setTimeout(() => sheet.style.transform = 'scale(1)', 150);
    }
  }

  exportPdfDocument() {
    sfx.success();
    this.showToast('Preparando documento homologado para exportação em PDF...', 'info');
    setTimeout(() => {
      window.print();
    }, 500);
  }

  // ---------------- Structured Data Exporter (CSV, Excel, JSON) ----------------
  setExportFormat(fmt) {
    sfx.click();
    SAAFEM_STATE.exportFormat = fmt;
    document.querySelectorAll('.btn-format').forEach(b => {
      const isActive = b.getAttribute('data-format') === fmt;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', isActive);
    });
  }

  generateAndDownloadFile() {
    sfx.success();
    const city = SAAFEM_STATE.selectedCity;
    const fmt = SAAFEM_STATE.exportFormat;
    const filename = `saafem_${city.name.toLowerCase()}_${city.exercicio}_${city.periodo.toLowerCase()}`;

    // Build complete dataset structure (48 campos)
    const fiscalDataset = {
      sistema: "SAAFEM - Sistema Automatizado de Análise Fiscal e Econômica Municipal",
      consultoria: "Paloware - Código, Criatividade e Inovação",
      timestamp: new Date().toISOString(),
      municipio: city.name,
      uf: city.uf,
      codigo_ibge: city.ibge,
      exercicio: city.exercicio,
      periodo: city.periodo,
      dados_orcamentarios: {
        receita_corrente_bruta: 12450900.00,
        receita_corrente_liquida_rcl: city.rcl,
        transferencias_fundeb_recebidas: 3087220.00,
        deducoes_formacao_fundeb: 450120.50,
        outras_transferencias_correntes: 0.00,
        receita_liquida_apurada: 11980779.50,
        base_calculo_fundeb_liquida: city.baseFundeb
      },
      composicao_receitas_vinculadas: {
        icms: 6800000.00,
        fpm: 5200000.00,
        ipva: 2400000.00,
        itr: 800000.00,
        outras: 1200000.00
      },
      despesa_pessoal_magisterio: {
        despesa_atual_exercicio: 6014351309.00,
        percentual_rcl_atual: city.pessoalMagisterioAtual,
        reajuste_piso_simulado_pct: SAAFEM_STATE.simulator.reajusteProposto,
        despesa_projetada_com_reajuste: 6350000000.00,
        percentual_rcl_projetado: SAAFEM_STATE.simulator.aposReajustePct,
        impacto_financeiro_anual_reais: SAAFEM_STATE.simulator.impactoAnualReais
      },
      limites_lrf: {
        limite_alerta_pct: 48.60,
        limite_prudencial_pct: 51.30,
        limite_maximo_pct: 54.00,
        enquadramento_atual: "ATENÇÃO",
        enquadramento_apos_reajuste: SAAFEM_STATE.simulator.aposReajustePct > 51.3 ? "CRÍTICO" : "ALERTA"
      },
      rastreabilidade: {
        fontes_dados: ["SICONFI", "Portal da Transparência", "TCE-PR"],
        hash_auditoria: "8f9b2ca74e7a1b4d092e",
        versao_motor: "Paloware v2.4-FastAPI"
      }
    };

    let blob, ext;

    if (fmt === 'JSON') {
      const jsonStr = JSON.stringify(fiscalDataset, null, 2);
      blob = new Blob([jsonStr], { type: 'application/json' });
      ext = 'json';
    } else if (fmt === 'CSV') {
      let csv = 'Categoria;Campo;Valor;Unidade\n';
      csv += `Geral;Município;${city.name};-\n`;
      csv += `Geral;Código IBGE;${city.ibge};-\n`;
      csv += `Geral;Exercício;${city.exercicio};Ano\n`;
      csv += `Orçamento;Receita Corrente Bruta;12450900.00;R$\n`;
      csv += `Orçamento;Receita Corrente Líquida;${city.rcl};R$\n`;
      csv += `Orçamento;FUNDEB Recebido;3087220.00;R$\n`;
      csv += `Orçamento;Deduções Legais;450120.50;R$\n`;
      csv += `Orçamento;Base FUNDEB Calculada;${city.baseFundeb};R$\n`;
      csv += `Magistério;Comprometimento Atual;${city.pessoalMagisterioAtual}%;%\n`;
      csv += `Magistério;Reajuste Simulado;${SAAFEM_STATE.simulator.reajusteProposto}%;%\n`;
      csv += `Magistério;Comprometimento Projetado;${SAAFEM_STATE.simulator.aposReajustePct.toFixed(1)}%;%\n`;
      csv += `Magistério;Impacto Anual Estimado;${SAAFEM_STATE.simulator.impactoAnualReais.toFixed(2)};R$\n`;
      csv += `LRF;Limite de Alerta;48.60%;%\n`;
      csv += `LRF;Limite Máximo;54.00%;%\n`;
      blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      ext = 'csv';
    } else { // EXCEL
      let xml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="SAAFEM_Fiscal"><Table>';
      xml += '<Row><Cell><Data ss:Type="String">Campo</Data></Cell><Cell><Data ss:Type="String">Valor</Data></Cell></Row>';
      xml += `<Row><Cell><Data ss:Type="String">Município</Data></Cell><Cell><Data ss:Type="String">${city.name}</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Código IBGE</Data></Cell><Cell><Data ss:Type="String">${city.ibge}</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Receita Corrente Líquida (RCL)</Data></Cell><Cell><Data ss:Type="Number">${city.rcl}</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Comprometimento Atual</Data></Cell><Cell><Data ss:Type="String">${city.pessoalMagisterioAtual}%</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Reajuste Proposto</Data></Cell><Cell><Data ss:Type="String">${SAAFEM_STATE.simulator.reajusteProposto}%</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Comprometimento Projetado</Data></Cell><Cell><Data ss:Type="String">${SAAFEM_STATE.simulator.aposReajustePct.toFixed(1)}%</Data></Cell></Row>`;
      xml += `<Row><Cell><Data ss:Type="String">Impacto Anual Estimado</Data></Cell><Cell><Data ss:Type="Number">${SAAFEM_STATE.simulator.impactoAnualReais.toFixed(2)}</Data></Cell></Row>`;
      xml += '</Table></Worksheet></Workbook>';
      blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      ext = 'xls';
    }

    // Trigger instant browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Arquivo ${filename}.${ext} gerado e baixado com sucesso!`, 'success');
  }

  // ---------------- Authentication Engine (Wireframes Pag 2 & 4) ----------------
  handleLoginSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginSenha');
    const alertBox = document.getElementById('loginAlertBox');
    const alertMsg = document.getElementById('loginAlertMsg');

    const email = (emailInput.value || '').trim();
    const pass = passInput.value || '';

    // Requirement from Page 2:
    // 1. If email not found: "e-mail não encontrado no sistema ou não existe"
    const user = SAAFEM_STATE.registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      sfx.warning();
      alertBox.style.display = 'flex';
      alertMsg.textContent = 'e-mail não encontrado no sistema ou não existe';
      emailInput.focus();
      return;
    }

    // 2. If password incorrect: "senha incorreta"
    if (user.pass !== pass) {
      sfx.warning();
      alertBox.style.display = 'flex';
      alertMsg.textContent = 'senha incorreta';
      passInput.focus();
      return;
    }

    // Login Success!
    alertBox.style.display = 'none';
    SAAFEM_STATE.currentUser = {
      email: user.email,
      name: user.name || 'Analista Fiscal',
      isLoggedIn: true
    };

    document.getElementById('displayUserName').textContent = user.name;
    sfx.success();
    this.showToast(`Bem-vindo ao SAAFEM, ${user.name}!`, 'success');
    this.navigateTo('view-dashboard', 1);
  }

  handleSignupSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('signupEmail');
    const passInput = document.getElementById('signupSenha');
    const repitaInput = document.getElementById('signupRepitaSenha');
    const alertBox = document.getElementById('signupAlertBox');
    const alertMsg = document.getElementById('signupAlertMsg');

    const email = (emailInput.value || '').trim();
    const pass = passInput.value || '';
    const repita = repitaInput.value || '';

    if (!email || !email.includes('@')) {
      sfx.warning();
      alertBox.style.display = 'flex';
      alertMsg.textContent = 'Por favor insira um endereço de e-mail válido.';
      emailInput.focus();
      return;
    }

    // Requirement from Page 4:
    // If passwords don't match: "A senha é diferente"
    if (pass !== repita) {
      sfx.warning();
      alertBox.style.display = 'flex';
      alertMsg.textContent = 'A senha é diferente';
      repitaInput.focus();
      return;
    }

    if (pass.length < 4) {
      sfx.warning();
      alertBox.style.display = 'flex';
      alertMsg.textContent = 'A senha deve ter pelo menos 4 caracteres.';
      passInput.focus();
      return;
    }

    // Register user
    const newUser = {
      email: email,
      pass: pass,
      name: email.split('@')[0].replace('.', ' ')
    };

    SAAFEM_STATE.registeredUsers.push(newUser);
    localStorage.setItem('saafem_users', JSON.stringify(SAAFEM_STATE.registeredUsers));

    SAAFEM_STATE.currentUser = {
      email: newUser.email,
      name: newUser.name,
      isLoggedIn: true
    };

    alertBox.style.display = 'none';
    document.getElementById('displayUserName').textContent = newUser.name;
    sfx.success();
    this.showToast('Conta criada com sucesso no SAAFEM!', 'success');
    this.navigateTo('view-dashboard', 1);
  }

  // ---------------- UI Helpers: Numbers, Counters, Tooltips ----------------
  formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }

  animateCounters() {
    const counters = document.querySelectorAll('.counter-anim');
    counters.forEach(counter => {
      const target = parseFloat(counter.getAttribute('data-val') || counter.textContent);
      if (isNaN(target)) return;

      let start = 0;
      const duration = 1200;
      const startTime = performance.now();

      const step = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        const current = Math.floor(start + (target - start) * ease);
        counter.textContent = current;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          counter.textContent = target;
        }
      };

      requestAnimationFrame(step);
    });
  }

  setupChartTooltips() {
    const tooltip = document.getElementById('chartTooltip');
    const points = document.querySelectorAll('.data-point');

    points.forEach(pt => {
      pt.addEventListener('mouseenter', (e) => {
        const tipText = pt.getAttribute('data-tip');
        if (!tipText || !tooltip) return;
        sfx.click();
        tooltip.textContent = tipText;
        tooltip.style.opacity = '1';
        
        const rect = pt.getBoundingClientRect();
        const parentRect = pt.closest('.chart-canvas-container').getBoundingClientRect();
        tooltip.style.left = `${rect.left - parentRect.left - 30}px`;
        tooltip.style.top = `${rect.top - parentRect.top - 36}px`;
      });

      pt.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.opacity = '0';
      });
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : (type === 'warning' ? '⚠️' : (type === 'danger' ? '🚨' : 'ℹ'));
    toast.innerHTML = `<span style="font-size:1.1rem;font-weight:bold;">${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // ---------------- DOM Event Bindings ----------------
  bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    // Audio toggle
    const audioBtn = document.getElementById('btnToggleAudio');
    if (audioBtn) audioBtn.addEventListener('click', () => this.toggleAudio());

    // Mobile sidebar toggle
    const mobileMenu = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('mainSidebar');
    if (mobileMenu && sidebar) {
      mobileMenu.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Sidebar Navigation buttons
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.getAttribute('data-view');
        if (view) {
          this.navigateTo(view);
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });

    // Submenu Toggle
    const analisesToggle = document.getElementById('nav-analises-toggle');
    const submenu = document.getElementById('navSubmenu');
    if (analisesToggle && submenu) {
      analisesToggle.addEventListener('click', () => {
        sfx.click();
        const isOpen = submenu.classList.toggle('open');
        analisesToggle.setAttribute('aria-expanded', isOpen);
      });
    }

    // Wizard Stepper click handlers
    document.querySelectorAll('.wizard-step').forEach(stepBtn => {
      stepBtn.addEventListener('click', () => {
        const targetView = stepBtn.getAttribute('data-target-view');
        if (targetView) this.navigateTo(targetView);
      });
    });

    // Quick New Analysis Button
    const btnNewAnalysis = document.getElementById('btnStartNewAnalysis');
    if (btnNewAnalysis) {
      btnNewAnalysis.addEventListener('click', () => {
        this.navigateTo('view-municipios', 1);
      });
    }

    // Quick change city chip in topbar
    const btnQuickCity = document.getElementById('btnQuickChangeCity');
    if (btnQuickCity) {
      btnQuickCity.addEventListener('click', () => {
        this.navigateTo('view-municipios', 1);
      });
    }

    // Municipality Search Autocomplete
    const searchInput = document.getElementById('inputBuscaMunicipio');
    const autoList = document.getElementById('searchAutocompleteList');
    if (searchInput && autoList) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (!val) {
          autoList.style.display = 'none';
          return;
        }

        const matches = SAAFEM_STATE.municipiosPR.filter(m => 
          m.name.toLowerCase().includes(val) || m.ibge.includes(val)
        );

        if (matches.length > 0) {
          autoList.innerHTML = '';
          matches.forEach(m => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `<span><strong>${m.name}</strong> • PR</span> <code>IBGE: ${m.ibge}</code>`;
            item.addEventListener('click', () => {
              searchInput.value = m.name;
              autoList.style.display = 'none';
              this.selectCityAndGo(m.name, m.ibge);
            });
            autoList.appendChild(item);
          });
          autoList.style.display = 'block';
        } else {
          autoList.style.display = 'none';
        }
      });

      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autoList.contains(e.target)) {
          autoList.style.display = 'none';
        }
      });
    }

    // Apply Filter Button
    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    if (btnAplicarFiltro) {
      btnAplicarFiltro.addEventListener('click', () => {
        const nameVal = document.getElementById('inputBuscaMunicipio').value.trim();
        if (nameVal) {
          this.selectCityAndGo(nameVal);
        } else {
          this.showToast('Filtro de exercício e período aplicado!', 'info');
          this.navigateTo('view-coleta', 2);
        }
      });
    }

    // Coleta Buttons
    const btnColetar = document.getElementById('btnColetarPortais');
    if (btnColetar) {
      btnColetar.addEventListener('click', () => this.startColetaProcess());
    }

    const btnPdf = document.getElementById('btnImportarPdfTce');
    const fileInput = document.getElementById('pdfFileInput');
    if (btnPdf && fileInput) {
      btnPdf.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.simulatePdfImport(e.target.files[0].name);
        }
      });
    }

    // Aprovar Dados Button
    const btnAprovar = document.getElementById('btnAprovarDados');
    if (btnAprovar) {
      btnAprovar.addEventListener('click', () => {
        sfx.success();
        this.showToast('Dados fiscais homologados e aprovados pelo analista!', 'success');
        this.navigateTo('view-analise-geral', 4);
      });
    }

    // Simulator Interactive Controls
    const rangeSlider = document.getElementById('rangeReajuste');
    const inputNum = document.getElementById('inputNumReajuste');

    if (rangeSlider) {
      rangeSlider.addEventListener('input', (e) => {
        this.recalculateSimulator(e.target.value);
      });
    }

    if (inputNum) {
      inputNum.addEventListener('input', (e) => {
        this.recalculateSimulator(e.target.value);
      });
    }

    // Preset Chips for Reajuste
    document.querySelectorAll('.chip-preset').forEach(chip => {
      chip.addEventListener('click', () => {
        sfx.click();
        document.querySelectorAll('.chip-preset').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const val = parseFloat(chip.getAttribute('data-val'));
        this.recalculateSimulator(val);
      });
    });

    // Save Scenario
    const btnSaveScen = document.getElementById('btnSalvarCenario');
    if (btnSaveScen) {
      btnSaveScen.addEventListener('click', () => this.saveCurrentScenario());
    }

    // Reset Simulator
    const btnResetSim = document.getElementById('btnResetarSimulador');
    if (btnResetSim) {
      btnResetSim.addEventListener('click', () => {
        sfx.click();
        this.recalculateSimulator(6.27);
        this.showToast('Simulador restaurado para 6,27% (Piso MEC)', 'info');
      });
    }

    // Export PDF Button
    const btnPdfExp = document.getElementById('btnExportarPdf');
    if (btnPdfExp) {
      btnPdfExp.addEventListener('click', () => this.exportPdfDocument());
    }

    // Export Format Toggle Buttons
    document.querySelectorAll('.btn-format').forEach(btn => {
      btn.addEventListener('click', () => {
        const fmt = btn.getAttribute('data-format');
        this.setExportFormat(fmt);
      });
    });

    // Generate & Download File Button
    const btnGerarArquivo = document.getElementById('btnGerarArquivo');
    if (btnGerarArquivo) {
      btnGerarArquivo.addEventListener('click', () => this.generateAndDownloadFile());
    }

    // Paloware Modal Events
    const btnOpenPalo = document.getElementById('btnOpenPalowareModal');
    const modalPalo = document.getElementById('palowareModal');
    const btnClosePalo = document.getElementById('btnClosePalowareModal');
    const btnCloseOk = document.getElementById('btnModalCloseOk');
    const brandLogoBtn = document.getElementById('brandLogoBtn');

    const openModal = () => {
      sfx.click();
      if (modalPalo) modalPalo.style.display = 'flex';
    };
    const closeModal = () => {
      sfx.click();
      if (modalPalo) modalPalo.style.display = 'none';
    };

    if (btnOpenPalo) btnOpenPalo.addEventListener('click', openModal);
    if (brandLogoBtn) brandLogoBtn.addEventListener('click', openModal);
    if (btnClosePalo) btnClosePalo.addEventListener('click', closeModal);
    if (btnCloseOk) btnCloseOk.addEventListener('click', closeModal);
    if (modalPalo) {
      modalPalo.addEventListener('click', (e) => {
        if (e.target === modalPalo) closeModal();
      });
    }

    // Help Guide Button
    const btnHelp = document.getElementById('btnHelpGuide');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        sfx.click();
        this.showToast('Trilha Rápida: 1. Escolha o Município ➜ 2. Coleta ➜ 3. Conferência ➜ 4. Análise ➜ 5. Simule o Reajuste ➜ 6. Emita o Parecer!', 'info');
      });
    }

    // Close Hint Card
    const btnCloseHint = document.getElementById('btnCloseHint');
    const hintCard = document.getElementById('contextHintCard');
    if (btnCloseHint && hintCard) {
      btnCloseHint.addEventListener('click', () => {
        hintCard.style.display = 'none';
      });
    }

    // Auth forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', (e) => this.handleSignupSubmit(e));

    const btnGoToSignup = document.getElementById('btnGoToSignup');
    if (btnGoToSignup) btnGoToSignup.addEventListener('click', () => this.navigateTo('view-signup'));

    const btnGoToLogin = document.getElementById('btnGoToLogin');
    if (btnGoToLogin) btnGoToLogin.addEventListener('click', () => this.navigateTo('view-login'));

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        sfx.click();
        this.showToast('Sessão encerrada com segurança.', 'info');
        this.navigateTo('view-login');
      });
    }

    // Toggle Login Password Visibility
    const btnTogglePass = document.getElementById('btnToggleLoginPass');
    const passInput = document.getElementById('loginSenha');
    if (btnTogglePass && passInput) {
      btnTogglePass.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        btnTogglePass.textContent = isPass ? '🙈' : '👁️';
      });
    }

    // Demo Fast Login Button
    const btnDemo = document.getElementById('btnQuickDemoLogin');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => {
        const email = document.getElementById('loginEmail');
        const pass = document.getElementById('loginSenha');
        if (email && pass) {
          email.value = 'nome.sobrenome@email.com';
          pass.value = '123456';
          sfx.click();
          this.showToast('Credenciais de teste preenchidas! Clique em "Entrar".', 'info');
        }
      });
    }
  }
}

// Instantiate and expose globally
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new SaafemApp();
  window.app = app;
});
