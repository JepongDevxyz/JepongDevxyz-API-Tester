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
  `<div id="providerNote" class="provider-note"><strong>Verified 2026:</strong> Select a provider to load its documented endpoint settings.</div>\n\n<div class="form-grid equal" style="margin-top:14px">`,
  `<div id="providerNote" class="provider-note"><strong>Verified 2026:</strong> Select a provider to load its documented endpoint settings.</div>\n\n<div class="toggle-line" id="authToggleLine" style="margin-top:14px">\n  <div class="toggle-copy"><div class="toggle-title">Send Authentication</div><div class="toggle-sub">ON sends the selected API authentication. OFF sends no Authorization, x-api-key, x-goog-api-key, custom auth header, or API-key query parameter.</div></div>\n  <label class="switch" aria-label="Send Authentication"><input type="checkbox" id="sendAuth" checked /><span></span></label>\n</div>\n\n<div class="form-grid equal" style="margin-top:14px">`,
  'authentication toggle markup'
);

html = replaceOnce(
  html,
  `function effectivePresetAuth(provider,endpoint){return endpoint?.auth||provider?.auth||{type:'bearer'}}\nfunction setAuthUI(type){$('authMode').value=type||'bearer'}\nfunction authNeedsKey(type){return type!=='none'}`,
  `function effectivePresetAuth(provider,endpoint){return endpoint?.auth||provider?.auth||{type:'bearer'}}\nlet lastEnabledAuthMode='bearer';\nfunction syncAuthControls(type){const normalized=type||'bearer',enabled=normalized!=='none';if(enabled)lastEnabledAuthMode=normalized;$('sendAuth').checked=enabled;$('authMode').value=enabled?normalized:'none';$('authMode').disabled=!enabled;const line=$('authToggleLine');if(line)line.classList.toggle('auth-off',!enabled)}\nfunction setAuthUI(type){syncAuthControls(type)}\nfunction authNeedsKey(type){return type!=='none'}`,
  'auth synchronization helpers'
);

html = replaceOnce(
  html,
  `function getCustomAuth(){return{type:$('authMode').value,headerName:$('customAuthHeader').value.trim(),prefix:$('customAuthPrefix').value.trim(),queryParam:$('customQueryParam').value.trim()||'key'}}`,
  `function getCustomAuth(){if(!$('sendAuth').checked)return{type:'none',headerName:'',prefix:'',queryParam:'key'};return{type:$('authMode').value,headerName:$('customAuthHeader').value.trim(),prefix:$('customAuthPrefix').value.trim(),queryParam:$('customQueryParam').value.trim()||'key'}}`,
  'custom auth toggle behavior'
);

html = replaceOnce(
  html,
  `auth:effectivePresetAuth(provider,endpoint),headers:`,
  `auth:$('sendAuth').checked?effectivePresetAuth(provider,endpoint):{type:'none'},headers:`,
  'preset direct-request auth override'
);

html = replaceOnce(
  html,
  `const payload=meta.preset?{providerId:meta.providerId,endpointId:meta.endpointId,apiKey:key,model:getSelectedModel(),prompt:$('prompt').value,maxTokens:maxTokens()}:{providerId:'custom',apiKey:key,customBaseUrl:`,
  `const payload=meta.preset?{providerId:meta.providerId,endpointId:meta.endpointId,apiKey:key,disableAuth:!$('sendAuth').checked,model:getSelectedModel(),prompt:$('prompt').value,maxTokens:maxTokens()}:{providerId:'custom',apiKey:key,disableAuth:!$('sendAuth').checked,customBaseUrl:`,
  'proxy disableAuth payload'
);

html = replaceOnce(
  html,
  `authMode:$('authMode').value,customAuthHeader:`,
  `authMode:getCustomAuth().type,customAuthHeader:`,
  'custom proxy auth mode synchronization'
);

html = replaceOnce(
  html,
  `$('apiKeys').addEventListener('input',syncKeys);`,
  `$('apiKeys').addEventListener('input',syncKeys);$('sendAuth').onchange=e=>{if(e.target.checked){const provider=$('usePresets').checked?currentProvider():null,endpoint=$('usePresets').checked?currentEndpoint():null;const presetType=provider?effectivePresetAuth(provider,endpoint).type:null;const next=presetType&&presetType!=='none'?presetType:(lastEnabledAuthMode==='none'?'bearer':lastEnabledAuthMode);syncAuthControls(next)}else{const current=$('authMode').value;if(current!=='none')lastEnabledAuthMode=current;syncAuthControls('none')}setStatus(e.target.checked?'Authentication enabled.':'Authentication disabled — no API auth will be sent.','good')};$('authMode').onchange=e=>{if(e.target.value==='none')syncAuthControls('none');else{lastEnabledAuthMode=e.target.value;$('sendAuth').checked=true;$('authMode').disabled=false}};`,
  'authentication toggle events'
);

fs.writeFileSync(indexPath, html);

const proxyPath = path.join(process.cwd(), 'lib', 'proxy-core.js');
let proxy = fs.readFileSync(proxyPath, 'utf8');
proxy = replaceOnce(
  proxy,
  `function effectiveAuth(provider, endpoint, input) {\n  if (provider) return endpoint.auth || provider.auth || { type: 'bearer' };`,
  `function effectiveAuth(provider, endpoint, input) {\n  if (input.disableAuth === true) return { type: 'none' };\n  if (provider) return endpoint.auth || provider.auth || { type: 'bearer' };`,
  'proxy explicit auth disable'
);
fs.writeFileSync(proxyPath, proxy);
