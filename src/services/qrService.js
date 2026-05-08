// src/services/qrService.js
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const QR_DIR = path.join(__dirname, '../../public/qr_codes');

// We no longer need to check for QR_DIR because we are using Base64 Data URLs for QR codes.

/**
 * Generate a QR code Data URL (Base64) for a memberCode.
 * Updates the Member record with the Base64 string.
 * @param {string} memberCode
 * @param {number} memberId
 * @returns {string} Data URL (Base64)
 */
async function generate(memberCode, memberId) {
  const dataUrl = await QRCode.toDataURL(memberCode, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  });

  // Update DB record if memberId provided
  if (memberId) {
    await prisma.member.update({
      where: { id: memberId },
      data: { qrCodePath: dataUrl },
    });
  }

  return dataUrl;
}

/**
 * Regenerate QR code Data URL.
 * @param {number} memberId
 * @param {string} memberCode
 * @returns {string} new Data URL
 */
async function regenerate(memberId, memberCode) {
  return generate(memberCode, memberId);
}

/**
 * Returns null as we no longer use physical files.
 */
function getFilePath(memberCode) {
  return null;
}

module.exports = { generate, regenerate, getFilePath };
