require('colors');
const store = require('./src/store');

const homedir = require('os').homedir();
const dataFolder = `${homedir}/data/covet`;
store.get().options = {};
store.get().instanceFolder = dataFolder;

const mkdirp = require('mkdirp');
const express = require('express');
const { createServer } = require("http");
const loki = require('lokijs');
const cors = require('cors');
const formidable = require('express-formidable');
const jwt = require("jsonwebtoken");
const passport = require("passport");
const {Strategy, ExtractJwt} = require("passport-jwt");

const log = (text, priority) => {
  if (store.get().options.verbose || priority) {
    console.log(`covet [${store.get().options.name}]: ${text}`);
  }
}

const init = async (opts = {}) => {
  const defaults = {
    url: 'http://localhost:26017',
    name: 'anonymous',
    key: 'secret',
    port: 26017,
    local: false,
  };

  store.get().options = { ...defaults, ...opts };

  // create data folder
  store.get().instanceFolder = `${dataFolder}/${store.get().options.name}`;
  mkdirp.sync(store.get().instanceFolder);
  log(`instance folder is ${store.get().instanceFolder.cyan}`);
  const loadHandler = () => {
    store.get().vault = store.get().db.getCollection('vault');
    if (!store.get().vault) {
      store.get().vault = store.get().db.addCollection('vault');
    } else {
      log('loaded vault from disk');
    }
    store.get().store = store.get().db.getCollection('store');
    if (!store.get().store) {
      store.get().store = store.get().db.addCollection('store');
    } else {
      log('loaded store from disk');
    }
  };
  store.get().db = new loki(`${store.get().instanceFolder}/loki.db`, {
    autoload: true,
    autosave: true,
    autoloadCallback: loadHandler,
  });
  store.get().vault = store.get().db.addCollection('vault');
  store.get().store = store.get().db.addCollection('store');

  // generate access key
  jwt.sign({ application: 'covet', master: true }, store.get().options.key, { expiresIn: Number.MAX_SAFE_INTEGER }, async (err, token) => {
    if (err) {
      console.log(err);
    } else {
      log(`access key ${token.cyan}`);
      store.get().token = token;
    }
  });

  // setup servers
  const app = new express();
  const httpServer = createServer(app);

  // setup express
  app.use(cors());
  app.use(formidable({maxFileSize: Number.MAX_SAFE_INTEGER}));
  app.use(passport.initialize({}));
  passport.use('jwt', new Strategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: store.get().options.key
  }, (payload, done) => {
    if (payload.master) {
      done(null, payload);
    } else {
      done(null, false);
    }
  }));

  app.use(require('./src/session-routes'));
  app.use(passport.authenticate('jwt', {session: false}, null));
  app.use(require('./src/authenticated-routes'));

  // listen on http server
  httpServer.listen(store.get().options.port, () => {
    log(`listening on port ${store.get().options.port}`.green);
  });
};

const initLocal = async (opts) => {
  const defaults = {
    url: 'http://localhost:26017',
    name: 'anonymous',
    key: 'secret',
    port: 26017,
    app: null,
    prefix: '',
    local: true,
  };

  store.get().options = { ...defaults, ...opts };

  if (!opts.app) {
    return log('an express app is required for running a local instance'.red, true);
  }

  // create data folder
  store.get().instanceFolder = `${dataFolder}/${store.get().options.name}`;
  mkdirp.sync(store.get().instanceFolder);
  log(`instance folder is ${store.get().instanceFolder.cyan}`);
  const loadHandler = () => {
    store.get().vault = store.get().db.getCollection('vault');
    if (!store.get().vault) {
      store.get().vault = store.get().db.addCollection('vault');
    } else {
      log('loaded vault from disk');
    }
    store.get().store = store.get().db.getCollection('store');
    if (!store.get().store) {
      store.get().store = store.get().db.addCollection('store');
    } else {
      log('loaded store from disk');
    }
  };
  store.get().db = new loki(`${store.get().instanceFolder}/loki.db`, {
    autoload: true,
    autosave: true,
    autoloadCallback: loadHandler,
  });
  store.get().vault = store.get().db.addCollection('vault');
  store.get().store = store.get().db.addCollection('store');

  store.get().options.app.use(store.get().options.prefix, require('./src/session-routes'));
};

const remote = require('./src/remote-methods');
const local = require('./src/local-methods');

const { connect, get } = remote;
const { sign, find } = local;

const add = (opts) => {
  if (store.get().options.local) {
    return local.add(opts);
  } else {
    return remote.add(opts);
  }
};

const remove = (opts) => {
  if (store.get().options.local) {
    return local.remove(opts);
  } else {
    return remote.remove(opts);
  }
};

module.exports = { init, connect, add, get, remove, sign, find, initLocal };
