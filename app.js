var config = require('./config');
var logger = require('winston');


var db = require('./db');
var record = require('./record')

function processResultRecords(records){
    var record = [];

    for (var i = 0; i < records.length; i++) {
        record = records[i];
        switch (record[0]){
            case "H": handleHeader(record); break;
            case "Q": handleInquiry(record); break;
            case "C": handleComment(record);  break;
            case "O": orderRecord = record; break;
            case "R": handleResult(record, orderRecord); break;
            case "L": handleTerminator(record); break;
        }
        
    }
}

function handleHeader(record){}

function handleInquiry(record){}

function handleComment(record){}

function handleOrder(order){}

function handleTerminator(record){}

function handleResult(resultRecord, orderRecord){
    var order = new record.OrderRecord();
    order.build(orderRecord);
    var result = new record.ResultRecord(resultRecord); 
	db.saveResult(result,order);
}


function composeOrderMessages(protocol){
    var header = new record.HeaderRecord();
    // Patient Information
    var patient = new record.PatientRecord();
    patient.name = protocol.paciente;
    patient.birthdate = protocol.anioNacimiento;
    patient.sex = protocol.sexo;
    // Order Information
    var order = new record.OrderRecord();
    // Nro de Protocolo
    order.sampleId = protocol.numeroProtocolo.trim();
    // Items/Analisis del protocolo
    var tipoMuestraNombre = 'Suero/Plasma';
    var tests = [];
    var testComponents = protocol.iditem.split(';');
    for (var i = 0; i < testComponents.length; i++) {
        // Cada item tiene la forma IdItem|TipoMuestra
        var testSplit = testComponents[i].split('|');
        var idTest = testSplit[0];
        tipoMuestraNombre = testSplit[1];
        var test = new record.TestComponent(idTest);
        tests.push(test);
    }
    order.tests = tests;
    // Tipo de muestra
    var tipoMuestra = 1;
    switch (tipoMuestraNombre){
            case "Suero/Plasma": tipoMuestra=1;break;
            case "Orina": tipoMuestra=2;break;
            case "CSF": tipoMuestra=3;break;
            case "Suprnt": tipoMuestra=4;break;
            case "Otros": tipoMuestra=5;break;
        }
    order.biomaterial = tipoMuestra;
    order.sampleType = 'S' + tipoMuestra;
    // Prioridad
    if (protocol.urgente === 'Y'){
        order.priority = 'S';
    }
    else{
        order.priority = 'R';
    }
    var comment = new record.CommentRecord();
    var termination = new record.TerminationRecord();
    
    // console.log(patient.toASTM());
    // console.log(order.toASTM());
    return [[header.toASTM(),patient.toASTM(),order.toASTM(),comment.toASTM(),termination.toASTM()]];
    
}

function newOrder(){
    
    return;
}

module.exports = {
    processResultRecords : processResultRecords,
    composeOrderMessages: composeOrderMessages
};

