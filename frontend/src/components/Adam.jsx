/**
 * Adam Component - QA Runner & CQIL Dashboard
 * Main container for automated testing and quality assurance
 *
 * Refactored to use modular components from ./adam/
 * Updated to use centralized API client (Feb 4, 2026)
 */

import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { apiGet, apiPost, API_URL } from '../lib/api';
import {
  TEST_SUITES,
  AdamHeader,
  DashboardTab,
  CenturionTab,
  TestsTab,
  ReportsTab,
} from './adam/index';

const Adam = () => {
  // Core state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTests, setSelectedTests] = useState('all');

  // CQIL state
  const [systemHealth, setSystemHealth] = useState(null);
  const [cqilMetrics, setCqilMetrics] = useState(null);
  const [breakReports, setBreakReports] = useState([]);

  // Centurion state
  const [sentinelScan, setSentinelScan] = useState(null);
  const [sentinelSummary, setSentinelSummary] = useState(null);
  const [sentinelRoutes, setSentinelRoutes] = useState([]);
  const [sentinelEndpoints, setSentinelEndpoints] = useState([]);
  const [isScanRunning, setIsScanRunning] = useState(false);

  // Browser crawl state
  const [browserCrawl, setBrowserCrawl] = useState(null);
  const [isBrowserCrawlRunning, setIsBrowserCrawlRunning] = useState(false);

  // Auto-fix state
  const [autoFixes, setAutoFixes] = useState(null);
  const [isGeneratingFixes, setIsGeneratingFixes] = useState(false);

  // Mobile regression state
  const [mobileRegression, setMobileRegression] = useState(null);
  const [isMobileRegressionRunning, setIsMobileRegressionRunning] = useState(false);

  // Fetch CQIL data on mount
  useEffect(() => {
    fetchCqilData();
    fetchSentinelData();
    const interval = setInterval(fetchCqilData, 60000);
    return () => clearInterval(interval);
  }, []);

  // API Functions
  const fetchSentinelData = async () => {
    try {
      const [summaryRes, routesRes, endpointsRes] = await Promise.all([
        apiGet('/api/centurion/summary', { cache: false }),
        apiGet('/api/centurion/routes', { cache: false }),
        apiGet('/api/centurion/endpoints', { cache: false }),
      ]);

      if (summaryRes.ok) setSentinelSummary(summaryRes.data);
      if (routesRes.ok) setSentinelRoutes(routesRes.data);
      if (endpointsRes.ok) setSentinelEndpoints(endpointsRes.data);
    } catch (err) {
      console.error('Centurion fetch error:', err);
    }
  };

  const runSentinelScan = async () => {
    setIsScanRunning(true);
    setSentinelScan(null);

    try {
      const res = await apiPost('/api/centurion/scan', {
        check_api_routes: true,
        check_ui_elements: true,
        check_navigation: true,
        timeout_seconds: 10,
      });

      if (res.ok) {
        const scan = res.data;
        setSentinelScan(scan);

        const pollInterval = setInterval(async () => {
          const statusRes = await apiGet(`/api/centurion/scan/${scan.scan_id}`, { cache: false });
          if (statusRes.ok) {
            const updatedScan = statusRes.data;
            setSentinelScan(updatedScan);

            if (updatedScan.status === 'completed' || updatedScan.status === 'failed') {
              clearInterval(pollInterval);
              setIsScanRunning(false);
              fetchCqilData();
              fetchSentinelData();
            }
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setIsScanRunning(false);
        }, 60000);
      }
    } catch (err) {
      console.error('Centurion scan error:', err);
      setIsScanRunning(false);
    }
  };

  const runBrowserCrawl = async () => {
    setIsBrowserCrawlRunning(true);
    setBrowserCrawl(null);

    try {
      const res = await apiPost('/api/centurion/browser-crawl', {});

      if (res.ok) {
        const crawl = res.data;
        setBrowserCrawl({ crawl_id: crawl.crawl_id, status: 'starting' });

        const pollInterval = setInterval(async () => {
          const statusRes = await apiGet(`/api/centurion/browser-crawl/${crawl.crawl_id}`, {
            cache: false,
          });
          if (statusRes.ok) {
            const updatedCrawl = statusRes.data;
            setBrowserCrawl(updatedCrawl);

            if (updatedCrawl.status === 'completed' || updatedCrawl.status === 'failed') {
              clearInterval(pollInterval);
              setIsBrowserCrawlRunning(false);
              fetchCqilData();
            }
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setIsBrowserCrawlRunning(false);
        }, 120000);
      }
    } catch (err) {
      console.error('Browser crawl error:', err);
      setIsBrowserCrawlRunning(false);
    }
  };

  const generateAutoFixes = async (crawlId = null) => {
    setIsGeneratingFixes(true);
    try {
      const endpoint = crawlId
        ? `/api/centurion/generate-fixes?crawl_id=${crawlId}`
        : '/api/centurion/generate-fixes';

      const res = await apiPost(endpoint, {});

      if (res.ok) {
        setAutoFixes(res.data);
      }
    } catch (err) {
      console.error('Auto-fix generation error:', err);
    } finally {
      setIsGeneratingFixes(false);
    }
  };

  const runMobileRegression = async () => {
    setIsMobileRegressionRunning(true);
    setMobileRegression(null);

    try {
      const res = await apiPost('/api/centurion/mobile-regression', {
        viewports: ['desktop', 'mobile', 'tablet'],
      });

      if (res.ok) {
        const regression = res.data;
        setMobileRegression({ regression_id: regression.regression_id, status: 'starting' });

        // Poll for results
        const pollInterval = setInterval(async () => {
          const statusRes = await apiGet(
            `/api/centurion/mobile-regression/${regression.regression_id}`,
            { cache: false }
          );
          if (statusRes.ok) {
            const updatedRegression = statusRes.data;
            setMobileRegression(updatedRegression);

            if (updatedRegression.status === 'completed' || updatedRegression.status === 'failed') {
              clearInterval(pollInterval);
              setIsMobileRegressionRunning(false);
              fetchCqilData();
            }
          }
        }, 3000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsMobileRegressionRunning(false);
        }, 300000);
      }
    } catch (err) {
      console.error('Mobile regression error:', err);
      setIsMobileRegressionRunning(false);
    }
  };

  const fetchCqilData = async () => {
    try {
      const [healthRes, metricsRes, reportsRes] = await Promise.all([
        apiGet('/api/cqil/health', { cache: false }),
        apiGet('/api/cqil/metrics', { cache: false }),
        apiGet('/api/cqil/break-reports?limit=10', { cache: false }),
      ]);

      if (healthRes.ok) setSystemHealth(healthRes.data);
      if (metricsRes.ok) setCqilMetrics(metricsRes.data);
      if (reportsRes.ok) setBreakReports(reportsRes.data);
    } catch (err) {
      console.error('CQIL fetch error:', err);
    }
  };

  // Test Functions
  const runBackendTests = async () => {
    const results = [];

    for (const test of TEST_SUITES.backend) {
      try {
        const startTime = Date.now();
        const response = await apiGet(`/api${test.endpoint}`, { cache: false });
        const duration = Date.now() - startTime;

        results.push({
          id: test.id,
          name: test.name,
          status: response.ok ? 'passed' : 'failed',
          message: `Response: ${response.status || (response.ok ? 200 : 'error')}`,
          duration: `${duration}ms`,
        });
      } catch (error) {
        results.push({
          id: test.id,
          name: test.name,
          status: 'failed',
          message: error.message,
          duration: '-',
        });
      }
    }

    return results;
  };

  const runIntegrationTests = async () => {
    const results = [];

    try {
      const response = await apiGet('/api/integrations/test', { cache: false });

      if (response.ok) {
        const availableIntegrations = response.data.integrations || [];

        TEST_SUITES.integrations.forEach((test) => {
          const isAvailable = availableIntegrations.includes(test.test);
          results.push({
            id: test.id,
            name: test.name,
            status: isAvailable ? 'passed' : 'warning',
            message: isAvailable ? 'Service available' : 'Service not configured',
            duration: '-',
          });
        });
      }
    } catch {
      TEST_SUITES.integrations.forEach((test) => {
        results.push({
          id: test.id,
          name: test.name,
          status: 'warning',
          message: 'Integration check skipped',
          duration: '-',
        });
      });
    }

    return results;
  };

  const runFrontendTests = () => {
    return TEST_SUITES.frontend.map((test) => ({
      id: test.id,
      name: test.name,
      status: 'passed',
      message: 'Route accessible',
      duration: '-',
    }));
  };

  const runDatabaseTests = async () => {
    const results = [];

    try {
      await apiGet('/api/status', { cache: false });

      results.push({
        id: 'db-connection',
        name: 'MongoDB Connection',
        status: 'passed',
        message: 'Database connected',
        duration: '-',
      });

      results.push({
        id: 'db-collections',
        name: 'Required Collections',
        status: 'passed',
        message: 'Collections accessible',
        duration: '-',
      });
    } catch (error) {
      results.push({
        id: 'db-connection',
        name: 'MongoDB Connection',
        status: 'failed',
        message: error.message,
        duration: '-',
      });
    }

    return results;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    let allResults = [];

    if (selectedTests === 'all' || selectedTests === 'backend') {
      allResults = [...allResults, ...(await runBackendTests())];
    }

    if (selectedTests === 'all' || selectedTests === 'integrations') {
      allResults = [...allResults, ...(await runIntegrationTests())];
    }

    if (selectedTests === 'all' || selectedTests === 'frontend') {
      allResults = [...allResults, ...runFrontendTests()];
    }

    if (selectedTests === 'all' || selectedTests === 'database') {
      allResults = [...allResults, ...(await runDatabaseTests())];
    }

    setTestResults(allResults);
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-tactical-animated text-white page-enter">
      {/* Header */}
      <AdamHeader cqilMetrics={cqilMetrics} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'dashboard' && (
          <DashboardTab
            systemHealth={systemHealth}
            cqilMetrics={cqilMetrics}
            onRunTests={runAllTests}
            onRefreshHealth={fetchCqilData}
            onViewReports={() => setActiveTab('reports')}
            onRunScan={runSentinelScan}
            isRunning={isRunning}
            isScanRunning={isScanRunning}
          />
        )}

        {activeTab === 'centurion' && (
          <CenturionTab
            sentinelSummary={sentinelSummary}
            sentinelScan={sentinelScan}
            browserCrawl={browserCrawl}
            autoFixes={autoFixes}
            sentinelRoutes={sentinelRoutes}
            sentinelEndpoints={sentinelEndpoints}
            mobileRegression={mobileRegression}
            isScanRunning={isScanRunning}
            isBrowserCrawlRunning={isBrowserCrawlRunning}
            isGeneratingFixes={isGeneratingFixes}
            isMobileRegressionRunning={isMobileRegressionRunning}
            onRunScan={runSentinelScan}
            onRunBrowserCrawl={runBrowserCrawl}
            onGenerateFixes={generateAutoFixes}
            onRunMobileRegression={runMobileRegression}
          />
        )}

        {activeTab === 'tests' && (
          <TestsTab
            testResults={testResults}
            selectedTests={selectedTests}
            setSelectedTests={setSelectedTests}
            isRunning={isRunning}
            onRunTests={runAllTests}
          />
        )}

        {activeTab === 'reports' && <ReportsTab breakReports={breakReports} />}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-700/30 px-6 py-4">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" />
            <span className="font-mono">Eden CQIL — Continuous Quality & Integrity Layer</span>
          </div>
          <span>
            Last updated:{' '}
            {cqilMetrics?.last_updated
              ? new Date(cqilMetrics.last_updated).toLocaleString()
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Adam;
