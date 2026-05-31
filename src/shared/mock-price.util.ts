function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0)
}

// Replicates the frontend's generateSparklineData() walk so the backend
// operates on the same base price the UI shows as "current price".
function getFrontendCloseVal(symbol: string): number {
  const seed = symbolSeed(symbol)
  const base = 200 + (seed % 3500)
  let price = base
  for (let i = 0; i < 30; i++) {
    price += (seededRandom(seed * 7 + i * 13) - 0.47) * base * 0.015
  }
  return Math.max(10, price)
}

export function getMockPrice(symbol: string): number {
  const seed = symbolSeed(symbol)
  const closeVal = getFrontendCloseVal(symbol)
  const minuteBucket = Math.floor(Date.now() / 60_000)
  // Two overlapping cycles: slow swing (±15%) + fast jitter (±5%)
  const slowDrift = (seededRandom(seed + minuteBucket) - 0.5) * 0.30
  const fastDrift = (seededRandom(seed * 2 + minuteBucket * 3) - 0.5) * 0.10
  return parseFloat((closeVal * (1 + slowDrift + fastDrift)).toFixed(2))
}
