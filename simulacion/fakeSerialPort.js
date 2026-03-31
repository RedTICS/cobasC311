
const token = require('../constants');
const EventEmitter = require('events');
class FakeSerialPort extends EventEmitter{

    constructor(name) {
        super();
        this.name = name;
        this.peer = null;
        this.handlers = {};
          this.options = { baudRate : 9600, dataBits : 8, parity : 'none', stopBits : 1 };
        setTimeout(() => this.emit('open'), 100);
    }

    on(event, cb) {
        this.handlers[event] = cb;
    }
 connect(peer) {
        this.peer = peer;
    }
    emit(event, data) {
        if (this.handlers[event]) {
            this.handlers[event](data);
        }
    }

    write(data) {
        console.log("[APP] WRITE ->", JSON.stringify(data));

        // 👇 SIMULACIÓN DEL EQUIPO
        simulateAnalyzerResponse.call(this, data);
    }
}

function simulateAnalyzerResponse(data) {

    // ENQ recibido → responder ACK
    if (data === token.ENQ) {

        console.log("🧪 ANALYZER <- ENQ");
        console.log("🧪 ANALYZER -> ACK");

        setTimeout(() => {
            this.emit('data', token.ACK);
        }, 500);
    }

    // Mensaje ASTM recibido → ACK
    else if (data.startsWith(token.STX)) {

        console.log("🧪 ANALYZER <- ASTM MESSAGE");

        setTimeout(() => {
            this.emit('data', token.ACK);
        }, 500);
    }

    // Fin transmisión
    else if (data === token.EOT) {

        console.log("🧪 ANALYZER <- EOT");
    }
}


module.exports = FakeSerialPort;