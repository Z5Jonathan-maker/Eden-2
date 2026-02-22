/**
 * Adam Module - Constants
 * Test suites and configuration
 */

export const TEST_SUITES = {
  backend: [
    { id: 'api-health', name: 'API Health Check', endpoint: '/', method: 'GET' },
    { id: 'api-status', name: 'Status Endpoint', endpoint: '/status', method: 'GET' },
    {
      id: 'integrations-test',
      name: 'Integrations Endpoint',
      endpoint: '/integrations/test',
      method: 'GET',
    },
  ],
  integrations: [
    { id: 'openai-ready', name: 'OpenAI/LLM Service', test: 'openai' },
    { id: 'gamma-ready', name: 'Gamma Service', test: 'gamma' },
    { id: 'signnow-ready', name: 'SignNow Service', test: 'signnow' },
    { id: 'stripe-ready', name: 'Stripe Service', test: 'stripe' },
  ],
  frontend: [
    { id: 'landing-page', name: 'Landing Page Loads', path: '/' },
    { id: 'dashboard', name: 'Dashboard Loads', path: '/dashboard' },
    { id: 'claims-list', name: 'Garden (Claims) Loads', path: '/claims' },
    { id: 'eve-ai', name: 'Eve AI Loads', path: '/eve' },
    { id: 'harvest', name: 'Harvest Map Loads', path: '/canvassing' },
    { id: 'weather', name: 'Weather/DOL Loads', path: '/weather' },
    { id: 'contracts', name: 'Contracts Loads', path: '/contracts' },
  ],
  database: [
    { id: 'db-connection', name: 'MongoDB Connection', test: 'connection' },
    { id: 'db-collections', name: 'Required Collections', test: 'collections' },
  ],
};

export const GATE_CONFIG = {
  clear: { bg: 'bg-green-500', text: 'CLEAR TO RELEASE', icon: 'CheckCircle2' },
  warning: { bg: 'bg-yellow-500', text: 'REVIEW REQUIRED', icon: 'AlertTriangle' },
  blocked: { bg: 'bg-red-500', text: 'RELEASE BLOCKED', icon: 'XCircle' },
};

export const COMPONENT_ICONS = {
  database: 'Database',
  api_routes: 'Wifi',
  integrations: 'Zap',
  data_integrity: 'FileCheck',
  permissions: 'Lock',
};
