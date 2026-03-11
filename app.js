const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8UBWKpYgbqdRJouFH3ESdelrEt4BesAPm35MP7aI4Gz5rZg7RzgbTBTYafPSJswnH/exec";

let allSlots = [];
let calendar = null;
let selectedCalendarSlotIndex = null;

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4200);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

function fmt(dt) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dt));
}

function fmtTime(dt) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dt));
}

async function loadAvailability() {
  const res = await fetch(`${SCRIPT_URL}?action=getAvailability`);
  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.error || "Failed to load availability");
  }

  allSlots = Array.isArray(data.slots) ? data.slots : [];
  return allSlots;
}

function populateInlineDropdown() {
  const select = document.getElementById("inline_slotSelect");
  if (!select) return;

  select.innerHTML = "";

  if (!allSlots.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No available slots right now";
    select.appendChild(opt);
    updateInlineSelectedSlot();
    return;
  }

  allSlots.forEach((slot, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
    select.appendChild(opt);
  });

  updateInlineSelectedSlot();
}

function updateInlineSelectedSlot() {
  const select = document.getElementById("inline_slotSelect");
  const chip = document.getElementById("inlineSelectedSlot");
  const startInput = document.getElementById("inline_requestedStart");
  const endInput = document.getElementById("inline_requestedEnd");

  if (!select || !chip || !startInput || !endInput) return;

  const idx = Number(select.value || 0);
  const slot = allSlots[idx];

  if (!slot) {
    chip.textContent = "Choose a slot above";
    startInput.value = "";
    endInput.value = "";
    return;
  }

  chip.textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
  startInput.value = slot.start;
  endInput.value = slot.end;
}

function setPopupSlot(idx) {
  const slot = allSlots[idx];
  if (!slot) return;

  selectedCalendarSlotIndex = idx;

  document.getElementById("popup_requestedStart").value = slot.start;
  document.getElementById("popup_requestedEnd").value = slot.end;
  document.getElementById("popupSelectedSlot").textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
}

function initCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    events: allSlots.map((slot, idx) => ({
      id: String(idx),
      start: slot.start,
      end: slot.end
    })),
    eventClick(info) {
      const idx = Number(info.event.id);
      setPopupSlot(idx);
      openSlotPopup();
    },
    eventContent(arg) {
      const wrapper = document.createElement("div");
      const start = arg.event.start;
      const end = arg.event.end;
      wrapper.textContent = `${fmtTime(start)} — ${fmtTime(end)}`;
      return { domNodes: [wrapper] };
    }
  });

  calendar.render();

  const emptyNote = document.getElementById("emptyCalendarNote");
  if (emptyNote) {
    emptyNote.style.display = allSlots.length ? "none" : "block";
  }
}

function refreshCalendarEvents() {
  if (!calendar) return;

  calendar.removeAllEvents();
  allSlots.forEach((slot, idx) => {
    calendar.addEvent({
      id: String(idx),
      start: slot.start,
      end: slot.end
    });
  });

  const emptyNote = document.getElementById("emptyCalendarNote");
  if (emptyNote) {
    emptyNote.style.display = allSlots.length ? "none" : "block";
  }
}

function openSlotPopup() {
  document.getElementById("slotPopupBackdrop")?.classList.add("show");
}

function closeSlotPopup() {
  document.getElementById("slotPopupBackdrop")?.classList.remove("show");
}

function bindAddressToggle(selectId, wrapId) {
  const select = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (!select || !wrap) return;

  select.addEventListener("change", () => {
    wrap.style.display = select.value === "other" ? "block" : "none";
  });
}

async function submitBookingForm(form, submitBtn) {
  const fd = new FormData(form);

  const payload = {
    action: "createBooking",
    preferred_name: fd.get("preferred_name"),
    client_email: fd.get("client_email"),
    client_phone: fd.get("client_phone"),
    service: fd.get("service"),
    requested_start: fd.get("requested_start"),
    requested_end: fd.get("requested_end"),
    address_type: fd.get("address_type"),
    address_text: fd.get("address_text"),
    notes: fd.get("notes"),
    inspo_file_url: ""
  };

  submitBtn.disabled = true;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Request failed");

    form.reset();

    if (form.id === "popupBookingForm") {
      document.getElementById("popup_addressOtherWrap").style.display = "none";
      closeSlotPopup();
    } else if (form.id === "inlineBookingForm") {
      document.getElementById("inline_addressOtherWrap").style.display = "none";
    }

    openModal("submittedModal");
    toast("Request received! Booking is not complete until approved and your deposit is paid.");
  } catch (err) {
    console.error(err);
    toast("Something went wrong submitting your request.");
  } finally {
    submitBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("calendar")) return;

  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });

  bindAddressToggle("inline_addressType", "inline_addressOtherWrap");
  bindAddressToggle("popup_addressType", "popup_addressOtherWrap");

  document.getElementById("slotPopupClose")?.addEventListener("click", closeSlotPopup);
  document.getElementById("popupCloseBtn")?.addEventListener("click", closeSlotPopup);

  document.getElementById("slotPopupBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "slotPopupBackdrop") closeSlotPopup();
  });

  document.getElementById("loadIntoFormBtn")?.addEventListener("click", () => {
    if (selectedCalendarSlotIndex == null) return;

    const inlineSelect = document.getElementById("inline_slotSelect");
    if (inlineSelect) {
      inlineSelect.value = String(selectedCalendarSlotIndex);
      updateInlineSelectedSlot();
      document.getElementById("inlineBookingForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    closeSlotPopup();
  });

  document.getElementById("inline_slotSelect")?.addEventListener("change", updateInlineSelectedSlot);

  document.getElementById("inlineBookingForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitBookingForm(e.currentTarget, document.getElementById("inlineSubmitBtn"));
  });

  document.getElementById("popupBookingForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitBookingForm(e.currentTarget, document.getElementById("popupSubmitBtn"));
  });

  try {
    await loadAvailability();
    populateInlineDropdown();
    initCalendar();
  } catch (err) {
    console.error(err);
    populateInlineDropdown();
    initCalendar();
    refreshCalendarEvents();
    toast("Could not load availability from the sheet.");
  }
});
