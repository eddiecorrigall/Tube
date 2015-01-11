var fs = require("fs");
var url = require("url");
var http = require("http");
var path = require("path");

// Additional plugins
var shortId = require("shortid");
var express = require("express");
var mime = require("mime");

var www = path.join(__dirname, "/www");

var root = path.join(www, "/videos"); // Must be accessable via http, ie. a child of www
var root_id = null;

var path_id_table = {}; // path id => path string
var path_string_table = {}; // path string => path id

var generatePathId = function(path_string) { // Return a unique path id given a path string

	var path_id = getPathId(path_string);

	if (path_id == null) {
		// Create path entry
		path_id = shortId.generate();
		path_id_table[path_id] = path_string;
		path_string_table[path_string] = path_id;
	}

	return path_id;
};

var getPathId = function(path_string) { // Return path id on success otherwise false

	if (path_string in path_string_table) {
		return path_string_table[path_string];
	}

	return null;
};

var getPath = function(path_id) { // Return path string on success otherwise false
	
	if (path_id in path_id_table) {
		return path_id_table[path_id];
	}

	return null; // No such path id
};

var jsonDirectory = function(parent_path, directory_path) { // Return jstree format

	var parent_id = getPathId(parent_path);

	if (parent_id == null) {
		return null;
	}

	var jstree = {
		"parent": parent_id,
		"id": generatePathId(directory_path),
		"children": true,
		"icon": "jstree-folder",
		"state": "closed",
		"text": path.basename(directory_path)
	};

	if (jstree.parent == root_id) {
		jstree.parent = '#';
		jstree.icon = "/tree.png";
	}

	return jstree;
};

var jsonFile = function(parent_path, file_path) { // Return jstree format
	
	var parent_id = getPathId(parent_path);

	if (parent_id == null) {
		return null;
	}

	var jstree = {
		"parent": parent_id,
		"id": generatePathId(file_path),
		"children": false,
		"icon": "jstree-file",
		"state": "disabled",
		"text": path.basename(file_path),
		// Custom
		"mime": mime.lookup(file_path),
		"file": file_path.substr(www.length) // TODO: this could be done better
	};

	if (jstree.parent == root_id) {
		jstree.parent = '#';
	}

	return jstree;
};

root_id = generatePathId(root);

// ##### ##### ##### ##### ##### //

var listCallback = function(request, response) {

	var query = url.parse(request.url, true).query;

	var list = [];

	if ("id" in query) {

		var parent_id = (query.id == "root") ? root_id : query.id;
		var parent_path = getPath(parent_id);

		if (parent_path) {
			
			console.log("parent id: " + parent_id);
			console.log("parent path: " + parent_path);

			try {

				var entries = fs.readdirSync(parent_path);

				entries.forEach(function(entry) {

					var absolute_path = path.resolve(parent_path, entry);

					if (absolute_path.indexOf(root) == 0) { // Prevent escape from root

						var stats = fs.statSync(absolute_path);
						var json = null;

						if (stats.isDirectory()) {
							json = jsonDirectory(parent_path, absolute_path);
						}
						else {
							json = jsonFile(parent_path, absolute_path);
						}

						if (json != null) {
							list.push(json);
						}
					}
				});
			}
			catch (exception) {
				console.log(exception)
			}
		}
	}

	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(JSON.stringify(list));
};

// ##### ##### ##### ##### ##### //
// ##### RUN PROGRAM
// ##### ##### ##### ##### ##### //

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log("Invalid port!");
	process.exit();
}

var app = express();
var httpServer = http.createServer(app);

app.get("/list", listCallback);
app.use(express.static(www));

httpServer.listen(port, function () {
	console.log("Tube server running at http://localhost:%s/", port);
});
