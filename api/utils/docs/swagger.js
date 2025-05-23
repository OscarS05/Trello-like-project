const swaggerJsDoc = require('swagger-jsdoc');
const path = require('path');
const { config } = require('../../config/config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trello-like API',
      version: '1.0.0',
      description:
        'Autumn is an API for collaborative project management inspired by Trello. It is built using **Node.js, Express.js, PostgreSQL, JWT authentication, Redis for caching, Sequelize ORM, BullMQ, and Docker**. The project follows **Clean Architecture, and Domain-Driven Design (DDD)** to ensure maintainability and scalability',
      contact: {
        name: 'Santiago Monsalve',
        email: 'santiagom0509@hotmail.com',
      },
      license: {
        name: 'CC BY-NC 4.0',
        url: 'https://creativecommons.org/licenses/by-nc/4.0/',
      },
    },
    servers: [
      {
        url: 'https://trello-like-project-api.onrender.com/api/v1/',
        description: 'Remote server',
      },
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Local server',
      },
    ],
    tags: [
      {
        name: 'user',
        description: 'Everything about the user',
      },
      {
        name: 'auth',
        description: 'Everything about the authentication',
      },
      {
        name: 'workspace',
        description: 'Manage workspaces',
      },
      {
        name: 'workspace-member',
        description: 'Manage workspace members',
      },
      {
        name: 'project',
        description: 'Operations about projects',
      },
      {
        name: 'project-member',
        description: 'Operations about project members',
      },
      {
        name: 'team',
        description: 'Manage teams inside a workspace',
      },
      {
        name: 'team-member',
        description: 'Operations about team members',
      },
      {
        name: 'list',
        description: 'Operations about lists',
      },
      {
        name: 'card',
        description: 'Operations about cards',
      },
      {
        name: 'card-member',
        description: 'Operations about cards',
      },
      {
        name: 'label',
        description: 'Operations about labels',
      },
      {
        name: 'card-attachment',
        description: 'Operations about labels',
      },
      {
        name: 'checklist',
        description: 'Operations about checklists',
      },
      {
        name: 'checklist-item',
        description: 'Operations about checklist-item',
      },
      {
        name: 'checklist-item-member',
        description: 'Operations about checklist-item-member',
      },
    ],
    externalDocs: {
      description: 'Find out the github repository',
      url: 'https://github.com/OscarS05/Trello-like-project',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    path.resolve(__dirname, '../../src/interfaces/routes/*.js'),
    path.resolve(__dirname, './swaggerSchemas/*.js'),
  ],
};

const specs = swaggerJsDoc(options);
module.exports = specs;
