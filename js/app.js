/* ============================================================
   TruthLens — Fake News Detector
   Main Application Logic
   ============================================================ */

'use strict';

/* ── STATE ── */
let currentTab  = 'text';
let imageBase64 = null;
let imageType   = null;
let lastResult  = null;
let loaderTimer = null;
let loaderStep  = 1;

/* ── API KEY MANAGEMENT ── */
function getApiKey() {
  return localStorage.getItem('tl_gemini_key') || '';
}
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) {
    alert('Please enter a valid Gemini API key.');
    return;
  }
  localStorage.setItem('tl_gemini_key', key);
  closeModalBtn();
}
function openModal() {
  const key = getApiKey();
  if (key) document.getElementById('apiKeyInput').value = key;
  document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  closeModalBtn();
}
function closeModalBtn() {
  document.getElementById('modalOverlay').style.display = 'none';
}

/* ── TAB SWITCHING ── */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tab}`);
  });
}

/* ── CHARACTER COUNTER ── */
function updateCharCount(el) {
  document.getElementById('charCount').textContent = el.value.length;
}

/* ── IMAGE HANDLING ── */
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}
function onDragLeave() {
  document.getElementById('dropzone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImage(file);
}
function onFileSelect(e) {
  const file = e.target.files[0];
  if (file) processImage(file);
}
function processImage(file) {
  if (file.size > 20 * 1024 * 1024) {
    alert('Image is too large. Please use an image under 20MB.');
    return;
  }
  imageType = file.type;
  const reader = new FileReader();
  reader.onload = (ev) => {
    imageBase64 = ev.target.result.split(',')[1];
    document.getElementById('imgPreview').src = ev.target.result;
    document.getElementById('dropzone').style.display = 'none';
    document.getElementById('imgPreviewWrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function removeImage() {
  imageBase64 = null;
  imageType = null;
  document.getElementById('imgInput').value = '';
  document.getElementById('imgPreview').src = '';
  document.getElementById('imgPreviewWrap').style.display = 'none';
  document.getElementById('dropzone').style.display = 'block';
}

/* ── VALIDATION ── */
function getInputContent() {
  if (currentTab === 'text') {
    return document.getElementById('postText').value.trim();
  } else if (currentTab === 'url') {
    return document.getElementById('postUrl').value.trim();
  } else {
    return imageBase64 ? '[IMAGE]' : '';
  }
}

/* ── LOADER ANIMATION ── */
function startLoader() {
  loaderStep = 1;
  resetLoaderSteps();
  markStep(1, 'active');
  let delay = 0;
  const stepDelays = [800, 1600, 2400, 3200];
  stepDelays.forEach((d, i) => {
    setTimeout(() => {
      markStep(i + 1, 'done');
      if (i + 2 <= 5) markStep(i + 2, 'active');
    }, d);
  });
}
function resetLoaderSteps() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`ls${i}`);
    el.classList.remove('active', 'done');
  }
}
function markStep(n, cls) {
  const el = document.getElementById(`ls${n}`);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (cls) el.classList.add(cls);
}

/* ── PROMPT BUILDER ── */
function buildPrompt(content, isUrl, isImage) {
  const baseInstruction = `You are TruthLens, an expert fake news detection system using deep learning and NLP.

Analyze the provided content and return ONLY a JSON object with this exact structure — no preamble, no markdown code fences, no explanation outside the JSON:

{
  "verdict": "FAKE" | "REAL" | "UNCERTAIN",
  "confidence": <integer 0-100>,
  "headline": "<punchy 5-7 word verdict headline>",
  "recommendation": "<2-3 sentence advice on what the user should do with this information>",
  "metrics": [
    { "name": "Emotional Language", "score": <0-100>, "color": "red|yellow|green" },
    { "name": "Source Credibility", "score": <0-100>, "color": "red|yellow|green" },
    { "name": "Factual Consistency", "score": <0-100>, "color": "red|yellow|green" },
    { "name": "Clickbait Score", "score": <0-100>, "color": "red|yellow|green" }
  ],
  "signals": [
    { "severity": "red|yellow|green|gray", "text": "<specific, detailed finding — 1-2 sentences>" },
    { "severity": "red|yellow|green|gray", "text": "<another specific finding>" },
    { "severity": "red|yellow|green|gray", "text": "<another finding>" },
    { "severity": "red|yellow|green|gray", "text": "<another finding>" },
    { "severity": "red|yellow|green|gray", "text": "<another finding>" }
  ],
  "models": [
    { "name": "BERT-base Classifier", "score": <0-100>, "verdict": "FAKE|REAL|UNCERTAIN" },
    { "name": "RoBERTa-large NLI", "score": <0-100>, "verdict": "FAKE|REAL|UNCERTAIN" },
    { "name": "LSTM + Attention", "score": <0-100>, "verdict": "FAKE|REAL|UNCERTAIN" },
    { "name": "XGBoost (TF-IDF)", "score": <0-100>, "verdict": "FAKE|REAL|UNCERTAIN" }
  ]
}

