/*
Description:

	JavaScript code for trich device targeting, data graphing and data storage

*/

/**
 * Object that holds application data and functions.
 */
var app = {};

/**
 * Name of device to connect to.
 */
app.deviceName = 'ChildMind';

/**
 * TARGET defines (inverted).
 */
app.targetOFF = 1;
app.targetON  = 0;
app.totalTargets = 0;
app.setTargetFlag = false;

/**
 * Stores data user input data marker state  0 = false/false , 1 = true/false , 2 = false/true , 3 = true/true 
 */
app.varState = 0;

/**
 * Is dead reckoning enabled - default is thermopile color changing saber
 */
app.reckonState = false;
//get baseline therrmo values
app.reckonInit = false; 

/**
 * try and determine which hand the device is on
 */
app.handState = "left";

/**
 * Connected device.
 */
app.device = null;

/**
 * Object that holds wearable device UUIDs.
 */
app.deviceUUID = {};

// UUIDs for movement services and characteristics.
app.deviceUUID.PRIMARY_SERVICE = '0000a000-0000-1000-8000-00805f9b34fb';
app.deviceUUID.MOVEMENT_DATA = '0000a003-0000-1000-8000-00805f9b34fb';
//app.wearabledevice.MOVEMENT_CONFIG = 'f000aa82-0451-4000-b000-000000000000';
//app.wearabledevice.MOVEMENT_PERIOD = 'f000aa83-0451-4000-b000-000000000000';
//app.wearabledevice.MOVEMENT_NOTIFICATION = '00002902-0000-1000-8000-00805f9b34fb';

/**
 * Data that is plotted on the canvas.
 */
app.dataPoints = [];

/**
 * Latest sensor values
 */
app.sensorValues = [];

/**
 * Object that holds wearable device UUIDs.
 */
app.wearabledevice = {};

/**
 * Arrays that hold sensor values for gesture targets
 */
var rollTargets=[0,0,0,0,0,0,0,0,0];
var pitchTargets=[0,0,0,0,0,0,0,0,0];
var proximityTargets=[0,0,0,0,0,0,0,0,0];
var thermo1Targets=[0,0,0,0,0,0,0,0,0];
var thermo2Targets=[0,0,0,0,0,0,0,0,0];
var thermo3Targets=[0,0,0,0,0,0,0,0,0];
var thermo4Targets=[0,0,0,0,0,0,0,0,0];

/**
 * Initialise the application.
 */
app.initialize = function()
{
	document.addEventListener(
		'deviceready',
		function() { evothings.scriptsLoaded(app.onDeviceReady) },
		false);

//	initializeAWS(); //get reasy to stream data to AWS with Lambda and DynamoDB

	// Called when HTML page has been loaded.
	$(document).ready( function()
	{
		// Adjust canvas size when browser resizes
		$(window).resize(app.respondCanvas);

		// Adjust the canvas size when the document has loaded.
		app.respondCanvas();
	});
};

/**
 * Toggle Dead Reckoning Feature
 */
app.onDeadReckon = function()
{
	$("#forceButton").toggleClass("activeReckon");
	if($("#forceButton").hasClass("activeReckon")){
		app.reckonState = true;
		app.reckonInit = true;
	} else {
		app.reckonState = false;
		app.reckonInit = true;
	}
};

function initializeAWS()
{
	// TODO: Update aws-config.js with your access keys.
	evothings.aws.initialize(evothings.aws.config)
}

function writeAWS(label, data)
{
	//var temperature = data;

	function successCallback()
	{
		console.log('Written temperature: ' + temperature);
	}

	function errorCallback(error)
	{
		console.log('Write error: ' + JSON.stringify(error));
	}

	// Write the temperature value to the AWS Lambda cloud.
	console.log('Writing data...');
//	evothings.aws.update(label, data, successCallback, errorCallback);
}

/**
 * Adjust the canvas dimensions based on its container's dimensions.
 */
