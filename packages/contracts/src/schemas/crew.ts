import { z } from "zod";

export const CrewRoleSchema = z.enum([
  "lead",
  "senior",
  "tradesperson",
  "apprentice",
  "labourer",
  "subcontractor",
]);
export type CrewRole = z.infer<typeof CrewRoleSchema>;

export const CrewMemberSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  name: z.string().min(1),
  role: CrewRoleSchema,
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  hourly_rate: z.number().nonnegative(),
  active: z.boolean().default(true),
  created_at: z.string().datetime(),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;

export const CreateCrewMemberInputSchema = z.object({
  name: z.string().min(1),
  role: CrewRoleSchema.default("tradesperson"),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  hourly_rate: z.number().nonnegative().default(0),
});
export type CreateCrewMemberInput = z.infer<typeof CreateCrewMemberInputSchema>;

export const UpdateCrewMemberInputSchema = CreateCrewMemberInputSchema.partial()
  .extend({ active: z.boolean().optional() });
export type UpdateCrewMemberInput = z.infer<typeof UpdateCrewMemberInputSchema>;

export const CrewAssignmentSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  crew_member_id: z.string().uuid(),
  assigned_at: z.string().datetime(),
  checked_in_at: z.string().datetime().nullable(),
  checked_out_at: z.string().datetime().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
});
export type CrewAssignment = z.infer<typeof CrewAssignmentSchema>;
