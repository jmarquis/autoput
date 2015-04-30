#! /usr/bin/env node

var pkg = require("./package.json");
var config = require(process.cwd() + "/sftp.json");
var path = require("path");
var Q = require("q");
var Gaze = require("gaze").Gaze;
var SSHClient = require("ssh2").Client;
var notifier = require("node-notifier");

process.on("uncaughtException", function (error) {
	console.error(error);
	process.exit(1);
});

var _ = {

	globs: config.ignore ? config.ignore.map(function(file) { return "!" + file; }).concat(["**/*"]) : ["**/*"],

	connection: null,
	watcher: null,
	validated: false,
	queue: [],
	sftp: null,
	processing: false,

	init: function () {

		console.log(pkg.name + " " + pkg.version);

		if (!config.host || !config.port || !config.auth || !config.auth.username || !config.auth.password || !config.path) {
			console.log("Required sftp.json fields missing");
			process.exit(1);
		}

		_.connection = new SSHClient();

		_.connection.on("error", function (error) {
			console.log(error);
			if (watcher) watcher.close();
		});

		_.connection.on("ready", function () {
			_.openTransport()
				.then(_.validateRemotePath)
				.then(_.processQueue)
				.then(_.watch);
		});

		_.connect();

	},

	connect: function () {
		console.log("Connecting to " + config.host + " ... ");
		_.connection.connect({
			host: config.host,
			port: config.port,
			username: config.auth.username,
			password: config.auth.password
		});
	},

	openTransport: function () {
		return Q.Promise(function (resolve, reject) {
			_.connection.sftp(function (error, sftp) {
				if (error) {
					console.log("SSH ERROR: " + error);
					reject();
				} else {
					_.sftp = sftp;
					resolve();
				}
			});
		});
	},

	validateRemotePath: function () {
		return Q.Promise(function (resolve, reject) {
			if (_.validated) resolve();
			else {

				process.stdout.write("Validating remote directory: " + config.path + " ... ");

				var remotePathTimeout = setTimeout(function () {
					console.log("\nUnable to validate remote directory (timeout): " + config.path);
					reject();
				}, 10000);

				var remotePathStat = _.sftp.stat(config.path, function (error, stat) {
					clearTimeout(remotePathTimeout);
					if (error) {
						console.log("\nUnable to validate remote directory: " + config.path, error);
						reject();
					} else if (!stat.isDirectory()) {
						console.log("\nRemote path is not a directory: " + config.path);
					} else {
						console.log("done");
						_.validated = true;
						resolve();
					}
				});

			}
		});
	},

	processQueue: function () {
		return Q.Promise(function (resolve, reject) {

			if (_.processing) {
				resolve();
			} else if (_.queue.length === 0) {
				_.processing = false;
				resolve();
			} else {
				_.processing = true;
				_.put(_.queue.shift()).then(_.processQueue, _.clearQueue);
			}

		});
	},

	clearQueue: function () {
		_.queue = [];
		processing = false;
	},

	put: function (absolutePath) {
		return Q.Promise(function (resolve, reject) {
			var relativePath = path.relative(process.cwd(), absolutePath);
			process.stdout.write("Uploading " + absolutePath + " ... ");
			_.sftp.fastPut(absolutePath, path.join(config.path, relativePath), function (error) {
				if (error) {
					console.log("\n" + error);
					notifier.notify({
						title: "SFTP Upload Error",
						message: relativePath
					});
					reject();
				} else {
					console.log("success");
					notifier.notify({
						title: "SFTP Upload Success",
						message: relativePath
					});
					resolve();
				}
			});
		});
	},

	watch: function () {
		_.watcher = new Gaze(_.globs, function (error) {

			if (error) {
				console.log(error);
				process.exit(1);
			}

			this.on("all", function (event, absolutePath) {
				console.log(event + ": " + path.relative(process.cwd(), absolutePath));
				if (event === "changed" || event === "added") {
					_.queue.push(absolutePath);
					_.processQueue();
				}
			});

			console.log("Watching for changes...");

		});
	}

};

_.init();
