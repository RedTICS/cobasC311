var logger = require('winston');
var SerialPort = require('serialport');

// Internal Dependencies
var config = require('./config');
var token = require('./constants');
var codec = require('./codec');
var app = require('./app');
var db = require('./db');

// Init logging, imprime en consola cuando este en modo debugging
logger.level = config.logLevel;

// Global variables for Client and Server mode
var isTransferState = false;
var isClientMode = false;
var port = null; // COM Port Communication

init();

function init() {
    port = new SerialPort(config.comPort);
    port.on('open', handlePortOpen);
    port.on('close', handlePortClose);
    port.on('data', handlePortData);
    port.on('error', function (err) {
        logger.error(err.message);
        throw new Error('Port Error: ' + err.message);
    })
}



function handlePortOpen() {
    logger.info('Port open. Data rate: ' + port.options.baudRate);
    logger.info('Data Bits.: ' + port.options.dataBits);
    logger.info('Parity.: ' + port.options.parity);
    logger.info('Stop bit.: ' + port.options.stopBits);
}

function handlePortClose() {
    logger.info('Port Closed.');
}

function handlePortWrite(data) {
    logger.info("Escribir data " + data);
    port.write(data);
    initTimer();
}

function handlePortData(data) {
    logger.info("Manejar data "+ data); // Raw Buffer Data
    var data = data.toString('ascii');

    if (isTransferState) {
        if (isClientMode) {
            readDataAsClient(data);
        }
        else {
            readDataAsServer(data);
        }
    }
    else {
        readDataAsServer(data);
    }
}

////////////////// SERVER MODE //////////////////////

var inputChunks = [];

function readDataAsServer(data) {
    var response = '';

    if (data === token.ENQ) {
        logger.info('Request: ENQ');
        if (!isTransferState) {
            isTransferState = true;
            response = token.ACK;
        }
        else {
            logger.error('ENQ is not expected. Transfer state already.');
            response = token.NAK;
        }
    }
    else if (data === token.ACK) {
        logger.error('ACK is not expected.');
        throw new Error('ACK is not expected.');
    }
    else if (data === token.NAK) {
        logger.error('NAK is not expected.');
        throw new Error('NAK is not expected.');
    }
    else if (data === token.EOT) {
        if (isTransferState) {
            isTransferState = false;
            logger.info('EOT accepted. OK');
        }
        else {
            logger.error('Not ready to accept EOT message.');
            throw new Error('Not ready to accept EOT message.');
        }
    }
    else if (data.startsWith(token.STX)) {
        if (!isTransferState) {
            discard_input_buffers();
            logger.error('Not ready to accept messages');
            response = token.NAK;
        }
        else {
            try {
                logger.info('Accept message.Handling message');
                handleMessage(data);
                response = token.ACK;
            }
            catch (err) {
                logger.error('Error occurred on message handling.' + err)
                response = token.NAK;
            }
        }
    }
    else {
        logger.error('Invalid data.');
        throw new Error('Invalid data.');
    }

    handlePortWrite(response);
};

function handleMessage(message) {
    if (codec.isChunkedMessage(message)) {
        logger.debug('handleMessage: Is chunked transfer.');
        inputChunks.push(message);
    }
    else if (typeof inputChunks !== 'undefined' && inputChunks.length > 0) {
        logger.debug('handleMessage: Previous chunks. This must be the last one');
        inputChunks.push(message);
        dispatchMessage(inputChunks.join(''), token.ENCODING);
        inputChunks = [];
    }
    else {
        logger.debug('handleMessage: Complete message. Dispatching');
        dispatchMessage(message, token.ENCODING);
    }
}

function dispatchMessage(message) {
    console.log(message);
    var records = codec.decodeMessage(message);
    logger.info(records);
    app.processResultRecords(records);
}

function discard_input_buffers() {
    inputChunks = [];
}



////////////////// CLIENT MODE //////////////////////

var outputChunks = [];
var outputMessages = [];
var retryCounter = 0;
var lastSendOk = false;
var lastSendData = "";
var timer;

