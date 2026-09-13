(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgentRouterCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseKeys(value) {
    return [...new Set(String(value || '')
      .split(/[,\n\r\t ]+/)
      .map((v) => v.trim())
      .filter(Boolean))];
  }

  function maskKey(key) {
    const value = String(key || '');
    if (!value) return '—';
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
        message: 'Naabot ang AgentRouter pero nireject ang client. Provider-side restriction ito, hindi ordinary CORS.'
      };
    }

    if (result.ok) {
      return {
        state: 'working',
        title: 'WORKING',
        message: 'Tinanggap ng AgentRouter ang request.'
      };
    }

    if (result.status === 401) return { state: 'invalid', title: '401 UNAUTHORIZED', message: 'Hindi tinanggap ang API credential.' };
    if (result.status === 403) return { state: 'forbidden', title: '403 FORBIDDEN', message: 'Naabot ang AgentRouter pero walang permission ang request/model/token.' };
    if (result.status === 429) return { state: 'rate', title: '429 RATE LIMITED', message: 'Naabot ang AgentRouter pero kasalukuyang rate limited.' };
    if (result.status >= 500) return { state: 'server_error', title: `HTTP ${result.status}`, message: 'May upstream/server error.' };
    return { state: 'error', title: `HTTP ${result.status || 0}`, message: 'Nagbalik ang AgentRouter ng API error.' };
  }

  function shouldProxyFallback(result) {
    return Boolean(result && !result.reachedServer && Number(result.status || 0) === 0);
  }

  function parseModelIds(data) {
    const list = Array.isArray(data?.data) ? data.data : [];
    return [...new Set(list.map((item) => item?.id).filter(Boolean))];
  }

  function extractReply(data) {
    const openAI = data?.choices?.[0]?.message?.content;
    if (typeof openAI === 'string') return openAI;
    if (Array.isArray(openAI)) {
      const joined = openAI.map((x) => x?.text || x?.content || '').filter(Boolean).join('\n');
      if (joined) return joined;
    }
    if (Array.isArray(data?.content)) {
      const joined = data.content
        .filter((item) => item && (item.type === 'text' || typeof item.text === 'string'))
        .map((item) => item.text || '')
        .filter(Boolean)
        .join('\n');
      if (joined) return joined;
    }
    if (typeof data?.output_text === 'string') return data.output_text;
    return '';
  }

  function statusClass(state) {
    if (state === 'working') return 'ok';
    if (['browser_blocked', 'client_blocked', 'rate'].includes(state)) return 'warn';
    return 'bad';
  }

  return { parseKeys, maskKey, classifyResponse, shouldProxyFallback, parseModelIds, extractReply, statusClass };
});
