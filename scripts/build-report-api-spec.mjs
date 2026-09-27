import fs from 'node:fs'

// The report specification starts with the API's exported schemas, then adds
// operation-specific status codes and request/response examples.
const spec = JSON.parse(fs.readFileSync('docs/openapi.json', 'utf8'))
spec.info.description = 'NetScope vietų, įrenginių, klientų ir paskyrų API. Svečias gali registruotis ir prisijungti; prisijungęs naudotojas naudoja JWT HttpOnly slapuke. Pavyzdžių UUID ir datos yra iliustraciniai.'
spec.info.version = '1.0.0'
spec.servers = [{ url: 'http://localhost:5220', description: 'Vietinė versija' }]

const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  location: '22222222-2222-4222-8222-222222222222',
  device: '33333333-3333-4333-8333-333333333333',
  client: '44444444-4444-4444-8444-444444444444',
}
const base = `/api/locations/${ids.location}`
const deviceBase = `${base}/devices/${ids.device}`
const clientBase = `${deviceBase}/clients/${ids.client}`
const link = (href, method = 'GET') => ({ href, method })
const user = { id: ids.user, email: 'redas@netscope.local', role: 'User' }
const session = { user, expiresAt: '2026-09-26T12:30:00Z' }
const locationBody = { name: '301 laboratorija', address: 'Studentų g. 50, Kaunas', description: 'Mokomasis tinklas' }
const deviceBody = { name: 'Pagrindinis maršrutizatorius', type: 'Router', ipAddress: '192.168.10.1', macAddress: '02:00:00:10:00:01', status: 'Online' }
const clientBody = { name: 'Darbo vieta 01', type: 'Computer', ipAddress: '192.168.10.10', macAddress: '02:00:00:10:01:01' }
const location = {
  id: ids.location, ...locationBody, ownerId: ids.user, createdAt: '2026-09-26T10:00:00Z',
  links: { self: link(base), collection: link('/api/locations'), devices: link(`${base}/devices`) },
}
const device = {
  id: ids.device, locationId: ids.location, ...deviceBody,
  links: { self: link(deviceBase), location: link(base), collection: link(`${base}/devices`), clients: link(`${deviceBase}/clients`) },
}
const client = {
  id: ids.client, deviceId: ids.device, ...clientBody,
  links: { self: link(clientBase), device: link(deviceBase), collection: link(`${deviceBase}/clients`) },
}
const list = (path, item) => ({ items: [item], total: 1, page: 1, pageSize: 20, links: { self: link(`${path}?page=1&pageSize=20`) } })

const cases = {
  'GET /health': { codes: [200, 503], body: { status: 'healthy' } },
  'POST /api/auth/register': { codes: [201, 400, 403, 409], request: { email: 'naujas@netscope.local', password: 'StiprusSlaptazodis!123' }, body: { user: { ...user, email: 'naujas@netscope.local' }, expiresAt: session.expiresAt } },
  'POST /api/auth/login': { codes: [200, 400, 401, 403], request: { email: 'redas@netscope.local', password: 'NetScopeDemo!2026' }, body: session },
  'POST /api/auth/refresh': { codes: [200, 401, 403], body: session, cookie: 'netscope_refresh=<refresh_token>' },
  'GET /api/auth/me': { codes: [200, 401], body: user },
  'POST /api/auth/logout': { codes: [204, 403], cookie: 'netscope_access=<JWT>; netscope_refresh=<refresh_token>' },
  'GET /api/locations': { codes: [200, 400, 401], query: '?page=1&pageSize=20', body: list('/api/locations', location) },
  'POST /api/locations': { codes: [201, 400, 401, 403], request: locationBody, body: location },
  'GET /api/locations/{locationId}': { codes: [200, 401, 404], body: location },
  'PUT /api/locations/{locationId}': { codes: [200, 400, 401, 403, 404, 409], request: locationBody, body: location },
  'DELETE /api/locations/{locationId}': { codes: [204, 401, 403, 404, 409] },
  'GET /api/locations/{locationId}/devices': { codes: [200, 400, 401, 404], query: '?page=1&pageSize=20', body: list(`${base}/devices`, device) },
  'POST /api/locations/{locationId}/devices': { codes: [201, 400, 401, 403, 404, 409], request: deviceBody, body: device },
  'GET /api/locations/{locationId}/devices/{deviceId}': { codes: [200, 401, 404], body: device },
  'PUT /api/locations/{locationId}/devices/{deviceId}': { codes: [200, 400, 401, 403, 404, 409], request: deviceBody, body: device },
  'DELETE /api/locations/{locationId}/devices/{deviceId}': { codes: [204, 401, 403, 404, 409] },
  'GET /api/locations/{locationId}/devices/{deviceId}/clients': { codes: [200, 400, 401, 403, 404], query: '?page=1&pageSize=20', body: list(`${deviceBase}/clients`, client) },
  'POST /api/locations/{locationId}/devices/{deviceId}/clients': { codes: [201, 400, 401, 403, 404, 409], request: clientBody, body: client },
  'GET /api/locations/{locationId}/devices/{deviceId}/clients/{clientId}': { codes: [200, 401, 403, 404], body: client },
  'PUT /api/locations/{locationId}/devices/{deviceId}/clients/{clientId}': { codes: [200, 400, 401, 403, 404, 409], request: clientBody, body: client },
  'DELETE /api/locations/{locationId}/devices/{deviceId}/clients/{clientId}': { codes: [204, 401, 403, 404, 409] },
  'GET /api/overview': { codes: [200, 401], body: { locationCount: 1, deviceCount: 1, onlineDeviceCount: 1, recentLocations: [{ location, deviceCount: 1 }], links: { self: link('/api/overview'), locations: link('/api/locations') } } },
  'GET /api/users': { codes: [200, 400, 401, 403], query: '?page=1&pageSize=20', body: list('/api/users', user) },
  'DELETE /api/users/{userId}': { codes: [204, 401, 403, 404, 409] },
}

