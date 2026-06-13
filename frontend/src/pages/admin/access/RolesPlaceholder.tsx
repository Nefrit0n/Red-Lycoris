import { RoleBadge } from "@/components/admin/access/RoleBadge";

interface RoleDef {
  key: "admin" | "auditor" | "member" | "viewer";
  name: string;
  description: string;
  permissions: string[];
}

const GLOBAL_ROLES: RoleDef[] = [
  {
    key: "admin",
    name: "Администратор",
    description: "Полный доступ к системе. Управляет пользователями, проектами и настройками.",
    permissions: [
      "Управление пользователями: создание, деактивация, сброс пароля",
      "Доступ ко всем проектам без ограничений",
      "Просмотр и экспорт журнала аудита",
      "Управление настройками воркспейса",
      "Управление ролями участников во всех проектах",
      "Запуск синхронизации источников обогащения",
    ],
  },
  {
    key: "auditor",
    name: "Аудитор",
    description: "Системный читатель. Видит все проекты и аудит-лог, но не вносит изменений.",
    permissions: [
      "Просмотр всех проектов и находок (только чтение)",
      "Доступ к журналу аудита",
      "Экспорт данных (CSV, JSON, HTML)",
      "Просмотр данных обогащения",
      "Без права изменять статусы, добавлять комментарии или управлять пользователями",
    ],
  },
  {
    key: "member",
    name: "Участник",
    description: "Обычный пользователь. Доступ к проектам определяется ролью в каждом проекте.",
    permissions: [
      "Доступ к проектам, где назначена проектная роль",
      "Права внутри проекта зависят от проектной роли (наблюдатель / триажер / project_admin)",
      "Триаж находок и комментирование — при роли триажера и выше",
      "Управление настройками проекта — при роли project_admin",
      "Импорт сканирований и управление API-токенами проекта — при роли project_admin",
    ],
  },
  {
    key: "viewer",
    name: "Наблюдатель",
    description: "Минимальный уровень доступа. Видит только проекты, к которым явно приглашён.",
    permissions: [
      "Просмотр проектов и находок только там, где назначена проектная роль",
      "Без права изменять статусы и добавлять комментарии (если проектная роль — viewer)",
      "Без доступа к журналу аудита и системным настройкам",
    ],
  },
];

const PROJECT_ROLES = [
  {
    key: "viewer",
    label: "Наблюдатель",
    permissions: ["Просмотр находок и сканирований"],
  },
  {
    key: "triager",
    label: "Триажер",
    permissions: [
      "Всё, что может наблюдатель",
      "Изменение статусов и severity находок",
      "Добавление комментариев и тегов",
    ],
  },
  {
    key: "project_admin",
    label: "Администратор проекта",
    permissions: [
      "Всё, что может триажер",
      "Управление участниками проекта",
      "Создание и отзыв API-токенов проекта",
      "Импорт результатов сканирований",
      "Настройка проекта и его удаление",
    ],
  },
];

export default function RolesPlaceholder() {
  return (
    <div className="space-y-8 max-w-3xl">

      {/* Global roles */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Глобальные роли</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Назначаются пользователю и действуют на уровне всей системы.
          </p>
        </div>

        <div className="space-y-3">
          {GLOBAL_ROLES.map((role) => (
            <article
              key={role.key}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <RoleBadge
                  role={{ key: role.key, name: role.name }}
                  className="mt-0.5 shrink-0"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {role.description}
                </p>
              </div>
              <ul className="space-y-1">
                {role.permissions.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 text-muted-foreground shrink-0">·</span>
                    <span className="text-foreground/80">{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Project roles */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Проектные роли</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Назначаются участнику в рамках конкретного проекта. Не зависят от глобальной роли.
          </p>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/50">
                <th className="px-4 py-2.5 text-left font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-36">
                  Роль
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-[10px] uppercase tracking-wide text-muted-foreground">
                  Возможности
                </th>
              </tr>
            </thead>
            <tbody>
              {PROJECT_ROLES.map((role) => (
                <tr key={role.key} className="border-t border-border/50">
                  <td className="px-4 py-3 align-top">
                    <span className="font-medium text-foreground">{role.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5">
                      {role.permissions.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-foreground/80">
                          <span className="mt-0.5 text-muted-foreground shrink-0">·</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Проектные роли назначаются через страницу настроек проекта (раздел «Участники»).
        </p>
      </section>
    </div>
  );
}
