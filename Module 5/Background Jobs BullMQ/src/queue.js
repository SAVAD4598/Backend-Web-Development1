'use strict';

const { Queue } = require('bullmq');

// Queue and Worker share the same Redis connection settings.
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
};

// Job retry defaults belong to the Queue so every added job inherits them.
const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

module.exports = { emailQueue, connection };
