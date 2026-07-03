<div align="center">

# Adaptive AI + ML Anomaly Detector

### A static Vercel website for browser-based anomaly detection

![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![JavaScript](https://img.shields.io/badge/Logic-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111)
![Plotly](https://img.shields.io/badge/Charts-Plotly-3F4F75?style=for-the-badge)
![Static](https://img.shields.io/badge/Type-Static%20Site-16A34A?style=for-the-badge)

</div>

---

## Overview

**Adaptive AI + ML Anomaly Detector** is a browser-based anomaly detection website for PMAY and generic tabular datasets. The app opens with an upload-first interface, reads the selected dataset directly in the browser, detects usable numeric and categorical columns, scores unusual records, and presents results through animated charts and a highest-risk table.

This version is intentionally **static-only** for stable Vercel hosting. There is no Python backend, no serverless API, and no framework runtime to misroute. Everything runs in the user’s browser.

---

## Highlights

- Upload-first professional homepage
- Works as a static Vercel deployment
- Runs anomaly analysis directly in the browser
- Supports CSV, TXT, XLS, and XLSX files
- Automatically identifies numeric feature columns
- Automatically identifies categorical grouping columns
- Avoids obvious ID-like columns such as codes, IDs, phone numbers, and PIN-style fields
- Detects PMAY-style datasets and labels them as PMAY mode
- Animated anomaly scatter graph
- Risk distribution chart
- Group anomaly chart
- Highest-risk records table
- Downloadable CSV result output

---

## How The Analysis Works

The app profiles each uploaded dataset and adapts to the available columns:

```text
Uploaded dataset
      |
      v
Browser file parser
      |
      v
Column profiler
      |
      v
Robust anomaly scoring
      |
      v
Risk labels + charts + result table
```

The anomaly score is based on robust distance from typical values using median and interquartile range. This keeps the model lightweight enough to run inside the browser while still identifying records that differ strongly from the rest of the dataset.

---

## PMAY Intelligence

When PMAY-like fields are present, the app switches into PMAY-labeled mode and highlights scheme-relevant patterns such as:

- Unusual house completion values
- Large deviations in investment or assistance values
- Extreme numeric records compared with the rest of the dataset
- Missing or suspicious numeric values

---

## Generic Dataset Intelligence

For non-PMAY datasets, the app works as a general anomaly detector. It can be used for:

- Public datasets
- Finance reports
- Survey datasets
- Operations data
- Administrative data
- Performance dashboards
- College AI/ML project demonstrations

---

## Technology

| Layer | Technology |
|---|---|
| Hosting | Vercel static site |
| UI | HTML, CSS |
| Logic | JavaScript |
| Charts | Plotly.js |
| Excel parsing | SheetJS |
| Deployment files | `index.html`, `static/`, `public/`, `vercel.json` |

---

## Repository Structure

```text
.
├── index.html
├── static/
│   ├── app.js
│   └── styles.css
├── public/
│   ├── index.html
│   └── static/
│       ├── app.js
│       └── styles.css
├── vercel.json
├── .vercelignore
├── .gitignore
└── README.md
```

---

## Deployment Notes

This project is designed to deploy as a pure static website on Vercel.

- The homepage is `index.html`
- Static assets live in `static/` and `public/static/`
- `vercel.json` routes all paths back to the homepage
- Dataset files are not bundled into the deployment
- Uploaded files stay in the browser during analysis

---

## Suggested Repository Details

**Repository name**

```text
adaptive-anomaly-detector
```

**Description**

```text
Static Vercel anomaly detection website for PMAY and generic tabular datasets.
```

**Topics**

```text
anomaly-detection
machine-learning
vercel
javascript
data-dashboard
pmay
government-data
plotly
static-site
```

---

## Important Note

An anomaly is not proof of fraud, corruption, or error. It means a record is statistically unusual compared with the rest of the uploaded dataset and should be reviewed by a human analyst.

