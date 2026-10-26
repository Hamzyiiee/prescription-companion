const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#prescription-file");
const fileName = document.querySelector("#file-name");
const cropWrap = document.querySelector("#image-crop-wrap");
const cropCanvas = document.querySelector("#image-crop-canvas");
const cropContext = cropCanvas.getContext("2d");
const resetCropButton = document.querySelector("#reset-image-crop");
const previewImage = new Image();
let previewObjectUrl = null;
let cropRect = null;
let cropAnchor = null;
const uploadButton = document.querySelector("#upload-button");
const manualEntryButton = document.querySelector("#manual-entry-button");
const reviewSection = document.querySelector("#review-section");
const reviewHeading = document.querySelector("#review-heading");
const ocrSummary = document.querySelector(".ocr-details summary");
const medicineList = document.querySelector("#medicine-list");
const ocrText = document.querySelector("#ocr-text");
const reviewConfirmed = document.querySelector("#review-confirmed");
const saveButton = document.querySelector("#save-button");
const statusMessage = document.querySelector("#status-message");
const savedList = document.querySelector("#saved-list");
const refreshSavedButton = document.querySelector("#refresh-saved");
const scheduleList = document.querySelector("#schedule-list");
const dailyScheduleList = document.querySelector("#daily-schedule-list");
const scheduleViewDate = document.querySelector("#schedule-view-date");
const refreshSchedulesButton = document.querySelector("#refresh-schedules");
const reminderButton = document.querySelector("#toggle-reminders");
const reminderStatus = document.querySelector("#reminder-status");
const scheduleEditor = document.querySelector("#schedule-editor");
const scheduleMedicineSummary = document.querySelector("#schedule-medicine-summary");
const scheduleFrequencyNote = document.querySelector("#schedule-frequency-note");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleTimes = document.querySelector("#schedule-times");
const scheduleStartDate = document.querySelector("#schedule-start-date");
const scheduleEndDate = document.querySelector("#schedule-end-date");
const saveScheduleButton = document.querySelector("#save-schedule");
const scheduleCache = new Map();
let selectedMedicine = null;
let editingPrescriptionId = null;
let dailyRenderVersion = 0;
let reminderEnabled = false;
let reminderTimer = null;
let reminderCheckInProgress = false;
let reminderLastCheckAt = Date.now();
const REMINDER_ENABLED_KEY = "prescription-companion-reminders-enabled";
const REMINDER_SENT_KEY = "prescription-companion-sent-reminders";

const fields = [
  ["name", "Medicine name", true],
  ["strength", "Strength (e.g. 500 mg)", false],
  ["dose", "Dose (e.g. 1 tablet)", false],
  ["frequency", "Frequency", false],
  ["duration", "Duration", false],
  ["instructions", "Instructions", false],
];

fileInput.addEventListener("change", () => {
  if (editingPrescriptionId !== null) {
    editingPrescriptionId = null;
    saveButton.textContent = "Save reviewed prescription";
  }
  fileName.textContent = fileInput.files[0]?.name || "No file selected";
  cropRect = null;
  cropWrap.classList.add("hidden");
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  const file = fileInput.files[0];
  if (!file) return;
  previewObjectUrl = URL.createObjectURL(file);
  previewImage.onload = () => {
    cropCanvas.width = previewImage.naturalWidth;
    cropCanvas.height = previewImage.naturalHeight;
    cropWrap.classList.remove("hidden");
    drawCropPreview();
  };
  previewImage.onerror = () => setStatus("The selected image could not be previewed.", "error");
  previewImage.src = previewObjectUrl;
});