function readDataAsClient(data) {

    if (data === token.ENQ) {
        if (lastSendData === token.ENQ) {
            //TODO: Link Contention??
        }
        throw new Error('Client should not receive ENQ.');
    }
    else if (data === token.ACK) {
        logger.debug('ACK Response');
        lastSendOk = true;
        try {
            sendMessage();
        }
        catch (error) {
            logger.debug(error);
            closeClientSession();
        }
        //handlePortWrite(message); //self.push(message)
        // TODO: Revisar la condicion de abajo
        // if (message === token.EOT){
        // self.openClientSession()
        // }
    }
    else if (data === token.NAK) {
        // Handles NAK response from server.

        // The client tries to repeat last
        // send for allowed amount of attempts. 
        logger.debug('NAK Response');
        if (lastSendData === token.ENQ) {
            openClientSession();
        }
        else {
            try {
                lastSendOk = false;
                sendMessage();
            }
            catch (error) {
                closeClientSession();
            }
        }

        // TODO: Revisar la condicion de abajo
        // if message == EOT:
        // self.openClientSession()
    }
    else if (data === token.EOT) {
        isTransferState = false;
        throw new Error('Client should not receive EOT.');
    }
    else if (data.startsWith(token.STX)) {
        isTransferState = false;
        throw new Error('Client should not receive ASTM message.');
    }
    else {
        throw new Error('Invalid data.');
    }
}

function prepareMessagesToSend(protocol) {
    outputMessages = [];
    outputMessages = app.composeOrderMessages(protocol);
}

function prepareNextEncodedMessage() {
    outputChunks = [];
    outputChunks = codec.encode(outputMessages.shift());
}

function sendMessage() {
    if (lastSendData === token.ENQ) {
        if (outputMessages.length > 0) {
            // Still exists messages to send
            prepareNextEncodedMessage();
            sendData();
        }
        else {
            db.getNextProtocolToSend().then(function (results) {
                for (var i = 0; i < results.length; i++) { // Always only 1 iteration
                    var protocol = results[i];
                    prepareMessagesToSend(protocol)
                    prepareNextEncodedMessage();
                    sendData();
                }
            }, function (err) {
                logger.error("Something bad happened:", err);
            });
        }
    }
    else {
        sendData();
    }
}

function sendData() {
    if (!lastSendOk) {
        if (retryCounter > 6) {
            closeClientSession();
            if (lastSendData !== token.ENQ) {
                // Remove last protocol to send to prevent future problems with 
                // the same protocol
                db.removeLastProtocolSent();
            }
            return;
        }
        else {
            retryCounter = retryCounter + 1;
        }
    }
    else {
        retryCounter = 0;
        if (outputChunks.length > 0) {
            lastSendData = outputChunks.shift();
        }
        else {
            closeClientSession();
            if (outputMessages.length > 0) {
                openClientSession();
            }
            else {
                db.removeLastProtocolSent();
                // checkDataToSend();
            }

            return;
        }
    }
    handlePortWrite(lastSendData);
}


function openClientSession() {
    logger.info('Open Client Session');
    retryCounter = retryCounter + 1;
    if (retryCounter > 6) {
        logger.error('Exceed number of retries');
        closeClientSession();
    }
    else {
        handlePortWrite(token.ENQ);
        lastSendData = token.ENQ;
        isTransferState = true;
        isClientMode = true;
    }
}

function closeClientSession() {
    logger.debug('Close Client Session');
    handlePortWrite(token.EOT);
    isTransferState = false;
    isClientMode = false;
    retryCounter = 0;
}

function checkDataToSend() {
    db.hasProtocolsToSend().then(function (results) {
        if (results[0].total > 0) {
            logger.info("Exist data to send");
            if (!isClientMode) {
                openClientSession();
            }
        }
        else {
            if (isClientMode) {
                isClientMode = false;
            }
            else {
                return;
                logger.info('Waiting for data to send');
            }
        }
    }, function (err) {
        logger.error("Something bad happened:", err);
    });
}

function initTimer() {
    clearTimeout(timer);
    timer = setTimeout(timeoutCommunication, 5000);
}

function timeoutCommunication() {
    if (isTransferState) {
        throw new Error('Timeout Communication');
    }
}

function runIntervalCheck() {
    setInterval(checkDataToSend, 10000);
};


runIntervalCheck();