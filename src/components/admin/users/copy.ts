/**
 * Every word the users screens say, in one place, so the house rules of
 * src/content/bank-nif.ts can be read over them at a glance: short
 * sentences, second person, no dash used as punctuation, no developer
 * words on a screen the firm uses.
 *
 * Plain data, no React, so both the server page and the client dialogs may
 * import it.
 */

export const usersCopy = {
  page: {
    newUser: "New user",
    actionsHeader: "Actions",
    adminRow: "Admin account",
  },
  actions: {
    view: "View details",
    edit: "Edit",
    assign: "Assign a purchase",
    remove: "Delete",
  },
  fields: {
    email: "Email",
    name: "Full name",
    phone: "Phone",
    phoneHint: "Optional.",
    cancel: "Cancel",
  },
  create: {
    title: "New user",
    lead: "The account is ready at once. The client signs in with a code sent to this address, and no email goes out now.",
    submit: "Create the account",
    working: "Creating",
  },
  edit: {
    title: "Edit user",
    lead: "A new email address is also the address the sign in code goes to.",
    submit: "Save changes",
    working: "Saving",
  },
  assign: {
    title: "Assign a purchase",
    lead: "The order appears on the client's dashboard straight away.",
    service: "Service",
    paidOutside: "Already paid outside the platform",
    paidOutsideHint: "Records the payment now, moves the order to its next stage and emails the client that the payment arrived.",
    submit: "Assign",
    working: "Assigning",
    none: "No service is on sale at the moment.",
  },
  remove: {
    title: "Delete this client",
    lead: "The account goes, with everything stored under it. This cannot be undone.",
    counting: "Checking what is stored under this account.",
    countsUnknown: "What is stored under this account could not be read. Deleting still removes all of it.",
    confirmLabel: "Type the email to confirm",
    submit: "Delete this client",
    working: "Deleting",
    mismatch: "The email does not match.",
  },
} as const;
