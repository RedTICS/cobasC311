const SerialAdapter = require('./fakeSerialAdapter');
const port = SerialAdapter.simulatorPort;

const token = {
    ENQ: String.fromCharCode(5),
    ACK: String.fromCharCode(6),
    EOT: String.fromCharCode(4),
    STX: String.fromCharCode(2)
};

port.on('open', () => {
    console.log("SIMULADOR CONECTADO");
});

port.on('data', buffer => {

    const data = buffer.toString('ascii');

    console.log("HOST → EQUIPO:", JSON.stringify(data));

    //-----------------------------------
    // RESPUESTAS ASTM DEL EQUIPO
    //-----------------------------------

    // 1️⃣ Host quiere iniciar sesión
    if (data === token.ENQ) {
        console.log("EQUIPO → ACK");

        setTimeout(() => {
            port.write(token.ACK);
        }, 200); // pequeño delay realista
        return;
    }

    // 2️⃣ Host envía mensaje ASTM
    if (data.startsWith(token.STX)) {
        console.log("EQUIPO → ACK (mensaje recibido)");

        setTimeout(() => {
            port.write(token.ACK);
        }, 150);
        return;
    }

    // 3️⃣ Fin transmisión
    if (data === token.EOT) {
        console.log("EQUIPO → sesión finalizada");
        return;
    }
});