app.respondCanvas = function()
{
	var canvas = $('#canvas')
	var container = $(canvas).parent()
	canvas.attr('width', $(container).width() ) // Max width
	// Not used: canvas.attr('height', $(container).height() ) // Max height
};

/**
 * When low level initialization complete, this function is called.
 */
app.onDeviceReady = function()
{
	// Report status.
	//app.showInfo('Enter BLE device name and tap Connect');
	app.showInfo('Tap Connect');

	// Show the saved device name, if any.
	var name = localStorage.getItem('deviceName');
	if (name)
	{
		app.deviceName = name;
	}
	$('#deviceName').val(app.deviceName);
};

/**
 * Print debug info to console and application UI.
 */
app.showInfo = function(info)
{
	document.getElementById('info').innerHTML = info;
	console.log(info);
};

/**
 * Scan for device and connect.
 */
app.startScan = function()
{
	evothings.easyble.startScan(
		function(device)
		{
			// Do not show un-named devices.
			var deviceName = device.advertisementData ?
				device.advertisementData.kCBAdvDataLocalName : null
			if (!device.name) { return }

			// Print "name : mac address" for every device found.
			console.log(device.name + ' : ' + device.address.toString().split(':').join(''))

			// If my device is found connect to it.
			if (device.hasName(app.deviceName))
			{
				app.showInfo('Status: Device found: ' + deviceName);
				evothings.easyble.stopScan();
				app.connectToDevice(device);
			}
		},
		function(error)
		{
			app.showInfo('Error: startScan: ' + error);
		});
};

/**
 * Read services for a device.
 */
app.connectToDevice = function(device)
{
	app.showInfo('Status: Connecting...');
	device.connect(
		function(device)
		{
			app.device = device;
			app.showInfo('Status: Connected');
			app.readServices(app.device);

			//Start data streaming and graphing after device connection
			app.startAccelerometerNotification();
		},
		function(errorCode)
		{
			app.showInfo('Error: Connection failed: ' + errorCode);
		});
};

/**
 * Dump all information on named device to the console
 */
app.readServices = function(device)
{
	// Read all services.
	device.readServices(
		null,
		function()
		{
			console.log("readServices success");

			// Debug logging of all services, characteristics and descriptors
			// reported by the BLE board.
			app.logAllServices(app.device);
		},
		function(error)
		{
			console.log('Error: Failed to read services: ' + error);
		});
};

/**
 * when low level initialization complete,
 * this function is called
 */
app.onConnectButton = function()
{
	// Get device name from text field.
	app.deviceName = $('#deviceName').val();

	// Save it for next time we use the app.
	localStorage.setItem('deviceName', app.deviceName);

	// Call stop before you start, just in case something else is running.
	evothings.easyble.stopScan();
	evothings.easyble.closeConnectedDevices();

	// Only report devices once.
	evothings.easyble.reportDeviceOnce(true);

	// Start scanning.
	app.startScan();
	app.showInfo('Status: Scanning...');

	$("#numTargets").text("0 Targets");

};

/**
 * Target the TARGET on/off.
 */
app.onTargetButton = function()
{
	app.device.readCharacteristic(
		'0000a001-0000-1000-8000-00805f9b34fb',
		function(data)
		{
			var view = new Uint8Array(data);
			var target = new Uint8Array(1);
			app.totalTargets = app.totalTargets + 1; //add target

			//max targets, more just clears
			if(app.totalTargets > 9){
				app.onClearButton();

			} else {
				//will add latest sensor values to target arrays next BLE notification
				app.setTargetFlag = true; 

				target[0] = app.totalTargets;

				if(app.totalTargets == 1){
					$( "#numTargets" ).text("1 Target");
				} else {
					$( "#numTargets" ).text(app.totalTargets + " Targets");
				}

				app.device.writeCharacteristic(
					'0000a002-0000-1000-8000-00805f9b34fb',
					target,
					function() { console.log('Target added successfully!') },
					function(error) { console.log('Target add failed: ' + error) }
				);
			}

		},
		function(error)
		{
			console.log('Error: Read characteristic failed: ' + error);
		});
}

