// Generates icon-192.png and icon-512.png — solid indigo #6366f1, no dependencies
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function makeChunk(type, data) {
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function solidPNG(size, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Each row: 1 filter byte + size*3 RGB bytes
  const row = Buffer.allocUnsafe(1 + size * 3)
  row[0] = 0
  for (let x = 0; x < size; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// Indigo #6366f1
const [r, g, b] = [0x63, 0x66, 0xf1]
writeFileSync('public/icon-192.png', solidPNG(192, r, g, b))
writeFileSync('public/icon-512.png', solidPNG(512, r, g, b))
console.log('✓ icon-192.png e icon-512.png generati in public/')
