const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "licenses", "frontend-licenses.json");
const outputPath = path.join(__dirname, "..", "licenses", "frontend-licenses.md");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const rows = Object.entries(data)
    .map(([pkg, info]) => {
        const licenses = Array.isArray(info.licenses)
            ? info.licenses.join(", ")
            : (info.licenses || "UNKNOWN");

        return {
            package: pkg,
            licenses,
            repository: info.repository || "",
            licenseFile: info.licenseFile || "",
        };
    })
    .sort((a, b) => a.package.localeCompare(b.package));

let md = `## Frontend dependencies

| Package | License | Repository |
|---|---|---|
`;

for (const row of rows) {
    const repo = row.repository ? row.repository.replace(/\|/g, "\\|") : "";
    md += `| \`${row.package}\` | ${String(row.licenses).replace(/\|/g, "\\|")} | ${repo} |\n`;
}

md += `\n`;

fs.writeFileSync(outputPath, md, "utf8");

console.log(`Wrote ${outputPath}`);