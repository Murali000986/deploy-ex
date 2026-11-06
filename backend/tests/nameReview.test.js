import assert from 'assert';
import { NameReviewService } from '../src/services/validation/nameReviewService.js';

export async function testNameReview() {
  console.log('  ▸ Testing SPICe+ Part A Name Review Engine...');

  const mockCaseId = 'case_test_namereview';

  // 1. Restricted word detection
  const restrictedResult = NameReviewService.runNameReview(
    mockCaseId,
    'National Banking Advisory Private Limited'
  );
  assert.strictEqual(restrictedResult.hasConflict, true);
  assert(
    restrictedResult.conflictReason.includes('restricted word'),
    'Should flag restricted words like National/Bank'
  );

  // 2. Exact match in MCA registry
  const exactResult = NameReviewService.runNameReview(
    mockCaseId,
    'TATA CONSULTANCY SERVICES LIMITED'
  );
  assert.strictEqual(exactResult.hasConflict, true);
  assert(
    exactResult.conflictReason.includes('Exact match exists in MCA database'),
    'Should flag exact match with active entity'
  );

  // 3. Clean unique proposed name
  const cleanResult = NameReviewService.runNameReview(
    mockCaseId,
    'Vyoma Quantum Systems Private Limited'
  );
  assert.strictEqual(cleanResult.hasConflict, false, 'Unique name should pass preliminary review');
  assert(cleanResult.legalNotice.includes('indicative only'), 'Must include legal disclaimer');

  console.log('    ✔ SPICe+ Part A restricted words, exact conflicts, and clean checks passed');
}
