var CoreObject  = require('core-object');
var Promise     = require('ember-cli/lib/ext/promise');
var RSVP        = require('rsvp');
var SilentError = require('silent-error');

var Ssh         = require('ssh2');
var Path        = require('path');
var Chalk       = require('chalk');
var Fs          = require('fs');
var Glob        = require('glob');

var TaggingAdapter = require('./ssh-tag-adapter');

var good        = Chalk.green;

module.exports = CoreObject.extend({
  init: function() {
    CoreObject.prototype.init.apply(this, arguments);

    if (!this.config) { return Promise.reject(new SilentError('You have to pass a config!')); }

    this._config = this.config.assets;
    this._client = new Ssh.Client();
    this._clientOptions = this._getClientOptions();
    this.taggingAdapter = new TaggingAdapter();
  },
  upload: function() {
    var _this = this,
        _config = this._config,
        _client = this._client,
        _clientOptions = this._clientOptions,
        _assetPath = 'tmp/assets-sync',
        _searchPath = Path.join(_assetPath, '**', '*.*');

    return new Promise(function(resolve, reject) {
      _this._connect(_client, _clientOptions).then(function() {
        new Glob(_searchPath, function(error, files) {
          if (error) { reject(error); }

          var readFile = RSVP.denodeify(Fs.readFile);

          files.reduce(function(previous, filePath){

            var _remotePath = Path.join(_config.remoteDir, Path.dirname(Path.relative(_assetPath, filePath)));
            var _remoteFileName = Path.basename(filePath);

            return previous
              .then(function() {
                return readFile(filePath);
              })
              .then(function(data) {
                return _this._uploadFile(_client, _remotePath, _remoteFileName, data);
              })
              .then(function() {
                console.log(good('Uploaded ' + filePath + ' to ' + Path.join(_remotePath, _remoteFileName)));
              });
          }, RSVP.resolve())
          .then(resolve, reject);
        });
      },
      reject);
    });
  },

  _createDirectory: function(client, path) {
    return new Promise(function (resolve, reject) {
      client.exec('mkdir -p ' + path, function (error, stream) {
        if (error) { reject(error); return; }

        stream.on('error', reject);
        stream.on('close', resolve);
      });
    });
  },

  _uploadFile: function(client, path, fileName, fileContents) {
    var _this = this;

    return new Promise(function(resolve, reject) {
      _this._createDirectory(client, path).then(function() {
        client.sftp(function(error, sftp) {
          if (error) { reject(error); }

          var stream = sftp.createWriteStream(Path.join(path, fileName));
          stream.on('error', reject);
          stream.on('end', reject);
          stream.on('close', function() {
            sftp.end();
            resolve();
          });

          stream.write(fileContents);
          stream.end();
        });
      },
      reject);
    });
  },

  _connect: function(client, configurationOptions) {
    return new Promise(function(resolve, reject) {
      client.on('ready', resolve);
      client.on('error', reject);

      client.connect(configurationOptions);
    });
  },
  _getClientOptions: function() {
    var clientOptions = {
      host:       this._config.host,
      username:   this._config.username,
      port:       this._config.port || '22',
      agent:      this._config.agent,
      passphrase: this._config.passphrase
    };

    if (typeof this._config.privateKeyFile !== 'undefined') {
      clientOptions['privateKey'] = Fs.readFileSync(this.config.privateKeyFile);
    }

    return clientOptions;
  }
});
