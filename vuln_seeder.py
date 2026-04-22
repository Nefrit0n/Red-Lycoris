#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vuln_seeder.py — генератор тестовых уязвимостей для ASOC/DefectDojo-like платформ.

Назначение
----------
Наполнение проекта реалистичными findings всех типов (SCA / SAST / DAST / IaC /
Secrets) с РЕАЛЬНЫМИ CVE и CWE — чтобы механизм enrichment (NVD, EPSS, CISA KEV,
BDU/ФСТЭК, OSV, CWE) нашёл максимум совпадений при обогащении.

Целевой формат импорта — универсальный "Generic JSON":
    {
      "project_id": "<uuid>",
      "source_type": "<scanner>",
      "findings": [ { ... } ]
    }

Совместимость
-------------
- Python >= 3.8
- Только stdlib (urllib, argparse, json, uuid, random, time)
- Проект-независимый: положил файл куда угодно и запустил

Быстрый старт
-------------
    # 1000 findings в локальный RedLycoris (создаст 5 проектов автоматически)
    python vuln_seeder.py --api-url http://localhost:8080 --count 1000

    # В конкретный проект, только SCA и SAST, батчи по 500
    python vuln_seeder.py --count 5000 \
        --project-id 11111111-2222-3333-4444-555555555555 \
        --kinds sca,sast --batch-size 500

    # Офлайн — сохранить JSON-файл без отправки
    python vuln_seeder.py --count 200 --output findings.json --dry-run

    # С авторизацией (Bearer) и нестандартным таймаутом
    python vuln_seeder.py --count 10000 --auth-token eyJhbGciOi... --timeout 60

Автор: AppSec / DevSecOps utility.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple


# =====================================================================
# 1. ПУЛЫ ДАННЫХ
# =====================================================================
# Всё что ниже — реально существующие CVE/CWE/правила сканеров/пакеты.
# Это даёт высокий процент hit'ов при обогащении NVD/EPSS/KEV/BDU/OSV.

# ----- Проекты по умолчанию ------------------------------------------
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
        "tags": ["python", "spark", "etl"],
    },
    {
        "name": "billing-service",
        "description": "Billing, subscriptions and payments",
        "tags": ["go", "backend", "payments"],
    },
    {
        "name": "identity-provider",
        "description": "SSO / OIDC identity broker",
        "tags": ["java", "security", "iam"],
    },
    {
        "name": "ml-inference",
        "description": "Online model inference service",
        "tags": ["python", "ml", "gpu"],
    },
]


