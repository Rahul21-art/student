/* =========================================================
   GeoGaurd Student App - app.js

   TRACKER (ESP32 or simulator)  --BLE-->  this app  --HTTPS-->  Backend  -->  Dashboard

   BLE contract (same for simulator and real hardware):
     Device name : starts with "GG"   (e.g. GG001)
     Service     : 00009001-0000-1000-8000-00805f9b34fb  (0x9001)
     Characteristic: 00009002-0000-1000-8000-00805f9b34fb (0x9002), Read + Notify
     Value (UTF-8 JSON, may arrive in several 20-byte chunks):
       {"studentId":"ST001","latitude":18.1065,"longitude":83.3955,"battery":87,"sos":"OFF"}
     Short keys id / lat / lon / bat are also accepted.
   ========================================================= */

const SERVICE_UUID = "00009001-0000-1000-8000-00805f9b34fb";
const CHARACTERISTIC_UUID = "00009002-0000-1000-8000-00805f9b34fb";
const TRACKER_NAME_PREFIX = "GG";

const WATCHDOG_MS = 3000;        // check data flow every 3 s
const POLL_IF_IDLE_MS = 3000;    // read manually if nothing arrived for this long
const NO_DATA_MS = 10000;        // show "No recent data" after this long
const MAX_BUFFER_CHARS = 2000;
const MAX_RECONNECT = 5;

/* ---------- State ---------- */
let bluetoothDevice = null;
let bleServer = null;
let bleService = null;
let bleCharacteristic = null;

let isConnected = false;
let userDisconnected = false;
let isReconnecting = false;

let lastTrackerData = null;
let receivedBuffer = "";
let watchdogTimer = null;
let lastDataAt = 0;

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);

const connectBtn = $("connectBtn");
const disconnectBtn = $("disconnectBtn");
const connectionIndicator = $("connectionIndicator");
const connectionText = $("connectionText");
const bleStatus = $("bleStatus");
const studentIdElement = $("studentId");
const batteryElement = $("battery");
const sosElement = $("sos");
const dataStatusElement = $("dataStatus");
const latitudeElement = $("latitude");
const longitudeElement = $("longitude");
const lastUpdateElement = $("lastUpdate");
const backendStatus = $("backendStatus");
const backendMessage = $("backendMessage");
const liveJson = $("liveJson");

connectBtn.addEventListener("click", connectToTracker);
disconnectBtn.addEventListener("click", disconnectTracker);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================================================
   CONNECT
   ========================================================= */

async function connectToTracker() {
    console.log("===== GEOGAURD BLE CONNECTION START =====");

    try {
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth is not supported by this browser. Use Chrome on Android or desktop.");
        }

        userDisconnected = false;
        isReconnecting = false;

        setBLEStatus("connecting", "Scanning...");

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: TRACKER_NAME_PREFIX }],
            optionalServices: [SERVICE_UUID]
        });
        console.log("Device:", bluetoothDevice.name, bluetoothDevice.id);

        bluetoothDevice.addEventListener("gattserverdisconnected", handleDisconnected);

        setBLEStatus("connecting", "Connecting...");
        await setupGatt();
        markConnected();

        console.log("===== GEOGAURD BLE CONNECTION SUCCESS =====");

    } catch (error) {
        console.error("GEOGAURD BLE ERROR:", error.name, error.message);

        const cancelled = error.name === "NotFoundError";
        resetBLEState();

        if (!cancelled) {
            setBLEStatus("disconnected", "Connection Failed");
            showError(`${error.name}\n\n${error.message}`);
        }
    }
}

/* Connect GATT, find service + characteristic, start notifications.
   Used for the first connection and for automatic reconnects. */
async function setupGatt() {
    bleServer = await bluetoothDevice.gatt.connect();
    bleService = await bleServer.getPrimaryService(SERVICE_UUID);
    bleCharacteristic = await bleService.getCharacteristic(CHARACTERISTIC_UUID);

    receivedBuffer = "";
    lastDataAt = Date.now();

    bleCharacteristic.addEventListener("characteristicvaluechanged", handleBLEData);

    try {
        await bleCharacteristic.startNotifications();
        console.log("Notifications enabled.");
    } catch (e) {
        console.warn("Notifications unavailable, using reads only:", e);
    }

    try {
        processBLEValue(await bleCharacteristic.readValue());
    } catch (e) {
        console.warn("Initial read failed:", e);
    }

    clearInterval(watchdogTimer);
    watchdogTimer = setInterval(watchdog, WATCHDOG_MS);
}

