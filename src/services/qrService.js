// src/services/qrService.js
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const QR_DIR = path.join(__dirname, '../../public/qr_codes');

// Ensure the QR directory exists
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Generate a QR code PNG for a memberCode and save it to disk.
 * Updates the Member record with the relative path.
 * @param {string} memberCode
 * @param {number} memberId
 * @returns {string} relative path to QR image
 */
async function generate(memberCode, memberId) {
  const filename = `${memberCode}.png`;
  const filePath = path.join(QR_DIR, filename);
  const relativePath = `/qr_codes/${filename}`;

  await QRCode.toFile(filePath, memberCode, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  // Update DB record if memberId provided
  if (memberId) {
    await prisma.member.update({
      where: { id: memberId },
      data: { qrCodePath: relativePath },
    });
  }

  return relativePath;
}

/**
 * Delete old QR file and regenerate.
 * @param {number} memberId
 * @param {string} memberCode
 * @returns {string} new relative path
 */
async function regenerate(memberId, memberCode) {
  const oldFilePath = path.join(QR_DIR, `${memberCode}.png`);
  if (fs.existsSync(oldFilePath)) {
    fs.unlinkSync(oldFilePath);
  }
  return generate(memberCode, memberId);
}

/**
 * Get absolute path to a QR code file.
 * @param {string} memberCode
 * @returns {string}
 */
function getFilePath(memberCode) {
  return path.join(QR_DIR, `${memberCode}.png`);
}

module.exports = { generate, regenerate, getFilePath };
