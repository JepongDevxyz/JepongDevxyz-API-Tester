const fs = require('node:fs');
const path = require('node:path');

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Patch target not found: ${label}`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`Patch made no change: ${label}`);
  return next;
}

const indexPath = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = replaceOnce(
  html,
  `<div id="providerNote" class="provider-note"><strong>Verified 2026:</strong> Select a provider to load its documented endpoint settings.</div>\n\n<div class="toggle-line" id="authToggleLine" style="margin-top:14px">`,
  `<div id="providerNote" class="provider-note"><strong>Verified 2026:</strong> Select a provider to load its documented endpoint settings.</div>\n\n<div class="toggle-line" id="endpointOnlyToggleLine" style="margin-top:14px">\n  <div class="toggle-copy"><div class="toggle-title">Endpoint Only Mode</div><div class="toggle-sub">ON = paste one full HTTPS API endpoint only. Defaults to GET, no auth, and no API key. Use Advanced only if the endpoint needs POST or a request body.</div></div>\n  <label class="switch" aria-label="Endpoint Only Mode"><input type="checkbox" id="endpointOnly" /><span></span></label>\n</div>\n<div class="field" id="endpointOnlyField" style="display:none;margin-top:14px">\n  <label for="endpointOnlyURL"><i data-lucide="link" width="14"></i>Full API endpoint URL</label>\n  <div class="control-wrap"><i class="control-icon" data-lucide="globe-2"></i><input class="input" id="endpointOnlyURL" placeholder="https://api.example.com/v1/status" autocomplete="url" /></div>\n  <div class="helper">Only HTTPS endpoints are accepted. Direct Browser is selected by default. If the endpoint blocks browser CORS, Vercel Proxy still requires its host in CUSTOM_PROXY_ALLOWLIST.</div>\n</div>\n\n<div class="toggle-line" id="authToggleLine" style="margin-top:14px">`,
  'endpoint-only UI'
);

html = replaceOnce(
  html,
  `function setAuthUI(type){syncAuthControls(type)}\nfunction authNeedsKey(type){return type!=='none'}\nfunction renderProviderSearch`,
  `function setAuthUI(type){syncAuthControls(type)}\nfunction authNeedsKey(type){return type!=='none'}\nfunction syncEndpointOnlyMode(on){\n  $('endpointOnlyField').style.display=on?'block':'none';\n  for(const id of ['baseURL','endpointPath','modelsPath','apiKeys']){const field=$(id)?.closest('.field');if(field)field.style.display=on?'none':''}\n  $('usePresets').disabled=on;$('sendAuth').disabled=on;\n  if(on){\n    state.endpointOnlyPreviousTransport=$('transportMode').value;\n    $('usePresets').checked=false;setPresetMode(false);syncAuthControls('none');\n    $('httpMethod').value='GET';$('requestFormat').value='none';$('transportMode').value='direct';\n    $('surfaceTag').innerHTML='<i data-lucide="link" width="14"></i>Endpoint Only';\n    setStatus('Endpoint Only Mode: paste one full HTTPS endpoint. No API key is required.','good');\n  }else{\n    $('usePresets').disabled=false;$('sendAuth').disabled=false;\n    if(state.endpointOnlyPreviousTransport)$('transportMode').value=state.endpointOnlyPreviousTransport;\n    $('usePresets').checked=true;setPresetMode(true);\n    setStatus('Endpoint Only Mode off. Provider setup restored.');\n  }\n  lucide.createIcons();\n}\nfunction renderProviderSearch`,
  'endpoint-only synchronization helper'
);

html = replaceOnce(
  html,
  `function requestMeta(kind='test'){\n  if($('usePresets').checked){`,
  `function requestMeta(kind='test'){\n  if($('endpointOnly').checked){const full=$('endpointOnlyURL').value.trim();if(!full)throw new Error('Paste a full HTTPS API endpoint first.');let parsed;try{parsed=new URL(full)}catch{throw new Error('Enter a valid full API endpoint URL.')}if(parsed.protocol!=='https:')throw new Error('Endpoint Only Mode requires HTTPS.');const method=$('httpMethod').value||'GET';const format=method==='GET'?'none':$('requestFormat').value;return{providerId:'custom',endpointId:'endpoint-only',providerName:'Endpoint Only',baseUrl:full,path:'',method,format,auth:{type:'none'},headers:parseCustomHeaders(),preset:false,endpointOnly:true}}\n  if($('usePresets').checked){`,
  'endpoint-only request metadata'
);

html = replaceOnce(
  html,
  `:{providerId:'custom',apiKey:key,disableAuth:!$('sendAuth').checked,customBaseUrl:$('baseURL').value.trim(),customPath:kind==='models'?($('modelsPath').value.trim()||'/'):($('endpointPath').value.trim()||'/'),customMethod:kind==='models'?'GET':$('httpMethod').value,customFormat:kind==='models'?'none':$('requestFormat').value,authMode:getCustomAuth().type,customAuthHeader:`,
  `:{providerId:'custom',apiKey:key,disableAuth:!authNeedsKey(meta.auth.type),customBaseUrl:meta.baseUrl,customPath:meta.endpointOnly?'':meta.path,customMethod:meta.method,customFormat:meta.format,authMode:meta.auth.type,customAuthHeader:`,
  'endpoint-only proxy payload'
);

html = replaceOnce(
  html,
  `function clearAll(){$('apiKeys').value='';$('manualModel').value='';`,
  `function clearAll(){$('apiKeys').value='';$('endpointOnlyURL').value='';$('manualModel').value='';`,
  'clear endpoint-only URL'
);

html = replaceOnce(
  html,
  `$('apiKeys').addEventListener('input',syncKeys);$('sendAuth').onchange=`,
  `$('endpointOnly').onchange=e=>syncEndpointOnlyMode(e.target.checked);$('endpointOnlyURL').oninput=e=>{if($('endpointOnly').checked)setStatus(e.target.value.trim()?'Endpoint ready to test.':'Paste a full HTTPS API endpoint.','')};$('apiKeys').addEventListener('input',syncKeys);$('sendAuth').onchange=`,
  'endpoint-only events'
);

fs.writeFileSync(indexPath, html);
