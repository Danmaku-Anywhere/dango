import { describe, expect, it } from 'bun:test'
import { Base64DecodeError } from '../helpers/errors.js'
import { helpers } from '../helpers/registry.js'

/**
 * Pins the $base64Encode and $base64Decode helpers: padding, empty input,
 * non-ASCII text, whitespace tolerance and the typed error on junk input.
 */

describe('$base64Encode', () => {
  it('encodes the RFC 4648 vectors with padding', () => {
    expect(helpers.base64Encode('')).toBe('')
    expect(helpers.base64Encode('f')).toBe('Zg==')
    expect(helpers.base64Encode('fo')).toBe('Zm8=')
    expect(helpers.base64Encode('foo')).toBe('Zm9v')
    expect(helpers.base64Encode('foobar')).toBe('Zm9vYmFy')
  })

  it('encodes non-ASCII text as UTF-8 bytes', () => {
    expect(helpers.base64Encode('弹幕')).toBe('5by55bmV')
    expect(helpers.base64Encode('é')).toBe('w6k=')
    expect(helpers.base64Encode('🎉')).toBe('8J+OiQ==')
  })

  it('uses the standard alphabet, not the URL-safe one', () => {
    expect(helpers.base64Encode('ûÿ')).toBe('w7vDvw==')
    expect(helpers.base64Encode('?>?>')).toBe('Pz4/Pg==')
  })

  it('handles inputs larger than the spread-argument limit', () => {
    const big = 'a'.repeat(200_000)
    const encoded = helpers.base64Encode(big) as string
    expect(encoded.length).toBe(Math.ceil(200_000 / 3) * 4)
    expect(helpers.base64Decode(encoded)).toBe(big)
  })
})

describe('$base64Decode', () => {
  it('decodes padded and unpadded input', () => {
    expect(helpers.base64Decode('')).toBe('')
    expect(helpers.base64Decode('Zg==')).toBe('f')
    expect(helpers.base64Decode('Zg')).toBe('f')
    expect(helpers.base64Decode('Zm8=')).toBe('fo')
    expect(helpers.base64Decode('Zm8')).toBe('fo')
    expect(helpers.base64Decode('Zm9v')).toBe('foo')
  })

  it('decodes UTF-8 bytes back to text', () => {
    expect(helpers.base64Decode('5by55bmV')).toBe('弹幕')
    expect(helpers.base64Decode('8J+OiQ==')).toBe('🎉')
  })

  it('ignores embedded whitespace and line breaks', () => {
    expect(helpers.base64Decode('Zm9v\nYmFy')).toBe('foobar')
    expect(helpers.base64Decode(' Zm9v YmFy\t')).toBe('foobar')
  })

  it('rejects characters outside the alphabet and impossible lengths', () => {
    expect(() => helpers.base64Decode('@@not base64@@')).toThrow(
      Base64DecodeError
    )
    expect(() => helpers.base64Decode('undefined')).toThrow(Base64DecodeError)
    expect(() => helpers.base64Decode('Z')).toThrow(Base64DecodeError)
  })
})
