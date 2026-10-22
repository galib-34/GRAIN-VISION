// ==========================================
// 1. DYNAMIC BACKEND URL ROUTING (No hardcoded 127.0.0.1)
// ==========================================
function resolveBackendUrl() {
  if (window.GRAIN_VISION_API) {
    return window.GRAIN_VISION_API.replace(/\/$/, "");
  }
  // In development: if loaded from frontend dev server on e.g. port 5500, target port 8000 on the same host/IP
  if (window.location.port && window.location.port !== "80" && window.location.port !== "443" && window.location.port !== "8000") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  // In production / reverse-proxied deployments: use relative paths ("") to avoid CORS & SSL mismatches
  return "";
}

const API = resolveBackendUrl();

// ==========================================
// 2. SECTION 3: MOBILE CAMERA CODE PLACEMENT
// ==========================================
document.getElementById('capture-btn').addEventListener('click', () => {
    document.getElementById('grain-camera-input').click();
});

document.getElementById('grain-camera-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0] || event.target.files;
    if (file) {
        // Pass this file object directly to the existing image processing/upload function
        uploadGrainImage(file); 
    }
});

// Gallery file selection listener
const galleryBtn = document.getElementById("gallery-btn");
const galleryInput = document.getElementById("gallery-input");
if (galleryBtn && galleryInput) {
  galleryBtn.addEventListener("click", () => galleryInput.click());
  galleryInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) uploadGrainImage(file);
  });
}

// ==========================================
// 3. APPLICATION STATE & LOCAL STORAGE
// ==========================================
let activeSampleFile = null;
let currentLotId = null;
let currentLotWeightKg = null;
let activeWeightUnit = "kg"; // 'kg' or 'qtl'
let authToken = localStorage.getItem("grainvision_token") || null;
let currentUser = null;

// UI Elements
const preview = document.getElementById("preview");
const previewWrap = document.getElementById("previewWrap");
const compressionBadge = document.getElementById("compressionBadge");
const analyzeBtn = document.getElementById("analyzeBtn");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const newBtn = document.getElementById("newBtn");

// Weight Elements
const lotWeightInput = document.getElementById("lotWeightInput");
const unitKgBtn = document.getElementById("unitKgBtn");
const unitQtlBtn = document.getElementById("unitQtlBtn");

// Seller Elements
const sellerSelect = document.getElementById("sellerSelect");
const toggleNewSellerBtn = document.getElementById("toggleNewSellerBtn");
const newSellerForm = document.getElementById("newSellerForm");
const saveSellerBtn = document.getElementById("saveSellerBtn");
const newSellerName = document.getElementById("newSellerName");
const newSellerPhone = document.getElementById("newSellerPhone");
const newSellerLocation = document.getElementById("newSellerLocation");
const newSellerCode = document.getElementById("newSellerCode");

