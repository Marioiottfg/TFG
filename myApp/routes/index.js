var express = require('express');
var router = express.Router();

// Funcion que recupera los nombres de las colecciones en las que se almacenan los datos de los nodos
function findNodes(req, res, next) {
	var db = req.db;
	var nodeCollection = db.get('nodeCollection');
	nodeCollection.find({}, {}, function(e, nodes) {
		if(e) console.error(e);
		req.nodes = nodes;
		return next();
	});

}

// Funcion que recupera los datos de las colecciones de los nodos
function findData(req, res, next) {
	var db = req.db;
	var nodes = req.nodes;
	var nodeData = [];

	// Itera sobre cada una de las colecciones almacenadas enviando una consulta para obtener los registros de los ultimos 7 dias
	nodes.forEach(function(node, index, arr) {
		var collection = db.get(node.nodeName);
		collection.find( {"time": { $gte: (new Date((new Date()).getTime() - (7 * 24 * 60 * 60 * 1000)))}}, {sort: {"time": 1} }, function(e, data){
			var collection = {
				"name": node.nodeName,
				"values": data
			};
			// Los datos se almacenan en el array y cuando se ha iterado por todas las colecciones se invoca a la ultima funcion
			nodeData.push(collection);
			if(index === arr.length -1){
				req.nodeData = nodeData;
				next();
			}
		});
	});
}

// Tras recuperar los datos de los nodos, se cargan en la pagina y se renderiza
function renderGeneralPage(req, res){
	var array = req.nodeData;
	if(array != null) res.render('index', { "collections": JSON.stringify(array) });
}



router.get('/', findNodes, findData, renderGeneralPage);


module.exports = router;
