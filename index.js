var SSHIndexAdapter   = require('./lib/ssh-index-adapter');
var SSHAssetsAdapter  = require('./lib/ssh-assets-adapter');
var SSHTagAdapter     = require('./lib/ssh-tag-adapter');

module.exports = {
  name: 'ember-cli-deploy-ssh',
  type: 'ember-deploy-addon',
  adapters: {
    index: {
      'ssh': SSHIndexAdapter
    },
    assets: {
      'ssh': SSHAssetsAdapter
    },
    tagging: {
      'ssh': SSHTagAdapter
    }
  }
};
