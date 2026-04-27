#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vuln_seeder_ru.py — генератор тестовых уязвимостей для Red Lycoris / ASOC.

Что делает:
  - генерирует SCA/SAST/DAST/IaC/Secrets findings;
  - сохраняет Generic JSON payload в файл;
  - импортирует findings в Red Lycoris через API;
  - умеет создавать тестовые проекты;
  - поддерживает Bearer token и session cookie;
  - имеет русифицированный help и логи.

Требования:
  - Python >= 3.8
  - Только stdlib
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple


APP_NAME = "Red Lycoris Vuln Seeder"
APP_VERSION = "1.1.0"


# =============================================================================
# ЛОГИ / CLI
# =============================================================================


class Colors:
    bold = ""
    dim = ""
    reset = ""
    info = ""
    ok = ""
    warn = ""
    error = ""


def setup_colors() -> Colors:
    colors = Colors()
    if os.environ.get("NO_COLOR") or not sys.stderr.isatty():
        return colors
    colors.bold = "\033[1m"
    colors.dim = "\033[2m"
    colors.reset = "\033[0m"
    colors.info = "\033[36m"
    colors.ok = "\033[32m"
    colors.warn = "\033[33m"
    colors.error = "\033[31m"
    return colors


COLORS = setup_colors()


def utc_now() -> str:
    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


def log(level: str, message: str, *, quiet: bool = False) -> None:
    if quiet and level in {"ИНФО", "ОК"}:
        return
    color = {
        "ИНФО": COLORS.info,
        "ОК": COLORS.ok,
        "ВНИМАНИЕ": COLORS.warn,
        "ОШИБКА": COLORS.error,
    }.get(level, "")
    print(f"{utc_now()} [{color}{level}{COLORS.reset}] {message}", file=sys.stderr)


def die(message: str, exit_code: int = 1) -> None:
    log("ОШИБКА", message)
    raise SystemExit(exit_code)


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("ожидается целое число") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("значение должно быть больше 0")
    return parsed


def positive_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("ожидается число") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("значение должно быть больше 0")
    return parsed


def parse_header(value: str) -> Tuple[str, str]:
    if ":" not in value:
        raise argparse.ArgumentTypeError(
            "заголовок должен быть в формате 'Name: Value'"
        )
    name, header_value = value.split(":", 1)
    name = name.strip()
    header_value = header_value.strip()
    if not name or not header_value:
        raise argparse.ArgumentTypeError(
            "имя и значение заголовка не могут быть пустыми"
        )
    return name, header_value


# =============================================================================
# ПУЛЫ ДАННЫХ
# =============================================================================
# Пулы намеренно лежат в одном файле, чтобы скрипт можно было кинуть на любой стенд.
# CVE/CWE/rule_id взяты из реальных классов уязвимостей и популярных сканеров.


DEFAULT_PROJECTS: List[Dict[str, Any]] = [
    {
        "name": "platform-backend",
        "description": "Core backend services and APIs",
        "tags": ["go", "backend", "api"],
    },
    {
        "name": "web-frontend",
        "description": "Customer-facing web application",
        "tags": ["react", "typescript", "frontend"],
    },
    {
        "name": "mobile-app",
        "description": "iOS and Android mobile application",
        "tags": ["kotlin", "swift", "mobile"],
    },
    {
        "name": "infra-services",
        "description": "Infrastructure and DevOps tooling",
        "tags": ["docker", "k8s", "terraform"],
    },
    {
        "name": "data-pipeline",
        "description": "ETL and data processing services",
        "tags": ["python", "etl"],
    },
    {
        "name": "billing-service",
        "description": "Billing and payments",
        "tags": ["backend", "payments"],
    },
    {
        "name": "identity-provider",
        "description": "SSO / OIDC identity broker",
        "tags": ["security", "iam"],
    },
    {
        "name": "ml-inference",
        "description": "Online model inference service",
        "tags": ["python", "ml"],
    },
]


KEV_CVES: List[str] = [
    "CVE-2024-3094",
    "CVE-2024-21626",
    "CVE-2024-23897",
    "CVE-2024-27198",
    "CVE-2024-21887",
    "CVE-2024-3400",
    "CVE-2024-24919",
    "CVE-2024-6387",
    "CVE-2024-4577",
    "CVE-2024-1086",
    "CVE-2024-49138",
    "CVE-2024-38080",
    "CVE-2023-4863",
    "CVE-2023-34362",
    "CVE-2023-44487",
    "CVE-2023-38545",
    "CVE-2023-22527",
    "CVE-2023-42793",
    "CVE-2023-50164",
    "CVE-2023-20198",
    "CVE-2023-27997",
    "CVE-2023-3519",
    "CVE-2023-22515",
    "CVE-2023-28252",
    "CVE-2023-23397",
    "CVE-2023-36884",
    "CVE-2023-4966",
    "CVE-2022-22965",
    "CVE-2022-26134",
    "CVE-2022-30190",
    "CVE-2022-1388",
    "CVE-2022-42475",
    "CVE-2022-47966",
    "CVE-2022-41040",
    "CVE-2022-41082",
    "CVE-2022-42889",
    "CVE-2021-44228",
    "CVE-2021-45046",
    "CVE-2021-44832",
    "CVE-2021-4034",
    "CVE-2021-26084",
    "CVE-2021-34527",
    "CVE-2021-34473",
    "CVE-2021-26855",
    "CVE-2021-22205",
    "CVE-2021-42013",
    "CVE-2021-41773",
    "CVE-2021-3156",
    "CVE-2020-1472",
    "CVE-2020-0796",
    "CVE-2020-14882",
    "CVE-2020-5902",
    "CVE-2019-19781",
    "CVE-2019-11510",
    "CVE-2018-13379",
    "CVE-2017-5638",
    "CVE-2017-0144",
    "CVE-2014-0160",
    "CVE-2014-6271",
]


SCA_CVES: List[str] = [
    "CVE-2021-44228",
    "CVE-2021-45046",
    "CVE-2021-44832",
    "CVE-2021-45105",
    "CVE-2022-22965",
    "CVE-2022-22963",
    "CVE-2022-22947",
    "CVE-2016-1000027",
    "CVE-2019-10744",
    "CVE-2020-8203",
    "CVE-2018-16487",
    "CVE-2021-23337",
    "CVE-2019-12384",
    "CVE-2020-36518",
    "CVE-2022-42003",
    "CVE-2022-42004",
    "CVE-2023-32681",
    "CVE-2023-43804",
    "CVE-2023-45803",
    "CVE-2024-35195",
    "CVE-2023-43665",
    "CVE-2023-46136",
    "CVE-2023-30861",
    "CVE-2024-22195",
    "CVE-2022-44572",
    "CVE-2023-27530",
    "CVE-2023-28362",
    "CVE-2024-26141",
    "CVE-2024-39338",
    "CVE-2024-37890",
    "CVE-2022-25883",
    "CVE-2022-46175",
    "CVE-2022-0778",
    "CVE-2023-0286",
    "CVE-2023-38545",
    "CVE-2023-4863",
    "CVE-2022-42889",
    "CVE-2021-40438",
    "CVE-2022-42252",
    "CVE-2023-4586",
]


