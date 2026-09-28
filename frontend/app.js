const input = document.getElementById("urlInput");
const btn = document.getElementById("shortenBtn");
const result = document.getElementById("result");
const shortUrlEl = document.getElementById("shortUrl");
const errorEl = document.getElementById("error");
const copyBtn = document.getElementById("copyBtn");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
  result.style.display = "none";
}

async function shorten() {
  const url = input.value.trim();
  errorEl.style.display = "none";
  if (!url) return showError("paste a URL first 🙂");

  const base = (window.API_BASE_URL || "").replace(/\/$/, "");
  if (!base || base.includes("REPLACE_WITH_API_URL")) {
    return showError("API not configured yet — set API_BASE_URL in config.js after deploying.");
  }

  btn.disabled = true;
  btn.textContent = "…";
  try {
    const res = await fetch(`${base}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "something went wrong");
    const shortUrl = `${base}/${data.code}`;
    shortUrlEl.textContent = shortUrl;
    result.style.display = "block";
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Shorten";
  }
}

btn.addEventListener("click", shorten);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") shorten(); });
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(shortUrlEl.textContent);
  copyBtn.textContent = "Copied ✓";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});
