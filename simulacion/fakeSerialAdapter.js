const createVirtualSerialPair = require('./virtualLink');

const pair = createVirtualSerialPair();

class SerialPortWrapper {

    constructor() {
        return pair.portA; // protocol.js usa este
    }
}

// exportamos también el otro extremo
module.exports = SerialPortWrapper;
module.exports.simulatorPort = pair.portB;