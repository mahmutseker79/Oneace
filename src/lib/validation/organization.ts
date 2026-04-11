import { z } from "zod";

/**
 * Organization profile input — used by Settings → Organization form.
 * Slugs are URL-safe (lowercase, digits, dashes) and globally unique at the DB layer.
 */
export const organizationProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Organization name is required" })
    .max(120, { message: "Organization name must be 120 characters or fewer" }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, { message: "Slug must be at least 2 characters" })
    .max(48, { message: "Slug must be 48 characters or fewer" })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug can only contain lowercase letters, numbers, and dashes",
    }),
});

export type OrganizationProfileInput = z.output<typeof organizationProfileSchema>;
