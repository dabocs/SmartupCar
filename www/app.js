// JavaScript code for the BLE Scan example app.

// Application object.
var app = {};

app.SYSTEMINFORMATIONSERVICE = 'ff51b30e-d7e2-4d93-8842-a7c4a57dfb07';

app.CHARACTERISTICS = {
    'ff51b30e-d7e2-4d93-8842-a7c4a57dfb08': printMemory,
    'ff51b30e-d7e2-4d93-8842-a7c4a57dfb09': printUptime,
    'ff51b30e-d7e2-4d93-8842-a7c4a57dfb10': printLoadAverage
};

// Device list.
app.devices = {};

// UI methods.
app.ui = {};

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
app.ui.updateTimer = null;

app.initialize = function () {
    document.addEventListener(
		'deviceready',
		function () { evothings.scriptsLoaded(app.onDeviceReady) },
		false);
};

app.onDeviceReady = function () {
    // Not used.
    // Here you can update the UI to say that
    // the device (the phone/tablet) is ready
    // to use BLE and other Cordova functions.
};

// Start the scan. Call the callback function when a device is found.
// Format:
//   callbackFun(deviceInfo, errorCode)
//   deviceInfo: address, rssi, name
//   errorCode: String
app.startScan = function (callbackFun) {
    app.stopScan();

    evothings.ble.startScan(
		function (device) {
		    // Report success. Sometimes an RSSI of +127 is reported.
		    // We filter out these values here.
		    if (device.rssi <= 0) {
		        callbackFun(device, null);
		    }
		},
		function (errorCode) {
		    // Report error.
		    callbackFun(null, errorCode);
		}
	);
};

// Stop scanning for devices.
app.stopScan = function () {
    evothings.ble.stopScan();
};

// Called when Start Scan button is selected.
app.ui.onStartScanButton = function () {
    app.startScan(app.ui.deviceFound);
    app.ui.displayStatus('Scanning...');
    app.ui.updateTimer = setInterval(app.ui.displayDeviceList, 500);
};

// Called when Stop Scan button is selected.
app.ui.onStopScanButton = function () {
    app.stopScan();
    app.devices = {};
    app.ui.displayStatus('Scan Paused');
    app.ui.displayDeviceList();
    clearInterval(app.ui.updateTimer);
};

// Called when a device is found.
app.ui.deviceFound = function (device, errorCode) {
    if (device) {
        // Set timestamp for device (this is used to remove
        // inactive devices).
        device.timeStamp = Date.now();

        // Insert the device into table of found devices.
        app.devices[device.address] = device;
    }
    else if (errorCode) {
        app.ui.displayStatus('Scan Error: ' + errorCode);
    }
};

// Display the device list.
app.ui.displayDeviceList = function () {
    // Clear device list.
    $('#found-devices').empty();

    var timeNow = Date.now();

    $.each(app.devices, function (key, device) {
        // Only show devices that are updated during the last 10 seconds.
        if (device.timeStamp + 10000 > timeNow) {
            // Map the RSSI value to a width in percent for the indicator.
            var rssiWidth = 100; // Used when RSSI is zero or greater.
            if (device.rssi < -100) { rssiWidth = 0; }
            else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

            // Create tag for device data.
            var element = $(
				'<li onclick="app.connectTo(\'' +
					device.address + '\')">'
				+ '<strong>' + device.name + '</strong><br />'
				// Do not show address on iOS since it can be confused
				// with an iBeacon UUID.
				+ (evothings.os.isIOS() ? '' : device.address + '<br />')
				+ device.rssi + '<br />'
				+ '<div style="background:rgb(225,0,0);height:20px;width:'
				+ rssiWidth + '%;"></div>'
				+ '</li>'
			);

            $('#found-devices').append(element);
        }
    });
};

// Display a status message
app.ui.displayStatus = function (message) {
    $('#scan-status').html(message);
};






