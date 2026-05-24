import type { Config } from "jest";

const config: Config = {
  coverageProvider: "v8",
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/test/setupAfterEnv.ts"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/auth.ts",
    "!src/lib/prisma.ts",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  roots: ["<rootDir>/src"],
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  watchPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "./tsconfig.test.json",
      diagnostics: {
        ignoreDeprecations: "6.0",
      },
    }],
  },
};

export default config;
