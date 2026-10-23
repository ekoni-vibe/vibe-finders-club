// remittance-generator.js
/**
 * Remittance Staging Engine for Ebisa Wakjira (Ethiopia)
 * Dispatches free Telegram Push Alerts for instant 1-click manual payment approval.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, 'pending-remittances.json');

async function sendTelegramAlert(messageText) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || botToken.includes('your_telegram_bot_token')) {
    console.log("  [TELEGRAM ALERT] Token not configured. Alert logged to console only.");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown"
      })
    });
    console.log("  [TELEGRAM ALERT] Instant mobile notification sent to Telegram.");
  } catch (error) {
    console.error("  [TELEGRAM ERROR]:", error.message);
  }
}

function stageRemittancePayment(deal, finderFeePercentage = 0.02) {
  const finderFeeUSD = Math.round(deal.purchasePrice * finderFeePercentage);
  const transactionId = `REM-${Date.now()}`;
  const beneficiaryName = process.env.BENEFICIARY_NAME || "Ebisa Wakjira";
  const beneficiaryCountry = process.env.BENEFICIARY_COUNTRY || "Ethiopia";

  const remittancePayload = {
    transactionId,
    timestamp: new Date().toISOString(),
    status: "PENDING_HUMAN_APPROVAL",
    settlementStatus: "Pending Manual External Settlement",
    dealReference: deal.address,
    propertyValue: deal.purchasePrice,
    manualIntervention: {
      required: true,
      approvalCommand: `node remittance-approval.js --approve ${transactionId}`
    }
  };

  // Save to pending queue file
  let pending = [];
  if (fs.existsSync(PENDING_FILE)) {
    try { pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch (e) { pending = []; }
  }
  pending.push(remittancePayload);
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

  console.log(`\n======================================================`);
  console.log(`[REMITTANCE STAGED - MANUAL APPROVAL REQUIRED]`);
  console.log(`Transaction ID: ${transactionId}`);
  console.log(`Beneficiary: ${beneficiaryName} (${beneficiaryCountry})`);
  console.log(`Payout Amount: $${finderFeeUSD} USD`);
  console.log(`Status: PENDING_HUMAN_APPROVAL`);
  console.log(`To approve payout, run: node remittance-approval.js --approve ${transactionId}`);
  console.log(`======================================================\n`);

  // Dispatch Mobile Alert via Telegram
  const alertText = `🚨 *DEALROOM REMITTANCE APPROVAL REQUIRED*
*Beneficiary:* ${beneficiaryName} (${beneficiaryCountry}) *Amount:* $${finderFeeUSD} USD
*Property:* ${deal.address}
*Transaction ID:* \`${transactionId}\`

👉 *To Approve, run:*
\`node remittance-approval.js --approve ${transactionId}\``;

  sendTelegramAlert(alertText);

  return remittancePayload;
}

module.exports = { stageRemittancePayment };