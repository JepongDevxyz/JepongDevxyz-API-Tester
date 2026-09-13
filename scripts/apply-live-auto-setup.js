const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');

function mustReplace(search, replacement, label) {
  if (!html.includes(search)) throw new Error(`Patch marker not found: ${label}`);
  html = html.replace(search, replacement);
}

mustReplace(
  '<script src="/lib/provider-presets.js"></script>\n<script src="/lib/agentrouter-core.js"></script>',
  '<script src="/lib/provider-presets.js"></script>\n<script src="/lib/auto-setup-core.js"></script>\n<script src="/lib/agentrouter-core.js"></script>',
  'auto setup script include'
);

mustReplace(
  'const Presets=window.ProviderPresets;const Core=window.ApiTesterCore||window.AgentRouterCore;const $=id=>document.getElementById(id);',
  'const Presets=window.ProviderPresets;const AutoSetup=window.AutoSetupCore;const Core=window.ApiTesterCore||window.AgentRouterCore;const $=id=>document.getElementById(id);',
  'browser globals'
);

html = html.replace(
  'Searches Verified + Community presets. Verified = official docs; Community = community-sourced and may change.',
  'Searches Verified + Community presets. Auto setup runs a small real API test to find a working documented endpoint and may use a few provider credits.'
);

const requestKeyLine = "async function requestKey(key,kind='test'){const mode=$('transportMode').value;if(mode==='direct')return directRequest(key,kind);if(mode==='proxy')return proxyRequest(key,kind,false);const direct=await directRequest(key,kind);if(Core.shouldProxyFallback(direct))return proxyRequest(key,kind,true);return direct}";
const probeFunction = `async function probeProviderSetup(){
  if(!$('usePresets').checked){setStatus('Turn on the provider library before using Auto setup.','bad');return}
  const provider=currentProvider();
  if(!provider){setStatus('Select a provider first.','bad');return}
  syncKeys();
  const key=state.keys[Math.min(state.activeKeyIndex,state.keys.length-1)]||'';
  const candidates=AutoSetup.probeCandidates(provider,$('endpointSelect').value);
  if(!candidates.length){setStatus('This provider has no request endpoint to probe.','bad');return}
  const needsAnyKey=candidates.some(endpoint=>authNeedsKey(effectivePresetAuth(provider,endpoint).type));
  if(needsAnyKey&&!key){setStatus('Enter an API key before Auto setup can live-test this provider.','bad');return}
  if(!confirm('Auto setup will run a small real API test using your active key. It may use a few provider credits. Continue?'))return;

  const button=$('autoSetupBtn');
  const original={endpoint:$('endpointSelect').value,manual:$('manualModel').value,prompt:$('prompt').value,maxTokens:$('maxTokens').value,models:state.models,selected:state.selected};
  const attempts=[];
  let working=false;
  button.disabled=true;
  $('loadBtn').disabled=true;
  $('testActiveBtn').disabled=true;
  $('testAllBtn').disabled=true;
  $('prompt').value='Reply only with OK';
  $('maxTokens').value='8';
  try{
    let probeModel=$('manualModel').value.trim();
    const modelsEndpoint=Presets.getModelsEndpoint(provider.id);
    if(!probeModel&&modelsEndpoint){
      setStatus('Auto setup: checking the provider model catalog…','loading');
      setResult('Step 1: finding a usable text-generation model…');
      let modelResult;
      try{modelResult=await requestKey(key,'models')}catch(error){modelResult={reachedServer:false,ok:false,status:0,error:error.message,data:{error:error.message}}}
      const modelClass=AutoSetup.classifyProbeResult(modelResult);
      attempts.push({stage:'models',endpoint:modelsEndpoint.path,status:modelResult.status||0,transport:modelResult.transport||'n/a',result:modelClass.kind,message:modelClass.message});
      if(modelResult.ok){
        const ids=Core.parseModelIds(modelResult.data);
        probeModel=AutoSetup.chooseProbeModel(ids);
        if(probeModel){
          state.models=normalizeModels(ids);
          state.selected=state.models.find(model=>model.id===probeModel)||{id:probeModel,label:probeModel};
          $('selectedModelName').textContent=state.selected.label||probeModel;
          $('selectedModelId').textContent=probeModel;
          renderModelList(state.models);
        }
      }
    }
    if(!probeModel)probeModel=state.selected?.id||'';
    if(!probeModel){
      setStatus('Auto setup could not discover a usable model. Enter a Manual model ID, then press Auto setup again.','bad');
      setResult(JSON.stringify({provider:provider.name,workingSetup:null,attempts},null,2));
      return;
    }

    for(let i=0;i<candidates.length;i++){
      const endpoint=candidates[i];
      $('endpointSelect').value=endpoint.id;
      applyPreset();
      if(!$('manualModel').value.trim()&&!state.selected?.id){$('manualModel').value=probeModel}
      setStatus(`Auto setup: testing ${i+1}/${candidates.length} — ${endpoint.label}…`,'loading');
      setMetrics([['Provider',provider.name],['Endpoint',endpoint.path],['Model',probeModel],['Probe',`${i+1}/${candidates.length}`]]);
      setResult(`Testing documented endpoint:\n${endpoint.method} ${endpoint.baseUrl||provider.baseUrl}${endpoint.path}\n\nA tiny real request is being sent. Client restrictions are never bypassed.`);
      let result;
      try{result=await requestKey(key,'test')}catch(error){result={reachedServer:false,ok:false,status:0,error:error.message,data:{error:error.message},transport:'n/a'}}
      const classified=AutoSetup.classifyProbeResult(result);
      attempts.push({stage:'request',endpointId:endpoint.id,label:endpoint.label,path:endpoint.path,status:result.status||0,transport:result.autoFallback?'proxy fallback':result.transport||'n/a',result:classified.kind,message:classified.message});
      if(classified.kind==='success'){
        working=true;
        const reply=Core.extractReply(result.data)||'(Successful response received.)';
        setStatus(`Working setup found ✓ — ${endpoint.label}`,'good');
        setMetrics([['HTTP',result.status||200],['Latency',`${result.latency||0} ms`],['Transport',result.autoFallback?'proxy fallback':result.transport||'n/a'],['Model',probeModel]]);
        setResult(`WORKING SETUP ✓\nProvider: ${provider.name}\nEndpoint: ${endpoint.method} ${endpoint.baseUrl||provider.baseUrl}${endpoint.path}\nFormat: ${endpoint.format}\nAuth: ${effectivePresetAuth(provider,endpoint).type}\nModel: ${probeModel}\n\nProbe response:\n${reply}\n\nThe selected endpoint has been left applied in the form.`);
        $('providerNote').innerHTML+=` • <strong>Live tested working</strong>: ${endpoint.label}`;
        return;
      }
    }

    const kinds=attempts.map(item=>item.result);
    if(kinds.includes('client_blocked'))setStatus('Provider reached, but every tested documented route was blocked for this client. Auto setup will not bypass provider client restrictions.','bad');
    else if(kinds.includes('auth_failed'))setStatus('No working setup found: the provider rejected the API key/authentication on the tested routes.','bad');
    else if(kinds.includes('rate_limited'))setStatus('No working setup confirmed because the provider rate-limited the probe. Try again later.','bad');
    else setStatus('No working setup was confirmed from the documented presets.','bad');
    setResult(JSON.stringify({provider:provider.name,workingSetup:null,model:probeModel,attempts},null,2));
  }finally{
    $('prompt').value=original.prompt;
    $('maxTokens').value=original.maxTokens;
    button.disabled=false;
    $('loadBtn').disabled=false;
    $('testActiveBtn').disabled=false;
    $('testAllBtn').disabled=false;
    if(!working){
      $('endpointSelect').value=original.endpoint;
      applyPreset();
      $('manualModel').value=original.manual;
      state.models=original.models;
      state.selected=original.selected;
      $('selectedModelName').textContent=original.selected?.label||'Load models first';
      $('selectedModelId').textContent=original.selected?.id||'No model selected';
      renderModelList(state.models);
    }
  }
}`;
mustReplace(requestKeyLine, `${requestKeyLine}\n${probeFunction}`, 'requestKey insertion');

mustReplace("$('autoSetupBtn').onclick=applyPreset;", "$('autoSetupBtn').onclick=probeProviderSetup;", 'auto setup button handler');

fs.writeFileSync(file, html);
console.log('Live auto-setup probe UI patch applied.');