# ----- CVE пулы: только РЕАЛЬНЫЕ ID (есть в NVD, большинство и в KEV/EPSS) ---
# Источники: CISA KEV, крупные публичные инциденты, CVE Top-50.
KEV_CVES: List[str] = [
    # 2024
    "CVE-2024-3094",
    "CVE-2024-21626",
    "CVE-2024-23897",
    "CVE-2024-27198",
    "CVE-2024-21887",
    "CVE-2024-21412",
    "CVE-2024-3400",
    "CVE-2024-24919",
    "CVE-2024-20353",
    "CVE-2024-20359",
    "CVE-2024-6387",
    "CVE-2024-4577",
    "CVE-2024-1709",
    "CVE-2024-5806",
    "CVE-2024-1086",
    "CVE-2024-4978",
    "CVE-2024-49138",
    "CVE-2024-30088",
    "CVE-2024-38080",
    "CVE-2024-38112",
    # 2023
    "CVE-2023-4863",
    "CVE-2023-34362",
    "CVE-2023-46805",
    "CVE-2023-44487",
    "CVE-2023-38545",
    "CVE-2023-22527",
    "CVE-2023-42793",
    "CVE-2023-50164",
    "CVE-2023-20198",
    "CVE-2023-27997",
    "CVE-2023-0669",
    "CVE-2023-3519",
    "CVE-2023-2868",
    "CVE-2023-35078",
    "CVE-2023-45133",
    "CVE-2023-22515",
    "CVE-2023-28252",
    "CVE-2023-23397",
    "CVE-2023-36884",
    "CVE-2023-29357",
    "CVE-2023-24489",
    "CVE-2023-49103",
    "CVE-2023-4966",
    "CVE-2023-20269",
    # 2022
    "CVE-2022-22965",
    "CVE-2022-26134",
    "CVE-2022-30190",
    "CVE-2022-1388",
    "CVE-2022-42475",
    "CVE-2022-47966",
    "CVE-2022-41040",
    "CVE-2022-41082",
    "CVE-2022-26925",
    "CVE-2022-29464",
    "CVE-2022-47986",
    "CVE-2022-0492",
    "CVE-2022-22963",
    "CVE-2022-42889",
    "CVE-2022-22947",
    "CVE-2022-40684",
    # 2021
    "CVE-2021-44228",
    "CVE-2021-45046",
    "CVE-2021-44832",
    "CVE-2021-4034",
    "CVE-2021-26084",
    "CVE-2021-34527",
    "CVE-2021-34473",
    "CVE-2021-26855",
    "CVE-2021-40539",
    "CVE-2021-22205",
    "CVE-2021-21972",
    "CVE-2021-42013",
    "CVE-2021-41773",
    "CVE-2021-3156",
    "CVE-2021-20028",
    # 2020 и ранее (legacy, часто до сих пор живут в зависимостях)
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

# CVE для SCA-пула (популярные библиотеки) — часто встречается в Dependency-Check/Trivy
SCA_CVES: List[str] = [
    # log4j
    "CVE-2021-44228",
    "CVE-2021-45046",
    "CVE-2021-44832",
    "CVE-2021-45105",
    # Spring
    "CVE-2022-22965",
    "CVE-2022-22963",
    "CVE-2022-22947",
    "CVE-2016-1000027",
    # lodash
    "CVE-2019-10744",
    "CVE-2020-8203",
    "CVE-2018-16487",
    "CVE-2021-23337",
    # Jackson
    "CVE-2019-12384",
    "CVE-2020-36518",
    "CVE-2022-42003",
    "CVE-2022-42004",
    # requests / urllib3
    "CVE-2023-32681",
    "CVE-2023-43804",
    "CVE-2023-45803",
    "CVE-2024-35195",
    # Django / Flask / Werkzeug / Jinja2
    "CVE-2023-43665",
    "CVE-2023-46136",
    "CVE-2023-30861",
    "CVE-2024-22195",
    # Rails / Rack
    "CVE-2022-44572",
    "CVE-2023-27530",
    "CVE-2023-28362",
    "CVE-2024-26141",
    # Node / Express / axios / ws / nth-check / semver / json5
    "CVE-2022-24999",
    "CVE-2024-39338",
    "CVE-2024-37890",
    "CVE-2020-7608",
    "CVE-2022-25883",
    "CVE-2022-46175",
    # OpenSSL / curl / libwebp
    "CVE-2022-0778",
    "CVE-2023-0286",
    "CVE-2023-38545",
    "CVE-2023-4863",
    # Apache Commons
    "CVE-2022-42889",
    "CVE-2021-40438",
    # Tomcat / Netty
    "CVE-2022-42252",
    "CVE-2023-4586",
]


# ----- CWE pool: OWASP Top 25 + CWE Top 25 ---------------------------
CWE_POOL: List[Tuple[int, str]] = [
    (79, "Cross-site Scripting (XSS)"),
    (89, "SQL Injection"),
    (78, "OS Command Injection"),
    (77, "Command Injection"),
    (22, "Path Traversal"),
    (94, "Code Injection"),
    (502, "Deserialization of Untrusted Data"),
    (798, "Use of Hard-coded Credentials"),
    (352, "Cross-Site Request Forgery (CSRF)"),
    (287, "Improper Authentication"),
    (862, "Missing Authorization"),
    (863, "Incorrect Authorization"),
    (284, "Improper Access Control"),
    (639, "Authorization Bypass Through User-Controlled Key"),
    (918, "Server-Side Request Forgery (SSRF)"),
    (611, "XML External Entity (XXE)"),
    (601, "Open Redirect"),
    (434, "Unrestricted Upload of File with Dangerous Type"),
    (327, "Use of a Broken or Risky Cryptographic Algorithm"),
    (328, "Use of Weak Hash"),
    (330, "Use of Insufficiently Random Values"),
    (20, "Improper Input Validation"),
    (200, "Exposure of Sensitive Information"),
    (532, "Insertion of Sensitive Information into Log File"),
    (209, "Generation of Error Message Containing Sensitive Information"),
    (1321, "Prototype Pollution"),
    (400, "Uncontrolled Resource Consumption (DoS)"),
    (732, "Incorrect Permission Assignment for Critical Resource"),
    (276, "Incorrect Default Permissions"),
    (89, "SQL Injection"),
    (125, "Out-of-bounds Read"),
    (787, "Out-of-bounds Write"),
    (416, "Use After Free"),
    (190, "Integer Overflow or Wraparound"),
    (476, "NULL Pointer Dereference"),
    (119, "Improper Restriction of Operations within Bounds of a Memory Buffer"),
    (295, "Improper Certificate Validation"),
    (319, "Cleartext Transmission of Sensitive Information"),
    (306, "Missing Authentication for Critical Function"),
    (522, "Insufficiently Protected Credentials"),
    (798, "Hard-coded Credentials"),
    (770, "Allocation of Resources Without Limits or Throttling"),
]


# ----- SCA: компоненты по экосистемам --------------------------------
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
        "chalk",
        "ws",
        "node-fetch",
        "serialize-javascript",
        "underscore",
        "async",
        "minimist",
        "yargs-parser",
        "handlebars",
        "mongoose",
        "passport",
        "socket.io",
        "cookie",
        "debug",
        "ejs",
        "glob",
        "http-proxy-middleware",
        "marked",
        "node-forge",
        "pug",
        "qs",
        "tough-cookie",
        "y18n",
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
        "scikit-learn",
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
        "pytest",
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
        "junit",
        "mockito-core",
        "xstream",
        "snakeyaml",
        "spring-security-core",
    ],
    "go": [
        "github.com/gin-gonic/gin",
        "github.com/gorilla/mux",
        "github.com/prometheus/client_golang",
        "github.com/sirupsen/logrus",
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
    "nuget": [
        "Newtonsoft.Json",
        "System.Text.Json",
        "Microsoft.AspNetCore.App",
        "Npgsql",
        "Serilog",
        "AutoMapper",
        "EntityFramework",
        "System.Net.Http",
        "Microsoft.Identity.Client",
    ],
    "rubygems": [
        "rails",
        "rack",
        "nokogiri",
        "puma",
        "redis",
        "sidekiq",
        "devise",
        "json",
        "actionpack",
        "activerecord",
        "openssl",
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
        "rand",
        "h2",
        "rustls",
    ],
}

