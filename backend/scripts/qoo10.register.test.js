/**
 * Deprecated compatibility entry.
 * Use:
 *  - npm run smoke:readonly   (gate-safe, read-only)
 *  - npm run test:qoo10:write (explicit approval required)
 */
console.error("[DEPRECATED] qoo10.register.test.js is deprecated.");
console.error("Use 'npm run smoke:readonly' for read-only smoke, or 'npm run test:qoo10:write' for write test.");
process.exit(2);
