(() => {
  const STORAGE_PAYMENTS = "rent_payments";
  const STORAGE_RECEIPTS = "rent_receipts";

  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const WEEKDAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  let payments = JSON.parse(localStorage.getItem(STORAGE_PAYMENTS) || "[]");
  let receipts = JSON.parse(localStorage.getItem(STORAGE_RECEIPTS) || "{}");
  let currentDate = new Date();
  currentDate.setDate(1);
  let currentPayId = null;

  function save() {
    localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(payments));
    localStorage.setItem(STORAGE_RECEIPTS, JSON.stringify(receipts));
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  // A receipt value is either a number (amount paid so far) or the legacy
  // boolean `true` from before partial payments existed (treated as paid in full).
  function getPaidAmount(payment, key) {
    const val = receipts[`${payment.id}_${key}`];
    if (typeof val === "number") return val;
    if (val === true) return payment.amount;
    return 0;
  }

  function getRemaining(payment, key) {
    return Math.max(0, payment.amount - getPaidAmount(payment, key));
  }

  function getStatus(payment, key) {
    const paid = getPaidAmount(payment, key);
    if (paid <= 0) return "pending";
    if (paid >= payment.amount) return "received";
    return "partial";
  }

  function setPaidAmount(payment, key, amount) {
    const rKey = `${payment.id}_${key}`;
    const clamped = Math.max(0, Math.min(amount, payment.amount));
    if (clamped <= 0) delete receipts[rKey];
    else receipts[rKey] = clamped;
    save();
  }

  function formatAmount(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function isVisibleInMonth(p, key) {
    return !p.startMonth || p.startMonth <= key;
  }

  const STATUS_LABELS = { received: "Recibido", partial: "Parcial", pending: "Pendiente" };

  // ---- Elements ----
  const monthLabel = document.getElementById("monthLabel");
  const paymentForm = document.getElementById("paymentForm");
  const labelInput = document.getElementById("label");
  const dayInput = document.getElementById("day");
  const amountInput = document.getElementById("amount");
  const paymentsList = document.getElementById("paymentsList");
  const pendingBadge = document.getElementById("pendingBadge");
  const addModal = document.getElementById("addModal");
  const payModal = document.getElementById("payModal");
  const payForm = document.getElementById("payForm");
  const paidAmountInput = document.getElementById("paidAmount");
  const payModalInfo = document.getElementById("payModalInfo");

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    render();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    render();
  });

  // ---- Add-payment modal ----
  function openModal() {
    addModal.classList.add("open");
    labelInput.focus();
  }
  function closeModal() {
    addModal.classList.remove("open");
    paymentForm.reset();
  }
  document.getElementById("closeModal").addEventListener("click", closeModal);
  addModal.addEventListener("click", (e) => {
    if (e.target === addModal) closeModal();
  });

  paymentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = labelInput.value.trim();
    const day = Math.min(31, Math.max(1, parseInt(dayInput.value, 10)));
    const amount = parseFloat(amountInput.value);
    if (!label || !day || isNaN(amount)) return;

    payments.push({ id: crypto.randomUUID(), label, day, amount, startMonth: monthKey(currentDate) });
    save();
    closeModal();
    render();
  });

  // ---- Register-payment modal ----
  function openPayModal(payment, key) {
    currentPayId = payment.id;
    const paidSoFar = getPaidAmount(payment, key);
    payModalInfo.textContent = `${payment.label} · Total ${formatAmount(payment.amount)}`;
    paidAmountInput.value = paidSoFar > 0 ? paidSoFar : payment.amount;
    payModal.classList.add("open");
    paidAmountInput.focus();
    paidAmountInput.select();
  }
  function closePayModal() {
    payModal.classList.remove("open");
    payForm.reset();
    currentPayId = null;
  }
  document.getElementById("closePayModal").addEventListener("click", closePayModal);
  payModal.addEventListener("click", (e) => {
    if (e.target === payModal) closePayModal();
  });

  payForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat(paidAmountInput.value);
    if (isNaN(amount) || !currentPayId) return;
    const payment = payments.find(p => p.id === currentPayId);
    if (!payment) return;
    setPaidAmount(payment, monthKey(currentDate), amount);
    closePayModal();
    render();
  });

  function deletePayment(id) {
    payments = payments.filter(p => p.id !== id);
    Object.keys(receipts).forEach(k => {
      if (k.startsWith(`${id}_`)) delete receipts[k];
    });
    save();
    render();
  }

  function render() {
    const key = monthKey(currentDate);
    monthLabel.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const sorted = payments.filter(p => isVisibleInMonth(p, key)).sort((a, b) => a.day - b.day);

    paymentsList.innerHTML = "";

    let pendingCount = 0;
    let pendingTotal = 0;

    sorted.forEach(p => {
      const status = getStatus(p, key);
      const paid = getPaidAmount(p, key);
      const remaining = getRemaining(p, key);
      if (status !== "received") {
        pendingCount++;
        pendingTotal += remaining;
      }

      let amountLine;
      if (status === "received") amountLine = `Pagado ${formatAmount(paid)}`;
      else if (status === "partial") amountLine = `Pagado ${formatAmount(paid)} · Faltan ${formatAmount(remaining)}`;
      else amountLine = `Faltan ${formatAmount(remaining)}`;

      const li = document.createElement("li");
      li.innerHTML = `
        <button class="payment-btn ${status}" data-id="${p.id}">
          <span class="payment-day">${p.day}</span>
          <span class="payment-info">
            <span class="payment-label">${p.label}</span>
            <span class="payment-amount">${amountLine}</span>
          </span>
          <span class="payment-status">${STATUS_LABELS[status]}</span>
        </button>
        <button class="icon-btn" data-del="${p.id}" aria-label="Eliminar pago">✕</button>
      `;
      paymentsList.appendChild(li);
    });

    const addLi = document.createElement("li");
    addLi.innerHTML = `<button class="add-payment-btn" aria-label="Agregar pago">+</button>`;
    paymentsList.appendChild(addLi);

    pendingBadge.textContent = pendingCount ? `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""} · ${formatAmount(pendingTotal)}` : "";

    paymentsList.querySelectorAll(".payment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const payment = payments.find(p => p.id === btn.dataset.id);
        if (payment) openPayModal(payment, key);
      });
    });
    paymentsList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("¿Eliminar este pago?")) deletePayment(btn.dataset.del);
      });
    });
    paymentsList.querySelector(".add-payment-btn").addEventListener("click", openModal);
  }

  // ---- PDF export (calendar for the currently viewed month) ----
  document.getElementById("exportPdf").addEventListener("click", () => {
    buildPrintCalendar();
    window.print();
  });

  function buildPrintCalendar() {
    const key = monthKey(currentDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    document.getElementById("printTitle").textContent =
      `${MONTH_NAMES[month]} ${year} — Calendario de Renta`;

    const paymentsByDay = {};
    payments.forEach(p => {
      if (p.day <= daysInMonth && isVisibleInMonth(p, key)) {
        (paymentsByDay[p.day] = paymentsByDay[p.day] || []).push(p);
      }
    });

    const grid = document.getElementById("printCalendar");
    grid.innerHTML = "";
    WEEKDAYS.forEach(w => {
      const el = document.createElement("div");
      el.className = "weekday";
      el.textContent = w;
      grid.appendChild(el);
    });

    for (let i = 0; i < firstWeekday; i++) {
      const el = document.createElement("div");
      el.className = "day-cell empty-cell";
      grid.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement("div");
      cell.className = "day-cell";
      const num = document.createElement("div");
      num.className = "day-number";
      num.textContent = day;
      cell.appendChild(num);

      (paymentsByDay[day] || []).forEach(p => {
        const mark = document.createElement("span");
        const status = getStatus(p, key);
        const remaining = getRemaining(p, key);
        mark.className = `payment-mark ${status}`;
        mark.textContent = status === "received"
          ? `${p.label} · ${formatAmount(p.amount)}`
          : `${p.label} · Faltan ${formatAmount(remaining)}`;
        cell.appendChild(mark);
      });

      grid.appendChild(cell);
    }

    // Summary table beneath calendar
    const sorted = payments.filter(p => p.day <= daysInMonth && isVisibleInMonth(p, key)).sort((a, b) => a.day - b.day);
    const table = document.getElementById("printTable");
    let rows = `<tr><th>Día</th><th>Descripción</th><th>Monto</th><th>Estado</th></tr>`;
    sorted.forEach(p => {
      const status = getStatus(p, key);
      const paid = getPaidAmount(p, key);
      const statusText = status === "partial"
        ? `Parcial (pagó ${formatAmount(paid)} de ${formatAmount(p.amount)})`
        : STATUS_LABELS[status];
      rows += `<tr><td>${p.day}</td><td>${p.label}</td><td>${formatAmount(p.amount)}</td><td>${statusText}</td></tr>`;
    });
    table.innerHTML = rows;
  }

  render();
})();
