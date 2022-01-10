const store = require('./store');
const express = require('express');
const jwt = require("jsonwebtoken");
const fs = require("fs");
const version = require("../version.json");
const router = express.Router();

router.use('/info', (req, res) => {
  res.status(200).json({
    app: 'covet',
    ...version,
    name: store.get().options.name,
  });
});

router.get('/:id/info', (req, res) => {
  const id = parseInt((req.params.id || '0').split('.')[0]);
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ code: 'token-required' });
  }
  jwt.verify(token, store.get().options.key, { maxAge: 3600 * 24 }, (err, decoded) => {
    if (err || id !== decoded.id) {
      res.status(401).json({
        ...(err || {}),
        code: 'token-error',
      });
    } else {
      const result = store.get().vault.findOne({ id });
      if (!result) {
        return res.status(404).json({ code: 'not found' });
      }
      res.status(200).json(result);
    }
  });
});

router.get('/:id', (req, res) => {
  const id = parseInt((req.params.id || '0').split('.')[0]);
  const action = req.query.action;
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ code: 'token-required' });
  }
  jwt.verify(token, store.get().options.key, { maxAge: 3600 * 24 }, (err, decoded) => {
    if (err || id !== decoded.id) {
      res.status(401).json({
        ...(err || {}),
        code: 'token-error',
      });
    } else {
      const range = req.headers.range;
      const result = store.get().vault.findOne({ id });
      if (!result) {
        return res.status(404).send('');
      }
      res.set('Content-Type', result.type);
      res.set('Content-Disposition', `${action === 'download' ? 'attachment; ' : ''}filename="${result.name}"`);
      let readStream;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : result.size - 1;
        const chunksize = (end - start) + 1;
        res.set('Content-Range', `bytes ${start}-${end}/${result.size}`);
        res.set('Accept-Ranges', 'bytes');
        res.set('Content-Length', chunksize);
        readStream = fs.createReadStream(`${store.get().instanceFolder}/${result.dateString}/${id}`, {start, end});
      } else {
        res.set('Content-Length', result.size);
        readStream = fs.createReadStream(`${store.get().instanceFolder}/${result.dateString}/${id}`);
      }
      readStream.pipe(res);
      res.status(range ? 206 : 200);
    }
  });
});

module.exports = router;
