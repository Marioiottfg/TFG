// Definicion de variables globales e inclusion de librerias
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// DB variables
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/myapp');
// Obtenemos la coleccion de pruebas
var nodeCollection = db.get('nodeCollection');


var index = require('./routes/index');
var temperature = require('./routes/temperature');
var humidity = require('./routes/humidity');
var phone = require('./routes/phone');

var app = express();

var server = require('http').Server(app);
var io = require('socket.io')(server);

// Retraso aplicado despues de la conexion al wifi local
var delay = 2;

// Variables para el manejo del WiFi
var ip = require('ip');
var WiFiControl = require('wifi-control');
WiFiControl.init({ debug : false });
// Parametros del wifi local de casa
var ssid_homeWifi = "MOVISTAR_C84B";
var pass_homeWifi = "Lzz6aqBQM3LU2CnVZnLC";
// Prefijo de los nodos
var ssid_name = "mgiot";
var ssid_array = [];

// Registro de los ultimos valores
var lastTemp = 0;
var lastHum = 0;

var dgram = require('dgram');

// Variables para lanzar peticiones http. Url generica para todas las arduino
var http_req = require('http');
var _url = {
	host: '192.168.4.1',
	path: '/getData'
};



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


// Funcion para redirigir las peticiones web y los manejadores de socket.io y mongodb
app.use(function(req, res, next){
	req.db = db;
	res.io = io;
	next();
});

// Funcion que se activa cada vez que se abra una nueva pestaña
io.on('connection', function(socket){

	socket.on("temperature", function(msg){
		socket.emit("new-temp", lastTemp);	
	});

	socket.on("humidity", function(msg){
		socket.emit("new-hum", lastHum);	
	});

});



// Funcion recursiva para conectarse a las redes almacenadas
var getDataArduino = function (ssid_array){
	if(ssid_array != null && Array.isArray(ssid_array) ){
		if(ssid_array.length>=1 ){
			// Se hace un shift del array para obtener el nuevo ssid al que conectarse y eliminarlo del array
			var value = ssid_array.shift();
			console.log('Red detectada: '+ value);
			
			// Se almacena la información de la red en una variable local
			var ap = {
			  ssid: value
			};
			if(value.indexOf(ssid_homeWifi) !== -1) ap['password'] = pass_homeWifi;

			// Conexion a la red
			WiFiControl.connectToAP( ap, function(error, response) {
				// Error en la conexion
				if (error) {
					console.log(error);
					getDataArduino(ssid_array);
				}
				// Exito en la conexion
				else {
					console.log(response);
					// Conexion a la red wifi local
					if(response.success && ap['ssid'].indexOf(ssid_homeWifi) !== -1){
						// Se crea un datagrama UDP que se envia por la direccion broadcast y puerto 11111 de la red					
						var client = dgram.createSocket('udp4');
					
						client.on('listening', function(){
							client.setBroadcast(true);
						});
						client.bind(11111);	
						var aux1 = new Buffer('No estas solo');
						client.send(aux1, 0, aux1.length, 11111, ip.or(ip.address(), '0.0.0.255'), function(err, bytes){
									client.close();
										// Despues del envio se aplica un retraso para recibir las peticiones de los dispositivos Android
										var start = process.hrtime();
										while(true){
											var end = process.hrtime();
											if(end[0] - start[0] > delay){
												break;		
											}
										}
										getDataArduino(ssid_array);

								});

						
					}
					// Conexion a un nodo del sistema
					else if(response.success && ap['ssid'].indexOf(ssid_name) !== -1){
						
						// Se prepara una peticion http para pedir el ultimo valor leido por el nodo
						http_req.request(_url, function(response, value){
							var str = '';

							response.on('data', function(chunk){
								str += chunk;
							});

							response.on('end', function(){
								// En la recepcion del valor se almacena en la base de datos y en la variable global
								console.log(str);
								var fecha = new Date();
								var table = db.collection(ap['ssid']);
								table.insert({"value": str, "time": fecha});
								if(ap['ssid'].includes("Temp")){
									lastTemp = str;
								}else{
									lastHum = str;								
								}
								getDataArduino(ssid_array);
							});
						}).end();
					}
					// Fallo en la conexion
					else{
						getDataArduino(ssid_array);
					}
				}
			});
		}
		else {
			console.log("The array is empty. It has finished its work.")
		}
	}else {
		console.error("The array is null or is not an Array!");
	}
};

// Funcion en intervalos para escanear las redes presentes en el entorno
var interval = setInterval(() => {
	// Se resetea el array que contiene las ssid y se almacena la red wifi local
	ssid_array = [];
	var networks;
	// Escaneo de redes WIFI que tengan el prefijo especificado como palabra clave
	WiFiControl.scanForWiFi(function(err, response) {
		if(err) console.log(err);
		networks = response['networks'];
		// Se almacenan en el array todas las redes que contengan en su nombre "ssid_name" y se registran en la base de datos si no estuvieran aun registradas
		networks.forEach(function(value){
			if(value['ssid'].indexOf(ssid_name) !== -1) { 
				ssid_array.push(value['ssid']);
				nodeCollection.findOne({"nodeName": value['ssid']}).then((doc) => {
					if(doc == null){
						nodeCollection.insert({"nodeName": value['ssid']});
					}
				});
			}
		});
	});
	ssid_array.push(ssid_homeWifi);
	console.log("Numero de redes detectadas: "+ ssid_array.length);

	// Se activa la funcion recursiva que itera por todas las redes almacenadas
	getDataArduino(ssid_array);


}, 10000);


app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Enrutamiento de funciones
app.use('/', index);
app.use('/Temperatura', temperature);
app.use('/Humedad', humidity);
app.use('/phone', phone);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = {app: app, server: server};


