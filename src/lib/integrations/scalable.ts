import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

export const SCALABLE_MCP_URL = 'https://mcp.scalable.capital/mcp'
export const SCALABLE_AUTH_URL = 'https://mcp.scalable.capital/authorize'
export const SCALABLE_TOKEN_URL = 'https://mcp.scalable.capital/token'
export const SCALABLE_REGISTER_URL = 'https://mcp.scalable.capital/register'
export const SCALABLE_SCOPES = 'openid profile offline_access'
export const SCALABLE_PROTOCOL_VERSION = '2025-06-18'

type OAuthTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

type McpTool = {
  name: string
  description?: string
  inputSchema?: {
    type?: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

type McpSession = {
  accessToken: string
  sessionId?: string
  tools: McpTool[]
}

export type ScalableHolding = {
  portfolioId: string
  externalKey: string
  isin: string
  name: string
  currentValue: number
  investedAmount: number | null
  quantity: number | null
  unitPrice: number | null
  currency: string
  raw: Record<string, unknown>
}

export type ScalableSavingsPlan = {
  portfolioId: string
  isin: string | null
  amount: number | null
  nextExecutionDate: string | null
  raw: Record<string, unknown>
}

function encryptionKey() {
  const raw = process.env.SCALABLE_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('SCALABLE_TOKEN_ENCRYPTION_KEY_MISSING')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('SCALABLE_TOKEN_ENCRYPTION_KEY_INVALID')
  return key
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decryptSecret(value: string) {
  const payload = Buffer.from(value, 'base64')
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const ciphertext = payload.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

function base64Url(input: Buffer) {
  return input.toString('base64url')
}

export function createPkce() {
  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const state = base64Url(randomBytes(32))
  return { verifier, challenge, state }
}

export async function registerScalableClient(redirectUri: string) {
  const response = await fetch(SCALABLE_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'Aurora 5.0',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: SCALABLE_SCOPES,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`SCALABLE_REGISTER_FAILED:${response.status}:${detail.slice(0, 300)}`)
  }

  const body = await response.json() as { client_id?: string }
  if (!body.client_id) throw new Error('SCALABLE_REGISTER_NO_CLIENT_ID')
  return body.client_id
}

export function buildScalableAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
}) {
  const url = new URL(SCALABLE_AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', SCALABLE_SCOPES)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('resource', SCALABLE_MCP_URL)
  return url.toString()
}

export async function exchangeScalableCode(params: {
  clientId: string
  code: string
  verifier: string
  redirectUri: string
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    code: params.code,
    code_verifier: params.verifier,
    redirect_uri: params.redirectUri,
    resource: SCALABLE_MCP_URL,
  })
  const response = await fetch(SCALABLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`SCALABLE_TOKEN_EXCHANGE_FAILED:${response.status}:${detail.slice(0, 300)}`)
  }
  return response.json() as Promise<OAuthTokenResponse>
}

export async function refreshScalableToken(params: {
  clientId: string
  refreshToken: string
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    refresh_token: params.refreshToken,
    resource: SCALABLE_MCP_URL,
  })
  const response = await fetch(SCALABLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`SCALABLE_TOKEN_REFRESH_FAILED:${response.status}:${detail.slice(0, 300)}`)
  }
  return response.json() as Promise<OAuthTokenResponse>
}

function parseSseOrJson(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed)
  const payloads = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(payloads[index]) } catch { /* keep looking */ }
  }
  throw new Error('SCALABLE_MCP_UNPARSEABLE_RESPONSE')
}

