const fileInput = document.querySelector("#fileInput");
const analyzeBtn = document.querySelector("#analyzeBtn");
const statusBox = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");
const riskFilter = document.querySelector("#riskFilter");
const groupSelect = document.querySelector("#groupSelect");
const xAxis = document.querySelector("#xAxis");
const yAxis = document.querySelector("#yAxis");
const downloadBtn = document.querySelector("#downloadBtn");

let currentData = null;
let filteredRows = [];

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden", "error");
  if (isError) statusBox.classList.add("error");
}

function numberFormat(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function percentFormat(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => String(item).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => String(item).trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("The file needs headers and at least one data row.");
  const headers = rows[0].map((header, index) => String(header || `Column ${index + 1}`).trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function readUploadedFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls"].includes(ext)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
  if (["csv", "txt"].includes(ext)) {
    return parseCsv(await file.text());
  }
  throw new Error("Upload a CSV, TXT, XLSX, or XLS file.");
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "").replaceAll(",", "").replace("%", "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  const numeric = [];
  const categorical = [];
  const rowCount = Math.max(rows.length, 1);
  for (const column of columns) {
    const values = rows.map((row) => row[column]);
    const numbers = values.map(toNumber);
    const numericRatio = numbers.filter((value) => value !== null).length / rowCount;
    const unique = new Set(values.filter((value) => String(value).trim() !== "").map(String));
    const tokens = new Set(normalizeName(column).split(" "));
    const idLike = ["id", "code", "pin", "phone", "mobile", "aadhaar"].some((token) => tokens.has(token));
    if (numericRatio >= 0.65 && unique.size > 1 && !idLike) numeric.push(column);
    else if (unique.size > 1 && unique.size <= Math.min(80, Math.max(8, rowCount * 0.35))) categorical.push(column);
  }
  if (numeric.length < 2) throw new Error("This dataset needs at least two usable numeric columns.");
  return { numeric, categorical };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function riskLevel(score, rules) {
  if (rules >= 2 || score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function isPmay(columns) {
  const joined = columns.map(normalizeName).join(" | ");
  return ["houses sanction", "houses complete", "amount release"].some((term) => joined.includes(term));
}

function analyseRows(rawRows) {
  if (rawRows.length < 5) throw new Error("The dataset needs at least 5 rows.");
  const { numeric, categorical } = inferColumns(rawRows);
  const matrix = rawRows.map((row) => numeric.map((column) => toNumber(row[column]) ?? 0));
  const medians = numeric.map((_, index) => median(matrix.map((row) => row[index])));
  const iqrs = numeric.map((_, index) => {
    const values = matrix.map((row) => row[index]);
    return quantile(values, 0.75) - quantile(values, 0.25) || 1;
  });
  const rawScores = matrix.map((row) => row.reduce((sum, value, index) => sum + Math.abs((value - medians[index]) / iqrs[index]), 0) / numeric.length);
  const minScore = Math.min(...rawScores);
  const maxScore = Math.max(...rawScores);
  const threshold = quantile(rawScores, 0.92);
  const pmayMode = isPmay(Object.keys(rawRows[0]));

  const rows = rawRows.map((row, index) => {
    const score = maxScore === minScore ? 0 : 100 * (rawScores[index] - minScore) / (maxScore - minScore);
    const reasons = [];
    const missing = Object.values(row).filter((value) => String(value ?? "").trim() === "").length;
    if (missing >= Math.max(2, Object.keys(row).length * 0.25)) reasons.push("many_missing_values");
    for (const column of numeric) {
      const value = toNumber(row[column]);
      if (value !== null && value < 0) reasons.push("negative_numeric_value");
    }
    if (rawScores[index] >= threshold) reasons.push("statistical_outlier");
    return {
      ...row,
      _label: categorical.length ? String(row[categorical[0]] ?? `Record ${index + 1}`) : `Record ${index + 1}`,
      anomaly_score: Number(score.toFixed(2)),
      is_anomaly: rawScores[index] >= threshold || reasons.length > 0 ? 1 : 0,
      rule_reasons: reasons.length ? [...new Set(reasons)].join(", ") : "Normal range",
      risk_level: riskLevel(score, reasons.length),
    };
  }).sort((a, b) => b.anomaly_score - a.anomaly_score);

  const displayColumns = ["_label", "risk_level", "anomaly_score", "rule_reasons", ...categorical.slice(0, 4), ...numeric.slice(0, 8)]
    .filter((column, index, array) => array.indexOf(column) === index);
  return {
    dataset_type: pmayMode ? "PMAY" : "Generic",
    model_name: "Browser Robust ML",
    row_count: rows.length,
    anomaly_count: rows.filter((row) => row.is_anomaly === 1).length,
    numeric_columns: numeric,
    categorical_columns: categorical,
    display_columns: displayColumns,
    rows: rows.slice(0, 500),
  };
}

function fillSelect(select, values, fallbackIndex = 0) {
  select.innerHTML = "";
  values.forEach((value, index) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (index === fallbackIndex) option.selected = true;
    select.appendChild(option);
  });
}

function filtered() {
  const risk = riskFilter.value;
  filteredRows = currentData.rows.filter((row) => risk === "All" || row.risk_level === risk);
  return filteredRows;
}

function updateMetrics(rows) {
  const anomalies = rows.filter((row) => row.is_anomaly === 1).length;
  document.querySelector("#rowsMetric").textContent = numberFormat(rows.length);
  document.querySelector("#anomalyMetric").textContent = numberFormat(anomalies);
  document.querySelector("#rateMetric").textContent = percentFormat(rows.length ? anomalies / rows.length : 0);
  document.querySelector("#modelMetric").textContent = currentData.model_name;
  document.querySelector("#pulseTitle").textContent = `${numberFormat(anomalies)} anomalous records detected`;
}

function drawScatter(rows) {
  const x = xAxis.value;
  const y = yAxis.value;
  const topRows = rows.slice(0, 350);
  const frames = [25, 50, 75, 100].map((threshold) => ({
    name: `Score <= ${threshold}`,
    data: [{
      x: topRows.map((row) => toNumber(row[x]) ?? 0),
      y: topRows.map((row) => toNumber(row[y]) ?? 0),
      text: topRows.map((row) => row._label || ""),
      mode: "markers",
      marker: {
        size: topRows.map((row) => (row.anomaly_score <= threshold ? Math.max(8, row.anomaly_score / 4) : 5)),
        color: topRows.map((row) => (row.is_anomaly === 1 ? "#dc2626" : "#2563eb")),
        opacity: topRows.map((row) => (row.anomaly_score <= threshold ? 0.9 : 0.25)),
      },
      customdata: topRows.map((row) => [row.anomaly_score, row.risk_level, row.rule_reasons]),
      hovertemplate: `<b>%{text}</b><br>${x}: %{x}<br>${y}: %{y}<br>Score: %{customdata[0]:.2f}<br>Risk: %{customdata[1]}<br>Reason: %{customdata[2]}<extra></extra>`,
    }],
  }));
  Plotly.react("scatterChart", frames[frames.length - 1].data, {
    template: "plotly_white",
    margin: { t: 20, r: 20, b: 50, l: 60 },
    xaxis: { title: x },
    yaxis: { title: y },
    updatemenus: [{ type: "buttons", showactive: false, x: 0, y: 1.12, buttons: [{ label: "Play anomaly animation", method: "animate", args: [null, { frame: { duration: 650, redraw: true }, transition: { duration: 280 }, fromcurrent: true }] }] }],
    sliders: [{ steps: frames.map((frame) => ({ label: frame.name, method: "animate", args: [[frame.name], { mode: "immediate", frame: { duration: 300, redraw: true }, transition: { duration: 200 } }] })) }],
  }, { responsive: true });
  Plotly.addFrames("scatterChart", frames);
}

function drawRisk(rows) {
  const levels = ["Low", "Medium", "High"];
  const counts = levels.map((level) => rows.filter((row) => row.risk_level === level).length);
  Plotly.react("riskChart", [{ type: "bar", x: levels, y: counts, marker: { color: ["#2563eb", "#f59e0b", "#dc2626"] } }], { template: "plotly_white", margin: { t: 10, r: 10, b: 40, l: 40 } }, { responsive: true });
}

function drawGroup(rows) {
  const group = groupSelect.value;
  const counts = new Map();
  rows.forEach((row) => {
    const key = String(row[group] ?? "Unknown");
    counts.set(key, (counts.get(key) || 0) + (row.is_anomaly === 1 ? 1 : 0));
  });
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  Plotly.react("groupChart", [{ type: "bar", x: sorted.map((item) => item[0]), y: sorted.map((item) => item[1]), marker: { color: "#059669" } }], { template: "plotly_white", margin: { t: 10, r: 10, b: 80, l: 40 } }, { responsive: true });
}

function renderTable(rows) {
  const table = document.querySelector("#resultsTable");
  const columns = currentData.display_columns;
  table.innerHTML = `<thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 100).map((row) => `<tr>${columns.map((column) => `<td>${row[column] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function refreshDashboard() {
  const rows = filtered().sort((a, b) => b.anomaly_score - a.anomaly_score);
  updateMetrics(rows);
  drawScatter(rows);
  drawRisk(rows);
  drawGroup(rows);
  renderTable(rows);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const columns = currentData.display_columns;
  const csv = [columns.join(","), ...filteredRows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anomaly_results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function analyze() {
  const file = fileInput.files[0];
  if (!file) return setStatus("Please choose a dataset file first.", true);
  analyzeBtn.disabled = true;
  setStatus("Analysing dataset in your browser...");
  dashboard.classList.add("hidden");
  try {
    const rawRows = await readUploadedFile(file);
    currentData = analyseRows(rawRows);
    document.querySelector("#datasetTitle").textContent = `${currentData.dataset_type} anomaly dashboard`;
    fillSelect(riskFilter, ["All", "High", "Medium", "Low"]);
    fillSelect(xAxis, currentData.numeric_columns, 0);
    fillSelect(yAxis, currentData.numeric_columns, Math.min(1, currentData.numeric_columns.length - 1));
    fillSelect(groupSelect, currentData.categorical_columns.length ? currentData.categorical_columns : ["risk_level"], 0);
    dashboard.classList.remove("hidden");
    setStatus(`Analysed ${numberFormat(currentData.row_count)} rows locally using ${currentData.numeric_columns.length} numeric columns.`);
    refreshDashboard();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyze);
riskFilter.addEventListener("change", refreshDashboard);
groupSelect.addEventListener("change", refreshDashboard);
xAxis.addEventListener("change", refreshDashboard);
yAxis.addEventListener("change", refreshDashboard);
downloadBtn.addEventListener("click", downloadCsv);
