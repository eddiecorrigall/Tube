var fs = require("fs");
var url = require("url");
var http = require("http");
var path = require("path");

// Additional plugins
var express = require("express");
var mime = require("mime");
var dblite = require("dblite");

var www = path.join(__dirname, "/www");

var root_id = 1; // Assumption
var root_path = path.join(www, "/videos"); // Must be accessable via http, ie. a child of www

// ##### ##### ##### ##### ##### 
// ##### DATABASE
// ##### ##### ##### ##### ##### 

var db = dblite(":memory:"); // In-memory database

db.on("info", function (data) { console.log(data); });
db.on('error', function (error) { console.error(error.toString()); });

db.query("BEGIN TRANSACTION");
db.query(
	"CREATE TABLE IF NOT EXISTS files ("	+
		"file_path	TEXT NOT NULL,"			+
		"UNIQUE(file_path)"					+
	")"
);
db.query("COMMIT");

// ##### DATABASE FUNCTIONS

var getFileId = function(file_path, callback) {

	console.log("getFileId - file_path - %s", file_path);

	db.query(
		"SELECT ROWID FROM files WHERE file_path = ?",
		[ file_path ],
		{
			ROWID: Number
		},
		function(error, rows) {

			console.log("getFileId - rows - %s", JSON.stringify(rows));

			if (error) return;

			switch (rows.length) {
				case 0: return;
				case 1: callback(rows[0].ROWID); return;
			}

			throw new Error("Database duplicates - %s", JSON.stringify(rows));
		}
	);
};

var getFilePath = function(file_id, callback) {

	console.log("getFilePath - file_id - %d", file_id);

	db.query(
		"SELECT file_path FROM files WHERE ROWID = ?",
		[ file_id ],
		{
			file_path: String
		},
		function(error, rows) {

			console.log("getFilePath - rows - %s", JSON.stringify(rows));

			if (error) return;

			switch (rows.length) {
				case 0: return;
				case 1: callback(rows[0].file_path); return;
			}

			throw new Error("Database duplicates - %s", JSON.stringify(rows));
		}
	);
};

var acquireFile = function(file_path, callback) {

	console.log("acquireFile - file_path - %s", file_path);

	db.query(
		"INSERT OR IGNORE INTO files (file_path) VALUES (?)",
		[ file_path ],
		function(error) {
			if (error) return;
			getFileId(file_path, callback);
		}
	);
};

// #####

acquireFile(root_path, function(file_id) {
	console.log("Root Id - " + file_id);
	if (root_id != file_id) {
		throw new Error("Database is not empty!");
	}
});

// ##### ##### ##### ##### ##### 
// ##### JSON API
// ##### ##### ##### ##### ##### 

var jsonDirectory = function(parent_path, child_path, callback) { // Return jstree format

	console.log("jsonDirectory - parent_path - %s", parent_path);
	console.log("jsonDirectory - child_path - %s", child_path);

	getFileId(parent_path, function(parent_id) {

		console.log("jsonDirectory - parent_id - %s", parent_id);

		acquireFile(child_path, function(child_id) {

			console.log("jsonDirectory - child_id - %d", child_id);
			
			var jstree = {
				"parent": parent_id,
				"id": child_id,
				"children": true,
				"icon": "jstree-folder",
				"state": "closed",
				"text": path.basename(child_path)
			};

			if (parent_id == root_id) {
				jstree.parent = '#';
				jstree.icon = "/tree.png";
			}

			callback(jstree);
		});
	});
};

var jsonFile = function(parent_path, child_path, callback) { // Return jstree format

	console.log("jsonFile - parent_path - %s", parent_path);
	console.log("jsonFile - child_path - %s", child_path);
	
	getFileId(parent_path, function(parent_id) {

		console.log("jsonFile - parent_id - %d", parent_id);

		acquireFile(child_path, function(child_id) {

			console.log("jsonFile - child_id - %d", child_id);

			var jstree = {
				"parent": parent_id,
				"id": child_id,
				"children": false,
				"icon": "jstree-file",
				"state": "disabled",
				"text": path.basename(child_path),
				// Custom
				"mime": mime.lookup(child_path),
				"file": child_path.substr(www.length) // TODO: this could be done better
			};

			if (parent_id == root_id) {
				jstree.parent = '#';
			}

			callback(jstree);
		});
	});
};

// ##### ##### ##### ##### ##### //

var list_httpCallback = function(request, response) {

	try {

		response.writeHead(200, { "Content-Type": "application/json" });

		// Used to accumulate list in async
		var remaining = 0;
		var list = [];
		var listAccumulator = function(item) {

			remaining--;

			if (item) {
				list.push(item);
			}

			if (remaining <= 0) {
				response.end(JSON.stringify(list));
			}
		};

		var query = url.parse(request.url, true).query;

		console.log("Http Query - " + JSON.stringify(query));

		if ("id" in query) {

			var parent_id = (query.id == "root") ? root_id : query.id;

			console.log("Parent Id - " + parent_id);

			getFilePath(parent_id, function(parent_path) {

				console.log("Parent Path - " + parent_path);

				var parent_stats = fs.statSync(parent_path); // Move this into database

				if (parent_stats.isDirectory(parent_path) == false) {
					console.log("Parent is not a directory");
					response.end(JSON.stringify(null));
					return;
				}

				var children = fs.readdirSync(parent_path);

				remaining = children.length;

				children.forEach(function(child_path) {

					// Prevent escape from root

					child_path = path.resolve(parent_path, child_path);
					if (child_path.indexOf(root_path) != 0) return;

					// Choose the appropriate format

					var stats = fs.statSync(child_path);
					
					if (stats.isDirectory()) {
						jsonDirectory(parent_path, child_path, listAccumulator);
					}
					else {
						jsonFile(parent_path, child_path, listAccumulator);
					}
				});
			});
		}
	}
	catch (exception) {
		console.log(exception)
	}
};

// ##### ##### ##### ##### ##### 
// ##### RUN HTTP SERVER
// ##### ##### ##### ##### ##### 

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log("Invalid port!");
	process.exit();
}

var app = express();
var httpServer = http.createServer(app);

app.get("/list", list_httpCallback);
app.use(express.static(www));

httpServer.listen(port, function () {
	console.log("Tube server running at http://localhost:%s/", port);
});
