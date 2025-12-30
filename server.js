import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const SEC_HEADERS = {
  "User-Agent": "FCF-Screener/1.0 (contact: ton-email@domaine.com)",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

async function fetchSEC(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("SEC blocked request: " + url);
}

function extractLastTwo(facts, key) {
  try {
    const arr = facts.facts["us-gaap"][key].units.USD;
    const n = arr.at(-1)?.val ?? null;
    const n1 = arr.at(-2)?.val ?? null;
    return { n, n1 };
  } catch {
    return { n: null, n1: null };
  }
}

app.get("/", async (req, res) => {
  try {
    const ticker = (req.query.ticker || "AAPL").toUpperCase();

    const tickers = await fetchSEC("https://www.sec.gov/files/company_tickers.json");

    let cik = null;
    for (const key in tickers) {
      if (tickers[key].ticker === ticker) {
        cik = tickers[key].cik_str.toString().padStart(10, "0");
        break;
      }
    }

    if (!cik) return res.json({ error: "CIK introuvable" });

    const facts = await fetchSEC(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);

    const revenue = extractLastTwo(facts, "Revenues");
    const netIncome = extractLastTwo(facts, "NetIncomeLoss");
    const ebit = extractLastTwo(facts, "OperatingIncomeLoss");
    const ebitda = extractLastTwo(facts, "DepreciationDepletionAndAmortization");
    const ocf = extractLastTwo(facts, "NetCashProvidedByUsedInOperatingActivities");
    const capex = extractLastTwo(facts, "PaymentsToAcquirePropertyPlantAndEquipment");

    const fcf_n = ocf.n != null && capex.n != null ? ocf.n - Math.abs(capex.n) : null;
    const fcf_n1 = ocf.n1 != null && capex.n1 != null ? ocf.n1 - Math.abs(capex.n1) : null;

    res.json({
      ticker,
      cik,

      revenue_n: revenue.n,
      revenue_n1: revenue.n1,

      netIncome_n: netIncome.n,
      netIncome_n1: netIncome.n1,

      ebit_n: ebit.n,
      ebit_n1: ebit.n1,

      ebitda_n: ebitda.n,
      ebitda_n1: ebitda.n1,

      ocf_n: ocf.n,
      ocf_n1: ocf.n1,

      capex_n: capex.n,
      capex_n1: capex.n1,

      fcf_n,
      fcf_n1
    });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

app.listen(PORT, () => console.log("SEC API running"));