CWE_POOL: List[Tuple[int, str]] = [
    (79, "Cross-site Scripting"),
    (89, "SQL Injection"),
    (78, "OS Command Injection"),
    (77, "Command Injection"),
    (22, "Path Traversal"),
    (94, "Code Injection"),
    (502, "Deserialization of Untrusted Data"),
    (798, "Use of Hard-coded Credentials"),
    (352, "CSRF"),
    (287, "Improper Authentication"),
    (862, "Missing Authorization"),
    (863, "Incorrect Authorization"),
    (284, "Improper Access Control"),
    (639, "Authorization Bypass Through User-Controlled Key"),
    (918, "SSRF"),
    (611, "XXE"),
    (601, "Open Redirect"),
    (434, "Unrestricted Upload"),
    (327, "Broken Cryptographic Algorithm"),
    (328, "Weak Hash"),
    (330, "Insufficiently Random Values"),
    (20, "Improper Input Validation"),
    (200, "Exposure of Sensitive Information"),
    (532, "Sensitive Data in Logs"),
    (209, "Error Message with Sensitive Information"),
    (1321, "Prototype Pollution"),
    (400, "Uncontrolled Resource Consumption"),
    (732, "Incorrect Permissions"),
    (276, "Incorrect Default Permissions"),
    (295, "Improper Certificate Validation"),
    (319, "Cleartext Transmission"),
    (306, "Missing Authentication"),
    (522, "Insufficiently Protected Credentials"),
]


SCA_COMPONENTS: Dict[str, List[str]] = {
    "npm": [
        "lodash",
        "express",
        "axios",
        "react",
        "vue",
        "angular",
        "webpack",
        "moment",
        "jquery",
        "bootstrap",
        "ws",
        "node-fetch",
        "serialize-javascript",
        "minimist",
        "handlebars",
        "mongoose",
        "passport",
        "socket.io",
        "cookie",
        "debug",
        "ejs",
        "glob",
        "marked",
        "node-forge",
        "qs",
        "tough-cookie",
        "immer",
        "nth-check",
        "postcss",
        "semver",
        "tar",
        "xmldom",
        "json5",
    ],
    "pypi": [
        "requests",
        "django",
        "flask",
        "pyyaml",
        "pillow",
        "urllib3",
        "werkzeug",
        "jinja2",
        "cryptography",
        "lxml",
        "paramiko",
        "celery",
        "fastapi",
        "numpy",
        "pandas",
        "tensorflow",
        "boto3",
        "sqlalchemy",
        "pip",
        "setuptools",
        "wheel",
        "starlette",
        "aiohttp",
        "markupsafe",
        "redis",
        "twisted",
        "pycryptodome",
    ],
    "maven": [
        "log4j-core",
        "log4j-api",
        "spring-core",
        "spring-web",
        "spring-boot",
        "jackson-databind",
        "jackson-core",
        "hibernate-core",
        "struts2-core",
        "commons-text",
        "commons-collections",
        "netty-all",
        "tomcat-catalina",
        "dom4j",
        "guava",
        "xstream",
        "snakeyaml",
        "spring-security-core",
    ],
    "go": [
        "github.com/gin-gonic/gin",
        "github.com/gorilla/mux",
        "golang.org/x/crypto",
        "golang.org/x/net",
        "golang.org/x/text",
        "github.com/golang-jwt/jwt",
        "google.golang.org/grpc",
        "github.com/containerd/containerd",
        "github.com/docker/docker",
        "k8s.io/kubernetes",
        "github.com/hashicorp/consul",
    ],
    "nuget": ["Newtonsoft.Json", "System.Text.Json", "Npgsql", "Serilog", "AutoMapper"],
    "rubygems": [
        "rails",
        "rack",
        "nokogiri",
        "puma",
        "redis",
        "sidekiq",
        "devise",
        "loofah",
    ],
    "cargo": [
        "tokio",
        "serde",
        "actix-web",
        "hyper",
        "openssl",
        "reqwest",
        "rocket",
        "tower",
        "h2",
    ],
}


COMPONENT_TO_CVES: Dict[str, List[str]] = {
    "log4j-core": [
        "CVE-2021-44228",
        "CVE-2021-45046",
        "CVE-2021-44832",
        "CVE-2021-45105",
    ],
    "log4j-api": ["CVE-2021-44228"],
    "spring-core": ["CVE-2022-22965", "CVE-2016-1000027"],
    "spring-web": ["CVE-2022-22965", "CVE-2022-22963"],
    "spring-boot": ["CVE-2023-20863"],
    "jackson-databind": [
        "CVE-2019-12384",
        "CVE-2020-36518",
        "CVE-2022-42003",
        "CVE-2022-42004",
    ],
    "lodash": ["CVE-2019-10744", "CVE-2020-8203", "CVE-2021-23337"],
    "requests": ["CVE-2023-32681", "CVE-2024-35195"],
    "urllib3": ["CVE-2023-43804", "CVE-2023-45803"],
    "django": ["CVE-2023-43665", "CVE-2024-24680"],
    "flask": ["CVE-2023-30861"],
    "jinja2": ["CVE-2024-22195", "CVE-2024-56201"],
    "werkzeug": ["CVE-2023-46136"],
    "axios": ["CVE-2024-39338", "CVE-2023-45857"],
    "ws": ["CVE-2024-37890", "CVE-2021-32640"],
    "express": ["CVE-2024-29041", "CVE-2024-43796"],
    "semver": ["CVE-2022-25883"],
    "json5": ["CVE-2022-46175"],
    "nth-check": ["CVE-2021-3803"],
    "rails": ["CVE-2023-28362", "CVE-2024-26141"],
    "rack": ["CVE-2022-44572", "CVE-2023-27530"],
    "openssl": ["CVE-2022-0778", "CVE-2023-0286"],
    "struts2-core": ["CVE-2017-5638", "CVE-2023-50164"],
    "netty-all": ["CVE-2023-4586"],
    "tomcat-catalina": ["CVE-2022-42252"],
    "commons-text": ["CVE-2022-42889"],
    "xstream": ["CVE-2021-39144"],
    "snakeyaml": ["CVE-2022-1471"],
    "pillow": ["CVE-2023-44271", "CVE-2024-28219"],
    "cryptography": ["CVE-2023-50782", "CVE-2024-26130"],
    "pyyaml": ["CVE-2020-1747"],
    "paramiko": ["CVE-2022-24302"],
    "tensorflow": ["CVE-2023-25661", "CVE-2023-25658"],
    "golang.org/x/crypto": ["CVE-2025-22869"],
    "golang.org/x/net": ["CVE-2023-39325", "CVE-2024-45338"],
    "github.com/containerd/containerd": ["CVE-2024-21626"],
    "github.com/docker/docker": ["CVE-2024-41110"],
    "Newtonsoft.Json": ["CVE-2024-21907"],
    "tokio": ["CVE-2023-22466"],
    "hyper": ["CVE-2023-26964"],
}


