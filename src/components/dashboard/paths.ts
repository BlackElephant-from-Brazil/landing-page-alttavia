/**
 * The client area's routes, in one plain module so server pages and the
 * client sidebar import the same strings. (The sidebar is a client module;
 * a value imported from it into a server component would arrive as a client
 * reference, not a string.)
 */

export const DASHBOARD_PATH = "/en/dashboard";
export const SERVICES_PATH = "/en/dashboard/services";
export const PURCHASES_PATH = "/en/dashboard/purchases";
/** Kept for the emails that link to one order; the sidebar lights "My purchases" for it. */
export const ORDERS_PATH = "/en/dashboard/orders";
export const LOGIN_PATH = "/en/login";