function markConnected() {
    isConnected = true;
    setBLEStatus("connected", `Connected: ${(bluetoothDevice && bluetoothDevice.name) || "GG Tracker"}`);
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    if (!lastTrackerData) dataStatusElement.textContent = "Connected";
}

/* =========================================================
   WATCHDOG: if notifications stop, read the value manually
   ========================================================= */

async function watchdog() {
    if (!bleCharacteristic || !bluetoothDevice || !bluetoothDevice.gatt.connected) return;

    const idle = Date.now() - lastDataAt;

    if (idle > NO_DATA_MS) {
        dataStatusElement.textContent = "No recent data";
    }

    if (idle > POLL_IF_IDLE_MS) {
        try {
            processBLEValue(await bleCharacteristic.readValue());
        } catch (e) {
            console.warn("Read failed:", e);
        }
    }
}

/* =========================================================
   RECEIVE DATA
   ========================================================= */

function handleBLEData(event) {
    try {
        processBLEValue(event.target.value);
    } catch (error) {
        console.error("BLE notification error:", error);
    }
}

function processBLEValue(value) {
    try {
        if (!value || value.byteLength === 0) {
            console.warn("Empty BLE value (0 bytes). The tracker has no value set.");
            dataStatusElement.textContent = "Empty value";
            return;
        }

        lastDataAt = Date.now();

        const incoming = new TextDecoder("utf-8").decode(value);
        console.log(`BLE data (${value.byteLength} bytes):`, incoming);

        /* A new message starts with "{": drop any stale partial data */
        if (incoming.trim().startsWith("{")) {
            receivedBuffer = "";
        }

        receivedBuffer += incoming;

        if (receivedBuffer.length > MAX_BUFFER_CHARS) {
            console.warn("Buffer too large, resetting.");
            receivedBuffer = "";
            return;
        }

        let data;
        try {
            data = JSON.parse(receivedBuffer);
        } catch (e) {
            return; // wait for the rest of the JSON
        }

        receivedBuffer = "";
        processTrackerData(data);

    } catch (error) {
        console.error("BLE decoding error:", error);
    }
}

/* =========================================================
   PROCESS TRACKER DATA
   ========================================================= */

function processTrackerData(data) {
    if (!data || typeof data !== "object") {
        console.error("Invalid tracker data.");
        return;
    }

    lastTrackerData = {
        studentId: data.studentId || data.id || "UNKNOWN",
        trackerId: (bluetoothDevice && bluetoothDevice.name) || "GG Tracker",
        latitude: Number(data.latitude ?? data.lat),
        longitude: Number(data.longitude ?? data.lon),
        battery: Number(data.battery ?? data.bat),
        sos: data.sos || "OFF",
        timestamp: data.timestamp || new Date().toISOString()
    };

    updateStudentInformation(lastTrackerData);
    updateJSON(lastTrackerData);
    dataStatusElement.textContent = "Receiving";
    sendToBackend(lastTrackerData);
}

/* =========================================================
   UI UPDATES
   ========================================================= */

function updateStudentInformation(data) {
    studentIdElement.textContent = data.studentId;
    batteryElement.textContent = Number.isFinite(data.battery) ? `${data.battery}%` : "--%";
    latitudeElement.textContent = Number.isFinite(data.latitude) ? data.latitude.toFixed(6) : "--";
    longitudeElement.textContent = Number.isFinite(data.longitude) ? data.longitude.toFixed(6) : "--";
    updateSOSStatus(data.sos);
    lastUpdateElement.textContent = new Date().toLocaleTimeString();
}

function updateSOSStatus(sos) {
    const s = String(sos).toUpperCase();
    const active = s === "ON" || s === "ACTIVE" || s === "TRUE";

    sosElement.textContent = active ? "SOS ACTIVE" : "OFF";
    sosElement.classList.toggle("sos-on", active);
    sosElement.classList.toggle("sos-off", !active);
}