SAST_RULES: List[Tuple[str, str, List[int]]] = [
    (
        "semgrep.python.django.security.audit.django-mark-safe",
        "Use of mark_safe() bypasses Django's XSS auto-escaping",
        [79],
    ),
    (
        "semgrep.python.flask.security.xss.jinja2-autoescape-off",
        "Jinja2 autoescape disabled — XSS risk",
        [79],
    ),
    (
        "semgrep.python.sqlalchemy.security.audit.avoid-execute",
        "Raw SQL execute() with string concatenation — SQLi",
        [89],
    ),
    (
        "semgrep.python.lang.security.audit.dangerous-subprocess-use",
        "subprocess called with shell=True on user input",
        [78, 77],
    ),
    (
        "semgrep.python.lang.security.audit.insecure-pickle-usage",
        "pickle.load on untrusted data",
        [502],
    ),
    (
        "semgrep.javascript.express.security.audit.express-xss",
        "Potential XSS via res.send with user input",
        [79],
    ),
    (
        "semgrep.javascript.express.security.audit.express-open-redirect",
        "Open redirect via res.redirect(userInput)",
        [601],
    ),
    (
        "semgrep.javascript.lang.security.audit.prototype-pollution-loop",
        "Prototype pollution via recursive assignment",
        [1321],
    ),
    (
        "semgrep.go.lang.security.audit.sqli-gosec",
        "SQL query built via fmt.Sprintf — SQLi",
        [89],
    ),
    (
        "semgrep.go.lang.security.audit.xss-gosec",
        "Untrusted HTML rendered via template.HTML",
        [79],
    ),
    (
        "semgrep.java.spring.security.audit.spring-ssrf",
        "RestTemplate.getForObject on user-controlled URL — SSRF",
        [918],
    ),
    (
        "semgrep.java.lang.security.audit.xxe-dtd",
        "XMLInputFactory without disabling DTDs — XXE",
        [611],
    ),
    ("gosec.G101", "Hardcoded credentials detected", [798]),
    ("gosec.G201", "SQL query construction using format string", [89]),
    ("gosec.G304", "File path provided as taint input", [22]),
    ("gosec.G401", "Use of weak cryptographic primitive MD5", [327, 328]),
    ("gosec.G402", "TLS InsecureSkipVerify set true", [295]),
    ("bandit.B102", "exec() usage", [94]),
    ("bandit.B301", "pickle — potential insecure deserialization", [502]),
    ("bandit.B307", "Use of possibly insecure function: eval", [94]),
    ("bandit.B501", "requests call with verify=False", [295]),
    ("bandit.B602", "subprocess call with shell=True", [78]),
    ("bandit.B608", "Possible SQL injection via string-based query", [89]),
    (
        "eslint-plugin-security.detect-eval-with-expression",
        "eval() with non-literal expression",
        [94],
    ),
    (
        "eslint-plugin-security.detect-non-literal-fs-filename",
        "Non-literal fs filename — path traversal",
        [22],
    ),
    ("brakeman.MassAssignment", "Mass assignment vulnerability in controller", [915]),
]


SAST_FILE_PATHS: List[str] = [
    "src/api/users.py",
    "src/api/orders.py",
    "src/auth/login.py",
    "backend/internal/db/query.go",
    "backend/internal/http/handler.go",
    "cmd/server/main.go",
    "pkg/auth/jwt.go",
    "services/payment.ts",
    "services/search.ts",
    "services/admin.ts",
    "src/components/Login.tsx",
    "src/components/UploadForm.tsx",
    "app/controllers/admin_controller.rb",
    "app/models/user.rb",
    "src/main/java/com/acme/controller/UserController.java",
    "src/main/java/com/acme/service/AuthService.java",
    "api/v1/graphql.js",
    "api/v1/upload.js",
    "lib/utils/template_render.py",
    "lib/db/migrate.py",
    "config/secrets_loader.go",
    "internal/xml/parser.go",
]


SAST_SNIPPETS: List[str] = [
    'query = f"SELECT * FROM users WHERE id = {user_id}"',
    'os.system("ping " + request.args.get("host"))',
    "subprocess.call(cmd, shell=True)",
    "pickle.loads(request.data)",
    "eval(user_input)",
    "render_template_string(user_input)",
    "res.redirect(req.query.next)",
    "res.send(`<h1>${req.query.name}</h1>`)",
    'db.Query(fmt.Sprintf("SELECT * FROM t WHERE id=%s", id))',
    "tls.Config{InsecureSkipVerify: true}",
    "md5.New().Sum(password)",
    "RestTemplate.getForObject(userUrl, String.class)",
    "DocumentBuilderFactory.newInstance() // DTDs not disabled",
    "requests.get(url, verify=False)",
]


DAST_ENDPOINTS: List[Tuple[str, str, List[str], str, List[int]]] = [
    ("/api/v1/users", "GET", ["id", "filter"], "Reflected XSS", [79]),
    ("/api/v1/search", "GET", ["q"], "SQL Injection time-based", [89]),
    ("/api/v1/orders", "GET", ["id"], "IDOR — Broken Access Control", [639, 284]),
    ("/api/v1/profile", "GET", ["email"], "User enumeration", [200]),
    ("/login", "POST", ["username", "password"], "No rate limiting on login", [307]),
    ("/api/v1/upload", "POST", ["file"], "Unrestricted file upload", [434]),
    ("/redirect", "GET", ["url", "next"], "Open Redirect", [601]),
    ("/api/graphql", "POST", ["query"], "GraphQL introspection enabled", [200]),
    ("/admin/panel", "GET", [], "Admin panel accessible without auth", [306]),
    ("/download", "GET", ["file"], "Path Traversal", [22]),
    ("/api/v1/fetch", "POST", ["url"], "Server-Side Request Forgery", [918]),
    ("/api/v1/xml", "POST", ["payload"], "XXE via SOAP endpoint", [611]),
    ("/logout", "GET", [], "Missing CSRF token", [352]),
    (
        "/api/v1/invite",
        "POST",
        ["email", "role"],
        "Privilege escalation via role param",
        [269],
    ),
]


