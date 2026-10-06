
/* =========================================================
   GeoGaurd Student App
   app.js

   BLE FLOW:

   GG001 / ESP32 BLE GATT SERVER
              ↓
        Bluetooth
              ↓
       Student App
        GATT CLIENT
              ↓
        Service 9001
              ↓
    Characteristic 9002
              ↓
        Read + Notify
              ↓
          Backend
   ========================================================= */


/* =========================================================
   BLE CONFIGURATION
   ========================================================= */

const SERVICE_UUID =
    "00009001-0000-1000-8000-00805F9B34FB";

const CHARACTERISTIC_UUID =
    "00009002-0000-1000-8000-00805F9B34FB";

const TRACKER_NAME_PREFIX = "GG";


/* =========================================================
   VARIABLES
   ========================================================= */

let bluetoothDevice = null;
let bleServer = null;
let bleService = null;
let bleCharacteristic = null;

let isConnected = false;

let lastTrackerData = null;

let receivedBuffer = "";


/* =========================================================
   HTML ELEMENTS
   ========================================================= */

const connectBtn =
    document.getElementById("connectBtn");

const disconnectBtn =
    document.getElementById("disconnectBtn");

const connectionIndicator =
    document.getElementById("connectionIndicator");

const connectionText =
    document.getElementById("connectionText");

const bleStatus =
    document.getElementById("bleStatus");

const studentIdElement =
    document.getElementById("studentId");

const batteryElement =
    document.getElementById("battery");

const sosElement =
    document.getElementById("sos");

const dataStatusElement =
    document.getElementById("dataStatus");

const latitudeElement =
    document.getElementById("latitude");

const longitudeElement =
    document.getElementById("longitude");

const lastUpdateElement =
    document.getElementById("lastUpdate");

const backendStatus =
    document.getElementById("backendStatus");

const backendMessage =
    document.getElementById("backendMessage");

const liveJson =
    document.getElementById("liveJson");


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

connectBtn.addEventListener(
    "click",
    connectToTracker
);

disconnectBtn.addEventListener(
    "click",
    disconnectTracker
);


/* =========================================================
   CONNECT TO TRACKER
   ========================================================= */

