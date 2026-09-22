import "server-only";

import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

import { getR2 } from "./client";

/**
 * Everything stored under one prefix: listed, counted and removed.
 *
 * One order writes to three places in the bucket, all named after its id:
 *
 *   orders/{orderId}/        what the client uploaded
 *   deliverables/{orderId}/  what the firm sent back
 *   contracts/{orderId}/     the versions of the service agreement
 *
 * Deleting a client account has to take those files with it, and the rows
 * alone cannot say what is there: a presigned upload that was never
 * confirmed leaves an object with no row. So the bucket itself is asked.
 *
 * The same walk scripts/purge-test-data.mjs does, brought into the
 * application for DELETE /api/admin/users/[id]. Objects are removed one by
 * one, as that script does, because an order holds a handful of files and a
 * single failed key is then obvious in the log.
 *
 * Nothing here deletes a prefix it was not built for: `deletePrefix` refuses
 * anything outside the three folders, anything that does not end in a
 * slash, and anything with a path step of its own, so a caller can never
 * turn a bad id into "delete the bucket".
 */

/** An order id, as one piece both patterns below are built from. */
const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const UUID = new RegExp(`^${UUID_SOURCE}$`);

/** The folders an order's files may live in. */
const ORDER_FOLDERS = ["orders", "deliverables", "contracts"] as const;

/**
 * One of the three folders, one order id, one trailing slash, and nothing
 * else. It is built from the same id pattern the callers check, so the guard
 * holds on its own: `[^/]+` in the middle used to accept `orders/../` and
 * anything else a single path step can spell, and only `orderPrefixes` stood
 * between that and a bulk delete.
 */
const ALLOWED_PREFIX = new RegExp(`^(${ORDER_FOLDERS.join("|")})/${UUID_SOURCE}/$`);

/** What a refused prefix is reported as, so the test and the log line agree. */
export const ORDER_PREFIX_REFUSED = "deletePrefix: refused";

/** The three prefixes one order's files live under. Throws for an id that is not a uuid. */
export function orderPrefixes(orderId: string): string[] {
  if (!UUID.test(orderId)) throw new Error(`orderPrefixes: "${orderId}" is not an order id`);
  return ORDER_FOLDERS.map((folder) => `${folder}/${orderId}/`);
}

/** Every key under a prefix, following the bucket's pagination to the end. */
export async function listPrefix(prefix: string): Promise<string[]> {
  const { client, bucket } = getR2();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/**
 * Removes every object under a prefix and answers how many went. Deleting a
 * key that is not there is not an error in R2, so a retry after a half
 * finished removal is safe.
 */
export async function deletePrefix(prefix: string): Promise<number> {
  if (!ALLOWED_PREFIX.test(prefix)) {
    throw new Error(`${ORDER_PREFIX_REFUSED} "${prefix}"`);
  }
  const { client, bucket } = getR2();
  const keys = await listPrefix(prefix);
  for (const key of keys) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  return keys.length;
}

/** Every file one order left in the bucket, over its three prefixes. */
export async function countOrderFiles(orderId: string): Promise<number> {
  const counts = await Promise.all(orderPrefixes(orderId).map(async (prefix) => (await listPrefix(prefix)).length));
  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * Removes everything one order left in the bucket and answers how many
 * objects went. Called before the rows are deleted: a bucket that cannot be
 * reached throws here, and the caller stops with the rows still in place,
 * rather than leaving files no row points at.
 */
export async function deleteOrderFiles(orderId: string): Promise<number> {
  let deleted = 0;
  for (const prefix of orderPrefixes(orderId)) {
    deleted += await deletePrefix(prefix);
  }
  return deleted;
}
