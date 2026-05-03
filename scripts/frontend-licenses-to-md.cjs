const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "licenses", "frontend-licenses.json");
const outputPath = path.join(__dirname, "..", "licenses", "frontend-licenses.md");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function escapeMd(value) {
    return String(value || "")
        .replace(/\|/g, "\\|")
        .replace(/\r?\n/g, " ")
        .trim();
}

const rows = Object.entries(data)
    .filter(([pkg, info]) => {
        // Убираем собственный package проекта, если license-checker его подхватил.
        if (pkg.startsWith("frontend-tmp@")) return false;
        if (info.private === true) return false;
        return true;
    })
    .map(([pkg, info]) => {
        const licenses = Array.isArray(info.licenses)
            ? info.licenses.join(", ")
            : info.licenses || "UNKNOWN";

        return {
            package: pkg,
            licenses,
            repository: info.repository || "",
        };
    })
    .sort((a, b) => a.package.localeCompare(b.package));

let md = `| Package | License | Repository |
|---|---|---|
`;

for (const row of rows) {
    md += `| \`${escapeMd(row.package)}\` | ${escapeMd(row.licenses)} | ${escapeMd(row.repository)} |\n`;
}

fs.writeFileSync(outputPath, md, "utf8");

console.log(`Wrote ${outputPath}`);