const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');

function mustReplace(search, replacement, label) {
  if (!html.includes(search)) throw new Error(`Patch marker not found: ${label}`);
  html = html.replace(search, replacement);
}

if (!html.includes('id="providerSearch"')) {
  const css = `\n.provider-search-wrap{margin-bottom:14px}.provider-search-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;flex-wrap:wrap}.provider-search-results{display:grid;gap:7px;margin-top:9px;max-height:260px;overflow:auto}.provider-search-item{width:100%;border:1px solid var(--line);background:#0d1016;color:#eef1f7;border-radius:12px;padding:10px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;cursor:pointer}.provider-search-item:hover{border-color:var(--line-strong);background:#171c24}.provider-search-copy{min-width:0}.provider-search-name{display:block;font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.provider-search-host{display:block;margin-top:3px;color:#768093;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.trust-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:9.5px;font-weight:850;white-space:nowrap;border:1px solid rgba(57,217,138,.32);color:#77e8b1;background:rgba(57,217,138,.08)}.trust-pill.community,.tag.community{border-color:rgba(248,195,92,.38);color:#f9d786;background:rgba(248,195,92,.08)}\n`;
  mustReplace('</style>', `${css}</style>`, 'style close');

  const marker = `<div id="presetFields" class="form-grid equal">`;
  const block = `<div id="providerSearchWrap" class="provider-search-wrap">\n  <div class="field">\n    <label for="providerSearch"><i data-lucide="search" width="14"></i>Search API providers</label>\n    <div class="control-wrap"><i class="control-icon" data-lucide="search"></i><input class="input" id="providerSearch" type="search" placeholder="Search OpenRouter, TabiToken, Chutes, Z.AI…" autocomplete="off" /></div>\n    <div class="provider-search-toolbar"><div class="helper">Searches Verified + Community presets. Verified = official docs; Community = community-sourced and may change.</div><div style="display:flex;gap:7px;align-items:center"><span id="providerTrustBadge" class="tag ok">Verified</span><button class="mini-btn" id="autoSetupBtn" type="button"><i data-lucide="wand-sparkles" width="14"></i>Auto setup</button></div></div>\n    <div class="provider-search-results" id="providerSearchResults" aria-live="polite"></div>\n  </div>\n</div>\n\n${marker}`;
  mustReplace(marker, block, 'preset fields');
}

html = html.replace(
  'Paste one API key or multiple keys, choose a verified 2026 endpoint or your own provider, then test models and requests.',
  'Paste one API key or multiple keys, search Verified + Community providers, or use your own API endpoint.'
);

html = html.replace(
  'ON = pick a verified provider/endpoint. OFF = fully manual custom API.',
  'ON = searchable provider presets with Auto setup. OFF = fully manual custom API.'
);

