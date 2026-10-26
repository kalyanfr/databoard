import SectionCard from "@/components/common/SectionCard";
import ProjectsTable from "@/components/admin/ProjectsTable";

export default function AdminProjects() {
  return (
    <SectionCard title="Projects" description="Every tracked website in the workspace — archive, restore or remove.">
      <ProjectsTable />
    </SectionCard>
  );
}