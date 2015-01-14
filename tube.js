var fs = require("fs");
var url = require("url");
var http = require("http");
var path = require("path");

// TODO
// * Cache mime, size and type into database

// Additional plugins
var express = require("express");
var mime = require("mime");
var dblite = require("dblite");

var www = path.join(__dirname, "/www");

var root_alias = "root";
var root_id = 1; // Assumption
var root_path = path.join(www, "/videos"); // Must be accessable via http, ie. a child of www

// ##### ##### ##### ##### ##### 
// ##### DATABASE
// ##### ##### ##### ##### ##### 

var db = dblite(":memory:"); // In-memory database

db.on("info", function (info) { console.log(info); });
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
		"SELECT ROWID as file_id FROM files WHERE file_path = ?",
		[ file_path ],
		{
			file_id: Number
		},
		function(error, rows) {

			console.log("getFileId - rows - %s", JSON.stringify(rows));

			if (error) {
				callback(null);
				return;
			}

			switch (rows.length) {
				case 0: callback(null); return;
				case 1: callback(rows[0].file_id); return;
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

			if (error) {
				callback(null);
				return;
			}

			switch (rows.length) {
				case 0: callback(null); return;
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
			if (error) {
				callback(null);
				return;
			}
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

var files_api = function(request, response) {

	try {

		response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });

		// Used to accumulate list in async

		var query = url.parse(request.url, true).query;

		console.log("Http Query - " + JSON.stringify(query));

		if ("parent" in query) {

			var parent_id = (query.parent == root_alias) ? root_id : parseInt(query.parent);

			console.log("Parent Id - " + parent_id);

			getFilePath(parent_id, function(parent_path) {

				if (parent_path == null) return;

				console.log("Parent Path - " + parent_path);

				var parent_stats = fs.statSync(parent_path); // Move this into database

				if (parent_stats.isDirectory(parent_path) == false) {
					console.log("Parent is not a directory");
					response.end(JSON.stringify(null));
					return;
				}

				var list = [];
				var children = fs.readdirSync(parent_path);
				
				var remaining = children.length;
				children.forEach(function(child_path) {

					// Prevent escape from root

					child_path = path.resolve(parent_path, child_path);
					if (child_path.indexOf(root_path) != 0) return;

					// Build response

					acquireFile(child_path, function(child_id) {

						remaining--;

						if (child_id == null) return;

						console.log("Child Id - %d", child_id);

						var stats = fs.statSync(child_path);
						
						var json = {};
						json.path		= child_path.substring(www.length);
						json.name		= path.basename(child_path);
						json.child		= child_id;
						json.parent		= (parent_id == root_id) ? root_alias : parent_id;
						json.type		= "directory";

						if (stats.isDirectory() == false) {
							json.type = "file";
							json.size = stats.size; // bytes
							json.mime = mime.lookup(child_path);
						}

						list.push(json);

						if (remaining == 0) {
							response.end(JSON.stringify(list));
						}
					});
				});
			});
		}
		else {
			response.end("");
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

app.get("/files", files_api);
app.use(express.static(www));

httpServer.listen(port, function () {
	console.log("Tube server running at http://localhost:%s/", port);
});