cropCanvas.addEventListener("pointerdown", (event) => {
  const point = cropPoint(event);
  cropAnchor = point;
  cropRect = { x: point.x, y: point.y, width: 0, height: 0 };
  cropCanvas.setPointerCapture(event.pointerId);
  drawCropPreview();
});
cropCanvas.addEventListener("pointermove", (event) => {
  if (!cropAnchor) return;
  const point = cropPoint(event);
  cropRect = {
    x: Math.min(cropAnchor.x, point.x),
    y: Math.min(cropAnchor.y, point.y),
    width: Math.abs(point.x - cropAnchor.x),
    height: Math.abs(point.y - cropAnchor.y),
  };
  drawCropPreview();
});
function finishCropSelection() { cropAnchor = null; }
cropCanvas.addEventListener("pointerup", finishCropSelection);
cropCanvas.addEventListener("pointercancel", finishCropSelection);
resetCropButton.addEventListener("click", () => { cropRect = null; drawCropPreview(); });

function cropPoint(event) {
  const bounds = cropCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(cropCanvas.width, (event.clientX - bounds.left) * cropCanvas.width / bounds.width)),
    y: Math.max(0, Math.min(cropCanvas.height, (event.clientY - bounds.top) * cropCanvas.height / bounds.height)),
  };
}

function drawCropPreview() {
  if (!previewImage.complete || !previewImage.naturalWidth) return;
  cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.drawImage(previewImage, 0, 0);
  if (!cropRect || cropRect.width < 2 || cropRect.height < 2) return;
  cropContext.fillStyle = "rgba(0, 0, 0, 0.48)";
  cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  cropContext.drawImage(previewImage, cropRect.x, cropRect.y, cropRect.width, cropRect.height,
    cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  cropContext.strokeStyle = "#ffffff";
  cropContext.lineWidth = Math.max(2, cropCanvas.width / 500);
  cropContext.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
}

async function getUploadFile() {
  if (!cropRect || cropRect.width < 2 || cropRect.height < 2) return fileInput.files[0];
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropRect.width);
  canvas.height = Math.round(cropRect.height);
  canvas.getContext("2d").drawImage(previewImage, cropRect.x, cropRect.y, cropRect.width, cropRect.height,
    0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not prepare the selected image area.");
  return new File([blob], "prescription-crop.png", { type: "image/png" });
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!fileInput.files[0]) return;

  setStatus("", "");
  setBusy(uploadButton, true, "Reading image…");
  const body = new FormData();
  try {
    body.append("file", await getUploadFile());
  } catch (error) {
    setStatus(error.message, "error");
    setBusy(uploadButton, false, "Extract medicine details");
    return;
  }

  try {
    const response = await fetch("/upload-prescription", { method: "POST", body });
    const data = await readResponse(response);
    reviewHeading.textContent = "Review the extracted details";
    ocrSummary.textContent = "Show text read from the image";
    ocrText.textContent = Array.isArray(data.ocr_text) ? data.ocr_text.join("\n") : (data.ocr_text || "No text was detected.");
    medicineList.replaceChildren();
    (data.medicines || []).forEach((medicine) => addMedicine(medicine));
    if (!data.medicines?.length) addMedicine();
    reviewConfirmed.checked = false;
    updateSaveState();
    reviewSection.classList.remove("hidden");
    setStatus("OCR draft is ready. Review each field below.", "success");
    reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(uploadButton, false, "Extract medicine details");
  }
});

