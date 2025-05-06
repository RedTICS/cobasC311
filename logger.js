const winston = require('winston');
const path = require('path');
const fs = require('fs');

const baseDir = process.cwd(); // process.cwd() apunta al directorio donde se ejecuta el comando node

// Ruta del directorio de logs
const logDir = path.join(baseDir, 'log');

// Verifica si el directorio existe, si no, lo crea
if (!fs.existsSync(logDir)) {
    console.log("[" + new Date().toLocaleString() +"]: Directorio para log no existe, creando:", logDir);
    fs.mkdirSync(logDir);
} else {
    console.log("[" + new Date().toLocaleString() +"]: Directorio para log ya existe:", logDir);
}

try {
    const logger = new (winston.Logger)({
        level: 'info', // Nivel de log predeterminado
        transports: [
            // Transporte para imprimir en la consola
            new (winston.transports.Console)({
                timestamp: () => new Date().toLocaleString(), // Agrega timestamp
                formatter: (options) => {
                    return `[${options.timestamp()}]: ${options.message || ''}`;
                }
            }),

            // Transporte para guardar logs generales en un archivo
            new (winston.transports.File)({
                name: 'general-file', // Nombre único para este transporte
                filename: path.join(logDir, 'salida.log'), // Ruta del archivo de log
                level: 'info', // Nivel de log para el archivo
                maxsize: 5 * 1024 * 1024, // Tamaño máximo del archivo (5 MB)
                maxFiles: 5, // Número máximo de archivos rotativos
                tailable: true, // Mantiene los archivos rotativos en orden
                json: false, // Deshabilita el formato JSON
                timestamp: () => new Date().toLocaleString(), // Agrega timestamp
                formatter: (options) => {
                    return `[${options.timestamp()}]: ${options.message || ''}`;
                }
            }),

            // Transporte para guardar solo errores en un archivo separado
            new (winston.transports.File)({
                name: 'error-file', // Nombre único para este transporte
                filename: path.join(logDir, 'error.log'), // Archivo específico para errores
                level: 'error', // Solo registra mensajes de nivel error
                maxsize: 5 * 1024 * 1024, // Tamaño máximo del archivo (5 MB)
                maxFiles: 5, // Número máximo de archivos rotativos
                tailable: true, // Mantiene los archivos rotativos en orden
                json: false, // Deshabilita el formato JSON
                timestamp: () => new Date().toLocaleString(), // Agrega timestamp
                formatter: (options) => {
                    // Personaliza el formato para que solo incluya el timestamp y el mensaje
                    return `[${options.timestamp()}]: ${options.message || ''}`;
                }
            })
        ]
    });

    module.exports = logger;
} catch (error) {
    console.error("[" + new Date().toLocaleString() +"]: Error al configurar el logger:", error);
}