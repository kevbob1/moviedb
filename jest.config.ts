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
    "^@viren070/parse-torrent-title$": "<rootDir>/node_modules/@viren070/parse-torrent-title/dist/index.js",
  },
  modulePathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  roots: ["<rootDir>/src"],
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  watchPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  transform: {
    "^.+\\.(ts|tsx|js)$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          react: {
            runtime: "automatic",
            importSource: "react",
          },
        },
        target: "es2023",
        keepClassNames: true,
      },
      module: {
        type: "commonjs",
      },
    }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!@viren070/parse-torrent-title)/",
  ],
};

export default config;
