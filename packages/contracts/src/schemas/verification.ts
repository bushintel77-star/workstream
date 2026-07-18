import { z } from "zod";

/** Operator verification for AI-proposed geometry / boundary. */
export const VerificationStateSchema = z.enum(["UNVERIFIED", "VERIFIED"]);
export type VerificationState = z.infer<typeof VerificationStateSchema>;
