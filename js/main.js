/*
​x=r sin(φ)cos(θ)
​y=r sin(φ)sin(θ)
​z=r cos(φ)
*/
/* DATA SAMPLE TEMPLATE
{
    	let accelerometerX      = (event.target.value.getUint8(0) / 100) - 1;
    	let accelerometerY      = (event.target.value.getUint8(1) / 100) - 1;
    	let accelerometerZ      = (event.target.value.getUint8(2) / 100) - 1;
    	let accelerometerRoll   = (event.target.value.getUint8(3) * 1.41);
    	let accelerometerPitch  = (event.target.value.getUint8(4) * 1.41);
    	let devicePhotosensor  	= (event.target.value.getUint8(5) * 4);
    	let deviceTouchsensor  	= (event.target.value.getUint8(6) * 4);
}*/


//sensor data object
var state = {};
//connection flag

var bluetoothDataFlag = false;
    // Web Bluetooth connection -->

$( document ).ready(function() {
    button = document.getElementById("connect");
    message = document.getElementById("message");
//});

	if ( 'bluetooth' in navigator === false ) {
	    button.style.display = 'none';
	    message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
	}
});

const services = {
    controlService: {
        name: 'control service',
        uuid: '0000a000-0000-1000-8000-00805f9b34fb'
    }
}

const characteristics = {
    commandReadCharacteristic: {
        name: 'command read characteristic',
        uuid: '0000a001-0000-1000-8000-00805f9b34fb'
    },
    commandWriteCharacteristic: {
        name: 'command write characteristic',
        uuid: '0000a002-0000-1000-8000-00805f9b34fb'
    },
    deviceDataCharacteristic: {
        name: 'imu data characteristic',
        uuid: '0000a003-0000-1000-8000-00805f9b34fb'
    }
}

var _this;
var state = {};
var previousPose;

var sendCommandFlag = false; //global to keep track of when command is sent back to device
//let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);   //command to send back to device
let commandValue = new Uint8Array([0x99]); //command to send back to device

class ControllerWebBluetooth {
    constructor(name) {
        _this = this;
        this.name = name;
        this.services = services;
        this.characteristics = characteristics;
        this.standardServer;
    }

    connect() {
        return navigator.bluetooth.requestDevice({
            filters: [{
                        name: this.name
                    },
                    {
                        services: [services.controlService.uuid]
                    }
                ]
            })
            .then(device => {
                console.log('Device discovered', device.name);
                return device.gatt.connect();
            })
            .then(server => {
                console.log('server device: ' + Object.keys(server.device));

                this.getServices([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], server);
            })
            .catch(error => {
                console.log('error', error)
            })
    }

    getServices(requestedServices, requestedCharacteristics, server) {
        this.standardServer = server;

        requestedServices.filter((service) => {
            if (service.uuid == services.controlService.uuid) {
                _this.getControlService(requestedServices, requestedCharacteristics, this.standardServer);
            }
        })
    }

    getControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to IMU, EMG and Pose data, we need to indicate to the Myo that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                //  let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);
                //this could be config info to be sent to the wearable device
                let commandValue = new Uint8Array([0x99]);
                //   characteristic.writeValue(commandValue); //disable initial write to device
            })
            .then(_ => {

                let deviceDataChar = requestedCharacteristics.filter((char) => {
                    return char.uuid == characteristics.deviceDataCharacteristic.uuid
                });

                console.log('getting service: ', controlService[0].name);
                _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                console.log('error: ', error);
            })
    }

    sendControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting write command to device characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                let commandValue = new Uint8Array([0x99]);
                getConfig();
                commandValue[0] = targetCommand;

                console.log("CONFIG target:" + activeTarget + "  command:" + commandValue[0]);
                characteristic.writeValue(commandValue);
            })
            .then(_ => {

                //  let deviceDataChar = requestedCharacteristics.filter((char) => {return char.uuid == characteristics.deviceDataCharacteristic.uuid});
                console.log("COMMAND SENT TO DEVICE");
                sendCommandFlag = false;
                //   console.log('getting service: ', controlService[0].name);
                //  _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                sendCommandFlag = false;
                console.log("COMMAND SEND ERROR");
                console.log('error: ', error);
            })
    }


    handleDeviceDataChanged(event) {
        //byteLength of deviceData DataView object is 20.
        // deviceData return {{orientation: {w: *, x: *, y: *, z: *}, accelerometer: Array, gyroscope: Array}}

        let deviceData = event.target.value;

        //decompress the very crude compression on device side to fit values into BLE data packet
    	let accelerometerX      = (event.target.value.getUint8(0) / 100) - 1;
    	let accelerometerY      = (event.target.value.getUint8(1) / 100) - 1;
    	let accelerometerZ      = (event.target.value.getUint8(2) / 100) - 1;
    	let accelerometerRoll   = (event.target.value.getUint8(3) * 1.41);
    	let accelerometerPitch  = (event.target.value.getUint8(4) * 1.41);
    	let devicePhotosensor  	= (event.target.value.getUint8(5) * 4);
    	let deviceTouchsensor  	= (event.target.value.getUint8(6) * 4);

        //adjust angular position to simulate joystick - assume device centered upright as origin position 
        //allow 60 degree variation
        var controllerRoll = accelerometerRoll;
        var controllerPitch = accelerometerPitch;

        /*
        origin: Pitch 180, Roll 90     pitch-> Y axis, roll-> X axis
        allowed variation: 120 degrees
        range  pitch: 240-120   roll: 150-30
        break points  pitch: 0   roll: 270
        */
        if(controllerRoll > 150 && controllerRoll < 270) controllerRoll = 150;
        if(controllerRoll > 270 && controllerRoll < 0 || controllerRoll > 0 && controllerRoll < 30) controllerRoll = 30;

        if(controllerPitch > 240 && controllerPitch < 360) controllerPitch = 240;
        if(controllerPitch > 0 && controllerPitch < 120) controllerPitch = 120;

        //convert to x/z width/height percentage values
        controllerRoll = (controllerRoll - 30) / 120;
        controllerPitch = (controllerPitch - 120) / 120;
        console.log("Game Roll:" + controllerRoll + " Game Pitch:" + controllerPitch);

        state = {
                pitch: accelerometerPitch,
                roll: accelerometerRoll,
                x: accelerometerX,
                y: accelerometerY,
                z: accelerometerZ,
                photosensor: devicePhotosensor,
                touch: deviceTouchsensor,
                controllerX: controllerRoll,
                controllerY: controllerPitch

        }

        //move this out of state change 
        if (sendCommandFlag) {
            //this.standardServer = server;
            for (var i = 0; i < 3; i++) {
                //  sendControlService();
                _this.sendControlService([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], _this.standardServer);
            }
            sendCommandFlag = false;
        }

        _this.onStateChangeCallback(state);
    }

    onStateChangeCallback() {}

    getdeviceData(service, characteristic, server) {
        return server.getPrimaryService(service.uuid)
            .then(newService => {
                console.log('getting characteristic: ', characteristic.name);
                return newService.getCharacteristic(characteristic.uuid)
            })
            .then(char => {
                char.startNotifications().then(res => {
                    char.addEventListener('characteristicvaluechanged', _this.handleDeviceDataChanged);
                })
            })
    }

    onStateChange(callback) {
        _this.onStateChangeCallback = callback;
    }
}

/*******************************************************************************************************************
 *********************************************** INITIALIZE *********************************************************
 ********************************************************************************************************************/

//sensor array sample data
var sensorDataArray = new Array(8).fill(0);

