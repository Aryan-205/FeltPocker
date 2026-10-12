import { PageShell } from "@/components/page-shell";
import { RulesCourse } from "@/components/learn/rules-course";

export default function RulesPage() {
  return (
    <PageShell back={{ href: "/learn", label: "Learn" }} title="The Rules">
      <RulesCourse />
    </PageShell>
  );
}
