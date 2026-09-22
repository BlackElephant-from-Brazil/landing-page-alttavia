import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_PREFIX_REFUSED, deleteOrderFiles, deletePrefix, listPrefix, orderPrefixes } from "./prefix";

/**
 * The guard in front of the only wide delete the platform has. `deletePrefix`
 * is what stands between a damaged order id and "empty the bucket", so what
 * it refuses is pinned here: a folder it was not built for, a prefix with no
 * trailing slash (which would match every order whose id starts with those
 * characters), a path step of its own, and anything trying to climb out.
 *
 * The bucket is a fake: `sent` collects the commands, so the walk over the
 * three prefixes and the pagination can be read without touching R2.
 */

type Command = { name: string; input: Record<string, unknown> };

const { sent, pages } = vi.hoisted(() => ({
  sent: [] as Command[],
  pages: { value: [] as { Contents?: { Key: string }[]; IsTruncated?: boolean; NextContinuationToken?: string }[] },
}));

vi.mock("server-only", () => ({}));

vi.mock("@aws-sdk/client-s3", () => ({
  ListObjectsV2Command: class {
    readonly name = "list";
    constructor(readonly input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class {
    readonly name = "delete";
    constructor(readonly input: Record<string, unknown>) {}
  },
}));

vi.mock("./client", () => ({
  getR2: () => ({
    bucket: "alttavia-documents",
    client: {
      async send(command: Command) {
        sent.push(command);
        if (command.name !== "list") return {};
        return pages.value.shift() ?? {};
      },
    },
  }),
}));

const ORDER = "44444444-4444-4444-8444-444444444444";

function page(keys: string[], next?: string) {
  return { Contents: keys.map((Key) => ({ Key })), IsTruncated: Boolean(next), NextContinuationToken: next };
}

function deleted(): string[] {
  return sent.filter((command) => command.name === "delete").map((command) => String(command.input.Key));
}

beforeEach(() => {
  sent.length = 0;
  pages.value = [];
});

describe("orderPrefixes", () => {
  it("names the three folders one order writes to", () => {
    expect(orderPrefixes(ORDER)).toEqual([
      `orders/${ORDER}/`,
      `deliverables/${ORDER}/`,
      `contracts/${ORDER}/`,
    ]);
  });

  it("refuses anything that is not an order id", () => {
    for (const id of ["", "..", "all", `${ORDER}/`, `${ORDER} `, "44444444-4444-4444-8444-44444444444"]) {
      expect(() => orderPrefixes(id)).toThrow(/is not an order id/);
    }
  });
});

describe("deletePrefix", () => {
  it("removes every key under the prefix, following the pagination", async () => {
    pages.value = [page([`orders/${ORDER}/a.png`], "token-1"), page([`orders/${ORDER}/b.pdf`])];

    const count = await deletePrefix(`orders/${ORDER}/`);

    expect(count).toBe(2);
    expect(deleted()).toEqual([`orders/${ORDER}/a.png`, `orders/${ORDER}/b.pdf`]);
  });

  it("refuses a prefix it was not built for, before the bucket is touched", async () => {
    const refused = [
      "orders/",
      "",
      "/",
      `orders/${ORDER}`,
      `orders/${ORDER}/x/`,
      `../orders/${ORDER}/`,
      `photos/${ORDER}/`,
      `ORDERS/${ORDER}/`,
      // The middle step has to be an order id, not any one path step: the
      // guard stands on its own, without `orderPrefixes` in front of it.
      "orders/../",
      "orders/all/",
      "contracts/.../",
      `deliverables/${ORDER.slice(0, -1)}/`,
      `orders/${ORDER}x/`,
    ];

    for (const prefix of refused) {
      await expect(deletePrefix(prefix)).rejects.toThrow(ORDER_PREFIX_REFUSED);
    }
    expect(sent).toEqual([]);
  });
});

describe("deleteOrderFiles", () => {
  it("walks the three prefixes and counts what went", async () => {
    pages.value = [page([`orders/${ORDER}/a.png`]), page([]), page([`contracts/${ORDER}/v1.pdf`])];

    const count = await deleteOrderFiles(ORDER);

    expect(count).toBe(2);
    expect(deleted()).toEqual([`orders/${ORDER}/a.png`, `contracts/${ORDER}/v1.pdf`]);
  });

  it("refuses an id that is not an order id without listing anything", async () => {
    await expect(deleteOrderFiles("all")).rejects.toThrow(/is not an order id/);
    expect(sent).toEqual([]);
  });
});

describe("listPrefix", () => {
  it("answers an empty list for a prefix with nothing under it", async () => {
    pages.value = [{}];

    expect(await listPrefix(`deliverables/${ORDER}/`)).toEqual([]);
  });
});
