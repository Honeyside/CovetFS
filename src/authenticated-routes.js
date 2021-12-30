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
    name: global.options.name,
  });
});

router.post('/sign', (req, res) => {
  const id = parseInt(req.fields.id);
  const result = global.vault.findOne({ id });
  if (!result) {
    return res.status(404).json({ code: 'not-found' });
  }
  jwt.sign({ application: 'covet', id }, global.options.key, { expiresIn: 3600 * 24 }, async (err, token) => {
    if (err) {
      res.status(500).json({
        code: 'could-not-generate-token',
      });
    } else {
      res.status(200).json({
        token,
        url: `${global.options.url}/${result.id}.${result.ext}?token=${token}`,
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

  const idObject = global.store.findOne({ name: 'id' });

  if (!idObject) {
    global.store.insert({ name: 'id', value: id });
  } else {
    id = idObject.value + 1;
  }

  global.store.findAndUpdate({ name: 'id' }, item => {
    item.value = id;
  });
  global.db.saveDatabase();

  const result = global.vault.insert({
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
      name: global.options.name,
      hostname: global.options.hostname,
      port: global.options.port,
      ssl: global.options.ssl,
    },
  });
  global.db.saveDatabase();

  const readStream = fs.createReadStream(file.path);
  const dateFolder = `${global.instanceFolder}/${dateString}`;
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
  const result = global.vault.chain().find(query).simplesort('id', ).offset(offset).limit(limit).data();
  const count = global.vault.count();
  res.json({
    total: count,
    count: result.length,
    offset,
    result,
  });
});

router.post('/remove', (req, res) => {
  const id = parseInt(req.fields.id);
  let result = global.vault.findOne({ id });
  if (!result) {
    return res.status(404).json({ code: 'not-found' });
  }
  const path = `${global.instanceFolder}/${result.dateString}/${id}`;
  try {
    fs.unlinkSync(path);
  } catch (e) {
    return res.status(404).json({ code: 'not-found' });
  }
  global.vault.chain().find({ id }).remove();
  res.status(200).json(result);
});

module.exports = router;