/**
 * Clear targets.
 */
app.onClearButton = function()
{
	app.device.readCharacteristic(
		'0000a001-0000-1000-8000-00805f9b34fb',
		function(data)
		{
			var view = new Uint8Array(data);
			var target = new Uint8Array(1);
			app.totalTargets = 0;
			target[0] = app.totalTargets;
			$("#numTargets").text("0 Targets");

			app.device.writeCharacteristic(
				'0000a002-0000-1000-8000-00805f9b34fb',
				target,
				function() { console.log('Targets cleared successfully!') },
				function(error) { console.log('Target clear failed: ' + error) });

		},
		function(error)
		{
			console.log('Error: Read characteristic failed: ' + error);
		}
	);

	console.log("clear targets");
	for(var d=0;d<rollTargets.length;d++){
		rollTargets[d]=0;
		pitchTargets[d]=0;
		proximityTargets[d]=0;
		thermo1Targets[d]=0;
		thermo2Targets[d]=0;
		thermo3Targets[d]=0;
		thermo4Targets[d]=0;
	}
}

app.onVarButton = function(buttonNum)
{
	app.device.readCharacteristic(
		'0000a001-0000-1000-8000-00805f9b34fb',
		function(data)
		{
			// app.varState stores data user input data marker state  0 = false/false , 1 = true/false , 2 = false/true , 3 = true/true 
			if(buttonNum == 1 && app.varState == 0) app.varState = 1;
			else if(buttonNum == 1 && app.varState == 1) app.varState = 0;
			else if(buttonNum == 1 && app.varState == 2) app.varState = 3;
			else if(buttonNum == 1 && app.varState == 3) app.varState = 2;
			else if(buttonNum == 2 && app.varState == 0) app.varState = 2;
			else if(buttonNum == 2 && app.varState == 1) app.varState = 3;
			else if(buttonNum == 2 && app.varState == 2) app.varState = 0;
			else if(buttonNum == 2 && app.varState == 3) app.varState = 2;


			var view = new Uint8Array(data);
			var sendVar = new Uint8Array(2);

			//add 90 to differentiate from target values which use same BLE characteristic for comms
			sendVar[0] = app.varState;
			sendVar[1] = 9;

			$("#numTargets").text("0 Targets");

			if(buttonNum == 1) { $("#alphaButton").toggleClass("green"); $("#alphaButton").toggleClass("hardIndigo"); }
			if(buttonNum == 2) { $("#betaButton").toggleClass("green"); $("#betaButton").toggleClass("hardIndigo"); }

			app.device.writeCharacteristic(
				'0000a002-0000-1000-8000-00805f9b34fb',
				sendVar,
				function() { console.log('Targets cleared successfully!') },
				function(error) { console.log('Target clear failed: ' + error) });

		},
		function(error)
		{
			console.log('Error: Read characteristic failed: ' + error);
		});
}

/**
 * Debug logging of found services, characteristics and descriptors.
 */
app.logAllServices = function(device)
{
	// Here we simply print found services, characteristics,
	// and descriptors to the debug console in Evothings Workbench.

	// Notice that the fields prefixed with "__" are arrays that
	// contain services, characteristics and notifications found
	// in the call to device.readServices().

	// Print all services.
	console.log('Found services:');
	for (var serviceUUID in device.__services)
	{
		var service = device.__services[serviceUUID];
		console.log('  service: ' + service.uuid);

		// Print all characteristics for service.
		for (var characteristicUUID in service.__characteristics)
		{
			var characteristic = service.__characteristics[characteristicUUID];
			console.log('    characteristic: ' + characteristic.uuid);

			// Print all descriptors for characteristic.
			for (var descriptorUUID in characteristic.__descriptors)
			{
				var descriptor = characteristic.__descriptors[descriptorUUID];
				console.log('      descriptor: ' + descriptor.uuid);
			}
		}
	}
};

