/**
 * Browser-safe UUID generation for client-side wire correlation.
 */

// One implementation lives in the apiproxy api layer (the browser-safe floor
// below connection); this module keeps the import site stable for callers
// inside this package and avoids a second UUID generator.
export { randomUuid } from '@deepseek-ai/dsh-host-apiproxy/api'
