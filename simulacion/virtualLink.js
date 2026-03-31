const FakeSerialPort = require('./fakeSerialPort');

function createVirtualSerialPair() {

    const portA = new FakeSerialPort("APP");
    const portB = new FakeSerialPort("SIMULATOR");

    portA.connect(portB);
    portB.connect(portA);

    return { portA, portB };
}

module.exports = createVirtualSerialPair;