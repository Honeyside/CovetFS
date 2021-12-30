require('colors');

const homedir = require('os').homedir();
const dataFolder = `${homedir}/data/covet`;
global.options = {};
global.instanceFolder = dataFolder;

const mkdirp = require('mkdirp');
const express = require('express');
const { createServer } = require("http");
const loki = require('lokijs');
const cors = require('cors');
const formidable = require('express-formidable');
const jwt = require("jsonwebtoken");
const passport = require("passport");
const {Strategy, ExtractJwt} = require("passport-jwt");

const log = (text) => {
  console.log(`covet [${global.options.name}]: ${text}`);
}

const init = async (opts = {}) => {
  const defaults = {
    url: 'http://localhost:26017',
    name: 'anonymous',
    key: 'secret',
    port: 26017,
    behindProxy: false,
  };

  global.options = { ...defaults, ...opts };

  // create data folder
  global.instanceFolder = `${dataFolder}/${global.options.name}`;
  mkdirp.sync(instanceFolder);
  log(`instance folder is ${global.instanceFolder.cyan}`);
  const loadHandler = () => {
    global.vault = global.db.getCollection('vault');
    if (!global.vault) {
      global.vault = global.db.addCollection('vault');
    } else {
      log('loaded vault from disk');
    }
    global.store = global.db.getCollection('store');
    if (!global.store) {
      global.store = global.db.addCollection('store');
    } else {
      log('loaded store from disk');
    }
  };
  global.db = new loki(`${global.instanceFolder}/loki.db`, {
    autoload: true,
    autosave: true,
    autoloadCallback: loadHandler,
  });
  global.vault = global.db.addCollection('vault');
  global.store = global.db.addCollection('store');

  // generate access key
  jwt.sign({ application: 'covet', master: true }, global.global.options.key, { expiresIn: Number.MAX_SAFE_INTEGER }, async (err, token) => {
    if (err) {
      console.log(err);
    } else {
      log(`access key ${token.cyan}`);
      global.token = token;
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
    secretOrKey: global.options.key
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
  httpServer.listen(global.options.port, () => {
    log(`listening on port ${global.options.port}`.green);
  });
};

const axios = require('axios');
const FormData = require('form-data');
const fs = require("fs");
let url = 'http://localhost:26017';

const connect = async (options) => {
  if (!options) {
    options = {}
  }
  if (options.key) {
    axios.defaults.headers.Authorization = `Bearer ${options.key}`;
  } else {
    return console.log('covet: access key required'.red)
  }
  if (options.url) {
    url = options.url;
  }
  try {
    await axios.post(`${url}/connect`);
  } catch (e) {
    console.log('covet: connection error'.red);
    return;
  }
  console.log('covet: connected'.green);
};

const add = async ({path, ...props}) => {
  const form = new FormData();

  form.append('file', fs.createReadStream(path));
  for (let key of Object.keys(props)) {
    form.append(key, props[key]);
  }

  let response;

  try {
    response = await axios.post(`${url}/add`, form, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
      },
    });
  } catch (e) {
    throw e;
  }

  return response.data;
};

const get = async (id) => {
  let response;

  try {
    response = await axios.post(`${url}/sign`, {id});
  } catch (e) {
    throw e;
  }

  return response.data;
};

const remove = async (id) => {
  let response;

  try {
    response = await axios.post(`${url}/remove`, {id});
  } catch (e) {
    throw e;
  }

  return response.data;
};

module.exports = { init, connect, add, get, remove };
