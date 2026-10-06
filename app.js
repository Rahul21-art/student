
/* =========================================================
   GeoGaurd Student App
   app.js

   BLE FLOW:

   GG001 / ESP32 GATT SERVER
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
   CONNECT TO BLE TRACKER
   ========================================================= */

async function connectToTracker() {

    console.clear();

    console.log(
        "====================================="
    );

    console.log(
        "GEOGAURD BLE CONNECTION TEST"
    );

    console.log(
        "=====================================");


    try {

        /* -----------------------------------------
           STEP 1
           ----------------------------------------- */

        console.log(
            "STEP 1: Checking Web Bluetooth..."
        );


        if (!navigator.bluetooth) {

            throw new Error(
                "Web Bluetooth is not supported by this browser."
            );

        }


        console.log(
            "✓ Web Bluetooth is supported."
        );


        setBLEStatus(
            "connecting",
            "Opening Bluetooth..."
        );


        /* -----------------------------------------
           STEP 2
           OPEN BLUETOOTH DEVICE PICKER
           
           TEMPORARY TEST:
           Accept all BLE devices.
           ----------------------------------------- */

        console.log(
            "STEP 2: Opening Bluetooth device picker..."
        );


        bluetoothDevice =
            await navigator.bluetooth.requestDevice({

                acceptAllDevices: true,

                optionalServices: [
                    SERVICE_UUID
                ]

            });


        console.log(
            "✓ Device selected."
        );


        console.log(
            "Device name:",
            bluetoothDevice.name
        );


        console.log(
            "Device ID:",
            bluetoothDevice.id
        );


        setBLEStatus(
            "connecting",
            `Selected: ${bluetoothDevice.name || "BLE Device"}`
        );


        /* -----------------------------------------
           STEP 3
           ----------------------------------------- */

        console.log(
            "STEP 3: Preparing GATT connection..."
        );


        bluetoothDevice.addEventListener(
            "gattserverdisconnected",
            handleDisconnected
        );


        if (!bluetoothDevice.gatt) {

            throw new Error(
                "This Bluetooth device does not expose GATT."
            );

        }


        /* -----------------------------------------
           STEP 4
           ----------------------------------------- */

        console.log(
            "STEP 4: Connecting to GATT server..."
        );


        setBLEStatus(
            "connecting",
            "Connecting..."
        );


        bleServer =
            await bluetoothDevice.gatt.connect();


        console.log(
            "✓ GATT connection successful."
        );


        console.log(
            "GATT connected:",
            bluetoothDevice.gatt.connected
        );


        /* -----------------------------------------
           STEP 5
           ----------------------------------------- */

        console.log(
            "STEP 5: Finding Service 9001..."
        );


        setBLEStatus(
            "connecting",
            "Finding service..."
        );


        bleService =
            await bleServer.getPrimaryService(
                SERVICE_UUID
            );


        console.log(
            "✓ Service found:",
            bleService.uuid
        );


        /* -----------------------------------------
           STEP 6
           ----------------------------------------- */

        console.log(
            "STEP 6: Finding Characteristic 9002..."
        );


        setBLEStatus(
            "connecting",
            "Finding characteristic..."
        );


        bleCharacteristic =
            await bleService.getCharacteristic(
                CHARACTERISTIC_UUID
            );


        console.log(
            "✓ Characteristic found:",
            bleCharacteristic.uuid
        );


        /* -----------------------------------------
           STEP 7
           ----------------------------------------- */

        console.log(
            "STEP 7: Checking characteristic properties..."
        );


        console.log(
            bleCharacteristic.properties
        );


        /* -----------------------------------------
           STEP 8
           INITIAL READ
           ----------------------------------------- */

        console.log(
            "STEP 8: Reading tracker data..."
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
                "Initial read failed:",
                error
            );

        }


        /* -----------------------------------------
           STEP 9
           NOTIFICATIONS
           ----------------------------------------- */

        console.log(
            "STEP 9: Starting notifications..."
        );


        try {

            await bleCharacteristic.startNotifications();


            console.log(
                "✓ Notifications enabled."
            );

        } catch (error) {

            console.error(
                "Notification error:",
                error
            );


            throw new Error(
                "Could not enable BLE notifications."
            );

        }


        /* -----------------------------------------
           STEP 10
           LISTEN FOR LIVE DATA
           ----------------------------------------- */

        bleCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        console.log(
            "✓ Notification listener attached."
        );


        /* -----------------------------------------
           SUCCESS
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
            "GEOGAURD BLE ERROR"
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


        /*
           User cancelled picker.
        */

        if (
            error.name === "NotFoundError"
        ) {

            console.log(
                "Bluetooth selection cancelled."
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


        showError(
            `BLE connection failed.\n\n${error.name}\n${error.message}`
        );

    }

}


/* =========================================================
   HANDLE BLE NOTIFICATION
   ========================================================= */

function handleBLEData(event) {

    console.log(
        "BLE notification received."
    );


    try {

        processBLEValue(
            event.target.value
        );

    } catch (error) {

        console.error(
            "Notification processing error:",
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
            "BLE data:",
            incomingData
        );


        receivedBuffer +=
            incomingData;


        try {

            const data =
                JSON.parse(
                    receivedBuffer
                );


            receivedBuffer =
                "";


            processTrackerData(
                data
            );


        } catch (error) {

            console.log(
                "Waiting for complete JSON..."
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
        "Tracker data:",
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
   SOS STATUS
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
   BACKEND
   ========================================================= */

async function sendToBackend(data) {

    console.log(
        "Tracker data ready for backend:",
        data
    );


    /*
       Real backend connection will be added
       after BLE communication works.
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
   DISCONNECT
   ========================================================= */

async function disconnectTracker() {

    console.log(
        "Disconnecting tracker..."
    );


    try {

        if (
            bleCharacteristic
        ) {

            try {

                await bleCharacteristic
                    .stopNotifications();

            } catch (error) {

                console.warn(
                    "Stop notification error:",
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
        "Tracker disconnected."
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
   BLE STATUS
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
   ERROR
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
   INITIALIZE
   ========================================================= */

function initializeApp() {

    console.log(
        "GeoGaurd Student App started."
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
   START
   ========================================================= */

initializeApp();

