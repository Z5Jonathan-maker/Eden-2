/**
 * Adam Module - Tests Tab Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, Clock, CheckCircle, XCircle, AlertCircle, Zap } from 'lucide-react';

const getStatusIcon = (status) => {
  switch (status) {
    case 'passed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-600" />;
  }
};

const TestResultsList = ({ testResults }) => {
  if (testResults.length === 0) return null;

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900">Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {testResults.map((result) => (
            <div
              key={result.id}
              className="p-3 bg-gray-800 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(result.status)}
                <div>
                  <p className="font-medium text-gray-900">{result.name}</p>
                  <p className="text-xs text-gray-500">{result.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    result.status === 'passed'
                      ? 'bg-green-500/20 text-green-400'
                      : result.status === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }
                >
                  {result.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-gray-500">{result.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const TestResultsSummary = ({ testResults }) => {
  if (testResults.length === 0) return null;

  const passed = testResults.filter((t) => t.status === 'passed').length;
  const failed = testResults.filter((t) => t.status === 'failed').length;
  const warnings = testResults.filter((t) => t.status === 'warning').length;
  const total = testResults.length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card className="bg-white border-gray-200">
        <CardContent className="p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">Total Tests</p>
        </CardContent>
      </Card>
      <Card className="bg-white border-green-500/30">
        <CardContent className="p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{passed}</p>
          <p className="text-xs text-gray-500">Passed</p>
        </CardContent>
      </Card>
      <Card className="bg-white border-red-500/30">
        <CardContent className="p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{failed}</p>
          <p className="text-xs text-gray-500">Failed</p>
        </CardContent>
      </Card>
      <Card className="bg-white border-yellow-500/30">
        <CardContent className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{warnings}</p>
          <p className="text-xs text-gray-500">Warnings</p>
        </CardContent>
      </Card>
    </div>
  );
};

const EmptyState = ({ onRunTests }) => (
  <Card className="bg-white border-gray-200">
    <CardContent className="p-12 text-center">
      <Zap className="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Test</h3>
      <p className="text-gray-500 mb-6">
        Select a test suite and click &quot;Run Tests&quot; to begin automated quality assurance
      </p>
      <Button onClick={onRunTests} className="bg-blue-600 hover:bg-blue-700">
        <Play className="w-4 h-4 mr-2" />
        Start Testing
      </Button>
    </CardContent>
  </Card>
);

export const TestsTab = ({
  testResults,
  selectedTests,
  setSelectedTests,
  isRunning,
  onRunTests,
}) => {
  return (
    <div className="space-y-6">
      {/* Test Controls */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Test Configuration</CardTitle>
          <CardDescription className="text-gray-500">
            Select and run automated tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <select
              value={selectedTests}
              onChange={(e) => setSelectedTests(e.target.value)}
              className="flex-1 p-2 bg-gray-800 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tests</option>
              <option value="backend">Backend Only</option>
              <option value="integrations">Integrations Only</option>
              <option value="frontend">Frontend Only</option>
              <option value="database">Database Only</option>
            </select>

            <Button
              onClick={onRunTests}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Tests
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      <TestResultsSummary testResults={testResults} />

      {/* Test Results List */}
      <TestResultsList testResults={testResults} />

      {/* Empty State */}
      {testResults.length === 0 && !isRunning && <EmptyState onRunTests={onRunTests} />}
    </div>
  );
};

export default TestsTab;
