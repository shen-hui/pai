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

const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { secret, tokenExpireTime } = require('@pai/config/token');
const k8sSecret = require('@pai/models/kubernetes/k8s-secret');
const k8sModel = require('@pai/models/kubernetes/kubernetes');

const namespace = process.env.PAI_TOKEN_NAMESPACE || 'pai-user-token';

// create namespace if not exists
if (process.env.NODE_ENV !== 'test') {
  k8sModel.createNamespace(namespace);
}

const sign = async (username, application, expiration) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      {
        username,
        application,
      },
      secret,
      expiration != null ? { expiresIn: expiration } : {},
      (signError, token) => {
        signError ? reject(signError) : resolve(token);
      },
    );
  });
};

/**
 * Remove invalid (expired/malformed) tokens from given token list object.
 * @param {Object} data - id -> token format data object (data stored in k8s secret)
 * @returns {Object} Purged data in the same format
 */
const purge = (data) => {
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    try {
      jwt.verify(val, secret);
      result[key] = val;
    } catch (err) {
      // pass;
    }
  }
  return result;
};

const list = async (username) => {
  const item = await k8sSecret.get(namespace, username, { encode: 'hex' });
  if (item === null) {
    return {};
  }

  const purged = purge(item);
  if (Object.keys(item).length !== Object.keys(purged).length) {
    await k8sSecret.replace(namespace, username, purged, { encode: 'hex' });
  }
  return Object.values(purged);
};

const create = async (username, application = false, expiration) => {
  if (application) {
    expiration = expiration || undefined;
  } else {
    expiration = expiration || tokenExpireTime;
  }
  const token = await sign(username, application, expiration);
  const item = await k8sSecret.get(namespace, username, { encode: 'hex' });
  if (item === null) {
    await k8sSecret.create(
      namespace,
      username,
      {
        [uuid()]: token,
      },
      { encode: 'hex' },
    );
  } else {
    const result = purge(item);
    result[uuid()] = token;
    await k8sSecret.replace(namespace, username, result, { encode: 'hex' });
  }
  return token;
};

const revoke = async (token) => {
  const payload = jwt.verify(token, secret);
  const username = payload.username;
  if (!username) {
    throw new Error('Token无效');
  }
  const item = await k8sSecret.get(namespace, username, { encode: 'hex' });
  if (item === null) {
    throw new Error('Token无效');
  }
  const result = purge(item);
  for (const [key, val] of Object.entries(result)) {
    if (val === token) {
      delete result[key];
    }
  }
  await k8sSecret.replace(namespace, username, result, { encode: 'hex' });
};

const batchRevoke = async (username, filter) => {
  const item = await k8sSecret.get(namespace, username, { encode: 'hex' });
  const result = purge(item || {});
  for (const [key, val] of Object.entries(result)) {
    if (filter(val)) {
      delete result[key];
    }
  }
  await k8sSecret.replace(namespace, username, result, { encode: 'hex' });
};

const verify = async (token) => {
  const payload = jwt.verify(token, secret);
  const username = payload.username;
  if (!username) {
    throw new Error('Token无效');
  }
  const item = await k8sSecret.get(namespace, username, { encode: 'hex' });
  if (item === null) {
    throw new Error('Token无效');
  }
  const purged = purge(item);
  for (const [, val] of Object.entries(purged)) {
    if (val === token) {
      return payload;
    }
  }
  if (Object.keys(item).length !== Object.keys(purged).length) {
    await k8sSecret.replace(namespace, username, purged, { encode: 'hex' });
  }
  throw new Error('Token已被撤销');
};

module.exports = {
  list,
  create,
  batchRevoke,
  revoke,
  verify,
};
