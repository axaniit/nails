// ===== CONFIG =====
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8UBWKpYgbqdRJouFH3ESdelrEt4BesAPm35MP7aI4Gz5rZg7RzgbTBTYafPSJswnH/exec";
const TIMEZONE = "America/New_York";

// ===== Simple demo availability (replace later with sheet-driven availability) =====
// We'll generate slots for the next 14 days: 12pm, 2pm, 4pm, 6pm
function buildDemoSlots() {
  const slots = [];
  const now = new Date();
  const days = 14;
  const startHours = [12, 14, 16, 18];
  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    for (const h of startHours) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 2); // 2-hr default
      slots.push({ start, end });
    }
  }
  return slots;
}

function fmt(dt) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  }).format(dt);
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4200);
}

// ===== Modal helpers =====
function openModal(id) {
  document.getElementById(id).classList.add("show");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

// ===== Page init for booking =====
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("slotGrid")) return;

  const slots = buildDemoSlots();

  // Render slots
  const grid = document.getElementById("slotGrid");
  grid.innerHTML = "";
  slots.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `
      <b>${fmt(s.start)}</b>
      <span class="badge">2 hours</span>
      <div style="height:8px"></div>
      <button class="secondary" data-idx="${idx}">Request this time</button>
    `;
    grid.appendChild(div);
  });

  // Populate dropdown in booking form
  const slotSelect = document.getElementById("slotSelect");
  slots.forEach((s, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${fmt(s.start)} — ${fmt(s.end)}`;
    slotSelect.appendChild(opt);
  });

  // Clicking slot -> open booking modal and preselect
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-idx]");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    slotSelect.value = String(idx);
    syncSelectedSlotToHidden(slots);
    openModal("bookingModal");
  });

  // Open booking modal via button
  document.getElementById("openBookingBtn").addEventListener("click", () => {
    syncSelectedSlotToHidden(slots);
    openModal("bookingModal");
  });

  // Close modals
  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });

  // Slot select change
  slotSelect.addEventListener("change", () => syncSelectedSlotToHidden(slots));

  // Address type toggle
  const addressType = document.getElementById("addressType");
  const addressOtherWrap = document.getElementById("addressOtherWrap");
  addressType.addEventListener("change", () => {
    if (addressType.value === "other") addressOtherWrap.style.display = "block";
    else addressOtherWrap.style.display = "none";
  });

  // Submit booking
  document.getElementById("bookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    syncSelectedSlotToHidden(slots);

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;

    try {
      const fd = new FormData(e.target);

      // We are NOT uploading the inspo file to Drive yet in this version,
      // but we accept it as optional and ignore it for now.
      // Later we can add Drive upload via base64 if you want.

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
        inspo_file_url: "" // placeholder
      };

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script likes text/plain
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Request failed");

      closeModal("bookingModal");
      openModal("submittedModal");
      // reset form
      e.target.reset();
      addressOtherWrap.style.display = "none";
      toast("Request received! Approval required to confirm.");

    } catch (err) {
      console.error(err);
      toast("Something went wrong submitting your request. Try again.");
    } finally {
      btn.disabled = false;
    }
  });

  function syncSelectedSlotToHidden(slots) {
    const idx = Number(slotSelect.value || 0);
    const s = slots[idx];
    document.getElementById("requestedStart").value = s.start.toISOString();
    document.getElementById("requestedEnd").value = s.end.toISOString();
    document.getElementById("selectedSlotText").textContent = `${fmt(s.start)} — ${fmt(s.end)}`;
  }
});
