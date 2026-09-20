import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../backend/gas/Core.js', import.meta.url), 'utf8');
const context = { Intl, Date, Math, JSON, Number, String, Boolean, Array, Object, RegExp };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Core.js' });

const core = context.NitiCore;
assert.ok(core, 'NitiCore must be available');

assert.equal(core.thai(Date.UTC(2026, 8, 19, 18)), '2026-09-20 01:00:00');

assert.throws(
  () => core.normalize([{ timestamp: (Date.UTC(2026, 8, 19, 12) + 600000) / 1000, open: 1, high: 2, low: 1, close: 2 }], 'UTC', 300000, Date.UTC(2026, 8, 19, 12)),
  /อนาคต/
);

const ambiguous = core.paper(
  { status: 'PENDING', side: 'BUY_LIMIT', entry: 100, sl: 95, tp: 110, createdAt: Date.UTC(2026, 8, 19, 12), expiresAt: Date.UTC(2026, 8, 19, 14), spread: 0.4, slippage: 0.1 },
  [{ t: Date.UTC(2026, 8, 19, 12), o: 105, h: 111, l: 99, c: 106 }],
  300000,
  Date.UTC(2026, 8, 19, 12, 10)
);
assert.equal(ambiguous.plan.status, 'AMBIGUOUS');

const closedStart = Date.UTC(2026, 8, 20, 17, 0);
const scheduledGap = core.paper(
  { status: 'PENDING', side: 'BUY_LIMIT', entry: 100, sl: 95, tp: 110, createdAt: closedStart, expiresAt: closedStart + 3600000, spread: 0.4, slippage: 0.1, lastChecked: closedStart },
  [
    { t: closedStart + 15 * 60000, o: 105, h: 106, l: 104, c: 105 },
  ],
  300000,
  closedStart + 20 * 60000,
  { isMarketClosedAt: (time) => time < closedStart + 15 * 60000 }
);
assert.equal(scheduledGap.plan.status, 'PENDING', 'scheduled market gaps should not become ambiguous');

const expiredDuringClosure = core.paper(
  { status: 'PENDING', side: 'BUY_LIMIT', entry: 100, sl: 95, tp: 110, createdAt: closedStart, expiresAt: closedStart + 30 * 60000, spread: 0.4, slippage: 0.1, lastChecked: closedStart },
  [],
  300000,
  closedStart + 45 * 60000,
  { isMarketClosedAt: () => true }
);
assert.equal(expiredDuringClosure.plan.status, 'EXPIRED', 'plans must expire even when no new bar arrives during closure');

const candidateAudit = core.candidates(
  Array.from({ length: 80 }, (_, index) => ({ t: index * 900000, o: 100 + (index % 4), h: 103 + (index % 4), l: 97 + (index % 4), c: 100 + (index % 4) })),
  100,
  { tick: 0.01, spread: 0.05, slippage: 0.02, minRR: 1.2, minScore: 60, expiryHours: 6 },
  80 * 900000
);
assert.ok(candidateAudit.candidateAudit, 'candidate rejection audit must be present');
assert.equal(candidateAudit.candidateAudit.zonesFound, candidateAudit.zones.length);

const stats = core.stats([
  { status: 'TP', resultR: 2, closedAt: 2 },
  { status: 'SL', resultR: -1, closedAt: 3 },
]);
assert.equal(stats.resolved, 2);
assert.equal(stats.netR, 1);
assert.equal(stats.wins, 1);

console.log('Core tests passed');