IAC_RULES: List[Tuple[str, str, str, str, int]] = [
    ("CKV_AWS_20", "S3 Bucket has public ACL", "aws_s3_bucket.public_assets", "aws", 3),
    (
        "CKV_AWS_21",
        "S3 Bucket versioning is not enabled",
        "aws_s3_bucket.backups",
        "aws",
        2,
    ),
    (
        "CKV_AWS_40",
        "IAM policy allows '*' on all resources",
        "aws_iam_policy.app_admin",
        "aws",
        4,
    ),
    (
        "CKV_AWS_23",
        "Security group allows 0.0.0.0/0 on port 22",
        "aws_security_group.public_ssh",
        "aws",
        4,
    ),
    (
        "CKV_AWS_16",
        "RDS instance not encrypted at rest",
        "aws_db_instance.prod_pg",
        "aws",
        3,
    ),
    (
        "CKV_AZURE_50",
        "NSG has SSH open to Internet",
        "azurerm_network_security_group.default",
        "azure",
        4,
    ),
    (
        "CKV_GCP_2",
        "GKE cluster has legacy ABAC enabled",
        "google_container_cluster.primary",
        "gcp",
        3,
    ),
    ("CKV_K8S_8", "LivenessProbe not configured", "Deployment/nginx", "kubernetes", 2),
    ("CKV_K8S_9", "ReadinessProbe not configured", "Deployment/api", "kubernetes", 2),
    (
        "CKV_K8S_20",
        "Containers should not run as root",
        "Deployment/backend",
        "kubernetes",
        3,
    ),
    (
        "CKV_K8S_37",
        "Containers admitted with CAP_SYS_ADMIN",
        "DaemonSet/node-agent",
        "kubernetes",
        4,
    ),
    ("CKV_K8S_43", "Image should use digest", "Deployment/checkout", "kubernetes", 2),
    ("CKV_DOCKER_3", "Container should not run as root", "Dockerfile", "docker", 3),
    ("CKV_DOCKER_7", "Latest tag should not be used", "Dockerfile", "docker", 1),
]


