const store = require('./store');
const jwt = require("jsonwebtoken");
const md5File = require("md5-file");
const fs = require("fs");
const mkdirp = require("mkdirp");

const sign = async (id) => {
  return new Promise((resolve, reject) => {
    id = parseInt(id);
    const result = store.get().vault.findOne({ id });
    if (!result) {
      return reject({ code: 'not-found', status: 404 });
    }

    jwt.sign({ application: 'covet', id }, store.get().options.key, { expiresIn: 3600 * 24 }, async (err, token) => {
      if (err) {
        return reject({ code: 'could-not-generate-token', status: 500 });
      } else {
        resolve({
          token,
          url: `${store.get().options.url}${store.get().options.prefix}/${result.id}${result.ext ? `.${result.ext}` : ''}?token=${token}`,
          id,
          status: 200,
        });
      }
    });
  });
};

const add = async ({ file, descriptor }) => {
  return new Promise((resolve) => {
    const md5 = md5File.sync(file.path);

    const date = new Date();
    const dateString = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

    let id = 0;

    const idObject = store.get().store.findOne({ name: 'id' });

    if (!idObject) {
      store.get().store.insert({ name: 'id', value: id });
    } else {
      id = idObject.value + 1;
    }

    store.get().store.findAndUpdate({ name: 'id' }, item => {
      item.value = id;
    });
    store.get().db.saveDatabase();

    const result = store.get().vault.insert({
      name: file.name,
      ext: (file.name || '').split('.').pop(),
      size: file.size,
      type: file.type,
      md5,
      date: date.toISOString(),
      dateString,
      descriptor,
      id,
      source: {
        name: store.get().options.name,
        hostname: store.get().options.hostname,
        port: store.get().options.port,
        ssl: store.get().options.ssl,
      },
    });
    store.get().db.saveDatabase();

    const readStream = fs.createReadStream(file.path);
    const dateFolder = `${store.get().instanceFolder}/${dateString}`;
    mkdirp.sync(dateFolder);
    const writeStream = fs.createWriteStream(`${dateFolder}/${result.id}`);
    readStream.pipe(writeStream);

    resolve(result);
  });
};

const find = async ({ limit, offset, regex}) => {
  return new Promise((resolve) => {
    limit = limit ? parseInt(limit) : 20;
    offset = offset ? parseInt(offset) : 0;
    const query = {};
    if (regex) {
      query.name = { $regex: regex };
    }
    const result = store.get().vault.chain().find(query).simplesort('id', ).offset(offset).limit(limit).data();
    const count = store.get().vault.count();
    resolve({
      total: count,
      count: result.length,
      offset,
      result,
    });
  });
};

const remove = async (id) => {
  return new Promise((resolve, reject) => {
    id = parseInt(id);
    let result = store.get().vault.findOne({ id });
    if (!result) {
      return reject({ code: 'not-found', status: 404 });
    }
    const path = `${store.get().instanceFolder}/${result.dateString}/${id}`;
    try {
      fs.unlinkSync(path);
    } catch (e) {
      return reject({ code: 'not-found', status: 404 });
    }
    store.get().vault.chain().find({ id }).remove();
    resolve(result);
  });
};

module.exports = { sign, add, find, remove };
