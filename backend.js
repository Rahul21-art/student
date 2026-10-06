/* =========================================================
   GeoGaurd shared backend helper (Firebase Realtime Database, REST)
   Load this before the other scripts in BOTH the simulator
   and the student app.
   ========================================================= */

const DB_URL = "https://geo-gaurd-default-rtdb.asia-southeast1.firebasedatabase.app";
const VIEW_POLL_MS = 2000;

function backendReady() {
    return !DB_URL.includes("YOUR-PROJECT");
}

/* Save / update one student: /students/<studentId> */
async function publishStudent(data) {
    if (!backendReady()) {
        console.warn("backend.js: set DB_URL first.");
        return false;
    }
    try {
        const res = await fetch(
            `${DB_URL}/students/${encodeURIComponent(data.studentId)}.json`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
            }
        );
        return res.ok;
    } catch (e) {
        console.warn("publishStudent failed:", e);
        return false;
    }
}

/* Show every student, refreshed every VIEW_POLL_MS */
function startStudentsView(containerId, statusId) {
    const box = document.getElementById(containerId);
    const status = statusId ? document.getElementById(statusId) : null;

    const esc = (v) => String(v ?? "--").replace(/[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    function setStatus(cls, text) {
        if (!status) return;
        status.textContent = text;
        status.classList.remove("connected", "connecting", "disconnected");
        status.classList.add(cls);
    }

    function render(students) {
        const ids = Object.keys(students || {}).sort();
        if (ids.length === 0) {
            box.textContent = "No students yet.";
            return;
        }
        const th = "text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b;";
        const td = "padding:8px;border-bottom:1px solid #f1f5f9;font-size:13px;white-space:nowrap;";
        let html = `<table style="width:100%;border-collapse:collapse"><tr>
            <th style="${th}">Student</th><th style="${th}">Latitude</th><th style="${th}">Longitude</th>
            <th style="${th}">Battery</th><th style="${th}">SOS</th><th style="${th}">Updated</th></tr>`;
        ids.forEach((id) => {
            const s = students[id] || {};
            const sosOn = String(s.sos).toUpperCase() === "ON";
            const t = s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString() : "--";
            html += `<tr>
                <td style="${td}"><strong>${esc(s.studentId || id)}</strong></td>
                <td style="${td}">${Number.isFinite(+s.latitude) ? (+s.latitude).toFixed(6) : "--"}</td>
                <td style="${td}">${Number.isFinite(+s.longitude) ? (+s.longitude).toFixed(6) : "--"}</td>
                <td style="${td}">${esc(s.battery)}%</td>
                <td style="${td}color:${sosOn ? "#dc2626" : "#15803d"};font-weight:700">${sosOn ? "SOS ACTIVE" : "OFF"}</td>
                <td style="${td}">${esc(t)}</td></tr>`;
        });
        box.innerHTML = html + "</table>";
    }

    async function tick() {
        if (!backendReady()) {
            setStatus("disconnected", "Set DB_URL");
            box.textContent = "Set DB_URL in backend.js";
            return;
        }
        try {
            const res = await fetch(`${DB_URL}/students.json`, { cache: "no-store" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            render(await res.json());
            setStatus("connected", "Live");
        } catch (e) {
            console.warn("students fetch failed:", e);
            setStatus("disconnected", "Offline");
        }
    }

    tick();
    return setInterval(tick, VIEW_POLL_MS);
}