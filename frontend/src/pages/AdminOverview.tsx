import {
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AdminSectionLayout from "../components/AdminSectionLayout";

const sections = [
  {
    title: "Users",
    description:
      "Пользователи, роли, активность и принудительная смена пароля.",
    path: "/admin/users",
    items: [
      "username/email, global role, active",
      "must_change_password, created_at, last_login",
      "создать, деактивировать, сбросить пароль, сменить роль",
    ],
  },
  {
    title: "Groups + Product Access",
    description:
      "Группы, членство и матрица доступа к продуктам.",
    path: "/admin/groups",
    items: [
      "name/description/#users",
      "product membership для групп",
      "матрица групп/пользователей по продуктам",
    ],
  },
  {
    title: "Audit Log",
    description:
      "Технический журнал изменений для расследований.",
    path: "/admin/audit-log",
    items: [
      "time, actor, action, target, scope",
      "filters: actor/action/entity/product/period",
      "details: diff или payload",
    ],
  },
  {
    title: "Webhooks / Integrations",
    description:
      "Исходящие уведомления и доставки.",
    path: "/admin/webhooks",
    items: [
      "name, url, enabled, events",
      "HMAC secret, retry/backoff",
      "deliveries: status, attempts, last_error",
    ],
  },
  {
    title: "Scanners / Mappings",
    description:
      "Сопоставления для severity/status между сканерами и платформой.",
    path: "/admin/scanners",
    items: [
      "список сканеров",
      "mapping severity → internal severity",
      "mapping status → internal status",
    ],
  },
  {
    title: "System / Setup",
    description:
      "Мастер первичной настройки и системные параметры.",
    path: "/admin/setup",
    items: [
      "смена root пароля",
      "создание первого продукта",
      "базовые маппинги и завершение",
    ],
  },
];

const AdminOverview = () => {
  const navigate = useNavigate();

  return (
    <AdminSectionLayout
      title="Admin"
      description="Административный раздел для управления пользователями, доступами, интеграциями и аудитом."
    >
      <Grid container spacing={3}>
        {sections.map((section) => (
          <Grid item xs={12} md={6} key={section.title}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6">
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                  <Stack component="ul" spacing={0.5} sx={{ pl: 2, mb: 0 }}>
                    {section.items.map((item) => (
                      <Typography component="li" variant="body2" key={item}>
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate(section.path)}>
                  Открыть
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </AdminSectionLayout>
  );
};

export default AdminOverview;
