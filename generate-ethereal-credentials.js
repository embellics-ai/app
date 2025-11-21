#!/usr/bin/env node
/**
 * Generate Ethereal Email test account credentials
 * Run: node generate-ethereal-credentials.js
 */

import nodemailer from 'nodemailer';

async function generateEtherealAccount() {
  try {
    console.log('🔧 Generating Ethereal Email test account...\n');

    const testAccount = await nodemailer.createTestAccount();

    console.log('✅ Ethereal Email Account Created!\n');
    console.log('📧 Add these to your .env file:\n');
    console.log('SMTP_HOST=smtp.ethereal.email');
    console.log('SMTP_PORT=587');
    console.log('SMTP_SECURE=false');
    console.log(`SMTP_USER=${testAccount.user}`);
    console.log(`SMTP_PASS=${testAccount.pass}`);
    console.log(`SMTP_FROM_EMAIL=${testAccount.user}`);
    console.log('\n📨 View emails at: https://ethereal.email/');
    console.log(`🔑 Login with: ${testAccount.user} / ${testAccount.pass}\n`);
    console.log('⚠️  Note: These credentials expire after some time of inactivity');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

generateEtherealAccount();
