// ambiente_Test
// IP 10.1.232.229
// user sa
// pass ssecure
// db SIPHospital

var config = require('./config');

var logger = require('winston');
logger.level = config.logLevel;
// logger.exitOnError = false;
// logger.handleExceptions(new (logger.transports.Console)());

var SerialPort = require('serialport');
var port = new SerialPort("COM5"); 
// Internal Dependencies
var token = require('./constants');
var codec = require('./codec');
var app = require('./app');
var dbLocal = require('./dbsqlite');
var db = require('./db');

var isTransferState = false;
var isClientMode = false;


port.on('open', handlePortOpen);
port.on('close', handlePortClose);
port.on('data', handlePortData);
port.on('error', function(err) {
  logger.error(err.message);
  throw new Error('Port Error: ' + err.message);
})


function handlePortOpen() {
    logger.info('Port open. Data rate: ' + port.options.baudRate);
}

function handlePortClose() {
    logger.info('Port Closed.');
}

function handlePortWrite(data){
    logger.info('Escribiendo en puerto')
    logger.info(data);
    port.write(data);
    initTimer();
}

function handlePortData(data){
    logger.info(data); // Raw Buffer Data
    var data = data.toString('ascii');
     
     if (isTransferState){
         if (isClientMode){
             readDataAsClient(data);
         }
         else{
             readDataAsServer(data);
         }
         
     }
     else{
         readDataAsServer(data);
     }
}

////////////////// SERVER MODE //////////////////////

var inputChunks = [];

