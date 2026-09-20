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

const stats = core.stats([
  { status: 'TP', resultR: 2, closedAt: 2 },
  { status: 'SL', resultR: -1, closedAt: 3 },
]);
assert.equal(stats.resolved, 2);
assert.equal(stats.netR, 1);
assert.equal(stats.wins, 1);

console.log('Core tests passed');
