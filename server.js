import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ Mets ici TON vrai email
const SEC_HEADERS = {
  "User-Agent": "FCF-Screener/1.0 (contact: frem1418@gmail.com)",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

// Petite fonction utilitaire pour appeler la SEC avec retry
async function fetchSEC(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("SEC blocked request: " + url);
}

// Extrait les 7 dernières valeurs (N à N-6) pour une métrique donnée
function extractLastSeven(facts, key) {
  try {
    const arr = facts.facts["us-gaap"][key].units.USD;

    return {
      n:  arr.at(-1)?.val ?? null,
      n1: arr.at(-2)?.val ?? null,
      n2: arr.at(-3)?.val ?? null,
      n3: arr.at(-4)?.val ?? null,
      n4: arr.at(-5)?.val ?? null,
      n5: arr.at(-6)?.val ?? null,
      n6: arr.at(-7)?.val ?? null
    };
  } catch {
    return {
      n: null, n1: null, n2: null, n3: null,
      n4: null, n5: null, n6: null
    };
  }
}

// Calcule FCF = OCF - |CAPEX| sur 7 années
function computeFCF(ocf, capex) {
  return {
    n:  ocf.n  != null && capex.n  != null ? ocf.n  - Math.abs(capex.n)  : null,
    n1: ocf.n1 != null && capex.n1 != null ? ocf.n1 - Math.abs(capex.n1) : null,
    n2: ocf.n2 != null && capex.n2 != null ? ocf.n2 - Math.abs(capex.n2) : null,
    n3: ocf.n3 != null && capex.n3 != null ? ocf.n3 - Math.abs(capex.n3) : null,
    n4: ocf.n4 != null && capex.n4 != null ? ocf.n4 - Math.abs(capex.n4) : null,
    n5: ocf.n5 != null && capex.n5 != null ? ocf.n5 - Math.abs(capex.n5) : null,
    n6: ocf.n6 != null && capex.n6 != null ? ocf.n6 - Math.abs(capex.n6) : null
  };
}

// Endpoint principal : /?ticker=AAPL
app.get("/", async (req, res) => {
  try {
    const ticker = (req.query.ticker || "AAPL").toUpperCase();

    // 1) Récupérer la liste des tickers SEC
    const tickersUrl = "https://www.sec.gov/files/company_tickers.json";
    const tickers = await fetchSEC(tickersUrl);

    // 2) Trouver le CIK correspondant au ticker
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

    // 3) Récupérer les company facts (XBRL)
    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const facts = await fetchSEC(factsUrl);

    // 4) Extraire 7 années pour chaque métrique clé
    const revenue  = extractLastSeven(facts, "Revenues");
    const netIncome = extractLastSeven(facts, "NetIncomeLoss");
    const ebit     = extractLastSeven(facts, "OperatingIncomeLoss");
    const ebitda   = extractLastSeven(facts, "DepreciationDepletionAndAmortization");
    const ocf      = extractLastSeven(facts, "NetCashProvidedByUsedInOperatingActivities");
    const capex    = extractLastSeven(facts, "PaymentsToAcquirePropertyPlantAndEquipment");

    // 5) Calculer FCF sur 7 années
    const fcf = computeFCF(ocf, capex);

    // 6) Construire la réponse JSON
    res.json({
      ticker,
      cik,

      // Valeurs "courantes" (année N) pratiques pour GETMETRIC
      revenue:    revenue.n,
      netIncome:  netIncome.n,
      ebit:       ebit.n,
      ebitda:     ebitda.n,
      ocf:        ocf.n,
      capex:      capex.n,
      fcf:        fcf.n,

      // Historique Revenue (N à N-6)
      revenue_n:  revenue.n,
      revenue_n1: revenue.n1,
      revenue_n2: revenue.n2,
      revenue_n3: revenue.n3,
      revenue_n4: revenue.n4,
      revenue_n5: revenue.n5,
      revenue_n6: revenue.n6,

      // Historique Net Income
      netIncome_n:  netIncome.n,
      netIncome_n1: netIncome.n1,
      netIncome_n2: netIncome.n2,
      netIncome_n3: netIncome.n3,
      netIncome_n4: netIncome.n4,
      netIncome_n5: netIncome.n5,
      netIncome_n6: netIncome.n6,

      // Historique EBIT
      ebit_n:  ebit.n,
      ebit_n1: ebit.n1,
      ebit_n2: ebit.n2,
      ebit_n3: ebit.n3,
      ebit_n4: ebit.n4,
      ebit_n5: ebit.n5,
      ebit_n6: ebit.n6,

      // Historique EBITDA
      ebitda_n:  ebitda.n,
      ebitda_n1: ebitda.n1,
      ebitda_n2: ebitda.n2,
      ebitda_n3: ebitda.n3,
      ebitda_n4: ebitda.n4,
      ebitda_n5: ebitda.n5,
      ebitda_n6: ebitda.n6,

      // Historique OCF
      ocf_n:  ocf.n,
      ocf_n1: ocf.n1,
      ocf_n2: ocf.n2,
      ocf_n3: ocf.n3,
      ocf_n4: ocf.n4,
      ocf_n5: ocf.n5,
      ocf_n6: ocf.n6,

      // Historique CAPEX
      capex_n:  capex.n,
      capex_n1: capex.n1,
      capex_n2: capex.n2,
      capex_n3: capex.n3,
      capex_n4: capex.n4,
      capex_n5: capex.n5,
      capex_n6: capex.n6,

      // Historique FCF
      fcf_n:  fcf.n,
      fcf_n1: fcf.n1,
      fcf_n2: fcf.n2,
      fcf_n3: fcf.n3,
      fcf_n4: fcf.n4,
      fcf_n5: fcf.n5,
      fcf_n6: fcf.n6
    });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log("SEC multi-year API running on port " + PORT);
});