# Отдельный маппинг "имя пакета -> CVE", чтобы связи были правдоподобные
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
    "curl": ["CVE-2023-38545"],
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


# ----- SAST ----------------------------------------------------------
SAST_RULES: List[Tuple[str, str, List[int]]] = [
    # (rule_id, title, cwes)
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
    (
        "semgrep.java.lang.security.audit.ssti-velocity",
        "User input rendered through Velocity template",
        [94],
    ),
    ("gosec.G101", "Hardcoded credentials detected", [798]),
    ("gosec.G102", "Bind to all network interfaces", [200]),
    ("gosec.G104", "Errors unhandled", [703]),
    ("gosec.G201", "SQL query construction using format string", [89]),
    ("gosec.G301", "Poor file permissions used when creating directory", [732]),
    ("gosec.G304", "File path provided as taint input", [22]),
    ("gosec.G401", "Use of weak cryptographic primitive MD5", [327, 328]),
    ("gosec.G402", "TLS InsecureSkipVerify set true", [295]),
    ("gosec.G501", "Blocklisted import crypto/md5", [327]),
    ("bandit.B102", "exec() usage", [94]),
    ("bandit.B301", "pickle — potential insecure deserialization", [502]),
    ("bandit.B307", "Use of possibly insecure function: eval", [94]),
    ("bandit.B311", "Standard pseudo-random generator for security", [330]),
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
    'const q = "SELECT * FROM users WHERE id = \'" + req.params.id + "\'";',
    'db.Query(fmt.Sprintf("SELECT * FROM t WHERE id=%s", id))',
    "tls.Config{InsecureSkipVerify: true}",
    "md5.New().Sum(password)",
    "RestTemplate.getForObject(userUrl, String.class)",
    "DocumentBuilderFactory.newInstance() // DTDs not disabled",
    "requests.get(url, verify=False)",
    'Runtime.getRuntime().exec("sh -c " + input)',
    'System.setProperty("java.naming.provider.url", userInput);',
    'var userHtml = $.parseHTML(input); $("#out").append(userHtml);',
    'document.getElementById("msg").innerHTML = location.hash;',
]


# ----- DAST ----------------------------------------------------------
DAST_ENDPOINTS: List[Tuple[str, str, List[str], str, List[int]]] = [
    # (path, method, params, issue, cwes)
    ("/api/v1/users", "GET", ["id", "filter"], "Reflected XSS", [79]),
    ("/api/v1/search", "GET", ["q"], "SQL Injection (time-based)", [89]),
    ("/api/v1/orders", "GET", ["id"], "IDOR — Broken Access Control", [639, 284]),
    ("/api/v1/profile", "GET", ["email"], "User enumeration", [200]),
    ("/login", "POST", ["username", "password"], "No rate limiting on login", [307]),
    ("/api/v1/upload", "POST", ["file"], "Unrestricted file upload", [434]),
    ("/redirect", "GET", ["url", "next"], "Open Redirect", [601]),
    ("/api/graphql", "POST", ["query"], "GraphQL introspection enabled", [200]),
    ("/admin/panel", "GET", [], "Admin panel accessible without auth", [306]),
    ("/api/v1/products", "GET", ["filter", "sort"], "SQL Injection (UNION)", [89]),
    ("/download", "GET", ["file"], "Path Traversal", [22]),
    ("/api/v1/fetch", "POST", ["url"], "Server-Side Request Forgery", [918]),
    ("/api/v1/webhook", "POST", ["callback"], "SSRF via webhook callback", [918]),
    ("/api/v1/xml", "POST", ["payload"], "XXE via SOAP endpoint", [611]),
    ("/logout", "GET", [], "Missing CSRF token", [352]),
    ("/api/v1/export", "GET", ["format", "path"], "Arbitrary File Read", [22, 200]),
    (
        "/api/v1/invite",
        "POST",
        ["email", "role"],
        "Privilege escalation via role param",
        [269],
    ),
    (
        "/api/v1/token/refresh",
        "POST",
        ["refresh_token"],
        "Weak JWT signing algorithm (HS256 allowed)",
        [327],
    ),
]


