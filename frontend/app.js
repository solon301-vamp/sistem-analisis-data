const API = "http://18.143.185.121:8000";

const fileInput = document.getElementById("file-input");
const filenameLabel = document.getElementById("filename-label");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const chatBox = document.getElementById("chat-box");

let allCharts = [];
let fullData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;

// ========================
// UPLOAD FILE
// ========================
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  filenameLabel.textContent = `Mengupload ${file.name}...`;

  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch(`${API}/upload`, { method: "POST", body: form });
    const data = await res.json();
    filenameLabel.textContent = `✓ ${file.name} berhasil diupload`;
    renderStats(data);
    renderDataset(data);
    renderAnalysis(data.stats_analysis);
    renderCharts(data.charts);
    showSections();
  } catch (e) {
    filenameLabel.textContent = "❌ Upload gagal. Pastikan backend berjalan.";
  }
});

// ========================
// RINGKASAN DATA
// ========================
function renderStats(data) {
  const grid = document.getElementById("stats-grid");
  const totalNull = Object.values(data.nulls || {}).reduce((a, b) => a + b, 0);
  const numericCount = (data.numeric_cols || []).length;
  const catCount = (data.categorical_cols || []).length;

  grid.innerHTML = `
    <div class="stat-card"><div class="stat-value">${data.rows}</div><div class="stat-label">Total Baris</div></div>
    <div class="stat-card"><div class="stat-value">${data.columns.length}</div><div class="stat-label">Jumlah Kolom</div></div>
    <div class="stat-card"><div class="stat-value">${numericCount}</div><div class="stat-label">Kolom Numerik</div></div>
    <div class="stat-card"><div class="stat-value">${catCount}</div><div class="stat-label">Kolom Kategorikal</div></div>
    <div class="stat-card"><div class="stat-value">${totalNull}</div><div class="stat-label">Data Kosong</div></div>
  `;
  const cols = data.columns.map(c => `<span class="col-tag">${c}</span>`).join(" ");
  grid.innerHTML += `<div class="stat-card full-width"><div class="stat-label" style="margin-bottom:8px">Nama Kolom</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cols}</div></div>`;
}

// ========================
// PREVIEW DATASET
// ========================
function renderDataset(data) {
  fullData = data.head || [];
  filteredData = [...fullData];
  currentPage = 1;
  renderTable();

  // Search
  const searchInput = document.getElementById("search-input");
  searchInput.value = "";
  searchInput.onchange = null;
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    filteredData = fullData.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
    currentPage = 1;
    renderTable();
  });

  document.getElementById("prev-btn").onclick = () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  };
  document.getElementById("next-btn").onclick = () => {
    if (currentPage < Math.ceil(filteredData.length / rowsPerPage)) { currentPage++; renderTable(); }
  };
}

function renderTable() {
  if (fullData.length === 0) return;
  const columns = Object.keys(fullData[0]);
  const start = (currentPage - 1) * rowsPerPage;
  const pageData = filteredData.slice(start, start + rowsPerPage);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  document.getElementById("table-head").innerHTML =
    `<tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr>`;
  document.getElementById("table-body").innerHTML =
    pageData.map(row =>
      `<tr>${columns.map(c => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`
    ).join("");
  document.getElementById("page-info").textContent = `Halaman ${currentPage} / ${totalPages}`;
  document.getElementById("row-count").textContent = `Menampilkan ${filteredData.length} dari ${fullData.length} baris (preview 5 baris pertama)`;
}

