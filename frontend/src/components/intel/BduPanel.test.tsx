import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BduPanel from "./BduPanel";

describe("BduPanel", () => {
  it("renders empty data fallback", () => {
    const { container } = render(<BduPanel bdu={{}} />);
    expect(screen.getByText("Данные БДУ ФСТЭК отсутствуют")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders local DB format entry with key fields", () => {
    const { container } = render(
      <BduPanel
        bdu={{
          "BDU:2022-01428": {
            bdu_id: "BDU:2022-01428",
            name: "Уязвимость пакета chromium",
            description: "Описание уязвимости...",
            vendor: "Сообщество свободного ПО",
            software_name: "Debian GNU/Linux",
            software_version: "10",
            software_type: "Операционная система",
            os_hardware: "",
            vuln_class: "Уязвимость кода",
            detection_date: "09.02.2022",
            cvss_v2: "AV:N/AC:L/Au:N/C:C/I:C/A:C",
            cvss_v3: "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
            cvss_v4: "",
            severity: "Критический уровень опасности",
            remediation: "Обновить пакет",
            status: "Подтверждена производителем",
            exploit_exists: "Существует",
            fix_info: "Уязвимость устранена",
            source_urls: "https://security-tracker.debian.org",
            other_ids: "CVE-2022-0975",
            other_info: "",
            incident_info: "Да",
            exploitation_method: "Манипулирование данными",
            fix_method: "Обновление ПО",
            published_date: "23.03.2022",
            updated_date: "13.09.2024",
            consequences: "",
            vuln_state: "Опубликована",
            cwe_description: "Использование после освобождения",
            cwe_id: "CWE-416",
          },
        }}
      />
    );

    expect(screen.getByText("BDU:2022-01428")).toBeInTheDocument();
    expect(screen.getByText("Уязвимость пакета chromium")).toBeInTheDocument();
    expect(screen.getByText("Критический уровень опасности")).toBeInTheDocument();
    expect(screen.getByText("Существует")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders legacy web-scraping format as fallback", () => {
    render(
      <BduPanel
        bdu={{
          "CVE-1": {
            identifier: "BDU:2021-00001",
            description: "Legacy description text",
            severity: "Высокий",
          },
        }}
      />
    );

    expect(screen.getByText("BDU:2021-00001")).toBeInTheDocument();
    expect(screen.getByText("Legacy description text")).toBeInTheDocument();
  });
});
