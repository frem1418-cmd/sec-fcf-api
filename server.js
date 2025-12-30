import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// Headers obligatoires pour la SEC
const SEC_HEADERS = {
  "User-Agent": "FCF-Screener (contact: frem1418@gmail.com",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

// Fonction utilitaire pour fetch SEC avec retry
async function fetchSEC(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("SEC blocked request: " + url);
}

// Route principale : /?ticker=AAPL
app.get("/", async (req, res) => {
  try {
    const ticker = (req.query.ticker || "AAPL").toUpperCase();

    // 1. Télécharger la liste des tickers SEC
    const tickersUrl = "https://www.sec.gov/files/company_tickers.json";
    const tickers = await fetchSEC(tickersUrl);

    // Trouver le CIK
    let cik = null;
    for (const key in tickers) {
      if (tickers[key].ticker === ticker) {
        cik = tickers[key].cik_str.toString().padStart(10, "0");
        break;
      }
    }

    if (!cik) {
      return res.json({ error: "CIK introuvable pour " + ticker });
    }

    // 2. Télécharger les company facts (XBRL)
    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const facts = await fetchSEC(factsUrl);

    // 3. Extraire OCF et CAPEX
    const ocf =
      facts.facts?.["us-gaap"]?.["NetCashProvidedByUsedInOperatingActivities"]?.units?.USD?.at(-1)?.val;

    const capex =
      facts.facts?.["us-gaap"]?.["PaymentsToAcquirePropertyPlantAndEquipment"]?.units?.USD?.at(-1)?.val;

    if (ocf == null || capex == null) {
      return res.json({
        error: "Impossible d'extraire OCF ou CAPEX",
        ocf,
        capex
      });
    }

    const fcf = ocf - Math.abs(capex);

    // 4. Réponse JSON propre
    res.json({
      ticker,
      cik,
      ocf,
      capex,
      fcf
    });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

// Lancer le serveur
app.listen(PORT, () =>
  console.log("SEC FCF API running on port " + PORT)
);
