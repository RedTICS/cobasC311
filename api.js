var config = require('./config');
var fetch = require ('node-fetch');
//const fs = require("fs");
var URL = config.apiUrl;

/*// Cargar el certificado intermedio
const caCert = fs.readFileSync("./localhost.pem");
*/

const requestOptions = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${config.tokenAPI}`,
  },
  //ca: caCert
};

var s_Equipo = config.analyzer;  //equipo autonalizador
var s_idEfector = config.idEfector; //id de efector-laboratorio que envia


/** Pruebas*/
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// hasProtocolsToSend();
//traerAnalisis();
//var URL = "https:/localhost:7118/executeSP?nombre=LAB_GetTempProtocoloEnvio&parametros=CobasC311|55|0"; /*
//URL = "https://www.saludnqn.gob.ar:7118/executeSP?nombre=LAB_PostDatosEquipo&parametros=CobasC311|1|999|871|23.756"; 
// console.log("aca estamos?");
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// enviar(URL).
// then(resultado => {
//   console.log(resultado); 
//   return resultado;
//  }) ;
//var jsonString= "[{ \"SP\": \"LAB_PostDatosEquipo\", \"ParametrosEntrada\": { \"@Equipo\": \"CobasC311\", \"@idEfector\": \"1\", \"@numero\": \"999\", \"@Prueba\": \"871\", \"@valor\": \"23.756\" }, \"ParametrosSalida\": { \"Sin parámetros de salida\": \"Fin\" }, \"Data\": [{ \"Resultado\": \"No OK 2\" }] }]";
//console.log(isValidJSON(jsonString));
//enviar("http://localhost:5118/executeSP?nombre=LAB_PostDatosEquipo&parametros=CobasC311|1|999|871|23.756");*//*
/*fetch("https://incomplete-chain.badssl.com ", requestOptions).
then(repuesta => console.log(repuesta)).catch(error => console.log("Error de catch del fetch ",error));*/
//traerAnalisis();
//ActualizarTempProtocolo(27704);
//ActualizarTempProtocolo(1);


function isValidJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (e) {
      return false;
    }
  }
  /**
   * Funcion que envia el resultado del Cobas al SIL
   * @param {Resultado del analisis de la muestra} result 
   * @param {Orden de analisis que tiene el numero de protocolo} order 
   */
function enviarResultado(result, order){
    var s_NumeroProtocolo = order.sampleId;  //numero de protocolo
    var s_Prueba = result.test; //codigo de determinacion del equipo
    var s_Resultado = result.value; //valor informado
    URL = config.apiUrl; //La URL de la api de produccion
    URL = URL + config.funcionApiPostResultados; //El nombre de la funcion que ejecuta el Store Procedure; executeSP?nombre=LAB_PostDatosEquipo&parametros=
    URL = URL + s_Equipo + "|" + s_idEfector + "|" + s_NumeroProtocolo + "|" + s_Prueba + "|" + s_Resultado;  
   // process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    enviar(URL);
}
/**
 * Funcion que trae los analisis del SIL Multi-efector para procesar y enviar a COBAS
 * @param {Parametro opcional} numeroProtocolo 
 */
function traerAnalisis(numeroProtocolo=0){
    URL = config.apiUrl; //La URL de la api de produccion
    URL = URL + config.funcionApiGetAnalisis; //El nombre de la funcion que ejecuta el Store que trae los analisis 
    URL = URL + s_Equipo + "|" + s_idEfector + "|" + numeroProtocolo;  
    //console.log(URL);
    return enviar(URL).then(resultado => {
      if (resultado && resultado[0]) {
       //  console.log(resultado[0].Data); // Accede al array "Data" que tiene el resultado del SP
        return resultado[0].Data;
      } else {
        throw new Error("[" + new Date().toLocaleString() + "]: La respuesta no contiene datos válidos.");
      }
     }) .catch(msg => console.error("[" + new Date().toLocaleString() + "]: Error en hasProtocolsToSend:",msg)) ;
}

/**
 * Funcion que trae la cantidad de protocolos pendientes para analizar 
 */
function hasProtocolsToSend(){
  URL = config.apiUrl; //La URL de la api de produccion
  URL = URL + config.funcionApiGetCantidadAnalisis; // API que ejecuta el GET de Consultas
  URL = URL + "equipo:"+s_Equipo + "|" + "idEfector:"+s_idEfector ;  //para el GET de Consultas se debe poner el nombre del parametro y el valor separado por ':'
    //console.log(URL);
    return enviar(URL).then(resultado => {
      if (resultado && resultado[0]) {
        return resultado; // Devuelve el resultado completo
      } else {
          throw new Error("[" + new Date().toLocaleString() + "]: La respuesta no contiene datos válidos.");
      }
      }).catch(msg => console.error("[" + new Date().toLocaleString() + "]: Error en hasProtocolsToSend:",msg)) ;
}
/**
 * Funcion generica que realiza el Fetch con una URL y unas opciones enviadas
 * @param {*} URL 
 */
function enviar(URL){
  return  fetch(URL, requestOptions)
    .then(response => {
        if (!response.ok) {
        throw new Error( "[" + new Date().toLocaleString() + "]: Network response was not ok | status: ${response.status} ${response.statusText}");
        }
        
        return response.json(); // Convierte la respuesta a JSON
    })
    .then(data => {
        console.log("[" + new Date().toLocaleString() + "]: API utilizada:", URL);
        console.dir(data);
      //  console.dir(data[0].Data); // Accede al array "Data" que tiene el resultado del SP
       //return data[0].Data;
       return data;
    })
    .catch(error => {
        console.error("[" + new Date().toLocaleString() + "]: Error al usar la API. URL", URL);
        console.error("[" + new Date().toLocaleString() + "]: El error resultante:", error);
    });
}

module.exports = {
  enviarResultado : enviarResultado,
  traerAnalisis : traerAnalisis,
  hasProtocolsToSend : hasProtocolsToSend
};
