import SectionCard from "@/components/common/SectionCard";
import TicketsPanel from "@/components/admin/TicketsPanel";

export default function AdminSupport() {
  return (
    <SectionCard title="Support tickets" description="Reply to a ticket and the submitter sees your answer.">
      <TicketsPanel />
    </SectionCard>
  );
}