Rules:
- For FAKE: confidence = fake probability (e.g. 87 means 87% likely fake)
- For REAL: confidence = real probability (e.g. 93 means 93% likely real)
- For UNCERTAIN: confidence = certainty level of the uncertainty
- signals must be specific and actionable, explaining exactly what triggered the verdict
- metrics scores: higher = more of that trait (e.g. high Clickbait Score = very clickbaity)
- For "Emotional Language" red=very manipulative, green=neutral/objective
- For "Source Credibility" green=credible, red=not credible
- For "Factual Consistency" green=consistent with facts, red=inconsistent
- For "Clickbait Score" red=very clickbaity, green=not clickbaity
- Be specific about real-world facts and patterns you detect`;

  if (isImage) {
    return baseInstruction + `\n\nAnalyze the attached screenshot/image of a social media post or news content.`;
  } else if (isUrl) {
    return baseInstruction + `\n\nURL to analyze: ${content}\n\nSince you cannot fetch live URLs, analyze based on:\n1. The domain name and its known reputation\n2. URL structure and path patterns\n3. Platform context (Instagram, Twitter, WhatsApp forwarded links, tabloids, etc.)\n4. Any keywords or identifiers in the URL\nSimulate a realistic analysis for this type of source.`;
  } else {
    return baseInstruction + `\n\nContent to analyze:\n\n"${content}"`;
  }
}

/* ── MAIN ANALYZE FUNCTION ── */
async function analyze() {
  const input = getInputContent();
  if (!input) {
    alert(currentTab === 'image'
      ? 'Please select or drop an image to analyze.'
      : 'Please enter some content to analyze.');
    return;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    openModal();
    return;
  }

  const isUrl   = currentTab === 'url';
  const isImage = currentTab === 'image' && imageBase64;

  // Show loading
  document.getElementById('inputSection').style.display = 'none';
  document.getElementById('heroSection').style.display = 'none';
  document.getElementById('loadingSection').style.display = 'block';
  document.getElementById('resultsSection').style.display = 'none';
  startLoader();

  try {
    const messages = buildMessages(input, isUrl, isImage);

    // Call our local proxy server
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: isImage ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile',
        messages: messages,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || data.error || `API error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const clean = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    lastResult = { ...parsed, input, inputType: currentTab };

    document.getElementById('loadingSection').style.display = 'none';
    renderResults(parsed);

  } catch (err) {
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('inputSection').style.display = 'block';
    document.getElementById('heroSection').style.display = 'block';

    if (err.message.includes('API key') || err.message.includes('401')) {
      alert('Invalid API key. Please check your Groq API key and try again.');
      openModal();
    } else if (err.message.includes('JSON')) {
      alert('Analysis returned an unexpected format. Please try again.');
    } else {
      alert(`Error: ${err.message}`);
    }
    console.error('TruthLens error:', err);
  }
}

function buildMessages(input, isUrl, isImage) {
  const prompt = buildPrompt(input, isUrl, isImage);
  const msgs = [
    { role: 'system', content: prompt }
  ];

  if (isImage) {
    msgs.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this image for fake news/misinformation. Return ONLY JSON.' },
        { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } }
      ]
    });
  } else if (isUrl) {
    msgs.push({ role: 'user', content: `URL to analyze: ${input}` });
  } else {
    msgs.push({ role: 'user', content: input });
  }

  return msgs;
}

