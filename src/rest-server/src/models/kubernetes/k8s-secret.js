// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

const _ = require('lodash');
const {
  encodeSelector,
  getClient,
  patchOption,
} = require('@pai/models/kubernetes/kubernetes');

const initClient = (namespace) => {
  if (!namespace) {
    throw new Error('K8S SECRET: invalid namespace');
  }
  return getClient(`/api/v1/namespaces/${namespace}/secrets`);
};

/**
 * Serialize key-value object to k8s secret's base64 encoded data structure
 * @param {Object} object - key-value dictionary, value should be string
 * @returns {Object}
 */
const serialize = (object) => {
  if (object == null) {
    return {};
  }

  const result = {};
  for (const [key, val] of Object.entries(object)) {
    result[key] = Buffer.from(val).toString('base64');
  }
  return result;
};

/**
 * Deserialize k8s secret's base64 encoded data structure to key-value object
 * @param {Object} object - k8s secret's data
 * @returns {Object} key-value dictionary, value is string.
 */
const deserialize = (object) => {
  if (object == null) {
    return {};
  }

  const result = {};
  for (const [key, val] of Object.entries(object)) {
    result[key] = Buffer.from(val, 'base64').toString();
  }
  return result;
};

const get = async (namespace, name, options = {}) => {
  if (!name) {
    return list(namespace);
  }
  const client = initClient(namespace);
  const { encode } = options;
  let secretName = name;
  if (encode != null) {
    // k8s resource's name must consisst of only digits (0-9), lower case letters (a-z), -, and ..
    // We encode the key here to ensure it is valid.
    secretName = Buffer.from(name).toString('hex');
  }

  try {
    const response = await client.get(`/${secretName}`);
    return deserialize(response.data.data);
  } catch (err) {
    if (err.response && err.response.status === 404 && err.response.data) {
      return null;
    } else {
      throw err;
    }
  }
};

const list = async (namespace, labelSelector) => {
  const labelSelectorStr = encodeSelector(labelSelector);
  const client = initClient(namespace);
  let continueValue = null;
  let result = [];
  do {
    let response;
    try {
      // param
      const params = {
        labelSelector: labelSelectorStr,
      };
      if (continueValue) {
        params.continue = continueValue;
      }
      // request
      response = await client.get('/', { params });
    } catch (err) {
      if (err.response && err.response.status === 410) {
        // restart
        continueValue = null;
        result = [];
        continue;
      } else {
        throw err;
      }
    }
    continueValue = response.metadata && response.metadata.continue;
    const items = _.get(response, 'data.items') || [];
    result.push(...items);
  } while (continueValue !== undefined);

  const output = {};
  for (const item of result) {
    const name = Buffer.from(item.metadata.name, 'hex').toString();
    output[name] = deserialize(item.data);
  }
  return output;
};

const create = async (namespace, name, data, options = {}) => {
  const { labels, encode, type } = options;
  const client = initClient(namespace);

  let secretName = name;
  if (encode != null) {
    secretName = Buffer.from(name).toString(encode);
  }

  const response = await client.post('/', {
    metadata: {
      name: secretName,
      namespace: namespace,
      labels: labels,
    },
    type: type,
    data: serialize(data),
  });
  return response.data;
};

const replace = async (namespace, name, data, options = {}) => {
  const { encode, labels } = options;
  let secretName = name;
  if (encode != null) {
    secretName = Buffer.from(secretName).toString(encode);
  }
  const client = initClient(namespace);
  const response = client.put(`/${secretName}`, {
    metadata: {
      name: secretName,
      namespace: namespace,
      labels: labels,
    },
    data: serialize(data),
  });
  return response.data;
};

const remove = async (namespace, name, options = {}) => {
  const { encode } = options;
  let secretName = name;
  if (encode != null) {
    secretName = Buffer.from(name).toString(encode);
  }
  const client = initClient(namespace);
  await client.delete(`/${secretName}`);
};

const patchMetadata = async (namespace, name, metadata, options = {}) => {
  const { encode } = options;
  let secretName = name;
  if (encode != null) {
    secretName = Buffer.from(name).toString(encode);
  }
  const client = initClient(namespace);
  await client.patch(`/${secretName}`, { metadata: metadata }, patchOption);
};

module.exports = {
  get,
  list,
  create,
  replace,
  remove,
  patchMetadata,
};
