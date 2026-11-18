(() => {
  const loginForm = document.getElementById("loginForm");
  const loginPanel = document.getElementById("loginPanel");
  const recordsPanel = document.getElementById("recordsPanel");
  const loginStatus = document.getElementById("loginStatus");
  const recordsStatus = document.getElementById("recordsStatus");
  const recordsBody = document.getElementById("recordsBody");
  const recordCount = document.getElementById("recordCount");
  const pageStatus = document.getElementById("pageStatus");
  const pageSize = 50;
  let adminKey = "";
  let offset = 0;
  let total = 0;

  function cell(row, value) {
    const td = document.createElement("td");
    td.textContent = value == null || value === "" ? "—" : String(value);
    row.appendChild(td);
  }
  function createRecordRow(item) {
    const row = document.createElement("tr");
    cell(row, `MMS-${String(item.id).padStart(6, "0")} · ${item.created_at || ""}`);
    cell(row, item.parent_name);
    cell(row, [item.phone, item.email].filter(Boolean).join(" / "));
    cell(row, item.learner_name);
    cell(row, item.grade);
    cell(row, item.message);
    return row;
  }
  async function loadRecords() {
    recordsStatus.textContent = "Loading records…";
    recordsBody.replaceChildren();
    try {
      const response = await fetch(`/api/admin/applications?limit=${pageSize}&offset=${offset}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load records.");
      total = data.total;
      const records = data.applications || [];
      if (!records.length) {
        const row = document.createElement("tr");
        const empty = document.createElement("td");
        empty.colSpan = 6;
        empty.textContent = "No enquiries have been submitted yet.";
        row.appendChild(empty);
        recordsBody.appendChild(row);
      } else {
        records.forEach(item => recordsBody.appendChild(createRecordRow(item)));
      }
      recordCount.textContent = `${total} enquiry record${total === 1 ? "" : "s"}`;
      pageStatus.textContent = `Page ${Math.floor(offset / pageSize) + 1} of ${Math.max(1, Math.ceil(total / pageSize))}`;
      document.getElementById("previousButton").disabled = offset === 0;
      document.getElementById("nextButton").disabled = offset + pageSize >= total;
      recordsStatus.textContent = "Records loaded. Keep this information confidential.";
    } catch (error) {
      recordsStatus.textContent = error.message;
      if (/access denied/i.test(error.message)) logout();
    }
  }
  function unlock(key) {
    adminKey = key;
    loginPanel.hidden = true;
    recordsPanel.hidden = false;
    offset = 0;
    loadRecords();
  }
  function logout() {
    adminKey = "";
    document.getElementById("adminKey").value = "";
    recordsPanel.hidden = true;
    loginPanel.hidden = false;
    loginStatus.textContent = "You have been logged out. Enter the administrator key to continue.";
  }

  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const key = document.getElementById("adminKey").value;
    if (key) unlock(key);
  });
  document.getElementById("refreshButton").addEventListener("click", loadRecords);
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("previousButton").addEventListener("click", () => {
    offset = Math.max(0, offset - pageSize);
    loadRecords();
  });
  document.getElementById("nextButton").addEventListener("click", () => {
    if (offset + pageSize < total) offset += pageSize;
    loadRecords();
  });
  document.getElementById("exportButton").addEventListener("click", async () => {
    recordsStatus.textContent = "Preparing secure CSV export…";
    try {
      const response = await fetch("/api/admin/applications.csv", {
        headers: { "x-admin-key": adminKey },
        cache: "no-store"
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mandla-mbatha-admission-enquiries.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      recordsStatus.textContent = "CSV exported. Store the file securely.";
    } catch (error) {
      recordsStatus.textContent = error.message;
      if (/access denied/i.test(error.message)) logout();
    }
  });
})();
