
var logger = require('winston');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('cobas.sqlite3');

STATUS = {};

STATUS.hasProtocolsToSend = function(callback)
{
    stmt = db.prepare("SELECT * FROM status");
    stmt.get(function(error, row)
    {
        if(error) 
        {
            throw err;
        } 
        else 
        {
            //retornamos la fila con los datos del usuario
            if(row) 
            {
                callback("", row);
            }
            else
            {
                console.log("El usuario no existe");
            }
        }
    });
}

STATUS.logTransferResultsFromCobas = function(callback)
{
    stmt = db.prepare("SELECT * FROM status");
    stmt.get(function(error, row)
    {
        if(error) 
        {
            throw err;
        } 
        else 
        {
            //retornamos la fila con los datos del usuario
            if(row) 
            {
                callback("", row);
            }
            else
            {
                console.log("El usuario no existe");
            }
        }
    });
}

// STATUS.hasProtocolsToSend = function(){
    // this.queryStatus(function(error, data){
        // logger.info(data.data_to_send);
        // if (data.data_to_send === 'True'){
            // return true;
        // }
        // else{
            // return false;
        // }
    // });
// };

//exportamos el modelo para poder utilizarlo con require
module.exports = STATUS;
