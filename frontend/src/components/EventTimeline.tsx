import { Box, Collapse, Button, Stack, Typography } from "@mui/material";
import {
  FiberNew as NewIcon,
  Edit as EditIcon,
  Comment as CommentIcon,
  ContentCopy as DuplicateIcon,
  SwapHoriz as ChangeIcon,
  Schedule as TimeIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { FindingEvent } from "../types/findings";
import { formatEventSummary, getEventCategory, formatDateRu, EventCategory } from "../utils/findingFormatters";

interface EventTimelineProps {
  events: FindingEvent[];
  filter?: EventCategory;
  compact?: boolean;
}

const eventIcons: Record<string, React.ReactNode> = {
  created: <NewIcon sx={{ fontSize: 18 }} />,
  status_changed: <ChangeIcon sx={{ fontSize: 18 }} />,
  comment_added: <CommentIcon sx={{ fontSize: 18 }} />,
  duplicate_linked: <DuplicateIcon sx={{ fontSize: 18 }} />,
  duplicate_unlinked: <DuplicateIcon sx={{ fontSize: 18 }} />,
  master_changed: <ChangeIcon sx={{ fontSize: 18 }} />,
  updated: <EditIcon sx={{ fontSize: 18 }} />,
};

const eventColors: Record<string, string> = {
  created: "#64b5f6",
  status_changed: "#ffb74d",
  comment_added: "#81c784",
  duplicate_linked: "#9e9e9e",
  duplicate_unlinked: "#9e9e9e",
  master_changed: "#ce93d8",
  updated: "#90caf9",
};

const getRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateRu(dateStr);
};

const EventTimeline = ({ events, filter = "all", compact = false }: EventTimelineProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filteredEvents = events.filter((e) =>
    filter === "all" ? true : getEventCategory(e) === filter
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (filteredEvents.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No events to display.
      </Typography>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      {/* Timeline line */}
      <Box
        sx={{
          position: "absolute",
          left: 15,
          top: 24,
          bottom: 24,
          width: 2,
          bgcolor: "divider",
          borderRadius: 1,
        }}
      />

      <Stack spacing={0}>
        {filteredEvents.map((event, index) => {
          const icon = eventIcons[event.eventType] || <TimeIcon sx={{ fontSize: 18 }} />;
          const color = eventColors[event.eventType] || "#9e9e9e";
          const isExpanded = expandedIds.has(event.id);
          const isFirst = index === 0;
          const isLast = index === filteredEvents.length - 1;

          return (
            <Box
              key={event.id}
              sx={{
                display: "flex",
                gap: 2,
                py: compact ? 1.5 : 2,
                position: "relative",
              }}
            >
              {/* Icon node */}
              <Box
                sx={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: "background.paper",
                  border: "2px solid",
                  borderColor: color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: color,
                  zIndex: 1,
                  boxShadow: isFirst ? `0 0 0 4px rgba(${color}, 0.2)` : undefined,
                }}
              >
                {icon}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1}
                  flexWrap="wrap"
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: isFirst ? "text.primary" : "text.secondary",
                    }}
                  >
                    {formatEventSummary(event)}
                  </Typography>

                  <Stack direction="row" alignItems="center" gap={0.5} flexShrink={0}>
                    {event.actor && (
                      <Stack direction="row" alignItems="center" gap={0.25}>
                        <PersonIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="caption" color="text.secondary">
                          {event.actor}
                        </Typography>
                      </Stack>
                    )}
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {getRelativeTime(event.createdAt)}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Event type badge */}
                <Box
                  sx={{
                    display: "inline-block",
                    mt: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: `${color}20`,
                    color: color,
                    fontSize: "0.7rem",
                    fontWeight: 500,
                  }}
                >
                  {event.eventType.replace(/_/g, " ")}
                </Box>

                {/* Payload toggle */}
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => toggleExpanded(event.id)}
                      sx={{ px: 0, minWidth: 0, fontSize: "0.75rem" }}
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </Button>

                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          mt: 1,
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        {/* Render payload as key-value pairs */}
                        {Object.entries(event.payload).map(([key, value]) => (
                          <Stack
                            key={key}
                            direction="row"
                            spacing={1}
                            sx={{ mb: 0.5 }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                minWidth: 80,
                                fontWeight: 500,
                              }}
                            >
                              {key}:
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.primary",
                                wordBreak: "break-word",
                              }}
                            >
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    </Collapse>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default EventTimeline;
