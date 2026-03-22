// netlify/functions/gamma-levels.js
// ═══════════════════════════════════════════════════════════════
// AGX COMMUNITY — Gamma Levels API (Netlify Serverless Function)
// Calls Massive (ex-Polygon) Option Chain Snapshot API,
// calculates GEX per strike, and returns key gamma levels.
// ═══════════════════════════════════════════════════════════════

const https = require("https");

// ── Config ──
const CONTRACT_SIZE = 100;
const RISK_FREE_RATE = 0.05;

// ── Helpers ──

// Standard normal PDF
function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes gamma
function bsGamma(S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return normPdf(d1) / (S * sigma * Math.sqrt(T));
}

// Time to expiry in years
function timeToExpiry(expirationStr) {
  const exp = new Date(expirationStr + "T16:00:00Z");
  const now = new Date();
  const days = (exp - now) / (1000 * 60 * 60 * 24);
  return Math.max(days / 365, 1 / 365);
}

// Fetch JSON from URL (returns promise)
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse API response"));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

// Format large numbers
function formatGex(val) {
  const abs = Math.abs(val);
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (val / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (val / 1e3).toFixed(1) + "K";
  return val.toFixed(0);
}

// ── Main handler ──
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Get ticker from query params (default: SPY)
    const params = event.queryStringParameters || {};
    const ticker = (params.ticker || "SPY").toUpperCase();
    const maxExpirations = parseInt(params.expirations || "4", 10);

    // API key from environment variable (set in Netlify dashboard)
    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "MASSIVE_API_KEY not configured" }),
      };
    }

    // ── Step 1: Get current price from stock snapshot ──
    const stockUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;
    const stockData = await fetchJson(stockUrl);
    
    let spotPrice = 0;
    if (stockData.results && stockData.results.length > 0) {
      spotPrice = stockData.results[0].c; // close price
    }

    // For indices like SPX, try the snapshot endpoint
    if (spotPrice === 0) {
      const snapUrl = `https://api.polygon.io/v3/snapshot?ticker.any_of=${ticker}&apiKey=${apiKey}`;
      const snapData = await fetchJson(snapUrl);
      if (snapData.results && snapData.results.length > 0) {
        spotPrice = snapData.results[0].value || snapData.results[0].session?.close || 0;
      }
    }

    // ── Step 2: Get option chain snapshot ──
    const optionsUrl = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${apiKey}`;
    const optionsData = await fetchJson(optionsUrl);

    if (!optionsData.results || optionsData.results.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No options data found for ${ticker}` }),
      };
    }

    // Use underlying price from first option result if we don't have spot
    if (spotPrice === 0 && optionsData.results[0].underlying_asset) {
      spotPrice = optionsData.results[0].underlying_asset.price;
    }

    // ── Step 3: Process option chain ──
    const contracts = [];
    const expirationSet = new Set();

    for (const opt of optionsData.results) {
      const details = opt.details || {};
      const greeks = opt.greeks || {};
      const oi = opt.open_interest || 0;

      if (oi <= 0) continue;

      expirationSet.add(details.expiration_date);

      contracts.push({
        strike: details.strike_price,
        type: details.contract_type, // "call" or "put"
        expiration: details.expiration_date,
        oi: oi,
        gamma: greeks.gamma || 0,
        iv: opt.implied_volatility || 0.3,
        delta: greeks.delta || 0,
      });
    }

    // Filter to nearest N expirations
    const sortedExps = [...expirationSet].sort();
    const selectedExps = new Set(sortedExps.slice(0, maxExpirations));
    const filtered = contracts.filter((c) => selectedExps.has(c.expiration));

    // ── Step 4: Calculate GEX per strike ──
    const gexByStrike = {};
    const callGexByStrike = {};
    const putGexByStrike = {};

    for (const c of filtered) {
      // Use API gamma if available, otherwise calculate with BS
      let gamma = c.gamma;
      if (!gamma || gamma === 0) {
        const T = timeToExpiry(c.expiration);
        gamma = bsGamma(spotPrice, c.strike, T, RISK_FREE_RATE, c.iv);
      }

      // GEX = gamma × OI × 100 × spot² × 0.01
      let gex = gamma * c.oi * CONTRACT_SIZE * spotPrice * spotPrice * 0.01;

      // Dealer perspective: long calls = positive gamma, long puts = negative gamma
      if (c.type === "put") gex *= -1;

      const strike = c.strike;
      gexByStrike[strike] = (gexByStrike[strike] || 0) + gex;

      if (c.type === "call") {
        callGexByStrike[strike] = (callGexByStrike[strike] || 0) + gex;
      } else {
        putGexByStrike[strike] = (putGexByStrike[strike] || 0) + gex;
      }
    }

    // ── Step 5: Find key levels ──
    const strikes = Object.keys(gexByStrike)
      .map(Number)
      .sort((a, b) => a - b);

    let callWall = { strike: 0, gex: 0 };
    let putWall = { strike: 0, gex: 0 };
    let maxPositive = { strike: 0, gex: 0 };
    let maxNegative = { strike: 0, gex: 0 };
    let gammaFlip = spotPrice;
    let netGex = 0;

    for (const s of strikes) {
      const g = gexByStrike[s];
      netGex += g;

      if (g > maxPositive.gex) maxPositive = { strike: s, gex: g };
      if (g < maxNegative.gex) maxNegative = { strike: s, gex: g };

      const cg = callGexByStrike[s] || 0;
      if (cg > callWall.gex) callWall = { strike: s, gex: cg };

      const pg = putGexByStrike[s] || 0;
      if (pg < putWall.gex) putWall = { strike: s, gex: pg };
    }

    // Find gamma flip (zero crossing)
    for (let i = 1; i < strikes.length; i++) {
      const g1 = gexByStrike[strikes[i - 1]];
      const g2 = gexByStrike[strikes[i]];
      if (g1 * g2 < 0) {
        // Linear interpolation
        const s1 = strikes[i - 1];
        const s2 = strikes[i];
        gammaFlip = s1 + ((0 - g1) * (s2 - s1)) / (g2 - g1);
        gammaFlip = Math.round(gammaFlip * 100) / 100;
        break;
      }
    }

    // High Vol Level (HVL) — strike nearest to spot with highest absolute GEX
    const hvlCandidates = strikes.filter(
      (s) => s >= spotPrice * 0.95 && s <= spotPrice * 1.05
    );
    let hvl = spotPrice;
    let hvlMaxGex = 0;
    for (const s of hvlCandidates) {
      if (Math.abs(gexByStrike[s]) > hvlMaxGex) {
        hvlMaxGex = Math.abs(gexByStrike[s]);
        hvl = s;
      }
    }

    // ── Step 6: Build GEX distribution for chart ──
    // Filter to strikes within ±10% of spot for chart readability
    const chartStrikes = strikes.filter(
      (s) => s >= spotPrice * 0.9 && s <= spotPrice * 1.1
    );

    const distribution = chartStrikes.map((s) => ({
      strike: s,
      gex: Math.round(gexByStrike[s]),
      callGex: Math.round(callGexByStrike[s] || 0),
      putGex: Math.round(putGexByStrike[s] || 0),
    }));

    // ── Step 7: Regime detection ──
    const gammaRegime = spotPrice > gammaFlip ? "POSITIVE" : "NEGATIVE";
    const volRegime = spotPrice > hvl ? "LOW_VOL" : "HIGH_VOL";

    // ── Response ──
    const result = {
      ticker,
      spotPrice: Math.round(spotPrice * 100) / 100,
      timestamp: new Date().toISOString(),
      expirations: [...selectedExps],
      contractCount: filtered.length,
      netGex: Math.round(netGex),
      netGexFormatted: formatGex(netGex),
      gammaRegime,
      volRegime,
      levels: {
        zeroGamma: {
          strike: gammaFlip,
          label: "Zero Gamma (0GEX)",
          description: "Gamma flip zone — volatility regime change",
        },
        maxPositive: {
          strike: maxPositive.strike,
          gex: Math.round(maxPositive.gex),
          gexFormatted: formatGex(maxPositive.gex),
          label: "Max Positive Gamma",
          description: "Strong support — dealer hedging pins price",
        },
        maxNegative: {
          strike: maxNegative.strike,
          gex: Math.round(maxNegative.gex),
          gexFormatted: formatGex(maxNegative.gex),
          label: "Max Negative Gamma",
          description: "Amplified moves — dealers accelerate trend",
        },
        callWall: {
          strike: callWall.strike,
          gex: Math.round(callWall.gex),
          gexFormatted: formatGex(callWall.gex),
          label: "Call Wall",
          description: "Resistance — highest call OI gamma concentration",
        },
        putWall: {
          strike: putWall.strike,
          gex: Math.round(putWall.gex),
          gexFormatted: formatGex(putWall.gex),
          label: "Put Wall",
          description: "Support — highest put OI gamma concentration",
        },
        hvl: {
          strike: hvl,
          label: "High Vol Level (HVL)",
          description: "Above = low vol regime, Below = high vol regime",
        },
      },
      distribution,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Gamma levels error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to calculate gamma levels",
        details: err.message,
      }),
    };
  }
};
