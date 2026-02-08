import { Badge, Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { FiltersState } from "../../filters/types";
import { CATEGORY_LABELS } from "../../filters/labels";
import { primitives } from "../../../design-system/tokens/colors";

export interface TypeStripItem {
  category: string;
  count?: number;
}

interface TypeStripProps {
  items: TypeStripItem[];
  value: FiltersState["categories"];
  onChange: (next: FiltersState["categories"]) => void;
}

const TypeStrip = ({ items, value, onChange }: TypeStripProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        minWidth: 0,
        overflowX: "auto",
        whiteSpace: "nowrap",
        "&::-webkit-scrollbar": { height: 4 },
        "&::-webkit-scrollbar-thumb": { bgcolor: primitives.night[600], borderRadius: 2 },
      }}
    >
      <ToggleButtonGroup
        value={value}
        onChange={(_, next) => onChange(next ?? [])}
        exclusive={false}
        size="small"
        sx={{
          display: "inline-flex",
          flexWrap: "nowrap",
          gap: 0.75,
          "& .MuiToggleButtonGroup-grouped": {
            border: `1px solid ${primitives.night[600]}`,
            borderRadius: "999px !important",
            textTransform: "none",
            px: 1.5,
            height: 30,
            color: primitives.night[100],
            "&.Mui-selected": {
              bgcolor: "rgba(225, 29, 72, 0.14)",
              color: primitives.night[50],
              borderColor: primitives.lotus[500],
            },
            "&:hover": {
              borderColor: primitives.lotus[400],
              color: primitives.lotus[200],
            },
          },
        }}
      >
        {items.map((item) => {
          const label = CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category;
          return (
            <ToggleButton key={item.category} value={item.category} aria-label={label}>
              <Tooltip title={label}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {label}
                  </Typography>
                  {typeof item.count === "number" && (
                    <Badge
                      color="default"
                      badgeContent={item.count}
                      sx={{
                        "& .MuiBadge-badge": {
                          bgcolor: primitives.night[600],
                          color: primitives.night[50],
                          fontSize: 10,
                          height: 16,
                          minWidth: 16,
                        },
                      }}
                    />
                  )}
                </Box>
              </Tooltip>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
};

export default TypeStrip;
