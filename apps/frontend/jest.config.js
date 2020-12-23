module.exports = {
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'components/**/*.{mjs,js,jsx,ts,tsx}',
    'pages/**/*.{mjs,js,jsx,ts,tsx}',
    'utils/**/*.{mjs,js,jsx,ts,tsx}',
    'state/**/*.{mjs,js,jsx,ts,tsx}',
    '!**/*.d.ts'
  ],
  setupFiles: [
    '<rootDir>/jest.setup.ts'
  ],
  testURL: 'http://localhost:8080'
};
