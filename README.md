# autoput

A command-line utility to watch files for changes and upload them via SFTP.


## Features

* ignore globs
* keepalive
* automatic reconnecting


## Installation

```
npm install autoput -g
```


## Usage

1. Run `autoput init` in the directory you want to watch.
2. Fill out your server info in the newly-generated `sftp.json` config file.
3. Run `autoput` to start the watch. All subdirectories will also be watched, unless they match an ignored glob specified in `sftp.json`.


## Status

* There are no tests.
* Not sure if it works with public/private keys, I've only tested it with username/password authentication.
* Only SFTP is supported (not FTP).