# ----- IaC -----------------------------------------------------------
IAC_RULES: List[Tuple[str, str, str, str, int]] = [
    # (rule_id, title, resource, provider, severity 1..4)
    ("CKV_AWS_20", "S3 Bucket has public ACL", "aws_s3_bucket.public_assets", "aws", 3),
    (
        "CKV_AWS_21",
        "S3 Bucket versioning is not enabled",
        "aws_s3_bucket.backups",
        "aws",
        2,
    ),
    ("CKV_AWS_18", "S3 Bucket access logging disabled", "aws_s3_bucket.logs", "aws", 2),
    (
        "CKV_AWS_53",
        "S3 Bucket does not block public ACLs",
        "aws_s3_bucket.data",
        "aws",
        3,
    ),
    (
        "CKV_AWS_40",
        "IAM policy allows '*' on all resources",
        "aws_iam_policy.app_admin",
        "aws",
        4,
    ),
    (
        "CKV_AWS_61",
        "IAM role trust policy is overly permissive",
        "aws_iam_role.lambda_exec",
        "aws",
        3,
    ),
    (
        "CKV_AWS_23",
        "Security group allows 0.0.0.0/0 on port 22",
        "aws_security_group.public_ssh",
        "aws",
        4,
    ),
    (
        "CKV_AWS_24",
        "Security group allows 0.0.0.0/0 on port 3389",
        "aws_security_group.public_rdp",
        "aws",
        4,
    ),
    ("CKV_AWS_145", "KMS key rotation disabled", "aws_kms_key.backups", "aws", 2),
    (
        "CKV_AWS_16",
        "RDS instance not encrypted at rest",
        "aws_db_instance.prod_pg",
        "aws",
        3,
    ),
    (
        "CKV_AZURE_33",
        "Storage Account logging is disabled",
        "azurerm_storage_account.data",
        "azure",
        2,
    ),
    (
        "CKV_AZURE_1",
        "Linux VM doesn't use SSH key authentication",
        "azurerm_linux_virtual_machine.app",
        "azure",
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
        "CKV_GCP_39",
        "Compute instance has project-wide SSH keys",
        "google_compute_instance.api",
        "gcp",
        2,
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
        "CKV_K8S_21",
        "Default namespace should not be used",
        "Pod/worker",
        "kubernetes",
        1,
    ),
    ("CKV_K8S_29", "Memory limits not defined", "Deployment/cache", "kubernetes", 2),
    (
        "CKV_K8S_37",
        "Minimize the admission of containers with CAP_SYS_ADMIN",
        "DaemonSet/node-agent",
        "kubernetes",
        4,
    ),
    ("CKV_K8S_43", "Image should use digest", "Deployment/checkout", "kubernetes", 2),
    (
        "CKV_DOCKER_3",
        "Ensure that a user for the container has been created",
        "Dockerfile",
        "docker",
        3,
    ),
    ("CKV_DOCKER_7", "Latest tag should not be used", "Dockerfile", "docker", 1),
]


