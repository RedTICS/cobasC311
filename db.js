var config = require('./config');
var record = require("./record");

var logger = require('winston');
var sql = require("seriate");


// SQL Server config settings
var dbConfig = {
    "server": config.dbServer,
    "user": config.dbUser,
    "password": config.dbPassword,
    "database": config.dbDatabase
};

sql.setDefaultConfig(dbConfig);

function isString(value) { return typeof value === 'string'; }

function saveResult(result, order) {
    //var logTime = new Date();
    var tipoMuestra = "Suero/Plasma";
    switch (parseInt(order.biomaterial)) {
        case 1: tipoMuestra = "Suero/Plasma"; break; // TODO Colocar los Prefijos del tipo de muestra correctos
        case 2: tipoMuestra = "Orina"; break;
        case 3: tipoMuestra = "CSF"; break;
        case 4: tipoMuestra = "Suprnt"; break;
        case 5: tipoMuestra = "Otros"; break;
    }

    var sampleId = order.sampleId;    
    var sampleIdSinBlancos = (isString(sampleId)) ? sampleId.trim() : sampleId;
    var sampleProtocolo = '';
    var sampleSector = '';

    for (var i = 0; i < sampleIdSinBlancos.length; i++) {
        let elem = sampleIdSinBlancos.charAt(i);
        switch (elem) {
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                sampleProtocolo = sampleProtocolo + elem;
                break;

            default:
                sampleSector = sampleSector + elem;
        }
    }

    var queryModificada;
    //Fix para cuando tienen los protocolos divididos por sectores
    if (!isNaN(sampleSector)) {
        sampleId = parseInt(sampleIdSinBlancos);
        queryModificada = "SELECT TOP 1 idProtocolo FROM LAB_Protocolo WHERE numero = @_sampleId AND baja=0 AND estado<2";
    } else {
        sampleId = parseInt(sampleProtocolo);
        queryModificada = "SELECT TOP 1 idProtocolo FROM LAB_Protocolo WHERE numeroSector = @_sampleId AND prefijoSector = @_sampleSector AND baja=0 AND estado<2";
    }

    //console.log('Esta es la query:', queryModificada);
    sql.getPlainContext()
        .step("queryProtocoloById", {
            query: queryModificada,
            params: {
                _sampleId: { type: sql.INT, val: sampleId },
                _sampleSector: { type: sql.NVARCHAR, val: sampleSector }
            }
        })
        .step("queryCobasC311WithBiomaterial", function (execute, data) {
            execute({
                query: "SELECT TOP 1 * FROM LAB_CobasC311 WHERE idItemCobas = @_idItemCobas AND tipoMuestra = @_tipoMuestra",
                params: {
                    _idItemCobas: { type: sql.INT, val: result.test },
                    _tipoMuestra: { type: sql.NVARCHAR, val: tipoMuestra }
                }
            });

        })
        .step("queryCobasC311WithPrefijoTipoMuestra", function (execute, data) {
            execute({
                query: "SELECT TOP 1 * FROM LAB_CobasC311 WHERE idItemCobas = @_idItemCobas AND prefijo = @_prefijo AND tipoMuestra = @_tipoMuestra",
                params: {
                    _idItemCobas: { type: sql.INT, val: result.test },
                    _prefijo: { type: sql.NVARCHAR, val: order.prefijoTipoMuestra },
                    _tipoMuestra: { type: sql.NVARCHAR, val: tipoMuestra }
                }
            });
        })
        .end(function (sets) {
            if (!sets.queryProtocoloById[0]) {
                errMessage = 'No se encontro el protocolo especificado con id:' + order.sampleId;
                logger.error(errMessage);
                logMessages(errMessage);
                throw new Error(errMessage);
            }

            var idProtocolo = sets.queryProtocoloById[0].idProtocolo;
            var idItem = "";

            if (sets.queryCobasC311WithPrefijoTipoMuestra[0]) {
                idItem = sets.queryCobasC311WithPrefijoTipoMuestra[0].idItemSil;

            }
            else {
                if (sets.queryCobasC311WithBiomaterial[0]) {
                    idItem = sets.queryCobasC311WithBiomaterial[0].idItemSil;
                }
                else {
                    errMessage = 'No se encontro el subItem especificado con idItemCobas:' + result.test + ' y tipoMuestra:' + tipoMuestra;
                    logger.error(errMessage);
                    logMessages(errMessage);
                }
            }

            if (idItem !== "") {
                sql.execute({
                    query: "UPDATE LAB_DetalleProtocolo set resultadoNum = @_resultadoNum, unidadMedida = @_unidadMedida, conResultado=1, enviado=2, fechaResultado= @_fechaResultado" +
                    " WHERE idProtocolo= @_idProtocolo AND idSubItem= @_idSubItem AND idUsuarioValida=0",
                    params: {
                        _resultadoNum: { type: sql.REAL, val: result.value },
                        _fechaResultado: { type: sql.DATETIME, val: order.dateTimeReported },
                        _unidadMedida: { type: sql.NVARCHAR, val: result.units },
                        _idProtocolo: { type: sql.INT, val: idProtocolo },
                        _idSubItem: { type: sql.INT, val: idItem }
                    }
                });
                logger.info(result.value)
                logger.info('LAB_DetalleProtocolo actualizado para subItem:', idItem);
            }

        })
        .error(function (err) {
            logger.error(err);
            logMessages(errMessage);
        });
}

