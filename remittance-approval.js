// remittance-approval.js
/**
 * Manual Approval Processor for Your Name Wire Remittances
 */

const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, 'pending-remittances.json');

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
  record.status = "Approved for Manual Execution";
  record.approvedAt = new Date().toISOString();
  // User must manually confirm external transfer and update status via UI.
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

  console.log(`\n======================================================`);
  console.log(`SUCCESS: Remittance ${record.transactionId} approved for manual execution.`);
  console.log(`Settlement: ${record.settlementStatus || 'Pending Manual External Settlement'}`);
  console.log(`======================================================\n`);
}

// Command Line Invocation
const args = process.argv.slice(2);
if (args[0] === '--approve' && args[1]) {
  approveRemittance(args[1]);
} else {
  console.log("Usage: node remittance-approval.js --approve <TRANSACTION_ID>");
}