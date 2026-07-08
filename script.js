const STORAGE_KEY = "trainingFeedbackResponses";
const EXCEL_READY_MESSAGE = "Сейчас тебе автоматически загрузится файл excel, отправь его любым удобным для тебя способом бизнес-тренеру";

function loadResponses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveResponse(response) {
  const all = loadResponses();
  all.push(response);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  downloadResponseExcel(response);
}

function dateSlug(iso) {
  return iso.slice(0, 16).replace(/[:T]/g, "-");
}

function downloadResponseExcel(response) {
  const subject = response.type === "trainings" ? "Заявка на тренинг(и)" : "Ответ на опросник об обучении";
  const pairs = response.type === "trainings" ? trainingsResponsePairs(response) : surveyResponsePairs(response);
  const rows = [["Поле", "Значение"], ["Тема", subject], ...pairs];
  const slug = subject.replace(/[^\wа-яёА-ЯЁ]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  downloadXlsx(`${slug}_${dateSlug(response.date)}.xlsx`, "Ответ", rows);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

async function copyResponseText(subject, lines) {
  const text = `Тема: ${subject}\n\n${lines.filter(Boolean).join("\n")}`;
  const ok = await copyToClipboard(text);
  showToast(ok ? "Файл Excel скачан, текст скопирован 📊📋" : "Файл Excel скачан. Не удалось скопировать текст 😕");
}

function showToast(message, duration) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), duration || 2600);
}

/* ===== Trainings grid ===== */
const selectedTrainings = new Set();

function renderTrainings() {
  const grid = document.getElementById("trainingsGrid");
  grid.innerHTML = TRAININGS.map(t => `
    <div class="training-card" id="card-${t.id}">
      <div class="training-icon" style="background:${t.color}">${t.icon}</div>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
      <div class="training-meta">
        ${t.tags.map((tag, i) => `<span class="tag ${i === 0 ? "tag-teal" : i === 1 ? "tag-yellow" : ""}">${tag}</span>`).join("")}
      </div>
      <button class="pick-btn" data-id="${t.id}">Хочу пройти</button>
    </div>
  `).join("");

  grid.querySelectorAll(".pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const card = document.getElementById(`card-${id}`);
      if (selectedTrainings.has(id)) {
        selectedTrainings.delete(id);
        btn.classList.remove("picked");
        card.classList.remove("selected");
        btn.textContent = "Хочу пройти";
      } else {
        selectedTrainings.add(id);
        btn.classList.add("picked");
        card.classList.add("selected");
        btn.textContent = "Выбрано ✓";
      }
      updatePickCount();
    });
  });
}

function updatePickCount() {
  document.getElementById("pickCount").textContent = `Выбрано тренингов: ${selectedTrainings.size}`;
}

function getTrainingsResponse() {
  const anon = document.getElementById("tAnon").checked;
  return {
    id: Date.now(),
    type: "trainings",
    date: new Date().toISOString(),
    anonymous: anon,
    name: anon ? "" : document.getElementById("tName").value.trim(),
    department: document.getElementById("tDept").value,
    trainings: Array.from(selectedTrainings).map(id => TRAININGS.find(t => t.id === id).title)
  };
}

function trainingsResponsePairs(response) {
  return [
    ["Тренинги", response.trainings.join(", ")],
    ["Отдел", response.department || "не указан"],
    ["Имя", response.anonymous ? "анонимно" : response.name || "не указано"],
    ["Дата", new Date(response.date).toLocaleString("ru-RU")]
  ];
}

function trainingsResponseLines(response) {
  return trainingsResponsePairs(response).map(([label, value]) => `${label}: ${value}`);
}

function resetTrainingsForm() {
  selectedTrainings.forEach(id => {
    document.getElementById(`card-${id}`)?.querySelector(".pick-btn")?.classList.remove("picked");
    document.getElementById(`card-${id}`)?.classList.remove("selected");
  });
  document.querySelectorAll(".pick-btn").forEach(b => b.textContent = "Хочу пройти");
  selectedTrainings.clear();
  updatePickCount();
  document.getElementById("tName").value = "";
  document.getElementById("tDept").value = "";
  document.getElementById("tAnon").checked = false;
}