// Auth Elements
const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authForm = document.getElementById("authForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const fullNameGroup = document.getElementById("fullNameGroup");
const authFullName = document.getElementById("authFullName");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const submitAuthBtn = document.getElementById("submitAuthBtn");
const userNameDisplay = document.getElementById("userNameDisplay");
let authMode = "login";

// Decision Elements
const acceptLotBtn = document.getElementById("acceptLotBtn");
const rejectLotBtn = document.getElementById("rejectLotBtn");
const rejectModal = document.getElementById("rejectModal");
const closeRejectModal = document.getElementById("closeRejectModal");
const cancelRejectBtn = document.getElementById("cancelRejectBtn");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");
const rejectionReasonSelect = document.getElementById("rejectionReasonSelect");
const rejectionNotes = document.getElementById("rejectionNotes");
const lotStatusBadge = document.getElementById("lotStatusBadge");

// ==========================================
// 4. CLIENT-SIDE CANVAS COMPRESSION (High-Density & Low-Bandwidth)
// ==========================================
async function uploadGrainImage(file) {
  if (!file) return;

  // Revoke previous object URL if any
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);

  const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  // If image is large (> 1.5MB), compress using HTML5 canvas to prevent network timeouts on rural 3G/4G
  if (file.size > 1.5 * 1024 * 1024) {
    compressionBadge.classList.remove("hidden");
    compressionBadge.textContent = `Optimizing ${originalSizeMB} MB capture for mobile upload...`;
    
    try {
      const compressedBlob = await compressImageOnCanvas(file, 1600, 0.85);
      activeSampleFile = new File([compressedBlob], file.name || "sample.jpg", { type: "image/jpeg" });
      const compressedSizeKB = Math.round(compressedBlob.size / 1024);
      compressionBadge.textContent = `Optimized: ${originalSizeMB} MB → ${compressedSizeKB} KB (Ready)`;
    } catch (err) {
      console.warn("Canvas compression failed, falling back to raw file:", err);
      activeSampleFile = file;
      compressionBadge.textContent = `Original size: ${originalSizeMB} MB`;
    }
  } else {
    activeSampleFile = file;
    compressionBadge.classList.remove("hidden");
    compressionBadge.textContent = `Sample size: ${Math.round(file.size / 1024)} KB (Ready)`;
  }

  // Display preview
  preview.dataset.objectUrl = URL.createObjectURL(activeSampleFile);
  preview.src = preview.dataset.objectUrl;
  previewWrap.classList.remove("hidden");
  result.classList.add("hidden");

  // Scroll to preview smoothly
  previewWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function compressImageOnCanvas(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 5. LOT WEIGHT HANDLING
// ==========================================
unitKgBtn.addEventListener("click", () => {
  activeWeightUnit = "kg";
  unitKgBtn.classList.add("active");
  unitQtlBtn.classList.remove("active");
  syncWeightCalculation();
});

unitQtlBtn.addEventListener("click", () => {
  activeWeightUnit = "qtl";
  unitQtlBtn.classList.add("active");
  unitKgBtn.classList.remove("active");
  syncWeightCalculation();
});

lotWeightInput.addEventListener("input", syncWeightCalculation);

function syncWeightCalculation() {
  const val = parseFloat(lotWeightInput.value);
  if (isNaN(val) || val <= 0) {
    currentLotWeightKg = null;
  } else {
    currentLotWeightKg = activeWeightUnit === "qtl" ? val * 100.0 : val;
  }
}

// ==========================================
// 6. SELLER MANAGEMENT
// ==========================================
toggleNewSellerBtn.addEventListener("click", () => {
  newSellerForm.classList.toggle("hidden");
  toggleNewSellerBtn.textContent = newSellerForm.classList.contains("hidden") 
    ? "+ New Farmer Profile" 
    : "✕ Cancel Farmer Form";
});

saveSellerBtn.addEventListener("click", async () => {
  const name = newSellerName.value.trim();
  const phone = newSellerPhone.value.trim();
  const location = newSellerLocation.value.trim();
  const code = newSellerCode.value.trim();

  if (!name || !phone) {
    alert("Please enter the farmer's name and mobile number.");
    return;
  }

  try {
    saveSellerBtn.disabled = true;
    const res = await apiFetch(`${API}/api/sellers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, location, seller_code: code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to save farmer profile.");

    // Add to dropdown and select
    const opt = document.createElement("option");
    opt.value = data.seller.id;
    opt.textContent = `${data.seller.name} (${data.seller.phone}${data.seller.location ? ` · ${data.seller.location}` : ""})`;
    opt.selected = true;
    sellerSelect.append(opt);

    // Reset and hide form
    newSellerName.value = "";
    newSellerPhone.value = "";
    newSellerLocation.value = "";
    newSellerCode.value = "";
    newSellerForm.classList.add("hidden");
    toggleNewSellerBtn.textContent = "+ New Farmer Profile";
  } catch (err) {
    alert(`Could not save farmer profile: ${err.message}`);
  } finally {
    saveSellerBtn.disabled = false;
  }
});

async function loadSellers() {
  try {
    const res = await apiFetch(`${API}/api/sellers`);
    if (!res.ok) return;
    const data = await res.json();
    sellerSelect.replaceChildren();

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "-- Choose saved farmer --";
    sellerSelect.append(defaultOpt);

    for (const seller of data.sellers || []) {
      const opt = document.createElement("option");
      opt.value = seller.id;
      opt.textContent = `${seller.name} (${seller.phone}${seller.location ? ` · ${seller.location}` : ""})`;
      sellerSelect.append(opt);
    }
  } catch (err) {
    console.warn("Could not load sellers:", err);
  }
}

// ==========================================
// 7. AUTHENTICATION & SESSION HANDLING
// ==========================================
function getAuthHeaders() {
  const headers = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

function apiFetch(url, options = {}) {
  options.headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, options);
}

authBtn.addEventListener("click", () => {
  authModal.classList.remove("hidden");
});

closeAuthModal.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

tabLogin.addEventListener("click", () => {
  authMode = "login";
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  fullNameGroup.style.display = "none";
  submitAuthBtn.textContent = "Sign In";
});

tabRegister.addEventListener("click", () => {
  authMode = "register";
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  fullNameGroup.style.display = "flex";
  submitAuthBtn.textContent = "Create Profile";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = authUsername.value.trim();
  const password = authPassword.value;
  const fullName = authFullName.value.trim();

  const endpoint = authMode === "register" ? `${API}/api/auth/register` : `${API}/api/auth/login`;
  const body = authMode === "register"
    ? { username, password, full_name: fullName }
    : { username, password };

  try {
    submitAuthBtn.disabled = true;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Authentication failed.");

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("grainvision_token", authToken);
    userNameDisplay.textContent = currentUser.full_name || currentUser.username;

    authModal.classList.add("hidden");
    authPassword.value = "";
    loadDashboardStats();
    loadSellers();
  } catch (err) {
    alert(`Authentication Error: ${err.message}`);
  } finally {
    submitAuthBtn.disabled = false;
  }
});

async function checkCurrentUser() {
  try {
    const res = await apiFetch(`${API}/api/auth/me`);
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      userNameDisplay.textContent = currentUser.full_name || currentUser.username;
    }
  } catch (err) {
    console.warn("Could not check current user:", err);
  }
}

// ==========================================
// 8. DASHBOARD HUB STATS & LEDGER
// ==========================================
async function loadDashboardStats() {
  try {
    const res = await apiFetch(`${API}/api/dashboard/stats`);
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById("statTotalLots").textContent = stats.total_lots.toLocaleString("en-IN");
    document.getElementById("statAcceptedLots").textContent = stats.accepted_lots.toLocaleString("en-IN");
    document.getElementById("statRejectedLots").textContent = stats.rejected_lots.toLocaleString("en-IN");
    document.getElementById("statTotalValue").textContent = `₹${Math.round(stats.total_procurement_value).toLocaleString("en-IN")}`;

    renderHistory(stats.recent_activity || []);
  } catch (err) {
    console.warn("Could not load dashboard stats:", err);
  }
}

function renderHistory(lots) {
  const list = document.getElementById("historyList");
  list.replaceChildren();

  if (!lots || lots.length === 0) {
    const p = document.createElement("p");
    p.className = "muted empty";
    p.textContent = "No lot records in ledger yet.";
    list.append(p);
    return;
  }

  for (const item of lots) {
    const card = document.createElement("div");
    card.className = "history-item";

    const left = document.createElement("div");
    left.className = "history-meta";
    const title = document.createElement("strong");
    title.textContent = `${item.lot_id} · ${item.seller_name || "Unassigned"}`;
    const date = document.createElement("span");
    date.className = "muted small-note";
    date.textContent = `${item.created_at ? new Date(item.created_at).toLocaleString() : "Recent"} · ${item.weight_kg ? `${item.weight_kg} kg` : "Sample"}`;
    left.append(title, date);

    const right = document.createElement("div");
    right.className = "history-right";
    const statusSpan = document.createElement("span");
    statusSpan.className = `badge ${item.status || "assessed"}`;
    statusSpan.textContent = (item.status || "assessed").toUpperCase();

    const priceSpan = document.createElement("strong");
    priceSpan.textContent = item.total_estimated_price ? `₹${item.total_estimated_price.toLocaleString("en-IN")}` : `Score: ${item.quality_score || "--"}`;
    right.append(statusSpan, priceSpan);

    card.append(left, right);
    list.append(card);
  }
}

// ==========================================
// 9. HIGH-DENSITY SAMPLE ANALYSIS
// ==========================================
analyzeBtn.addEventListener("click", analyzeSample);
newBtn.addEventListener("click", resetSampleWorkflow);

async function analyzeSample() {
  if (!activeSampleFile) {
    alert("Please snap or choose a rice grain sample first.");
    return;
  }

  syncWeightCalculation();

  loading.classList.remove("hidden");
  result.classList.add("hidden");
  analyzeBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("image", activeSampleFile);
    if (currentLotWeightKg) {
      formData.append("lot_weight_kg", currentLotWeightKg);
    }
    const selectedSellerId = sellerSelect.value;
    if (selectedSellerId) {
      formData.append("seller_id", selectedSellerId);
    }
    formData.append("save_lot", "true");

    const response = await apiFetch(`${API}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Analysis encountered a server error.");
    }

    renderAssessmentResult(data);
    loadDashboardStats();
  } catch (error) {
    alert(`Analysis Failed: ${error.message}\n\nTip: Ensure grains are spread on a flat, contrasting background and check your device connection.`);
  } finally {
    loading.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
}

function resetSampleWorkflow() {
  activeSampleFile = null;
  currentLotId = null;
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.src = "";
  previewWrap.classList.add("hidden");
  result.classList.add("hidden");
  lotWeightInput.value = "";
  compressionBadge.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// 10. RESULT RENDERING & TRANSPARENT PRICING
// ==========================================
function renderAssessmentResult(data) {
  const metrics = data.metrics || {};
  const reference = data.price_reference || {};
  const lot = data.lot || {};

  currentLotId = lot.lot_id || null;

  // Header and Metadata
  document.getElementById("lotIdHeader").textContent = lot.lot_id ? `Assessment — ${lot.lot_id}` : "Sample Assessment Result";
  document.getElementById("resSellerName").textContent = lot.seller_name || (sellerSelect.options[sellerSelect.selectedIndex]?.text.split("(")[0].trim()) || "Unassigned";
  document.getElementById("resWeight").textContent = currentLotWeightKg ? `${currentLotWeightKg.toLocaleString("en-IN")} kg (${(currentLotWeightKg / 100).toFixed(2)} quintals)` : "Sample Only";
  
  lotStatusBadge.textContent = "ASSESSED";
  lotStatusBadge.className = "badge assessed";

  // Score
  const scoreVal = metrics.quality_score != null ? metrics.quality_score : "--";
  document.getElementById("qualityScoreVal").innerHTML = `${scoreVal}<small>/100</small>`;
  const categoryElem = document.getElementById("qualityCategory");
  if (scoreVal >= 80) {
    categoryElem.textContent = "Grade Tier: High Quality (Low Defects)";
  } else if (scoreVal >= 60) {
    categoryElem.textContent = "Grade Tier: Moderate Quality (Average Defects)";
  } else {
    categoryElem.textContent = "Grade Tier: High Defect / Cautionary Lot";
  }

  // Mandi Strip
  const marketPrice = reference.modal_price_per_quintal;
  document.getElementById("marketReference").textContent = marketPrice == null
    ? "Reference Unavailable"
    : `₹${Number(marketPrice).toLocaleString("en-IN")} / quintal`;
  document.getElementById("marketReferenceNote").textContent = [reference.market, reference.district, reference.date].filter(Boolean).join(" · ") || "Regional Paddy Modal Reference";
  document.getElementById("marketReferenceLink").href = reference.source_url || "https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi";

  // Pricing Breakdown Table
  const table = document.getElementById("breakdownTable");
  table.replaceChildren();

  const breakdowns = metrics.price_breakdown || [];
  if (breakdowns.length > 0) {
    for (const item of breakdowns) {
      const row = document.createElement("div");
      row.className = "breakdown-row";
      const name = document.createElement("span");
      name.className = "comp-name";
      name.textContent = item.component;
      const val = document.createElement("span");
      val.className = "comp-val";
      val.textContent = item.value;
      row.append(name, val);
      table.append(row);
    }
  } else {
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `<span class="comp-name">Pricing Engine</span><span class="comp-val">${metrics.price_method || "Baseline rate unavailable"}</span>`;
    table.append(row);
  }

  const totalPayout = metrics.total_estimated_lot_price != null
    ? `₹${Number(metrics.total_estimated_lot_price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : (metrics.estimated_price_per_kg ? `₹${metrics.estimated_price_per_kg.toFixed(2)} / kg` : "N/A");
  document.getElementById("totalPayoutDisplay").textContent = totalPayout;

  // Defect breakdown cards
  const metricsContainer = document.getElementById("metrics");
  metricsContainer.replaceChildren();

  const totalCard = document.createElement("article");
  totalCard.className = "metric total";
  totalCard.innerHTML = `<strong class="total-count">${(metrics.total_grains || 0).toLocaleString("en-IN")}</strong><span class="class-count">Total Grains Counted</span>`;
  metricsContainer.append(totalCard);

  const breakdown = [...(metrics.class_breakdown || [])].sort((a, b) => a.priority - b.priority);
  for (const row of breakdown) {
    const card = document.createElement("article");
    card.className = "metric";
    card.innerHTML = `
      <span class="class-name">${displayClass(row.class)}</span>
      <span class="class-count">${row.count.toLocaleString("en-IN")} grains</span>
      <span class="class-percent">${row.percentage}% of sample</span>
    `;
    metricsContainer.append(card);
  }

  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function displayClass(name) {
  return String(name).replaceAll("-", " ").replace(/\b\w/g, l => l.toUpperCase());
}

// ==========================================
// 11. ACCEPT / REJECT PROCUREMENT DECISION
// ==========================================
acceptLotBtn.addEventListener("click", async () => {
  if (!currentLotId) {
    alert("No active lot assessment to accept.");
    return;
  }
  await recordLotDecision("accepted", null, "Lot accepted by procurement officer.");
});

rejectLotBtn.addEventListener("click", () => {
  if (!currentLotId) {
    alert("No active lot assessment to reject.");
    return;
  }
  rejectModal.classList.remove("hidden");
});

closeRejectModal.addEventListener("click", () => rejectModal.classList.add("hidden"));
cancelRejectBtn.addEventListener("click", () => rejectModal.classList.add("hidden"));

confirmRejectBtn.addEventListener("click", async () => {
  const reason = rejectionReasonSelect.value;
  const notes = rejectionNotes.value.trim();
  rejectModal.classList.add("hidden");
  await recordLotDecision("rejected", reason, notes);
});

async function recordLotDecision(decision, reason, notes) {
  try {
    const res = await apiFetch(`${API}/api/lots/${currentLotId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, rejection_reason: reason, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to record decision.");

    lotStatusBadge.textContent = decision.toUpperCase();
    lotStatusBadge.className = `badge ${decision}`;
    alert(`Determination recorded: Lot ${currentLotId} marked as ${decision.toUpperCase()}.`);

    loadDashboardStats();
  } catch (err) {
    alert(`Could not record decision: ${err.message}`);
  }
}

// ==========================================
// 12. INITIALIZATION & SERVICE WORKER
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  checkCurrentUser();
  loadSellers();
  loadDashboardStats();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}
