from pathlib import Path

proxy_path = Path('lib/proxy-core.js')
proxy = proxy_path.read_text(encoding='utf-8')
old = """    baseUrl = endpoint.baseUrl || provider.baseUrl;\n    path = presets.resolveEndpointPath(endpoint.path, input.model);\n    method = endpoint.method;\n    format = endpoint.format;\n    baseHeaders = { ...(provider.headers || {}), ...(endpoint.headers || {}) };\n"""
new = """    baseUrl = endpoint.baseUrl || provider.baseUrl;\n    path = presets.resolveEndpointPath(endpoint.path, input.model);\n    method = endpoint.method;\n    format = endpoint.format;\n    baseHeaders = { ...(provider.headers || {}), ...(endpoint.headers || {}) };\n    if (endpoint.baseUrl) {\n      const basePath = new URL(baseUrl).pathname.replace(/\\/+$/, '');\n      appendToBasePath = Boolean(basePath && basePath !== '/' && path !== basePath && !path.startsWith(basePath + '/'));\n    }\n"""
if old not in proxy:
    raise RuntimeError('proxy-core patch target not found')
proxy = proxy.replace(old, new, 1)
proxy_path.write_text(proxy, encoding='utf-8')

presets_path = Path('lib/provider-presets.js')
presets = presets_path.read_text(encoding='utf-8')
old_fireworks = """        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', {\n          baseUrl: 'https://api.fireworks.ai/inference', auth: { type: 'x-api-key' }, headers: { 'anthropic-version': '2023-06-01' }\n        })\n"""
new_fireworks = """        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', {\n          baseUrl: 'https://api.fireworks.ai/inference', auth: { type: 'bearer' }, headers: { 'anthropic-version': '2023-06-01' }\n        })\n"""
if old_fireworks not in presets:
    raise RuntimeError('Fireworks auth patch target not found')
presets = presets.replace(old_fireworks, new_fireworks, 1)
presets_path.write_text(presets, encoding='utf-8')

print('Applied provider base-path preservation and Fireworks Bearer auth fix')
