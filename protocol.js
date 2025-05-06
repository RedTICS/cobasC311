//var logger = require('winston');
var logger = require('./logger'); // Importa el logger configurado

var SerialPort = require('serialport');

// Internal Dependencies
var config = require('./config');
var token = require('./constants');
var codec = require('./codec');
var app = require('./app');
//var db = require('./db'); --> Ahora usamos la API

// Init logging, imprime en consola cuando este en modo debugging
//logger.level = config.logLevel;

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
       throw new Error("["+ new Date().toLocaleString() + "] : Port Error: " + err.message);
    });
}



function handlePortOpen() {
    logger.info("Port open. Data rate: " + port.options.baudRate);
    logger.info("Data Bits.: " + port.options.dataBits);
    logger.info("Parity.: " + port.options.parity);
    logger.info("Stop bit.: " + port.options.stopBits);
}

function handlePortClose() {
    logger.info("Port Closed.");
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

    if (data === token.ENQ) { //ENQ es un código de control que significa "¿Puedo enviar datos?"
        logger.info("Request: ENQ");
        if (!isTransferState) {
            isTransferState = true;
            response = token.ACK;
        }
        else {
            logger.error("ENQ is not expected. Transfer state already.");
            response = token.NAK;
        }
    }
    else if (data === token.ACK) { //"Mensaje recibido"
        throw new Error("["+ new Date().toLocaleString() + "] : ACK is not expected.");
    }
    else if (data === token.NAK) {
        throw new Error("["+ new Date().toLocaleString() + "] : NAK is not expected.");
    }
    else if (data === token.EOT) { // EOT (fin de transmisión)
        if (isTransferState) {
            isTransferState = false;
            logger.info("EOT accepted. OK");
        }
        else {
            throw new Error("["+ new Date().toLocaleString() + "] : Not ready to accept EOT message.");
        }
    }
    else if (data.startsWith(token.STX)) {
        if (!isTransferState) {
            discard_input_buffers();
            logger.error("Not ready to accept messages");
            response = token.NAK;
        }
        else {
            try {
                logger.info( "Accept message.Handling message");
                handleMessage(data);
                response = token.ACK;
            }
            catch (err) {
                logger.error("Error occurred on message handling." + err)
                response = token.NAK;
            }
        }
    }
    else {
        throw new Error("["+ new Date().toLocaleString() + "] : Invalid data.");
    }

    handlePortWrite(response);
};

function handleMessage(message) {
    if (codec.isChunkedMessage(message)) {
        logger.info("handleMessage: Is chunked transfer.");
        inputChunks.push(message);
    }
    else if (typeof inputChunks !== 'undefined' && inputChunks.length > 0) {
        logger.info("handleMessage: Previous chunks. This must be the last one");
        inputChunks.push(message);
        dispatchMessage(inputChunks.join(''), token.ENCODING);
        inputChunks = [];
    }
    else {
        logger.info("handleMessage: Complete message. Dispatching");
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
        throw new Error("["+ new Date().toLocaleString() + "] : Client should not receive ENQ.");
    }
    else if (data === token.ACK) {
        logger.info("ACK Response");
        lastSendOk = true;
        try {
            sendMessage();
        }
        catch (error) {
            logger.error(error);
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
        logger.info("NAK Response");
        if (lastSendData === token.ENQ) {
            openClientSession();
        }
        else {
            try {
                lastSendOk = false;
                sendMessage();
            }
            catch (error) {
                logger.error(error);
                closeClientSession();
            }
        }

        // TODO: Revisar la condicion de abajo
        // if message == EOT:
        // self.openClientSession()
    }
    else if (data === token.EOT) {
        isTransferState = false;
        throw new Error("["+ new Date().toLocaleString() + "] : Client should not receive EOT.");
    }
    else if (data.startsWith(token.STX)) {
        isTransferState = false;
        throw new Error("["+ new Date().toLocaleString() + "] : Client should not receive ASTM message.");
    }
    else {
        throw new Error("["+ new Date().toLocaleString() + "] : Invalid data.");
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
           //db.getNextProtocolToSend()
           
           //Traigo los datos con la API
           app.getNextProtocolToSend().then(function (results) {
            //results contiene un arreglo del protocolo a enviar
            if (results){
                for (var i = 0; i < results.length; i++) { // Always only 1 iteration
                    var protocol = results[i];
                    prepareMessagesToSend(protocol)
                    prepareNextEncodedMessage();
                    sendData();
                }
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
            /*if (lastSendData !== token.ENQ) {
                // Remove last protocol to send to prevent future problems with 
                // the same protocol
                //db.removeLastProtocolSent(); --> Ahora con la API se marca como enviado cuando se hace el GET
            }*/
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
            /*else {
               // db.removeLastProtocolSent(); --> Ahora con la API se marca como enviado cuando se hace el GET
                // checkDataToSend();
            }*/

            return;
        }
    }
    handlePortWrite(lastSendData);
}


function openClientSession() {
    logger.info('Open Client Session');
    retryCounter = retryCounter + 1;
    if (retryCounter > 6) {
        logger.error("Exceed number of retries");
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
    logger.info("Close Client Session");
    handlePortWrite(token.EOT); // Envia un mensaje EOT (fin de transmisión)
    isTransferState = false;
    isClientMode = false;
    retryCounter = 0;
}

function checkDataToSend() {
   // db.hasProtocolsToSend().then(function (results) 
   //Ahora trae el resultado por API
    app.hasProtocolsToSend().then(function (results) 
    {
        if (results && results[0] && results[0].Cantidad > 0) {
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
                logger.info("Waiting for data to send");
                return;
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
        throw new Error("["+ new Date().toLocaleString() + "] : Timeout Communication");
    }
}

function runIntervalCheck() {
    setInterval(checkDataToSend, 10000);
};


runIntervalCheck();