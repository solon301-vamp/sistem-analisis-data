const API = "http://<IP_EC2_KAMU>:8000"; // Ganti dengan IP EC2

const fileInput = document.getElementById("file-input");
const filenameLabel = document.getElementById("filename-label");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const chatBox = document.getElementById("chat-box");

// Upload file
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  filenameLabel.textContent = `File: ${file.name} (mengupload...)`;

  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch(`${API}/upload`, { method: "POST", body: form });
    const data = await res.json();
    filenameLabel.textContent = `✓ ${file.name} berhasil diupload`;
    renderStats(data);
    renderCharts(data.charts);
    showSections();
  } catch (e) {
    filenameLabel.textContent = "❌ Upload gagal. Pastikan backend berjalan.";
  }
});

function renderStats(data) {
  const grid = document.getElementById("stats-grid");
  const totalNull = Object.values(data.nulls || {}).reduce((a, b) => a + b, 0);
  grid.innerHTML = `
    <div class="stat-card"><div class="stat-value">${data.rows}</div><div class="stat-label">Total Baris</div></div>
    <div class="stat-card"><div class="stat-value">${data.columns.length}</div><div class="stat-label">Jumlah Kolom</div></div>
    <div class="stat-card"><div class="stat-value">${totalNull}</div><div class="stat-label">Data Kosong</div></div>
  `;
  // Tambah info kolom
  const cols = data.columns.map(c => `<span style="background:#f0f4ff;padding:3px 8px;border-radius:5px;font-size:0.8rem">${c}</span>`).join(" ");
  grid.innerHTML += `<div class="stat-card" style="grid-column:1/-1"><div class="stat-label" style="margin-bottom:8px">Nama Kolom</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cols}</div></div>`;
}

function renderCharts(charts) {
  const grid = document.getElementById("charts-grid");
  grid.innerHTML = charts.map(c => `
    <div>
      <p style="font-size:0.85rem;color:#666;margin-bottom:6px">${c.column}</p>
      <img src="data:image/png;base64,${c.image}" alt="Chart ${c.column}">
    </div>
  `).join("");
}

function showSections() {
  ["stats-section", "charts-section", "chat-section"].forEach(id => {
    document.getElementById(id).classList.remove("hidden");
  });
}

// Chat dengan AI
async function sendMessage(text) {
  if (!text.trim()) return;
  appendMsg(text, "user");
  chatInput.value = "";
  const loading = appendMsg("Gemini sedang menganalisis...", "loading");

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