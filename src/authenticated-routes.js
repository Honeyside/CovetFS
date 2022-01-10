const store = require('./store');
const express = require('express');
const jwt = require("jsonwebtoken");
const md5File = require("md5-file");
const fs = require("fs");
const mkdirp = require("mkdirp");
const router = express.Router();
const version = require('../version.json');

router.post('/connect', (req, res) => {
  res.status(200).json({
    app: 'covet',
    ...version,
    name: store.get().options.name,
  });
});

router.post('/sign', (req, res) => {
  const id = parseInt(req.fields.id);
  const result = store.get().vault.findOne({ id });
  if (!result) {
    return res.status(404).json({ code: 'not-found' });
  }
  jwt.sign({ application: 'covet', id }, store.get().options.key, { expiresIn: 3600 * 24 }, async (err, token) => {
    if (err) {
      res.status(500).json({
        code: 'could-not-generate-token',
      });
    } else {
      res.status(200).json({
        token,
        url: `${store.get().options.url}/${result.id}${result.ext ? `.${result.ext}` : ''}?token=${token}`,
        id,
      });
    }
  });
});

router.post('/add', async (req, res) => {
  const file = req.files.file;

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
    descriptor: req.fields,
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

  res.json(result);
});

router.post('/find', (req, res) => {
  const limit = req.fields.limit ? parseInt(req.fields.limit) : 20;
  const offset = req.fields.offset ? parseInt(req.fields.offset) : 0;
  const query = {};
  if (req.fields.regex) {
    query.name = { $regex: req.fields.regex };
  }
  const result = store.get().vault.chain().find(query).simplesort('id', ).offset(offset).limit(limit).data();
  const count = store.get().vault.count();
  res.json({
    total: count,
    count: result.length,
    offset,
    result,
  });
});

router.post('/remove', (req, res) => {
  const id = parseInt(req.fields.id);
  let result = store.get().vault.findOne({ id });
  if (!result) {
    return res.status(404).json({ code: 'not-found' });
  }
  const path = `${store.get().instanceFolder}/${result.dateString}/${id}`;
  try {
    fs.unlinkSync(path);
  } catch (e) {
    return res.status(404).json({ code: 'not-found' });
  }
  store.get().vault.chain().find({ id }).remove();
  res.status(200).json(result);
});

module.exports = router;
