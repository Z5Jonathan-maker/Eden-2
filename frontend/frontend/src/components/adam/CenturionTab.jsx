/**
 * Adam Module - Centurion Tab Component
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Radar, Globe, Eye, Wrench, Loader2, CheckCircle, XCircle, 
  Clock, AlertCircle, AlertTriangle, Route, Lock, Code, Copy,
  Smartphone, Monitor, Tablet, Play
} from 'lucide-react';

// Scan Results Card Component
const ScanResultsCard = ({ sentinelScan }) => {
  if (!sentinelScan) return null;

  return (
    <Card className="bg-white border-purple-500/30 border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Radar className="w-5 h-5 text-purple-400" />
            API Scan: {sentinelScan.scan_id}
          </CardTitle>
          <Badge className={
            sentinelScan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            sentinelScan.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
            'bg-red-500/20 text-red-400'
          }>
            {sentinelScan.status?.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {sentinelScan.status === 'running' && (
          <div className="mb-4">
            <Progress 
              value={(sentinelScan.routes_checked / (sentinelScan.total_routes || 1)) * 100} 
              className="h-2" 
            />
            <p className="text-xs text-gray-500 mt-1">
              Checking {sentinelScan.routes_checked} of {sentinelScan.total_routes} endpoints...
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{sentinelScan.total_routes}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">{sentinelScan.passed}</p>
            <p className="text-xs text-gray-500">Passed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{sentinelScan.failed}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">{sentinelScan.break_reports_generated}</p>
            <p className="text-xs text-gray-500">Break Reports</p>
          </div>
        </div>

        {/* Route Results */}
        {sentinelScan.route_results?.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto">
            <p className="text-sm font-medium text-gray-600 mb-2">Endpoint Results</p>
            <div className="space-y-1">
              {sentinelScan.route_results.map((result, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    result.status === 'pass' ? 'bg-green-500/10' :
                    result.status === 'fail' ? 'bg-red-500/10' :
                    'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'pass' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : result.status === 'fail' ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-gray-300">{result.method} {result.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.response_code && (
                      <Badge variant="outline" className="text-xs">
                        {result.response_code}
                      </Badge>
                    )}
                    {result.latency_ms && (
                      <span className="text-xs text-gray-500">{result.latency_ms.toFixed(0)}ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Browser Crawl Results Card Component
const BrowserCrawlCard = ({ browserCrawl }) => {
  if (!browserCrawl?.result) return null;

  return (
    <Card className="bg-white border-blue-500/30 border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Eye className="w-5 h-5 text-blue-400" />
            Browser UI Crawl: {browserCrawl.crawl_id}
          </CardTitle>
          <Badge className={
            browserCrawl.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            browserCrawl.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
            'bg-red-500/20 text-red-400'
          }>
            {browserCrawl.status?.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {browserCrawl.status === 'running' && (
          <div className="mb-4 flex items-center gap-2 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Crawling frontend routes with headless browser...</span>
          </div>
        )}
        
        <div className="grid grid-cols-5 gap-4 text-center mb-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{browserCrawl.result.routes_checked || 0}</p>
            <p className="text-xs text-gray-500">Routes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">{browserCrawl.result.routes_passed || 0}</p>
            <p className="text-xs text-gray-500">Passed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{browserCrawl.result.routes_failed || 0}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">{browserCrawl.result.total_elements_found || 0}</p>
            <p className="text-xs text-gray-500">Elements Found</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{browserCrawl.result.total_elements_missing || 0}</p>
            <p className="text-xs text-gray-500">Missing</p>
          </div>
        </div>

        {/* Critical Failures */}
        {browserCrawl.result.critical_failures?.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Critical Failures ({browserCrawl.result.critical_failures.length})
            </p>
            <div className="space-y-1">
              {browserCrawl.result.critical_failures.map((failure, idx) => (
                <div key={idx} className="text-sm text-red-300">
                  <span className="text-gray-500">{failure.route}</span> → {failure.element}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dead Ends */}
        {browserCrawl.result.dead_ends_found?.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Dead Ends Found ({browserCrawl.result.dead_ends_found.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {browserCrawl.result.dead_ends_found.map((route, idx) => (
                <Badge key={idx} variant="outline" className="text-yellow-400 border-yellow-500/30">
                  {route}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Auto-Fixes Card Component
const AutoFixesCard = ({ autoFixes, isGenerating, onGenerateFixes }) => {
  if (!autoFixes) return null;

  return (
    <Card className="bg-white border-orange-500/30 border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Wrench className="w-5 h-5 text-orange-400" />
            Auto-Generated Fixes
          </CardTitle>
          <Badge className="bg-orange-500/20 text-orange-400">
            {autoFixes.fixes?.length || 0} Suggestions
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {autoFixes.fixes?.length > 0 ? (
          <div className="space-y-3">
            {autoFixes.fixes.map((fix, idx) => (
              <div key={idx} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {fix.severity || 'P2'}
                    </Badge>
                    <span className="text-gray-900 font-medium">{fix.issue}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900"
                    onClick={() => navigator.clipboard.writeText(fix.code || fix.suggestion)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-2">{fix.suggestion}</p>
                {fix.code && (
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono text-green-400 overflow-x-auto">
                    <pre>{fix.code}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-600">
            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No fixes generated yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Route Registry Component
const RouteRegistry = ({ sentinelRoutes, sentinelEndpoints }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
          <Route className="w-5 h-5 text-blue-400" />
          Frontend Routes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sentinelRoutes.map((route, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <div>
                <p className="text-gray-900 text-sm">{route.name}</p>
                <p className="text-gray-500 text-xs">{route.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-gray-600">
                  {route.module}
                </Badge>
                {route.auth_required && (
                  <Lock className="w-3 h-3 text-yellow-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
          <Globe className="w-5 h-5 text-green-400" />
          API Endpoints
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sentinelEndpoints.map((endpoint, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <div>
                <p className="text-gray-900 text-sm">{endpoint.name}</p>
                <p className="text-gray-500 text-xs">{endpoint.method} {endpoint.path}</p>
              </div>
              {endpoint.auth_required && (
                <Lock className="w-3 h-3 text-yellow-400" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Mobile Regression Card Component
const MobileRegressionCard = ({ onRunMobileRegression, mobileRegression, isMobileRegressionRunning }) => {
  const viewportIcons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone
  };

  return (
    <Card className="bg-white border-cyan-500/30 border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Mobile Regression Testing
          </CardTitle>
          <Button
            onClick={onRunMobileRegression}
            disabled={isMobileRegressionRunning}
            className="bg-cyan-600 hover:bg-cyan-700"
            size="sm"
          >
            {isMobileRegressionRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Regression
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mobileRegression?.results ? (
          <div className="space-y-4">
            {/* Viewport Results Grid */}
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(mobileRegression.results).map(([viewport, result]) => {
                const Icon = viewportIcons[viewport] || Monitor;
                return (
                  <div key={viewport} className="bg-gray-800 rounded-lg p-4 text-center">
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900 capitalize">{viewport}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs">
                        <span className="text-green-400">{result.routes_passed || 0}</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-red-400">{result.routes_failed || 0}</span>
                      </p>
                      <p className="text-xs text-gray-500">passed/failed</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Issues */}
            {mobileRegression.mobile_issues?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Mobile-Specific Issues ({mobileRegression.mobile_issues.length})
                </p>
                <div className="space-y-2">
                  {mobileRegression.mobile_issues.slice(0, 5).map((issue, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{issue.route}: {issue.issue}</span>
                      <Badge className={
                        issue.severity === 'P0' ? 'bg-red-500/20 text-red-400' :
                        issue.severity === 'P1' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-600'
                      }>
                        {issue.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <div className="flex justify-center gap-4 mb-4">
              <Monitor className="w-8 h-8 opacity-50" />
              <Tablet className="w-8 h-8 opacity-50" />
              <Smartphone className="w-8 h-8 opacity-50" />
            </div>
            <p>Test your app across Desktop, Tablet, and Mobile viewports</p>
            <p className="text-sm text-gray-500 mt-2">Identifies responsive design issues automatically</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Centurion Tab Component
export const CenturionTab = ({
  sentinelSummary,
  sentinelScan,
  browserCrawl,
  autoFixes,
  sentinelRoutes,
  sentinelEndpoints,
  mobileRegression,
  isScanRunning,
  isBrowserCrawlRunning,
  isGeneratingFixes,
  isMobileRegressionRunning,
  onRunScan,
  onRunBrowserCrawl,
  onGenerateFixes,
  onRunMobileRegression
}) => {
  return (
    <div className="space-y-6">
      {/* Centurion Header */}
      <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center">
                <Radar className="w-8 h-8 text-gray-900" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">The Centurion</h2>
                <p className="text-gray-600">Button/Link/Route Verifier — Detects dead ends & broken handlers</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={onRunScan}
                disabled={isScanRunning || isBrowserCrawlRunning}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isScanRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    API Scan...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    API Scan
                  </>
                )}
              </Button>
              <Button 
                onClick={onRunBrowserCrawl}
                disabled={isScanRunning || isBrowserCrawlRunning}
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500/20"
              >
                {isBrowserCrawlRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Crawling...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    UI Crawl
                  </>
                )}
              </Button>
              <Button 
                onClick={() => onGenerateFixes(browserCrawl?.crawl_id)}
                disabled={isGeneratingFixes}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500/20"
              >
                {isGeneratingFixes ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    Auto-Fix
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {sentinelSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{sentinelSummary.total_scans || 0}</p>
              <p className="text-xs text-gray-500">Total Scans</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{sentinelSummary.routes_verified || 0}</p>
              <p className="text-xs text-gray-500">Routes Verified</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{sentinelSummary.dead_ends_found || 0}</p>
              <p className="text-xs text-gray-500">Dead Ends Found</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{sentinelSummary.issues_auto_fixed || 0}</p>
              <p className="text-xs text-gray-500">Auto-Fixed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scan Results */}
      <ScanResultsCard sentinelScan={sentinelScan} />
      
      {/* Browser Crawl Results */}
      <BrowserCrawlCard browserCrawl={browserCrawl} />
      
      {/* Auto-Fixes */}
      <AutoFixesCard 
        autoFixes={autoFixes} 
        isGenerating={isGeneratingFixes}
        onGenerateFixes={onGenerateFixes}
      />

      {/* Mobile Regression Card */}
      <MobileRegressionCard 
        onRunMobileRegression={onRunMobileRegression}
        mobileRegression={mobileRegression}
        isMobileRegressionRunning={isMobileRegressionRunning}
      />

      {/* Route Registry */}
      <RouteRegistry 
        sentinelRoutes={sentinelRoutes} 
        sentinelEndpoints={sentinelEndpoints} 
      />
    </div>
  );
};

export default CenturionTab;
