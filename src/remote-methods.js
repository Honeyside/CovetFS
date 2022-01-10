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

module.exports = { connect, add, get, remove };