/**
 * Data streaming and graphing on/off.
 */
/*app.onGraphButton = function()
{
	$("#graphButton").toggleClass("green"); $("#graphButton").toggleClass("indigo");
	app.startAccelerometerNotification();
}*/

app.readServices = function(device)
{
	device.readServices(
		[
		app.deviceUUID.PRIMARY_SERVICE // Movement service UUID.
		],
		// Function that monitors accelerometer data.
		app.startAccelerometerNotification,
		function(errorCode)
		{
			console.log('Error: Failed to read services: ' + errorCode + '.');
		});
};

/**
 * Read accelerometer data.
 */
app.startAccelerometerNotification = function(device)
{
	app.showInfo('Status: Starting accelerometer notification...');

	// Set accelerometer configuration to ON.
	// magnetometer on: 64 (1000000) (seems to not work in ST2 FW 0.89)
	// 3-axis acc. on: 56 (0111000)
	// 3-axis gyro on: 7 (0000111)
	// 3-axis acc. + 3-axis gyro on: 63 (0111111)
	// 3-axis acc. + 3-axis gyro + magnetometer on: 127 (1111111)
/*	device.writeCharacteristic(
		app.wearabledevice.MOVEMENT_CONFIG,
		new Uint8Array([56,0]),
		function()
		{
			console.log('Status: writeCharacteristic ok.');
		},
		function(errorCode)
		{
			console.log('Error: writeCharacteristic: ' + errorCode + '.');
		});

	// Set accelerometer period to 100 ms.
	device.writeCharacteristic(
		app.wearabledevice.MOVEMENT_PERIOD,
		new Uint8Array([10]),
		function()
		{
			console.log('Status: writeCharacteristic ok.');
		},
		function(errorCode)
		{
			console.log('Error: writeCharacteristic: ' + errorCode + '.');
		});

	// Set accelerometer notification to ON.
	device.writeDescriptor(
		app.wearabledevice.MOVEMENT_DATA,
		app.wearabledevice.MOVEMENT_NOTIFICATION, // Notification descriptor.
		new Uint8Array([1,0]),
		function()
		{
			console.log('Status: writeDescriptor ok.');
		},
		function(errorCode)
		{
			// This error will happen on iOS, since this descriptor is not
			// listed when requesting descriptors. On iOS you are not allowed
			// to use the configuration descriptor explicitly. It should be
			// safe to ignore this error.
			console.log('Error: writeDescriptor: ' + errorCode + '.');
		});
*/
	// Start accelerometer notification.
	device.enableNotification(
		app.deviceUUID.MOVEMENT_DATA,
		function(data)
		{
			app.showInfo('Status: Data stream active');
			var dataArray = new Uint8Array(data);
		//	console.log(dataArray);// debug

			//parse data from sensors
			var values = app.getAccelerometerValues(dataArray);

			//Update global sensor vals
			app.sensorValues = values; 

			//add latest sensor values to the target array if the set target button was just pushed
		/*	if(app.setTargetFlag == true){
				console.log("set target vals");
				rollTargets[app.totalTargets] = values[0];
				pitchTargets[app.totalTargets] = values[1];
				proximityTargets[app.totalTargets] = values[2];
				thermo1Targets[app.totalTargets] = values[3];
				thermo2Targets[app.totalTargets] = values[4];
				thermo3Targets[app.totalTargets] = values[5];
				thermo4Targets[app.totalTargets] = values[6];
				app.setTargetFlag == false;
			} */

			//send sensor data to AWS: Lambda dunction -> DynamoDB
			/* DISABLE DATA STREAMING DURING TESTING
			writeAWS('roll', values[0]); 
			writeAWS('pitch', values[1]);
			writeAWS('proximity', values[2]); 
			writeAWS('thermo1', values[3]); 
			writeAWS('thermo2', values[4]); 
			writeAWS('thermo3', values[5]); 
			writeAWS('thermo4', values[6]);  
			writeAWS('variable', app.varState);
			*/

			//graph data in app UI
			app.drawDiagram(values);
		},
		function(errorCode)
		{
			console.log('Error: enableNotification: ' + errorCode + '.');
		});
};

