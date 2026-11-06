"use client";

import { useRouter } from "next/navigation";
import { ProjectCard } from "@/components/users/project-card";
import type { Project } from "@/lib/types";

/** Fiche du projet affichée dans le volet de détails ; retour à la liste après suppression. */
export function ProjectPanel({ project }: { project: Project }) {
  const router = useRouter();
  return <ProjectCard project={project} variant="drawer" onDeleted={() => router.push("/admin/projets")} />;
}