async function mcpRequest(params: {
  accessToken: string
  method: string
  requestParams?: Record<string, unknown>
  id?: number
  sessionId?: string
}) {
  const payload: Record<string, unknown> = {
    jsonrpc: '2.0',
    method: params.method,
  }
  if (params.id !== undefined) payload.id = params.id
  if (params.requestParams !== undefined) payload.params = params.requestParams

  const response = await fetch(SCALABLE_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': SCALABLE_PROTOCOL_VERSION,
      ...(params.sessionId ? { 'Mcp-Session-Id': params.sessionId } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`SCALABLE_MCP_FAILED:${params.method}:${response.status}:${detail.slice(0, 300)}`)
  }

  const sessionId = response.headers.get('mcp-session-id') ?? params.sessionId
  const text = await response.text()
  const parsed = text ? parseSseOrJson(text) : null
  if (parsed?.error) throw new Error(`SCALABLE_MCP_ERROR:${params.method}:${JSON.stringify(parsed.error).slice(0, 400)}`)
  return { response: parsed, sessionId }
}

export async function openScalableMcpSession(accessToken: string): Promise<McpSession> {
  const init = await mcpRequest({
    accessToken,
    id: 1,
    method: 'initialize',
    requestParams: {
      protocolVersion: SCALABLE_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'Aurora 5.0', version: '5.0.0' },
    },
  })

  await mcpRequest({
    accessToken,
    sessionId: init.sessionId,
    method: 'notifications/initialized',
  })

  const toolsResponse = await mcpRequest({
    accessToken,
    sessionId: init.sessionId,
    id: 2,
    method: 'tools/list',
    requestParams: {},
  })

  const tools = (toolsResponse.response?.result?.tools ?? []) as McpTool[]
  return { accessToken, sessionId: toolsResponse.sessionId ?? init.sessionId, tools }
}

function toolArgs(session: McpSession, toolName: string, portfolioId?: string) {
  const tool = session.tools.find((item) => item.name === toolName)
  if (!tool) throw new Error(`SCALABLE_TOOL_NOT_AVAILABLE:${toolName}`)
  const properties = tool.inputSchema?.properties ?? {}
  if (!portfolioId) return {}
  const portfolioKey = Object.keys(properties).find((key) => key.toLowerCase().replaceAll('_', '').includes('portfolioid'))
    ?? Object.keys(properties).find((key) => key.toLowerCase().includes('portfolio'))
  return portfolioKey ? { [portfolioKey]: portfolioId } : { portfolio_id: portfolioId }
}

export async function callScalableTool(session: McpSession, toolName: string, portfolioId?: string) {
  const result = await mcpRequest({
    accessToken: session.accessToken,
    sessionId: session.sessionId,
    id: Math.floor(Date.now() % 1000000) + 10,
    method: 'tools/call',
    requestParams: {
      name: toolName,
      arguments: toolArgs(session, toolName, portfolioId),
    },
  })
  session.sessionId = result.sessionId
  return result.response?.result ?? null
}

function structuredToolData(result: any): any {
  if (!result) return null
  if (result.structuredContent != null) return result.structuredContent
  const content = Array.isArray(result.content) ? result.content : []
  for (const item of content) {
    if (item?.type !== 'text' || typeof item.text !== 'string') continue
    try { return JSON.parse(item.text) } catch { /* not JSON */ }
  }
  return result
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    for (const key of ['amount', 'value', 'number', 'amountInEuro', 'amount_in_euro']) {
      const candidate = asNumber(row[key])
      if (candidate != null) return candidate
    }
  }
  return null
}

function stringValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function numericValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(row[key])
    if (value != null) return value
  }
  return null
}

function collectObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output)
    return output
  }
  if (!value || typeof value !== 'object') return output
  const row = value as Record<string, unknown>
  output.push(row)
  for (const child of Object.values(row)) {
    if (child && typeof child === 'object') collectObjects(child, output)
  }
  return output
}

function portfolioIdsFromResult(result: unknown) {
  const rows = collectObjects(structuredToolData(result))
  const ids = new Set<string>()
  for (const row of rows) {
    const id = stringValue(row, ['portfolioId', 'portfolio_id', 'id'])
    const looksLikePortfolio = Object.keys(row).some((key) => key.toLowerCase().includes('portfolio'))
      || 'portfolioId' in row
      || 'portfolio_id' in row
    if (id && looksLikePortfolio) ids.add(id)
  }
  return [...ids]
}

