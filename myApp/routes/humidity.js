var express = require('express');
var router = express.Router();

// Funcion que resuelve la peticion de la pagina individual de la humedad
router.get('/', function(req, res, next) {
	// Se obtiene el manejador de la base de datos y se lanza una consulta para obtener los registros de los ultimos 7 dias
	var db = req.db;
	var humidityCollection = db.get('mgiotHumedad');
	humidityCollection.find( {"time": { $gte: (new Date((new Date()).getTime() - (7 * 24 * 60 * 60 * 							1000)))}}, {sort: {"time": 1} }, function(e, data){
		// Se cargan los datos en la pagina y se renderiza
		if(data != null) res.render('humidity', {"humidity": JSON.stringify(data)});
	});

});

module.exports = router;
