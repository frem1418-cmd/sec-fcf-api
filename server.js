import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// Headers SEC obligatoires
const SEC_HEADERS = {
  "User-Agent": "FCF-Screener/1.0 (contact: frem1418@gmail.com)",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

// Fonction fetch avec retry
async function fetchSEC(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("SEC blocked request: " + url);
}

app.get("/", async (req, res) => {
  try {
    const ticker = (req.query.ticker || "AAPL").toUpperCase();

    // 1. Télécharger la liste des tickers
    const tickers = await fetchSEC("https://www.sec.gov/files/company_tickers.json");

    let cik = null;
    for (const key in tickers) {
      if (tickers[key].ticker === ticker) {
        cik = tickers[key].cik_str.toString().padStart(10, "0");
        break;
      }
    }

    if (!cik) return res.json({ error: "CIK introuvable" });

    // 2. Télécharger les company facts
    const facts = await fetchSEC(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);

    function extract(path) {
      try {
        return facts.facts["us-gaap"][path].units.USD.at(-1).val;
      } catch {
        return null;
      }
    }

    // 3. Extraire les métriques
    const revenue = extract("Revenues");
    const netIncome = extract("NetIncomeLoss");
    const ebit = extract("OperatingIncomeLoss");
    const ebitda = extract("OperatingIncomeLoss") + extract("DepreciationDepletionAndAmortization");
    const ocf = extract("NetCashProvidedByUsedInOperatingActivities");
    const capex = extract("PaymentsToAcquirePropertyPlantAndEquipment");
    const fcf = ocf != null && capex != null ? ocf - Math.abs(capex) : null;

    // 4. Réponse JSON propre
    res.json({
      ticker,
      cik,
      revenue,
      netIncome,
      ebit,
      ebitda,
      ocf,
      capex,
      fcf
    });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

app.listen(PORT, () =>
  console.log("SEC API running on port " + PORT)
);
