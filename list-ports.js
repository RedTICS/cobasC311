var SerialPort = require('serialport');
SerialPort.list(function (err, ports) {
      ports.forEach(function(port) {
      try{
      console.log("Datos de puerto",port.comName);
      //console.log("port.comName ",port.comName);
      //console.log("port.pnpId",port.pnpId);
      //console.log("port.manufacturer", port.manufacturer);
      console.dir(port);

      var portNumber = port.comName;
      puerto = new SerialPort(portNumber);
      console.log('Port open. Data rate: ' + puerto.options.baudRate);
      console.log('Data Bits.: ' + puerto.options.dataBits);
      console.log('Parity.: ' + puerto.options.parity);
      console.log('Stop bit.: ' + puerto.options.stopBits);
      console.log("---------------");
      puerto.on('error', function (err) {
        throw new Error('Port Error: ' + err.message);
    })
      }catch(error){
        console.error(error);
    }
  });
});