function startManualEntry() {
  if (editingPrescriptionId !== null && !window.confirm("Discard the unsaved prescription edit and start a new manual entry?")) return;
  editingPrescriptionId = null;
  saveButton.textContent = "Save reviewed prescription";
  medicineList.replaceChildren();
  addMedicine();
  reviewHeading.textContent = "Enter medicine details manually";
  ocrSummary.textContent = "About manual entry";
  ocrText.textContent = "OCR was skipped. Enter details only from a clear, verified source. Do not guess unclear medicine names or instructions.";
  reviewConfirmed.checked = false;
  updateSaveState();
  reviewSection.classList.remove("hidden");
  setStatus("Manual entry selected. Add medicine details, then check the confirmation box after reviewing them.", "success");
  reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

manualEntryButton.addEventListener("click", startManualEntry);
document.querySelector("#manual-entry-from-review").addEventListener("click", startManualEntry);

refreshSavedButton.addEventListener("click", loadSavedPrescriptions);
refreshSchedulesButton.addEventListener("click", loadSchedules);
reminderButton.addEventListener("click", toggleBrowserReminders);
scheduleViewDate.addEventListener("change", renderDailySchedule);
dailyScheduleList.addEventListener("click", handleDoseToggle);
document.querySelector("#add-schedule-time").addEventListener("click", () => addScheduleTime());
document.querySelector("#cancel-schedule").addEventListener("click", closeScheduleEditor);
scheduleTimes.addEventListener("click", (event) => {
  if (!event.target.matches(".remove-time")) return;
  event.target.closest(".schedule-time-row").remove();
  updateScheduleTimeLabels();
});
document.querySelector("#add-medicine").addEventListener("click", () => addMedicine());
reviewConfirmed.addEventListener("change", updateSaveState);
medicineList.addEventListener("input", updateSaveState);
medicineList.addEventListener("click", (event) => {
  if (!event.target.matches(".remove-medicine")) return;
  event.target.closest(".medicine-card").remove();
  updateMedicineTitles();
  updateSaveState();
});

saveButton.addEventListener("click", async () => {
  if (!reviewConfirmed.checked) return;
  const medicines = [...medicineList.querySelectorAll(".medicine-card")].map((card) => {
    const medicine = {};
    card.querySelectorAll("input[data-field]").forEach((input) => {
      const value = input.value.trim();
      medicine[input.dataset.field] = value || null;
    });
    return medicine;
  });

  if (!medicines.length || medicines.some((medicine) => !medicine.name)) {
    setStatus("Enter a medicine name for each card before saving.", "error");
    return;
  }

  setStatus("", "");
  setBusy(saveButton, true, editingPrescriptionId !== null ? "Saving changes…" : "Saving reviewed prescription…");
  try {
    const isEditing = editingPrescriptionId !== null;
    const response = await fetch(
      isEditing ? `/prescriptions/${editingPrescriptionId}` : "/prescriptions/verify",
      {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicines }),
      },
    );
    const data = await readResponse(response);
    const savedId = data.prescription.id;
    editingPrescriptionId = null;
    saveButton.textContent = "Save reviewed prescription";
    reviewConfirmed.checked = false;
    updateSaveState();
    await loadSchedules();
    await loadSavedPrescriptions();
    setStatus(`Saved after review. Prescription ID: ${savedId}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(saveButton, false, editingPrescriptionId !== null ? "Save prescription changes" : "Save reviewed prescription");
  }
});

function addMedicine(values = {}) {
  const card = document.createElement("article");
  card.className = "medicine-card";
  const header = document.createElement("div");
  header.className = "medicine-card-head";
  const title = document.createElement("h3");
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-medicine";
  removeButton.textContent = "Remove";
  header.append(title, removeButton);

  const grid = document.createElement("div");
  grid.className = "fields-grid";
  for (const [key, label, required] of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const fieldLabel = document.createElement("label");
    const input = document.createElement("input");
    const inputId = `medicine-${crypto.randomUUID()}-${key}`;
    fieldLabel.htmlFor = inputId;
    fieldLabel.textContent = label;
    input.id = inputId;
    input.dataset.field = key;
    input.value = values[key] ?? "";
    input.required = required;
    input.autocomplete = "off";
    wrapper.append(fieldLabel, input);
    grid.append(wrapper);
  }
  card.append(header, grid);
  medicineList.append(card);
  updateMedicineTitles();
  updateSaveState();
}

function updateMedicineTitles() {
  medicineList.querySelectorAll(".medicine-card").forEach((card, index) => {
    card.querySelector("h3").textContent = `Medicine ${index + 1}`;
  });
}

function updateSaveState() {
  const hasMedicines = medicineList.querySelectorAll(".medicine-card").length > 0;
  const allNamed = [...medicineList.querySelectorAll('input[data-field="name"]')].every((input) => input.value.trim());
  saveButton.disabled = !(reviewConfirmed.checked && hasMedicines && allNamed);
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return data;
}

function setStatus(message, kind) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${kind ? ` ${kind}` : ""}`;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
  if (button === saveButton && !busy) updateSaveState();
}

async function loadSavedPrescriptions() {
  savedList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Loading saved prescriptions…";
  savedList.append(loading);
  refreshSavedButton.disabled = true;

  try {
    const response = await fetch("/prescriptions");
    const prescriptions = await readResponse(response);
    savedList.replaceChildren();

    if (!prescriptions.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No saved prescriptions yet. Reviewed prescriptions will appear here.";
      savedList.append(empty);
      return;
    }

    prescriptions.forEach((prescription) => savedList.append(createSavedCard(prescription)));
  } catch (error) {
    savedList.replaceChildren();
    const errorMessage = document.createElement("p");
    errorMessage.className = "empty-state saved-error";
    errorMessage.textContent = `Could not load saved prescriptions: ${error.message}`;
    savedList.append(errorMessage);
  } finally {
    refreshSavedButton.disabled = false;
  }
}

function createSavedCard(prescription) {
  const card = document.createElement("article");
  card.className = "saved-card";

  const header = document.createElement("div");
  header.className = "saved-card-header";
  const titleGroup = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = `Prescription #${prescription.id}`;
  const summary = document.createElement("p");
  const count = prescription.medicines.length;
  summary.textContent = `${count} ${count === 1 ? "medicine" : "medicines"}`;
  titleGroup.append(title, summary);

  const actions = document.createElement("div");
  actions.className = "saved-card-actions";
  const viewButton = document.createElement("button");
  viewButton.className = "button button-secondary saved-view-button";
  viewButton.type = "button";
  viewButton.textContent = "View details";
  const editButton = document.createElement("button");
  editButton.className = "button button-secondary saved-view-button";
  editButton.type = "button";
  editButton.textContent = "Edit details";
  editButton.addEventListener("click", () => editPrescription(prescription));
  const deleteButton = document.createElement("button");
  deleteButton.className = "button delete-prescription-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deletePrescription(prescription.id, deleteButton));
  actions.append(viewButton, editButton, deleteButton);
  header.append(titleGroup, actions);

  const details = document.createElement("div");
  details.className = "saved-details hidden";
  prescription.medicines.forEach((medicine) => {
    const medicineSection = document.createElement("section");
    medicineSection.className = "saved-medicine";
    const medicineTitle = document.createElement("h4");
    medicineTitle.textContent = medicine.strength
      ? `${medicine.name} · ${medicine.strength}`
      : medicine.name;
    medicineSection.append(medicineTitle);

    if (isAsNeeded(medicine.frequency)) {
      const note = document.createElement("p");
      note.className = "as-needed-note";
      note.textContent = "As-needed medicine: no fixed daily times are created.";
      medicineSection.append(note);
    } else {
      const scheduleButton = document.createElement("button");
      scheduleButton.type = "button";
      scheduleButton.className = "button button-secondary schedule-action";
      scheduleButton.textContent = "Set or edit schedule";
      scheduleButton.addEventListener("click", () => openScheduleEditor(medicine));
      medicineSection.append(scheduleButton);
    }

    const facts = [
      ["Dose", medicine.dose],
      ["Frequency", medicine.frequency],
      ["Duration", medicine.duration],
      ["Instructions", medicine.instructions],
    ].filter(([, value]) => value);
    if (facts.length) {
      const factList = document.createElement("dl");
      factList.className = "saved-facts";
      facts.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        factList.append(term, description);
      });
      medicineSection.append(factList);
    }
    details.append(medicineSection);
  });

  viewButton.addEventListener("click", () => {
    const opening = details.classList.contains("hidden");
    details.classList.toggle("hidden", !opening);
    viewButton.textContent = opening ? "Hide details" : "View details";
  });

  card.append(header, details);
  return card;
}


