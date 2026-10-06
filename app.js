
/* =========================================================
   GeoGaurd Student App
   app.js

   Flow:

   Phone A
   BLE Simulator
        ↓
   Bluetooth
        ↓
   Phone B
   Student App
        ↓
   Backend
   ========================================================= */


/* =========================================================
   BLE CONFIGURATION
   ========================================================= */

/*
   IMPORTANT:

   These UUIDs MUST be the same as the BLE Simulator.
*/

const SERVICE_UUID =
    "12345678-1234-1234-1234-123456789001";

const CHARACTERISTIC_UUID =
    "12345678-1234-1234-1234-123456789002";


/* =========================================================
   VARIABLES
   ========================================================= */

let bluetoothDevice = null;

let bleServer = null;

let bleCharacteristic = null;

let isConnected = false;

let lastTrackerData = null;


/*
   Used when BLE sends data in small chunks.
*/

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
   CONNECT BUTTON
   ========================================================= */

connectBtn.addEventListener(
    "click",
    connectToTracker
);


/* =========================================================
   DISCONNECT BUTTON
   ========================================================= */

disconnectBtn.addEventListener(
    "click",
    disconnectTracker
);


/* =========================================================
   CONNECT TO BLE TRACKER
   ========================================================= */

async function connectToTracker() {

    try {

        /*
           Check Web Bluetooth support.
        */

        if (!navigator.bluetooth) {

            showError(
                "Web Bluetooth is not supported by this browser."
            );

            return;
        }


        setBLEStatus(
            "connecting",
            "Searching..."
        );


        /*
           Ask the user to select the BLE tracker.

           We use acceptAllDevices because the simulator
           is acting as the tracker.
        */

        bluetoothDevice =
            await navigator.bluetooth.requestDevice({

                acceptAllDevices: true,

                optionalServices: [
                    SERVICE_UUID
                ]

            });


        console.log(
            "BLE device selected:",
            bluetoothDevice.name
        );


        /*
           Detect unexpected disconnection.
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
            "GATT connected"
        );


        /*
           Get our custom BLE service.
        */

        const service =
            await bleServer.getPrimaryService(
                SERVICE_UUID
            );


        /*
           Get tracker characteristic.
        */

        bleCharacteristic =
            await service.getCharacteristic(
                CHARACTERISTIC_UUID
            );


        console.log(
            "BLE characteristic found"
        );


        /*
           Start receiving notifications.

           This is important because the simulator
           continuously sends updated tracker data.
        */

        await bleCharacteristic.startNotifications();


        bleCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleBLEData
        );


        /*
           Update interface.
        */

        isConnected = true;


        setBLEStatus(
            "connected",
            "Connected"
        );


        connectBtn.disabled = true;

        disconnectBtn.disabled = false;


        dataStatusElement.textContent =
            "Connected";


        console.log(
            "Successfully connected to tracker"
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


        connectBtn.disabled = false;

        disconnectBtn.disabled = true;


        showError(
            "Unable to connect to the BLE tracker."
        );

    }

}


/* =========================================================
   HANDLE BLE DATA
   ========================================================= */

function handleBLEData(event) {

    try {

        /*
           Convert BLE bytes into text.
        */

        const decoder =
            new TextDecoder("utf-8");


        const incomingData =
            decoder.decode(
                event.target.value
            );


        console.log(
            "BLE data received:",
            incomingData
        );


        /*
           Add incoming data to buffer.

           This also makes the app safer if a BLE message
           arrives in multiple pieces.
        */

        receivedBuffer += incomingData;


        /*
           First try parsing the complete buffer.
        */

        try {

            const data =
                JSON.parse(
                    receivedBuffer
                );


            receivedBuffer = "";


            processTrackerData(
                data
            );


        } catch (parseError) {

            /*
               JSON may not be complete yet.

               Keep the buffer and wait for the next
               BLE packet.
            */

            console.log(
                "Waiting for remaining BLE data..."
            );

        }


    } catch (error) {

        console.error(
            "BLE data processing error:",
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
       Validate the received data.
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
       Make sure the required fields exist.

       Student ID is especially important because
       the backend will later use it to identify
       multiple students.
    */

    const studentId =
        data.studentId ||
        "UNKNOWN";


    const latitude =
        Number(data.latitude);


    const longitude =
        Number(data.longitude);


    const battery =
        Number(data.battery);


    const sos =
        data.sos ||
        "OFF";


    /*
       Store latest tracker data.
    */

    lastTrackerData = {

        studentId:
            studentId,

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
       Update screen.
    */

    updateStudentInformation(
        lastTrackerData
    );


    /*
       Update raw JSON display.
    */

    updateJSON(
        lastTrackerData
    );


    /*
       Update connection/data status.
    */

    dataStatusElement.textContent =
        "Receiving";


    /*
       Send data to backend.

       Part 3 will replace the placeholder
       backend function with the real API.
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
       Last update time
    */

    const updateTime =
        new Date();


    lastUpdateElement.textContent =
        updateTime.toLocaleTimeString();

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
        normalizedSOS === "ON"
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

/*
   PART 3:

   We will replace BACKEND_URL with the actual
   backend endpoint.

   Example:

   const BACKEND_URL =
       "https://your-backend-url/api/tracker";

   For now we only show that the data is ready
   to be sent.
*/

async function sendToBackend(data) {

    console.log(
        "Data ready for backend:",
        data
    );


    /*
       TEMPORARY STATUS

       The backend does not exist yet.

       Once Part 3 is created, this function
       will actually send the data using fetch().
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


    /*
       DO NOT uncomment this yet.

       We will add the real backend URL in Part 3.

       -------------------------------------------------

       try {

           const response =
               await fetch(
                   BACKEND_URL,
                   {
                       method: "POST",

                       headers: {
                           "Content-Type":
                               "application/json"
                       },

                       body:
                           JSON.stringify(data)
                   }
               );


           if (!response.ok) {

               throw new Error(
                   "Backend request failed"
               );

           }


           backendStatus.textContent =
               "Connected";


           backendMessage.textContent =
               "Data sent successfully";


       } catch (error) {

           console.error(
               "Backend error:",
               error
           );


           backendStatus.textContent =
               "Error";


           backendMessage.textContent =
               "Unable to send data";

       }

       -------------------------------------------------
    */

}


/* =========================================================
   DISCONNECT TRACKER
   ========================================================= */

async function disconnectTracker() {

    try {

        /*
           Stop notifications first.
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

    isConnected = false;


    bluetoothDevice = null;

    bleServer = null;

    bleCharacteristic = null;


    receivedBuffer = "";


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


    /*
       For the prototype, use a simple alert.

       Later we can replace this with a nicer
       notification system.
    */

    alert(
        message
    );

}


/* =========================================================
   PAGE STARTUP
   ========================================================= */

function initializeApp() {

    console.log(
        "GeoGaurd Student App started."
    );


    console.log(
        "BLE Service UUID:",
        SERVICE_UUID
    );


    console.log(
        "BLE Characteristic UUID:",
        CHARACTERISTIC_UUID
    );


    /*
       Initial UI state.
    */

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
