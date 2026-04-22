import { Folder } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

interface ProjectPillProps {
  id?: string | null;
  name: string | null | undefined;
  onPick?: (id: string) => void;
  className?: string;
  withIcon?: boolean;
}

// ProjectPill renders a project reference using a stable per-name color. When
// onPick is provided, clicking the pill adds the project_id to the parent
// filter — this is how users jump from a row to "show me only this project".
export function ProjectPill({
  id,
  name,
  onPick,
  className,
  withIcon = true,
}: ProjectPillProps) {
  const label = (name ?? "—").trim() || "—";
  const color = projectColor(name ?? id ?? "");
  const interactive = Boolean(onPick && id);

  const pill = (
    <Badge
      className={cn(
        "gap-1 border px-2 py-0.5 font-medium",
        interactive && "cursor-pointer hover:brightness-110",
        className,
      )}
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
      }}
      onClick={
        interactive
          ? (event: React.MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (id) onPick?.(id);
            }
          : undefined
      }
    >
      {withIcon && <Folder className="size-3" />}
      <span className="max-w-[180px] truncate">{label}</span>
    </Badge>
  );

  if (!interactive) {
    return pill;
  }

  return <Tooltip content={`Показать только проект «${label}»`}>{pill}</Tooltip>;
}

export default ProjectPill;
