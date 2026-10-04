import { describe, expect, test } from 'bun:test';
import { algFromLength, compareHashes, hashBuffer, normalizeHash } from '../../src/lib/hash';
import { parseHeader, safeSummary } from '../../src/lib/emailHeader';
import { EVENTS, EVENT_GROUPS } from '../../src/content/events';
import { scanText } from '../../src/lib/sensitive';

describe('hash', () => {
  test('sha-256 of "abc" and comparison forms', async () => {
    const h = await hashBuffer(new TextEncoder().encode('abc').buffer as ArrayBuffer, 'SHA-256');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(compareHashes(h, 'BA78 16BF 8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD')).toBe('match');
    expect(compareHashes(h, 'SHA256: ' + h.toUpperCase())).toBe('match');
    expect(compareHashes(h, h.slice(0, 63) + '0')).toBe('mismatch');
    expect(compareHashes(h, 'zzz')).toBe('invalid');
    expect(compareHashes(h, '  ')).toBe('empty');
  });
  test('algorithm guess and sha-1', async () => {
    expect(algFromLength('a'.repeat(40))).toBe('SHA-1'); expect(algFromLength('a'.repeat(64))).toBe('SHA-256');
    expect(algFromLength('a'.repeat(32))).toBe('MD5'); expect(algFromLength('xyz')).toBeNull();
    expect(await hashBuffer(new TextEncoder().encode('abc').buffer as ArrayBuffer, 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(normalizeHash('SHA-256: AB:CD')).toBe('abcd');
  });
});

const GOOD = `Received: from mail.example.org (mail.example.org [203.0.113.5]) by mx.example.net with ESMTPS; Tue, 1 Sep 2026 10:00:02 +0000
Received: from app.example.org by mail.example.org; Tue, 1 Sep 2026 10:00:00 +0000
Authentication-Results: mx.example.net; spf=pass smtp.mailfrom=example.org; dkim=pass header.d=example.org; dmarc=pass
DKIM-Signature: v=1; a=rsa-sha256; d=example.org; s=sel
From: "Billing" <billing@example.org>
Return-Path: <bounce@mail.example.org>
Subject: Invoice
Date: Tue, 1 Sep 2026 10:00:00 +0000`;
const BAD = `Received: from unknown (HELO x) (198.51.100.9) by mx.example.net; Tue, 1 Sep 2026 10:00:02 +0000
Authentication-Results: mx.example.net; spf=fail smtp.mailfrom=other.test; dkim=none; dmarc=fail
From: "support@bank.test" <help@pay-secure.test>
Reply-To: <collect@evil.test>
Return-Path: <x@other.test>
Subject: Urgent`;
describe('email header reader', () => {
  test('a clean message', () => {
    const r = parseHeader(GOOD) as any;
    expect(r.auth).toEqual({ spf: 'pass', dkim: 'pass', dmarc: 'pass' });
    expect(r.hops.length).toBe(2); expect(r.hops[0].from).toBe('app.example.org');
    expect(r.flags.some((f: any) => f.level === 'bad')).toBe(false);
    expect(safeSummary(r)).toContain('No serious flags raised.');
  });
  test('a suspicious message', () => {
    const r = parseHeader(BAD) as any;
    const text = r.flags.map((f: any) => f.text).join('|');
    expect(text).toContain('SPF: fail'); expect(text).toContain('DMARC: fail');
    expect(text).toContain('Return-Path'); expect(text).toContain('Replies would go'); expect(text).toContain('display name');
    expect(safeSummary(r)).not.toMatch(/@|bank\.test|evil\.test|pay-secure/);
  });
  test('not a header', () => { expect('error' in (parseHeader('hello there') as any)).toBe(true); });
});

describe('event reference', () => {
  test('entries are unique per log and id, grouped, and carry nothing sensitive', () => {
    const keys = EVENTS.map((e) => e.log + e.id); expect(new Set(keys).size).toBe(keys.length);
    for (const e of EVENTS) { expect(EVENT_GROUPS).toContain(e.group); expect(scanText(e.title + e.meaning + e.look).filter((f) => f.severity === 'block')).toEqual([]); }
    expect(EVENTS.find((e) => e.id === '4625')?.title).toBe('Failed logon');
  });
});
