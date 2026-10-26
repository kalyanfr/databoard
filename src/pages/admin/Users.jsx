import SectionCard from "@/components/common/SectionCard";
import UsersPanel from "@/components/admin/UsersPanel";

export default function AdminUsers() {
  return (
    <SectionCard title="Users" description="Invite people and change who is an admin.">
      <UsersPanel />
    </SectionCard>
  );
}