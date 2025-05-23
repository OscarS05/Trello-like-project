const boom = require('@hapi/boom');

const { MAX_FILE_SIZE_IN_BYTES } = require('../../../../utils/constants');

class LoadBackgroundImageUseCase {
  constructor({ projectRepository }, { attachmentQueueService }) {
    this.projectRepository = projectRepository;
    this.attachmentQueueService = attachmentQueueService;
  }

  async execute(fileData, folder, projectId) {
    if (fileData.size > MAX_FILE_SIZE_IN_BYTES) {
      throw boom.badData('The file is too large');
    }

    const addedJob = await this.attachmentQueueService.loadBackgroundImage({
      buffer: fileData.buffer,
      folder,
      projectId,
    });

    if (!addedJob.id || !addedJob.name) {
      throw boom.badData('Something went wrong loading the file in the queue');
    }

    return addedJob;
  }
}

module.exports = LoadBackgroundImageUseCase;
