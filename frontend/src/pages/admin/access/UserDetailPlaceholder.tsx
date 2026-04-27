import { Link, useParams } from "react-router-dom";

export default function UserDetailPlaceholder() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-4">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <span>Администрирование</span>
          <span>/</span>
          <Link to="/admin/access/users" className="hover:text-foreground transition-colors">
            Управление доступом
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">
            {id ? id.slice(0, 8) + "…" : "Профиль пользователя"}
          </span>
        </nav>
        <h1 className="text-lg font-semibold">Профиль пользователя</h1>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
        <div className="text-4xl">🚧</div>
        <div>
          <p className="text-base font-medium">Детальная страница в разработке</p>
          <p className="text-sm text-muted-foreground mt-1">
            Реализация запланирована в следующем PR
          </p>
        </div>
        <Link
          to="/admin/access/users"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          ← Вернуться к списку
        </Link>
      </div>
    </div>
  );
}
