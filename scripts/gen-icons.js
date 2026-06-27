#!/usr/bin/env node
// Generates placeholder PNG icons for FoilGuard.
// Replace with final branded icons before Chrome Web Store submission.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32BE(n)
  return b
}

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const crc = crc32(Buffer.concat([t, data]))
  return Buffer.concat([uint32BE(data.length), t, data, uint32BE(crc)])
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Image data: one filter byte (0) + RGB pixels per row
  const rowBytes = 1 + size * 3
  const raw = Buffer.allocUnsafe(size * rowBytes)
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      const base = y * rowBytes + 1 + x * 3
      raw[base] = r; raw[base + 1] = g; raw[base + 2] = b
    }
  }
  const compressed = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 48, 128]) {
  // Foil brand color: dark blue-gray (#1e40af area) — replace with final assets
  fs.writeFileSync(path.join(outDir, `foilguard-${size}.png`), makePNG(size, 30, 64, 175))
  console.log(`Generated foilguard-${size}.png`)
}