/**
 * Calculate accelerometer values from raw data for wearabledevice 2.
 * @param data - an Uint8Array.
 * @return Object with fields: x, y, z.
 */
app.getAccelerometerValues = function(data)
{
	//	var divisors = { x: -16384.0, y: 16384.0, z: -16384.0 };
	console.log("app.getAccelerometerValues" );

	//Parse data
	var roll 		= evothings.util.littleEndianToUint8(data, 0);
	var pitch 		= evothings.util.littleEndianToUint8(data, 1);
	var proximity 	= evothings.util.littleEndianToUint8(data, 2);
	var thermo1 	= evothings.util.littleEndianToUint8(data, 3);
	var thermo2 	= evothings.util.littleEndianToUint8(data, 4); 
	var thermo3 	= evothings.util.littleEndianToUint8(data, 5);
	var thermo4 	= evothings.util.littleEndianToUint8(data, 6);


//	console.log("roll: " + roll + " pitch: " + pitch + " proximity: " + proximity + " thermo1: " + thermo1 + " thermo2: " + thermo2 + " thermo3: " + thermo3 + " thermo4: " + thermo4);

	// Return result.
	return [roll, pitch, proximity, thermo1, thermo2, thermo3, thermo4];
};

/**
 * Plot diagram of sensor values.
 * Values plotted are expected to be between -1 and 1
 * and in the form of objects with fields x, y, z.
 */
