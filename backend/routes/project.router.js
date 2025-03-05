const express = require('express');
const router = express.Router();
const { Boom } = require('@hapi/boom');

const { validatorHandler } = require('./../middlewares/validator.handler');
const { createProject, deleteProject, updateProject, projectIdSchema } = require('./../schemas/project.schema');
const { workspaceIdSchema } = require('./../schemas/workspace.schema');

const { validateSession } = require('./../middlewares/auth.handler');

const ProjectService = require('./../services/project.service');
const service = new ProjectService();
const { ProjectRedis } = require('../services/redis/index');


router.get('/:workspaceId',
  validateSession,
  validatorHandler(workspaceIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const { workspaceId } = req.params;

      const projectsInRedis = await ProjectRedis.findAllProjects(workspaceId);
      if(projectsInRedis && projectsInRedis.length > 0){
        return res.status(200).json({ projects: projectsInRedis });
      }
      const projectsInDb = await service.findAll(workspaceId);
      if(projectsInDb && projectsInDb.length > 0){
        return res.status(200).json({ projects: projectsInDb });
      }

      res.status(400).json({ message: 'Workspace not found' });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/create-project',
  validateSession,
  validatorHandler(createProject, 'body'),
  async (req, res, next) => {
    try {
      const { name, visibility, workspaceId, workspaceMemberId } = req.body;
      const userId = req.user.sub;

      const projectCreated = await service.create({ name, visibility, workspaceId, workspaceMemberId });
      if(!projectCreated) return Boom.badRequest('Failed to create workspace');

      res.status(201).json({ message: 'Project created successfully', project: projectCreated });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/update-project/:projectId',
  validateSession,
  validatorHandler(projectIdSchema, 'params'),
  validatorHandler(updateProject, 'body'),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const data = req.body;

      const updatedProject = await service.update(projectId, data);
      if(!updatedProject) return Boom.badRequest('Failed to create workspace');

      res.status(200).json({ message: 'Project updated successfully', project: updatedProject });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/delete-project/:projectId',
  validateSession,
  validatorHandler(projectIdSchema, 'params'),
  validatorHandler(deleteProject, 'body'),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { workspaceId, workspaceMemberId } = req.body;

      const response = await service.delete(projectId, workspaceId, workspaceMemberId);
      if(!response) return Boom.badRequest('Failed to create workspace');

      res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
