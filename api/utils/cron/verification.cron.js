const cron = require('node-cron');
const boom = require('@hapi/boom');

function isVerificationExpired(createdAt, expirationTime){
  const EXPIRATION_TIME = expirationTime;
  const expirationDate = new Date(createdAt).getTime() + EXPIRATION_TIME;
  return Date.now() > expirationDate;
};

module.exports = cron.schedule('0 0 * * *', async () => {
  try {
    const users = await userService.findAll({
      where: {
        isVerified: false,
      },
    });

    let deletedUsersCount = 0;

    for(const user of users){
      if(isVerificationExpired(user.createdAt, 7 * 24 * 60 * 60 * 1000)) {
        await userService.delete(user.id);
        deletedUsersCount++;
      }
    }
    if (deletedUsersCount > 0) {
      return { message: `${deletedUsersCount} unverified accounts removed.` };
    } else {
      return { message: 'No unverified accounts were found to remove.' };
    }
  } catch (error) {
    return boom.internal('Error in cron job', error);
  }
});