app.drawDiagram = function(values)
{
	console.log("in draw diagram");
//	var canvas = document.getElementById('canvas');
//	var context = canvas.getContext('2d');

	//change blade color based on thermopiles if conditions met 
	if(values[3] > 85 ||  values[4] > 85 ||  values[5] > 85 ||  values[6] > 85)
	{
		LightSaberDemo.thermopileBladeColor(values[3], values[4], values[5], values[6], "Var");
	}

	if(app.reckonState){
		LightSaberDemo.deadReckon(values[3], values[4], values[5], values[6], app.handState, app.reckonInit);
		app.reckonInit = false;
	}

	//rotate light saber  PITCH = X , ROLL = Z
	LightSaberDemo.updateSensorDeltas(values[1], values[0]);

	$(".senseVal.rollVal").text("Roll: " + values[0]);
	$(".senseVal.pitchVal").text("Pitch: " + values[1]);
	$(".senseVal.proximityVal").text("Prox: " + values[2]);
	$(".senseVal.thermo1Val").text("T1: " + values[3]);
	$(".senseVal.thermo2Val").text("T2: " + values[4]);
	$(".senseVal.thermo3Val").text("T3: " + values[5]);
	$(".senseVal.thermo4Val").text("T4: " + values[6]);

	// Add recent values.
/*	app.dataPoints.push(values);

	console.log("app.dataPoints.length: " + app.dataPoints.length);
	console.log("app.dataPoints: " + app.dataPoints);
	console.log("app.dataPoints[x]: " + app.dataPoints[app.dataPoints.length-1]);
	console.log("app.dataPoints[x][0]: " + app.dataPoints[app.dataPoints.length-1][0]);

	// Remove data points that do not fit the canvas.
	if (app.dataPoints.length > canvas.width)
	{
		app.dataPoints.splice(0, (app.dataPoints.length - canvas.width));
	} */

	// Value is an accelerometer reading between -1 and 1.
	function calcDiagramY(value, axis)
	{
	//	console.log("in drawLine calcDiagramY");
		// Return Y coordinate for this value.
		var diagramY;
	//	var diagramY = (( (1 / value) * canvas.height) / 2) + (canvas.height / 2);
		if(axis == 0){  //angular
			diagramY = (value) / 6 + 10/* (canvas.height / 7)*/;
		}
		else if(axis == 1){  //angular
			diagramY = (value) / 6 + 20/*(canvas.height / 7)*/;
		}
		else if(axis == 2){   //proximity
			diagramY = (255 - value) / 7 + (canvas.height - 35);
		}
		else if(axis == 3){ //thermopiles
			diagramY = (102 - value) * 2 + (canvas.height / 5) + 0;
		}
		else if(axis == 4){ //thermopiles
			diagramY = (102 - value) * 2 + (canvas.height / 5) + 15;
		}
		else if(axis == 5){ //thermopiles
			diagramY = (102 - value) * 2 + (canvas.height / 5) + 30;
		}
		else if(axis == 6){ //thermopiles
			diagramY = (102 - value) * 2 + (canvas.height / 5) + 45;
		}
		//var diagramY = value / 2;

		return diagramY;
	}

	function drawLine(axis, color)
	{
		console.log("in drawLine");
		context.beginPath();
		context.strokeStyle = color;
		context.setLineDash([]); //no more dashed lines

		var lastDiagramY = calcDiagramY(app.dataPoints[app.dataPoints.length-1][axis], axis);
	//	var lastDiagramY = app.dataPoints[app.dataPoints.length-1][axis] / 2;
		//	context.moveTo(0, lastDiagramY);
			context.moveTo(app.dataPoints.length - 2, lastDiagramY);

		var x = 1;
		for (var i = app.dataPoints.length - 2; i >= 0; i--)
		{
			var y = calcDiagramY(app.dataPoints[i][axis], axis);
		//	var y = (app.dataPoints[i][axis] / 2); //test
		//	context.lineTo(x, y);
			context.lineTo(i, y); //TEST
			//context.lineTo(x, 0);
			x++;
		}

		context.stroke();

		//draw horizontal dashed lines for targets
		if(app.totalTargets > 0){
			context.beginPath();
			context.strokeStyle = color;
			context.setLineDash([3, 5]);/*dashes are 5px and spaces are 3px*/
			var targetY;
			for(var t=0; t<app.totalTargets; t++){
					if(axis == 0) 	   targetY = calcDiagramY(rollTargets[t], axis); 	
					else if(axis == 1) targetY = calcDiagramY(pitchTargets[t], axis); 	
					else if(axis == 2) targetY = calcDiagramY(proximityTargets[t], axis); 
					else if(axis == 3) targetY = calcDiagramY(thermo1Targets[t], axis); 	
					else if(axis == 4) targetY = calcDiagramY(thermo2Targets[t], axis); 	
					else if(axis == 5) targetY = calcDiagramY(thermo3Targets[t], axis); 	
					else if(axis == 6) targetY = calcDiagramY(thermo4Targets[t], axis); 	
					context.moveTo(0, targetY);
					context.lineTo(canvas.width, targetY);
					console.log("Sensor index: " + axis + " Target Y val: " + targetY);
			}
			context.stroke();
		}
		
		
	}

	// Clear background.
//	context.clearRect(0, 0, canvas.width, canvas.height);
	
//console.log("targets @ draw line: ");
//console.log(rollTargets);
//console.log(pitchTargets);
//console.log(proximityTargets);
//console.log(thermo1Targets);
//console.log(thermo2Targets);
/*
	// Draw lines.
	drawLine(0, '#202020');
	drawLine(1, '#808080');
	drawLine(2, '#00f');
	drawLine(3, '#855723');
	drawLine(4, '#b99c6b');
	drawLine(5, '#8f3b1b');
	drawLine(6, '#d57500');
*/
	//	context.fillStyle = "orange";
		//context.strokeRect(20,20,30,50);
	//	context.fillRect(20,20,50,50);

};

// Initialize the app.
app.initialize();


