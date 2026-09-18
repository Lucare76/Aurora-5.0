#!/usr/bin/env node
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { exec } from 'node:child_process'

const MCP = 'https://mcp.scalable.capital/mcp'
const REGISTER = 'https://mcp.scalable.capital/register'
const AUTHORIZE = 'https://mcp.scalable.capital/authorize'
const TOKEN = 'https://mcp.scalable.capital/token'
const SCOPES = 'openid profile offline_access'

const b64url = (buffer) => buffer.toString('base64url')
const verifier = b64url(randomBytes(48))
const challenge = b64url(createHash('sha256').update(verifier).digest())
const state = b64url(randomBytes(32))

function openBrowser(url) {
  const platform = process.platform
  if (platform === 'win32') exec(`start "" "${url.replaceAll('"', '%22')}"`)
  else if (platform === 'darwin') exec(`open "${url.replaceAll('"', '\\\"')}"`)
  else exec(`xdg-open "${url.replaceAll('"', '\\\"')}"`)
}

async function registerClient(redirectUri) {
  const response = await fetch(REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'Aurora 5.0 Local Bootstrap',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: SCOPES,
    }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Registrazione Scalable fallita (${response.status}): ${text}`)
  const body = JSON.parse(text)
  if (!body.client_id) throw new Error('Scalable non ha restituito client_id')
  return body.client_id
}

async function exchange({ clientId, code, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    resource: MCP,
  })
  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Scambio token fallito (${response.status}): ${text}`)
  return JSON.parse(text)
}

const server = http.createServer()
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
if (!address || typeof address === 'string') throw new Error('Porta locale non disponibile')
const redirectUri = `http://127.0.0.1:${address.port}/callback`

try {
  console.log('\nAurora · collegamento Scalable')
  console.log('1) Registro un client locale con Scalable...')
  const clientId = await registerClient(redirectUri)

  const auth = new URL(AUTHORIZE)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('redirect_uri', redirectUri)
  auth.searchParams.set('scope', SCOPES)
  auth.searchParams.set('state', state)
  auth.searchParams.set('code_challenge', challenge)
  auth.searchParams.set('code_challenge_method', 'S256')
  auth.searchParams.set('resource', MCP)

  console.log('2) Apro Scalable nel browser. Completa login, 2FA e autorizzazione.')
  openBrowser(auth.toString())

  const callback = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tempo scaduto: ripeti la procedura.')), 10 * 60 * 1000)
    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url ?? '/', redirectUri)
        if (url.pathname !== '/callback') {
          res.writeHead(404).end('Not found')
          return
        }
        const returnedState = url.searchParams.get('state')
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        if (error) throw new Error(`Scalable ha rifiutato l'autorizzazione: ${error}`)
        if (returnedState !== state || !code) throw new Error('Callback OAuth non valida')
        clearTimeout(timeout)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Scalable collegato.</h2><p>Puoi chiudere questa finestra e tornare al terminale.</p>')
        resolve({ code })
      } catch (error) {
        clearTimeout(timeout)
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Autorizzazione non riuscita.')
        reject(error)
      }
    })
  })

  console.log('3) Recupero il token di aggiornamento...')
  const token = await exchange({ clientId, code: callback.code, redirectUri })
  if (!token.refresh_token) throw new Error('Scalable non ha restituito un refresh token.')

  console.log('\n=== COPIA QUESTI DUE VALORI NELLA PAGINA PATRIMONIO DI AURORA ===')
  console.log('CLIENT ID:')
  console.log(clientId)
  console.log('\nREFRESH TOKEN:')
  console.log(token.refresh_token)
  console.log('\nNon incollare questi valori in chat. Il refresh token è una credenziale sensibile.')
} catch (error) {
  console.error('\nERRORE:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  server.close()
}
