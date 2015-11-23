var CoreObject  = require('core-object');
var Promise     = require('ember-cli/lib/ext/promise');
var SilentError = require('silent-error');

var Ssh         = require('ssh2');
var Path        = require('path');
var Chalk       = require('chalk');
var Fs          = require('fs');

var good        = Chalk.green;

module.exports = CoreObject.extend({
  init: function() {
    CoreObject.prototype.init.apply(this, arguments);

    if (!this.config) { return Promise.reject(new SilentError('You have to pass a config!')); }

    this._config = this.config;
    this._client = new Ssh.Client();
    this._clientOptions = this._getClientOptions();
  },
  upload: function(bootstrapIndexHTML) {
    if (!bootstrapIndexHTML) { return Promise.reject(new SilentError('You have to pass the contents to upload!')); }

    var _this = this,
        _config = this._config,
        _client = this._client,
        _clientOptions = this._clientOptions,
        _key = this.taggingAdapter.createTag();

    return new Promise(function(resolve, reject) {
      _this._connect(_client, _clientOptions).then(function() {
        var _remotePath = Path.join(_config.remoteDir, _key);
        var _remoteFileName = 'index.html';

        _this._uploadFile(_client, _remotePath, _remoteFileName, bootstrapIndexHTML).then(function() {
          console.log(good(`Uploaded ${_remoteFileName} to ${Path.join(_remotePath, _remoteFileName)}`));
          _this.activate(_key).then(resolve, reject);
        },
        reject);
      },
      reject);
    });
  },
  activate: function(revisionToActivate) {
    if (!revisionToActivate) { return Promise.reject(new SilentError('You have to pass the revision to activate!')); }

    var _this = this,
        _config = this._config,
        _client = this._client,
        _clientOptions = this._clientOptions,
        _currentPath = Path.join(_config.remoteDir, 'current'),
        _targetPath = Path.join(_config.remoteDir, revisionToActivate);

    return new Promise(function(resolve, reject) {
      _this._connect(_client, _clientOptions).then(function() {
        _client.sftp(function(error, sftp) {
          if (error) { reject(error); }

          sftp.unlink(_currentPath, function() {
            // ignore errors on unlink

            sftp.symlink(_targetPath, _currentPath, function(error) {
              if (error) { reject(error); }

              console.log(good(`Activated ${revisionToActivate}`));

              resolve();
            });
          });
        },
        reject);
      },
      reject);
    });
  },
  list: function() {
    var _this = this,
        _config = this._config,
        _client = this._client,
        _clientOptions = this._clientOptions,
        _path = _config.remoteDir;

    return new Promise(function(resolve, reject) {
      _this._connect(_client, _clientOptions).then(function() {
        _client.sftp(function(error, sftp) {
          if (error) { reject(error); }

          sftp.readdir(_path, function(error, list) {
            if (error) { reject(error); }

            console.log(list);
            resolve();
          });
        },
        reject);
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