function editPrescription(prescription) {
  const confirmed = window.confirm(`Edit prescription #${prescription.id}? Saving changes replaces its medicine list and clears its schedules and dose marks. You can set schedules again afterward.`);
  if (!confirmed) return;
  editingPrescriptionId = prescription.id;
  medicineList.replaceChildren();
  prescription.medicines.forEach((medicine) => addMedicine(medicine));
  reviewHeading.textContent = "Review prescription changes";
  ocrSummary.textContent = "About the saved medicine details";
  ocrText.textContent = "You are editing saved medicine details. OCR text from the original upload is not stored.";
  reviewConfirmed.checked = false;
  saveButton.textContent = "Save prescription changes";
  updateSaveState();
  reviewSection.classList.remove("hidden");
  setStatus(`Editing prescription #${prescription.id}. Review the fields and confirm before saving.`, "success");
  reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deletePrescription(prescriptionId, button) {
  const confirmed = window.confirm(`Delete prescription #${prescriptionId} and its medicines, schedules, and dose marks? This cannot be undone.`);
  if (!confirmed) return;
  button.disabled = true;
  setStatus("Deleting prescription…", "");
  try {
    const response = await fetch(`/prescriptions/${prescriptionId}`, { method: "DELETE" });
    await readResponse(response);
    await loadSchedules();
    await loadSavedPrescriptions();
    setStatus(`Prescription #${prescriptionId} deleted.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
    button.disabled = false;
  }
}
function isAsNeeded(frequency) {
  const normalized = (frequency || "").toLowerCase();
  return normalized.includes("sos") || normalized.includes("as needed");
}

function suggestedTimeCount(frequency) {
  const normalized = (frequency || "").toLowerCase();
  if (normalized.includes("four times") || normalized.includes("qid")) return 4;
  if (normalized.includes("three times") || normalized.includes("thrice") || normalized.includes("tds")) return 3;
  if (normalized.includes("twice") || normalized.includes("two times") || normalized.includes("bd")) return 2;
  if (normalized.includes("once") || normalized.includes("od")) return 1;
  return 1;
}

function openScheduleEditor(medicine) {
  if (isAsNeeded(medicine.frequency)) return;
  selectedMedicine = medicine;
  const summaryParts = [medicine.name, medicine.strength, medicine.dose, medicine.frequency].filter(Boolean);
  scheduleMedicineSummary.textContent = summaryParts.join(" · ");
  const saved = scheduleCache.get(medicine.id);
  scheduleStartDate.value = saved?.start_date || "";
  scheduleEndDate.value = saved?.end_date || "";
  scheduleTimes.replaceChildren();

  const timeCount = saved?.times.length || suggestedTimeCount(medicine.frequency);
  for (let index = 0; index < timeCount; index += 1) {
    addScheduleTime(saved?.times[index] || "");
  }

  const count = suggestedTimeCount(medicine.frequency);
  scheduleFrequencyNote.textContent = medicine.frequency
    ? `Frequency says ${count} time${count === 1 ? "" : "s"} per day. Choose the clock time${count === 1 ? "" : "s"} from the reviewed instructions; the app will not guess them.`
    : "Frequency is unclear. Verify it from the prescription, then add the correct number of daily times.";
  scheduleEditor.classList.remove("hidden");
  scheduleEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addScheduleTime(value = "") {
  if (scheduleTimes.children.length >= 4) return;
  const row = document.createElement("div");
  row.className = "schedule-time-row";
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "time";
  input.required = true;
  input.value = value;
  wrapper.append(label, input);
  row.append(wrapper);
  if (scheduleTimes.children.length > 0) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-time";
    removeButton.textContent = "Remove";
    row.append(removeButton);
  }
  scheduleTimes.append(row);
  updateScheduleTimeLabels();
}

function updateScheduleTimeLabels() {
  [...scheduleTimes.children].forEach((row, index) => {
    row.querySelector("label").textContent = `Dose time ${index + 1}`;
    row.querySelector("input").name = `time_${index + 1}`;
  });
}

function closeScheduleEditor() {
  scheduleEditor.classList.add("hidden");
  selectedMedicine = null;
  scheduleForm.reset();
  scheduleTimes.replaceChildren();
}

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedMedicine) return;
  const times = [...scheduleTimes.querySelectorAll('input[type="time"]')].map((input) => input.value);
  if (new Set(times).size !== times.length) {
    setStatus("Choose a different clock time for each daily dose.", "error");
    return;
  }

  setStatus("", "");
  setBusy(saveScheduleButton, true, "Saving schedule…");
  try {
    const response = await fetch("/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicine_id: selectedMedicine.id,
        start_date: scheduleStartDate.value,
        end_date: scheduleEndDate.value,
        times,
      }),
    });
    await readResponse(response);
    setStatus("Schedule saved. Browser reminders will use these times if enabled.", "success");
    closeScheduleEditor();
    await loadSchedules();
    await loadSavedPrescriptions();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(saveScheduleButton, false, "Save schedule");
  }
});

async function loadSchedules() {
  scheduleList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Loading schedules…";
  scheduleList.append(loading);
  refreshSchedulesButton.disabled = true;

  try {
    const response = await fetch("/schedules");
    const schedules = await readResponse(response);
    scheduleCache.clear();
    schedules.forEach((schedule) => scheduleCache.set(schedule.medicine_id, schedule));
    renderDailySchedule();
    scheduleList.replaceChildren();

    if (!schedules.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No schedules yet. Choose Set schedule on a saved medicine.";
      scheduleList.append(empty);
    } else {
      schedules.forEach((schedule) => scheduleList.append(createScheduleEntry(schedule)));
    }
  } catch (error) {
    scheduleList.replaceChildren();
    const errorMessage = document.createElement("p");
    errorMessage.className = "empty-state saved-error";
    errorMessage.textContent = `Could not load schedules: ${error.message}`;
    scheduleList.append(errorMessage);
  } finally {
    refreshSchedulesButton.disabled = false;
  }
}

function createScheduleEntry(schedule) {
  const entry = document.createElement("article");
  entry.className = "schedule-entry";
  const heading = document.createElement("h3");
  const medicine = schedule.medicine;
  heading.textContent = medicine.strength
    ? `${medicine.name} · ${medicine.strength}`
    : medicine.name;
  const dateRange = document.createElement("p");
  dateRange.textContent = `Dates: ${schedule.start_date} to ${schedule.end_date}`;
  const times = document.createElement("p");
  times.textContent = `Daily times: ${schedule.times.join(", ")}`;
  const directions = document.createElement("p");
  directions.textContent = [medicine.dose, medicine.frequency, medicine.instructions].filter(Boolean).join(" · ");
  entry.append(heading, dateRange, times, directions);
  return entry;
}

loadSchedules().then(() => loadSavedPrescriptions());





function localDateKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function reminderSentKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMINDER_SENT_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveReminderSentKeys(keys) {
  try {
    localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify([...keys].slice(-1000)));
  } catch {
    setReminderStatus("Reminder history could not be saved in this browser.");
  }
}

function setReminderStatus(message) {
  reminderStatus.textContent = message;
}

function updateReminderControls() {
  if (!("Notification" in window)) {
    reminderButton.disabled = true;
    reminderButton.textContent = "Notifications unavailable";
    setReminderStatus("This browser does not support desktop notifications.");
    return;
  }
  reminderButton.disabled = false;
  reminderButton.textContent = reminderEnabled ? "Turn off browser reminders" : "Enable browser reminders";
  if (reminderEnabled) {
    setReminderStatus("Browser reminders are on while this page is open. The notification text does not include medicine names.");
  } else if (Notification.permission === "denied") {
    setReminderStatus("Notifications are blocked in the browser. Allow them for this site in browser settings, then reload.");
  } else {
    setReminderStatus("Reminders are off. Click Enable and allow browser notifications to turn them on.");
  }
}

function initializeBrowserReminders() {
  if (!("Notification" in window)) {
    updateReminderControls();
    return;
  }
  try {
    reminderEnabled = localStorage.getItem(REMINDER_ENABLED_KEY) === "on" && Notification.permission === "granted";
  } catch {
    reminderEnabled = false;
  }
  if (reminderEnabled) startReminderPolling();
  updateReminderControls();
}

async function toggleBrowserReminders() {
  if (!("Notification" in window)) {
    updateReminderControls();
    return;
  }
  if (reminderEnabled) {
    reminderEnabled = false;
    if (reminderTimer) window.clearInterval(reminderTimer);
    reminderTimer = null;
    try { localStorage.removeItem(REMINDER_ENABLED_KEY); } catch { /* Continue with reminders off for this page. */ }
    updateReminderControls();
    return;
  }

  if (Notification.permission === "denied") {
    updateReminderControls();
    return;
  }
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    reminderEnabled = false;
    setReminderStatus("Permission was not granted, so reminders remain off.");
    updateReminderControls();
    return;
  }

  reminderEnabled = true;
  reminderLastCheckAt = Date.now();
  try { localStorage.setItem(REMINDER_ENABLED_KEY, "on"); } catch { /* The current page can still run reminders. */ }
  startReminderPolling();
  updateReminderControls();
  try {
    new Notification("Prescription Companion", {
      body: "Browser reminders are enabled while this page is open.",
      tag: "prescription-companion-reminders-enabled",
    });
  } catch {
    setReminderStatus("The browser allowed reminders, but could not display the confirmation notification.");
  }
}

function startReminderPolling() {
  if (reminderTimer) window.clearInterval(reminderTimer);
  reminderTimer = window.setInterval(checkForDueReminders, 15000);
}

async function checkForDueReminders() {
  if (!reminderEnabled || reminderCheckInProgress || !scheduleCache.size || !("Notification" in window)) return;
  if (Notification.permission !== "granted") {
    reminderEnabled = false;
    if (reminderTimer) window.clearInterval(reminderTimer);
    reminderTimer = null;
    updateReminderControls();
    return;
  }

  reminderCheckInProgress = true;
  const now = new Date();
  const nowMs = now.getTime();
  const today = localDateKey(now);
  const lowerBound = Math.max(reminderLastCheckAt, nowMs - 90000);
  reminderLastCheckAt = nowMs;
  const due = [];
  scheduleCache.forEach((schedule) => {
    if (today < schedule.start_date || today > schedule.end_date) return;
    schedule.times.forEach((time) => {
      const dueAt = new Date(`${today}T${time}:00`).getTime();
      if (dueAt > lowerBound && dueAt <= nowMs) {
        due.push({ medicineId: schedule.medicine_id, time, key: `${today}|${schedule.medicine_id}|${time}` });
      }
    });
  });
  if (!due.length) {
    reminderCheckInProgress = false;
    return;
  }

  try {
    const response = await fetch(`/dose-logs?dose_date=${encodeURIComponent(today)}`);
    const logs = await readResponse(response);
    const taken = new Set(logs.map((log) => `${log.dose_date}|${log.medicine_id}|${log.dose_time}`));
    const sent = reminderSentKeys();
    const dueNotTaken = due.filter((dose) => !taken.has(dose.key));
    const needsNotice = dueNotTaken.some((dose) => !sent.has(dose.key));
    due.forEach((dose) => sent.add(dose.key));
    saveReminderSentKeys(sent);

    if (needsNotice) {
      const slot = due[0].time;
      const notification = new Notification("Medication schedule reminder", {
        body: "A scheduled medicine time is due. Open the app and check the reviewed instructions.",
        tag: `prescription-companion-${today}-${slot.replace(":", "")}`,
      });
      notification.onclick = () => {
        window.focus();
        scheduleViewDate.value = today;
        renderDailySchedule();
        notification.close();
      };
    }
  } catch (error) {
    setReminderStatus(`Could not check the schedule for a reminder: ${error.message}`);
  } finally {
    reminderCheckInProgress = false;
  }
}

async function renderDailySchedule() {
  if (!dailyScheduleList || !scheduleViewDate) return;
  if (!scheduleViewDate.value) {
    const localNow = new Date();
    localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
    scheduleViewDate.value = localNow.toISOString().slice(0, 10);
  }

  const selectedDate = scheduleViewDate.value;
  const renderVersion = ++dailyRenderVersion;
  let takenKeys = new Set();
  try {
    const response = await fetch(`/dose-logs?dose_date=${encodeURIComponent(selectedDate)}`);
    const logs = await readResponse(response);
    if (renderVersion !== dailyRenderVersion) return;
    takenKeys = new Set(logs.map((log) => `${log.medicine_id}|${log.dose_date}|${log.dose_time}`));
  } catch (error) {
    dailyScheduleList.replaceChildren();
    const notice = document.createElement("p");
    notice.className = "empty-state saved-error";
    notice.textContent = `Could not load dose status: ${error.message}`;
    dailyScheduleList.append(notice);
    return;
  }

  const doses = [];
  scheduleCache.forEach((schedule) => {
    if (selectedDate < schedule.start_date || selectedDate > schedule.end_date) return;
    schedule.times.forEach((time) => doses.push({ schedule, time }));
  });
  doses.sort((left, right) => left.time.localeCompare(right.time));
  dailyScheduleList.replaceChildren();

  if (!doses.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No planned doses for this date.";
    dailyScheduleList.append(empty);
    return;
  }

  doses.forEach(({ schedule, time }) => {
    const takenKey = `${schedule.medicine_id}|${selectedDate}|${time}`;
    const isTaken = takenKeys.has(takenKey);
    const entry = document.createElement("article");
    entry.className = `daily-dose${isTaken ? " is-taken" : ""}`;
    const clock = document.createElement("time");
    clock.textContent = time;
    const content = document.createElement("div");
    const heading = document.createElement("h4");
    const medicine = schedule.medicine;
    heading.textContent = medicine.strength
      ? `${medicine.name} · ${medicine.strength}`
      : medicine.name;
    const directions = document.createElement("p");
    directions.textContent = [medicine.dose, medicine.frequency, medicine.instructions].filter(Boolean).join(" · ");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `dose-toggle${isTaken ? " is-taken" : ""}`;
    toggle.dataset.medicineId = schedule.medicine_id;
    toggle.dataset.doseDate = selectedDate;
    toggle.dataset.doseTime = time;
    toggle.dataset.taken = String(isTaken);
    toggle.textContent = isTaken ? "✓ Taken · Undo" : "Mark taken";
    content.append(heading, directions);
    entry.append(clock, content, toggle);
    dailyScheduleList.append(entry);
  });
}

async function handleDoseToggle(event) {
  const button = event.target.closest(".dose-toggle");
  if (!button) return;
  button.disabled = true;
  const query = new URLSearchParams({
    medicine_id: button.dataset.medicineId,
    dose_date: button.dataset.doseDate,
    dose_time: button.dataset.doseTime,
  });
  try {
    const response = button.dataset.taken === "true"
      ? await fetch(`/dose-logs?${query}`, { method: "DELETE" })
      : await fetch("/dose-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicine_id: Number(button.dataset.medicineId),
            dose_date: button.dataset.doseDate,
            dose_time: button.dataset.doseTime,
          }),
        });
    await readResponse(response);
    await renderDailySchedule();
  } catch (error) {
    setStatus(error.message, "error");
    button.disabled = false;
  }
}