const oldProviderFns = /function updateProviderOptions\(\)\{[^\n]*\}\nfunction updateEndpointOptions\(\)\{[^\n]*\}\nfunction applyPreset\(\)\{[^\n]*\}\nfunction setPresetMode\(on\)\{[^\n]*\}/;
const newProviderFns = `function renderProviderSearch(query=''){const box=$('providerSearchResults');if(!box)return;const providers=Presets.searchProviders(query,{includeCommunity:true}).slice(0,12);box.innerHTML='';if(!providers.length){box.innerHTML='<div class="empty-state">No matching provider. Turn presets OFF to use a custom API endpoint.</div>';return}const f=document.createDocumentFragment();for(const provider of providers){const b=document.createElement('button');b.type='button';b.className='provider-search-item';const copy=document.createElement('span');copy.className='provider-search-copy';const name=document.createElement('span');name.className='provider-search-name';name.textContent=provider.name;const host=document.createElement('span');host.className='provider-search-host';try{host.textContent=new URL(provider.baseUrl).hostname}catch{host.textContent=provider.baseUrl}copy.append(name,host);const trust=document.createElement('span');trust.className='trust-pill'+(provider.trust==='community'?' community':'');trust.textContent=provider.trust==='community'?'Community':'Verified';b.append(copy,trust);b.onclick=()=>selectProviderFromSearch(provider.id);f.appendChild(b)}box.appendChild(f)}
function selectProviderFromSearch(providerId){const provider=Presets.getProvider(providerId);if(!provider)return;$('usePresets').checked=true;$('providerSelect').value=provider.id;$('providerSearch').value=provider.name;updateEndpointOptions();renderProviderSearch(provider.name)}
function updateProviderOptions(){const s=$('providerSelect');s.innerHTML='';for(const p of Presets.searchProviders('',{includeCommunity:true})){const o=document.createElement('option');o.value=p.id;o.textContent=(p.trust==='community'?'◇ ':'✓ ')+p.name;s.appendChild(o)}const custom=document.createElement('option');custom.value='custom';custom.textContent='Custom / Own API Provider';s.appendChild(custom);s.value='openrouter';$('providerSearch').value='OpenRouter';renderProviderSearch('');updateEndpointOptions()}
function updateEndpointOptions(){const provider=currentProvider();const s=$('endpointSelect');if(!provider){s.innerHTML='<option value="custom">Manual endpoint</option>';s.disabled=true;return}s.disabled=false;s.innerHTML='';for(const endpoint of provider.endpoints){const o=document.createElement('option');o.value=endpoint.id;o.textContent=\`${'${endpoint.label}'} — ${'${endpoint.method}'} ${'${endpoint.path}'}\`;s.appendChild(o)}const setup=Presets.getAutoSetup(provider.id);if(setup)s.value=setup.endpointId;applyPreset()}
function applyPreset(){if(!$('usePresets').checked)return;const provider=currentProvider(),endpoint=currentEndpoint();if(!provider||!endpoint)return;const setup=Presets.getAutoSetup(provider.id,endpoint.id);if(!setup)return;$('baseURL').value=setup.baseUrl;$('endpointPath').value=setup.path;$('httpMethod').value=setup.method;$('requestFormat').value=setup.format;setAuthUI(setup.auth.type);$('modelsPath').value=setup.modelsPath||'';const badge=$('providerTrustBadge');if(badge){badge.textContent=setup.trust==='community'?'Community':'Verified';badge.className='tag '+(setup.trust==='community'?'community':'ok')}const stamp=setup.trust==='community'?\`community preset • observed ${'${setup.observedAt||Presets.VERIFIED_AT}'}\`:\`verified ${'${setup.verifiedAt||Presets.VERIFIED_AT}'}\`;const warning=setup.trust==='community'?' • Community setup: verify billing/model access before spending credits.':'';$('providerNote').innerHTML=\`<strong>${'${setup.providerName}'}</strong> • ${'${stamp}'} • Auto setup: ${'${setup.method}'} ${'${setup.path}'}${'${setup.modelsPath?\' • models: \'+setup.modelsPath:\' • no model-list endpoint in this preset\'}'}${'${warning}'}\`;$('surfaceTag').innerHTML=\`<i data-lucide="message-square-text" width="14"></i>${'${setup.endpointLabel}'}\`;$('providerSearch').value=provider.name;lucide.createIcons()}
function setPresetMode(on){$('presetFields').style.display=on?'grid':'none';$('providerNote').style.display=on?'block':'none';$('providerSearchWrap').style.display=on?'block':'none';if(on){if($('providerSelect').value==='custom')$('providerSelect').value='openrouter';updateEndpointOptions();renderProviderSearch($('providerSearch').value)}else{$('surfaceTag').innerHTML='<i data-lucide="wrench" width="14"></i>Custom Request';lucide.createIcons()}}`;
if (!oldProviderFns.test(html)) throw new Error('Provider function block not found');
html = html.replace(oldProviderFns, newProviderFns);

html = html.replace(
  'This provider preset has no verified model-list endpoint. Use a manual model ID or turn presets OFF.',
  'This provider preset has no model-list endpoint. Use a manual model ID or turn presets OFF.'
);

const oldEvents = `$('usePresets').onchange=e=>setPresetMode(e.target.checked);$('providerSelect').onchange=()=>{if($('providerSelect').value==='custom'){$('usePresets').checked=false;setPresetMode(false);return}updateEndpointOptions()};$('endpointSelect').onchange=applyPreset;`;
const newEvents = `$('usePresets').onchange=e=>setPresetMode(e.target.checked);$('providerSearch').oninput=e=>renderProviderSearch(e.target.value);$('providerSearch').onfocus=e=>renderProviderSearch(e.target.value);$('autoSetupBtn').onclick=applyPreset;$('providerSelect').onchange=()=>{if($('providerSelect').value==='custom'){$('usePresets').checked=false;setPresetMode(false);return}const p=currentProvider();if(p)$('providerSearch').value=p.name;updateEndpointOptions()};$('endpointSelect').onchange=applyPreset;`;
mustReplace(oldEvents, newEvents, 'provider events');

fs.writeFileSync(file, html);
console.log('Provider search + auto setup patch applied.');
