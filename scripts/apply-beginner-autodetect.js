const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (!html.includes(before)) throw new Error(`Patch target not found: ${label}`);
  html = html.replace(before, after);
}

function replaceBetween(start, end, replacement, label) {
  const a = html.indexOf(start);
  if (a < 0) throw new Error(`Start marker not found: ${label}`);
  const b = html.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found: ${label}`);
  html = html.slice(0, a) + replacement + html.slice(b);
}

function renameFunction(fn, from, to) {
  return fn.toString().replace(from, to);
}

replaceOnce(
  '<div class="toggle-copy"><div class="toggle-title">Endpoint Only Mode</div><div class="toggle-sub">ON = paste one full HTTPS API endpoint only. Defaults to GET, no auth, and no API key. Use Advanced only if the endpoint needs POST or a request body.</div></div>',
  '<div class="toggle-copy"><div class="toggle-title">Endpoint Only Mode</div><div class="toggle-sub">ON = paste a base URL like https://myfreeapi.com/v1 or a full endpoint. The tester auto-detects models, request format, and safe authentication style before testing.</div></div>',
  'endpoint-only toggle copy'
);

replaceOnce(
  '<label for="endpointOnlyURL"><i data-lucide="link" width="14"></i>Full API endpoint URL</label>\n  <div class="control-wrap"><i class="control-icon" data-lucide="globe-2"></i><input class="input" id="endpointOnlyURL" placeholder="https://api.example.com/v1/status" autocomplete="url" /></div>\n  <div class="helper">Only HTTPS endpoints are accepted. Direct Browser is selected by default. If the endpoint blocks browser CORS, Vercel Proxy still requires its host in CUSTOM_PROXY_ALLOWLIST.</div>',
  '<label for="endpointOnlyURL"><i data-lucide="link" width="14"></i>Base URL or full API endpoint</label>\n  <div class="control-wrap"><i class="control-icon" data-lucide="globe-2"></i><input class="input" id="endpointOnlyURL" placeholder="https://myfreeapi.com/v1" autocomplete="url" /></div>\n  <div class="helper">Beginner mode: paste the provider base URL and your API key if you have one. Test/Load Models auto-detects common model, chat, responses, messages, and Gemini generateContent routes. Full endpoint URLs are used as-is. HTTPS only.</div>',
  'endpoint-only field copy'
);

replaceOnce(
  "const state={models:[],selected:null,keys:[],activeKeyIndex:0,keyResults:new Map(),keysVisible:false,lastResultText:''};",
  "const state={models:[],selected:null,keys:[],activeKeyIndex:0,keyResults:new Map(),keysVisible:false,lastResultText:'',endpointDetection:null,endpointOnlyPrevious:null};",
  'state endpoint detection'
);

function patchedSyncEndpointOnlyMode(on) {
  $('endpointOnlyField').style.display = on ? 'block' : 'none';
  for (const id of ['baseURL', 'endpointPath', 'modelsPath']) {
    const field = $(id)?.closest('.field');
    if (field) field.style.display = on ? 'none' : '';
  }
  $('usePresets').disabled = on;
  if (on) {
    state.endpointOnlyPrevious = {
      transport: $('transportMode').value,
      usePresets: $('usePresets').checked,
      sendAuth: $('sendAuth').checked,
      authMode: $('authMode').value
    };
    state.endpointDetection = null;
    state.models = [];
    state.selected = null;
    renderModelList([]);
    $('selectedModelName').textContent = 'Auto-detecting on first test';
    $('selectedModelId').textContent = 'Paste a base URL, then test';
    $('usePresets').checked = false;
    setPresetMode(false);
    $('sendAuth').disabled = false;
    if (!$('sendAuth').checked) {
      $('sendAuth').checked = true;
      $('authMode').disabled = false;
      $('authMode').value = lastEnabledAuthMode === 'none' ? 'bearer' : lastEnabledAuthMode;
    }
    $('httpMethod').value = 'GET';
    $('requestFormat').value = 'none';
    $('transportMode').value = 'auto';
    $('surfaceTag').innerHTML = '<i data-lucide="wand-sparkles" width="14"></i>Auto Detect';
    setStatus('Endpoint Only Mode: paste a base URL or full endpoint. Setup will auto-detect when you test.', 'good');
  } else {
    const previous = state.endpointOnlyPrevious || {};
    state.endpointDetection = null;
    $('usePresets').disabled = false;
    $('sendAuth').disabled = false;
    if (previous.transport) $('transportMode').value = previous.transport;
    if (previous.sendAuth === false) syncAuthControls('none');
    else syncAuthControls(previous.authMode && previous.authMode !== 'none' ? previous.authMode : 'bearer');
    $('usePresets').checked = previous.usePresets !== false;
    setPresetMode($('usePresets').checked);
    setStatus('Endpoint Only Mode off. Provider setup restored.');
  }
  lucide.createIcons();
}

replaceBetween(
  'function syncEndpointOnlyMode(on){',
  'function renderProviderSearch',
  renameFunction(patchedSyncEndpointOnlyMode, 'function patchedSyncEndpointOnlyMode', 'function syncEndpointOnlyMode') + '\nfunction renderProviderSearch',
  'endpoint-only mode synchronization'
);

function patchedRequestMeta(kind = 'test') {
  if ($('endpointOnly').checked) {
    const raw = $('endpointOnlyURL').value.trim();
    if (!raw) throw new Error('Paste an API base URL or full HTTPS endpoint first.');
    const normalized = AutoSetup.normalizeDiscoveryURL(raw);
    const detected = state.endpointDetection;
    if (!detected || detected.input !== normalized) throw new Error('Endpoint setup has not been auto-detected yet. Press Test or Load Models.');
    if (kind === 'models') {
      if (!detected.modelsUrl) throw new Error('No model-list endpoint was detected. Use a Manual model ID if this API does not expose models.');
      return {
        providerId: 'custom', endpointId: 'endpoint-only-models', providerName: 'Auto-detected Endpoint',
        baseUrl: detected.modelsUrl, path: '', method: 'GET', format: 'none',
        auth: { type: detected.modelsAuth || 'none' }, headers: detected.modelsHeaders || {},
        preset: false, endpointOnly: true
      };
    }
    if (!detected.requestUrl) throw new Error('No working request endpoint has been detected yet.');
    return {
      providerId: 'custom', endpointId: 'endpoint-only', providerName: 'Auto-detected Endpoint',
      baseUrl: detected.requestUrl, path: '', method: detected.method, format: detected.format,
      auth: { type: detected.auth || 'none' }, headers: detected.requestHeaders || {},
      preset: false, endpointOnly: true
    };
  }
  if ($('usePresets').checked) {
    const provider = currentProvider();
    if (!provider) throw new Error('Select a provider');
    const endpoint = kind === 'models' ? Presets.getModelsEndpoint(provider.id) : currentEndpoint();
    if (!endpoint) throw new Error('This provider preset has no model-list endpoint. Use a manual model ID or turn presets OFF.');
    const model = getSelectedModel();
    const path = Presets.resolveEndpointPath(endpoint.path, model);
    return {
      providerId: provider.id, endpointId: endpoint.id, providerName: provider.name,
      baseUrl: endpoint.baseUrl || provider.baseUrl, path, method: endpoint.method, format: endpoint.format,
      auth: $('sendAuth').checked ? effectivePresetAuth(provider, endpoint) : { type: 'none' },
      headers: { ...(provider.headers || {}), ...(endpoint.headers || {}) }, preset: true
    };
  }
  return {
    providerId: 'custom', endpointId: 'custom', providerName: 'Custom Provider',
    baseUrl: $('baseURL').value.trim(), path: kind === 'models' ? $('modelsPath').value.trim() : $('endpointPath').value.trim(),
    method: kind === 'models' ? 'GET' : $('httpMethod').value,
    format: kind === 'models' ? 'none' : $('requestFormat').value,
    auth: getCustomAuth(), headers: parseCustomHeaders(), preset: false
  };
}

replaceBetween(
  "function requestMeta(kind='test'){",
  'async function readResponse',
  renameFunction(patchedRequestMeta, 'function patchedRequestMeta', 'function requestMeta') + '\nasync function readResponse',
  'endpoint-only detected request metadata'
);

function endpointAuthConfig(type) {
  return { type: type || 'none', headerName: '', prefix: '', queryParam: 'key' };
}

function endpointProbeHeaders(format) {
  const headers = parseCustomHeaders();
  if (format === 'anthropic_messages' && !Object.keys(headers).some((key) => key.toLowerCase() === 'anthropic-version')) {
    headers['anthropic-version'] = '2023-06-01';
  }
  return headers;
}

function resolveDiscoveryCandidateURL(candidate, model) {
  let url = candidate.url || candidate.pathTemplate || '';
  if (url.includes('{model}')) {
    if (!model) return '';
    url = url.replaceAll('{model}', encodeURIComponent(String(model).replace(/^models\//, '')));
  }
  return url;
}

function buildDiscoveryBody(format, model) {
  const prompt = 'Reply only with OK';
  if (format === 'none') return undefined;
  if (format === 'openai_chat') return { model, messages: [{ role: 'user', content: prompt }], max_tokens: 8, stream: false };
  if (format === 'openai_responses') return { model, input: prompt, max_output_tokens: 8, stream: false };
  if (format === 'anthropic_messages') return { model, max_tokens: 8, messages: [{ role: 'user', content: prompt }] };
  if (format === 'gemini_generate') return { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8 } };
  return undefined;
}

async function probeEndpointDirect(candidate, key, authType, model) {
  const url = resolveDiscoveryCandidateURL(candidate, model);
  if (!url) return { reachedServer: false, ok: false, status: 0, error: 'A model is required for this endpoint.', transport: 'direct', skipped: true };
  const headers = { Accept: 'application/json', ...endpointProbeHeaders(candidate.format) };
  let finalUrl;
  try { finalUrl = applyAuth(url, headers, key, endpointAuthConfig(authType)); }
  catch (error) { return { reachedServer: false, ok: false, status: 0, error: error.message, transport: 'direct', skipped: true }; }
  const body = candidate.method === 'GET' ? undefined : buildDiscoveryBody(candidate.format, model || 'auto-detect-model');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const result = await fetchJson(finalUrl, { method: candidate.method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, 30000);
  return { ...result, transport: 'direct', url: finalUrl };
}

async function probeEndpointProxy(candidate, key, authType, model, fallback = false) {
  const url = resolveDiscoveryCandidateURL(candidate, model);
  if (!url) return { reachedServer: false, ok: false, status: 0, error: 'A model is required for this endpoint.', transport: 'proxy', skipped: true };
  const customHeaders = endpointProbeHeaders(candidate.format);
  const payload = {
    providerId: 'custom', apiKey: key, disableAuth: authType === 'none', customBaseUrl: url, customPath: '',
    customMethod: candidate.method, customFormat: candidate.method === 'GET' ? 'none' : candidate.format,
    authMode: authType, customAuthHeader: '', customAuthPrefix: '', customQueryParam: 'key',
    customHeaders: JSON.stringify(customHeaders), customBody: '', model: model || 'auto-detect-model',
    prompt: 'Reply only with OK', maxTokens: 8
  };
  const raw = await fetchJson('/api/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) }, 35000);
  if (!raw.reachedServer) return { ...raw, transport: 'proxy', autoFallback: fallback };
  const wrap = raw.data || {};
  return {
    reachedServer: Number(wrap.upstreamStatus || 0) > 0,
    ok: typeof wrap.upstreamOk === 'boolean' ? wrap.upstreamOk : raw.ok,
    status: Number(wrap.upstreamStatus ?? raw.status), latency: Number(wrap.latencyMs ?? raw.latency),
    data: wrap.data ?? wrap, error: wrap.error, transport: 'proxy', autoFallback: fallback,
    url: wrap.endpoint || url
  };
}

async function probeEndpointCandidate(candidate, key, authType, model) {
  const mode = $('transportMode').value;
  if (mode === 'proxy') return probeEndpointProxy(candidate, key, authType, model, false);
  const direct = await probeEndpointDirect(candidate, key, authType, model);
  if (mode === 'auto' && Core.shouldProxyFallback(direct)) return probeEndpointProxy(candidate, key, authType, model, true);
  return direct;
}

function applyEndpointDetection(detection) {
  state.endpointDetection = detection;
  $('httpMethod').value = detection.method || 'GET';
  $('requestFormat').value = detection.format || 'none';
  syncAuthControls(detection.auth || 'none');
  if (detection.model) {
    const found = state.models.find((item) => item.id === detection.model) || { id: detection.model, label: detection.model };
    state.selected = found;
    $('selectedModelName').textContent = found.label || found.id;
    $('selectedModelId').textContent = found.id;
    renderModelList(state.models);
  }
  $('surfaceTag').innerHTML = '<i data-lucide="badge-check" width="14"></i>Detected ' + (detection.format || 'endpoint');
  lucide.createIcons();
}

async function detectEndpointOnlySetup({ purpose = 'test', keyOverride } = {}) {
  const input = $('endpointOnlyURL').value.trim();
  if (!input) throw new Error('Paste an API base URL or full HTTPS endpoint first.');
  syncKeys();
  const key = keyOverride !== undefined ? keyOverride : (state.keys[Math.min(state.activeKeyIndex, state.keys.length - 1)] || '');
  const plan = AutoSetup.buildEndpointDiscoveryPlan(input, { keyPresent: $('sendAuth').checked && !!key });
  const authModes = $('sendAuth').checked ? plan.authModes : ['none'];
  const attempts = [];
  let model = $('manualModel').value.trim() || state.selected?.id || '';
  let modelsUrl = '';
  let modelsAuth = 'none';
  let modelsHeaders = {};
  setStatus('Auto-detecting API setup…', 'loading');
  setMetrics([['Base', plan.baseUrl], ['Mode', plan.exact ? 'Full endpoint' : 'Base URL']]);
  setResult('Checking model catalog, authentication style, and supported request endpoints. Only documented/common API patterns are tried; provider client restrictions are never bypassed.');

  for (const candidate of plan.models) {
    for (const authType of authModes) {
      const result = await probeEndpointCandidate(candidate, key, authType, model);
      const classified = AutoSetup.classifyProbeResult(result);
      attempts.push({ stage: 'models', url: candidate.url, auth: authType, status: result.status || 0, result: classified.kind, transport: result.autoFallback ? 'proxy fallback' : result.transport || 'n/a' });
      if (result.ok) {
        modelsUrl = candidate.url;
        modelsAuth = authType;
        modelsHeaders = endpointProbeHeaders(candidate.format);
        const ids = Core.parseModelIds(result.data);
        if (ids.length) {
          state.models = normalizeModels(ids);
          model = $('manualModel').value.trim() || AutoSetup.chooseProbeModel(ids);
          if (model) {
            state.selected = state.models.find((item) => item.id === model) || { id: model, label: model };
            $('selectedModelName').textContent = state.selected.label || model;
            $('selectedModelId').textContent = model;
            renderModelList(state.models);
          }
        }
        break;
      }
    }
    if (modelsUrl) break;
  }

  if (purpose === 'models') {
    if (!modelsUrl) {
      if (attempts.some((attempt) => attempt.result === 'client_blocked')) throw new Error('The API was reached, but the provider blocked this client. The tester will not bypass provider client restrictions.');
      throw new Error(plan.exact ? 'This is a full endpoint and no separate model catalog was detected. Use Test Active Key or a Manual model ID.' : 'No working /models endpoint was detected. You can still use a Manual model ID if the API does not expose a model catalog.');
    }
    const detection = { input: plan.baseUrl, modelsUrl, modelsAuth, modelsHeaders, model, requestUrl: '', method: 'GET', format: 'none', auth: modelsAuth, requestHeaders: {}, attempts };
    state.endpointDetection = detection;
    syncAuthControls(modelsAuth);
    setStatus('Model endpoint auto-detected ✓', 'good');
    setMetrics([['Models URL', modelsUrl], ['Auth', modelsAuth], ['Models', state.models.length]]);
    return detection;
  }

  let reachable = null;
  let clientBlocked = false;
  const requests = plan.requests.map((candidate) => {
    if (plan.exact && candidate.format === 'none') {
      const method = $('httpMethod').value || 'GET';
      return { ...candidate, method, format: method === 'GET' ? 'none' : $('requestFormat').value };
    }
    return candidate;
  });

  for (const candidate of requests) {
    const requestUrl = resolveDiscoveryCandidateURL(candidate, model);
    if (!requestUrl && candidate.pathTemplate?.includes('{model}')) continue;
    const ordered = modelsUrl && authModes.includes(modelsAuth) ? [modelsAuth, ...authModes.filter((mode) => mode !== modelsAuth)] : authModes;
    for (const authType of ordered) {
      const result = await probeEndpointCandidate(candidate, key, authType, model);
      const classified = AutoSetup.classifyProbeResult(result);
      attempts.push({ stage: 'request', url: requestUrl || candidate.pathTemplate, format: candidate.format, auth: authType, status: result.status || 0, result: classified.kind, transport: result.autoFallback ? 'proxy fallback' : result.transport || 'n/a' });
      if (classified.kind === 'client_blocked') clientBlocked = true;
      if (result.ok) {
        const detection = {
          input: plan.baseUrl, modelsUrl, modelsAuth, modelsHeaders, model,
          requestUrl: resolveDiscoveryCandidateURL(candidate, model), method: candidate.method, format: candidate.format,
          auth: authType, requestHeaders: endpointProbeHeaders(candidate.format), attempts
        };
        applyEndpointDetection(detection);
        setStatus('Auto-detected working API setup ✓', 'good');
        setMetrics([['Endpoint', detection.requestUrl], ['Format', detection.format], ['Auth', detection.auth], ['Model', model || 'Not required']]);
        setResult('AUTO-DETECTED SETUP ✓\nBase/input: ' + plan.baseUrl + '\nEndpoint: ' + detection.method + ' ' + detection.requestUrl + '\nFormat: ' + detection.format + '\nAuthentication: ' + detection.auth + (modelsUrl ? '\nModels: ' + modelsUrl : '') + (model ? '\nModel: ' + model : '') + '\n\nThe detected setup is now applied automatically.');
        return detection;
      }
      if (!reachable && AutoSetup.isReachableRouteResult(result)) reachable = { candidate, authType, result };
    }
  }

  if (reachable) {
    const candidate = reachable.candidate;
    const detection = {
      input: plan.baseUrl, modelsUrl, modelsAuth, modelsHeaders, model,
      requestUrl: resolveDiscoveryCandidateURL(candidate, model) || candidate.url || candidate.pathTemplate,
      method: candidate.method, format: candidate.format, auth: reachable.authType,
      requestHeaders: endpointProbeHeaders(candidate.format), attempts
    };
    state.endpointDetection = detection;
    if (!model && requiresModel(candidate.format)) throw new Error('An API route was detected, but no usable model ID was found. Enter a Manual model ID, then test again.');
    throw new Error('The API route was detected, but a working generation request was not confirmed. Check the returned provider error or try a Manual model ID.');
  }
  if (clientBlocked) throw new Error('The provider was reached, but it blocked this client. The tester will not spoof or bypass provider client restrictions.');
  throw new Error('Auto-detect could not confirm a supported API route. If this API uses a custom path or payload, open Advanced / Custom Request.');
}

async function ensureEndpointOnlySetup(purpose = 'test', keyOverride) {
  if (!$('endpointOnly').checked) return null;
  const normalized = AutoSetup.normalizeDiscoveryURL($('endpointOnlyURL').value.trim());
  const cached = state.endpointDetection;
  if (cached && cached.input === normalized && ((purpose === 'models' && cached.modelsUrl) || (purpose !== 'models' && cached.requestUrl))) return cached;
  return detectEndpointOnlySetup({ purpose, keyOverride });
}

const detectionHelpers = [
  endpointAuthConfig,
  endpointProbeHeaders,
  resolveDiscoveryCandidateURL,
  buildDiscoveryBody,
  probeEndpointDirect,
  probeEndpointProxy,
  probeEndpointCandidate,
  applyEndpointDetection,
  detectEndpointOnlySetup,
  ensureEndpointOnlySetup
].map((fn) => fn.toString()).join('\n');

replaceOnce(
  "async function directRequest(key,kind='test'){",
  detectionHelpers + "\nasync function directRequest(key,kind='test'){",
  'endpoint auto-detect helpers'
);

replaceOnce(
  "customHeaders:$('customHeaders').value.trim(),customBody:$('customBody').value,model:getSelectedModel()",
  "customHeaders:meta.endpointOnly?JSON.stringify(meta.headers||{}):$('customHeaders').value.trim(),customBody:$('customBody').value,model:getSelectedModel()",
  'endpoint-only proxy headers'
);

async function patchedLoadModels() {
  if ($('endpointOnly').checked) {
    try { await ensureEndpointOnlySetup('models'); }
    catch (error) { setStatus(error.message, 'bad'); setResult(error.message); return; }
  }
  let meta;
  try { meta = requestMeta('models'); }
  catch (error) { setStatus(error.message, 'bad'); return; }
  const keys = effectiveKeys(meta);
  if (!keys.length) { setStatus('Enter at least one API key, or turn Send Authentication OFF for a public endpoint.', 'bad'); return; }
  const key = keys[Math.min(state.activeKeyIndex, keys.length - 1)] || '';
  $('loadBtn').disabled = true;
  setStatus('Loading models…', 'loading');
  setMetrics([]);
  setResult('Requesting model catalog…');
  try {
    const result = await requestKey(key, 'models');
    const classified = Core.classifyResponse(result);
    if (!result.ok) {
      if (key) state.keyResults.set(key, { state: 'bad', text: classified.title, http: result.status || null, latency: result.latency });
      renderKeyList();
      setStatus(classified.message, 'bad');
      setMetrics([['HTTP', result.status || 'N/A'], ['Latency', String(result.latency) + ' ms'], ['Transport', result.transport], ['Provider', result.meta?.providerName || 'Custom']]);
      setResult(result.data ?? { error: result.error });
      return;
    }
    const ids = Core.parseModelIds(result.data);
    state.models = normalizeModels(ids);
    state.selected = null;
    $('modelSearch').value = '';
    renderModelList(state.models);
    if (state.models.length) selectModel(state.models[0]);
    else { $('selectedModelName').textContent = 'No models returned'; $('selectedModelId').textContent = 'Use manual model ID if needed'; }
    if (key) state.keyResults.set(key, { state: 'ok', text: 'Models OK', http: result.status, latency: result.latency });
    renderKeyList();
    setStatus('Loaded ' + state.models.length + ' model' + (state.models.length === 1 ? '' : 's') + ' — sorted A–Z', 'good');
    setMetrics([['HTTP', result.status], ['Latency', String(result.latency) + ' ms'], ['Models', state.models.length], ['Transport', result.transport]]);
    setResult(state.models.length ? state.models.map((model, index) => String(index + 1).padStart(3, '0') + '. ' + model.label + '\n     ' + model.id).join('\n') : result.data);
  } catch (error) {
    setStatus(error.message, 'bad');
    setResult(error.stack || error.message);
  } finally {
    $('loadBtn').disabled = false;
  }
}

replaceBetween(
  'async function loadModels(){',
  'function requiresModel',
  renameFunction(patchedLoadModels, 'async function patchedLoadModels', 'async function loadModels') + '\nfunction requiresModel',
  'load models endpoint detection'
);

async function patchedRequestWithKey(key, index, { updateMain = true } = {}) {
  if ($('endpointOnly').checked) await ensureEndpointOnlySetup('test', key);
  const meta = requestMeta('test');
  const model = getSelectedModel();
  const prompt = $('prompt').value.trim();
  if (requiresModel(meta.format) && !model) throw new Error('Select a model or enter a manual model ID.');
  if (meta.method !== 'GET' && meta.format !== 'generic_json' && !prompt) throw new Error('Enter a test prompt.');
  if (authNeedsKey(meta.auth.type) && !key) throw new Error('API key is required for the detected authentication method.');
  if (key) { state.keyResults.set(key, { state: 'loading', text: 'Testing…', http: null, latency: null }); renderKeyList(); }
  if (updateMain) {
    setStatus('Testing ' + (key ? 'Key ' + (index + 1) : 'no-auth endpoint') + '…', 'loading');
    setMetrics([]);
    setResult('Waiting for API response…');
  }
  const result = await requestKey(key, 'test');
  const classified = Core.classifyResponse(result);
  if (!result.ok) {
    if (key) { state.keyResults.set(key, { state: 'bad', text: classified.title, http: result.status || null, latency: result.latency, error: result.data ?? result.error }); renderKeyList(); }
    if (updateMain) {
      setStatus(classified.message, 'bad');
      setMetrics([['HTTP', result.status || 'N/A'], ['Latency', String(result.latency) + ' ms'], ['Transport', result.autoFallback ? 'proxy fallback' : result.transport], ['Endpoint', result.url || result.meta?.path || 'custom']]);
      setResult(result.data ?? { error: result.error });
    }
    return { ok: false, http: result.status || null, latency: result.latency, error: result.data ?? result.error, transport: result.transport };
  }
  const content = Core.extractReply(result.data) || '(Request succeeded, but no standard text field was found.)';
  const returnedModel = result.data?.model || model || '';
  const usage = result.data?.usage || {};
  if (key) { state.keyResults.set(key, { state: 'ok', text: 'Working', http: result.status, latency: result.latency, content }); renderKeyList(); }
  if (updateMain) {
    const metrics = [['HTTP', result.status], ['Latency', String(result.latency) + ' ms'], ['Transport', result.autoFallback ? 'proxy fallback' : result.transport], ['Provider', result.meta?.providerName || 'Custom']];
    if (returnedModel) metrics.push(['Model', returnedModel]);
    if (usage.total_tokens != null) metrics.push(['Tokens', usage.total_tokens]);
    setStatus((key ? 'Key ' + (index + 1) : 'Endpoint') + ' is working ✓', 'good');
    setMetrics(metrics);
    setResult('RESPONSE:\n' + content + '\n\nRAW JSON:\n' + JSON.stringify(result.data, null, 2));
  }
  return { ok: true, http: result.status, latency: result.latency, content, model: returnedModel, usage, transport: result.transport };
}

replaceBetween(
  'async function requestWithKey(key,index,{updateMain=true}={}){',
  'async function testKeyAt',
  renameFunction(patchedRequestWithKey, 'async function patchedRequestWithKey', 'async function requestWithKey') + '\nasync function testKeyAt',
  'endpoint-only request testing'
);

async function patchedTestKeyAt(index) {
  if ($('endpointOnly').checked) {
    syncKeys();
    const key = state.keys[index] ?? state.keys[0] ?? '';
    if (!confirm('Auto-detect the API setup and run a real request? A successful generation probe may use a small amount of provider credits.')) return;
    try { await requestWithKey(key, index, { updateMain: true }); }
    catch (error) { setStatus(error.message, 'bad'); setResult(error.message); }
    return;
  }
  let meta;
  try { meta = requestMeta('test'); }
  catch (error) { setStatus(error.message, 'bad'); return; }
  const keys = effectiveKeys(meta);
  if (!keys.length) { setStatus('Enter at least one API key.', 'bad'); return; }
  const key = keys[index] ?? keys[0] ?? '';
  if (!confirm('Run a real API request? This may use provider credits.')) return;
  try { await requestWithKey(key, index, { updateMain: true }); }
  catch (error) { setStatus(error.message, 'bad'); setResult(error.message); }
}

replaceBetween(
  'async function testKeyAt(index){',
  'async function testAllKeys',
  renameFunction(patchedTestKeyAt, 'async function patchedTestKeyAt', 'async function testKeyAt') + '\nasync function testAllKeys',
  'endpoint-only active key test'
);

async function patchedTestAllKeys() {
  if ($('endpointOnly').checked) {
    syncKeys();
    const keys = state.keys.length ? state.keys : [''];
    if (!confirm('Auto-detect once and test ' + keys.length + ' key' + (keys.length === 1 ? '' : 's') + ' sequentially? Successful generation requests may use provider credits.')) return;
    $('testAllBtn').disabled = true;
    $('testActiveBtn').disabled = true;
    setStatus('Auto-detecting before multi-key test…', 'loading');
    const summary = [];
    try {
      for (let i = 0; i < keys.length; i++) {
        setStatus('Testing ' + (i + 1) + ' of ' + keys.length + '…', 'loading');
        try { summary.push({ index: i + 1, ...await requestWithKey(keys[i], i, { updateMain: false }) }); }
        catch (error) { summary.push({ index: i + 1, ok: false, http: null, latency: 0, error: error.message, transport: 'n/a' }); }
      }
      const ok = summary.filter((item) => item.ok).length;
      const fail = summary.length - ok;
      setStatus(ok + ' working, ' + fail + ' failed', fail ? 'bad' : 'good');
      setMetrics([['Working', ok], ['Failed', fail], ['Total', summary.length], ['Endpoint', state.endpointDetection?.requestUrl || 'auto-detect']]);
      setResult(summary.map((item) => 'Key ' + item.index + ': ' + (item.ok ? 'WORKING ✓' : 'FAILED ✕') + '\nHTTP: ' + (item.http ?? 'N/A') + '\nLatency: ' + item.latency + ' ms\nTransport: ' + item.transport + '\n' + (item.ok ? 'Response: ' + String(item.content || '').slice(0, 220) : 'Error: ' + (typeof item.error === 'string' ? item.error.slice(0, 300) : JSON.stringify(item.error)))).join('\n\n────────────\n\n'));
    } finally {
      $('testAllBtn').disabled = false;
      $('testActiveBtn').disabled = false;
    }
    return;
  }
  let meta;
  try { meta = requestMeta('test'); }
  catch (error) { setStatus(error.message, 'bad'); return; }
  const keys = effectiveKeys(meta);
  if (!keys.length) { setStatus('Enter at least one API key.', 'bad'); return; }
  if (!confirm('Test ' + keys.length + ' key' + (keys.length === 1 ? '' : 's') + ' sequentially? Real model requests may use credits.')) return;
  $('testAllBtn').disabled = true;
  $('testActiveBtn').disabled = true;
  setStatus('Testing ' + keys.length + ' key' + (keys.length === 1 ? '' : 's') + ' sequentially…', 'loading');
  const summary = [];
  try {
    for (let i = 0; i < keys.length; i++) {
      setStatus('Testing ' + (i + 1) + ' of ' + keys.length + '…', 'loading');
      summary.push({ index: i + 1, ...await requestWithKey(keys[i], i, { updateMain: false }) });
    }
    const ok = summary.filter((item) => item.ok).length;
    const fail = summary.length - ok;
    setStatus(ok + ' working, ' + fail + ' failed', fail ? 'bad' : 'good');
    setMetrics([['Working', ok], ['Failed', fail], ['Total', summary.length], ['Endpoint', meta.path]]);
    setResult(summary.map((item) => 'Key ' + item.index + ': ' + (item.ok ? 'WORKING ✓' : 'FAILED ✕') + '\nHTTP: ' + (item.http ?? 'N/A') + '\nLatency: ' + item.latency + ' ms\nTransport: ' + item.transport + '\n' + (item.ok ? 'Response: ' + String(item.content || '').slice(0, 220) : 'Error: ' + (typeof item.error === 'string' ? item.error.slice(0, 300) : JSON.stringify(item.error)))).join('\n\n────────────\n\n'));
  } finally {
    $('testAllBtn').disabled = false;
    $('testActiveBtn').disabled = false;
  }
}

replaceBetween(
  'async function testAllKeys(){',
  'function clearAll',
  renameFunction(patchedTestAllKeys, 'async function patchedTestAllKeys', 'async function testAllKeys') + '\nfunction clearAll',
  'endpoint-only all-key test'
);

replaceOnce(
  "function clearAll(){$('apiKeys').value='';$('endpointOnlyURL').value='';$('manualModel').value='';$('modelSearch').value='';state.models=[];",
  "function clearAll(){$('apiKeys').value='';$('endpointOnlyURL').value='';$('manualModel').value='';$('modelSearch').value='';state.endpointDetection=null;state.models=[];",
  'clear endpoint detection'
);

replaceOnce(
  "$('endpointOnly').onchange=e=>syncEndpointOnlyMode(e.target.checked);$('endpointOnlyURL').oninput=e=>{if($('endpointOnly').checked)setStatus(e.target.value.trim()?'Endpoint ready to test.':'Paste a full HTTPS API endpoint.','')};$('apiKeys').addEventListener('input',syncKeys);",
  "$('endpointOnly').onchange=e=>syncEndpointOnlyMode(e.target.checked);$('endpointOnlyURL').oninput=e=>{state.endpointDetection=null;if($('endpointOnly').checked)setStatus(e.target.value.trim()?'Base URL/endpoint ready — setup will auto-detect on Test or Load Models.':'Paste an API base URL or full HTTPS endpoint.','')};$('apiKeys').addEventListener('input',()=>{state.endpointDetection=null;syncKeys()});",
  'endpoint-only input invalidation'
);

replaceOnce(
  "$('sendAuth').onchange=e=>{if(e.target.checked){",
  "$('sendAuth').onchange=e=>{if($('endpointOnly').checked)state.endpointDetection=null;if(e.target.checked){",
  'auth toggle invalidates detection'
);

replaceOnce(
  "$('authMode').onchange=e=>{if(e.target.value==='none')",
  "$('authMode').onchange=e=>{if($('endpointOnly').checked)state.endpointDetection=null;if(e.target.value==='none')",
  'auth mode invalidates detection'
);

fs.writeFileSync(file, html);
