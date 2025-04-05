const PrismaClient = require('../generated/prisma').PrismaClient;

const prisma = new PrismaClient();

module.exports = prisma;
