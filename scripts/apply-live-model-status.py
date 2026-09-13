from pathlib import Path

path = Path('index.html')
html = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global html
    if old not in html:
        raise RuntimeError(f'Patch target not found: {label}')
    html = html.replace(old, new, 1)


def replace_between(start, end, replacement, label):
    global html
    a = html.find(start)
    if a < 0:
        raise RuntimeError(f'Start marker not found: {label}')
    b = html.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f'End marker not found: {label}')
    html = html[:a] + replacement + html[b:]


replace_once(
    "const state={models:[],selected:null,keys:[],activeKeyIndex:0,keyResults:new Map(),keysVisible:false,lastResultText:'',endpointDetection:null,endpointOnlyPrevious:null};",
    "const state={models:[],selected:null,keys:[],activeKeyIndex:0,keyResults:new Map(),keysVisible:false,lastResultText:'',endpointDetection:null,endpointOnlyPrevious:null,modelStatuses:new Map(),modelCheckRunning:false};",
    'state model status storage'
)

replace_once(
    '.model-option.active .checkmark{opacity:1}.empty-state',
    '.model-option.active .checkmark{opacity:1}.model-option-side{display:flex;align-items:center;gap:8px;flex:0 0 auto}.model-status{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:0 7px;border:1px solid var(--line);border-radius:999px;font-size:9px;font-weight:850;letter-spacing:.035em;white-space:nowrap;background:#151a22;color:#9aa4b4}.model-status.live{border-color:rgba(57,217,138,.38);background:rgba(57,217,138,.09);color:#7ce6b4}.model-status.down{border-color:rgba(255,107,122,.38);background:rgba(255,107,122,.09);color:#ff9aa5}.model-status.rate{border-color:rgba(248,195,92,.4);background:rgba(248,195,92,.09);color:#f9d786}.model-status.checking{border-color:rgba(124,140,255,.42);background:rgba(124,140,255,.1);color:#cbd1ff}.model-status.untested{color:#8f98a8}.empty-state',
    'model status styles'
)

replace_once(
    '<div class="section-title"><strong>Model</strong><span class="tag"><i data-lucide="arrow-down-a-z" width="14"></i>Name A–Z</span></div>\n<div class="field"><label><i data-lucide="bot" width="14"></i>Available models</label>',
    '<div class="section-title"><strong>Model</strong><span class="tag"><i data-lucide="arrow-down-a-z" width="14"></i>Name A–Z</span></div>\n<button class="btn" id="checkLiveModelsBtn" type="button" style="width:100%;margin-bottom:12px"><i data-lucide="activity" width="17"></i>Check Live Models</button>\n<div class="helper" style="margin:-4px 2px 12px">Runs tiny real generation probes sequentially. Green LIVE means the model returned a successful response; 429 is shown separately as RATE LIMITED.</div>\n<div class="field"><label><i data-lucide="bot" width="14"></i>Available models</label>',
    'live model button'
)

render_replacement = '''function modelStatusMeta(status){
  const value=status?.state||'untested';
  if(value==='live')return{label:'LIVE',className:'live'};
  if(value==='down')return{label:'DOWN',className:'down'};
  if(value==='rate_limited')return{label:'RATE LIMITED',className:'rate'};
  if(value==='checking')return{label:'CHECKING',className:'checking'};
  return{label:'UNTESTED',className:'untested'};
}
function renderModelList(models){
  const list=$('modelList');
  list.innerHTML='';
  $('modelCount').textContent=`${models.length} model${models.length===1?'':'s'}`;
  if(!models.length){list.innerHTML=`<div class="empty-state">${state.models.length?'No matching models.':'Load models to populate this list.'}</div>`;return}
  const f=document.createDocumentFragment();
  for(const model of models){
    const statusData=state.modelStatuses.get(model.id)||{state:'untested'};
    const status=modelStatusMeta(statusData);
    const o=document.createElement('button');
    o.type='button';
    o.className='model-option'+(state.selected?.id===model.id?' active':'');
    o.setAttribute('role','option');
    o.innerHTML=`<span class="model-option-main"><span class="model-option-name"></span><span class="model-option-id"></span></span><span class="model-option-side"><span class="model-status ${status.className}">${status.label}</span><span class="checkmark"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg></span></span>`;
    o.querySelector('.model-option-name').textContent=model.label;
    o.querySelector('.model-option-id').textContent=model.id;
    const badge=o.querySelector('.model-status');
    const details=[];
    if(statusData.http)details.push('HTTP '+statusData.http);
    if(statusData.latency!=null)details.push(statusData.latency+' ms');
    if(statusData.detail)details.push(statusData.detail);
    if(details.length)badge.title=details.join(' • ');
    o.onclick=()=>selectModel(model);
    f.appendChild(o);
  }
  list.appendChild(f);
}
'''
replace_between('function renderModelList(models){', 'function effectiveKeys', render_replacement, 'model list renderer')

