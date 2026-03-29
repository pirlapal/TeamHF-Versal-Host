/**
 * HackForge Frontend Property Tests
 * 23 property-based tests using fast-check
 * Tests data invariants, component logic, and utility functions
 */
import * as fc from "fast-check";

// ─── Utility Functions Under Test ───

/** Formats API errors consistently */
function formatApiError(detail) {
  if (!detail) return "An unexpected error occurred";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (d && (d.msg || d.message)) || String(d)).join(", ");
  if (typeof detail === "object" && detail.msg) return detail.msg;
  return String(detail);
}

/** Serializes a document by converting _id to id string */
function serializeDoc(doc) {
  if (!doc) return doc;
  const copy = { ...doc };
  if ("_id" in copy) {
    copy.id = String(copy._id);
    delete copy._id;
  }
  return copy;
}

/** Validates email format */
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Calculates pagination */
function paginate(total, pageSize, currentPage) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const skip = (safePage - 1) * pageSize;
  return { totalPages, currentPage: safePage, skip, pageSize };
}

/** Determines if a role can perform an action */
function hasPermission(role, action) {
  const ROLE_PERMISSIONS = {
    ADMIN: ["create_client", "edit_client", "delete_client", "create_visit", "log_service", "manage_users", "view_reports", "manage_settings"],
    CASE_WORKER: ["create_client", "edit_client", "create_visit", "log_service"],
    VOLUNTEER: [],
  };
  return (ROLE_PERMISSIONS[role] || []).includes(action);
}

/** Truncates text with ellipsis */
function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text || "";
  return text.slice(0, maxLen - 3) + "...";
}

/** Checks if a service log is within the 72h edit window */
function isEditable(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return false;
  const diff = Date.now() - created.getTime();
  return diff < 72 * 60 * 60 * 1000;
}

