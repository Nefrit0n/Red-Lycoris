# Интеграция CI

Актуальные инструкции и полные шаблоны:

- [GitLab CI: include, переменные, передача артефактов и диагностика](https://github.com/Nefrit0n/Red-Lycoris/wiki/Интеграции-GitLab-CI).
- [GitHub Actions: reusable workflow и secrets организации](https://github.com/Nefrit0n/Red-Lycoris/wiki/Интеграции-GitHub-Actions).
- [API-токены: права, выпуск, ротация и отзыв](https://github.com/Nefrit0n/Red-Lycoris/wiki/Интеграции-API-токены).

Прежний пример с подавлением ошибок загрузки заменён заданием, проверяющим HTTP-ответ и созданный скан. Шаблоны используют текущую модель PAT проекта; универсального CI-токена и выбора проекта по project_key в обработчике нет.
