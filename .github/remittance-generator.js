// remittance-generator.js
// Automated Offshore Invoicing & Foreign Wire Payload Generator

function generateOffshoreInvoice(dealDetails, consultantInfo, localBankInfo) {
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  
  const invoicePayload = {
    invoiceHeader: {
      invoiceNumber: invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      serviceCategory: "Offshore Real Estate Lead Generation & Market Consultation Services",
      taxStatus: "Zero-Rated Foreign Service Export"
    },
    biller: {
      companyName: consultantInfo.fullName,
      address: consultantInfo.address,
      country: "Ethiopia"
    },
    client: {
      closingEntity: dealDetails.titleCompanyOrBuyer,
      propertyRef: dealDetails.propertyAddress,
      assignmentFeeUsd: dealDetails.referralFeeUSD
    },
    bankingSWIFTRouting: {
      beneficiaryName: localBankInfo.fullName,
      accountNumber: localBankInfo.accountNumber,
      swiftCode: localBankInfo.swiftCode,
      bankName: localBankInfo.bankName,
      branchCity: "Addis Ababa, Ethiopia",
      intermediaryBank: localBankInfo.intermediaryBank || "Citibank N.A., New York (Standard USD Rail)",
      paymentPurposeCode: "Export of IT & Professional Consulting Services"
    }
  };

  console.log("=================================================================");
  console.log("       OFFSHORE REMITTANCE INVOICE & SWIFT PAYLOAD GENERATED     ");
  console.log("=================================================================\n");
  console.log(JSON.stringify(invoicePayload, null, 2));

  return invoicePayload;
}

// Sample Invocation
generateOffshoreInvoice(
  {
    titleCompanyOrBuyer: "First National Title & Escrow LLC",
    propertyAddress: "13521 West Ave, Cleveland, OH 44111",
    referralFeeUSD: 3500.00
  },
  {
    fullName: "Ebisa Diriba",
    address: "Bole Sub-City, Addis Ababa, Ethiopia"
  },
  {
    fullName: "Ebisa Diriba",
    accountNumber: "1000123456789",
    bankName: "Commercial Bank of Ethiopia (CBE)",
    swiftCode: "CBETETAA",
    intermediaryBank: "Citibank N.A., New York"
  }
);