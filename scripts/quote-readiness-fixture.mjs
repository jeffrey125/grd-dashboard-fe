import { setTimeout } from 'node:timers/promises';

const pending = new Map();

export function releaseReadinessQuote(key) {
  const release = pending.get(key);
  if (!release) return false;
  release();
  return true;
}

async function waitForRelease(key, signal) {
  signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    const abort = () => {
      pending.delete(key);
      reject(signal.reason);
    };
    pending.set(key, () => {
      pending.delete(key);
      signal.removeEventListener('abort', abort);
      resolve();
    });
    signal.addEventListener('abort', abort, { once: true });
  });
}

// External provider substitute for full-stack acceptance. Never reads credentials.
export function readinessQuoteAdapter(code) {
  return {
    simulated: true,
    relogin: async () => {},
    close: async () => {},
    quote: async (job, signal) => {
      const international = job.input.destination.country !== 'US';
      if (code === 'unishippers' && !international)
        await waitForRelease(job.input.idempotencyKey, signal);
      else await setTimeout(1500, undefined, { signal });
      return {
        outcome: 'success',
        reason: null,
        simulated: true,
        relogins: 0,
        quotes: [
          {
            carrier: 'Fixture carrier',
            service: 'Fixture ground',
            total: international ? '45.000000' : code === 'amazon' ? '39.620000' : '35.000000',
            currency: international ? 'CAD' : 'USD',
            estimateMethod: code === 'amazon' ? 'calculated' : 'native',
            optionCoverage: 'unverified',
            dutyStatus: 'unknown',
            taxStatus: 'unknown',
            clearanceStatus: 'unknown',
            groupContributions:
              code === 'amazon'
                ? [
                    { packageGroupPosition: 0, quantity: 2, subtotal: '27.620000' },
                    { packageGroupPosition: 1, quantity: 1, subtotal: '12.000000' },
                  ]
                : [],
          },
        ],
      };
    },
  };
}
