// src/utils/memberCode.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generates a unique member code in the format GYM-XXXXXX
 * where X is a random alphanumeric character.
 */
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GYM-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a unique member code, ensuring no collision in DB.
 */
async function createUniqueMemberCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateCode();
    const found = await prisma.member.findUnique({ where: { memberCode: code } });
    exists = !!found;
  }
  return code;
}

module.exports = { createUniqueMemberCode };