function holdingFromRow(row: Record<string, unknown>, portfolioId: string): ScalableHolding | null {
  const isin = stringValue(row, ['isin', 'ISIN'])
  if (!isin) return null

  const currentValue = numericValue(row, [
    'marketValue', 'market_value', 'currentValue', 'current_value', 'positionValue', 'position_value', 'value',
  ])
  if (currentValue == null) return null

  const quantity = numericValue(row, ['quantity', 'shares', 'units'])
  const unitPrice = numericValue(row, ['lastPrice', 'last_price', 'price', 'currentPrice', 'current_price', 'quote'])
  let investedAmount = numericValue(row, [
    'cost', 'costBasis', 'cost_basis', 'purchaseValue', 'purchase_value', 'investedAmount', 'invested_amount', 'acquisitionValue', 'acquisition_value',
  ])

  const averagePurchasePrice = numericValue(row, ['averagePurchasePrice', 'average_purchase_price', 'averageBuyPrice', 'average_buy_price'])
  if (investedAmount == null && quantity != null && averagePurchasePrice != null) investedAmount = quantity * averagePurchasePrice

  const profitLoss = numericValue(row, [
    'profitLoss', 'profit_loss', 'absoluteReturn', 'absolute_return', 'simpleAbsoluteReturn', 'simple_absolute_return', 'sinceBuyAbsoluteReturn',
  ])
  if (investedAmount == null && profitLoss != null) investedAmount = currentValue - profitLoss

  const name = stringValue(row, [
    'name', 'securityName', 'security_name', 'instrumentName', 'instrument_name', 'displayName', 'display_name', 'title',
  ]) ?? isin
  const currency = stringValue(row, ['currency', 'currencyCode', 'currency_code']) ?? 'EUR'

  return {
    portfolioId,
    externalKey: `${portfolioId}:${isin}`,
    isin,
    name,
    currentValue,
    investedAmount,
    quantity,
    unitPrice,
    currency,
    raw: row,
  }
}

export async function readScalablePortfolio(accessToken: string) {
  const session = await openScalableMcpSession(accessToken)
  const portfolioResult = await callScalableTool(session, 'list_accessible_portfolios')
  let portfolioIds = portfolioIdsFromResult(portfolioResult)

  if (portfolioIds.length === 0) {
    const profileResult = await callScalableTool(session, 'get_account_profile')
    portfolioIds = portfolioIdsFromResult(profileResult)
  }

  if (portfolioIds.length === 0) throw new Error('SCALABLE_NO_PORTFOLIOS_FOUND')

  const holdings: ScalableHolding[] = []
  const savingsPlans: ScalableSavingsPlan[] = []

  for (const portfolioId of portfolioIds) {
    const holdingResult = await callScalableTool(session, 'get_portfolio_holdings', portfolioId)
    const holdingRows = collectObjects(structuredToolData(holdingResult))
    const seen = new Set<string>()
    for (const row of holdingRows) {
      const holding = holdingFromRow(row, portfolioId)
      if (!holding || seen.has(holding.externalKey)) continue
      seen.add(holding.externalKey)
      holdings.push(holding)
    }

    if (session.tools.some((tool) => tool.name === 'list_savings_plans')) {
      const planResult = await callScalableTool(session, 'list_savings_plans', portfolioId)
      const planRows = collectObjects(structuredToolData(planResult))
      for (const row of planRows) {
        const isin = stringValue(row, ['isin', 'ISIN'])
        const amount = numericValue(row, ['amount', 'savingsAmount', 'savings_amount', 'monthlyAmount', 'monthly_amount'])
        if (!isin && amount == null) continue
        savingsPlans.push({
          portfolioId,
          isin,
          amount,
          nextExecutionDate: stringValue(row, ['nextExecutionDate', 'next_execution_date', 'nextDate', 'next_date']),
          raw: row,
        })
      }
    }
  }

  return {
    portfolioIds,
    holdings,
    savingsPlans,
    availableTools: session.tools.map((tool) => tool.name),
  }
}
