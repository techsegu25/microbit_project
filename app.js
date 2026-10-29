// =====================================================================
// 무순 관리 에이전트 설계 — 태스크 1: 전체 UI (프런트엔드 전용)
// Gemini(태스크 2), Firebase(태스크 3) 연동은 아직 포함하지 않습니다.
// 상태는 메모리(state)에만 보관하며, 화면 간 이동 시 유지됩니다.
// =====================================================================

/** 앱 상태 (spec.md 12장 구조에 맞춤) */
const state = {
  currentStep: 1,
  owner: "",       // 닉네임 (저장 시 설정)
  className: "",   // 반/모둠 (선택)
  problem: {
    padletUrl: "",
    growthDiary: "",
    candidates: [], // 발견한 문제 목록
    selected: "",   // 해결할 문제
  },
  design: {
    description: "", // 자연어 기능 설명 (steps와 별도)
    steps: [],       // { order, condition, action }
    sensors: [],     // 선택한 센서/출력 코드 (저장 시 sensors/outputs로 분리)
    extraSensors: [], // 추가한 센서 이름
    imageName: "",   // 미리보기용 파일 이름
    imageFile: null, // 업로드할 실제 파일 (localStorage에는 저장 안 함)
  },
};

const STORAGE_KEY = "musun_app_state";

// ---------- localStorage 저장/복원 (AC1-5) ----------
function persist() {
  try {
    const { imageFile, ...designRest } = state.design;
    const data = {
      currentStep: state.currentStep,
      owner: state.owner,
      className: state.className,
      problem: state.problem,
      design: designRest,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    /* 비공개 모드 등에서 실패해도 앱은 정상 동작 */
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.problem) state.problem = { ...state.problem, ...data.problem };
    if (data.design) state.design = { ...state.design, ...data.design, imageFile: null };
    if (typeof data.owner === "string") state.owner = data.owner;
    if (typeof data.className === "string") state.className = data.className;
    if (data.currentStep) state.currentStep = data.currentStep;
  } catch (e) {
    /* 손상된 데이터는 무시 */
  }
}

/** 기본 센서/출력 목록 (학생이 배운 범위) */
const DEFAULT_SENSORS = [
  { code: "temperature", label: "온도" },
  { code: "accelerometer", label: "가속도" },
  { code: "sound", label: "소리" },
  { code: "light", label: "조도" },
  { code: "soilMoisture", label: "토양습도" },
  { code: "led", label: "LED" },
  { code: "speaker", label: "스피커" },
];

const TOTAL_STEPS = 3;

// ---------- 공통 유틸 ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showError(step, message) {
  const el = $(`#error-${step}`);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}
