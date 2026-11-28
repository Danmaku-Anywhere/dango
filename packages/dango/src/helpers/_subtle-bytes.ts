// WebCrypto's typings reject Uint8Array<ArrayBufferLike>; allocating over a
// concrete ArrayBuffer is the workaround so subtle.* accepts our buffers.

import { base64Decode, base64Encode } from '@bufbuild/protobuf/wire'
import { Base64DecodeError } from './errors.js'

export function u8(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length))
}

export const ZERO_IV: Uint8Array<ArrayBuffer> = u8(16)

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  let decoded: Uint8Array
  try {
    decoded = base64Decode(b64)
  } catch (cause) {
    throw new Base64DecodeError(b64, { cause })
  }
  const bytes = u8(decoded.length)
  bytes.set(decoded)
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  return base64Encode(bytes)
}
