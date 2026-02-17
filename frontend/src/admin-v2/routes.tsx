import {
  AccountTree,
  Gavel,
  Groups,
  Home,
  People,
  ReceiptLong,
  VpnKey,
} from "@mui/icons-material";

export interface AdminV2RouteConfig {
  label: string;
  path: string;
  icon: typeof Home;
  title: string;
}

export const adminV2Routes: AdminV2RouteConfig[] = [
  {
    label: "Администрирование",
    path: "/admin",
    icon: Home,
    title: "Администрирование",
  },
  {
    label: "Пользователи",
    path: "/admin/users",
    icon: People,
    title: "Пользователи",
  },
  {
    label: "Команды",
    path: "/admin/teams",
    icon: Groups,
    title: "Команды",
  },
  {
    label: "Проекты",
    path: "/admin/projects",
    icon: AccountTree,
    title: "Проекты",
  },
  {
    label: "Integration Tokens",
    path: "/admin/integrations/tokens",
    icon: VpnKey,
    title: "Integration Tokens",
  },
  {
    label: "Политики",
    path: "/admin/policies",
    icon: Gavel,
    title: "Политики",
  },
  {
    label: "Журнал аудита",
    path: "/admin/audit",
    icon: ReceiptLong,
    title: "Журнал аудита",
  },
];

export const adminV2RouteMap = new Map(
  adminV2Routes.map((route) => [route.path, route])
);
