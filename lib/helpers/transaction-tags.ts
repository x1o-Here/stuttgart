export const TAG_OPTIONS = ["active", "deleted", "corrected", "reversal"] as const;

export type TransactionTagOption = (typeof TAG_OPTIONS)[number];

export const RESTRICTED_TAGS = ["deleted", "corrected", "reversal"] as const;

export function hasRestrictedTags(tags: string[] | undefined): boolean {
  const safeTags = tags || [];
  return RESTRICTED_TAGS.some((tag) => safeTags.includes(tag));
}

export function isActiveTransaction(tags: string[] | undefined): boolean {
  return !hasRestrictedTags(tags);
}

/** Whether a transaction matches the selected tag filter values (e.g. active, deleted). */
export function matchesTagFilter(
  tags: string[] | undefined,
  selectedTags: string[],
): boolean {
  if (!selectedTags.length) return true;

  const safeTags = tags || [];
  const isActive = isActiveTransaction(safeTags);

  return selectedTags.some((filter) => {
    if (filter === "active") return isActive;
    return safeTags.includes(filter);
  });
}

/** TanStack Table column filterFn for a `tags` column. */
export function tagsColumnFilterFn(
  row: { getValue: (id: string) => unknown },
  id: string,
  filterValues: string[],
): boolean {
  if (!filterValues || filterValues.length === 0) return true;
  const tags = (row.getValue(id) as string[]) || [];
  return matchesTagFilter(tags, filterValues);
}
