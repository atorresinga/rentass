(() => {
  const PIN_HASH = "96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e";
  const UNLOCK_KEY = "renta_unlocked";
  const MAX_ATTEMPTS = 5;
  let attempts = 0;

  const lockScreen = document.getElementById("lockScreen");
  const appRoot = document.getElementById("appRoot");
  const lockForm = document.getElementById("lockForm");
  const pinInput = document.getElementById("pinInput");
  const lockError = document.getElementById("lockError");
  const submitBtn = lockForm.querySelector("button[type='submit']");

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function unlock() {
    localStorage.setItem(UNLOCK_KEY, "1");
    lockScreen.style.display = "none";
    appRoot.style.display = "block";
  }

  if (localStorage.getItem(UNLOCK_KEY) === "1") {
    unlock();
  } else {
    pinInput.focus();
  }

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(pinInput.value.trim());
    if (hash === PIN_HASH) {
      unlock();
      return;
    }
    attempts++;
    pinInput.value = "";
    if (attempts >= MAX_ATTEMPTS) {
      lockError.textContent = "Demasiados intentos. Actualiza la página para intentar de nuevo.";
      pinInput.disabled = true;
      submitBtn.disabled = true;
    } else {
      lockError.textContent = `Código incorrecto. Intento ${attempts} de ${MAX_ATTEMPTS}.`;
      pinInput.focus();
    }
  });
})();
