/**
 * The services pages' URLs. A plain module on purpose: the sidebar exports
 * the same string from a "use client" file, and a non component export
 * imported from there into a server component arrives as a client
 * reference, not a string.
 */

export const SERVICES_PATH = "/admin/services";
export const NEW_SERVICE_PATH = `${SERVICES_PATH}/new`;
export const SERVICES_API_PATH = "/api/admin/services";

export function servicePath(id: string): string {
  return `${SERVICES_PATH}/${id}`;
}
