const boom = require('@hapi/boom');

class WorkspaceMemberService {
  constructor(sequelize, models, redisModels, workspaceService) {
    this.sequelize = sequelize;
    this.models = models;
    this.redisModels = redisModels;
    this.workspaceService = workspaceService
  }

  async create(workspaceId, userId){
    try {
      const isMember = await this.models.WorkspaceMember.findOne(
        { where: { workspaceId, userId } }
      );
      if(isMember){
        throw boom.conflict('User is already a member of this workspace');
      }

      const addedMember = await this.models.WorkspaceMember.create({
        workspaceId,
        userId,
        role: 'member',
        propertyStatus: 'guest'
      });

      await this.redisModels.WorkspaceMemberRedis.saveWorkspaceIdByUserId(userId, [workspaceId], [addedMember.id]);
      return addedMember;
    } catch (error) {
      throw boom.badRequest(error.message || 'Failed to create workspace members');
    }
  }

  async changeRole(workspaceId, workspaceMemberId, newRole){
    try {
      const [ updatedRows, [updatedWorkspaceMember] ] = await this.models.WorkspaceMember.update(
        { role: newRole },
        { where: { workspaceId, id: workspaceMemberId }, returning: true }
      );
      if(updatedRows === 0) throw boom.badRequest('Failed to update role');

      return updatedWorkspaceMember.dataValues;
    } catch (error) {
      throw boom.badRequest(error.message || 'Failed to update role');
    }
  }

  async handleUpdateRole(workspaceId, workspaceMemberId, newRole){
    try {
      const memberStatus = await this.findStatusByMemberId(workspaceId, workspaceMemberId);
      if(memberStatus.property_status === 'owner') throw boom.forbidden("You cannot change the owner's role");
      if(memberStatus.role === newRole) throw boom.conflict('The member already has this role');

      const updatedMember = await this.changeRole(workspaceId, workspaceMemberId, newRole);
      return updatedMember.dataValues;
    } catch (error) {
      throw boom.badRequest(error.message || 'Failed to update role');
    }
  }

  async deleteMember(workspaceId, workspaceMemberId, userId){
    const transaction = await this.sequelize.transaction();
    try {
      const removedMember = await this.models.WorkspaceMember.destroy(
        { where: { workspaceId, id: workspaceMemberId }, transaction }
      );
      if(removedMember === 0) throw boom.badRequest('Member not found or already removed');

      await transaction.commit()
      await this.redisModels.WorkspaceMemberRedis.deleteMember(userId, workspaceId, workspaceMemberId);
      return removedMember;
    } catch (error) {
      await transaction.rollback();
      throw boom.badRequest(error.message || 'Failed to remove member');
    }
  }

  async handleRemoveMember(workspaceId, workspaceMemberId, requesterStatus){
    try {
      const memberStatus = await this.findStatusByMemberId(workspaceId, workspaceMemberId);
      if(memberStatus.property_status === 'owner') throw boom.forbidden("You cannot remove the owner");
      if(memberStatus.role === 'admin' && requesterStatus.property_status === 'guest') throw boom.forbidden("You cannot remove an administrator");
      if(memberStatus.userId === requesterStatus.userId) throw boom.forbidden("You cannot remove yourself");

      const removedMember = await this.deleteMember(workspaceId, workspaceMemberId, memberStatus.userId);

      return removedMember;
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.internal('Unexpected error while removing member');
    }
  }

  async leaveTheWorkspace(workspaceId, requesterStatus){
    try {
      const workspaceMembers = await this.findAllMembers(workspaceId);
      if(requesterStatus.property_status === 'owner' || requesterStatus.propertyStatus === 'owner'){
        const removedOwner = await this.handleOwnerExit(workspaceId, requesterStatus, workspaceMembers);
        return removedOwner;
      } else {
        const removedMember = await this.deleteMember(workspaceId, requesterStatus.id, requesterStatus.userId);
        return removedMember;
      }
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.badRequest('Unexpected error while leaving the workspace');
    }
  }

