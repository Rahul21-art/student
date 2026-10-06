/* =========================================================
   GeoGaurd Student App - app.js (corrected)
   BLE: GG001 (GATT server) -> Service 9001 -> Char 9002 (Read + Notify)
   ========================================================= */

const SERVICE_UUID = "00009001-0000-1000-8000-00805f9b34fb";
const CHARACTERISTIC_UUID = "00009002-0000-1000-8000-00805f9b34fb";
const TRACKER_NAME_PREFIX = "GG";
const POLL_INTERVAL_MS = 3000;   // fallback read in case notifications don't arrive
const MAX_BUFFER_CHARS = 2000;

/* ---------- State ---------- */
let bluetoothDevice = null;
let bleServer = null;
let bleService = null;
let bleCharacteristic = null;
let isConnected = false;
let lastTrackerData = null;
let receivedBuffer = "";
let pollTimer = null;

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

/* =========================================================
   CONNECT
   ========================================================= */

async function connectToTracker() {
    console.clear();
    console.log("===== GEOGAURD BLE CONNECTION START =====");

    try {
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth is not supported by this browser.");
        }

        setBLEStatus("connecting", "Scanning...");

        console.log("STEP 1: Opening device picker...");
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: TRACKER_NAME_PREFIX }],
            optionalServices: [SERVICE_UUID]
        });
        console.log("Device:", bluetoothDevice.name, bluetoothDevice.id);

        bluetoothDevice.addEventListener("gattserverdisconnected", handleDisconnected);

        console.log("STEP 2: Connecting to GATT...");
        setBLEStatus("connecting", "Connecting...");
        bleServer = await bluetoothDevice.gatt.connect();

        console.log("STEP 3: Getting service...");
        setBLEStatus("connecting", "Finding service...");
        bleService = await bleServer.getPrimaryService(SERVICE_UUID);

        console.log("STEP 4: Getting characteristic...");
        setBLEStatus("connecting", "Finding characteristic...");
        bleCharacteristic = await bleService.getCharacteristic(CHARACTERISTIC_UUID);
        console.log("Properties:", bleCharacteristic.properties);

        /* Notifications first, so no update is missed */
        console.log("STEP 5: Enabling notifications...");
        bleCharacteristic.addEventListener("characteristicvaluechanged", handleBLEData);
        try {
            await bleCharacteristic.startNotifications();
            console.log("Notifications enabled.");
        } catch (e) {
            console.warn("Notifications unavailable, using polling only:", e);
        }

        /* Initial read */
        console.log("STEP 6: Initial read...");
        try {
            const value = await bleCharacteristic.readValue();
            processBLEValue(value);
        } catch (e) {
            console.warn("Initial read failed:", e);
        }

        /* Fallback polling */
        clearInterval(pollTimer);
        pollTimer = setInterval(pollTracker, POLL_INTERVAL_MS);

        isConnected = true;
        setBLEStatus("connected", `Connected: ${bluetoothDevice.name || "GG Tracker"}`);
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        dataStatusElement.textContent = "Connected";
        backendMessage.textContent = "Waiting for tracker data";

        console.log("===== GEOGAURD BLE CONNECTION SUCCESS =====");

    } catch (error) {
        console.error("GEOGAURD BLE ERROR:", error.name, error.message);

        isConnected = false;
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;

        if (error.name === "NotFoundError") {   // user cancelled picker
            setBLEStatus("disconnected", "Disconnected");
            return;
        }

        setBLEStatus("disconnected", "Connection Failed");
        showError(`${error.name}\n\n${error.message}`);
    }
}

/* =========================================================
   POLLING FALLBACK
   ========================================================= */

async function pollTracker() {
    try {
        if (bleCharacteristic && bluetoothDevice && bluetoothDevice.gatt.connected) {
            const value = await bleCharacteristic.readValue();
            processBLEValue(value);
        }
    } catch (e) {
        console.warn("Poll read failed:", e);
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
            console.warn("Empty BLE value (0 bytes). Set the characteristic value in the simulator app.");
            dataStatusElement.textContent = "Empty value";
            return;
        }

        const incoming = new TextDecoder("utf-8").decode(value);
        console.log(`BLE data received (${value.byteLength} bytes):`, incoming);

        /* A new message starts with "{": drop stale partial data */
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
            console.log("Waiting for complete JSON. Buffer so far:", receivedBuffer);
            return;
        }

        receivedBuffer = "";
        console.log("Complete tracker JSON:", data);
        processTrackerData(data);

    } catch (error) {
        console.error("BLE decoding error:", error);
    }
}

/* =========================================================
   PROCESS TRACKER DATA
   Accepts full keys (studentId, latitude, longitude, battery)
   and short keys (id, lat, lon, bat).
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
   BACKEND (placeholder)
   ========================================================= */

async function sendToBackend(data) {
    console.log("Tracker data ready for backend:", data);

    backendStatus.textContent = "Ready";
    backendStatus.classList.remove("disconnected");
    backendStatus.classList.add("connected");
    backendMessage.textContent = "Tracker data ready for backend";
}

/* =========================================================
   DISCONNECT
   ========================================================= */

async function disconnectTracker() {
    clearInterval(pollTimer);
    pollTimer = null;

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

function handleDisconnected() {
    console.warn("GG tracker disconnected.");
    clearInterval(pollTimer);
    pollTimer = null;
    resetBLEState();
}

function resetBLEState() {
    isConnected = false;
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

    backendStatus.textContent = "Not Connected";
    backendStatus.classList.remove("connected");
    backendStatus.classList.add("disconnected");
    backendMessage.textContent = "Waiting for tracker data";
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

function initializeApp() {
    console.log("GeoGaurd Student App started.");
    console.log("Service UUID:", SERVICE_UUID);
    console.log("Characteristic UUID:", CHARACTERISTIC_UUID);

    setBLEStatus("disconnected", "Disconnected");
    backendStatus.textContent = "Not Connected";
    backendMessage.textContent = "Waiting for tracker data";
}

initializeApp();