async function connectToTracker() {

    console.clear();

    console.log(
        "====================================="
    );

    console.log(
        "GeoGaurd BLE CONNECTION START"
    );

    console.log(
        "====================================="
    );


    try {

        /* -----------------------------------------
           STEP 1 — CHECK BLUETOOTH SUPPORT
           ----------------------------------------- */

        console.log(
            "STEP 1: Checking Web Bluetooth support..."
        );


        if (!navigator.bluetooth) {

            throw new Error(
                "Web Bluetooth is not supported by this browser."
            );

        }


        console.log(
            "✓ Web Bluetooth supported."
        );


        setBLEStatus(
            "connecting",
            "Scanning..."
        );


        /* -----------------------------------------
           STEP 2 — OPEN DEVICE PICKER
           ----------------------------------------- */

        console.log(
            "STEP 2: Opening Bluetooth device picker..."
        );


        bluetoothDevice =
            await navigator.bluetooth.requestDevice({

                filters: [
                    {
                        namePrefix:
                            TRACKER_NAME_PREFIX
                    }
                ],

                optionalServices: [
                    SERVICE_UUID
                ]

            });


        console.log(
            "✓ Device selected:"
        );

        console.log(
            "Name:",
            bluetoothDevice.name
        );

        console.log(
            "ID:",
            bluetoothDevice.id
        );


        setBLEStatus(
            "connecting",
            `Selected: ${bluetoothDevice.name}`
        );


        /* -----------------------------------------
           STEP 3 — DISCONNECT EVENT
           ----------------------------------------- */

        bluetoothDevice.addEventListener(
            "gattserverdisconnected",
            handleDisconnected
        );


        /* -----------------------------------------
           STEP 4 — CONNECT TO GATT SERVER
           ----------------------------------------- */

        console.log(
            "STEP 3: Connecting to GATT server..."
        );


        setBLEStatus(
            "connecting",
            "Connecting to GATT..."
        );


        if (!bluetoothDevice.gatt) {

            throw new Error(
                "GATT is not available on this Bluetooth device."
            );

        }


        bleServer =
            await bluetoothDevice.gatt.connect();


        if (!bleServer) {

            throw new Error(
                "GATT connection returned no server."
            );

        }


        console.log(
            "✓ GATT server connected."
        );


        console.log(
            "GATT connected:",
            bluetoothDevice.gatt.connected
        );


        /* -----------------------------------------
           STEP 5 — DISCOVER SERVICE
           ----------------------------------------- */

        console.log(
            "STEP 4: Discovering service..."
        );


        setBLEStatus(
            "connecting",
            "Finding BLE service..."
        );


        console.log(
            "Requested Service UUID:",
            SERVICE_UUID
        );


        bleService =
            await bleServer.getPrimaryService(
                SERVICE_UUID
            );


        console.log(
            "✓ Service discovered."
        );


        console.log(
            "Service UUID:",
            bleService.uuid
        );


        /* -----------------------------------------
           STEP 6 — DISCOVER CHARACTERISTIC
           ----------------------------------------- */

        console.log(
            "STEP 5: Discovering characteristic..."
        );


        setBLEStatus(
            "connecting",
            "Finding tracker characteristic..."
        );


        console.log(
            "Requested Characteristic UUID:",
            CHARACTERISTIC_UUID
        );


        bleCharacteristic =
            await bleService.getCharacteristic(
                CHARACTERISTIC_UUID
            );


        console.log(
            "✓ Characteristic discovered."
        );


        console.log(
            "Characteristic UUID:",
            bleCharacteristic.uuid
        );


        /* -----------------------------------------
           STEP 7 — CHECK CHARACTERISTIC PROPERTIES
           ----------------------------------------- */

        console.log(
            "STEP 6: Checking characteristic properties..."
        );


        if (
            bleCharacteristic.properties
        ) {

            console.log(
                "Characteristic properties:",
                bleCharacteristic.properties
            );

        }


        /* -----------------------------------------
           STEP 8 — READ INITIAL DATA
           ----------------------------------------- */

        console.log(
            "STEP 7: Reading initial tracker data..."
        );


        setBLEStatus(
            "connecting",
            "Reading tracker data..."
        );


        try {

            const value =
                await bleCharacteristic.readValue();


            console.log(
                "✓ Initial read successful."
            );


            processBLEValue(
                value
            );


        } catch (error) {

            console.warn(
                "⚠ Initial read failed."
            );

            console.warn(
                error
            );

        }


        /* -----------------------------------------
           STEP 9 — ENABLE NOTIFICATIONS
           ----------------------------------------- */

        console.log(
            "STEP 8: Enabling notifications..."
        );


        setBLEStatus(
            "connecting",
            "Enabling live updates..."
        );


        try {

            await bleCharacteristic.startNotifications();


            console.log(
                "✓ Notifications enabled."
            );


        } catch (error) {

            console.error(
                "✗ Notification setup failed."
            );

            console.error(
                error
            );


            throw new Error(
                "BLE characteristic does not support notifications."
            );

        }


        /* -----------------------------------------
           STEP 10 — LISTEN FOR DATA
           ----------------------------------------- */

        bleCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        console.log(
            "✓ BLE notification listener attached."
        );


        /* -----------------------------------------
           STEP 11 — SUCCESS
           ----------------------------------------- */

        isConnected =
            true;


        setBLEStatus(
            "connected",
            `Connected: ${bluetoothDevice.name || "GG Tracker"}`
        );


        connectBtn.disabled =
            true;


        disconnectBtn.disabled =
            false;


        dataStatusElement.textContent =
            "Connected";


        backendMessage.textContent =
            "Waiting for tracker data";


        console.log(
            "====================================="
        );

        console.log(
            "✓ GEOGAURD BLE CONNECTION SUCCESS"
        );

        console.log(
            "=====================================");


    } catch (error) {

        console.error(
            "====================================="
        );

        console.error(
            "✗ GEOGAURD BLE CONNECTION FAILED"
        );

        console.error(
            "====================================="
        );


        console.error(
            "Error name:",
            error.name
        );


        console.error(
            "Error message:",
            error.message
        );


        console.error(
            "Full error:",
            error
        );


        isConnected =
            false;


        connectBtn.disabled =
            false;


        disconnectBtn.disabled =
            true;


        /* -----------------------------------------
           USER CANCELLED DEVICE PICKER
           ----------------------------------------- */

        if (
            error.name === "NotFoundError"
        ) {

            console.log(
                "Bluetooth device selection cancelled."
            );


            setBLEStatus(
                "disconnected",
                "Disconnected"
            );


            return;
        }


        setBLEStatus(
            "disconnected",
            "Connection Failed"
        );


        /*
           Show the actual error in the browser
           console instead of hiding it.
        */

        showError(
            `BLE connection failed:\n\n${error.name}\n${error.message}`
        );

    }

}