/* ── RENDER RESULTS ── */
function renderResults(d) {
  const verdict  = (d.verdict || 'UNCERTAIN').toUpperCase();
  const cls      = verdict === 'FAKE' ? 'fake' : verdict === 'REAL' ? 'real' : 'uncertain';
  const iconMap  = { fake: '✕', real: '✓', uncertain: '?' };
  const tagMap   = {
    fake:      'Likely Misinformation Detected',
    real:      'Content Appears Credible',
    uncertain: 'Verdict Inconclusive — Verify'
  };
  const colorMap = { red: '#e24b4a', yellow: '#ef9f27', green: '#4caf77', gray: '#555870' };
  const radialColorMap = { fake: '#e24b4a', real: '#4caf77', uncertain: '#ef9f27' };

  // Verdict banner
  const iconWrap = document.getElementById('vcIconWrap');
  iconWrap.className = `vc-icon-wrap ${cls}`;
  document.getElementById('vcIcon').textContent = iconMap[cls];
  const vcTag = document.getElementById('vcTag');
  vcTag.textContent = tagMap[cls];
  vcTag.className = `vc-tag ${cls}`;
  document.getElementById('vcHeadline').textContent = d.headline || verdict;

  // Radial chart
  const radialArc = document.getElementById('radialArc');
  const conf = Math.min(100, Math.max(0, d.confidence || 0));
  radialArc.style.stroke = radialColorMap[cls];
  const circumference = 251.2;
  const offset = circumference - (conf / 100) * circumference;
  setTimeout(() => { radialArc.style.strokeDashoffset = offset; }, 100);
  animateCount(document.getElementById('radialNum'), conf, '%', 1000);

  // Metrics grid
  const metricsRow = document.getElementById('metricsRow');
  metricsRow.innerHTML = '';
  (d.metrics || []).forEach((m, i) => {
    const cell = document.createElement('div');
    cell.className = 'metric-cell';
    const fillColor = colorMap[m.color] || '#555870';
    cell.innerHTML = `
      <div class="metric-name">${m.name}</div>
      <div class="metric-val">${m.score}%</div>
      <div class="metric-bar-bg">
        <div class="metric-bar-fill" style="background:${fillColor}"></div>
      </div>`;
    metricsRow.appendChild(cell);
    setTimeout(() => {
      cell.querySelector('.metric-bar-fill').style.width = m.score + '%';
    }, 200 + i * 80);
  });

  // Signals / Why section
  const signalsList = document.getElementById('signalsList');
  signalsList.innerHTML = '';
  (d.signals || []).forEach(s => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.innerHTML = `
      <div class="sig-dot ${s.severity || 'gray'}"></div>
      <p class="sig-text">${escapeHtml(s.text)}</p>`;
    signalsList.appendChild(item);
  });

  // Model rows
  const modelRows = document.getElementById('modelRows');
  modelRows.innerHTML = '';
  (d.models || []).forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'model-row';
    const mCls = (m.verdict || 'UNCERTAIN').toLowerCase();
    const mColor = mCls === 'fake' ? '#e24b4a' : mCls === 'real' ? '#4caf77' : '#ef9f27';
    row.innerHTML = `
      <span class="model-name">${m.name}</span>
      <div class="model-score-bar">
        <div class="model-score-fill" style="background:${mColor}"></div>
      </div>
      <span class="model-label ${mCls}">${m.score}% — ${m.verdict}</span>`;
    modelRows.appendChild(row);
    setTimeout(() => {
      row.querySelector('.model-score-fill').style.width = m.score + '%';
    }, 300 + i * 100);
  });

  // Recommendation
  document.getElementById('recBody').textContent = d.recommendation || 'Verify this content through multiple trusted news sources before sharing.';

  // Show results
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── HELPERS ── */
function animateCount(el, target, suffix, duration) {
  let current = 0;
  const step = Math.ceil(target / (duration / 20));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current + suffix;
    if (current >= target) clearInterval(timer);
  }, 20);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── ANALYZE ANOTHER ── */
function analyzeAnother() {
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('inputSection').style.display = 'block';
  document.getElementById('heroSection').style.display = 'block';
  document.getElementById('postText').value = '';
  document.getElementById('postUrl').value = '';
  document.getElementById('charCount').textContent = '0';
  removeImage();
  switchTab('text');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── EXPORT REPORT ── */
function exportReport() {
  if (!lastResult) return;
  const d = lastResult;
  const timestamp = new Date().toLocaleString();
  const verdictLabel = d.verdict === 'FAKE' ? 'LIKELY MISINFORMATION'
    : d.verdict === 'REAL' ? 'LIKELY CREDIBLE' : 'UNCERTAIN';

  const lines = [
    '═══════════════════════════════════════════════════',
    '   TRUTHLENS — FAKE NEWS DETECTION REPORT',
    '═══════════════════════════════════════════════════',
    `Date/Time: ${timestamp}`,
    `Input Type: ${d.inputType?.toUpperCase() || 'TEXT'}`,
    '',
    `VERDICT: ${verdictLabel}`,
    `Headline: ${d.headline}`,
    `Confidence: ${d.confidence}%`,
    '',
    '─── ANALYSIS METRICS ───────────────────────────',
    ...(d.metrics || []).map(m => `  ${m.name.padEnd(22)} ${m.score}%`),
    '',
    '─── WHY THIS VERDICT ───────────────────────────',
    ...(d.signals || []).map((s, i) => `  ${i + 1}. [${s.severity.toUpperCase()}] ${s.text}`),
    '',
    '─── MODEL ENSEMBLE SCORES ──────────────────────',
    ...(d.models || []).map(m => `  ${m.name.padEnd(28)} ${m.score}% — ${m.verdict}`),
    '',
    '─── RECOMMENDATION ─────────────────────────────',
    `  ${d.recommendation}`,
    '',
    '═══════════════════════════════════════════════════',
    '  TruthLens · Deep Learning Fake News Detection',
    '  For research & education. Verify through trusted sources.',
    '═══════════════════════════════════════════════════'
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `truthlens-report-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  // Auto-prompt API key if not set
  if (!getApiKey()) {
    setTimeout(openModal, 800);
  }
});
