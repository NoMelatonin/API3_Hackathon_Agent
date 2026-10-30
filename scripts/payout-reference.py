"""Independent 60-digit Decimal reference; amounts rounded down to dUSD micro-units."""
from decimal import Decimal as D, getcontext
from pathlib import Path
import json
getcontext().prec = 60
xs = list(range(7_000_000, 8_000_001, 1_000))
ys = [int(D(500_000_000) + D(1_500_000_000) *
          (D(10) ** (D('1.5') * (D(x) / D(1_000_000) - 7)) - 1) /
          (D(10) ** D('1.5') - 1)) for x in xs]
Path('test/fixtures/payout-reference.json').write_text(json.dumps({'x': xs, 'y': ys}))