/* =========================================================
   HANDLE BLE DATA
   ========================================================= */

function handleBLEData(event) {

    console.log(
        "====================================="
    );

    console.log(
        "BLE NOTIFICATION RECEIVED"
    );

    console.log(
        "====================================="
    );


    try {

        processBLEValue(
            event.target.value
        );

    } catch (error) {

        console.error(
            "BLE notification processing error:",
            error
        );

    }

}


/* =========================================================
   PROCESS BLE VALUE
   ========================================================= */

function processBLEValue(value) {

    try {

        const decoder =
            new TextDecoder("utf-8");


        const incomingData =
            decoder.decode(
                value
            );


        console.log(
            "Raw BLE data:",
            incomingData
        );


        receivedBuffer +=
            incomingData;


        console.log(
            "Current buffer:",
            receivedBuffer
        );


        /*
           Try complete JSON.
        */

        try {

            const data =
                JSON.parse(
                    receivedBuffer
                );


            receivedBuffer =
                "";


            console.log(
                "✓ Complete JSON received:",
                data
            );


            processTrackerData(
                data
            );


        } catch (parseError) {

            console.log(
                "JSON incomplete. Waiting for more BLE data..."
            );

        }

    } catch (error) {

        console.error(
            "BLE decoding error:",
            error
        );

    }

}


/* =========================================================
   PROCESS TRACKER DATA
   ========================================================= */

function processTrackerData(data) {

    console.log(
        "Processing tracker data:",
        data
    );


    if (
        !data ||
        typeof data !== "object"
    ) {

        console.error(
            "Invalid tracker data."
        );

        return;

    }


    const studentId =
        data.studentId ||
        data.id ||
        "UNKNOWN";


    const latitude =
        Number(
            data.latitude
        );


    const longitude =
        Number(
            data.longitude
        );


    const battery =
        Number(
            data.battery
        );


    const sos =
        data.sos ||
        "OFF";


    const trackerId =
        bluetoothDevice?.name ||
        "GG Tracker";


    lastTrackerData = {

        studentId:
            studentId,

        trackerId:
            trackerId,

        latitude:
            latitude,

        longitude:
            longitude,

        battery:
            battery,

        sos:
            sos,

        timestamp:
            data.timestamp ||
            new Date().toISOString()

    };


    console.log(
        "Standardized tracker data:",
        lastTrackerData
    );


    updateStudentInformation(
        lastTrackerData
    );


    updateJSON(
        lastTrackerData
    );


    dataStatusElement.textContent =
        "Receiving";


    sendToBackend(
        lastTrackerData
    );

}


/* =========================================================
   UPDATE STUDENT INFORMATION
   ========================================================= */

function updateStudentInformation(data) {

    studentIdElement.textContent =
        data.studentId;


    if (
        Number.isFinite(
            data.battery
        )
    ) {

        batteryElement.textContent =
            `${data.battery}%`;

    } else {

        batteryElement.textContent =
            "--%";

    }


    if (
        Number.isFinite(
            data.latitude
        )
    ) {

        latitudeElement.textContent =
            data.latitude.toFixed(6);

    } else {

        latitudeElement.textContent =
            "--";

    }


    if (
        Number.isFinite(
            data.longitude
        )
    ) {

        longitudeElement.textContent =
            data.longitude.toFixed(6);

    } else {

        longitudeElement.textContent =
            "--";

    }


    updateSOSStatus(
        data.sos
    );


    lastUpdateElement.textContent =
        new Date().toLocaleTimeString();

}


/* =========================================================
   UPDATE SOS
   ========================================================= */

