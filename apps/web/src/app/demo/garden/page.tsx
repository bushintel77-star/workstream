import { DemoGardenMount } from "./DemoGardenMount";

export const metadata = {
  title: "Demo garden — Workstream",
};

/**
 * Standalone Tier-1 render showcase — physical sky + matched IBL, CC0 PBR
 * ground sets, instanced wind-animated planting, growth-stage trees. Not
 * part of the operator studio surface; see DemoGarden.tsx.
 */
export default function DemoGardenPage() {
  return <DemoGardenMount />;
}
