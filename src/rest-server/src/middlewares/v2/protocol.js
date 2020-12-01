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

// module dependencies
const yaml = require('js-yaml');
const mustache = require('mustache');

const createError = require('@pai/utils/error');
const hived = require('@pai/middlewares/v2/hived');
const { enabledHived } = require('@pai/config/launcher');
const protocolSchema = require('@pai/config/v2/protocol');
const asyncHandler = require('@pai/middlewares/v2/asyncHandler');

const mustacheWriter = new mustache.Writer();

const prerequisiteTypes = ['script', 'output', 'data', 'dockerimage'];

const prerequisiteFields = ['script', 'output', 'data', 'dockerImage'];

const render = (template, dict, tags = ['<%', '%>']) => {
  const tokens = mustacheWriter.parse(template, tags);
  const context = new mustache.Context(dict);
  let result = '';
  for (const token of tokens) {
    const symbol = token[0];
    let tokenStr = token[1];
    if (symbol === 'text') {
      result += tokenStr;
    } else if (symbol === 'name') {
      tokenStr = tokenStr.replace(/\[(\d+)\]/g, '.$1');
      const value = context.lookup(tokenStr);
      if (value != null) {
        result += value;
      } else {
        result += `<% ${tokenStr} %>`;
      }
    }
  }
  return result.trim();
};

const protocolValidate = (protocolYAML) => {
  const protocolObj = yaml.safeLoad(protocolYAML);
  if (!protocolSchema.validate(protocolObj)) {
    throw createError(
      'Bad Request',
      'InvalidProtocolError',
      protocolSchema.validate.errors,
    );
  }
  // convert prerequisites list to dict
  const prerequisites = {};
  for (const type of prerequisiteTypes) {
    prerequisites[type] = {};
  }
  if ('prerequisites' in protocolObj) {
    for (const item of protocolObj.prerequisites) {
      if (
        Object.prototype.hasOwnProperty.call(
          prerequisites[item.type],
          item.name,
        )
      ) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Duplicate ${item.type} prerequisites ${item.name}.`,
        );
      } else {
        prerequisites[item.type][item.name] = item;
      }
    }
  }
  protocolObj.prerequisites = prerequisites;
  // convert deployments list to dict
  const deployments = {};
  if ('deployments' in protocolObj) {
    for (const item of protocolObj.deployments) {
      if (Object.prototype.hasOwnProperty.call(deployments, item.name)) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Duplicate deployments ${item.name}.`,
        );
      } else {
        deployments[item.name] = item;
      }
    }
  }
  protocolObj.deployments = deployments;
  // check prerequisites in taskRoles
  for (const taskRole of Object.keys(protocolObj.taskRoles)) {
    for (const field of prerequisiteFields) {
      if (
        field in protocolObj.taskRoles[taskRole] &&
        !(
          protocolObj.taskRoles[taskRole][field] in
          prerequisites[field.toLowerCase()]
        )
      ) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Prerequisite ${protocolObj.taskRoles[taskRole][field]} does not exist.`,
        );
      }
    }
  }
  // check deployment in defaults
  if ('defaults' in protocolObj) {
    if (
      'deployment' in protocolObj.defaults &&
      !(protocolObj.defaults.deployment in deployments)
    ) {
      throw createError(
        'Bad Request',
        'InvalidProtocolError',
        `Default deployment ${protocolObj.defaults.deployment} does not exist.`,
      );
    }
  }
  return protocolObj;
};

const protocolRender = (protocolObj) => {
  // render auth for Docker image
  for (const name of Object.keys(protocolObj.prerequisites.dockerimage)) {
    if ('auth' in protocolObj.prerequisites.dockerimage[name]) {
      for (const prop of Object.keys(
        protocolObj.prerequisites.dockerimage[name].auth,
      )) {
        protocolObj.prerequisites.dockerimage[name].auth[prop] = render(
          protocolObj.prerequisites.dockerimage[name].auth[prop],
          {
            $secrets: protocolObj.secrets,
          },
        );
      }
    }
  }
  // render commands
  let deployment = null;
  if ('defaults' in protocolObj && 'deployment' in protocolObj.defaults) {
    deployment = protocolObj.deployments[protocolObj.defaults.deployment];
  }
  for (const taskRole of Object.keys(protocolObj.taskRoles)) {
    let commands = protocolObj.taskRoles[taskRole].commands;
    if (deployment != null && taskRole in deployment.taskRoles) {
      if ('preCommands' in deployment.taskRoles[taskRole]) {
        commands = deployment.taskRoles[taskRole].preCommands.concat(commands);
      }
      if ('postCommands' in deployment.taskRoles[taskRole]) {
        commands = commands.concat(deployment.taskRoles[taskRole].postCommands);
      }
    }
    commands = commands.map((command) => command.trim()).join('\n');
    // Will not render secret here for security issue
    const entrypoint = render(commands, {
      $parameters: protocolObj.parameters,
      $script:
        protocolObj.prerequisites.script[
          protocolObj.taskRoles[taskRole].script
        ],
      $output:
        protocolObj.prerequisites.output[
          protocolObj.taskRoles[taskRole].output
        ],
      $data:
        protocolObj.prerequisites.data[protocolObj.taskRoles[taskRole].data],
    });
    protocolObj.taskRoles[taskRole].entrypoint = entrypoint;
  }
  return protocolObj;
};

const protocolSubmitMiddleware = [
  (req, res, next) => {
    res.locals.protocol = req.body;
    next();
  },
  (req, res, next) => {
    res.locals.protocol = protocolValidate(res.locals.protocol);
    next();
  },
  (req, res, next) => {
    res.locals.protocol = protocolRender(res.locals.protocol);
    next();
  },
  asyncHandler(async (req, res, next) => {
    if (enabledHived) {
      res.locals.protocol = await hived.validate(
        res.locals.protocol,
        req.user.username,
      );
    }
    next();
  }),
];

// module exports
module.exports = {
  validate: protocolValidate,
  render: protocolRender,
  submit: protocolSubmitMiddleware,
};
