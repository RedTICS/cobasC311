'use strict';


var ENCODING = 'ascii';
var STX = '\x02';// Message start token. // STX (Start of Text)	"Inicio del mensaje" Indica el comienzo de un mensaje de datos.
var ETX = '\x03';// Message end token. // ETX	"End of Text"	Final de un mensaje de datos. Indica que el mensaje está completo (cuando no está fragmentado).
var EOT = '\x04';// ASTM session termination token. // EOT	"End of Transmission"	Fin de toda la transmisión. Indica que ya no hay más datos por enviar.
var ENQ = '\x05';// ASTM session initialization token. // ENQ (Enquiry)	"¿Puedo enviar?"	Se usa para preguntar si el receptor está listo para recibir datos.



var ACK = '\x06'; // Command accepted token. // ACK (Acknowledgment) "Mensaje recibido" Respuesta del receptor indicando que el mensaje fue recibido correctamente.
var NAK = '\x15'; // Command rejected token. // NAK (Negative Acknowledgment). "Error, reenvía" Indica que hubo un error y el mensaje debe ser reenviado
var ETB = '\x17'; // Message chunk end token. // ETB	"End of Transmission Block"	Indica que el bloque de datos es parte de un mensaje fragmentado. Se usará otro bloque después.
var LF  = '\x0A'; //LF	"Line Feed"	Salto de línea. Se usa para separar líneas en un mensaje.
var CR  = '\x0D'; //CR	"Carriage Return"	Retorno de carro. Se usa para marcar el fin de una línea en un mensaje.

var CRLF = CR + LF;// CR + LF shortcut.


var RECORD_SEP    = '\x0D'; // \r //// Message records delimiter.
var FIELD_SEP     = '\x7C'; // |  //// Record fields delimiter.
var REPEAT_SEP    = '\x5C'; // \  //// Delimeter for repeated fields.
var COMPONENT_SEP = '\x5E'; // ^  //// Field components delimiter.
var ESCAPE_SEP    = '\x26'; // &  //// Date escape token.

module.exports = {
    ENCODING: ENCODING,
    STX : STX,
    ETX : ETX,
    EOT : EOT,
    ENQ : ENQ,
    ACK : ACK,
    NAK : NAK,
    ETB : ETB,
    LF  : LF,
    CR  : CR,
    CRLF :CRLF,
    RECORD_SEP    : RECORD_SEP,
    FIELD_SEP     : FIELD_SEP,
    REPEAT_SEP    : REPEAT_SEP,
    COMPONENT_SEP : COMPONENT_SEP,
    ESCAPE_SEP    : ESCAPE_SEP
};
