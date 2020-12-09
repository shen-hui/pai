// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const express = require('express');
const token = require('@pai/middlewares/token');
const kubernetes = require('@pai/models/kubernetes/kubernetes');

const router = new express.Router();

router
  .route('/nodes')
  /** GET /api/v1/kubernetes/nodes - Return k8s nodes info */
  .get(token.check, token.checkAdmin, async (req, res, next) => {
    try {
      const nodes = await kubernetes.getNodes();
      res.status(200).json(nodes);
    } catch (err) {
      next(err);
    }
  });

router
  .route('/pods')
  /** GET /api/v1/kubernetes/pods - Return k8s pods info */
  .get(token.check, token.checkAdmin, async (req, res, next) => {
    try {
      const pods = await kubernetes.getPods(req.query);
      res.status(200).json(pods);
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