function hasProtocolsToSend() {
    return sql.execute({
        query: "SELECT count(*) as total FROM LAB_TempProtocoloEnvio WHERE equipo = @equipo AND idEfector = @idEfector",
        params: {
            equipo: { type: sql.NVARCHAR, val: config.analyzer, },
            idEfector: { type : sql.INT , val: config.idEfector }
        }
    })

}

function getNextProtocolToSend() {
    return sql.execute({
        query: "SELECT TOP 1 * FROM LAB_TempProtocoloEnvio WHERE equipo = @equipo AND idEfector = @idEfector",
        params: {
            equipo: {
                type: sql.NVARCHAR,
                val: config.analyzer,
            },
            idEfector: { type : sql.INT , val: config.idEfector }
        }
    })
}

function removeLastProtocolSent() {
    getNextProtocolToSend().then(function (results) {
        for (var i = 0; i < results.length; i++) { // Always only 1 iteration
            var protocol = results[i];
            removeProtocol(protocol.idTempProtocoloEnvio);
        }
    }, function (err) {
        logger.error("Something bad happened:", err);
    });
}

function removeProtocol(idTempProtocolo) {
    return sql.execute({
        query: "DELETE FROM LAB_TempProtocoloEnvio WHERE idTempProtocoloEnvio = @_id",
        params: {
            _id: {
                type: sql.INT,
                val: idTempProtocolo,
            }
        }
    })
}


function logMessages(logMessage) {
   // var logTime = new Date();
    sql.execute({
        query: "INSERT INTO Temp_Mensaje(mensaje,fechaRegistro, idEfector) VALUES (@_mensaje,DATEADD(hh,-3,GETUTCDATE()), @idEfector)",
        params: {
            _mensaje: { type: sql.NVARCHAR, val: logMessage },
            //_fechaRegistro : {type : sql.DATETIME, val : logTime },
            idEfector: { type : sql.INT , val: config.idEfector }
        }
    }).then(function (results) {
        logger.info(results);
    }, function (err) {
        logger.error("Something bad happened:", err);
    });
   
}


module.exports = {
    saveResult: saveResult,
    hasProtocolsToSend: hasProtocolsToSend,
    getNextProtocolToSend: getNextProtocolToSend,
    removeProtocol: removeProtocol,
    removeLastProtocolSent: removeLastProtocolSent,
    logMessages : logMessages
};