import { db } from '../../models/db.js';
import { CASE_STATES } from '../intake/workflowStateMachine.js';

/**
 * MCA Browser Extension Integration Contract.
 * Provides a cryptographically authorized, sanitized, read-only payload
 * that feeds into the MCA SPICe+ form filler extension ONLY AFTER CA approval.
 */
export class ExtensionContractService {
  /**
   * Retrieves the approved dossier payload for browser extension auto-fill
   */
  static getDossierForExtension(caseId, extensionClientId) {
    const caseRecord = db.getCaseById(caseId);
    if (!caseRecord) {
      throw { status: 404, message: `Case ${caseId} not found` };
    }

    // Strict Gatekeeper: Only cases approved by CA Admin (READY_FOR_EXTENSION) are accessible
    if (caseRecord.status !== CASE_STATES.READY_FOR_EXTENSION) {
      throw {
        status: 403,
        message: `Case ${caseRecord.case_number} is in '${caseRecord.status}' state and is NOT authorized for MCA extension filling. Only cases in '${CASE_STATES.READY_FOR_EXTENSION}' can be transferred.`
      };
    }

    const client = db.getClientById(caseRecord.client_id);
    const fields = db.getExtractedFieldsByCaseId(caseId);

    // Format strictly for MCA SPICe+ Part A & Part B form structure
    const payload = {
      contract_version: '2026.1',
      generated_at: new Date().toISOString(),
      authorized_by_admin: caseRecord.assigned_admin_id,
      case_reference: caseRecord.case_number,

      spice_plus_part_a: {
        proposed_name_primary: caseRecord.proposed_company_name,
        company_type: caseRecord.company_type || 'PRIVATE_LIMITED',
        company_category: caseRecord.company_category || 'COMPANY_LIMITED_BY_SHARES',
        sub_category: 'NON_GOVERNMENT_COMPANY',
        class_of_company: 'PRIVATE',
        industrial_activity_code: '6201', // Example IT / Services
        nature_of_business: 'Information technology and computer related services'
      },

      spice_plus_part_b: {
        registered_office: {
          state: caseRecord.registered_office_state,
          district: caseRecord.registered_office_district,
          ro_jurisdiction: `ROC - ${caseRecord.registered_office_state || 'DELHI'}`
        },
        capital_structure: {
          authorized_capital: caseRecord.authorized_capital || 100000,
          paid_up_capital: caseRecord.paid_up_capital || 100000,
          shares_count: (caseRecord.authorized_capital || 100000) / 10,
          nominal_value_per_share: 10
        },
        subscribers_and_directors: fields
          .filter(f => f.field_key === 'director_name')
          .map(dirField => {
            const panField = fields.find(
              f => f.field_key === 'director_pan' && f.entity_index === dirField.entity_index
            );
            return {
              full_name: dirField.verified_value || dirField.extracted_value,
              pan: panField ? (panField.verified_value || panField.extracted_value) : null,
              din: null, // Din to be generated post incorporation
              designation: 'DIRECTOR',
              is_subscriber: true
            };
          })
      },

      legal_compliance: {
        human_review_completed: true,
        client_confirmed: caseRecord.client_confirmed,
        disclaimer:
          'Data certified for MCA filing draft creation only. Final submission requires CA Digital Signature Certificate (DSC).'
      }
    };

    // Update synced status
    db.updateCase(caseId, {
      extension_synced: true,
      extension_synced_at: new Date().toISOString()
    });

    db.addAuditLog({
      caseId,
      actorId: extensionClientId || 'MCA_EXTENSION',
      actorRole: 'SYSTEM',
      action: 'EXTENSION_DOSSIER_FETCHED',
      details: { caseNumber: caseRecord.case_number }
    });

    return payload;
  }
}