const descriptions = {
  200: 'Sėkminga užklausa.', 201: 'Resursas sukurtas.', 204: 'Veiksmas atliktas; atsakymo turinio nėra.',
  400: 'Netinkama užklausa arba filtro / duomenų validacijos klaida.',
  401: 'Neprisijungta arba prisijungimo / atnaujinimo duomenys negalioja.',
  403: 'Veiksmui trūksta teisių arba būseną keičiančios užklausos kilmė neleidžiama.',
  404: 'Resursas arba nurodytas hierarchijos ryšys nerastas.',
  409: 'Dubliuojami duomenys, konkurentinio keitimo konfliktas arba draudžiamas savo paskyros šalinimas.',
  503: 'Duomenų bazė nepasiekiama.',
}
const exampleParam = { locationId: ids.location, deviceId: ids.device, clientId: ids.client, userId: ids.user, ownerId: ids.user, Search: 'laboratorija', Page: 1, PageSize: 20, type: 'Router', status: 'Online' }
const errorBody = code => ({ title: descriptions[code], status: code })
const replaceIds = path => path.replace('{locationId}', ids.location).replace('{deviceId}', ids.device).replace('{clientId}', ids.client).replace('{userId}', ids.user)

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const key = `${method.toUpperCase()} ${path}`
    const item = cases[key]
    if (!item) throw Error(`No report example: ${key}`)
    op.operationId = `${method}${path.split('/').filter(Boolean).map(p => p.replace(/[{}]/g, '')).map(p => p[0].toUpperCase() + p.slice(1)).join('')}`
    op.description = `${op.summary}. Toliau pateiktas konkretus užklausos ir atsakymo pavyzdys; visi galimi dokumentuoti HTTP kodai išvardyti responses.`
    for (const param of op.parameters ?? []) {
      if (exampleParam[param.name] !== undefined) param.example = param.name === 'type' && path.includes('/clients') ? 'Computer' : exampleParam[param.name]
    }
    if (item.request && op.requestBody) op.requestBody.content['application/json'].example = item.request
    const responses = {}
    for (const code of item.codes) {
      const original = op.responses[String(code)]
      const response = original ? structuredClone(original) : {}
      response.description = descriptions[code]
      if (code === 204) delete response.content
      else if (code === 200 || code === 201) {
        if (!response.content) response.content = { 'application/json': {} }
        response.content['application/json'].example = item.body
      } else {
        response.content = { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' }, example: errorBody(code) } }
      }
      if (code === 201 && path !== '/health') {
        const locationPath = path.startsWith('/api/auth/') ? '/api/auth/me'
          : replaceIds(path + (path.endsWith('/devices') ? '/{deviceId}' : path.endsWith('/clients') ? '/{clientId}' : '/{locationId}'))
        response.headers = { Location: { description: 'Sukurto resurso kelias.', schema: { type: 'string' }, example: locationPath } }
      }
      responses[String(code)] = response
    }
    op.responses = responses
    const headers = {}
    if (item.request) headers['Content-Type'] = 'application/json'
    if (item.cookie || !['GET /health', 'POST /api/auth/register', 'POST /api/auth/login'].includes(key)) headers.Cookie = item.cookie ?? 'netscope_access=<JWT>'
    const requestExample = { method: method.toUpperCase(), url: replaceIds(path) + (item.query ?? '') }
    if (Object.keys(headers).length) requestExample.headers = headers
    if (item.request) requestExample.body = item.request
    op['x-request-example'] = requestExample
    const responseExample = { status: item.codes[0] }
    if (item.codes[0] === 201) responseExample.headers = { Location: responses['201'].headers.Location.example }
    if (['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/refresh'].includes(key)) {
      responseExample.headers ??= {}
      responseExample.headers['Set-Cookie'] = ['netscope_access=<JWT>; HttpOnly; SameSite=Strict; Path=/', 'netscope_refresh=<refresh_token>; HttpOnly; SameSite=Strict; Path=/api/auth']
    }
    if (item.body) responseExample.body = item.body
    op['x-response-example'] = responseExample
  }
}

if (Object.keys(cases).length !== Object.values(spec.paths).reduce((count, methods) => count + Object.keys(methods).length, 0)) throw Error('The example inventory differs from API operations')

// JSON scalar quoting produces valid YAML 1.2, including Lithuanian text.
function scalar(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}
function yaml(value, depth = 0) {
  const pad = ' '.repeat(depth)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return value.map(item => typeof item === 'object' && item !== null && Object.keys(item).length
      ? `${pad}-\n${yaml(item, depth + 2)}`
      : `${pad}- ${typeof item === 'object' && item !== null ? yaml(item, depth + 2) : scalar(item)}`).join('\n')
  }
  if (value && typeof value === 'object') {
    if (!Object.keys(value).length) return '{}'
    return Object.entries(value).map(([key, item]) => {
      const label = `${pad}${JSON.stringify(key)}:`
      if (item && typeof item === 'object' && Object.keys(item).length) return `${label}\n${yaml(item, depth + 2)}`
      return `${label} ${item && typeof item === 'object' ? yaml(item, depth + 2) : scalar(item)}`
    }).join('\n')
  }
  return scalar(value)
}

fs.writeFileSync('api-spec.yaml', `# NetScope API ataskaitos specifikacija. Pavyzdžių ID ir datos yra iliustraciniai.\n${yaml(spec)}\n`)
console.log(`api-spec.yaml: ${Object.keys(cases).length} metodai`)
