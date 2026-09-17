import http from 'node:http'

const port = Number(process.env.MOCK_SUPABASE_PORT || 54329)

const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
    return
  }

  if (request.url?.startsWith('/auth/v1/user')) {
    response.writeHead(401, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      code: 'no_authorization',
      message: 'No authenticated test user',
    }))
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ message: 'Mock endpoint not implemented' }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock Supabase listening on http://127.0.0.1:${port}`)
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