function updateSOSStatus(sos) {

    const normalizedSOS =
        String(
            sos
        ).toUpperCase();


    if (
        normalizedSOS === "ON" ||
        normalizedSOS === "ACTIVE" ||
        normalizedSOS === "TRUE"
    ) {

        sosElement.textContent =
            "SOS ACTIVE";


        sosElement.classList.remove(
            "sos-off"
        );


        sosElement.classList.add(
            "sos-on"
        );

    } else {

        sosElement.textContent =
            "OFF";


        sosElement.classList.remove(
            "sos-on"
        );


        sosElement.classList.add(
            "sos-off"
        );

    }

}


/* =========================================================
   UPDATE JSON
   ========================================================= */

function updateJSON(data) {

    liveJson.textContent =
        JSON.stringify(
            data,
            null,
            2
        );

}


/* =========================================================
   SEND DATA TO BACKEND
   ========================================================= */

async function sendToBackend(data) {

    console.log(
        "Tracker data ready for backend:",
        data
    );


    /*
       PART 3 BACKEND CONNECTION
       WILL BE ADDED LATER.
    */

    backendStatus.textContent =
        "Ready";


    backendStatus.classList.remove(
        "disconnected"
    );


    backendStatus.classList.add(
        "connected"
    );


    backendMessage.textContent =
        "Tracker data ready for backend";

}


/* =========================================================
   DISCONNECT TRACKER
   ========================================================= */

async function disconnectTracker() {

    console.log(
        "Disconnecting GG tracker..."
    );


    try {

        if (
            bleCharacteristic
        ) {

            try {

                await bleCharacteristic
                    .stopNotifications();


                console.log(
                    "Notifications stopped."
                );

            } catch (error) {

                console.warn(
                    "Notification stop error:",
                    error
                );

            }

        }


        if (
            bluetoothDevice &&
            bluetoothDevice.gatt &&
            bluetoothDevice.gatt.connected
        ) {

            bluetoothDevice.gatt.disconnect();


            console.log(
                "GATT disconnected."
            );

        }

    } catch (error) {

        console.error(
            "Disconnect error:",
            error
        );

    }


    resetBLEState();

}


/* =========================================================
   UNEXPECTED DISCONNECT
   ========================================================= */

function handleDisconnected() {

    console.warn(
        "GG tracker unexpectedly disconnected."
    );


    resetBLEState();

}


/* =========================================================
   RESET BLE STATE
   ========================================================= */

function resetBLEState() {

    isConnected =
        false;


    bluetoothDevice =
        null;


    bleServer =
        null;


    bleService =
        null;


    bleCharacteristic =
        null;


    receivedBuffer =
        "";


    lastTrackerData =
        null;


    setBLEStatus(
        "disconnected",
        "Disconnected"
    );


    connectBtn.disabled =
        false;


    disconnectBtn.disabled =
        true;


    dataStatusElement.textContent =
        "Waiting";


    backendStatus.textContent =
        "Not Connected";


    backendStatus.classList.remove(
        "connected"
    );


    backendStatus.classList.add(
        "disconnected"
    );


    backendMessage.textContent =
        "Waiting for tracker data";


    liveJson.textContent =
        "Waiting for BLE data...";

}


/* =========================================================
   UPDATE BLE STATUS
   ========================================================= */

function setBLEStatus(
    state,
    message
) {

    bleStatus.textContent =
        message;


    bleStatus.classList.remove(
        "connected",
        "connecting",
        "disconnected"
    );


    bleStatus.classList.add(
        state
    );


    connectionIndicator.classList.remove(
        "connected",
        "connecting",
        "disconnected"
    );


    connectionIndicator.classList.add(
        state
    );


    connectionText.textContent =
        message;

}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function showError(message) {

    console.error(
        message
    );


    alert(
        message
    );

}


/* =========================================================
   INITIALIZE APP
   ========================================================= */

function initializeApp() {

    console.log(
        "GeoGaurd Student App started."
    );


    console.log(
        "Tracker prefix:",
        TRACKER_NAME_PREFIX
    );


    console.log(
        "Service UUID:",
        SERVICE_UUID
    );


    console.log(
        "Characteristic UUID:",
        CHARACTERISTIC_UUID
    );


    setBLEStatus(
        "disconnected",
        "Disconnected"
    );


    backendStatus.textContent =
        "Not Connected";


    backendMessage.textContent =
        "Waiting for tracker data";

}


/* =========================================================
   START APPLICATION
   ========================================================= */

initializeApp();