SECRET_TYPES: List[Tuple[str, str, str]] = [
    ("aws_access_key", "AWS Access Key ID", "AKIAIOSFODNN7EXAMPLE"),
    (
        "aws_secret_key",
        "AWS Secret Access Key",
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    ),
    (
        "github_pat",
        "GitHub Personal Access Token",
        "ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    ("github_oauth", "GitHub OAuth Token", "gho_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ("gitlab_pat", "GitLab Personal Access Token", "glpat-XXXXXXXXXXXXXXXXXXXX"),
    (
        "slack_webhook",
        "Slack Incoming Webhook",
        "https://hooks.slack.com/services/T000/B000/XXXXXX",
    ),
    (
        "slack_token",
        "Slack Bot Token",
        "xoxb-1234567890-1234567890-XXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    ("stripe_key", "Stripe Live Secret Key", "sk_live_XXXXXXXXXXXXXXXXXXXXXXXX"),
    ("google_api_key", "Google API Key", "AIzaSyA-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    (
        "sendgrid_key",
        "SendGrid API Key",
        "SG.XXXXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    (
        "private_key",
        "Private Key PEM",
        "-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...",
    ),
    ("jwt_secret", "JWT Signing Secret", "super-secret-jwt-signing-key-do-not-commit"),
    ("npm_token", "NPM Auth Token", "npm_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ("pypi_token", "PyPI API Token", "pypi-AgENdGVzdC5weXBpLm9yZwXXXXXXXXXX"),
    (
        "dockerhub_token",
        "DockerHub Access Token",
        "dckr_pat_XXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    (
        "database_url",
        "Database Connection String",
        "postgres://db.prod.internal:5432/app/app",
    ),
    ("ssh_private_key", "SSH Private Key", "-----BEGIN OPENSSH PRIVATE KEY-----"),
]


SECRET_FILES: List[str] = [
    ".env",
    ".env.production",
    ".env.local",
    "config/secrets.yaml",
    "config/database.yml",
    "docker-compose.override.yml",
    "terraform/terraform.tfvars",
    "ansible/group_vars/all.yml",
    "scripts/deploy.sh",
    "README.md",
    ".npmrc",
    ".pypirc",
    "src/config/constants.ts",
    "backend/config/config.go",
    "k8s/secret.yaml",
    "helm/values.yaml",
]


# =============================================================================
# ГЕНЕРАЦИЯ
# =============================================================================


def pick_weighted(items: Sequence[Any], weights: Sequence[float]) -> Any:
    return random.choices(items, weights=weights, k=1)[0]


def rand_hex(n: int) -> str:
    return "".join(random.choices("0123456789abcdef", k=n))


def rand_semver() -> str:
    return f"{random.randint(0, 4)}.{random.randint(0, 30)}.{random.randint(0, 60)}"


def bump_version(version: str) -> str:
    parts = version.split(".")
    if len(parts) != 3:
        return version + ".1"
    try:
        parts[-1] = str(int(parts[-1]) + random.randint(1, 5))
    except ValueError:
        return version + ".1"
    return ".".join(parts)


def weighted_int(weights: Dict[int, float]) -> int:
    return int(pick_weighted(list(weights.keys()), list(weights.values())))


def random_seen_pair(max_first_seen_days: int = 180) -> Tuple[str, str]:
    now = datetime.now(timezone.utc)
    first_delta = timedelta(
        days=random.uniform(0, max_first_seen_days), seconds=random.uniform(0, 86400)
    )
    first_seen_dt = now - first_delta
    span_seconds = max(0.0, (now - first_seen_dt).total_seconds())
    last_seen_dt = first_seen_dt + timedelta(seconds=random.uniform(0, span_seconds))
    return (
        first_seen_dt.isoformat(timespec="seconds").replace("+00:00", "Z"),
        last_seen_dt.isoformat(timespec="seconds").replace("+00:00", "Z"),
    )


def purl_component(component: str) -> str:
    return component.replace("/", "%2F")


def make_sca_finding() -> Dict[str, Any]:
    ecosystem = random.choice(list(SCA_COMPONENTS.keys()))
    component = random.choice(SCA_COMPONENTS[ecosystem])
    version = rand_semver()

    specific_cves = COMPONENT_TO_CVES.get(component)
    if specific_cves:
        cves = random.sample(
            specific_cves, k=random.randint(1, min(3, len(specific_cves)))
        )
    else:
        cves = [random.choice(SCA_CVES)]

    if random.random() < 0.25:
        cves.append(random.choice(KEV_CVES))
        cves = list(dict.fromkeys(cves))

    cwe_id, _ = random.choice(CWE_POOL)

    finding: Dict[str, Any] = {
        "kind": "sca",
        "title": f"Vulnerable dependency: {component}@{version}",
        "description": (
            f"Known vulnerability detected in {component} version {version}. "
            "Fixed versions are available upstream."
        ),
        "severity": weighted_int({1: 0.15, 2: 0.35, 3: 0.35, 4: 0.15}),
        "confidence": weighted_int({1: 0.2, 2: 0.5, 3: 0.3}),
        "component": component,
        "component_version": version,
        "cve_ids": cves,
        "cwe_ids": [cwe_id],
        "cpe_uri": f"cpe:2.3:a:*:{component}:{version}:*:*:*:*:*:*:*",
        "package_ecosystem": ecosystem,
        "purl": f"pkg:{ecosystem}/{purl_component(component)}@{version}",
        "rule_id": f"{ecosystem.upper()}-SCA-{cves[0]}",
        "rule_name": f"Vulnerable {ecosystem} package",
        "source_type": random.choice(["trivy", "grype", "snyk", "dependency-check"]),
    }
    if random.random() < 0.75:
        finding["fixed_version"] = bump_version(version)
    return finding


def make_sast_finding() -> Dict[str, Any]:
    rule_id, title, cwes = random.choice(SAST_RULES)
    file_path = random.choice(SAST_FILE_PATHS)
    line_start = random.randint(10, 900)
    line_end = line_start + random.randint(0, 15)

    source = "semgrep"
    if rule_id.startswith("gosec."):
        source = "gosec"
    elif rule_id.startswith("bandit."):
        source = "bandit"
    elif rule_id.startswith("eslint"):
        source = "eslint"
    elif rule_id.startswith("brakeman"):
        source = "brakeman"

    cves: List[str] = []
    if random.random() < 0.10:
        cves.append(random.choice(SCA_CVES))

    return {
        "kind": "sast",
        "title": title,
        "description": f"Rule '{rule_id}' matched at {file_path}:{line_start}. Review security impact.",
        "severity": weighted_int({1: 0.15, 2: 0.40, 3: 0.35, 4: 0.10}),
        "confidence": weighted_int({0: 0.05, 1: 0.25, 2: 0.55, 3: 0.15}),
        "file_path": file_path,
        "line_start": line_start,
        "line_end": line_end,
        "cve_ids": cves,
        "cwe_ids": cwes,
        "rule_id": rule_id,
        "rule_name": title,
        "code_snippet": random.choice(SAST_SNIPPETS),
        "source_type": source,
    }


def make_dast_finding() -> Dict[str, Any]:
    path, method, params, issue, cwes = random.choice(DAST_ENDPOINTS)
    host = random.choice(
        ["https://app.local", "https://staging.example.com", "https://api.example.com"]
    )
    param = random.choice(params) if params else ""
    query = f"?{param}=FUZZ" if param and method == "GET" else ""
    url = f"{host}{path}{query}"

    return {
        "kind": "dast",
        "title": issue,
        "description": f"{issue} identified while fuzzing {method} {path}. Manual verification is recommended.",
        "severity": weighted_int({1: 0.20, 2: 0.45, 3: 0.30, 4: 0.05}),
        "confidence": weighted_int({0: 0.05, 1: 0.20, 2: 0.50, 3: 0.25}),
        "cve_ids": [],
        "cwe_ids": cwes,
        "url": url,
        "http_method": method,
        "http_param": param or None,
        "http_evidence": {
            "request": f"{method} {path}{query} HTTP/1.1\nHost: {host.split('//')[1]}\nUser-Agent: RedLycoris-Seeder/{APP_VERSION}\n\n",
            "response": "HTTP/1.1 200 OK\nContent-Type: text/html\n\n<reflected>FUZZ</reflected>",
        },
        "rule_id": f"DAST-{cwes[0]}",
        "rule_name": issue,
        "source_type": random.choice(["zap", "burp", "nuclei", "acunetix"]),
    }


def make_iac_finding() -> Dict[str, Any]:
    rule_id, title, resource, provider, severity = random.choice(IAC_RULES)
    cwe_id = random.choice([732, 284, 16, 200, 306])
    file_path_map = {
        "aws": random.choice(
            ["terraform/main.tf", "infra/aws/s3.tf", "infra/aws/iam.tf"]
        ),
        "azure": random.choice(["terraform/azure.tf", "infra/azure/storage.tf"]),
        "gcp": random.choice(["terraform/gcp.tf", "infra/gcp/compute.tf"]),
        "kubernetes": random.choice(
            ["k8s/deployment.yaml", "k8s/service.yaml", "helm/values.yaml"]
        ),
        "docker": "Dockerfile",
    }
    return {
        "kind": "iac",
        "title": title,
        "description": f"Infrastructure misconfiguration: {title}. Policy {rule_id} failed for resource {resource}.",
        "severity": severity,
        "confidence": 3,
        "file_path": file_path_map.get(provider, "iac/unknown.tf"),
        "line_start": random.randint(1, 120),
        "cve_ids": [],
        "cwe_ids": [cwe_id],
        "iac_resource": resource,
        "iac_provider": provider,
        "rule_id": rule_id,
        "rule_name": title,
        "source_type": random.choice(["checkov", "tfsec", "kics", "terrascan"]),
    }


def make_secret_finding() -> Dict[str, Any]:
    kind, rule_name, _example = random.choice(SECRET_TYPES)
    file_path = random.choice(SECRET_FILES)
    line = random.randint(1, 200)
    return {
        "kind": "secrets",
        "title": f"Potential leak: {rule_name}",
        "description": f"Detected credential-like pattern ({kind}) in {file_path}. Verify and rotate the secret.",
        "severity": weighted_int({2: 0.15, 3: 0.55, 4: 0.30}),
        "confidence": weighted_int({1: 0.1, 2: 0.4, 3: 0.5}),
        "file_path": file_path,
        "line_start": line,
        "line_end": line,
        "cve_ids": [],
        "cwe_ids": [798, 522],
        "secret_kind": kind,
        "commit_sha": rand_hex(40),
        "rule_id": f"gitleaks.{kind}",
        "rule_name": rule_name,
        "source_type": random.choice(["gitleaks", "trufflehog", "detect-secrets"]),
    }


KIND_GENERATORS: Dict[str, Callable[[], Dict[str, Any]]] = {
    "sca": make_sca_finding,
    "sast": make_sast_finding,
    "dast": make_dast_finding,
    "iac": make_iac_finding,
    "secrets": make_secret_finding,
}


DEFAULT_DISTRIBUTION: Dict[str, float] = {
    "sca": 0.45,
    "sast": 0.25,
    "dast": 0.12,
    "iac": 0.12,
    "secrets": 0.06,
}


def parse_kinds(value: str) -> List[str]:
    kinds = [k.strip().lower() for k in value.split(",") if k.strip()]
    if not kinds:
        raise argparse.ArgumentTypeError("список типов findings не может быть пустым")
    unknown = [k for k in kinds if k not in KIND_GENERATORS]
    if unknown:
        raise argparse.ArgumentTypeError(
            f"неизвестные типы: {', '.join(unknown)}. Поддерживаются: {', '.join(sorted(KIND_GENERATORS))}"
        )
    return kinds


def parse_distribution(value: Optional[str]) -> Dict[str, float]:
    if not value:
        return dict(DEFAULT_DISTRIBUTION)
    out: Dict[str, float] = {}
    for pair in value.split(","):
        pair = pair.strip()
        if not pair:
            continue
        if "=" not in pair:
            raise argparse.ArgumentTypeError(
                f"некорректный элемент distribution: {pair!r}"
            )
        key, raw_weight = pair.split("=", 1)
        key = key.strip().lower()
        if key not in KIND_GENERATORS:
            raise argparse.ArgumentTypeError(f"неизвестный тип в distribution: {key}")
        try:
            weight = float(raw_weight)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(
                f"некорректный вес для {key}: {raw_weight}"
            ) from exc
        if weight < 0:
            raise argparse.ArgumentTypeError(
                f"вес для {key} не может быть отрицательным"
            )
        out[key] = weight
    return out or dict(DEFAULT_DISTRIBUTION)


def generate_findings(
    total: int, kinds: Sequence[str], distribution: Dict[str, float]
) -> List[Dict[str, Any]]:
    filtered = {kind: distribution.get(kind, 0.0) for kind in kinds}
    total_weight = sum(filtered.values())
    if total_weight <= 0:
        filtered = {kind: 1.0 for kind in kinds}
        total_weight = float(len(kinds))

    normalized = {kind: weight / total_weight for kind, weight in filtered.items()}
    keys = list(normalized.keys())
    weights = list(normalized.values())

    findings: List[Dict[str, Any]] = []
    for _ in range(total):
        kind = pick_weighted(keys, weights)
        finding = KIND_GENERATORS[kind]()
        first_seen, last_seen = random_seen_pair(180)
        finding.setdefault("first_seen", first_seen)
        finding.setdefault("last_seen", last_seen)
        finding["status"] = weighted_int({0: 0.70, 1: 0.10, 2: 0.05, 3: 0.10, 4: 0.05})
        findings.append(finding)
    return findings


# =============================================================================
# HTTP / API
# =============================================================================


class APIError(RuntimeError):
    pass


def validate_http_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise APIError(f"неподдерживаемая схема URL: {parsed.scheme!r}")
    if not parsed.netloc:
        raise APIError(f"URL должен быть абсолютным и содержать host: {url!r}")
    return url


def http_request(
    method: str,
    url: str,
    body: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 30.0,
    max_retries: int = 4,
    verbose: bool = False,
) -> Any:
    safe_url = validate_http_url(url)
    req_headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": f"RedLycoris-VulnSeeder/{APP_VERSION}",
    }
    if headers:
        req_headers.update(headers)

    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")

    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        request = urllib.request.Request(
            url=safe_url, data=data, headers=req_headers, method=method
        )
        if verbose:
            log("ИНФО", f"HTTP {method} {safe_url}, попытка {attempt}/{max_retries}")

        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                if not raw:
                    return None
                text = raw.decode("utf-8", errors="replace")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return text

        except urllib.error.HTTPError as exc:
            body_text = ""
            try:
                body_text = exc.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            if 400 <= exc.code < 500 and exc.code != 429:
                raise APIError(
                    f"HTTP {exc.code} при {method} {safe_url}: {body_text[:500]}"
                ) from exc
            last_error = APIError(f"HTTP {exc.code}: {body_text[:300]}")

        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc

        sleep_seconds = min(8.0, 0.5 * (2 ** (attempt - 1))) + random.uniform(0, 0.3)
        if verbose:
            log(
                "ВНИМАНИЕ",
                f"Запрос не удался, повтор через {sleep_seconds:.1f} сек: {last_error}",
            )
        time.sleep(sleep_seconds)

    raise APIError(
        f"Не удалось выполнить {method} {safe_url} после {max_retries} попыток: {last_error}"
    )


def create_project(
    api_url: str,
    definition: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float,
    verbose: bool,
) -> str:
    payload = {
        "name": definition["name"] + "-" + rand_hex(4),
        "description": definition.get("description", ""),
        "tags": definition.get("tags", []),
    }
    response = http_request(
        "POST",
        api_url.rstrip("/") + "/api/v1/projects",
        body=payload,
        headers=headers,
        timeout=timeout,
        verbose=verbose,
    )
    if not isinstance(response, dict) or "data" not in response:
        raise APIError(f"неожиданный ответ при создании проекта: {response!r}")
    project_id = response["data"].get("id")
    if not project_id:
        raise APIError(f"в ответе создания проекта нет data.id: {response!r}")
    return project_id


def import_batch(
    api_url: str,
    project_id: str,
    findings: List[Dict[str, Any]],
    headers: Dict[str, str],
    timeout: float,
    verbose: bool,
) -> Dict[str, Any]:
    payload = {
        "project_id": project_id,
        "source_type": "generic",
        "findings": findings,
    }
    url = f"{api_url.rstrip('/')}/api/v1/import?project_id={project_id}"
    response = http_request(
        "POST", url, body=payload, headers=headers, timeout=timeout, verbose=verbose
    )
    return response if isinstance(response, dict) else {"raw": response}


# =============================================================================
# ПРОГРЕСС
# =============================================================================


def term_width(default: int = 80) -> int:
    try:
        return max(40, os.get_terminal_size().columns)
    except OSError:
        return default


def progress(done: int, total: int, prefix: str = "") -> None:
    width = max(10, term_width() - len(prefix) - 30)
    frac = 0.0 if total == 0 else min(1.0, done / total)
    filled = int(frac * width)
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\r{prefix} [{bar}] {done}/{total} ({frac * 100:5.1f}%)")
    sys.stdout.flush()
    if done >= total:
        sys.stdout.write("\n")


# =============================================================================
# CLI / ОСНОВНАЯ ЛОГИКА
# =============================================================================


@dataclass
class Config:
    api_url: str
    count: int
    batch_size: int
    project_id: Optional[str]
    project_count: int
    kinds: List[str]
    distribution: Dict[str, float]
    output: Optional[str]
    seed: Optional[int]
    auth_token: Optional[str]
    auth_cookie: Optional[str]
    timeout: float
    dry_run: bool
    yes: bool
    fail_on_import_errors: bool
    quiet: bool
    verbose: bool
    extra_headers: Dict[str, str] = field(default_factory=dict)


def parse_args(argv: Optional[Sequence[str]] = None) -> Config:
    epilog = """
Примеры:

  Сгенерировать 1000 findings и отправить в локальный Red Lycoris:
    python vuln_seeder_ru.py --api-url http://localhost:8080 --count 1000 --yes

  Сгенерировать findings только в файл, без отправки в API:
    python vuln_seeder_ru.py --count 200 --output findings.json --dry-run

  Отправить findings в конкретный проект:
    python vuln_seeder_ru.py \\
      --api-url http://localhost:8080 \\
      --project-id 11111111-2222-3333-4444-555555555555 \\
      --count 5000 \\
      --batch-size 500 \\
      --kinds sca,sast \\
      --yes

  Задать распределение типов findings:
    python vuln_seeder_ru.py \\
      --count 10000 \\
      --distribution sca=0.55,sast=0.25,dast=0.10,iac=0.07,secrets=0.03 \\
      --yes

  Использовать Bearer token:
    python vuln_seeder_ru.py --auth-token eyJhbGciOi... --count 1000 --yes

  Использовать session cookie:
    python vuln_seeder_ru.py --auth-cookie 'rl_session=...' --count 1000 --yes

Безопасность:
  Онлайн-импорт по умолчанию требует --yes или ручное подтверждение словом seed.
  Это защита от случайной заливки тестовых данных в живую среду.
"""
    parser = argparse.ArgumentParser(
        prog="vuln_seeder_ru.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=f"{APP_NAME} — генератор тестовых уязвимостей для ASOC-платформы.",
        epilog=epilog,
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("ASOC_API_URL", "http://localhost:8080"),
        help="Base URL API. По умолчанию: %(default)s. Env: ASOC_API_URL",
    )
    parser.add_argument(
        "--count",
        type=positive_int,
        default=1000,
        help="Сколько findings сгенерировать. По умолчанию: %(default)s",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        default=500,
        help="Размер батча при импорте. По умолчанию: %(default)s",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="UUID существующего проекта. Если указан — проекты автоматически не создаются.",
    )
    parser.add_argument(
        "--project-count",
        type=positive_int,
        default=5,
        help="Сколько проектов создать автоматически, если не указан --project-id. По умолчанию: %(default)s",
    )
    parser.add_argument(
        "--kinds",
        type=parse_kinds,
        default=parse_kinds("sca,sast,dast,iac,secrets"),
        help="Типы findings через запятую: sca,sast,dast,iac,secrets. По умолчанию: все",
    )
    parser.add_argument(
        "--distribution",
        default=None,
        help="Веса типов findings. Пример: sca=0.5,sast=0.3,dast=0.2",
    )
    parser.add_argument(
        "--output", help="Сохранить сгенерированный Generic JSON payload в файл."
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Seed для воспроизводимой генерации dataset.",
    )
    parser.add_argument(
        "--auth-token",
        default=os.environ.get("ASOC_AUTH_TOKEN"),
        help="Bearer token для API. Env: ASOC_AUTH_TOKEN",
    )
    parser.add_argument(
        "--auth-cookie",
        default=os.environ.get("ASOC_AUTH_COOKIE"),
        help="Cookie для API, например 'rl_session=...'. Env: ASOC_AUTH_COOKIE",
    )
    parser.add_argument(
        "--header",
        action="append",
        type=parse_header,
        default=[],
        help="Дополнительный HTTP-заголовок в формате 'Name: Value'. Можно указать несколько раз.",
    )
    parser.add_argument(
        "--timeout",
        type=positive_float,
        default=30.0,
        help="HTTP timeout в секундах. По умолчанию: %(default)s",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Только сгенерировать данные. Ничего не отправлять в API.",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Подтвердить онлайн-импорт без интерактивного вопроса.",
    )
    parser.add_argument(
        "--fail-on-import-errors",
        action="store_true",
        help="Завершить скрипт с ошибкой, если API вернул ошибки импорта.",
    )
    parser.add_argument("-q", "--quiet", action="store_true", help="Минимум логов.")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Подробные HTTP/diagnostic логи."
    )
    parser.add_argument(
        "--version", action="version", version=f"{APP_NAME} {APP_VERSION}"
    )

    args = parser.parse_args(argv)
    extra_headers: Dict[str, str] = {}
    for name, value in args.header:
        extra_headers[name] = value

    return Config(
        api_url=args.api_url,
        count=args.count,
        batch_size=args.batch_size,
        project_id=args.project_id,
        project_count=args.project_count,
        kinds=args.kinds,
        distribution=parse_distribution(args.distribution),
        output=args.output,
        seed=args.seed,
        auth_token=args.auth_token,
        auth_cookie=args.auth_cookie,
        timeout=args.timeout,
        dry_run=args.dry_run,
        yes=args.yes,
        fail_on_import_errors=args.fail_on_import_errors,
        quiet=args.quiet,
        verbose=args.verbose,
        extra_headers=extra_headers,
    )


def validate_uuid(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError as exc:
        raise SystemExit(f"[ОШИБКА] Некорректный UUID проекта: {value}") from exc


def build_headers(cfg: Config) -> Dict[str, str]:
    headers = dict(cfg.extra_headers)
    if cfg.auth_token:
        headers["Authorization"] = f"Bearer {cfg.auth_token}"
    if cfg.auth_cookie:
        headers["Cookie"] = cfg.auth_cookie
    return headers


def confirm_online_import(cfg: Config) -> None:
    if cfg.dry_run or cfg.yes:
        return
    log("ВНИМАНИЕ", "Скрипт сейчас отправит тестовые findings в API.")
    log("ВНИМАНИЕ", f"API: {cfg.api_url}")
    log("ВНИМАНИЕ", f"Количество findings: {cfg.count}")
    log("ВНИМАНИЕ", f"Типы: {', '.join(cfg.kinds)}")
    if cfg.project_id:
        log("ВНИМАНИЕ", f"Проект: {cfg.project_id}")
    else:
        log("ВНИМАНИЕ", f"Будет создано проектов: {cfg.project_count}")
    answer = input("Для подтверждения введи 'seed': ").strip()
    if answer != "seed":
        die("Импорт отменён пользователем.", exit_code=130)


def ensure_projects(cfg: Config, headers: Dict[str, str]) -> List[str]:
    if cfg.project_id:
        return [validate_uuid(cfg.project_id)]
    if cfg.dry_run:
        return [str(uuid.uuid4()) for _ in range(cfg.project_count)]

    definitions: List[Dict[str, Any]] = []
    for index in range(cfg.project_count):
        base = DEFAULT_PROJECTS[index % len(DEFAULT_PROJECTS)]
        definitions.append(
            {
                "name": base["name"],
                "description": base["description"],
                "tags": list(base.get("tags", [])) + ["seed"],
            }
        )

    ids: List[str] = []
    log("ИНФО", f"Создаю тестовые проекты: {len(definitions)}", quiet=cfg.quiet)
    for definition in definitions:
        try:
            project_id = create_project(
                cfg.api_url, definition, headers, cfg.timeout, cfg.verbose
            )
            if cfg.verbose:
                log("ОК", f"Проект создан: {definition['name']!r} → {project_id}")
            ids.append(project_id)
        except APIError as exc:
            log("ОШИБКА", f"Не удалось создать проект {definition['name']!r}: {exc}")

    if not ids:
        die("Нет доступных проектов для импорта. Завершаю работу.")
    return ids


def save_offline(
    cfg: Config, project_ids: List[str], findings: List[Dict[str, Any]]
) -> None:
    if not cfg.output:
        return

    payload = {
        "project_id": project_ids[0],
        "source_type": "generic",
        "findings": findings,
    }
    output_path = os.path.abspath(str(cfg.output))
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    tmp_path = output_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    os.replace(tmp_path, output_path)
    log("ОК", f"Generic JSON сохранён: {output_path} findings={len(findings)}")


def push_online(
    cfg: Config, project_ids: List[str], findings: List[Dict[str, Any]]
) -> Tuple[int, int, int]:
    headers = build_headers(cfg)
    total = len(findings)
    done = 0
    imported_total = 0
    updated_total = 0
    errors_total = 0

    per_project: Dict[str, List[Dict[str, Any]]] = {
        project_id: [] for project_id in project_ids
    }
    for index, finding in enumerate(findings):
        project_id = project_ids[index % len(project_ids)]
        per_project[project_id].append(finding)

    started_at = time.monotonic()
    for project_id, items in per_project.items():
        if not items:
            continue
        if cfg.verbose:
            log("ИНФО", f"Импорт в проект {project_id}: findings={len(items)}")
        for start in range(0, len(items), cfg.batch_size):
            batch = items[start : start + cfg.batch_size]
            try:
                response = import_batch(
                    cfg.api_url, project_id, batch, headers, cfg.timeout, cfg.verbose
                )
                imported_total += int(response.get("imported", 0) or 0)
                updated_total += int(response.get("updated", 0) or 0)
                errors = response.get("errors") or []
                errors_total += len(errors)
                if cfg.verbose and errors:
                    for error in errors[:10]:
                        log(
                            "ВНИМАНИЕ",
                            f"Ошибка импорта: index={error.get('index')} message={error.get('message')}",
                        )
            except APIError as exc:
                log("ОШИБКА", f"Батч не импортирован project={project_id}: {exc}")
                errors_total += len(batch)
            done += len(batch)
            if not cfg.quiet:
                progress(done, total, prefix="    Импорт")

    elapsed = time.monotonic() - started_at
    rate = total / elapsed if elapsed > 0 else 0.0
    log(
        "ОК" if errors_total == 0 else "ВНИМАНИЕ",
        f"Импорт завершён за {elapsed:.1f} сек ({rate:.0f} findings/sec), imported={imported_total}, updated={updated_total}, errors={errors_total}",
    )
    return imported_total, updated_total, errors_total


def print_stats(findings: List[Dict[str, Any]], *, quiet: bool = False) -> None:
    if quiet:
        return
    by_kind: Dict[str, int] = {}
    by_severity: Dict[int, int] = {}
    unique_cves = set()
    with_cve = 0
    for finding in findings:
        by_kind[finding["kind"]] = by_kind.get(finding["kind"], 0) + 1
        by_severity[finding["severity"]] = by_severity.get(finding["severity"], 0) + 1
        cves = finding.get("cve_ids") or []
        if cves:
            with_cve += 1
            unique_cves.update(cves)

    severity_names = {0: "info", 1: "low", 2: "medium", 3: "high", 4: "critical"}
    print("Статистика dataset:")
    print(
        "  По типам:       "
        + ", ".join(f"{key}={value}" for key, value in sorted(by_kind.items()))
    )
    print(
        "  По severity:    "
        + ", ".join(
            f"{severity_names.get(key, str(key))}={value}"
            for key, value in sorted(by_severity.items())
        )
    )
    print(f"  С CVE:          {with_cve}/{len(findings)}")
    print(f"  Уникальных CVE: {len(unique_cves)}")


def main(argv: Optional[Sequence[str]] = None) -> int:
    cfg = parse_args(argv)

    if cfg.seed is not None:
        random.seed(cfg.seed)
        log("ИНФО", f"Использую seed={cfg.seed}", quiet=cfg.quiet)

    validate_http_url(cfg.api_url)
    confirm_online_import(cfg)

    log(
        "ИНФО",
        f"Генерирую findings: count={cfg.count}, kinds={','.join(cfg.kinds)}, batch_size={cfg.batch_size}",
        quiet=cfg.quiet,
    )
    findings = generate_findings(cfg.count, cfg.kinds, cfg.distribution)
    log("ОК", f"Findings сгенерированы: {len(findings)}", quiet=cfg.quiet)
    print_stats(findings, quiet=cfg.quiet)

    if cfg.output:
        offline_project_id = cfg.project_id or str(uuid.uuid4())
        save_offline(cfg, [offline_project_id], findings)

    if cfg.dry_run:
        log("ИНФО", "Режим --dry-run: отправка в API пропущена.", quiet=cfg.quiet)
        return 0

    headers = build_headers(cfg)
    project_ids = ensure_projects(cfg, headers)
    imported_total, updated_total, errors_total = push_online(
        cfg, project_ids, findings
    )

    if cfg.fail_on_import_errors and errors_total > 0:
        die(
            f"Импорт завершился с ошибками: imported={imported_total}, updated={updated_total}, errors={errors_total}",
            exit_code=2,
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("ВНИМАНИЕ", "Остановлено пользователем.")
        sys.exit(130)
    except APIError as exc:
        die(str(exc))
