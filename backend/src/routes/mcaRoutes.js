import express from 'express';
import { mcaAutomation } from '../services/mca/mcaAutomationService.js';
import { db } from '../models/db.js';

const router = express.Router();

/**
 * Save MCA portal credentials
 */
router.post('/credentials', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  mcaAutomation.setCredentials(username, password);
  res.json({ success: true, message: 'MCA credentials saved' });
});

/**
 * Get current automation status
 */
router.get('/status', (req, res) => {
  res.json(mcaAutomation.getStatus());
});

/**
 * Step 1: Launch browser and start login process
 */
router.post('/start-login', async (req, res) => {
  try {
    const result = await mcaAutomation.startLogin();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[MCA Login Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Step 2: User confirms CAPTCHA/OTP done — check login state
 */
router.post('/confirm-login', async (req, res) => {
  try {
    const result = await mcaAutomation.confirmLogin();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Step 3: Fill SPICe+ Part A form from a case
 */
router.post('/fill-spice', async (req, res) => {
  const { caseId, options = {} } = req.body;

  if (!caseId) {
    return res.status(400).json({ error: 'caseId is required' });
  }

  const caseData = db.getCaseById(caseId);
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const fields = db.getExtractedFieldsByCaseId(caseId);
  const directors = fields
    .filter(f => f.field_key === 'director_name')
    .map(f => ({
      name: f.extracted_value,
      pan: fields.find(p => p.field_key === 'director_pan' && p.entity_index === f.entity_index)?.extracted_value,
      dob: fields.find(p => p.field_key === 'director_dob' && p.entity_index === f.entity_index)?.extracted_value,
    }));

  try {
    const result = await mcaAutomation.fillSpicePlusForm(caseData, directors, options);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[MCA Fill Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Take screenshot of current browser page
 */
router.get('/screenshot', async (req, res) => {
  try {
    const screenshot = await mcaAutomation.takeScreenshot();
    res.json({ success: true, screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Close browser
 */
router.post('/close', async (req, res) => {
  try {
    await mcaAutomation.closeBrowser();
    res.json({ success: true, message: 'Browser closed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get cases list for case selector
 */
router.get('/cases', (req, res) => {
  const cases = db.getAllCases();
  const enriched = cases.map(c => {
    const client = db.getClientById(c.client_id);
    const fields = db.getExtractedFieldsByCaseId(c.id);
    const directorNames = fields
      .filter(f => f.field_key === 'director_name')
      .map(f => f.extracted_value);
    return {
      id: c.id,
      caseNumber: c.case_number,
      companyName: c.proposed_company_name || 'Not specified',
      status: c.status,
      clientName: client?.full_name || 'Unknown',
      directors: directorNames,
      createdAt: c.created_at,
    };
  });
  res.json(enriched);
});

export default router;