function readDataAsServer(data){
    var response = '';
    
    if (data === token.ENQ){
        logger.info('Request: ENQ');
        if (!isTransferState){
            isTransferState = true;
            response = token.ACK;
        }
        else{
            logger.error('ENQ is not expected. Transfer state already.');
            response = token.NAK;
        }
    }
    else if (data === token.ACK){
        logger.error('ACK is not expected.');
        throw new Error('ACK is not expected.');
    }
    else if (data === token.NAK){
        logger.error('NAK is not expected.');
        throw new Error('NAK is not expected.');
    }
    else if (data === token.EOT){
        if (isTransferState){
            isTransferState = false;
            logger.info('EOT accepted. OK');
        }
        else{
            logger.error('Not ready to accept EOT message.');
            throw new Error('Not ready to accept EOT message.');
        }
    }
    else if (data.startsWith(token.STX)){
        if (!isTransferState){
            discard_input_buffers();
            logger.error('Not ready to accept messages');
            response = token.NAK;
        }
        else{
            try{
                logger.info('Accept message.Handling message');
                handleMessage(data);
                response = token.ACK;
            }
            catch(err){
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

function handleMessage(message){
    if (codec.isChunkedMessage(message)){
        logger.debug('handleMessage: Is chunked transfer.');
        inputChunks.push(message);
    }
    else if (typeof inputChunks !== 'undefined' && inputChunks.length > 0){
        logger.debug('handleMessage: Previous chunks. This must be the last one');
        inputChunks.push(message);
        dispatchMessage(inputChunks.join(''),token.ENCODING);
        inputChunks = [];
    }
    else{
        logger.debug('handleMessage: Complete message. Dispatching');
        dispatchMessage(message,token.ENCODING); 
    }
}

function dispatchMessage(message){
    logger.info(message);
    db.logMessages(message, new Date());
    var records = codec.decodeMessage(message);
    app.processResultRecords(records);
}

function discard_input_buffers(){
    inputChunks = [];
}



////////////////// CLIENT MODE //////////////////////

var outputChunks = []; 
var retryCounter = 0;
var lastSendOk = false;
var lastSendData = "";
var timer;

function readDataAsClient(data){
    
    if (data === token.ENQ){
        if (lastSendData === token.ENQ){
            //TODO: Link Contention??
        }
        throw new Error('Client should not receive ENQ.'); // TODO Que hacer con el error
    }
    else if (data === token.ACK){
        logger.debug('ACK Response'); // TODO: Remove line
        lastSendOk = true;
        try{ 
            sendMessage();
        }
        catch(error){
            logger.debug(error);
            closeClientSession();
        }
        //handlePortWrite(message); //self.push(message)
        // TODO: Revisar la condicion de abajo
        // if (message === token.EOT){
            // self.openClientSession()
        // }
    }
    else if (data === token.NAK){
        // Handles NAK response from server.

        // The client tries to repeat last
        // send for allowed amount of attempts. 
        logger.debug('NAK Response'); // TODO: Remove line
        if (lastSendData === token.ENQ){
            openClientSession();
        }
        else{
            try{
                lastSendOk = false;
                sendMessage();
            }
            catch(error){
                closeClientSession();
            }
        }
        
        // TODO: Revisar la condicion de abajo
        // if message == EOT:
            // self.openClientSession()
    }
    else if (data === token.EOT){
        isTransferState = false; // TODO: Validar que ante un EOT se tengan que realizar estos pasos
        throw new Error('Client should not receive EOT.');
    }
    else if (data.startsWith(token.STX)){
        isTransferState = false; // TODO: Validar que ante un message se tengan que realizar estos pasos
        throw new Error('Client should not receive ASTM message.');
    }
    else {
        throw new Error('Invalid data.');
    }
}

function prepareMessage(){
    logger.debug('Prepare Message');
    var message = app.composeOrderMessage();
    // logger.info(message);
    var messageChunks = codec.encode(message);
    // logger.debug(messageChunks);
    return messageChunks;
    
}

function sendMessage(){
    if (lastSendData === token.ENQ){
        outputChunks = prepareMessage();
        // logger.info("outputChunks");
        // logger.info(outputChunks);
    }
    
    if (!lastSendOk){
        if (retryCounter > 6){
            closeClientSession();
            return;
        }
        else{
            retryCounter = retryCounter + 1;
        }
    }
    else{
        retryCounter = 0;
        if (outputChunks.length > 0){
            lastSendData = outputChunks.shift();
        }
        else{
            closeClientSession();
            return;
        }
        logger.info("lastSendData");
        logger.info(lastSendData);
    }
    handlePortWrite(lastSendData);
}

function openClientSession(){
    logger.info('Open Client Session');
    retryCounter = retryCounter + 1;
    if (retryCounter > 6){
        logger.error('Exceed number of retries');
        closeClientSession();
    }
    else{
        handlePortWrite(token.ENQ);
        lastSendData = token.ENQ;
        isTransferState = true;
        isClientMode = true;
    }
}

function closeClientSession(){
    logger.debug('Close Client Session');
    handlePortWrite(token.EOT);
    isTransferState = false;
    isClientMode = false;
    retryCounter = 0;
}

function checkDataToSend(){
    dbLocal.hasProtocolsToSend(function(error, data){
        if (data.data_to_send === 'True'){
            logger.info("Exist data to send");
            if (!isClientMode){
                openClientSession();
            }
        }
        else{
            if (isClientMode){
            isClientMode = false;
            }
            else{
                logger.info('Waiting for data to send');
                return;
                
            }
        }
    });
}

function initTimer(){
    clearTimeout(timer);
    timer = setTimeout(timeoutCommunication,15000);
}

function timeoutCommunication(){
    if (isTransferState){
        throw new Error('Timeout Communication');
    }
}

function run() {
  setInterval(checkDataToSend, 3000);
};

run();


var recordDataToSend = [ [ 'H',
    [ [null], [null,'&'] ],
    null,
    null,
    [ 'H7600', '1' ],
    null,
    null,
    null,
    null,
    'host',
    [ 'RSUPL', 'BATCH' ],
    'P',
    '1' ],
  [ 'P', '1' ],
  [ 'O',
    '1',
    [ '0', '                   806', '1', null, '001' ],
    'R1',
    [ null, null, null, '458/' ],
    'R',
    null,
    null,
    null,
    null,
    null,
    'N',
    null,
    [ null, null, null ],
    null,
    'SC',
    null,
    null,
    '      ',
    [ '                              ',
      '                         ',
      '                    ',
      '               ',
      '          ' ],
    null,
    null,
    '20161111095305',
    null,
    null,
    'F' ],
  [ 'R',
    '1',
    [ null, null, null, '458/' ],
    '55',
    'mg/dl',
    null,
    'N',
    null,
    'F',
    null,
    null,
    null,
    null,
    'P1' ],
  [ 'C', '1', 'I', '0', 'I' ],
  [ 'L', '1', 'N' ] ];
  
  // 0231487C5C5E267C7C7C48373630305E317C7C7C7C7C686F73747C525355504C5E42415443487C507C310D507C310D4F7C317C305E202020202020202020202020202020202020203830365E315E5E3030317C52317C5E5E5E3435382F7C527C7C7C7C7C7C4E7C7C5E5E7C7C53437C7C7C2020202020207C2020202020202020202020202020202020202020202020202020202020205E202020202020202020202020202020202020202020202020205E20202020202020202020202020202020202020205E2020202020202020202020202020205E202020202020202020207C7C7C32303136313131313039353330357C7C7C460D527C317C5E5E5E3435382F7C35357C6D672F646C7C7C4E7C7C467C7C7C7C7C50310D437C317C497C307C490D4C7C317C4E0D0342460D0A
  
