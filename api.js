var config = require('./config');
var fetch = require ('node-fetch');
var URL = config.apiUrl;

const requestOptions = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${config.tokenAPI}`,
  }
};

function enviarResultado(result, order){
    var s_Equipo = config.analyzer;  //equipo autonalizador
    var s_idEfector = config.idEfector; //id de efector-laboratorio que envia
    var s_NumeroProtocolo = order.sampleId;  //numero de protocolo
    var s_Prueba = result.test; //codigo de determinacion del equipo
    var s_Resultado = result.value; //valor informado
    URL = config.apiUrl; //La URL de la api de produccion
    URL = URL + config.funcionApi; //El nombre de la funcion que ejecuta el Store Procedure; executeSP?nombre=LAB_PostDatosEquipo&parametros=
    URL = URL + s_Equipo + "|" + s_idEfector + "|" + s_NumeroProtocolo + "|" + s_Prueba + "|" + s_Resultado;  
    enviar(URL);
}

/*function enviar(URL ){
    fetch(URL, requestOptions)
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.dir(data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}*/


function enviar(URL ){
    fetch(URL, requestOptions)
    .then(response => response.json()) // Convierte la respuesta a JSON
    .then(data => {
        console.log("Respuesta completa:", data);
        console.log("Datos de los resultados:", data[0].Data); // Accede al array "Data" que tiene el resultado del SP
    })
    .catch(error =>console.error('Error en la petición:', error)); //Si da error el Store Procedure lo guarda en la tabla 'Temp_Mensaje'
}

module.exports = {
  enviarResultado : enviarResultado
};
