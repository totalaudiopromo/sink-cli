/**
 * Email validation engine
 *
 * Wraps deep-email-validator with music-industry extras:
 * - Configurable domain typo correction
 * - Role-based email detection (press@, info@, etc.)
 * - Catch-all domain flagging
 * - MX cache layer (configurable TTL)
 * - Domain-grouped batch validation for efficiency
 * - Two modes: batch (no SMTP) and single (full SMTP check)
 */

import { validate } from 'deep-email-validator';
import { MxCache } from '../../utils/mx-cache.js';
import { correctDomain } from './typo-map.js';
import type { ScrubResult } from '../../types.js';

type EmailResult = ScrubResult['email'];

const DEFAULT_ROLE_PREFIXES = [
  'info',
  'admin',
  'support',
  'contact',
  'hello',
  'enquiries',
  'press',
  'music',
  'submissions',
  'playlist',
  'programming',
  'studio',
  'news',
  'editorial',
  'general',
  'office',
  'reception',
];

const DEFAULT_MUSIC_TLDS = [
  '.org.uk',
  '.org.au',
  '.co.uk',
  '.co.nz',
  '.co.za',
  '.ac.uk',
  '.fm',
  '.radio',
  '.media',
  '.press',
  '.music',
  '.band',
  '.community',
  '.org',
];

const DEFAULT_CATCH_ALL = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'bbc.co.uk',
  'aol.com',
  'protonmail.com',
  'hotmail.co.uk',
  'yahoo.co.uk',
  'live.co.uk',
  'btinternet.com',
];

