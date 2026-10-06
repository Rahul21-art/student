
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

/*
   IMPORTANT:
   Chrome requires UUIDs used in requestDevice()
   to be valid UUID strings.

   Use lowercase hexadecimal.
*/

const SERVICE_UUID =
    "00009001-0000-1000-8000-00805f9b34fb";

const CHARACTERISTIC_UUID =
    "00009002-0000-1000-8000-00805f9b34fb";


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
   CONNECT TO BLE TRACKER
   ========================================================= */

async function connectToTracker() {

    console.clear();

    console.log(
        "====================================="
    );

    console.log(
        "GEOGAURD BLE CONNECTION START"
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
            "✓ Web Bluetooth supported."
        );


        setBLEStatus(
            "connecting",
            "Scanning..."
        );


        /* -----------------------------------------
           STEP 2
           BLUETOOTH DEVICE PICKER
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
            "Device name:",
            bluetoothDevice.name
        );


        console.log(
            "Device ID:",
            bluetoothDevice.id
        );


        setBLEStatus(
            "connecting",
            `Selected: ${bluetoothDevice.name || "GG Tracker"}`
        );


        /* -----------------------------------------
           STEP 3
           DISCONNECT LISTENER
           ----------------------------------------- */

        bluetoothDevice.addEventListener(
            "gattserverdisconnected",
            handleDisconnected
        );


        /* -----------------------------------------
           STEP 4
           GATT CONNECTION
           ----------------------------------------- */

        console.log(
            "STEP 3: Connecting to GATT server..."
        );


        setBLEStatus(
            "connecting",
            "Connecting..."
        );


        if (!bluetoothDevice.gatt) {

            throw new Error(
                "GATT is not available on this device."
            );

        }


        bleServer =
            await bluetoothDevice.gatt.connect();


        console.log(
            "✓ GATT server connected."
        );


        console.log(
            "GATT connected:",
            bluetoothDevice.gatt.connected
        );


        /* -----------------------------------------
           STEP 5
           SERVICE
           ----------------------------------------- */

        console.log(
            "STEP 4: Discovering service..."
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
            "✓ Service discovered:"
        );


        console.log(
            bleService.uuid
        );


        /* -----------------------------------------
           STEP 6
           CHARACTERISTIC
           ----------------------------------------- */

        console.log(
            "STEP 5: Discovering characteristic..."
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
            "✓ Characteristic discovered:"
        );


        console.log(
            bleCharacteristic.uuid
        );


        /* -----------------------------------------
           STEP 7
           CHARACTERISTIC PROPERTIES
           ----------------------------------------- */

        console.log(
            "STEP 6: Characteristic properties:"
        );


        console.log(
            bleCharacteristic.properties
        );


        /* -----------------------------------------
           STEP 8
           INITIAL READ
           ----------------------------------------- */

        console.log(
            "STEP 7: Reading tracker data..."
        );


        try {

            const value =
                await bleCharacteristic.readValue();


            console.log(
                "✓ Initial tracker data received."
            );


            processBLEValue(
                value
            );

        } catch (error) {

            console.warn(
                "Initial read failed:"
            );


            console.warn(
                error
            );

        }


        /* -----------------------------------------
           STEP 9
           NOTIFICATIONS
           ----------------------------------------- */

        console.log(
            "STEP 8: Enabling notifications..."
        );


        await bleCharacteristic.startNotifications();


        console.log(
            "✓ Notifications enabled."
        );


        /* -----------------------------------------
           STEP 10
           NOTIFICATION LISTENER
           ----------------------------------------- */

        bleCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        console.log(
            "✓ Notification listener attached."
        );


        /* -----------------------------------------
           STEP 11
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


        /* -----------------------------------------
           USER CANCELLED PICKER
           ----------------------------------------- */

        if (
            error.name === "NotFoundError"
        ) {

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
            `${error.name}\n\n${error.message}`
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
            "BLE notification error:",
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
            "BLE data received:",
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


            console.log(
                "Complete tracker JSON:",
                data
            );


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
        "Processed tracker data:",
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
        "GG tracker disconnected."
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
        `BLE ERROR\n\n${message}`
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
   START APPLICATION
   ========================================================= */

initializeApp();
