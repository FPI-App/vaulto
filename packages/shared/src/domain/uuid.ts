// UUID v5 (RFC 4122 §4.3): id determinista a partir de un namespace + nombre.
//
// Se usa para filas que varios dispositivos pueden crear offline a la vez (p. ej.
// las categorías por defecto de un espacio): si cada uno genera el MISMO id, el
// upsert del sync las funde en una sola fila en vez de duplicarlas.
//
// SHA-1 en TS puro para no depender de expo-crypto ni de node:crypto: el dominio
// corre igual en la app, en tests y en el backend.

function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8
  const withPadding = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6))
  withPadding.set(bytes)
  withPadding[bytes.length] = 0x80
  const view = new DataView(withPadding.buffer)
  view.setUint32(withPadding.length - 4, ml >>> 0)
  view.setUint32(withPadding.length - 8, Math.floor(ml / 2 ** 32))

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const w = new Uint32Array(80)
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n))

  for (let off = 0; off < withPadding.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1)
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : i < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : i < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
              : [b ^ c ^ d, 0xca62c1d6]
      const temp = (rotl(a, 5) + f + e + k + w[i]!) >>> 0
      e = d
      d = c
      c = rotl(b, 30) >>> 0
      b = a
      a = temp
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const out = new Uint8Array(20)
  const outView = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h))
  return out
}

function uuidABytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new TypeError(`UUID inválido: ${uuid}`)
  return Uint8Array.from({ length: 16 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16))
}

/** UUID v5 determinista de `nombre` dentro del namespace `namespaceUuid`. */
export function uuidV5(nombre: string, namespaceUuid: string): string {
  const ns = uuidABytes(namespaceUuid)
  const name = new TextEncoder().encode(nombre)
  const input = new Uint8Array(ns.length + name.length)
  input.set(ns)
  input.set(name, ns.length)

  const hash = sha1(input).slice(0, 16)
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80

  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