export interface ValidateConfig {
  smtp?: boolean;
  smtpTimeout?: number;
  rolePrefixes?: string[];
  catchAllDomains?: string[];
  musicTLDs?: string[];
  mxCacheTTL?: number;
  onProgress?: (email: string, result: EmailResult, index: number, total: number) => void;
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowlistedTLD(domain: string, musicTLDs: string[]): boolean {
  return musicTLDs.some(tld => domain.endsWith(tld));
}

async function probeBlanketReject(domain: string, smtpTimeout: number): Promise<boolean> {
  const fakeLocal = `sink-probe-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const fakeEmail = `${fakeLocal}@${domain}`;

  try {
    const result = await Promise.race([
      validate({
        email: fakeEmail,
        sender: fakeEmail,
        validateRegex: true,
        validateMx: true,
        validateTypo: false,
        validateDisposable: false,
        validateSMTP: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('smtp_timeout')), smtpTimeout)
      ),
    ]);

    const smtpOk = result.validators.smtp?.valid ?? undefined;
    return smtpOk === false;
  } catch {
    return false;
  }
}

export async function validateEmail(
  email: string,
  config: ValidateConfig & { mxCache: MxCache }
): Promise<EmailResult> {
  const {
    smtp = false,
    smtpTimeout = 10_000,
    mxCache,
  } = config;
  const rolePrefixes = new Set(config.rolePrefixes ?? DEFAULT_ROLE_PREFIXES);
  const musicTLDs = config.musicTLDs ?? DEFAULT_MUSIC_TLDS;
  const catchAllDomains = new Set(config.catchAllDomains ?? DEFAULT_CATCH_ALL);

  const mode = smtp ? 'single' : 'batch';
  const normalised = email.toLowerCase().trim();

  const atIndex = normalised.indexOf('@');
  if (atIndex === -1) {
    return { valid: false, normalised, reason: 'invalid_format', confidence: 'none' };
  }

  const localPart = normalised.slice(0, atIndex);
  let domain = normalised.slice(atIndex + 1);
  let workingEmail = normalised;
  let corrected = false;
  let original: string | undefined;
  let suggested: string | undefined;

  // Domain typo correction
  const typoResult = correctDomain(localPart, domain);
  if (typoResult) {
    original = normalised;
    suggested = typoResult.correctedEmail;
    workingEmail = typoResult.correctedEmail;
    domain = typoResult.correctedDomain;
    corrected = true;
  }

  // Format check
  if (!isValidEmailFormat(workingEmail)) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'invalid_format',
      confidence: 'none',
      corrected: corrected || undefined,
      original,
      suggested,
    };
  }

  const cachedMxResult = mxCache.get(domain);
  const cachedMx = cachedMxResult?.hasMx ?? null;
  const cachedBlanketReject = cachedMxResult?.blanketReject;

  // If domain is a known blanket rejector, skip SMTP and return medium confidence
  if (mode === 'single' && cachedBlanketReject === true) {
    let deepResult: Awaited<ReturnType<typeof validate>>;
    try {
      deepResult = await validate({
        email: workingEmail,
        sender: workingEmail,
        validateRegex: true,
        validateMx: cachedMx === null,
        validateTypo: true,
        validateDisposable: true,
        validateSMTP: false,
      });
    } catch {
      return {
        valid: true,
        normalised: workingEmail,
        confidence: 'medium',
        corrected: corrected || undefined,
        original,
        suggested,
      };
    }

    const validators = deepResult.validators;
    const regexOk = validators.regex?.valid ?? true;
    const disposableOk = validators.disposable?.valid ?? true;
    const mxOk = cachedMx !== null ? cachedMx : (validators.mx?.valid ?? false);

    if (!regexOk || (!disposableOk && !isAllowlistedTLD(domain, musicTLDs)) || !mxOk) {
      const reason = !regexOk ? 'invalid_format' : !mxOk ? 'no_mx_record' : 'disposable_domain';
      return {
        valid: false,
        normalised: workingEmail,
        reason: reason as EmailResult['reason'],
        confidence: 'low',
        corrected: corrected || undefined,
        original,
        suggested,
      };
    }

    const isRoleBased = rolePrefixes.has(localPart);
    return {
      valid: true,
      normalised: workingEmail,
      confidence: 'medium',
      roleBased: isRoleBased || undefined,
      corrected: corrected || undefined,
      original,
      suggested,
      checks: {
        regex: true,
        typo: validators.typo?.valid ?? true,
        disposable: disposableOk,
        mx: mxOk,
      },
    };
  }

  let deepResult: Awaited<ReturnType<typeof validate>>;
  try {
    const validationPromise = validate({
      email: workingEmail,
      sender: workingEmail,
      validateRegex: true,
      validateMx: cachedMx === null,
      validateTypo: true,
      validateDisposable: true,
      validateSMTP: mode === 'single',
    });

    deepResult = await Promise.race([
      validationPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('smtp_timeout')), smtpTimeout)
      ),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message === 'smtp_timeout') {
      return {
        valid: true,
        normalised: workingEmail,
        confidence: 'medium',
        corrected: corrected || undefined,
        original,
        suggested,
        checks: { regex: true, typo: true, disposable: true, mx: cachedMx ?? true },
      };
    }
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'no_mx_record',
      confidence: 'low',
      corrected: corrected || undefined,
      original,
      suggested,
    };
  }

  const validators = deepResult.validators;
  const regexOk = validators.regex?.valid ?? true;
  const typoOk = validators.typo?.valid ?? true;
  const disposableOk = validators.disposable?.valid ?? true;
  const mxOk = cachedMx !== null ? cachedMx : (validators.mx?.valid ?? false);
  const smtpOk = mode === 'single' ? (validators.smtp?.valid ?? undefined) : undefined;

  if (cachedMxResult === null) {
    mxCache.set(domain, mxOk);
  }

  if (!regexOk) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'invalid_format',
      confidence: 'none',
      corrected: corrected || undefined,
      original,
      suggested,
      checks: { regex: false, typo: typoOk, disposable: disposableOk, mx: mxOk },
    };
  }

  if (!disposableOk && !isAllowlistedTLD(domain, musicTLDs)) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'disposable_domain',
      confidence: 'low',
      disposable: true,
      corrected: corrected || undefined,
      original,
      suggested,
      checks: { regex: regexOk, typo: typoOk, disposable: false, mx: mxOk },
    };
  }

  if (mode === 'single' && smtpOk === false) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'smtp_rejected',
      confidence: 'low',
      smtpVerified: false,
      corrected: corrected || undefined,
      original,
      suggested,
      checks: {
        regex: regexOk,
        typo: typoOk,
        disposable: disposableOk,
        mx: mxOk,
        smtp: false,
      },
    };
  }

  if (!mxOk) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'no_mx_record',
      confidence: 'low',
      corrected: corrected || undefined,
      original,
      suggested,
      checks: { regex: regexOk, typo: typoOk, disposable: disposableOk, mx: false },
    };
  }

  const isRoleBased = rolePrefixes.has(localPart);
  const isCatchAll = catchAllDomains.has(domain);

  let confidence: EmailResult['confidence'];
  if (isRoleBased || isCatchAll) {
    confidence = 'medium';
  } else if (mode === 'single' && smtpOk === true) {
    confidence = 'high';
  } else if (mode === 'batch') {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }

  return {
    valid: true,
    normalised: workingEmail,
    confidence,
    corrected: corrected || undefined,
    original,
    suggested,
    catchAll: isCatchAll || undefined,
    roleBased: isRoleBased || undefined,
    disposable: false,
    smtpVerified: mode === 'single' ? (smtpOk ?? undefined) : undefined,
    checks: {
      regex: regexOk,
      typo: typoOk,
      disposable: disposableOk,
      mx: mxOk,
      smtp: smtpOk,
    },
  };
}

/**
 * Validate a batch of emails efficiently.
 * Groups emails by domain for MX cache efficiency.
 */
export async function validateEmailBatch(
  emails: string[],
  config: ValidateConfig = {}
): Promise<Map<string, EmailResult>> {
  const {
    smtp = false,
    smtpTimeout = 10_000,
    onProgress,
  } = config;
  const concurrency = 10;
  const mxCache = new MxCache(config.mxCacheTTL);
  const results = new Map<string, EmailResult>();
  let completed = 0;

  const catchAllDomains = new Set(config.catchAllDomains ?? DEFAULT_CATCH_ALL);

  // Group by domain
  const byDomain = new Map<string, string[]>();
  for (const email of emails) {
    const normalised = email.toLowerCase().trim();
    const atIndex = normalised.indexOf('@');
    if (atIndex === -1) {
      const bucket = byDomain.get('') ?? [];
      bucket.push(email);
      byDomain.set('', bucket);
      continue;
    }
    let domain = normalised.slice(atIndex + 1);
    const localPart = normalised.slice(0, atIndex);
    const typo = correctDomain(localPart, domain);
    if (typo) domain = typo.correctedDomain;

    const bucket = byDomain.get(domain) ?? [];
    bucket.push(email);
    byDomain.set(domain, bucket);
  }

  // Blanket-reject pre-pass when SMTP is enabled
  if (smtp) {
    const domainsToProbe = [...byDomain.keys()].filter(d => {
      if (!d) return false;
      if (catchAllDomains.has(d)) return false;
      const cached = mxCache.get(d);
      if (cached !== null && cached.blanketReject !== undefined) return false;
      return true;
    });

    const probeQueue = [...domainsToProbe];
    async function probeNext(): Promise<void> {
      while (probeQueue.length > 0) {
        const domain = probeQueue.shift()!;
        const isBlanketReject = await probeBlanketReject(domain, smtpTimeout);
        if (isBlanketReject) {
          const existing = mxCache.get(domain);
          mxCache.set(domain, existing?.hasMx ?? true, true);
        } else {
          const existing = mxCache.get(domain);
          if (existing) {
            mxCache.set(domain, existing.hasMx, false);
          }
        }
      }
    }

    const probeWorkers = Array.from({ length: Math.min(5, domainsToProbe.length) }, () =>
      probeNext()
    );
    await Promise.allSettled(probeWorkers);
  }

  // Process first email per domain, then remainder (for cache priming)
  const firstPerDomain: string[] = [];
  const remainder: string[] = [];
  for (const bucket of byDomain.values()) {
    const [first, ...rest] = bucket;
    firstPerDomain.push(first);
    remainder.push(...rest);
  }

  const ordered = [...firstPerDomain, ...remainder];
  const queue = [...ordered];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const email = queue.shift()!;
      const result = await validateEmail(email, { ...config, mxCache });
      results.set(email, result);
      completed++;
      onProgress?.(email, result, completed, ordered.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, () =>
    processNext()
  );
  await Promise.allSettled(workers);

  return results;
}
