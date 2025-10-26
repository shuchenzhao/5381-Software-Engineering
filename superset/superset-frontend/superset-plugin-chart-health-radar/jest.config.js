module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testMatch: ['<rootDir>/test/**/*.test.(ts|tsx|js|jsx)'],
  collectCoverageFrom: ['src/**/*.{ts,tsx,js,jsx}'],
};
