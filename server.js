import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", async (req, res) => {
  try {
    const ticker = (req.query.ticker || "AAPL").toUpperCase();

    // 1. Télécharger la liste des tickers SEC
    const tickersUrl = "https://www.sec.gov/files/company_tickers.json";
    const tickers = await fetch(tickersUrl).then(r => r.json());

    let cik = null;
    for (const key in tickers) {
      if (tickers[key].ticker === ticker) {
        cik = tickers[key].cik_str.toString().padStart(10, "0");
        break;
      }
    }

app.get("/test-submissions", async (req, res) => {
  try {
    const cik = "0000320193"; // CIK de Apple

    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Host": "data.sec.gov"
      }
    });

    const text = await response.text();
    res.send(text);
  } catch (e) {
    res.send("Erreur: " + e.toString());
  }
});



    
    if (!cik) return res.json({ error: "CIK introuvable" });

    // 2. Récupérer les filings
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const filings = await fetch(submissionsUrl, {
       headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Host": "data.sec.gov"
  }

    }).then(r => r.json());

    // 3. Trouver le dernier 10-K
    let accession = null;
    for (let i = 0; i < filings.filings.recent.form.length; i++) {
      if (filings.filings.recent.form[i] === "10-K") {
        accession = filings.filings.recent.accessionNumber[i].replace(/-/g, "");
        break;
      }
    }

    if (!accession) return res.json({ error: "10-K introuvable" });

    // 4. Télécharger les faits XBRL (companyfacts)
    const xbrlUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const facts = await fetch(xbrlUrl, {
      headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Host": "data.sec.gov"
  }

    }).then(r => r.json());

    // 5. Extraire OCF et CAPEX
    const ocf =
      facts.facts?.["us-gaap"]?.["NetCashProvidedByUsedInOperatingActivities"]?.units?.USD?.at(-1)?.val;
    const capex =
      facts.facts?.["us-gaap"]?.["PaymentsToAcquirePropertyPlantAndEquipment"]?.units?.USD?.at(-1)?.val;

    if (ocf == null || capex == null) {
      return res.json({ error: "Données introuvables", ocf, capex });
    }

    const fcf = ocf - Math.abs(capex);

    res.json({
      ticker,
      ocf,
      capex,
      fcf
    });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

app.listen(PORT, () => console.log("SEC FCF API running on port " + PORT));
