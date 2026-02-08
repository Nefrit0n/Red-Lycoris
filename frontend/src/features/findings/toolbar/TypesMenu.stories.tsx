import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import TypesMenu from "./TypesMenu";

const options = [
  { value: "SAST", label: "SAST" },
  { value: "SCA", label: "SCA" },
  { value: "DAST", label: "DAST" },
  { value: "SECRETS", label: "Secrets" },
  { value: "CONTAINER", label: "Container" },
  { value: "IAC", label: "IaC" },
];

const meta: Meta<typeof TypesMenu> = {
  title: "Findings/Toolbar/TypesMenu",
  component: TypesMenu,
};

export default meta;

type Story = StoryObj<typeof TypesMenu>;

const TypesMenuDemo = (initial: string[]) => {
  const Demo = () => {
    const [value, setValue] = useState<string[]>(initial);
    return (
      <Stack spacing={1} sx={{ p: 2, bgcolor: "#0b0b10" }}>
        <TypesMenu value={value} onChange={setValue} options={options} />
        <Typography variant="caption" sx={{ color: "#8b93a9" }}>
          Выбрано: {value.join(", ") || "нет"}
        </Typography>
      </Stack>
    );
  };

  return <Demo />;
};

export const Empty: Story = {
  render: () => TypesMenuDemo([]),
};

export const Many: Story = {
  render: () => TypesMenuDemo(["SAST", "SCA", "DAST", "SECRETS"]),
};

export const W1366LongNames: Story = {
  render: () => (
    <Box sx={{ width: 1366 }}>
      {TypesMenuDemo(["SAST", "SCA", "DAST", "SECRETS", "CONTAINER", "IAC"])}
    </Box>
  ),
};