  async handleOwnerExit(workspaceId, requesterStatus, workspaceMembers){
    try {
      if(workspaceMembers.length === 1 && workspaceMembers[0].propertyStatus === 'owner'){
        const workspaceMembersIds = workspaceMembers.map(workspaceMember => workspaceMember.id);
        const removedWorkspace = await this.workspaceService.delete(requesterStatus.userId, workspaceId, workspaceMembersIds);
        return removedWorkspace;
      } else if(workspaceMembers.length > 1){
        const { admins, members } = workspaceMembers.reduce((acc, member) => {
          if(member.propertyStatus !== 'owner'){
            if(member.role === 'admin'){
              acc.admins.push(member);
            } else if(member.role === 'member'){
              acc.members.push(member);
            }
          }
          return acc;
        }, { admins: [], members: [] });

        if(admins.length > 0){
          await this.transferOwnership(workspaceId, requesterStatus.userId, admins[0].userId);
        } else if(members.length > 0){
          await Promise.all([
            this.changeRole(workspaceId, members[0].id, 'admin'),
            this.transferOwnership(workspaceId, requesterStatus.userId, members[0].userId),
          ]);
        }
        const removedOwner = await this.deleteMember(workspaceId, requesterStatus.id, requesterStatus.userId);
        return removedOwner;
      }
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.badRequest('Unexpected error while removing the owner');
    }
  }

  async transferOwnership(workspaceId, currentOwnerId, newOwnerId){
    if(newOwnerId === currentOwnerId){
      throw boom.conflict('New owner cannot be the current owner');
    }
    const transaction = await this.sequelize.transaction();
    try {
      const workspace = await this.models.Workspace.findOne({
        where: { id: workspaceId, userId: currentOwnerId },
        include: {
          model: this.models.User,
          as: 'members',
          attributes: ['id', 'name'],
          where: { id: newOwnerId },
          required: false
        }
      });
      if(!workspace || workspace.members.length === 0){
        throw boom.badRequest('Workspace not found or new owner is incorrect');
      }

      const [updatedRows, [updatedWorkspace]] = await this.models.Workspace.update(
        { userId: newOwnerId },
        { where: { id: workspaceId }, returning: true, transaction },
      );
      if(updatedRows === 0) throw boom.badRequest('Failed to update workspace owner');

      await Promise.all([
        this.models.WorkspaceMember.update(
          { propertyStatus: 'owner', role: 'admin' },
          { where: { workspaceId, userId: newOwnerId }, transaction }
        ),
        this.models.WorkspaceMember.update(
          { propertyStatus: 'guest', role: 'member' },
          { where: { workspaceId, userId: currentOwnerId }, transaction }
        ),
      ]);

      await transaction.commit();
      await this.redisModels.WorkspaceRedis.updateWorkspace(updatedWorkspace);
      return updatedWorkspace;
    } catch (error) {
      await transaction.rollback();
      throw boom.badRequest('Failed to transfer ownership');
    }
  }

  async findAll(workspaceId){
    try {
      const workspaceMembers = await this.models.WorkspaceMember.findAll({
        where: { workspaceId },
        include: [
          { model: this.models.User, as:'user', attributes: ['id', 'name'] },
          { model: this.models.Team, as: 'teams', through: { attributes: [] } },
          { model: this.models.Project, as: 'projects', through: { attributes: [] } }
        ]
      });
      return workspaceMembers;
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.badRequest('Failed to find workspace members');
    }
  }

  async findStatusByMemberId(workspaceId, workspaceMemberId){
    try {
      const status = await this.models.WorkspaceMember.findOne({
        where: { workspaceId, id: workspaceMemberId },
        attributes: ['role', 'property_status', 'userId'],
      });
      if(!status) throw boom.notFound('Workspace member or workspace not found');

      return status.dataValues;
    } catch (error) {
      throw boom.badRequest(error.message || 'Failed to find role');
    }
  }

  async findStatusByUserId(workspaceId, userId){
    try {
      const status = await this.models.WorkspaceMember.findOne({
        where: { workspaceId, userId },
        attributes: ['id', 'role', 'property_status', 'userId'],
      });
      if(!status) throw boom.notFound('Workspace member or workspace not found');

      return status.dataValues;
    } catch (error) {
      throw boom.badRequest(error.message || 'Failed to find role');
    }
  }

  async findAllMembers(workspaceId){
    try {
      const members = await this.models.WorkspaceMember.findAll(
        { where: { workspaceId } }
      );
      if(members.length === 0) throw boom.badRequest('Workspace does not exist');

      const workspaceMembers = members.map(member => member.dataValues);
      return workspaceMembers;
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.badRequest('Unexpected error while finding members');
    }
  }

  async checkWorkspaceMembership(workspaceId, userId){
    try {
      const isMember = await this.models.WorkspaceMember.findOne(
        { where: { workspaceId, userId } }
      );

      return isMember;
    } catch (error) {
      if(error.isBoom) throw error;
      throw boom.badRequest('Failed to check workspace membership');
    }
  }
}

module.exports = WorkspaceMemberService;