replace_once(
    "    const ids = Core.parseModelIds(result.data);\n    state.models = normalizeModels(ids);\n    state.selected = null;",
    "    const ids = Core.parseModelIds(result.data);\n    state.models = normalizeModels(ids);\n    state.modelStatuses = new Map();\n    state.selected = null;",
    'reset model statuses when models load'
)

live_probe_code = '''function modelAvailabilityFromResult(result){
  const status=Number(result?.status||0);
  if(result?.ok)return{state:'live',http:status||200,latency:result.latency??null,detail:'Successful API response'};
  if(status===429)return{state:'rate_limited',http:429,latency:result?.latency??null,detail:'Provider rate limit'};
  return{state:'down',http:status||null,latency:result?.latency??null,detail:result?.error||Core.classifyResponse(result).title||'Request failed'};
}
function waitForModelProbe(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function checkLiveModels(){
  if(state.modelCheckRunning)return;
  if(!state.models.length){setStatus('Load models first before checking live status.','bad');return}
  const total=state.models.length;
  if(!confirm('Check '+total+' model'+(total===1?'':'s')+' with tiny real generation requests? This can use provider credits and may take time.'))return;
  syncKeys();
  let key=state.keys[Math.min(state.activeKeyIndex,state.keys.length-1)]||'';
  try{
    if($('endpointOnly').checked)await ensureEndpointOnlySetup('test',key);
  }catch(error){setStatus(error.message,'bad');setResult(error.message);return}
  let meta;
  try{meta=requestMeta('test')}catch(error){setStatus(error.message,'bad');setResult(error.message);return}
  const keys=effectiveKeys(meta);
  if(!keys.length){setStatus('Enter an API key before checking live models, or disable authentication for a public API.','bad');return}
  key=keys[Math.min(state.activeKeyIndex,keys.length-1)]||'';
  if(authNeedsKey(meta.auth.type)&&!key){setStatus('API key is required for live model checks.','bad');return}

  const button=$('checkLiveModelsBtn');
  const original={selected:state.selected,manual:$('manualModel').value,prompt:$('prompt').value,maxTokens:$('maxTokens').value,detectionUrl:state.endpointDetection?.requestUrl||''};
  const endpointPlan=$('endpointOnly').checked?AutoSetup.buildEndpointDiscoveryPlan($('endpointOnlyURL').value.trim(),{keyPresent:!!key}):null;
  const dynamicCandidate=endpointPlan?.requests?.find(candidate=>candidate.format===meta.format&&String(candidate.pathTemplate||'').includes('{model}'))||null;
  state.modelStatuses=new Map(state.models.map(model=>[model.id,{state:'untested'}]));
  state.modelCheckRunning=true;
  button.disabled=true;$('loadBtn').disabled=true;$('testActiveBtn').disabled=true;$('testAllBtn').disabled=true;
  $('manualModel').value='';$('prompt').value='Reply only with OK';$('maxTokens').value='8';
  let authStopped=false;
  try{
    for(let i=0;i<state.models.length;i++){
      const model=state.models[i];
      if(AutoSetup.modelScore(model.id)<=-1000){
        state.modelStatuses.set(model.id,{state:'untested',detail:'Skipped: not detected as a text-generation model'});
        renderModelList(filterModels(state.models,$('modelSearch').value));
        continue;
      }
      state.selected=model;
      if(dynamicCandidate&&state.endpointDetection)state.endpointDetection.requestUrl=resolveDiscoveryCandidateURL(dynamicCandidate,model.id);
      state.modelStatuses.set(model.id,{state:'checking'});
      renderModelList(filterModels(state.models,$('modelSearch').value));
      setStatus('Checking '+(i+1)+'/'+total+' — '+model.id+'…','loading');
      let result;
      try{result=await requestKey(key,'test')}catch(error){result={reachedServer:false,ok:false,status:0,latency:0,error:error.message,transport:'n/a'}}
      const availability=modelAvailabilityFromResult(result);
      state.modelStatuses.set(model.id,availability);
      renderModelList(filterModels(state.models,$('modelSearch').value));
      if(availability.http===401||availability.http===403){authStopped=true;break}
      if(i<state.models.length-1)await waitForModelProbe(350);
    }
  }finally{
    if(state.endpointDetection&&original.detectionUrl)state.endpointDetection.requestUrl=original.detectionUrl;
    state.selected=original.selected;$('manualModel').value=original.manual;$('prompt').value=original.prompt;$('maxTokens').value=original.maxTokens;
    if(original.selected){$('selectedModelName').textContent=original.selected.label||original.selected.id;$('selectedModelId').textContent=original.selected.id}
    button.disabled=false;$('loadBtn').disabled=false;$('testActiveBtn').disabled=false;$('testAllBtn').disabled=false;state.modelCheckRunning=false;
    renderModelList(filterModels(state.models,$('modelSearch').value));
  }
  const statuses=[...state.modelStatuses.values()];
  const live=statuses.filter(item=>item.state==='live').length;
  const down=statuses.filter(item=>item.state==='down').length;
  const rate=statuses.filter(item=>item.state==='rate_limited').length;
  const untested=state.models.length-live-down-rate;
  if(authStopped)setStatus('Live check stopped because the provider rejected authentication. Remaining models stay UNTESTED.','bad');
  else setStatus(live+' LIVE, '+down+' DOWN, '+rate+' RATE LIMITED, '+untested+' UNTESTED',live?'good':(down?'bad':''));
  setMetrics([['LIVE',live],['DOWN',down],['Rate limited',rate],['Untested',untested],['Total',state.models.length]]);
  setResult(state.models.map(model=>{const item=state.modelStatuses.get(model.id)||{state:'untested'};const meta=modelStatusMeta(item);return meta.label+'  '+model.id+(item.http?'  • HTTP '+item.http:'')+(item.latency!=null?'  • '+item.latency+' ms':'')+(item.detail?'  • '+item.detail:'')}).join('\n'));
}
'''
replace_once('async function testKeyAt(index) {', live_probe_code + 'async function testKeyAt(index) {', 'live model probe function')

replace_once(
    "state.endpointDetection=null;state.models=[];state.selected=null;state.keys=[];",
    "state.endpointDetection=null;state.models=[];state.modelStatuses=new Map();state.selected=null;state.keys=[];",
    'clear model statuses'
)

replace_once(
    "$('modelSearch').oninput=e=>renderModelList(filterModels(state.models,e.target.value));$('loadBtn').onclick=loadModels;$('testAllBtn').onclick=testAllKeys;",
    "$('modelSearch').oninput=e=>renderModelList(filterModels(state.models,e.target.value));$('loadBtn').onclick=loadModels;$('checkLiveModelsBtn').onclick=checkLiveModels;$('testAllBtn').onclick=testAllKeys;",
    'live model button binding'
)

path.write_text(html, encoding='utf-8')
print('Applied live model status feature')