function updateJSON(data) {
    liveJson.textContent = JSON.stringify(data, null, 2);
}

/* =========================================================
   BACKEND
   ========================================================= */

function setBackendStatus(state, badge, message) {
    backendStatus.textContent = badge;
    backendStatus.classList.remove("connected", "connecting", "disconnected");
    backendStatus.classList.add(state);
    backendMessage.textContent = message;
}

async function sendToBackend(data) {
    if (typeof publishStudent !== "function" || typeof backendReady !== "function" || !backendReady()) {
        setBackendStatus("disconnected", "Not Configured", "Backend URL is not set (backend.js)");
        return;
    }

    const ok = await publishStudent(data);

    if (ok) {
        setBackendStatus("connected", "Connected", `Sent at ${new Date().toLocaleTimeString()}`);
    } else {
        setBackendStatus("disconnected", "Failed", "Could not reach backend - will retry on next data");
    }
}

/* =========================================================
   DISCONNECT / RECONNECT
   ========================================================= */

async function disconnectTracker() {
    userDisconnected = true;
    clearInterval(watchdogTimer);
    watchdogTimer = null;

    try {
        if (bleCharacteristic) {
            bleCharacteristic.removeEventListener("characteristicvaluechanged", handleBLEData);
            try {
                await bleCharacteristic.stopNotifications();
            } catch (e) {
                console.warn("Stop notification error:", e);
            }
        }

        if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        }
    } catch (error) {
        console.error("Disconnect error:", error);
    }

    resetBLEState();
}

/* Fires when the tracker goes out of range / turns off */
async function handleDisconnected() {
    console.warn("GG tracker disconnected.");

    clearInterval(watchdogTimer);
    watchdogTimer = null;

    if (userDisconnected || isReconnecting) return;

    isReconnecting = true;
    isConnected = false;

    for (let attempt = 1; attempt <= MAX_RECONNECT; attempt++) {
        setBLEStatus("connecting", `Reconnecting (${attempt}/${MAX_RECONNECT})...`);
        dataStatusElement.textContent = "Reconnecting";

        await sleep(2000);

        if (userDisconnected || !bluetoothDevice) {
            isReconnecting = false;
            return;
        }

        try {
            await setupGatt();
            isReconnecting = false;
            markConnected();
            console.log("Reconnected.");
            return;
        } catch (e) {
            console.warn(`Reconnect attempt ${attempt} failed:`, e);
        }
    }

    isReconnecting = false;
    resetBLEState();
    setBLEStatus("disconnected", "Connection Lost");
}

function resetBLEState() {
    clearInterval(watchdogTimer);
    watchdogTimer = null;

    isConnected = false;
    isReconnecting = false;
    bluetoothDevice = null;
    bleServer = null;
    bleService = null;
    bleCharacteristic = null;
    receivedBuffer = "";
    lastTrackerData = null;

    setBLEStatus("disconnected", "Disconnected");
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    dataStatusElement.textContent = "Waiting";

    setBackendStatus("disconnected", "Not Connected", "Waiting for tracker data");
    liveJson.textContent = "Waiting for BLE data...";
}

/* =========================================================
   STATUS + ERRORS
   ========================================================= */

function setBLEStatus(state, message) {
    bleStatus.textContent = message;
    bleStatus.classList.remove("connected", "connecting", "disconnected");
    bleStatus.classList.add(state);

    connectionIndicator.classList.remove("connected", "connecting", "disconnected");
    connectionIndicator.classList.add(state);
    connectionText.textContent = message;
}

function showError(message) {
    console.error(message);
    alert(`BLE ERROR\n\n${message}`);
}

/* =========================================================
   INIT
   ========================================================= */

(function initializeApp() {
    console.log("GeoGaurd Student App started.");
    console.log("Service UUID:", SERVICE_UUID);
    console.log("Characteristic UUID:", CHARACTERISTIC_UUID);

    setBLEStatus("disconnected", "Disconnected");
    setBackendStatus("disconnected", "Not Connected", "Waiting for tracker data");
})();
