import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/api'],
  testMatch: ['**/coverage-gate.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
        tsconfig: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@farmledge/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@farmledge/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    '!apps/api/src/**/*.d.ts',
    '!apps/api/src/server.ts',
    '!apps/api/src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
