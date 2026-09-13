(() => {
  const C = window.AgentRouterCore;
  const BASE = 'https://agentrouter.org';
  const PROXY = '/api/agentrouter';

  const $ = (id) => document.getElementById(id);
  const keysEl=$('keys'), surfaceEl=$('surface'), authModeEl=$('authMode'), modelEl=$('model'), maxTokensEl=$('maxTokens'), promptEl=$('prompt');
  const modelsBtn=$('modelsBtn'), testBtn=$('testBtn'), copyBtn=$('copyBtn'), clearBtn=$('clearBtn'), resultsCard=$('resultsCard'), resultsEl=$('results'), summaryEl=$('summary'), confirmPaid=$('confirmPaid');
  let lastResults=[];

  lucide.createIcons();

  function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function mode(){return document.querySelector('input[name="mode"]:checked')?.value || 'auto'}
  function endpointFor(operation){return operation==='models'?'/v1/models':operation==='messages'?'/v1/messages':'/v1/chat/completions'}
  function maxTokens(){const n=parseInt(maxTokensEl.value,10);return Number.isFinite(n)?Math.max(1,Math.min(n,2048)):32}

  function authHeaders(key, operation){
    const headers={Accept:'application/json'};
    if(authModeEl.value==='x-api-key') headers['x-api-key']=key; else headers.Authorization=`Bearer ${key}`;
    if(operation!=='models') headers['Content-Type']='application/json';
    if(operation==='messages') headers['anthropic-version']='2023-06-01';
    return headers;
  }

  function bodyFor(operation){
    if(operation==='models') return undefined;
    const base={model:modelEl.value.trim(),messages:[{role:'user',content:promptEl.value}],max_tokens:maxTokens(),temperature:0};
    return JSON.stringify(base);
  }

  async function fetchJson(url, options={}, timeout=45000){
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout); const started=performance.now();
    try{
      const response=await fetch(url,{...options,signal:controller.signal});
      const text=await response.text(); let data;
      try{data=text?JSON.parse(text):null}catch{data={raw:text}}
      return{reachedServer:true,ok:response.ok,status:response.status,latency:Math.round(performance.now()-started),data};
    }catch(error){
      return{reachedServer:false,ok:false,status:0,latency:Math.round(performance.now()-started),error:error.name==='AbortError'?'Request timeout':error.message};
    }finally{clearTimeout(timer)}
  }

  async function requestDirect(key, operation){
    const endpoint=endpointFor(operation);
    const response=await fetchJson(BASE+endpoint,{method:operation==='models'?'GET':'POST',headers:authHeaders(key,operation),body:bodyFor(operation)});
    return{...response,transport:'direct',endpoint,autoFallback:false};
  }

  async function requestProxy(key, operation, autoFallback=false){
    const started=performance.now();
    const raw=await fetchJson(PROXY,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({operation,apiKey:key,model:modelEl.value.trim(),prompt:promptEl.value,maxTokens:maxTokens(),authMode:authModeEl.value})},50000);
    if(!raw.reachedServer) return{...raw,transport:'proxy',endpoint:endpointFor(operation),autoFallback};
    const wrapper=raw.data||{};
    return{
      reachedServer:Number(wrapper.upstreamStatus||0)>0,
      ok:typeof wrapper.upstreamOk==='boolean'?wrapper.upstreamOk:raw.ok,
      status:Number(wrapper.upstreamStatus??raw.status),
      latency:Number(wrapper.latencyMs??raw.latency??Math.round(performance.now()-started)),
      data:wrapper.data??wrapper,
      error:wrapper.error,
      transport:'proxy',endpoint:wrapper.endpoint||endpointFor(operation),autoFallback
    };
  }

  async function requestKey(key, operation){
    const selected=mode();
    if(selected==='direct') return requestDirect(key,operation);
    if(selected==='proxy') return requestProxy(key,operation,false);
    const direct=await requestDirect(key,operation);
    if(C.shouldProxyFallback(direct)) return requestProxy(key,operation,true);
    return direct;
  }

  function renderResult(item){
    const state=C.classifyResponse(item.response), cls=C.statusClass(state.state), reply=C.extractReply(item.response.data), models=item.models||[];
    const transportLabel=item.response.transport==='proxy'?(item.response.autoFallback?'PROXY FALLBACK':'PROXY'):'DIRECT';
    return `<div class="result">
      <div class="resultHead"><div class="key">${escapeHtml(item.masked)}</div><div class="badges"><span class="badge info">${transportLabel}</span><span class="badge ${cls}">${escapeHtml(state.title)}</span></div></div>
      <div class="resultBody">
        <div class="stats">
          <div class="stat"><div class="statTitle">HTTP</div><div class="statValue">${item.response.status||'—'}</div></div>
          <div class="stat"><div class="statTitle">Latency</div><div class="statValue">${item.response.latency} ms</div></div>
          <div class="stat"><div class="statTitle">Endpoint</div><div class="statValue">${escapeHtml(item.response.endpoint)}</div></div>
          <div class="stat"><div class="statTitle">Models</div><div class="statValue">${models.length}</div></div>
        </div>
        <div class="help" style="margin-top:11px">${escapeHtml(state.message)}</div>
        ${reply?`<div class="reply"><strong>Model Response</strong><br><br>${escapeHtml(reply)}</div>`:''}
        ${models.length?`<div class="models">${models.slice(0,100).map(m=>`<span class="model">${escapeHtml(m)}</span>`).join('')}</div>`:''}
        <pre>${escapeHtml(JSON.stringify(item.response.data??{error:item.response.error},null,2))}</pre>
      </div></div>`;
  }

  function updateResults(items, action){
    lastResults=items.map(x=>({key:x.masked,action,transport:x.response.transport,status:x.response.status,latencyMs:x.response.latency,endpoint:x.response.endpoint,state:C.classifyResponse(x.response),models:x.models||[],data:x.response.data??{error:x.response.error}}));
    resultsCard.classList.remove('hidden');
    resultsEl.innerHTML=items.map(renderResult).join('');
    const ok=items.filter(x=>C.classifyResponse(x.response).state==='working').length;
    summaryEl.textContent=`${action} • ${ok}/${items.length} successful`;
    lucide.createIcons();
  }

  function setBusy(busy,label){
    [modelsBtn,testBtn,clearBtn,copyBtn].forEach(b=>b.disabled=busy);
    if(busy) resultsCard.classList.remove('hidden');
    if(busy) resultsEl.innerHTML=`<div class="loader"><div class="spinner"></div>${escapeHtml(label)}</div>`;
  }

  function getKeys(){const keys=C.parseKeys(keysEl.value);if(!keys.length)alert('Maglagay muna ng AgentRouter API key.');if(keys.length>20){alert('Maximum 20 keys bawat run.');return[]}return keys}

  modelsBtn.addEventListener('click',async()=>{
    const keys=getKeys();if(!keys.length)return;setBusy(true,'Checking AgentRouter models...');const items=[];const discovered=new Set();
    try{for(const key of keys){const response=await requestKey(key,'models');const models=C.parseModelIds(response.data);models.forEach(m=>discovered.add(m));items.push({masked:C.maskKey(key),response,models});resultsEl.innerHTML=items.map(renderResult).join('')}}
    finally{setBusy(false,'');updateResults(items,'Models check');if(discovered.size){$('modelSuggestions').innerHTML=[...discovered].sort().map(m=>`<option value="${escapeHtml(m)}"></option>`).join('')}}
  });

  testBtn.addEventListener('click',async()=>{
    const keys=getKeys();if(!keys.length)return;if(!modelEl.value.trim()){alert('Maglagay ng model.');return}if(!promptEl.value.trim()){alert('Maglagay ng test prompt.');return}if(!confirmPaid.checked){alert('I-check muna ang credit confirmation bago mag-run ng paid model test.');return}
    const operation=surfaceEl.value==='messages'?'messages':'chat';if(!confirm(`Run a real ${operation==='messages'?'Anthropic Messages':'OpenAI Chat'} request for ${keys.length} key(s)? This may use credits.`))return;
    setBusy(true,'Running model smoke test...');const items=[];
    try{for(const key of keys){const response=await requestKey(key,operation);items.push({masked:C.maskKey(key),response,models:[]});resultsEl.innerHTML=items.map(renderResult).join('')}}
    finally{setBusy(false,'');updateResults(items,operation==='messages'?'Anthropic messages test':'OpenAI chat test')}
  });

  copyBtn.addEventListener('click',async()=>{if(!lastResults.length){alert('Wala pang result na kokopyahin.');return}try{await navigator.clipboard.writeText(JSON.stringify(lastResults,null,2));const old=copyBtn.innerHTML;copyBtn.innerHTML='<i data-lucide="check" size="17"></i>Copied';lucide.createIcons();setTimeout(()=>{copyBtn.innerHTML=old;lucide.createIcons()},1200)}catch{alert('Hindi ma-access ang clipboard. Copy manually from Raw JSON.')}});
  clearBtn.addEventListener('click',()=>{keysEl.value='';resultsEl.innerHTML='';resultsCard.classList.add('hidden');lastResults=[];confirmPaid.checked=false});
  $('scrollTopBtn').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  surfaceEl.addEventListener('change',()=>{if(surfaceEl.value==='messages'&&authModeEl.value!=='bearer')return;});
})();
