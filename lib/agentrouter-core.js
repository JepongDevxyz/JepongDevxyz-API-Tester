(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.ApiTesterCore = api;
    root.AgentRouterCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseKeys(value) {
    return [...new Set(String(value || '')
      .split(/[,\n\r\t ]+/)
      .map((v) => v.trim())
      .filter(Boolean))];
  }

  function maskKey(key) {
    const value = String(key || '');
    if (!value) return '(no key)';
    if (value.length < 12) return '••••••••';
    return `${value.slice(0, 7)}••••••••${value.slice(-4)}`;
  }

  function rawText(data) {
    try { return JSON.stringify(data || {}).toLowerCase(); }
    catch { return String(data || '').toLowerCase(); }
  }

  function classifyResponse(result) {
    if (!result || !result.reachedServer) {
      return {
        state: 'browser_blocked',
        title: 'BROWSER / CORS',
        message: 'Hindi nakumpleto ng browser ang request. Posibleng CORS, DNS, timeout, o browser network restriction.'
      };
    }

    const raw = rawText(result.data);
    if (raw.includes('unauthorized client detected') || raw.includes('unauthorized_client_error')) {
      return {
        state: 'client_blocked',
        title: 'CLIENT BLOCKED',
        message: 'Naabot ang provider pero nireject ang client. Provider-side restriction ito, hindi ordinary CORS.'
      };
    }

    if (result.ok) return { state: 'working', title: 'WORKING', message: 'Tinanggap ng API provider ang request.' };
    if (result.status === 400) return { state: 'bad_request', title: '400 BAD REQUEST', message: 'Naabot ang API pero may invalid o unsupported request field.' };
    if (result.status === 401) return { state: 'invalid', title: '401 UNAUTHORIZED', message: 'Hindi tinanggap ang API credential.' };
    if (result.status === 403) return { state: 'forbidden', title: '403 FORBIDDEN', message: 'Naabot ang API pero walang permission ang request, token, model, o client.' };
    if (result.status === 404) return { state: 'not_found', title: '404 NOT FOUND', message: 'Naabot ang host pero hindi nakita ang endpoint o model.' };
    if (result.status === 429) return { state: 'rate', title: '429 RATE LIMITED', message: 'Naabot ang API pero rate limit o quota ang pumigil sa request.' };
    if (result.status >= 500) return { state: 'server_error', title: `HTTP ${result.status}`, message: 'May upstream/provider server error.' };
    return { state: 'error', title: `HTTP ${result.status || 0}`, message: 'Nagbalik ang API provider ng error.' };
  }

  function shouldProxyFallback(result) {
    return Boolean(result && !result.reachedServer && Number(result.status || 0) === 0);
  }

  function parseModelIds(data) {
    let list = [];
    if (Array.isArray(data?.data)) list = data.data.map((item) => item?.id || item?.name);
    else if (Array.isArray(data?.models)) list = data.models.map((item) => item?.id || item?.name);
    else if (Array.isArray(data)) list = data.map((item) => item?.id || item?.name);
    return [...new Set(list
      .filter(Boolean)
      .map((value) => String(value).replace(/^models\//, ''))
      .filter(Boolean))];
  }

  function textFromContentArray(content) {
    if (!Array.isArray(content)) return '';
    return content
      .map((item) => typeof item === 'string' ? item : (item?.text || item?.content || ''))
      .filter(Boolean)
      .join('\n');
  }

  function extractReply(data) {
    const openAI = data?.choices?.[0]?.message?.content;
    if (typeof openAI === 'string') return openAI;
    if (Array.isArray(openAI)) {
      const joined = textFromContentArray(openAI);
      if (joined) return joined;
    }

    if (typeof data?.output_text === 'string') return data.output_text;
    if (Array.isArray(data?.output)) {
      const joined = data.output
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
        .map((item) => item?.text || item?.content || '')
        .filter(Boolean)
        .join('\n');
      if (joined) return joined;
    }

    if (Array.isArray(data?.content)) {
      const joined = textFromContentArray(data.content);
      if (joined) return joined;
    }

    if (Array.isArray(data?.candidates)) {
      const parts = data.candidates[0]?.content?.parts;
      const joined = textFromContentArray(parts);
      if (joined) return joined;
    }

    if (Array.isArray(data?.message?.content)) {
      const joined = textFromContentArray(data.message.content);
      if (joined) return joined;
    }
    if (typeof data?.message?.content === 'string') return data.message.content;

    if (typeof data?.text === 'string') return data.text;
    return '';
  }

  function statusClass(state) {
    if (state === 'working') return 'ok';
    if (['browser_blocked', 'client_blocked', 'rate'].includes(state)) return 'warn';
    return 'bad';
  }

  return { parseKeys, maskKey, classifyResponse, shouldProxyFallback, parseModelIds, extractReply, statusClass };
});
