import { db } from '../../models/db.js';

// Official restricted words under Companies (Incorporation) Rules
const RESTRICTED_WORDS = [
  'NATIONAL', 'FEDERAL', 'BUREAU', 'CENTRAL', 'RESERVE BANK', 'RBI',
  'MINISTRY', 'COURT', 'JUDICIAL', 'STATE', 'GOVERNMENT', 'MUNICIPAL',
  'BANK', 'BANKING', 'INSURANCE', 'STOCK EXCHANGE', 'COMMISSION'
];

// Sample existing MCA registered entities for simulation & testing
const REGISTERED_MCA_ENTITIES = [
  'APEX TECHNOLOGIES PRIVATE LIMITED',
  'TATA CONSULTANCY SERVICES LIMITED',
  'RELIANCE INDUSTRIES LIMITED',
  'INFOSYS LIMITED',
  'WIPRO ENTERPRISES PRIVATE LIMITED',
  'HDFC FINANCIAL SERVICES LIMITED',
  'NEXUS DIGITAL SOLUTIONS PRIVATE LIMITED',
  'ZENITH CLOUD SYSTEMS PRIVATE LIMITED'
];

// Registered Trademarks (Class 9, 35, 42)
const TRADEMARK_REGISTRY = [
  { name: 'APEX', class: '42', owner: 'Apex Global Inc.' },
  { name: 'TATA', class: '35', owner: 'Tata Sons Pvt Ltd' },
  { name: 'INFOSYS', class: '42', owner: 'Infosys Ltd' }
];

/**
 * Calculates string similarity (Dice's Coefficient algorithm)
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = s => {
    const bigrams = new Set();
    for (let i = 0; i < s.length - 1; i++) bigrams.add(s.substring(i, i + 2));
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const item of b1) if (b2.has(item)) intersection++;

  return (2.0 * intersection) / (b1.size + b2.size);
}

export class NameReviewService {
  /**
   * Run comprehensive SPICe+ Part A checks
   */
  static runNameReview(caseId, proposedName) {
    if (!proposedName) {
      throw new Error('Proposed company name is required for review');
    }

    const cleanName = proposedName.trim().toUpperCase();
    const results = [];
    const conflictReasons = [];

    // 1. Restricted Words Check
    const foundRestricted = RESTRICTED_WORDS.filter(w => cleanName.includes(w));
    if (foundRestricted.length > 0) {
      const reason = `Contains restricted word(s): ${foundRestricted.join(', ')} (Requires Central Govt approval)`;
      conflictReasons.push(reason);
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'RESTRICTED_WORDS',
          checkResult: 'RESTRICTED_WORD',
          matchScore: 1.0,
          notes: reason
        })
      );
    } else {
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'RESTRICTED_WORDS',
          checkResult: 'PASSED',
          matchScore: 0.0,
          notes: 'No restricted words detected under Companies Incorporation Rules'
        })
      );
    }

    // 2. MCA Company Name Registry Check
    let highestMcaScore = 0.0;
    let conflictingMcaEntity = null;

    for (const entity of REGISTERED_MCA_ENTITIES) {
      if (cleanName === entity) {
        highestMcaScore = 1.0;
        conflictingMcaEntity = entity;
        break;
      }
      const sim = calculateSimilarity(cleanName, entity);
      if (sim > highestMcaScore) {
        highestMcaScore = sim;
        conflictingMcaEntity = entity;
      }
    }

    if (highestMcaScore === 1.0) {
      const reason = `Exact match exists in MCA database: '${conflictingMcaEntity}'`;
      conflictReasons.push(reason);
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'MCA_REGISTRY',
          checkResult: 'EXACT_MATCH',
          matchScore: 1.0,
          conflictingEntityName: conflictingMcaEntity,
          notes: reason
        })
      );
    } else if (highestMcaScore >= 0.75) {
      const reason = `High phonetic / spelling similarity (${Math.round(highestMcaScore * 100)}%) with '${conflictingMcaEntity}'`;
      conflictReasons.push(reason);
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'MCA_REGISTRY',
          checkResult: 'SIMILAR_CONFLICT',
          matchScore: parseFloat(highestMcaScore.toFixed(2)),
          conflictingEntityName: conflictingMcaEntity,
          notes: reason
        })
      );
    } else {
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'MCA_REGISTRY',
          checkResult: 'PASSED',
          matchScore: parseFloat(highestMcaScore.toFixed(2)),
          conflictingEntityName: conflictingMcaEntity,
          notes: 'No conflicting active MCA entity found in initial registry search'
        })
      );
    }

    // 3. Trademark Registry Check
    const matchedTm = TRADEMARK_REGISTRY.find(tm => cleanName.includes(tm.name));
    if (matchedTm) {
      const reason = `Potential Trademark conflict in Class ${matchedTm.class} owned by '${matchedTm.owner}'`;
      conflictReasons.push(reason);
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'TRADEMARK_DB',
          checkResult: 'SIMILAR_CONFLICT',
          matchScore: 0.85,
          conflictingEntityName: `${matchedTm.name} (Class ${matchedTm.class})`,
          notes: reason
        })
      );
    } else {
      results.push(
        db.addNameCheck({
          caseId,
          proposedName: cleanName,
          checkSource: 'TRADEMARK_DB',
          checkResult: 'PASSED',
          matchScore: 0.0,
          notes: 'No identical registered trademark in Nice Classes 9/35/42'
        })
      );
    }

    // Disclaimer
    const legalNotice =
      'DISCLAIMER: Automated name search is indicative only. MCA CRC officer has sole legal authority to grant name reservation under Section 4(4) of Companies Act, 2013.';

    return {
      proposedName: cleanName,
      passed: conflictReasons.length === 0,
      hasConflict: conflictReasons.length > 0,
      conflictReason: conflictReasons.join('; '),
      conflictReasons,
      results,
      legalNotice
    };
  }
}