$(document).ready(function() {

    /*******************************************************************************************************************
     *********************************************** WEB BLUETOOTH ******************************************************
     ********************************************************************************************************************/

    //Web Bluetooth connection button and ongoing device data update function
    button.onclick = function(e) {
        var sensorController = new ControllerWebBluetooth("Tingle");
        sensorController.connect();

        //ON SENSOR DATA UPDATE
        sensorController.onStateChange(function(state) {
            bluetoothDataFlag = true;
        });

        //check for new data every X milliseconds - this is to decouple execution from Web Bluetooth actions
        setInterval(function() {
            //     bluetoothDataFlag = getBluetoothDataFlag();

            if (bluetoothDataFlag == true) {

                timeStamp = new Date().getTime();

                //load data into global array
                sensorDataArray = new Array(8).fill(0);

                sensorDataArray[0] = state.x.toFixed(2);
                sensorDataArray[1] = state.y.toFixed(2);
                sensorDataArray[2] = state.z.toFixed(2);
                sensorDataArray[3] = state.pitch.toFixed(1);
                sensorDataArray[4] = state.roll.toFixed(1);

                sensorDataArray[5] = state.photosensor.toFixed(1);
                sensorDataArray[6] = state.touch.toFixed(1);
                sensorDataArray[7] = timeStamp;

                //update time series chart with normalized values
                var rawPitchChart = (sensorDataArray[3] / 361);
                var rawRollChart = (sensorDataArray[4] / 361);

                //sensor values normalized and adjusted for chart
                rawPitchChart = (rawPitchChart / 3) + 3 * 0.1;
                rawRollChart = (rawRollChart / 3) + 2 * 0.1;

                linePitch.append(timeStamp, rawPitchChart);
                lineRoll.append(timeStamp, rawRollChart);

                displayData();

                bluetoothDataFlag = false;
            }

        }, 200); // throttle 100 = 10Hz limit
    }


    /*******************************************************************************************************************
    **************************************** STREAMING SENSOR DATA CHART ***********************************************
    *******************************************************************************************************************/

    //add smoothie.js time series streaming data chart
    var chartHeight = 100;
    var chartWidth = $(window).width();

    $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');

    var streamingChart = new SmoothieChart({/*  grid: { strokeStyle:'rgb(125, 0, 0)', fillStyle:'rgb(60, 0, 0)', lineWidth: 1, millisPerLine: 250, verticalSections: 6, }, labels: { fillStyle:'rgb(60, 0, 0)' } */ });

    streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );

    var linePitch = new TimeSeries();
    var lineRoll = new TimeSeries();
    var linePhoto = new TimeSeries();

    streamingChart.addTimeSeries(linePitch, {strokeStyle: 'rgb(128, 128, 128)', lineWidth: 4 });
    streamingChart.addTimeSeries(linePhoto,  {strokeStyle: 'rgb(206, 66, 244)', lineWidth: 3 }); 
    streamingChart.addTimeSeries(lineRoll,  {strokeStyle: 'rgb(240, 240, 240)', lineWidth: 4 });

    //min/max streaming chart button
    $('#circleDrop').click(function() {

        $('.card-middle').slideToggle();
        $('.close').toggleClass('closeRotate');

        var chartHeight = $(window).height() / 1.2;
        var chartWidth = $(window).width();

        if ($("#chart-size-button").hasClass('closeRotate')) {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');
        } else {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + 100 + '"></canvas>');
        }

        //hide controls
        $("#basic-interface-container, #hand-head-ui-container, #nn-slide-controls, .console, #interface-controls, #dump-print, #record-controls").toggleClass("hide-for-chart");
        //redraw chart
        streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    });

    //numerical data display
    function displayData() {
        var accelerometerPitchDiv = document.getElementsByClassName('accelerometer-pitch-data')[0];
        var accelerometerRollDiv =  document.getElementsByClassName('accelerometer-roll-data')[0];

        accelerometerPitchDiv.innerHTML =  		sensorDataArray[3];
        accelerometerRollDiv.innerHTML 	=    	sensorDataArray[4];
    }

}); // end on document load