document.getElementById("submitTrainings").addEventListener("click", () => {
  if (selectedTrainings.size === 0) {
    showToast("Выберите хотя бы один тренинг 🙂");
    return;
  }
  const response = getTrainingsResponse();
  saveResponse(response);
  resetTrainingsForm();
  showToast(EXCEL_READY_MESSAGE, 5000);
});

document.getElementById("copyTrainings").addEventListener("click", async () => {
  if (selectedTrainings.size === 0) {
    showToast("Выберите хотя бы один тренинг 🙂");
    return;
  }
  const response = getTrainingsResponse();
  saveResponse(response);
  await copyResponseText("Заявка на тренинг(и)", trainingsResponseLines(response));
  resetTrainingsForm();
});

renderTrainings();

/* ===== Survey wizard ===== */
const steps = ["1", "2", "3", "4", "5", "6", "thanks"];
let currentStep = 0;

const surveyForm = document.getElementById("surveyForm");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

function showStep(index) {
  document.querySelectorAll(".q-step").forEach(el => el.classList.remove("active"));
  document.querySelector(`.q-step[data-step="${steps[index]}"]`).classList.add("active");

  document.querySelectorAll(".progress-seg").forEach((seg, i) => {
    seg.classList.remove("active", "done");
    if (i < index) seg.classList.add("done");
    else if (i === index) seg.classList.add("active");
  });

  const nav = document.getElementById("stepNav");
  if (steps[index] === "thanks") {
    nav.style.display = "none";
  } else {
    nav.style.display = "flex";
    prevBtn.style.visibility = index === 0 ? "hidden" : "visible";
    nextBtn.textContent = index === steps.length - 2 ? "Отправить ✅" : "Дальше →";
  }
}

nextBtn.addEventListener("click", () => {
  if (steps[currentStep] === "6") {
    submitSurvey();
  }

  if (currentStep < steps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
});

function getSurveyResponse() {
  const anon = document.getElementById("sAnon").checked;
  return {
    id: Date.now(),
    type: "survey",
    date: new Date().toISOString(),
    anonymous: anon,
    name: anon ? "" : document.getElementById("sName").value.trim(),
    surname: anon ? "" : document.getElementById("sSurname").value.trim(),
    position: document.getElementById("sPosition").value.trim(),
    department: document.getElementById("sDept").value,
    tenure: document.getElementById("q1Tenure").value.trim(),
    tasks: document.getElementById("q2Tasks").value.trim(),
    priorTraining: document.getElementById("q3PriorTraining").value.trim(),
    whatToLearn: document.getElementById("q4WhatToLearn").value.trim(),
    whatToImprove: document.getElementById("q5WhatToImprove").value.trim()
  };
}

function surveyResponsePairs(response) {
  return [
    ["Стаж в компании", response.tenure || "не указано"],
    ["Основные задачи", response.tasks || "не указано"],
    ["Уже проходил(а)", response.priorTraining || "не указано"],
    ["Хочет узнать", response.whatToLearn || "не указано"],
    ["Хочет улучшить", response.whatToImprove || "не указано"],
    ["Должность", response.position || "не указана"],
    ["Отдел", response.department || "не указан"],
    ["Имя", response.anonymous ? "анонимно" : response.name || "не указано"],
    ["Фамилия", response.anonymous ? "анонимно" : response.surname || "не указана"],
    ["Дата", new Date(response.date).toLocaleString("ru-RU")]
  ];
}

function surveyResponseLines(response) {
  return surveyResponsePairs(response).map(([label, value]) => `${label}: ${value}`);
}

function submitSurvey() {
  const response = getSurveyResponse();
  saveResponse(response);
  showToast(EXCEL_READY_MESSAGE, 5000);
}

document.getElementById("copySurvey").addEventListener("click", async () => {
  const response = getSurveyResponse();
  saveResponse(response);
  await copyResponseText("Ответ на опросник об обучении", surveyResponseLines(response));
  if (currentStep < steps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
});

document.getElementById("restartSurvey").addEventListener("click", () => {
  surveyForm.reset();
  currentStep = 0;
  showStep(currentStep);
});

showStep(currentStep);