# ----- Secrets -------------------------------------------------------
SECRET_TYPES: List[Tuple[str, str, str]] = [
    # (kind, rule_name, regex-looking fake token)
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
    ("twilio_api", "Twilio API Key", "SKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ("google_api_key", "Google API Key", "AIzaSyA-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ("mailgun_api_key", "Mailgun API Key", "key-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    (
        "sendgrid_key",
        "SendGrid API Key",
        "SG.XXXXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    (
        "private_key",
        "Private Key (PEM)",
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
        "postgres://user:password@db.prod.internal:5432/app",
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


# =====================================================================
# 2. УТИЛИТЫ
# =====================================================================


def pick_weighted(items: Sequence[Any], weights: Sequence[float]) -> Any:
    return random.choices(items, weights=weights, k=1)[0]


def rand_hex(n: int) -> str:
    return "".join(random.choices(string.hexdigits.lower(), k=n))


def rand_semver() -> str:
    return f"{random.randint(0, 4)}.{random.randint(0, 30)}.{random.randint(0, 60)}"


def bump_version(v: str) -> str:
    parts = v.split(".")
    if len(parts) != 3:
        return v + ".1"
    try:
        parts[-1] = str(int(parts[-1]) + random.randint(1, 5))
    except ValueError:
        return v + ".1"
    return ".".join(parts)


def random_datetime_within(days: int) -> str:
    delta = timedelta(days=random.uniform(0, days), seconds=random.uniform(0, 86400))
    dt = datetime.now(timezone.utc) - delta
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def weighted_severity(weights: Dict[int, float]) -> int:
    keys = list(weights.keys())
    vals = list(weights.values())
    return int(pick_weighted(keys, vals))


# =====================================================================
# 3. ГЕНЕРАТОРЫ FINDINGS
# =====================================================================
# Все генераторы возвращают готовый dict под generic JSON импорт.
# Поля соответствуют structure в backend/internal/parser/generic.go.


def make_sca_finding() -> Dict[str, Any]:
    ecosystem = random.choice(list(SCA_COMPONENTS.keys()))
    component = random.choice(SCA_COMPONENTS[ecosystem])
    version = rand_semver()

    # Подбираем CVE: сперва ищем маппинг по компоненту, иначе — общий SCA-пул
    specific_cves = COMPONENT_TO_CVES.get(component)
    if specific_cves:
        # 1–3 CVE из маппинга
        k = random.randint(1, min(3, len(specific_cves)))
        cves = random.sample(specific_cves, k=k)
    else:
        cves = [random.choice(SCA_CVES)]

    # С небольшой вероятностью добавим KEV-CVE — повышает enrichment coverage
    if random.random() < 0.25:
        cves.append(random.choice(KEV_CVES))
        cves = list(dict.fromkeys(cves))  # dedup с сохранением порядка

    cwe_id, _ = random.choice(CWE_POOL)
    purl = f"pkg:{ecosystem}/{component.replace('/', '%2F')}@{version}"

    finding: Dict[str, Any] = {
        "kind": "sca",
        "title": f"Vulnerable dependency: {component}@{version}",
        "description": (
            f"Known vulnerability detected in {component} version {version}. "
            f"Fixed versions are available upstream. "
            f"Rated {random.choice(['High', 'Critical', 'Medium'])} by upstream advisory."
        ),
        "severity": weighted_severity({1: 0.15, 2: 0.35, 3: 0.35, 4: 0.15}),
        "confidence": weighted_severity({1: 0.2, 2: 0.5, 3: 0.3}),
        "component": component,
        "component_version": version,
        "cve_ids": cves,
        "cwe_ids": [cwe_id],
        "cpe_uri": f"cpe:2.3:a:*:{component}:{version}:*:*:*:*:*:*:*",
        "package_ecosystem": ecosystem,
        "purl": purl,
        "rule_id": f"{ecosystem.upper()}-SCA-{cves[0]}",
        "rule_name": f"Vulnerable {ecosystem} package",
    }
    if random.random() < 0.75:
        finding["fixed_version"] = bump_version(version)
    finding["source_type"] = random.choice(
        ["trivy", "grype", "snyk", "dependency-check"]
    )
    return finding


def make_sast_finding() -> Dict[str, Any]:
    rule_id, title, cwes = random.choice(SAST_RULES)
    file_path = random.choice(SAST_FILE_PATHS)
    snippet = random.choice(SAST_SNIPPETS)
    line_start = random.randint(10, 900)
    line_end = line_start + random.randint(0, 15)

    # С вероятностью ~10% привяжем SAST к какой-нибудь реальной CVE
    # (характерно, например, для SAST-правил против уязвимых API log4j)
    cves: List[str] = []
    if random.random() < 0.10:
        cves.append(random.choice(SCA_CVES))

    source = "semgrep"
    if rule_id.startswith("gosec."):
        source = "gosec"
    elif rule_id.startswith("bandit."):
        source = "bandit"
    elif rule_id.startswith("eslint"):
        source = "eslint"
    elif rule_id.startswith("brakeman"):
        source = "brakeman"

    return {
        "kind": "sast",
        "title": title,
        "description": f"Rule '{rule_id}' matched at {file_path}:{line_start}. "
        f"Review for potential impact on security invariants.",
        "severity": weighted_severity({1: 0.15, 2: 0.40, 3: 0.35, 4: 0.10}),
        "confidence": weighted_severity({0: 0.05, 1: 0.25, 2: 0.55, 3: 0.15}),
        "file_path": file_path,
        "line_start": line_start,
        "line_end": line_end,
        "cve_ids": cves,
        "cwe_ids": cwes,
        "rule_id": rule_id,
        "rule_name": title,
        "code_snippet": snippet,
        "source_type": source,
    }


def make_dast_finding() -> Dict[str, Any]:
    path, method, params, issue, cwes = random.choice(DAST_ENDPOINTS)
    host = random.choice(
        [
            "https://app.local",
            "https://staging.example.com",
            "https://api.example.com",
            "https://qa.internal.example.org",
        ]
    )
    param = random.choice(params) if params else ""
    query = f"?{param}=FUZZ" if param and method == "GET" else ""
    url = f"{host}{path}{query}"

    http_evidence = {
        "request": f"{method} {path}{query} HTTP/1.1\nHost: {host.split('//')[1]}\n"
        f"User-Agent: ASOC-Seeder/1.0\n\n",
        "response": "HTTP/1.1 200 OK\nContent-Type: text/html\n\n<reflected>FUZZ</reflected>",
    }

    return {
        "kind": "dast",
        "title": issue,
        "description": f"{issue} identified while fuzzing {method} {path}. "
        f"Manual verification is recommended.",
        "severity": weighted_severity({1: 0.20, 2: 0.45, 3: 0.30, 4: 0.05}),
        "confidence": weighted_severity({0: 0.05, 1: 0.20, 2: 0.50, 3: 0.25}),
        "cve_ids": [],
        "cwe_ids": cwes,
        "url": url,
        "http_method": method,
        "http_param": param or None,
        "http_evidence": http_evidence,
        "rule_id": f"DAST-{cwes[0]}",
        "rule_name": issue,
        "source_type": random.choice(["zap", "burp", "nuclei", "acunetix"]),
    }


def make_iac_finding() -> Dict[str, Any]:
    rule_id, title, resource, provider, base_sev = random.choice(IAC_RULES)
    cwe_id, _ = random.choice([(732, ""), (284, ""), (16, ""), (200, ""), (306, "")])

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
        "description": f"Infrastructure misconfiguration: {title}. "
        f"Policy {rule_id} failed for resource {resource}.",
        "severity": base_sev,
        "confidence": 3,
        "file_path": file_path_map.get(provider, "iac/unknown.tf"),
        "line_start": random.randint(1, 120),
        "cve_ids": [],
        "cwe_ids": [cwe_id] if cwe_id else [],
        "iac_resource": resource,
        "iac_provider": provider,
        "rule_id": rule_id,
        "rule_name": title,
        "source_type": random.choice(["checkov", "tfsec", "kics", "terrascan"]),
    }


def make_secret_finding() -> Dict[str, Any]:
    kind, rule_name, _example = random.choice(SECRET_TYPES)
    file_path = random.choice(SECRET_FILES)
    commit_sha = rand_hex(40)
    line = random.randint(1, 200)

    return {
        "kind": "secrets",
        "title": f"Potential leak: {rule_name}",
        "description": f"Detected credential-like pattern ({kind}) in {file_path}. "
        f"Verify if committed to the repository and rotate the secret.",
        "severity": weighted_severity({2: 0.15, 3: 0.55, 4: 0.30}),
        "confidence": weighted_severity({1: 0.1, 2: 0.4, 3: 0.5}),
        "file_path": file_path,
        "line_start": line,
        "line_end": line,
        "cve_ids": [],
        "cwe_ids": [798, 522],
        "secret_kind": kind,
        "commit_sha": commit_sha,
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


def generate_findings(
    total: int,
    kinds: Sequence[str],
    distribution: Dict[str, float],
) -> List[Dict[str, Any]]:
    """Генерирует список findings согласно взвешенному распределению."""
    # Нормализуем распределение по выбранным kinds
    filtered = {k: distribution.get(k, 0.0) for k in kinds}
    total_w = sum(filtered.values())
    if total_w <= 0:
        # Равномерно
        filtered = {k: 1.0 for k in kinds}
        total_w = len(kinds)
    norm = {k: v / total_w for k, v in filtered.items()}

    out: List[Dict[str, Any]] = []
    keys = list(norm.keys())
    weights = list(norm.values())
    for _ in range(total):
        k = pick_weighted(keys, weights)
        finding = KIND_GENERATORS[k]()

        # Общие поля
        finding.setdefault("first_seen", random_datetime_within(days=180))
        finding.setdefault("last_seen", random_datetime_within(days=14))
        finding["status"] = weighted_severity(
            {0: 0.70, 1: 0.10, 2: 0.05, 3: 0.10, 4: 0.05}
        )
        out.append(finding)
    return out


# =====================================================================
# 4. HTTP-КЛИЕНТ (stdlib, без requests)
# =====================================================================


class APIError(RuntimeError):
    pass


def http_request(
    method: str,
    url: str,
    body: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 30.0,
    max_retries: int = 4,
) -> Any:
    """POST/GET с retry и экспоненциальной задержкой."""
    data: Optional[bytes] = None
    req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")

    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(
            url=url, data=data, headers=req_headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if not raw:
                    return None
                try:
                    return json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    return raw.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            body_txt = ""
            try:
                body_txt = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            # 4xx — не ретраим (кроме 429)
            if 400 <= e.code < 500 and e.code != 429:
                raise APIError(
                    f"HTTP {e.code} on {method} {url}: {body_txt[:400]}"
                ) from e
            last_err = APIError(f"HTTP {e.code}: {body_txt[:200]}")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_err = e

        sleep_s = min(8.0, 0.5 * (2 ** (attempt - 1))) + random.uniform(0, 0.3)
        time.sleep(sleep_s)

    raise APIError(f"Failed {method} {url} after {max_retries} retries: {last_err}")


# =====================================================================
# 5. ОПЕРАЦИИ С API
# =====================================================================


def create_project(
    api_url: str, definition: Dict[str, Any], headers: Dict[str, str], timeout: float
) -> str:
    """Создаёт проект через POST /api/v1/projects → возвращает UUID."""
    # Уникализируем имя, чтобы не конфликтовать с уже существующими
    suffix = "-" + rand_hex(4)
    payload = {
        "name": definition["name"] + suffix,
        "description": definition.get("description", ""),
        "tags": definition.get("tags", []),
    }
    resp = http_request(
        "POST",
        api_url.rstrip("/") + "/api/v1/projects",
        body=payload,
        headers=headers,
        timeout=timeout,
    )
    if not isinstance(resp, dict) or "data" not in resp:
        raise APIError(f"Unexpected response when creating project: {resp!r}")
    pid = resp["data"].get("id")
    if not pid:
        raise APIError(f"Missing id in project response: {resp!r}")
    return pid


def import_batch(
    api_url: str,
    project_id: str,
    findings: List[Dict[str, Any]],
    headers: Dict[str, str],
    timeout: float,
    source_type: str = "generic",
) -> Dict[str, Any]:
    """Отправляет батч findings на POST /api/v1/import?project_id=..."""
    payload = {
        "project_id": project_id,
        "source_type": source_type,
        "findings": findings,
    }
    url = f"{api_url.rstrip('/')}/api/v1/import?project_id={project_id}"
    resp = http_request("POST", url, body=payload, headers=headers, timeout=timeout)
    return resp if isinstance(resp, dict) else {"raw": resp}


# =====================================================================
# 6. ПРОГРЕСС-БАР (stdlib)
# =====================================================================


def _term_width(default: int = 80) -> int:
    try:
        return max(40, os.get_terminal_size().columns)
    except OSError:
        return default


def progress(done: int, total: int, prefix: str = "") -> None:
    width = _term_width() - len(prefix) - 30
    width = max(10, width)
    frac = 0.0 if total == 0 else min(1.0, done / total)
    filled = int(frac * width)
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\r{prefix} [{bar}] {done}/{total} ({frac * 100:5.1f}%)")
    sys.stdout.flush()
    if done >= total:
        sys.stdout.write("\n")


# =====================================================================
# 7. CLI
# =====================================================================


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
    timeout: float
    dry_run: bool
    verbose: bool
    extra_headers: Dict[str, str] = field(default_factory=dict)


def parse_distribution(s: Optional[str]) -> Dict[str, float]:
    if not s:
        return dict(DEFAULT_DISTRIBUTION)
    out: Dict[str, float] = {}
    for pair in s.split(","):
        if "=" not in pair:
            raise argparse.ArgumentTypeError(f"Bad distribution entry: {pair!r}")
        k, v = pair.split("=", 1)
        k = k.strip().lower()
        if k not in KIND_GENERATORS:
            raise argparse.ArgumentTypeError(f"Unknown kind in distribution: {k}")
        try:
            out[k] = float(v)
        except ValueError as e:
            raise argparse.ArgumentTypeError(f"Bad weight for {k}: {v}") from e
    if not out:
        return dict(DEFAULT_DISTRIBUTION)
    return out


def parse_args(argv: Optional[Sequence[str]] = None) -> Config:
    p = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Generate and push realistic test vulnerabilities into an ASOC platform.",
    )
    p.add_argument(
        "--api-url",
        default=os.environ.get("ASOC_API_URL", "http://localhost:8080"),
        help="Base URL of the ASOC API (default: %(default)s)",
    )
    p.add_argument(
        "--count",
        type=int,
        default=1000,
        help="Total number of findings to generate (default: %(default)s)",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Findings per import batch (default: %(default)s)",
    )
    p.add_argument(
        "--project-id",
        default=None,
        help="Push all findings into this existing project UUID (skips project creation)",
    )
    p.add_argument(
        "--project-count",
        type=int,
        default=5,
        help="If --project-id not set, auto-create this many projects (default: %(default)s)",
    )
    p.add_argument(
        "--kinds",
        default="sca,sast,dast,iac,secrets",
        help="Comma-separated finding kinds to include (default: all)",
    )
    p.add_argument(
        "--distribution",
        default=None,
        help="Weighted distribution, e.g. 'sca=0.5,sast=0.3,dast=0.2'",
    )
    p.add_argument(
        "--output",
        help="Write the generated JSON payload to file instead of POSTing "
        "(can be combined with --dry-run)",
    )
    p.add_argument(
        "--seed", type=int, default=None, help="PRNG seed for reproducible datasets"
    )
    p.add_argument(
        "--auth-token",
        default=os.environ.get("ASOC_AUTH_TOKEN"),
        help="Bearer token for API auth (env: ASOC_AUTH_TOKEN)",
    )
    p.add_argument(
        "--header",
        action="append",
        default=[],
        help="Extra HTTP header 'Name: Value'. Can be passed multiple times.",
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout in seconds (default: %(default)s)",
    )
    p.add_argument(
        "--dry-run", action="store_true", help="Generate but do NOT send to API"
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")

    args = p.parse_args(argv)

    kinds = [k.strip().lower() for k in args.kinds.split(",") if k.strip()]
    unknown = [k for k in kinds if k not in KIND_GENERATORS]
    if unknown:
        p.error(f"Unknown kinds: {unknown}. Supported: {list(KIND_GENERATORS)}")

    extra_headers: Dict[str, str] = {}
    for h in args.header:
        if ":" not in h:
            p.error(f"Bad header: {h!r}. Expected 'Name: Value'")
        name, value = h.split(":", 1)
        extra_headers[name.strip()] = value.strip()

    return Config(
        api_url=args.api_url,
        count=args.count,
        batch_size=max(1, args.batch_size),
        project_id=args.project_id,
        project_count=max(1, args.project_count),
        kinds=kinds,
        distribution=parse_distribution(args.distribution),
        output=args.output,
        seed=args.seed,
        auth_token=args.auth_token,
        timeout=args.timeout,
        dry_run=args.dry_run,
        verbose=args.verbose,
        extra_headers=extra_headers,
    )


# =====================================================================
# 8. ГЛАВНАЯ ЛОГИКА
# =====================================================================


def validate_uuid(s: str) -> str:
    try:
        return str(uuid.UUID(s))
    except ValueError as e:
        raise SystemExit(f"[error] Invalid project UUID: {s}") from e


def build_headers(cfg: Config) -> Dict[str, str]:
    headers = dict(cfg.extra_headers)
    if cfg.auth_token:
        headers["Authorization"] = f"Bearer {cfg.auth_token}"
    return headers


def ensure_projects(cfg: Config, headers: Dict[str, str]) -> List[str]:
    """Возвращает список project_id, по которым будут распределены findings."""
    if cfg.project_id:
        return [validate_uuid(cfg.project_id)]
    if cfg.dry_run:
        # В dry-run сеть нам не доступна — генерим случайные UUID
        return [str(uuid.uuid4()) for _ in range(cfg.project_count)]

    wanted = min(cfg.project_count, len(DEFAULT_PROJECTS))
    # Если нужно больше проектов, чем в пуле — дублируем с постфиксом
    defs: List[Dict[str, Any]] = []
    for i in range(cfg.project_count):
        base = DEFAULT_PROJECTS[i % len(DEFAULT_PROJECTS)]
        defs.append(
            {
                "name": base["name"],
                "description": base["description"],
                "tags": list(base.get("tags", [])) + ["seed"],
            }
        )

    ids: List[str] = []
    print(f"[i] Creating {len(defs)} project(s)...")
    for d in defs:
        try:
            pid = create_project(cfg.api_url, d, headers, cfg.timeout)
            if cfg.verbose:
                print(f"    + {d['name']!r} → {pid}")
            ids.append(pid)
        except APIError as e:
            print(
                f"    [!] Failed to create project {d['name']!r}: {e}", file=sys.stderr
            )
    if not ids:
        raise SystemExit("[error] No projects available. Aborting.")
    return ids


def save_offline(
    cfg: Config, project_ids: List[str], findings: List[Dict[str, Any]]
) -> None:
    payload = {
        "project_id": project_ids[0],
        "source_type": "generic",
        "findings": findings,
    }
    with open(cfg.output, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[✓] Wrote {len(findings)} findings to {cfg.output}")


def push_online(
    cfg: Config, project_ids: List[str], findings: List[Dict[str, Any]]
) -> None:
    headers = build_headers(cfg)
    total = len(findings)
    done = 0
    imported_total = 0
    updated_total = 0
    errors_total = 0

    # Равномерно раскладываем findings по проектам, сохраняя общий порядок
    per_project: Dict[str, List[Dict[str, Any]]] = {pid: [] for pid in project_ids}
    for i, f in enumerate(findings):
        pid = project_ids[i % len(project_ids)]
        per_project[pid].append(f)

    t0 = time.monotonic()
    for pid, items in per_project.items():
        for start in range(0, len(items), cfg.batch_size):
            batch = items[start : start + cfg.batch_size]
            try:
                resp = import_batch(
                    cfg.api_url, pid, batch, headers, cfg.timeout, source_type="generic"
                )
                imported_total += int(resp.get("imported", 0) or 0)
                updated_total += int(resp.get("updated", 0) or 0)
                errs = resp.get("errors") or []
                errors_total += len(errs)
                if cfg.verbose and errs:
                    for err in errs[:5]:
                        print(
                            f"    [!] import error idx={err.get('index')}: {err.get('message')}",
                            file=sys.stderr,
                        )
            except APIError as e:
                print(f"\n    [!] batch failed for project {pid}: {e}", file=sys.stderr)
                errors_total += len(batch)

            done += len(batch)
            progress(done, total, prefix="    Import")

    elapsed = time.monotonic() - t0
    rate = total / elapsed if elapsed > 0 else 0.0
    print(
        f"[✓] Done in {elapsed:5.1f}s  "
        f"({rate:6.0f} findings/s)  "
        f"imported={imported_total}  updated={updated_total}  errors={errors_total}"
    )


def print_stats(findings: List[Dict[str, Any]]) -> None:
    by_kind: Dict[str, int] = {}
    by_sev: Dict[int, int] = {}
    cve_unique: set = set()
    with_cve = 0
    for f in findings:
        by_kind[f["kind"]] = by_kind.get(f["kind"], 0) + 1
        by_sev[f["severity"]] = by_sev.get(f["severity"], 0) + 1
        cves = f.get("cve_ids") or []
        if cves:
            with_cve += 1
            cve_unique.update(cves)
    print(
        "    by kind:     " + ", ".join(f"{k}={v}" for k, v in sorted(by_kind.items()))
    )
    sev_names = {0: "info", 1: "low", 2: "med", 3: "high", 4: "crit"}
    print(
        "    by severity: "
        + ", ".join(f"{sev_names.get(k, k)}={v}" for k, v in sorted(by_sev.items()))
    )
    print(
        f"    with CVE:    {with_cve}/{len(findings)}  "
        f"(unique CVE IDs: {len(cve_unique)})"
    )


def main(argv: Optional[Sequence[str]] = None) -> int:
    cfg = parse_args(argv)
    if cfg.seed is not None:
        random.seed(cfg.seed)

    print(
        f"[i] Generating {cfg.count} findings "
        f"(kinds={cfg.kinds}, batch={cfg.batch_size})..."
    )
    findings = generate_findings(cfg.count, cfg.kinds, cfg.distribution)
    print(f"[✓] Generated {len(findings)} findings")
    print_stats(findings)

    if cfg.output:
        # Для оффлайн-сохранения project_id не важен — берём случайный
        pid = cfg.project_id or str(uuid.uuid4())
        save_offline(cfg, [pid], findings)
        if cfg.dry_run:
            return 0
        # Если указан --output без --dry-run — всё равно сохранили файл,
        # но также попробуем заимпортить
        project_ids = (
            [validate_uuid(cfg.project_id)]
            if cfg.project_id
            else ensure_projects(cfg, build_headers(cfg))
        )
        push_online(cfg, project_ids, findings)
        return 0

    if cfg.dry_run:
        print("[i] --dry-run set, nothing was sent.")
        return 0

    headers = build_headers(cfg)
    project_ids = ensure_projects(cfg, headers)
    push_online(cfg, project_ids, findings)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[!] Interrupted by user", file=sys.stderr)
        sys.exit(130)