app.showLoadingLabel = function (message) {

    $('#loadingView').show();
    $('#loadingStatus').text(message);

    console.log(message);
};

app.connectTo = function (address) {

    device = app.devices[address];

    app.showLoadingLabel('Trying to connect to ' + device.name);

    function onConnectSuccess(device) {

        function onServiceSuccess(device) {

            // Application is now connected
            app.connected = true;
            app.device = device;

            console.log('Connected to ' + device.name);

            var htmlString = '<h2>' + device.name + '</h2>';

            $('#hostname').append($(htmlString));

            $('#home').hide();

            $('#loadingView').hide();

            $('#connected').show();

            $('#systemInformationView').show();

            Object.keys(app.CHARACTERISTICS).map(
				function (characteristic) {

				    device.readCharacteristic(
						characteristic,
						app.CHARACTERISTICS[characteristic],
						function (error) {

						    console.log('Error occured')
						});
				});
        }

        function onServiceFailure(errorCode) {

            // Disconnect and show an error message to the user.
            app.disconnect('Wrong device!');

            // Write debug information to console.
            console.log('Error reading services: ' + errorCode);
        }

        app.showLoadingLabel('Identifying services...');

        // Connect to the appropriate BLE service
        device.readServices(
			[app.SYSTEMINFORMATIONSERVICE],
			onServiceSuccess,
			onServiceFailure
		);
    }

    function onConnectFailure(errorCode) {

        app.disconnect('Disconnected from device');

        // Show an error message to the user
        console.log('Error ' + errorCode);
    }

    // Stop scanning
    app.stopScan();

    // Connect to our device
    console.log('Identifying service for communication');
    device.connect(onConnectSuccess, onConnectFailure);
};

app.disconnect = function (errorMessage) {

    if (errorMessage) {

        navigator.notification.alert(errorMessage, function () { });
    }

    app.connected = false;
    app.device = null;

    // Stop any ongoing scan and close devices.
    app.stopScan();
    evothings.ble.closeConnectedDevices();

    console.log('Disconnected');

    $('#found-devices').empty();

    $('#hostname').empty();
    $('#memory').empty();
    $('#uptime').empty();
    $('#loadaverage').empty();

    $('#connected').hide();

    $('#home').show();
};

function convertDataToObject(data) {

    return JSON.parse(String.fromCharCode.apply(null, new Uint8Array(data)))
}

function printUptime(data) {

    var uptime = convertDataToObject(data).uptime;

    var days = Math.floor(uptime / 86400);
    uptime -= days * 86400;

    var hours = Math.floor(uptime / 3600) % 24;
    uptime -= hours * 3600;

    var minutes = Math.floor(uptime / 60) % 60;

    var htmlString = '<p>' + 'Uptime: ' + days + ' days, ' + hours + ':' + (minutes > 9 ? '' : '0') + minutes + '</p>';

    $('#uptime').append($(htmlString));
};

function printMemory(data) {

    var freeMemory = convertDataToObject(data).freeMemory;
    var totalMemory = convertDataToObject(data).totalMemory;

    var htmlString = '<p>' + 'Free memory: ' + freeMemory + '/' + totalMemory + '</p>';

    $('#memory').append($(htmlString));
};

function printLoadAverage(data) {

    function colorLoad(load) {

        var color = '';

        if (load < 0.7) {

            color = 'color_wavegreen';
        }
        else if (load >= 1) {

            color = 'color_softred';
        }
        else {

            color = 'color_brightlight';
        }

        return '<span class="' + color + '">' + load + '</span>';
    }

    var dataObject = convertDataToObject(data);

    Object.keys(dataObject).map(function (load) {

        dataObject[load] = colorLoad(dataObject[load]);
    });

    var htmlString = '<p>' + 'Load average: ' + dataObject.oneMin + ', ' + dataObject.fiveMin + ', ' + dataObject.fifteenMin + '</p>';
    ;
    $('#loadaverage').append($(htmlString));
}






app.initialize();
