// remittance-approval.js
/**
 * Manual Approval Processor for Ebisa Wakjira Wire Remittances
 */

const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, 'pending-remittances.json');
const EXECUTED_FILE = path.join(__dirname, 'executed-remittances.json');

function approveRemittance(transactionId) {
  if (!fs.existsSync(PENDING_FILE)) {
    console.log("No pending remittances found.");
    return;
  }

  let pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
  const recordIndex = pending.findIndex(r => r.transactionId === transactionId || r.confirmationToken === transactionId);

  if (recordIndex === -1) {
    console.log(`Transaction '${transactionId}' not found in pending queue.`);
    return;
  }

  const record = pending[recordIndex];
  record.status = "APPROVED_AND_EXECUTED";
  record.approvedAt = new Date().toISOString();
  record.executionWireReference = `WIRE-ETH-${Math.floor(100000 + Math.random() * 900000)}`;

  // Move from pending to executed queue
  pending.splice(recordIndex, 1);
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

  let executed = [];
  if (fs.existsSync(EXECUTED_FILE)) {
    try { executed = JSON.parse(fs.readFileSync(EXECUTED_FILE, 'utf8')); } catch (e) { executed = []; }
  }
  executed.push(record);
  fs.writeFileSync(EXECUTED_FILE, JSON.stringify(executed, null, 2));

  console.log(`\n======================================================`);
  console.log(`SUCCESS: Remittance ${record.transactionId} APPROVED & EXECUTED!`);
  console.log(`Beneficiary: ${record.payoutDetails.beneficiaryName} (${record.payoutDetails.beneficiaryCountry})`);
  console.log(`Payout Amount: $${record.payoutDetails.amountUSD} USD`);
  console.log(`Wire Reference: ${record.executionWireReference}`);
  console.log(`======================================================\n`);
}

// Command Line Invocation
const args = process.argv.slice(2);
if (args[0] === '--approve' && args[1]) {
  approveRemittance(args[1]);
} else {
  console.log("Usage: node remittance-approval.js --approve <TRANSACTION_ID>");
}