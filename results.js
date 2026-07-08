const STORAGE_KEY = "trainingFeedbackResponses";

function loadResponses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function renderBars(containerId, counts) {
  const el = document.getElementById(containerId);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    el.innerHTML = `<div class="empty-note">Пока нет данных</div>`;
    return;
  }
  const max = entries[0][1];
  el.innerHTML = entries.map(([label, count]) => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(label)}</span><span>${count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
    </div>
  `).join("");
}

function render() {
  const responses = loadResponses();

  document.getElementById("statTotal").textContent = responses.length;
  document.getElementById("statTrainings").textContent = responses.filter(r => r.type === "trainings").length;
  document.getElementById("statSurveys").textContent = responses.filter(r => r.type === "survey").length;
  const depts = new Set(responses.map(r => r.department).filter(Boolean));
  document.getElementById("statDepts").textContent = depts.size;

  const trainingCounts = {};
  responses.filter(r => r.type === "trainings").forEach(r => {
    (r.trainings || []).forEach(t => { trainingCounts[t] = (trainingCounts[t] || 0) + 1; });
  });
  renderBars("trainingBars", trainingCounts);

  const improvements = responses.filter(r => r.type === "survey" && r.whatToImprove);
  const painEl = document.getElementById("painPoints");
  painEl.innerHTML = improvements.length === 0
    ? `<div class="empty-note">Пока нет данных</div>`
    : improvements.map(r => `
        <div class="response-item">
          <div class="r-top"><span>${r.anonymous ? "Аноним" : escapeHtml([r.name, r.surname].filter(Boolean).join(" ")) || "Без имени"} · ${escapeHtml(r.position) || "Должность не указана"} · ${escapeHtml(r.department) || "Отдел не указан"}</span><span>${new Date(r.date).toLocaleDateString("ru-RU")}</span></div>
          <p style="margin:0;">${escapeHtml(r.whatToImprove)}</p>
        </div>
      `).join("");

  const listEl = document.getElementById("responseList");
  const sorted = [...responses].sort((a, b) => b.id - a.id);
  listEl.innerHTML = sorted.length === 0
    ? `<div class="empty-note">Ответов пока нет — отправьте первый с главной страницы</div>`
    : sorted.map(r => `
        <div class="response-item">
          <div class="r-top">
            <span><span class="r-type ${r.type}">${r.type === "trainings" ? "Тренинги" : "Опросник"}</span> &nbsp;${r.anonymous ? "Аноним" : escapeHtml([r.name, r.surname].filter(Boolean).join(" ")) || "Без имени"}${r.position ? " · " + escapeHtml(r.position) : ""} · ${escapeHtml(r.department) || "Отдел не указан"}</span>
            <span>${new Date(r.date).toLocaleString("ru-RU")}</span>
          </div>
          ${r.type === "trainings" ? `
            <div class="r-tags">${(r.trainings || []).map(t => `<span class="tag tag-teal">${escapeHtml(t)}</span>`).join("")}</div>
          ` : `
            <dl style="margin:8px 0 0;">
              ${r.tenure ? `<p style="margin:0 0 6px;"><b>Стаж в компании:</b> ${escapeHtml(r.tenure)}</p>` : ""}
              ${r.tasks ? `<p style="margin:0 0 6px;"><b>Основные задачи:</b> ${escapeHtml(r.tasks)}</p>` : ""}
              ${r.priorTraining ? `<p style="margin:0 0 6px;"><b>Уже проходил(а):</b> ${escapeHtml(r.priorTraining)}</p>` : ""}
              ${r.whatToLearn ? `<p style="margin:0 0 6px;"><b>Хочет узнать:</b> ${escapeHtml(r.whatToLearn)}</p>` : ""}
              ${r.whatToImprove ? `<p style="margin:0;"><b>Хочет улучшить:</b> ${escapeHtml(r.whatToImprove)}</p>` : ""}
            </dl>
          `}
        </div>
      `).join("");
}

function toCsvValue(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

document.getElementById("exportCsv").addEventListener("click", () => {
  const responses = loadResponses();
  if (responses.length === 0) { showToast("Нет данных для экспорта"); return; }
  const header = ["Дата", "Тип", "Имя", "Фамилия", "Должность", "Отдел", "Анонимно", "Тренинги", "Стаж в компании", "Основные задачи", "Уже проходил(а)", "Хочет узнать", "Хочет улучшить"];
  const rows = responses.map(r => [
    new Date(r.date).toLocaleString("ru-RU"),
    r.type === "trainings" ? "Тренинги" : "Опросник",
    r.name || "",
    r.surname || "",
    r.position || "",
    r.department || "",
    r.anonymous ? "Да" : "Нет",
    (r.trainings || []).join("; "),
    r.tenure || "",
    r.tasks || "",
    r.priorTraining || "",
    r.whatToLearn || "",
    r.whatToImprove || ""
  ]);
  const csv = "﻿" + [header, ...rows].map(row => row.map(toCsvValue).join(",")).join("\r\n");
  downloadFile(csv, "training-feedback.csv", "text/csv;charset=utf-8;");
});

document.getElementById("exportJson").addEventListener("click", () => {
  const responses = loadResponses();
  if (responses.length === 0) { showToast("Нет данных для экспорта"); return; }
  downloadFile(JSON.stringify(responses, null, 2), "training-feedback.json", "application/json");
});

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("clearAll").addEventListener("click", () => {
  if (confirm("Удалить все собранные ответы без возможности восстановления?")) {
    localStorage.removeItem(STORAGE_KEY);
    render();
    showToast("Данные очищены");
  }
});

render();
