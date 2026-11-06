import { testWebhookVerification, testWebhookIdempotency } from './webhook.test.js';
import { testClientIntakeWorkflow } from './intake.test.js';
import { testDocumentPipeline } from './documentPipeline.test.js';
import { testNameReview } from './nameReview.test.js';
import { testRbacAndPermissions } from './rbac.test.js';

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING LEDGERLY AUTOMATION TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  const suites = [
    { name: 'Webhook Verification & Idempotency', fn: async () => { await testWebhookVerification(); await testWebhookIdempotency(); } },
    { name: 'Client Intake Workflow & State Machine', fn: testClientIntakeWorkflow },
    { name: 'Document OCR, LLM Schema & Anomaly Rejection', fn: testDocumentPipeline },
    { name: 'SPICe+ Part A Name Review Engine', fn: testNameReview },
    { name: 'Role-Based Access Control (RBAC) & Extension Security', fn: testRbacAndPermissions }
  ];

  for (const suite of suites) {
    try {
      console.log(`[TEST SUITE] ${suite.name}`);
      await suite.fn();
      passed++;
      console.log(`Status: PASSED\n`);
    } catch (err) {
      failed++;
      console.error(`Status: FAILED: ${err.message}\n`, err.stack);
    }
  }

  console.log('=============================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
