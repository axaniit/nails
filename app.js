const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8UBWKpYgbqdRJouFH3ESdelrEt4BesAPm35MP7aI4Gz5rZg7RzgbTBTYafPSJswnH/exec";

let allSlots = [];
let calendar;

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

function syncSelectedSlotToHidden() {
  const slotSelect = document.getElementById("slotSelect");
  if (!slotSelect || !allSlots.length) return;

  const idx = Number(slotSelect.value || 0);
  const slot = allSlots[idx];
  if (!slot) return;

  document.getElementById("requestedStart").value = slot.start;
  document.getElementById("requestedEnd").value = slot.end;
  document.getElementById("selectedSlotText").textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
}

async function loadAvailability() {
  const res = await fetch(`${SCRIPT_URL}?action=getAvailability`, {
    method: "GET"
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to load availability");

  allSlots = Array.isArray(data.slots) ? data.slots : [];
  return allSlots;
}

function populateSlotDropdown() {
  const slotSelect = document.getElementById("slotSelect");
  if (!slotSelect) return;

  slotSelect.innerHTML = "";

  if (!allSlots.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No available slots right now";
    slotSelect.appendChild(opt);
    return;
  }

  allSlots.forEach((slot, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
    slotSelect.appendChild(opt);
  });

  syncSelectedSlotToHidden();
}

function initCalendarShell() {
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
    eventClick(info) {
      const idx = Number(info.event.id);
      const slotSelect = document.getElementById("slotSelect");
      if (!slotSelect) return;

      slotSelect.value = String(idx);
      syncSelectedSlotToHidden();
      openModal("bookingModal");
    },
    eventContent(arg) {
      const wrapper = document.createElement("div");
      const start = arg.event.start;
      const end = arg.event.end;
      wrapper.textContent = `${fmtTime(start)} — ${fmtTime(end)}`;
      return { domNodes: [wrapper] };
    },
    events: []
  });

  calendar.render();
}

function injectCalendarEvents() {
  if (!calendar) return;

  calendar.removeAllEvents();

  const events = allSlots.map((slot, idx) => ({
    id: String(idx),
    start: slot.start,
    end: slot.end
  }));

  events.forEach(evt => calendar.addEvent(evt));

  const emptyNote = document.getElementById("emptyCalendarNote");
  if (emptyNote) {
    emptyNote.style.display = events.length ? "none" : "block";
  }
}

function bindModalControls() {
  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });
}

function bindBookingControls() {
  const slotSelect = document.getElementById("slotSelect");
  const openBookingBtn = document.getElementById("openBookingBtn");
  const addressType = document.getElementById("addressType");
  const addressOtherWrap = document.getElementById("addressOtherWrap");
  const form = document.getElementById("bookingForm");

  if (slotSelect) {
    slotSelect.addEventListener("change", syncSelectedSlotToHidden);
  }

  if (openBookingBtn) {
    openBookingBtn.addEventListener("click", () => {
      if (!allSlots.length) {
        toast("There are no available slots showing right now.");
        return;
      }
      syncSelectedSlotToHidden();
      openModal("bookingModal");
    });
  }

  if (addressType && addressOtherWrap) {
    addressType.addEventListener("change", () => {
      addressOtherWrap.style.display = addressType.value === "other" ? "block" : "none";
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!allSlots.length) {
        toast("There are no available slots to request right now.");
        return;
      }

      syncSelectedSlotToHidden();

      const btn = document.getElementById("submitBtn");
      btn.disabled = true;

      try {
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

        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Request failed");

        closeModal("bookingModal");
        openModal("submittedModal");
        form.reset();
        if (addressOtherWrap) addressOtherWrap.style.display = "none";
        toast("Request received! Booking is not complete until approved and your deposit is paid.");
      } catch (err) {
        console.error(err);
        toast("Something went wrong submitting your request.");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("calendar")) return;

  initCalendarShell();
  bindModalControls();
  bindBookingControls();

  try {
    await loadAvailability();
    populateSlotDropdown();
    injectCalendarEvents();
  } catch (err) {
    console.error(err);
    populateSlotDropdown();
    injectCalendarEvents();
    toast("Could not load availability from the sheet.");
  }
});
