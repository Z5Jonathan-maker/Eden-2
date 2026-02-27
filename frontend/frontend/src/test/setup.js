import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.REACT_APP_BACKEND_URL = 'http://localhost:8000';
process.env.REACT_APP_ENVIRONMENT = 'test';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock crypto.subtle for SHA-256 tests
if (!global.crypto) {
  global.crypto = { subtle: { digest: jest.fn() } };
}

// Mock URL.createObjectURL / revokeObjectURL
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = jest.fn();
}