function clearError(step) {
  const el = $(`#error-${step}`);
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

// ---------- 단계 이동 ----------
function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  state.currentStep = step;

  // 뷰 전환
  $$(".view").forEach((v) => {
    const active = v.id === `view-${step}`;
    v.classList.toggle("is-active", active);
    v.hidden = !active;
  });

  // 진행 표시 갱신
  $$(".steps .step").forEach((li) => {
    li.classList.toggle("is-active", Number(li.dataset.step) === step);
  });

  // 이동 버튼 상태
  $("#prev-btn").hidden = step === 1;
  $("#next-btn").textContent = step === TOTAL_STEPS ? "저장 / 완료" : "다음 →";

  // 단계 진입 시 준비 작업
  if (step === 2) renderSelectedProblem();
  if (step === 3) renderSummary();

  persist();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 화면 1: 문제 작성 ----------
function renderProblems() {
  const list = $("#problem-list");
  list.innerHTML = "";
  state.problem.candidates.forEach((text, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = text;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger-link";
    del.textContent = "삭제";
    del.setAttribute("aria-label", `문제 삭제: ${text}`);
    del.addEventListener("click", () => {
      state.problem.candidates.splice(i, 1);
      if (state.problem.selected === text) state.problem.selected = "";
      renderProblems();
      renderChoices();
      persist();
    });
    li.append(span, del);
    list.appendChild(li);
  });
  $("#problem-empty").hidden = state.problem.candidates.length > 0;
}

function renderChoices() {
  const wrap = $("#problem-choices");
  const card = $("#select-card");
  wrap.innerHTML = "";
  card.hidden = state.problem.candidates.length === 0;

  state.problem.candidates.forEach((text, i) => {
    const id = `choice-${i}`;
    const label = document.createElement("label");
    label.className = "choice";
    label.htmlFor = id;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "selected-problem";
    radio.id = id;
    radio.value = text;
    radio.checked = state.problem.selected === text;
    radio.addEventListener("change", () => {
      state.problem.selected = text;
      clearError(1);
      persist();
    });

    const span = document.createElement("span");
    span.textContent = text;
    label.append(radio, span);
    wrap.appendChild(label);
  });
}

function addProblem() {
  const input = $("#problem-input");
  const text = input.value.trim();
  if (!text) return;
  state.problem.candidates.push(text);
  input.value = "";
  input.focus();
  renderProblems();
  renderChoices();
  clearError(1);
  persist();
}

// ---------- 화면 2: 자연어 설계 ----------
function renderSelectedProblem() {
  $("#selected-problem-text").textContent = state.problem.selected || "—";
}

function renderSteps() {
  const wrap = $("#step-list");
  wrap.innerHTML = "";
  state.design.steps.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "step-item";
    row.innerHTML = `
      <span class="order">${i + 1}</span>
      <span class="text"><span class="cond">${escapeHtml(s.condition)}</span>
        → ${escapeHtml(s.action)}</span>`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger-link";
    del.textContent = "삭제";
    del.setAttribute("aria-label", `단계 삭제: ${s.condition} → ${s.action}`);
    del.addEventListener("click", () => {
      state.design.steps.splice(i, 1);
      renderSteps();
      persist();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

function addStep() {
  const cond = $("#cond-input").value.trim();
  const act = $("#act-input").value.trim();
  if (!cond || !act) {
    showError(2, "조건과 동작을 모두 적어 주세요.");
    return;
  }
  state.design.steps.push({
    order: state.design.steps.length + 1,
    condition: cond,
    action: act,
  });
  $("#cond-input").value = "";
  $("#act-input").value = "";
  $("#cond-input").focus();
  renderSteps();
  clearError(2);
  persist();
}

function renderSensors() {
  const wrap = $("#sensor-list");
  wrap.innerHTML = "";
  const all = [
    ...DEFAULT_SENSORS,
    ...state.design.extraSensors.map((label) => ({ code: label, label, extra: true })),
  ];
  all.forEach(({ code, label }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label;
    const selected = state.design.sensors.includes(code);
    chip.setAttribute("aria-pressed", String(selected));
    chip.addEventListener("click", () => {
      const idx = state.design.sensors.indexOf(code);
      if (idx >= 0) state.design.sensors.splice(idx, 1);
      else state.design.sensors.push(code);
      chip.setAttribute("aria-pressed", String(idx < 0));
      persist();
    });
    wrap.appendChild(chip);
  });
}

function addSensor() {
  const input = $("#extra-sensor-input");
  const name = input.value.trim();
  if (!name) return;
  if (!state.design.extraSensors.includes(name)) {
    state.design.extraSensors.push(name);
    state.design.sensors.push(name); // 추가하면 바로 선택 상태로
  }
  input.value = "";
  input.focus();
  renderSensors();
  persist();
}

function handleSketch(e) {
  const file = e.target.files && e.target.files[0];
  const preview = $("#sketch-preview");
  preview.innerHTML = "";
  if (!file) {
    state.design.imageName = "";
    state.design.imageFile = null;
    persist();
    return;
  }
  state.design.imageName = file.name;
  state.design.imageFile = file;
  persist();
  const img = document.createElement("img");
  img.alt = `업로드한 설계 그림: ${file.name}`;
  img.src = URL.createObjectURL(file);
  img.addEventListener("load", () => URL.revokeObjectURL(img.src));
  preview.appendChild(img);
}

// ---------- 화면 2: AI 교사 피드백 (태스크 2) ----------
function getApiKey() {
  const typed = $("#api-key").value.trim();
  if (typed) return typed;
  if (window.APP_CONFIG && window.APP_CONFIG.GEMINI_API_KEY &&
      window.APP_CONFIG.GEMINI_API_KEY !== "여기에_본인의_API_키를_넣으세요") {
    return window.APP_CONFIG.GEMINI_API_KEY;
  }
  return "";
}

// 메시지를 안전하게(textContent) 렌더링 (XSS 방지)
function renderMessage(el, message, type) {
  el.className = "feedback-area" + (type ? ` is-${type}` : "");
  el.textContent = "";
  message.split("\n").forEach((line, i) => {
    if (i > 0) el.appendChild(document.createElement("br"));
    el.appendChild(document.createTextNode(line));
  });
}
function showFeedback(message, type) {
  renderMessage($("#feedback-area"), message, type);
}

const FEEDBACK_ERRORS = {
  NO_KEY: "먼저 Gemini API 키를 입력해 주세요. (키 설정을 열어 입력)",
  EMPTY: "AI 교사가 답을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
  NETWORK: "인터넷 연결을 확인하고 다시 시도해 주세요.",
};

async function requestFeedback() {
  const btn = $("#get-feedback");
  if (state.design.steps.length === 0) {
    showFeedback("먼저 '조건 → 동작' 단계를 하나 이상 적어 주세요.", "error");
    return;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    showFeedback(FEEDBACK_ERRORS.NO_KEY, "error");
    return;
  }

  btn.disabled = true;
  showFeedback("AI 교사가 설계를 읽고 있어요… 🤖", "loading");

  try {
    const text = await window.getTeacherFeedback({
      apiKey,
      model: (window.APP_CONFIG && window.APP_CONFIG.GEMINI_MODEL) || "gemini-3.8-flash",
      problem: state.problem.selected,
      steps: state.design.steps,
      sensors: state.design.sensors.map(sensorLabel),
    });
    showFeedback(text, "ok");
  } catch (err) {
    const code = String(err.message || "");
    let msg = FEEDBACK_ERRORS[code];
    if (!msg && code.startsWith("API_ERROR:")) {
      const status = code.split(":")[1];
      if (status === "400" || status === "403") {
        msg = "API 키가 올바른지 확인해 주세요.";
      } else if (status === "404") {
        msg = "AI 모델을 찾을 수 없어요. 모델 이름(config)을 확인해 주세요.";
      } else if (status === "429" || status === "503") {
        msg = "지금 사용량이 많아요. 잠시 후 다시 시도해 주세요.";
      } else {
        msg = `AI 교사 호출에 실패했어요. (오류 ${status})`;
      }
    }
    showFeedback(msg || "알 수 없는 오류가 발생했어요. 다시 시도해 주세요.", "error");
  } finally {
    btn.disabled = false;
  }
}

// ---------- 화면 3: 요약 ----------
function sensorLabel(code) {
  const found = DEFAULT_SENSORS.find((s) => s.code === code);
  return found ? found.label : code; // 추가 센서는 이름 그대로
}

function renderSummary() {
  const wrap = $("#summary-content");
  const d = state.design;
  const stepsHtml = d.steps.length
    ? `<ul>${d.steps
        .map((s) => `<li>${escapeHtml(s.condition)} → ${escapeHtml(s.action)}</li>`)
        .join("")}</ul>`
    : "<p class='hint'>아직 설계 단계가 없어요.</p>";
  const sensorsHtml = d.sensors.length
    ? d.sensors.map(sensorLabel).map(escapeHtml).join(", ")
    : "없음";

  const descHtml = d.description
    ? `<div class="summary-item"><span class="k">기능 설명</span><div>${escapeHtml(d.description)}</div></div>`
    : "";

  wrap.innerHTML = `
    <div class="summary-item">
      <span class="k">문제</span>
      <div>${escapeHtml(state.problem.selected || "선택 안 됨")}</div>
    </div>
    ${descHtml}
    <div class="summary-item">
      <span class="k">조건 → 동작</span>
      ${stepsHtml}
    </div>
    <div class="summary-item">
      <span class="k">센서 / 부품</span>
      <div>${sensorsHtml}</div>
    </div>`;
}

// ---------- 화면 3: Firebase 저장 (태스크 3) ----------
async function saveToFirebase() {
  const area = $("#save-status");
  const btn = $("#next-btn");

  if (typeof window.saveProject !== "function") {
    renderMessage(area, "저장 기능을 불러오지 못했어요. (Firebase 설정/네트워크 확인)", "error");
    return;
  }

  state.owner = $("#nickname").value.trim() || "익명";
  state.className = $("#class-name").value.trim();
  persist();
  btn.disabled = true;
  renderMessage(area, "저장하고 있어요… 💾", "loading");

  try {
    const id = await window.saveProject(state);
    renderMessage(area, `저장되었습니다! 저장 번호: ${id}`, "ok");
  } catch (err) {
    const code = (err && err.code) || "";
    let msg;
    if (code === "permission-denied") {
      msg = "저장 권한이 없어요. 선생님께 Firestore 보안 규칙 확인을 요청하세요.";
    } else if (code === "unavailable") {
      msg = "인터넷 연결을 확인하고 다시 시도해 주세요.";
    } else {
      msg = "저장에 실패했어요. 잠시 후 다시 시도해 주세요.";
    }
    renderMessage(area, msg, "error");
    console.error("saveProject 실패:", err);
  } finally {
    btn.disabled = false;
  }
}

// ---------- 유효성 검사 후 다음 단계 ----------
async function handleNext() {
  const step = state.currentStep;
  if (step === 1) {
    if (!state.problem.selected) {
      showError(1, "해결할 문제를 하나 골라 주세요.");
      return;
    }
  }
  if (step === 2) {
    if (state.design.steps.length === 0) {
      showError(2, "조건 → 동작 단계를 하나 이상 적어 주세요.");
      return;
    }
  }
  if (step === TOTAL_STEPS) {
    await saveToFirebase();
    return;
  }
  goToStep(step + 1);
}

// ---------- HTML 이스케이프 (XSS 방지) ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- 초기화 ----------
function init() {
  // 화면 1
  $("#add-problem").addEventListener("click", addProblem);
  $("#problem-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addProblem(); }
  });
  $("#padlet-url").addEventListener("input", (e) => { state.problem.padletUrl = e.target.value; persist(); });
  $("#growth-diary").addEventListener("input", (e) => { state.problem.growthDiary = e.target.value; persist(); });

  // 화면 2
  $("#design-desc").addEventListener("input", (e) => { state.design.description = e.target.value; persist(); });
  $("#add-step").addEventListener("click", addStep);
  $("#add-sensor").addEventListener("click", addSensor);
  $("#extra-sensor-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addSensor(); }
  });
  $("#sketch").addEventListener("change", handleSketch);
  $("#get-feedback").addEventListener("click", requestFeedback);

  // 화면 3
  $("#nickname").addEventListener("input", (e) => { state.owner = e.target.value; persist(); });
  $("#class-name").addEventListener("input", (e) => { state.className = e.target.value; persist(); });

  // 이동
  $("#next-btn").addEventListener("click", handleNext);
  $("#prev-btn").addEventListener("click", () => goToStep(state.currentStep - 1));

  // 저장된 내용 복원 (AC1-5) 후 입력칸 채우기
  restore();
  $("#padlet-url").value = state.problem.padletUrl || "";
  $("#growth-diary").value = state.problem.growthDiary || "";
  $("#design-desc").value = state.design.description || "";
  $("#nickname").value = state.owner || "";
  $("#class-name").value = state.className || "";

  // 첫 렌더
  renderProblems();
  renderChoices();
  renderSteps();
  renderSensors();
  goToStep(state.currentStep || 1);
}

document.addEventListener("DOMContentLoaded", init);
