const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8UBWKpYgbqdRJouFH3ESdelrEt4BesAPm35MP7aI4Gz5rZg7RzgbTBTYafPSJswnH/exec";

let allSlots = [];

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4200);
}

function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
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
  const idx = Number(slotSelect.value || 0);
  const slot = allSlots[idx];
  if (!slot) return;

  document.getElementById("requestedStart").value = slot.start;
  document.getElementById("requestedEnd").value = slot.end;
  document.getElementById("selectedSlotText").textContent =
    `${fmt(slot.start)} — ${fmt(slot.end)}`;
}

async function loadAvailability() {
  const res = await fetch(`${SCRIPT_URL}?action=getAvailability`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to load availability");
  allSlots = data.slots || [];
  return allSlots;
}

function populateSlotDropdown() {
  const slotSelect = document.getElementById("slotSelect");
  slotSelect.innerHTML = "";

  allSlots.forEach((slot, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${fmt(slot.start)} — ${fmt(slot.end)}`;
    slotSelect.appendChild(opt);
  });

  if (allSlots.length > 0) syncSelectedSlotToHidden();
}

function initCalendar() {
  const calendarEl = document.getElementById("calendar");

  const events = allSlots.map((slot, idx) => ({
    id: String(idx),
    start: slot.start,
    end: slot.end,
    extendedProps: {
      rangeLabel: `${fmtTime(slot.start)} — ${fmtTime(slot.end)}`
    }
  }));

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    events,
    eventClick(info) {
      const idx = Number(info.event.id);
      document.getElementById("slotSelect").value = String(idx);
      syncSelectedSlotToHidden();
      openModal("bookingModal");
    },
    eventContent(arg) {
      const wrapper = document.createElement("div");
      wrapper.textContent = arg.event.extendedProps.rangeLabel || "";
      return { domNodes: [wrapper] };
    }
  });

  calendar.render();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("calendar")) return;

  try {
    await loadAvailability();
    populateSlotDropdown();
    initCalendar();
  } catch (err) {
    console.error(err);
    toast("Could not load availability.");
  }

  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });

  const slotSelect = document.getElementById("slotSelect");
  slotSelect.addEventListener("change", syncSelectedSlotToHidden);

  const addressType = document.getElementById("addressType");
  const addressOtherWrap = document.getElementById("addressOtherWrap");
  addressType.addEventListener("change", () => {
    addressOtherWrap.style.display = addressType.value === "other" ? "block" : "none";
  });

  document.getElementById("bookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    syncSelectedSlotToHidden();

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;

    try {
      const fd = new FormData(e.target);

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
      e.target.reset();
      addressOtherWrap.style.display = "none";
      toast("Request received! Booking is not complete until approved and the deposit is paid.");
    } catch (err) {
      console.error(err);
      toast("Something went wrong submitting your request.");
    } finally {
      btn.disabled = false;
    }
  });
});
