import { z } from "zod";

import { Role } from "@/generated/prisma";

const ROLE_VALUES = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.MEMBER, Role.VIEWER] as const;

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
  role: z.enum(ROLE_VALUES).default(Role.MEMBER),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROLE_VALUES),
});

export type InviteMemberInput = z.output<typeof inviteMemberSchema>;