// ========================
// ANALISIS STATISTIK
// ========================
function renderAnalysis(analysis) {
  if (!analysis) return;
  const grid = document.getElementById("analysis-grid");
  let html = "";

  // Outlier
  if (analysis.outliers && Object.keys(analysis.outliers).length > 0) {
    html += `<div class="analysis-card warning"><h3>⚠️ Outlier Terdeteksi</h3>`;
    for (const [col, info] of Object.entries(analysis.outliers)) {
      html += `<p><strong>${col}</strong>: ${info.count} outlier (batas: ${info.lower_bound} – ${info.upper_bound})</p>`;
    }
    html += `</div>`;
  }

  // Korelasi tinggi
  if (analysis.high_correlations && analysis.high_correlations.length > 0) {
    html += `<div class="analysis-card info"><h3>🔗 Korelasi Tinggi (≥ 0.7)</h3>`;
    for (const corr of analysis.high_correlations) {
      const strength = corr.value > 0 ? "positif" : "negatif";
      html += `<p><strong>${corr.col1}</strong> & <strong>${corr.col2}</strong>: ${corr.value} (${strength})</p>`;
    }
    html += `</div>`;
  }

  // Skewness
  if (analysis.skewness && Object.keys(analysis.skewness).length > 0) {
    html += `<div class="analysis-card success"><h3>📐 Distribusi Tidak Normal (Skewed)</h3>`;
    for (const [col, info] of Object.entries(analysis.skewness)) {
      html += `<p><strong>${col}</strong>: ${info.type} (skew = ${info.value})</p>`;
    }
    html += `</div>`;
  }

  if (!html) html = `<p style="color:#666">Tidak ada anomali signifikan yang terdeteksi.</p>`;
  grid.innerHTML = html;
}

// ========================
// VISUALISASI CHART
// ========================
function renderCharts(charts) {
  allCharts = charts;
  displayCharts("all");

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      displayCharts(btn.dataset.type);
    });
  });
}

function displayCharts(type) {
  const grid = document.getElementById("charts-grid");
  const filtered = type === "all" ? allCharts : allCharts.filter(c => c.type === type);
  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:#666;padding:16px">Tidak ada chart tipe ini untuk data kamu.</p>`;
    return;
  }
  grid.innerHTML = filtered.map(c => `
    <div class="chart-item">
      <p class="chart-label">${getChartLabel(c)}</p>
      <img src="data:image/png;base64,${c.image}" alt="Chart">
    </div>
  `).join("");
}

function getChartLabel(c) {
  const labels = {
    histogram: `📊 Histogram — ${c.column}`,
    bar: `📊 Bar Chart — ${c.column}`,
    line: `📈 Line Chart — ${c.column}`,
    scatter: `⚡ Scatter Plot — ${c.col1} vs ${c.col2}`,
    heatmap: `🌡️ Heatmap Korelasi`,
    boxplot: `📦 Box Plot (Outlier)`,
    pie: `🥧 Pie Chart — ${c.column}`
  };
  return labels[c.type] || c.type;
}

// ========================
// SHOW SECTIONS
// ========================
function showSections() {
  ["stats-section", "dataset-section", "analysis-section", "charts-section", "export-section", "chat-section"].forEach(id => {
    document.getElementById(id).classList.remove("hidden");
  });
}

// ========================
// EXPORT
// ========================
document.getElementById("export-excel-btn").addEventListener("click", () => {
  window.open(`${API}/export/excel`, "_blank");
});

document.getElementById("export-pdf-btn").addEventListener("click", () => {
  window.print();
});

// ========================
// CHAT AI
// ========================
async function sendMessage(text) {
  if (!text.trim()) return;
  appendMsg(text, "user");
  chatInput.value = "";
  const loading = appendMsg("AI sedang menganalisis...", "loading");
  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text })
    });
    const data = await res.json();
    loading.remove();
    appendMsg(data.answer, "ai");
  } catch {
    loading.remove();
    appendMsg("❌ Gagal terhubung ke AI.", "ai");
  }
}

function appendMsg(text, type) {
  const div = document.createElement("div");
  div.className = type === "user" ? "msg-user" : type === "loading" ? "msg-loading" : "msg-ai";
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

sendBtn.addEventListener("click", () => sendMessage(chatInput.value));
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(chatInput.value); });
document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => sendMessage(btn.textContent));
});