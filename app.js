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

  function save() {
    localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(payments));
    localStorage.setItem(STORAGE_RECEIPTS, JSON.stringify(receipts));
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function isReceived(paymentId, key) {
    return !!receipts[`${paymentId}_${key}`];
  }

  function setReceived(paymentId, key, value) {
    const rKey = `${paymentId}_${key}`;
    if (value) receipts[rKey] = true;
    else delete receipts[rKey];
    save();
  }

  function formatAmount(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  // ---- Elements ----
  const monthLabel = document.getElementById("monthLabel");
  const paymentForm = document.getElementById("paymentForm");
  const labelInput = document.getElementById("label");
  const dayInput = document.getElementById("day");
  const amountInput = document.getElementById("amount");
  const paymentsList = document.getElementById("paymentsList");
  const pendingBadge = document.getElementById("pendingBadge");
  const addModal = document.getElementById("addModal");

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

    payments.push({ id: crypto.randomUUID(), label, day, amount });
    save();
    closeModal();
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

    const sorted = [...payments].sort((a, b) => a.day - b.day);

    paymentsList.innerHTML = "";

    let pendingCount = 0;
    let pendingTotal = 0;

    sorted.forEach(p => {
      const received = isReceived(p.id, key);
      if (!received) {
        pendingCount++;
        pendingTotal += p.amount;
      }
      const li = document.createElement("li");
      li.innerHTML = `
        <button class="payment-btn ${received ? "received" : "pending"}" data-id="${p.id}">
          <span class="payment-day">${p.day}</span>
          <span class="payment-info">
            <span class="payment-label">${p.label}</span>
            <span class="payment-amount">${formatAmount(p.amount)}</span>
          </span>
          <span class="payment-status">${received ? "Recibido" : "Pendiente"}</span>
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
        setReceived(btn.dataset.id, key, !isReceived(btn.dataset.id, key));
        render();
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
      if (p.day <= daysInMonth) {
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
        const received = isReceived(p.id, key);
        mark.className = `payment-mark ${received ? "received" : "pending"}`;
        mark.textContent = `${p.label} · ${formatAmount(p.amount)}`;
        cell.appendChild(mark);
      });

      grid.appendChild(cell);
    }

    // Summary table beneath calendar
    const sorted = [...payments].filter(p => p.day <= daysInMonth).sort((a, b) => a.day - b.day);
    const table = document.getElementById("printTable");
    let rows = `<tr><th>Día</th><th>Descripción</th><th>Monto</th><th>Estado</th></tr>`;
    sorted.forEach(p => {
      const received = isReceived(p.id, key);
      rows += `<tr><td>${p.day}</td><td>${p.label}</td><td>${formatAmount(p.amount)}</td><td>${received ? "Recibido" : "Pendiente"}</td></tr>`;
    });
    table.innerHTML = rows;
  }

  render();
})();
