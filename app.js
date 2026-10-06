/* =========================================================
   GeoGaurd Student App
   app.js

   BLE FLOW:

   ESP32 / BLE Simulator
          ↓
      Bluetooth
          ↓
      Student App
          ↓
       GATT Server
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


/*
   Tracker names:

   GG001
   GG002
   GG003
   etc.
*/

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

    try {

        /* Check Web Bluetooth support */

        if (!navigator.bluetooth) {

            showError(
                "Web Bluetooth is not supported by this browser."
            );

            return;
        }


        setBLEStatus(
            "connecting",
            "Scanning..."
        );


        /*
           Open Bluetooth device picker.

           Only devices beginning with GG
           will be shown.

           Example:

           GG001
           GG002
           GG003
        */

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
            "Tracker selected:",
            bluetoothDevice.name
        );


        setBLEStatus(
            "connecting",
            "Connecting..."
        );


        /*
           Listen for unexpected disconnection.
        */

        bluetoothDevice.addEventListener(
            "gattserverdisconnected",
            handleDisconnected
        );


        /*
           Connect to GATT server.
        */

        bleServer =
            await bluetoothDevice.gatt.connect();


        console.log(
            "GATT server connected."
        );


        /*
           Discover the tracker service.
        */

        bleService =
            await bleServer.getPrimaryService(
                SERVICE_UUID
            );


        console.log(
            "Service discovered:",
            SERVICE_UUID
        );


        /*
           Discover the tracker characteristic.
        */

        bleCharacteristic =
            await bleService.getCharacteristic(
                CHARACTERISTIC_UUID
            );


        console.log(
            "Characteristic discovered:",
            CHARACTERISTIC_UUID
        );


        /*
           -------------------------------------------------
           READ INITIAL TRACKER DATA
           -------------------------------------------------
        */

        try {

            const value =
                await bleCharacteristic.readValue();

            console.log(
                "Initial tracker data received."
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


        /*
           -------------------------------------------------
           ENABLE BLE NOTIFICATIONS
           -------------------------------------------------
        */

        await bleCharacteristic.startNotifications();


        /*
           Listen for continuous tracker updates.
        */

        bleCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        /*
           Connection successful.
        */

        isConnected = true;


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
            "Successfully connected to tracker."
        );


    } catch (error) {

        console.error(
            "BLE connection error:",
            error
        );


        isConnected = false;


        setBLEStatus(
            "disconnected",
            "Connection Failed"
        );


        connectBtn.disabled =
            false;

        disconnectBtn.disabled =
            true;


        /*
           User cancelled Bluetooth picker.
        */

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


        showError(
            "Unable to connect to the GG tracker."
        );

    }

}


/* =========================================================
   HANDLE BLE DATA
   ========================================================= */

function handleBLEData(event) {

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

        /*
           Convert BLE bytes to text.
        */

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


        /*
           Add incoming data to buffer.
        */

        receivedBuffer +=
            incomingData;


        /*
           Try to parse JSON.
        */

        try {

            const data =
                JSON.parse(
                    receivedBuffer
                );


            /*
               JSON is complete.
            */

            receivedBuffer = "";


            processTrackerData(
                data
            );


        } catch (parseError) {

            /*
               JSON may have arrived in pieces.

               Wait for the next BLE packet.
            */

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


    /*
       Validate data.
    */

    if (
        !data ||
        typeof data !== "object"
    ) {

        console.error(
            "Invalid tracker data."
        );

        return;
    }


    /*
       Student ID
    */

    const studentId =
        data.studentId ||
        data.id ||
        "UNKNOWN";


    /*
       Latitude
    */

    const latitude =
        Number(
            data.latitude
        );


    /*
       Longitude
    */

    const longitude =
        Number(
            data.longitude
        );


    /*
       Battery
    */

    const battery =
        Number(
            data.battery
        );


    /*
       SOS
    */

    const sos =
        data.sos ||
        "OFF";


    /*
       Tracker ID comes from the BLE device name.

       Example:

       GG001
    */

    const trackerId =
        bluetoothDevice?.name ||
        "GG Tracker";


    /*
       Standard data object.

       This is the object that will later
       be sent to the backend.
    */

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


    /*
       Update Student App screen.
    */

    updateStudentInformation(
        lastTrackerData
    );


    /*
       Display raw JSON.
    */

    updateJSON(
        lastTrackerData
    );


    /*
       Update data status.
    */

    dataStatusElement.textContent =
        "Receiving";


    /*
       Send tracker data to backend.
    */

    sendToBackend(
        lastTrackerData
    );

}


/* =========================================================
   UPDATE STUDENT INFORMATION
   ========================================================= */

function updateStudentInformation(data) {

    /*
       Student ID
    */

    studentIdElement.textContent =
        data.studentId;


    /*
       Battery
    */

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


    /*
       Latitude
    */

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


    /*
       Longitude
    */

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


    /*
       SOS
    */

    updateSOSStatus(
        data.sos
    );


    /*
       Last update time.
    */

    lastUpdateElement.textContent =
        new Date().toLocaleTimeString();

}


/* =========================================================
   UPDATE SOS STATUS
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
   UPDATE RAW JSON
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
       PART 3 WILL CONNECT THE REAL BACKEND.

       For now, we only show that the data
       is ready to be transmitted.
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

    try {

        /*
           Stop notifications.
        */

        if (
            bleCharacteristic
        ) {

            try {

                await bleCharacteristic
                    .stopNotifications();

            } catch (error) {

                console.log(
                    "Notification stop error:",
                    error
                );

            }

        }


        /*
           Disconnect GATT.
        */

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
   HANDLE UNEXPECTED DISCONNECT
   ========================================================= */

function handleDisconnected() {

    console.log(
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
   UPDATE BLE STATUS UI
   ========================================================= */

function setBLEStatus(
    state,
    message
) {

    /*
       Status badge.
    */

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


    /*
       Top connection indicator.
    */

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
        "Tracker name prefix:",
        TRACKER_NAME_PREFIX
    );


    console.log(
        "BLE Service UUID:",
        SERVICE_UUID
    );


    console.log(
        "BLE Characteristic UUID:",
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
