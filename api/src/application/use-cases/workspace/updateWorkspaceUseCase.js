const boom = require('@hapi/boom');
const UpdateWorkspaceEntity = require('../../../domain/entities/UpdateWorkspaceEntity');
const WorkspaceDto = require('../../dtos/workspace.dto');

class UpdateWorkspaceUseCase {
  constructor({ workspaceRepository }) {
    this.workspaceRepository = workspaceRepository;
  }

  async execute(workspaceId, workspaceData) {
    if (!workspaceId) {
      throw boom.badRequest('WorkspaceId was not provided');
    }
    const updateWorkspaceEntity = new UpdateWorkspaceEntity(workspaceData);

    const [updatedRows, [updatedWorkspace]] =
      await this.workspaceRepository.update(workspaceId, updateWorkspaceEntity);
    if (updatedRows === 0) throw boom.notFound('Workspace not found');

    return new WorkspaceDto(updatedWorkspace);
  }
}

module.exports = UpdateWorkspaceUseCase;