/** Formats currency */
function formatCurrency(amount) {
  if (typeof amount !== "number" || isNaN(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

/** Validates phone format (loose) */
function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Checks visit time overlap */
function hasTimeConflict(visit1Start, visit1Duration, visit2Start, visit2Duration) {
  const v1End = visit1Start + visit1Duration;
  const v2End = visit2Start + visit2Duration;
  return visit1Start < v2End && v1End > visit2Start;
}

/** Generates a search regex pattern */
function buildSearchPattern(query) {
  if (!query || typeof query !== "string") return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(escaped, "i");
  } catch {
    return null;
  }
}

// ─── Property Tests ───

describe("HackForge Property Tests", () => {
  // P1: formatApiError always returns a string
  test("P1: formatApiError always returns a string", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = formatApiError(input);
        expect(typeof result).toBe("string");
      })
    );
  });

  // P2: formatApiError preserves string inputs
  test("P2: formatApiError preserves non-empty string inputs", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (s) => {
        expect(formatApiError(s)).toBe(s);
      })
    );
  });

  // P3: serializeDoc converts _id to id
  test("P3: serializeDoc converts _id to string id", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (id, name) => {
        const doc = { _id: id, name };
        const result = serializeDoc(doc);
        expect(result.id).toBe(String(id));
        expect(result._id).toBeUndefined();
        expect(result.name).toBe(name);
      })
    );
  });

  // P4: serializeDoc without _id is identity
  test("P4: serializeDoc without _id preserves all fields", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const doc = { a, b };
        const result = serializeDoc(doc);
        expect(result.a).toBe(a);
        expect(result.b).toBe(b);
        expect(result._id).toBeUndefined();
      })
    );
  });

  // P5: isValidEmail rejects strings without @
  test("P5: isValidEmail rejects strings without @", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("@")),
        (email) => {
          expect(isValidEmail(email)).toBe(false);
        }
      )
    );
  });

  // P6: isValidEmail accepts valid format
  test("P6: isValidEmail accepts well-formed emails", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 1, maxLength: 10 }),
          fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), { minLength: 1, maxLength: 8 }),
          fc.stringOf(fc.constantFrom(..."abcdefghijklm"), { minLength: 2, maxLength: 4 })
        ),
        ([local, domain, tld]) => {
          expect(isValidEmail(`${local}@${domain}.${tld}`)).toBe(true);
        }
      )
    );
  });

  // P7: paginate always returns valid pages
  test("P7: paginate totalPages is always >= 1", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (total, pageSize, page) => {
          const result = paginate(total, pageSize, page);
          expect(result.totalPages).toBeGreaterThanOrEqual(1);
          expect(result.currentPage).toBeGreaterThanOrEqual(1);
          expect(result.currentPage).toBeLessThanOrEqual(result.totalPages);
        }
      )
    );
  });

  // P8: paginate skip is within bounds
  test("P8: paginate skip is non-negative and bounded", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (total, pageSize, page) => {
          const result = paginate(total, pageSize, page);
          expect(result.skip).toBeGreaterThanOrEqual(0);
          expect(result.skip).toBeLessThanOrEqual(total);
        }
      )
    );
  });

  // P9: ADMIN has all permissions
  test("P9: ADMIN role has all standard permissions", () => {
    const actions = ["create_client", "edit_client", "delete_client", "create_visit", "log_service", "manage_users"];
    actions.forEach((action) => {
      expect(hasPermission("ADMIN", action)).toBe(true);
    });
  });

  // P10: VOLUNTEER has no write permissions
  test("P10: VOLUNTEER role has no write permissions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("create_client", "edit_client", "delete_client", "create_visit", "log_service", "manage_users", "manage_settings"),
        (action) => {
          expect(hasPermission("VOLUNTEER", action)).toBe(false);
        }
      )
    );
  });

  // P11: CASE_WORKER permissions are subset of ADMIN
  test("P11: CASE_WORKER permissions are a subset of ADMIN permissions", () => {
    const cwActions = ["create_client", "edit_client", "create_visit", "log_service"];
    cwActions.forEach((action) => {
      expect(hasPermission("CASE_WORKER", action)).toBe(true);
      expect(hasPermission("ADMIN", action)).toBe(true);
    });
  });

  // P12: truncateText output length <= maxLen
  test("P12: truncateText output never exceeds maxLen", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 4, max: 1000 }), (text, maxLen) => {
        const result = truncateText(text, maxLen);
        expect(result.length).toBeLessThanOrEqual(maxLen);
      })
    );
  });

  // P13: truncateText with short text is identity
  test("P13: truncateText preserves text shorter than maxLen", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), (text) => {
        expect(truncateText(text, 100)).toBe(text);
      })
    );
  });

  // P14: isEditable returns true for recent timestamps
  test("P14: isEditable returns true for timestamps within 72 hours", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 71 * 60 * 60 * 1000 }), (offset) => {
        const recentDate = new Date(Date.now() - offset).toISOString();
        expect(isEditable(recentDate)).toBe(true);
      })
    );
  });

  // P15: isEditable returns false for old timestamps
  test("P15: isEditable returns false for timestamps older than 72 hours", () => {
    fc.assert(
      fc.property(fc.integer({ min: 73 * 60 * 60 * 1000, max: 365 * 24 * 60 * 60 * 1000 }), (offset) => {
        const oldDate = new Date(Date.now() - offset).toISOString();
        expect(isEditable(oldDate)).toBe(false);
      })
    );
  });

  // P16: isEditable returns false for invalid inputs
  test("P16: isEditable returns false for invalid timestamps", () => {
    fc.assert(
      fc.property(fc.constantFrom(null, undefined, "", "not-a-date", 12345), (input) => {
        expect(isEditable(input)).toBe(false);
      })
    );
  });

  // P17: formatCurrency always returns string starting with $
  test("P17: formatCurrency returns $-prefixed string", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000000, noNaN: true }), (amount) => {
        const result = formatCurrency(amount);
        expect(result.startsWith("$")).toBe(true);
        expect(result.includes(".")).toBe(true);
      })
    );
  });

  // P18: formatCurrency NaN returns $0.00
  test("P18: formatCurrency handles NaN gracefully", () => {
    expect(formatCurrency(NaN)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
    expect(formatCurrency("abc")).toBe("$0.00");
  });

  // P19: isValidPhone rejects too-short numbers
  test("P19: isValidPhone rejects numbers with fewer than 7 digits", () => {
    fc.assert(
      fc.property(fc.stringOf(fc.constantFrom(..."0123456789"), { minLength: 1, maxLength: 6 }), (phone) => {
        expect(isValidPhone(phone)).toBe(false);
      })
    );
  });

  // P20: isValidPhone accepts numbers with 7-15 digits
  test("P20: isValidPhone accepts numbers with 7-15 digits", () => {
    fc.assert(
      fc.property(fc.stringOf(fc.constantFrom(..."0123456789"), { minLength: 7, maxLength: 15 }), (phone) => {
        expect(isValidPhone(phone)).toBe(true);
      })
    );
  });

  // P21: hasTimeConflict is symmetric
  test("P21: visit conflict detection is symmetric", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1440 }),
        fc.integer({ min: 15, max: 240 }),
        fc.integer({ min: 0, max: 1440 }),
        fc.integer({ min: 15, max: 240 }),
        (s1, d1, s2, d2) => {
          expect(hasTimeConflict(s1, d1, s2, d2)).toBe(hasTimeConflict(s2, d2, s1, d1));
        }
      )
    );
  });

  // P22: buildSearchPattern escapes special regex chars safely
  test("P22: buildSearchPattern handles special regex characters", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (query) => {
        const pattern = buildSearchPattern(query);
        if (pattern) {
          expect(pattern instanceof RegExp).toBe(true);
          // Should not throw when tested
          expect(() => pattern.test("test string")).not.toThrow();
        }
      })
    );
  });

  // P23: buildSearchPattern matches the input itself (case insensitive)
  test("P23: buildSearchPattern matches original query (case insensitive)", () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 "), { minLength: 1, maxLength: 20 }),
        (query) => {
          const pattern = buildSearchPattern(query);
          expect(pattern).not.toBeNull();
          expect(pattern.test(query)).toBe(true);
          expect(pattern.test(query.toUpperCase())).toBe(true);
        }
      )
    );
  });
});
