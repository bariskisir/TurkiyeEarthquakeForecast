/**
 * @fileoverview Defines the eslint.config repository configuration module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
